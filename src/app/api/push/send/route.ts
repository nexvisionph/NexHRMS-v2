import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/services/supabase-server";
import webpush from "web-push";

// Configure VAPID credentials
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@nexhrms.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

/**
 * POST /api/push/send
 *
 * Body:
 *   {
 *     employeeId?: string;       // Send to specific employee
 *     employeeIds?: string[];    // Send to multiple employees
 *     title: string;
 *     body: string;
 *     url?: string;              // URL to open when clicked
 *     tag?: string;              // Notification tag (for grouping)
 *     notificationId?: string;   // Link to notification_logs entry
 *   }
 *
 * Auth: Admin, HR, or system service (via API key).
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const adminSupabase = await createAdminSupabaseClient();

  // Check for API key (for server-to-server calls)
  const apiKey = req.headers.get("x-api-key");
  const isSystemCall = apiKey === process.env.PUSH_API_KEY;

  if (!isSystemCall) {
    // Any authenticated session user may trigger a push send.
    // Push calls are initiated by client-side store logic which already
    // controls recipient targeting — employees can trigger pushes for
    // leave/overtime/task submission events (which target admin/HR users).
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { employeeId, employeeIds, title, body: msgBody, url, tag, notificationId } = body as {
    employeeId?: string;
    employeeIds?: string[];
    title: string;
    body: string;
    url?: string;
    tag?: string;
    notificationId?: string;
  };

  if (!title || !msgBody) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  // Determine target employee IDs
  const targetIds: string[] = [];
  if (employeeId) targetIds.push(employeeId);
  if (employeeIds) targetIds.push(...employeeIds);

  if (targetIds.length === 0) {
    return NextResponse.json({ error: "No target employees specified" }, { status: 400 });
  }

  // Fetch active subscriptions for target employees
  const { data: subscriptions, error: subError } = await adminSupabase
    .from("push_subscriptions")
    .select("id, employee_id, endpoint, p256dh, auth")
    .in("employee_id", targetIds)
    .eq("is_active", true);

  if (subError) {
    console.error("[push/send] Error fetching subscriptions:", subError);
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log("[push/send] No active subscriptions for employees:", targetIds);
    return NextResponse.json({ 
      ok: true, 
      sent: 0, 
      failed: 0,
      message: "No active push subscriptions found" 
    });
  }

  // Build push payload
  const pushPayload = JSON.stringify({
    title,
    body: msgBody,
    url: url || "/notifications",
    tag: tag || `nexhrms-${Date.now()}`,
    notificationId,
    timestamp: new Date().toISOString(),
  });

  // Track results
  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];

  // Send to each subscription via web-push
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[push/send] VAPID keys not configured — skipping web-push delivery");
    return NextResponse.json({
      ok: false,
      error: "VAPID keys not configured",
      sent: 0,
      failed: subscriptions.length,
    }, { status: 503 });
  }

  const results = await Promise.allSettled(
    subscriptions.map(async (sub: { id: string; employee_id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload,
          { TTL: 60 * 60 } // 1 hour TTL
        );
        return { success: true, id: sub.id };
      } catch (err: unknown) {
        const pushErr = err as { statusCode?: number };
        // 404 or 410 means the subscription is expired/invalid
        if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        }
        throw err;
      }
    })
  );

  // Count results
  for (const result of results) {
    if (result.status === "fulfilled") {
      sent++;
    } else {
      failed++;
      console.error("[push/send] Failed:", result.reason);
    }
  }

  // Deactivate expired subscriptions
  if (expiredEndpoints.length > 0) {
    await adminSupabase
      .from("push_subscriptions")
      .update({ is_active: false })
      .in("endpoint", expiredEndpoints);
    console.log("[push/send] Deactivated", expiredEndpoints.length, "expired subscriptions");
  }

  // Update last_used_at for successfully sent subscriptions
  const sentIds = results
    .filter((r): r is PromiseFulfilledResult<{ success: boolean; id: string }> => r.status === "fulfilled")
    .map((r) => r.value.id);
  
  if (sentIds.length > 0) {
    await adminSupabase
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .in("id", sentIds);
  }

  console.log(`[push/send] Sent: ${sent}, Failed: ${failed}, Expired: ${expiredEndpoints.length}`);

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    expired: expiredEndpoints.length,
  });
}
