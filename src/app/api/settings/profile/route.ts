import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

const ALLOWED_FIELDS = [
  "phone",
  "birthday",
  "address",
  "emergency_contact",
  "preferred_channel",
  "whatsapp_number",
  "avatar_url",
] as const;

type ProfilePatchField = (typeof ALLOWED_FIELDS)[number];

const VALID_CHANNELS = ["email", "whatsapp", "sms", "in_app"] as const;

/**
 * GET /api/settings/profile
 * Returns the current employee's updatable profile fields.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("employees")
      .select("phone, birthday, address, emergency_contact, preferred_channel, whatsapp_number, avatar_url, name, email, role, department, status, work_type, salary, join_date, location, shift_id, team_leader, work_days, job_title")
      .eq("profile_id", user.id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[API] settings/profile GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/profile
 * Updates the current employee's contact profile fields.
 * Only allows the whitelist of self-editable fields.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();

    // Build a safe patch object — only allow whitelisted fields
    const patch: Partial<Record<ProfilePatchField, string | null>> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        const val = body[field];
        // Accept string or null only
        if (val !== null && typeof val !== "string") {
          return NextResponse.json(
            { error: `Field '${field}' must be a string or null` },
            { status: 400 },
          );
        }
        // Validate preferred_channel against DB CHECK constraint
        if (field === "preferred_channel" && val !== null) {
          if (!VALID_CHANNELS.includes(val as (typeof VALID_CHANNELS)[number])) {
            return NextResponse.json(
              { error: `Invalid channel. Must be one of: ${VALID_CHANNELS.join(", ")}` },
              { status: 400 },
            );
          }
        }
        patch[field] = val || null;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
    }

    const { error } = await supabase
      .from("employees")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("profile_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[API] settings/profile PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
