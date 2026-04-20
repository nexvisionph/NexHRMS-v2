import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

/**
 * POST /api/auth/reset-password
 * Sends a password reset email to the currently authenticated user's email address.
 * The Supabase magic link redirects back to /login?type=recovery so the user
 * can set a new password without knowing the current one.
 */
export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json({ error: "No email address on file" }, { status: 400 });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login?type=recovery`,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API] reset-password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
