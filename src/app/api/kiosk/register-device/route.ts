import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

/**
 * POST /api/kiosk/register-device
 * Body: { deviceId: string, name: string, projectId?: string }
 *
 * Registers or updates a kiosk device in the kiosk_devices table.
 * This satisfies the FK constraint required by qr_tokens and kiosk_pins.
 * Requires admin authentication.
 */
export async function POST(req: Request) {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can register kiosk devices
    const { data: emp } = await supabase
        .from("employees")
        .select("role")
        .eq("profile_id", user.id)
        .single();

    if (!emp || (emp.role !== "admin" && emp.role !== "hr")) {
        return NextResponse.json({ error: "Admin or HR access required" }, { status: 403 });
    }

    const body = await req.json() as { deviceId?: unknown; name?: unknown; projectId?: unknown };
    const { deviceId, name, projectId } = body;

    if (typeof deviceId !== "string" || !deviceId.trim()) {
        return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
    }
    if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (projectId !== undefined && projectId !== null && typeof projectId !== "string") {
        return NextResponse.json({ error: "projectId must be a string or null" }, { status: 400 });
    }

    const payload = {
        id: deviceId.trim(),
        name: name.trim(),
        project_id: typeof projectId === "string" && projectId.trim() ? projectId.trim() : null,
        is_active: true,
    };

    const { data, error } = await supabase
        .from("kiosk_devices")
        .upsert(payload, { onConflict: "id" })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 200 });
}

/**
 * GET /api/kiosk/register-device
 * Returns the list of registered kiosk devices.
 * Requires admin or HR authentication.
 */
export async function GET(req: Request) {
    void req;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: emp } = await supabase
        .from("employees")
        .select("role")
        .eq("profile_id", user.id)
        .single();

    if (!emp || !["admin", "hr", "auditor"].includes(emp.role as string)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { data, error } = await supabase
        .from("kiosk_devices")
        .select("id, name, registered_at, project_id, is_active")
        .order("registered_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
}
