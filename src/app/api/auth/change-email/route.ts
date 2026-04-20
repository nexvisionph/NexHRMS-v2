import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/change-email
 * Initiates an email change for the currently authenticated user.
 *
 * Flow (Supabase):
 *  1. `auth.updateUser({ email })` sends a confirmation link to the NEW address.
 *  2. The `auth.users` email only changes after the user clicks that link.
 *  3. We also update `employees.email` and `profiles.email` immediately so
 *     the display email is in sync without waiting for confirmation.
 *
 * Security:
 *  - Session required (401 if not authenticated).
 *  - New email must differ from current and not be taken by another employee.
 *  - Input is validated and sanitised before any DB write.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const newEmail: unknown = body?.newEmail;

    if (!newEmail || typeof newEmail !== "string") {
      return NextResponse.json({ error: "New email is required" }, { status: 400 });
    }

    const sanitised = newEmail.trim().toLowerCase();

    if (!EMAIL_REGEX.test(sanitised)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (sanitised === (user.email ?? "").toLowerCase()) {
      return NextResponse.json(
        { error: "New email must be different from your current email" },
        { status: 400 },
      );
    }

    // Check if another employee already owns this email
    const { data: existing } = await supabase
      .from("employees")
      .select("id, profile_id")
      .ilike("email", sanitised)
      .maybeSingle();

    if (existing && existing.profile_id !== user.id) {
      return NextResponse.json(
        { error: "This email address is already in use by another account" },
        { status: 409 },
      );
    }

    // 1. Trigger Supabase auth email-change confirmation flow
    const { error: authUpdateError } = await supabase.auth.updateUser(
      { email: sanitised },
      { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login?type=email_change` },
    );

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
    }

    // 2. Update employees.email immediately so display is in sync
    await supabase
      .from("employees")
      .update({ email: sanitised, updated_at: new Date().toISOString() })
      .eq("profile_id", user.id);

    // 3. Update profiles.email if the column is present (best-effort)
    await supabase
      .from("profiles")
      .update({ email: sanitised })
      .eq("id", user.id);

    return NextResponse.json({
      ok: true,
      message: `A confirmation link has been sent to ${sanitised}. Your email will be updated after you click the link.`,
    });
  } catch (err) {
    console.error("[API] change-email error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
