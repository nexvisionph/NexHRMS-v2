import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase-server";
import { getCurrentUserFromCookie } from "@/services/auth.service";

async function getCurrentEmployee(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: byId } = await supabase
    .from("employees")
    .select("id, role, profile_id, company_id")
    .eq("id", userId)
    .maybeSingle();
  if (byId?.id) return byId;

  const { data: byProfile } = await supabase
    .from("employees")
    .select("id, role, profile_id, company_id")
    .eq("profile_id", userId)
    .maybeSingle();
  return byProfile || null;
}

export async function GET(req: Request, { params }: { params: Promise<{ employee_id: string }> }) {
  const { employee_id } = await params;
  try {
    const supabase = await createClient();
    const user = await getCurrentUserFromCookie();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const employee = await getCurrentEmployee(supabase, user.id);
    const isAdminHr = !!employee && ["admin", "hr"].includes(employee.role);

    if (!employee || (!isAdminHr && employee.id !== employee_id)) {
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
      .eq("company_id", employee.company_id || "default")
      .eq("employee_id", employee_id);

    if (dateFrom) query = query.gte("logged_at", `${dateFrom}T00:00:00.000Z`);
    if (dateTo) query = query.lte("logged_at", `${dateTo}T23:59:59.999Z`);

    const { data, error } = await query.order("logged_at", { ascending: false }).limit(500);

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error(`GET /api/biometric/logs/${employee_id}:`, error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
