import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";
import { getCurrentUser } from "@/services/auth.service";

async function getCurrentEmployee(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
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

function manilaDateBoundaryUtc(date: string, endOfDay = false) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;

  const nextDayOffset = endOfDay ? 1 : 0;
  const utcMs = Date.UTC(year, month - 1, day + nextDayOffset) - (8 * 60 * 60 * 1000);
  const boundaryMs = endOfDay ? utcMs - 1 : utcMs;
  return new Date(boundaryMs).toISOString();
}

export async function GET(req: Request, { params }: { params: Promise<{ employee_id: string }> }) {
  const { employee_id } = await params;
  try {
    const supabase = await createServerSupabaseClient();
    const user = await getCurrentUser();

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

    const dateFromUtc = dateFrom ? manilaDateBoundaryUtc(dateFrom) : null;
    const dateToUtc = dateTo ? manilaDateBoundaryUtc(dateTo, true) : null;

    if (dateFromUtc) query = query.gte("logged_at", dateFromUtc);
    if (dateToUtc) query = query.lte("logged_at", dateToUtc);

    const { data, error } = await query.order("logged_at", { ascending: false }).limit(500);

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error(`GET /api/biometric/logs/${employee_id}:`, error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
