import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase-server";
import { getCurrentUserFromCookie } from "@/services/auth.service";
import { createHash, randomBytes } from "crypto";

export async function GET() {
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

    if (!employee || !["admin", "hr"].includes(employee.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("biometric_devices")
      .select("id, name, location, device_type, supported_methods, is_active, last_synced_at, api_key_last4, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("GET /api/biometric/devices:", error);
    return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: employee } = await supabase
      .from("employees")
      .select("role, company_id")
      .eq("id", user.id)
      .single();

    if (!employee || employee.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, location, device_type, supported_methods } = body as {
      name: string;
      location?: string;
      device_type?: string;
      supported_methods?: string[];
    };

    if (!name) {
      return NextResponse.json({ error: "Device name is required" }, { status: 400 });
    }

    const deviceKey = randomBytes(24).toString("hex");
    const deviceKeyHash = createHash("sha256").update(deviceKey).digest("hex");

    const { data, error } = await supabase
      .from("biometric_devices")
      .insert({
        company_id: employee.company_id,
        name,
        location: location || null,
        device_type: device_type || null,
        supported_methods: supported_methods || [],
        is_active: true,
        api_key_hash: deviceKeyHash,
        api_key_last4: deviceKey.slice(-4),
        created_by: user.id,
      })
      .select("id, name, location, device_type, supported_methods, is_active, last_synced_at, api_key_last4, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ device: data, device_key: deviceKey }, { status: 201 });
  } catch (error) {
    console.error("POST /api/biometric/devices:", error);
    return NextResponse.json({ error: "Failed to create device" }, { status: 500 });
  }
}
