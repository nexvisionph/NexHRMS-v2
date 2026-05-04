import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase-server";
import { getCurrentUserFromCookie } from "@/services/auth.service";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: employee } = await supabase
      .from("employees")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!employee || employee.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.location !== undefined) updates.location = body.location || null;
    if (body.device_type !== undefined) updates.device_type = body.device_type || null;
    if (body.supported_methods !== undefined) updates.supported_methods = body.supported_methods || [];
    if (body.is_active !== undefined) updates.is_active = !!body.is_active;

    const { data, error } = await supabase
      .from("biometric_devices")
      .update(updates)
      .eq("id", params.id)
      .select("id, name, location, device_type, supported_methods, is_active, last_synced_at, api_key_last4, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error(`PATCH /api/biometric/devices/${params.id}:`, error);
    return NextResponse.json({ error: "Failed to update device" }, { status: 500 });
  }
}
