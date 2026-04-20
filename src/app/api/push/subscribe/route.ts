import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

/**
 * POST /api/push/subscribe
 *
 * Body:
 *   {
 *     subscription: {
 *       endpoint: string;
 *       keys: { p256dh: string; auth: string; }
 *     },
 *     userAgent?: string;
 *   }
 *
 * Saves or updates a push notification subscription for the current user.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve the caller's employee record
  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const body = await req.json();
  const { subscription, userAgent } = body as {
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    userAgent?: string;
  };

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 });
  }

  // Upsert the subscription (endpoint is unique)
  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        employee_id: employee.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent || null,
        is_active: true,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    )
    .select()
    .single();

  if (error) {
    console.error("[push/subscribe] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, subscriptionId: data.id }, { status: 201 });
}

/**
 * DELETE /api/push/subscribe
 *
 * Body:
 *   { endpoint: string }
 *
 * Removes a push subscription.
 */
export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { endpoint } = body as { endpoint: string };

  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint required" }, { status: 400 });
  }

  // Soft delete — mark as inactive
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ is_active: false })
    .eq("endpoint", endpoint);

  if (error) {
    console.error("[push/unsubscribe] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/push/subscribe
 *
 * Returns the current user's active push subscriptions.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: employee } = await supabase
    .from("employees")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ subscriptions: [] });
  }

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, user_agent, created_at, last_used_at")
    .eq("employee_id", employee.id)
    .eq("is_active", true);

  if (error) {
    console.error("[push/subscribe] GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscriptions });
}
