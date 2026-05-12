import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

/**
 * GET /api/export/payroll?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns payslips + payroll runs within the date range, joined with employee names.
 * Admin-only.
 */
export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: emp } = await supabase
    .from("employees")
    .select("role")
    .eq("profile_id", user.id)
    .single();
  if (!emp || !["admin", "finance", "payroll_admin"].includes(emp.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "from and to date params required (YYYY-MM-DD)" }, { status: 400 });
  }

  // Fetch payslips within the period range
  let { data: payslips, error: psErr } = await supabase
    .from("payslips")
    .select("*, employees!payslips_employee_id_fkey(name, email, department, job_title)")
    .gte("period_start", from)
    .lte("period_end", to)
    .order("period_start", { ascending: false });

  if (psErr) {
    // Fallback: try without join if FK name differs
    const res = await supabase
      .from("payslips")
      .select("*")
      .gte("period_start", from)
      .lte("period_end", to)
      .order("period_start", { ascending: false });
    payslips = res.data;
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  // Fetch payroll runs that overlap the period
  const { data: runs, error: runsErr } = await supabase
    .from("payroll_runs")
    .select("*")
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59`)
    .order("created_at", { ascending: false });

  if (runsErr) return NextResponse.json({ error: runsErr.message }, { status: 500 });

  // If join worked, flatten employee data
  const flatPayslips = (payslips || []).map((p: Record<string, unknown>) => {
    const empData = p.employees as Record<string, unknown> | null;
    return {
      ...p,
      employee_name: empData?.name ?? "",
      employee_email: empData?.email ?? "",
      employee_department: empData?.department ?? "",
      employee_job_title: empData?.job_title ?? "",
      employees: undefined, // remove nested object
    };
  });

  return NextResponse.json({
    payslips: flatPayslips,
    runs: runs || [],
    meta: { from, to, exportedAt: new Date().toISOString(), payslipCount: flatPayslips.length, runCount: runs?.length ?? 0 },
  });
}
