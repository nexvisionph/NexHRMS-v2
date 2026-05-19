import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createServerSupabaseClient } from "@/services/supabase-server";

const TEMPLATE_HEADERS = [
  "Name",
  "Email",
  "Phone",
  "Birthday",
  "Address",
];

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
    "Email": "juan@nexsdsi.com",
    "Phone": "+63 917 123 4567",
    "Birthday": "1990-05-20",
    "Address": "Manila, Philippines",
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
    const phone = String(row["Phone"] || "").trim() || null;
    const birthday = String(row["Birthday"] || "").trim() || null;
    const address = String(row["Address"] || "").trim() || null;

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
    if (!email.endsWith("@nexsdsi.com")) {
      const msg = "Only @nexsdsi.com email addresses are allowed";
      errors.push(`Row ${rowNum}: ${msg}`);
      rowValidations.push({ row: rowNum, status: "error", message: msg, name, email });
      continue;
    }
    if (birthday && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      const msg = "Birthday must be YYYY-MM-DD (e.g. 1990-05-20)";
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
    existingEmails.add(email); // track within-batch duplicates (even in dryRun)
    if (dryRun) continue;

    const today = new Date().toISOString().split("T")[0];
    const employeeId = `EMP-IMP-${Date.now()}-${i}`;
    const record = {
      id: employeeId,
      name,
      email,
      role: "employee",
      status: "active",
      work_type: "full_time",
      pay_frequency: "monthly",
      salary: 0,
      join_date: today,
      phone,
      birthday: birthday || null,
      address,
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
