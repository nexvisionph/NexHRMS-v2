import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createServerSupabaseClient } from "@/services/supabase-server";

const TEMPLATE_HEADERS = [
  "Name",
  "Email",
  "Role",
  "Department",
  "Job Title",
  "Status",
  "Work Type",
  "Salary",
  "Pay Frequency",
  "Join Date",
  "Phone",
  "Address",
  "Emergency Contact",
  "Birthday",
  "Location",
];

const VALID_ROLES = [
  "admin", "hr", "manager", "supervisor", "employee",
  "finance", "payroll_admin", "accountant",
];
const VALID_STATUSES = ["active", "on_leave", "resigned", "terminated"];
const VALID_WORK_TYPES = ["full_time", "part_time", "contract", "intern"];
const VALID_PAY_FREQUENCIES = ["monthly", "semi_monthly", "bi_weekly", "weekly"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type RowStatus = "valid" | "duplicate" | "error";
interface RowValidation {
  row: number;
  status: RowStatus;
  message: string;
  name?: string;
  email?: string;
}

/**
 * GET /api/import/employees?template=true
 * Returns an XLSX template with the expected columns + one example row.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("template") !== "true") {
    return NextResponse.json({ error: "Use ?template=true to download template" }, { status: 400 });
  }

  // Auth
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: emp } = await supabase
    .from("employees").select("role").eq("profile_id", user.id).single();
  if (!emp || !["admin", "hr"].includes(emp.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const exampleRow: Record<string, string | number> = {
    "Name": "Juan Dela Cruz",
    "Email": "juan@example.com",
    "Role": "employee",
    "Department": "Engineering",
    "Job Title": "Software Engineer",
    "Status": "active",
    "Work Type": "full_time",
    "Salary": 30000,
    "Pay Frequency": "monthly",
    "Join Date": "2024-01-15",
    "Phone": "+63 917 123 4567",
    "Address": "Manila, PH",
    "Emergency Contact": "Maria Dela Cruz +63 918 999 0000",
    "Birthday": "1990-05-20",
    "Location": "Manila Office",
  };

  const ws = XLSX.utils.json_to_sheet([exampleRow], { header: TEMPLATE_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employees");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="employees-import-template.xlsx"',
    },
  });
}

/**
 * POST /api/import/employees
 * Body: { rows: Record<string, unknown>[], dryRun?: boolean }
 * Admin/HR only. Max 500 rows. Detects duplicates by email.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: emp } = await supabase
    .from("employees").select("id, role").eq("profile_id", user.id).single();
  if (!emp || !["admin", "hr"].includes(emp.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const rows: Record<string, unknown>[] = body.rows;
  const dryRun: boolean = body.dryRun === true;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: "Maximum 500 rows per import" }, { status: 400 });
  }

  // Existing email lookup for duplicate detection
  const { data: existing } = await supabase.from("employees").select("email");
  const existingEmails = new Set((existing || []).map((e) => (e.email as string).toLowerCase()));

  const rowValidations: RowValidation[] = [];
  const imported: string[] = [];
  const duplicates: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    const name = String(row["Name"] || "").trim();
    const email = String(row["Email"] || "").trim().toLowerCase();
    const role = String(row["Role"] || "employee").trim().toLowerCase();
    const department = String(row["Department"] || "").trim();
    const status = String(row["Status"] || "active").trim().toLowerCase();
    const workType = String(row["Work Type"] || "full_time").trim().toLowerCase();
    const salary = Number(row["Salary"]);
    const payFreq = String(row["Pay Frequency"] || "monthly").trim().toLowerCase();
    const joinDate = String(row["Join Date"] || "").trim();

    if (!name) {
      const msg = "Missing Name";
      errors.push(`Row ${rowNum}: ${msg}`);
      rowValidations.push({ row: rowNum, status: "error", message: msg });
      continue;
    }
    if (!email || !email.includes("@")) {
      const msg = "Missing or invalid Email";
      errors.push(`Row ${rowNum}: ${msg}`);
      rowValidations.push({ row: rowNum, status: "error", message: msg, name });
      continue;
    }
    if (!VALID_ROLES.includes(role)) {
      const msg = `Invalid Role "${role}"`;
      errors.push(`Row ${rowNum}: ${msg}`);
      rowValidations.push({ row: rowNum, status: "error", message: msg, name, email });
      continue;
    }
    if (!department) {
      const msg = "Missing Department";
      errors.push(`Row ${rowNum}: ${msg}`);
      rowValidations.push({ row: rowNum, status: "error", message: msg, name, email });
      continue;
    }
    if (!VALID_STATUSES.includes(status)) {
      const msg = `Invalid Status "${status}"`;
      errors.push(`Row ${rowNum}: ${msg}`);
      rowValidations.push({ row: rowNum, status: "error", message: msg, name, email });
      continue;
    }
    if (!VALID_WORK_TYPES.includes(workType)) {
      const msg = `Invalid Work Type "${workType}"`;
      errors.push(`Row ${rowNum}: ${msg}`);
      rowValidations.push({ row: rowNum, status: "error", message: msg, name, email });
      continue;
    }
    if (!VALID_PAY_FREQUENCIES.includes(payFreq)) {
      const msg = `Invalid Pay Frequency "${payFreq}"`;
      errors.push(`Row ${rowNum}: ${msg}`);
      rowValidations.push({ row: rowNum, status: "error", message: msg, name, email });
      continue;
    }
    if (isNaN(salary) || salary < 0) {
      const msg = "Invalid Salary";
      errors.push(`Row ${rowNum}: ${msg}`);
      rowValidations.push({ row: rowNum, status: "error", message: msg, name, email });
      continue;
    }
    if (!DATE_RE.test(joinDate)) {
      const msg = "Invalid Join Date (use YYYY-MM-DD)";
      errors.push(`Row ${rowNum}: ${msg}`);
      rowValidations.push({ row: rowNum, status: "error", message: msg, name, email });
      continue;
    }
    const birthday = String(row["Birthday"] || "").trim();
    if (birthday && !DATE_RE.test(birthday)) {
      const msg = "Invalid Birthday (use YYYY-MM-DD)";
      errors.push(`Row ${rowNum}: ${msg}`);
      rowValidations.push({ row: rowNum, status: "error", message: msg, name, email });
      continue;
    }

    if (existingEmails.has(email)) {
      const msg = `Email already exists: ${email}`;
      duplicates.push(`Row ${rowNum}: ${msg}`);
      rowValidations.push({ row: rowNum, status: "duplicate", message: msg, name, email });
      continue;
    }

    rowValidations.push({ row: rowNum, status: "valid", message: "Ready to import", name, email });
    if (dryRun) continue;

    const employeeId = `EMP-IMP-${Date.now()}-${i}`;
    const record = {
      id: employeeId,
      name,
      email,
      role,
      department,
      job_title: String(row["Job Title"] || "") || null,
      status,
      work_type: workType,
      salary,
      pay_frequency: payFreq,
      join_date: joinDate,
      phone: String(row["Phone"] || "") || null,
      address: String(row["Address"] || "") || null,
      emergency_contact: String(row["Emergency Contact"] || "") || null,
      birthday: birthday || null,
      location: String(row["Location"] || "") || null,
      productivity: 0,
      deduction_exempt: false,
      notification_preferences: {},
    };

    const { error: insertErr } = await supabase.from("employees").insert(record);
    if (insertErr) {
      errors.push(`Row ${rowNum}: ${insertErr.message}`);
      rowValidations[rowValidations.length - 1] = {
        row: rowNum, status: "error", message: insertErr.message, name, email,
      };
    } else {
      existingEmails.add(email);
      imported.push(employeeId);
    }
  }

  if (!dryRun) {
    await supabase.from("audit_logs").insert({
      id: `AL-EMP-IMP-${Date.now()}`,
      entity_type: "employees",
      entity_id: "bulk-import",
      action: "import",
      performed_by: emp.id,
      reason: `Imported ${imported.length} employees, ${duplicates.length} duplicates, ${errors.length} errors`,
    });
  }

  return NextResponse.json({
    dryRun,
    imported: dryRun ? 0 : imported.length,
    valid: rowValidations.filter((r) => r.status === "valid").length,
    duplicates: duplicates.length,
    errors: errors.length,
    rowValidations,
  });
}
