import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase-server";
import { getCurrentUserFromCookie } from "@/services/auth.service";

export async function GET(req: Request, { params }: { params: { employee_id: string } }) {
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

    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");

    let query = supabase
      .from("biometric_logs")
      .select(
        "*, employee:employees(id, name, email, department), device:biometric_devices(id, name, location, device_type)"
      )
      .eq("employee_id", params.employee_id);

    if (dateFrom) query = query.gte("logged_at", `${dateFrom}T00:00:00.000Z`);
    if (dateTo) query = query.lte("logged_at", `${dateTo}T23:59:59.999Z`);

    const { data, error } = await query.order("logged_at", { ascending: false }).limit(500);

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error(`GET /api/biometric/logs/${params.employee_id}:`, error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
