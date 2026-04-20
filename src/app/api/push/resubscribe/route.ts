import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

/**
 * POST /api/push/resubscribe
 *
 * Called by the service worker when a push subscription changes
 * (e.g., browser renews the subscription endpoint).
 *
 * Body:
 *   {
 *     oldEndpoint?: string;
 *     newSubscription: {
 *       endpoint: string;
 *       keys: { p256dh: string; auth: string; }
 *     }
 *   }
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const body = await req.json();
  const { oldEndpoint, newSubscription } = body as {
    oldEndpoint?: string;
    newSubscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
  };

  if (!newSubscription?.endpoint || !newSubscription?.keys?.p256dh || !newSubscription?.keys?.auth) {
    return NextResponse.json({ error: "Invalid new subscription" }, { status: 400 });
  }

  // Deactivate the old subscription if provided
  if (oldEndpoint) {
    await supabase
      .from("push_subscriptions")
      .update({ is_active: false })
      .eq("endpoint", oldEndpoint);
  }

  // Upsert the new subscription
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        employee_id: employee.id,
        endpoint: newSubscription.endpoint,
        p256dh: newSubscription.keys.p256dh,
        auth: newSubscription.keys.auth,
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    )
    .select()
    .single();

  if (error) {
    console.error("[push/resubscribe] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, subscriptionId: data.id }, { status: 201 });
}
