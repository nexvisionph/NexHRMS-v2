import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createServerSupabaseClient } from "@/services/supabase-server";

/**
 * GET /api/export/employees
 *
 * Optional query params:
 *   - status=active|on_leave|resigned|terminated
 *   - department=Engineering
 *   - role=employee
 *   - workType=full_time
 *
 * Returns an XLSX file with the matching employees.
 * Admin/HR/Finance/Payroll-admin only.
 */
export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: emp } = await supabase
    .from("employees").select("role").eq("profile_id", user.id).single();
  if (!emp || !["admin", "hr", "finance", "payroll_admin"].includes(emp.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const filters = {
    status: url.searchParams.get("status"),
    department: url.searchParams.get("department"),
    role: url.searchParams.get("role"),
    workType: url.searchParams.get("workType"),
  };

  let query = supabase
    .from("employees")
    .select("*")
    .order("name", { ascending: true });

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.department) query = query.eq("department", filters.department);
  if (filters.role) query = query.eq("role", filters.role);
  if (filters.workType) query = query.eq("work_type", filters.workType);

  const { data: employees, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type EmpRow = {
    id: string; name: string; email: string; role: string; department: string;
    job_title: string | null; status: string; work_type: string; salary: number;
    pay_frequency: string | null; join_date: string;
    phone: string | null; address: string | null; emergency_contact: string | null;
    birthday: string | null; location: string | null; deduction_exempt: boolean;
    resigned_at: string | null;
  };

  const rows = ((employees as EmpRow[]) || []).map((e) => ({
    "Employee ID": e.id,
    "Name": e.name,
    "Email": e.email,
    "Role": e.role,
    "Department": e.department,
    "Job Title": e.job_title ?? "",
    "Status": e.status,
    "Work Type": e.work_type,
    "Salary": e.salary,
    "Pay Frequency": e.pay_frequency ?? "",
    "Join Date": e.join_date,
    "Phone": e.phone ?? "",
    "Address": e.address ?? "",
    "Emergency Contact": e.emergency_contact ?? "",
    "Birthday": e.birthday ?? "",
    "Location": e.location ?? "",
    "Deduction Exempt": e.deduction_exempt ? "Yes" : "No",
    "Resigned At": e.resigned_at ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employees");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const stamp = new Date().toISOString().split("T")[0];
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="employees-${stamp}.xlsx"`,
    },
  });
}
