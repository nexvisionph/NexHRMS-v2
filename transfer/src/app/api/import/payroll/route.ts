import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/services/supabase-server";

type RowStatus = "valid" | "duplicate" | "error";
interface RowValidation {
  row: number;
  status: RowStatus;
  message: string;
  employee?: string;
  period?: string;
}

/**
 * POST /api/import/payroll
 * Body: { rows: Record[], dryRun?: boolean }
 *  - dryRun=true  → validate + duplicate-check only, returns per-row status
 *  - dryRun=false → actually inserts records
 * Detects duplicates by (employee_id + period_start + period_end).
 * Admin/finance/payroll_admin only.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: emp } = await supabase
    .from("employees")
    .select("id, role")
    .eq("profile_id", user.id)
    .single();
  if (!emp || !["admin", "finance", "payroll_admin"].includes(emp.role)) {
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

  // Build employee lookup by name/email
  const { data: employees } = await supabase.from("employees").select("id, name, email");
  const empByName = new Map<string, string>();
  const empByEmail = new Map<string, string>();
  const empNameById = new Map<string, string>();
  for (const e of employees || []) {
    empByName.set((e.name as string).toLowerCase(), e.id as string);
    empByEmail.set((e.email as string).toLowerCase(), e.id as string);
    empNameById.set(e.id as string, e.name as string);
  }

  // Fetch existing payslips for duplicate detection
  const { data: existingPayslips } = await supabase
    .from("payslips")
    .select("id, employee_id, period_start, period_end");

  const existingKeys = new Set(
    (existingPayslips || []).map(
      (p) => `${p.employee_id}|${p.period_start}|${p.period_end}`
    )
  );

  const rowValidations: RowValidation[] = [];
  const imported: string[] = [];
  const duplicates: string[] = [];
  const errors: string[] = [];

  const VALID_PAY_FREQUENCIES = ["monthly", "semi_monthly", "bi_weekly", "weekly"];
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Resolve employee
    const empName = String(row["Employee Name"] || "").trim();
    const empEmail = String(row["Email"] || "").trim();

    if (!empName && !empEmail) {
      const msg = `Row ${rowNum}: Missing Employee Name and Email`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: "Missing Employee Name and Email" });
      continue;
    }

    const employeeId =
      empByName.get(empName.toLowerCase()) ||
      empByEmail.get(empEmail.toLowerCase());

    if (!employeeId) {
      const msg = `Row ${rowNum}: Employee not found — "${empName}" / "${empEmail}"`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: `Employee not found: "${empName || empEmail}"`, employee: empName || empEmail });
      continue;
    }

    const periodStart = String(row["Period Start"] || "").trim();
    const periodEnd = String(row["Period End"] || "").trim();

    if (!periodStart || !periodEnd) {
      const msg = `Row ${rowNum}: Missing Period Start/End`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: "Missing Period Start or Period End", employee: empName });
      continue;
    }

    if (!DATE_RE.test(periodStart) || !DATE_RE.test(periodEnd)) {
      const msg = `Row ${rowNum}: Invalid date format (expected YYYY-MM-DD)`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: "Invalid date format (use YYYY-MM-DD)", employee: empName });
      continue;
    }

    if (periodStart > periodEnd) {
      const msg = `Row ${rowNum}: Period Start (${periodStart}) is after Period End (${periodEnd})`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: "Period Start is after Period End", employee: empName, period: `${periodStart} – ${periodEnd}` });
      continue;
    }

    const payFreq = String(row["Pay Frequency"] || "monthly").toLowerCase();
    if (!VALID_PAY_FREQUENCIES.includes(payFreq)) {
      const msg = `Row ${rowNum}: Invalid pay frequency "${payFreq}"`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: `Invalid pay frequency: "${payFreq}"`, employee: empName });
      continue;
    }

    const grossPay = Number(row["Gross Pay"]);
    const netPay = Number(row["Net Pay"]);
    if (isNaN(grossPay) || grossPay < 0) {
      const msg = `Row ${rowNum}: Invalid Gross Pay`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: "Gross Pay must be a non-negative number", employee: empName });
      continue;
    }
    if (isNaN(netPay) || netPay < 0) {
      const msg = `Row ${rowNum}: Invalid Net Pay`;
      errors.push(msg);
      rowValidations.push({ row: rowNum, status: "error", message: "Net Pay must be a non-negative number", employee: empName });
      continue;
    }

    // Duplicate check
    const key = `${employeeId}|${periodStart}|${periodEnd}`;
    if (existingKeys.has(key)) {
      const resolvedName = empNameById.get(employeeId) || empName;
      const msg = `Row ${rowNum}: ${resolvedName} (${periodStart} – ${periodEnd})`;
      duplicates.push(msg);
      rowValidations.push({ row: rowNum, status: "duplicate", message: `Already exists for ${resolvedName}`, employee: resolvedName, period: `${periodStart} – ${periodEnd}` });
      continue;
    }

    // Row is valid
    rowValidations.push({ row: rowNum, status: "valid", message: "Ready to import", employee: empNameById.get(employeeId) || empName, period: `${periodStart} – ${periodEnd}` });

    // If dry run, skip actual insert
    if (dryRun) continue;

    const payslipId = `PS-IMP-${Date.now()}-${i}`;
    const record = {
      id: payslipId,
      employee_id: employeeId,
      period_start: periodStart,
      period_end: periodEnd,
      pay_frequency: payFreq,
      gross_pay: grossPay,
      allowances: Number(row["Allowances"]) || 0,
      holiday_pay: Number(row["Holiday Pay"]) || 0,
      sss_deduction: Number(row["SSS"]) || 0,
      philhealth_deduction: Number(row["PhilHealth"]) || 0,
      pagibig_deduction: Number(row["Pag-IBIG"]) || 0,
      tax_deduction: Number(row["Tax"]) || 0,
      loan_deduction: Number(row["Loan Deduction"]) || 0,
      custom_deductions: Number(row["Custom Deductions"]) || 0,
      other_deductions: Number(row["Other Deductions"]) || 0,
      net_pay: netPay,
      status: "draft",
      payment_method: String(row["Payment Method"] || "bank_transfer"),
      bank_reference_id: String(row["Bank Reference"] || ""),
      notes: String(row["Notes"] || `Imported on ${new Date().toISOString().split("T")[0]}`),
      issued_at: new Date().toISOString(),
    };

    const { error: insertErr } = await supabase.from("payslips").insert(record);
    if (insertErr) {
      errors.push(`Row ${rowNum}: ${insertErr.message}`);
      // Update the last validation entry from "valid" to "error"
      rowValidations[rowValidations.length - 1] = { row: rowNum, status: "error", message: insertErr.message, employee: empName };
    } else {
      existingKeys.add(key);
      imported.push(payslipId);
    }
  }

  // Audit log (skip for dry run)
  if (!dryRun) {
    await supabase.from("audit_logs").insert({
      id: `AL-IMP-${Date.now()}`,
      entity_type: "payslips",
      entity_id: "bulk-import",
      action: "import",
      performed_by: emp.id,
      reason: `Imported ${imported.length} payslips, ${duplicates.length} duplicates skipped, ${errors.length} errors`,
    });
  }

  return NextResponse.json({
    dryRun,
    imported: dryRun ? 0 : imported.length,
    valid: rowValidations.filter((r) => r.status === "valid").length,
    duplicates: duplicates.length,
    errors: errors.length,
    rowValidations,
    duplicateDetails: duplicates,
    errorDetails: errors,
  });
}
