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
  function normaliseEmpName(n: string): string {
    return n.replace(/[.,\-_]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  }
  for (const e of employees || []) {
    empByName.set(normaliseEmpName(e.name as string), e.id as string);
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

  // Track imported payslips (with period) so we can group them into payroll runs (Part 2)
  const importedPayslips: Array<{ payslipId: string; periodStart: string; periodEnd: string }> = [];
  // Detect whether this is an imported-source batch (any row tagged) + capture filename
  const isImportedBatch = rows.some((r) => String(r["__source"] || "") === "imported");
  const importedFileName =
    (rows.find((r) => String(r["__importedFileName"] || ""))?.["__importedFileName"] as string | undefined) || null;

  const VALID_PAY_FREQUENCIES = ["monthly", "semi_monthly", "bi_weekly", "weekly"];
  // Normalise common variants before validation
  function normaliseFreq(raw: string): string {
    const s = raw.toLowerCase().replace(/[\s-]/g, "_");
    if (s === "semi_monthly" || s === "semimonthly") return "semi_monthly";
    if (s === "bi_weekly" || s === "biweekly") return "bi_weekly";
    return s;
  }
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
      empByName.get(normaliseEmpName(empName)) ||
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

    const payFreq = normaliseFreq(String(row["Pay Frequency"] || "monthly"));
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

    // ── Imported-payroll extras (Part 1) ─────────────────────────────────────
    // These are sent on the row under reserved "__"-prefixed keys by the import
    // dialog. They are display/receipt-only and never touch attendance_logs.
    const rowIsImported = String(row["__source"] || "") === "imported";
    const num = (v: unknown): number | null => {
      if (v === undefined || v === null || v === "") return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };
    const parseJsonField = (v: unknown): unknown => {
      if (!v) return null;
      if (typeof v === "object") return v;
      try { return JSON.parse(String(v)); } catch { return null; }
    };

    // Custom line items (unknown columns the user tagged as earning/deduction)
    const rawLineItems = (parseJsonField(row["__lineItemsJson"]) as
      | Array<{ id?: string; label: string; type: string; amount: number }>
      | null) || null;
    const lineItems = rawLineItems
      ? rawLineItems.map((li, idx) => ({
          id: li.id || `PLI-IMP-${Date.now()}-${i}-${idx}`,
          payslipId,
          label: li.label,
          type: li.type === "earning" ? "earning" : "deduction",
          amount: Number(li.amount) || 0,
        }))
      : null;

    const baseAllowances = Number(row["Allowances"]) || 0;
    const holidayPay = Number(row["Holiday Pay"]) || 0;
    const sssDeduction = Number(row["SSS"]) || 0;
    const philhealthDeduction = Number(row["PhilHealth"]) || 0;
    const pagibigDeduction = Number(row["Pag-IBIG"]) || 0;
    const taxDeduction = Number(row["Tax"]) || 0;
    const loanDeduction = Number(row["Loan Deduction"]) || 0;
    const customDeductions = Number(row["Custom Deductions"]) || 0;
    const otherDeductions = Number(row["Other Deductions"]) || 0;
    const importedNetPay = Number(row["Net Pay"]) || 0;

    const customEarnings = (lineItems || [])
      .filter((li) => li.type === "earning")
      .reduce((sum, li) => sum + (Number(li.amount) || 0), 0);
    const customLineItemDeductions = (lineItems || [])
      .filter((li) => li.type === "deduction")
      .reduce((sum, li) => sum + (Number(li.amount) || 0), 0);

    // For converted/imported payroll files, deductions should always affect the
    // stored net pay. We therefore recompute net from the imported line items.
    // For normal template imports, keep the explicit Net Pay value.
    const computedNetPay =
      grossPay +
      baseAllowances +
      holidayPay +
      customEarnings -
      (sssDeduction +
        philhealthDeduction +
        pagibigDeduction +
        taxDeduction +
        loanDeduction +
        customDeductions +
        otherDeductions +
        customLineItemDeductions);
    const netPayToStore = rowIsImported
      ? Math.max(0, Math.round(computedNetPay * 100) / 100)
      : importedNetPay;

    const record: Record<string, unknown> = {
      id: payslipId,
      employee_id: employeeId,
      period_start: periodStart,
      period_end: periodEnd,
      pay_frequency: payFreq,
      gross_pay: grossPay,
      allowances: baseAllowances,
      holiday_pay: holidayPay,
      sss_deduction: sssDeduction,
      philhealth_deduction: philhealthDeduction,
      pagibig_deduction: pagibigDeduction,
      tax_deduction: taxDeduction,
      loan_deduction: loanDeduction,
      custom_deductions: customDeductions,
      other_deductions: otherDeductions,
      net_pay: netPayToStore,
      status: "draft",
      payment_method: String(row["Payment Method"] || "bank_transfer"),
      bank_reference_id: String(row["Bank Reference"] || ""),
      notes: String(row["Notes"] || `Imported on ${new Date().toISOString().split("T")[0]}`),
      issued_at: new Date().toISOString(),
    };

    // Add rate/OT fields if provided by the PB converter
    const importedOT = num(row["__overtimePay"]);
    const importedDailyRate = num(row["__dailyRate"]);
    const importedHourlyRate = num(row["__hourlyRate"]);
    if (importedOT && importedOT > 0) record.overtime_pay = importedOT;
    if (importedDailyRate && importedDailyRate > 0) record.daily_rate = importedDailyRate;
    if (importedHourlyRate && importedHourlyRate > 0) record.hourly_rate = importedHourlyRate;

    // Imported-only fields live in a separate object. They depend on migration 063
    // columns; if those columns aren't present yet we retry the insert without them
    // so the import never hard-fails on an un-migrated database.
    const importedExtras: Record<string, unknown> = {};
    if (rowIsImported) {
      importedExtras.source = "imported";
      importedExtras.computed_externally = true;
      importedExtras.imported_file_name = importedFileName;
      importedExtras.imported_at = new Date().toISOString();
      importedExtras.dtr_days_present = num(row["__dtrDaysPresent"]);
      importedExtras.dtr_days_absent = num(row["__dtrDaysAbsent"]);
      importedExtras.dtr_late_minutes = num(row["__dtrLateMinutes"]);
      importedExtras.dtr_ot_hours = num(row["__dtrOtHours"]);
      importedExtras.dtr_tard_hours = num(row["__dtrTardHours"]);
      const perDay = parseJsonField(row["__dtrPerDayJson"]);
      if (perDay) importedExtras.dtr_per_day_json = perDay;
      if (lineItems && lineItems.length > 0) importedExtras.line_items_json = lineItems;
    }

    // Missing-column / schema-cache errors → retry without the imported extras.
    const isMissingColumnError = (msg?: string) =>
      !!msg && (msg.includes("column") || msg.includes("schema cache") || msg.includes("does not exist"));

    let insertErr: { message: string } | null = null;
    {
      const { error } = await supabase.from("payslips").insert({ ...record, ...importedExtras });
      insertErr = error;
      if (error && Object.keys(importedExtras).length > 0 && isMissingColumnError(error.message)) {
        // Retry with only the base columns — imported tagging columns not migrated yet.
        const retry = await supabase.from("payslips").insert(record);
        insertErr = retry.error;
      }
    }
    if (insertErr) {
      errors.push(`Row ${rowNum}: ${insertErr.message}`);
      // Update the last validation entry from "valid" to "error"
      rowValidations[rowValidations.length - 1] = { row: rowNum, status: "error", message: insertErr.message, employee: empName };
    } else {
      existingKeys.add(key);
      imported.push(payslipId);
      if (rowIsImported) {
        importedPayslips.push({ payslipId, periodStart, periodEnd });
      }
    }
  }

  // ─── Part 2: Create a LOCKED payroll run per imported period ────────────────
  // Imported figures are final, so the run skips draft→lock and starts locked.
  // Each distinct (periodStart|periodEnd) becomes one run. Payslips are linked
  // via payroll_batch_id + the payroll_run_payslips junction so the existing
  // publish/sign/pay guards work unchanged.
  const createdRuns: string[] = [];
  if (!dryRun && isImportedBatch && importedPayslips.length > 0) {
    const byPeriod = new Map<string, { periodStart: string; periodEnd: string; ids: string[] }>();
    for (const ps of importedPayslips) {
      const key = `${ps.periodStart}|${ps.periodEnd}`;
      const bucket = byPeriod.get(key);
      if (bucket) bucket.ids.push(ps.payslipId);
      else byPeriod.set(key, { periodStart: ps.periodStart, periodEnd: ps.periodEnd, ids: [ps.payslipId] });
    }

    for (const { periodStart, periodEnd, ids } of byPeriod.values()) {
      const runId = `RUN-IMP-${periodStart}_${periodEnd}-${Date.now()}`;
      const periodLabel = `${periodStart}/${periodEnd}`;
      const nowIso = new Date().toISOString();

      const baseRun: Record<string, unknown> = {
        id: runId,
        period_label: periodLabel,
        period_start: periodStart,
        period_end: periodEnd,
        status: "locked",
        locked: true,
        locked_at: nowIso,
        payslip_ids: ids,
        run_type: "regular",
        created_at: nowIso,
      };
      // Imported tagging columns depend on migration 063 — retry without them
      // if the DB hasn't been migrated yet.
      const runExtras = { source: "imported", imported_file_name: importedFileName };
      const isMissingColumnErr = (msg?: string) =>
        !!msg && (msg.includes("column") || msg.includes("schema cache") || msg.includes("does not exist"));

      let runErr: { message: string } | null = null;
      {
        const { error } = await supabase.from("payroll_runs").insert({ ...baseRun, ...runExtras });
        runErr = error;
        if (error && isMissingColumnErr(error.message)) {
          const retry = await supabase.from("payroll_runs").insert(baseRun);
          runErr = retry.error;
        }
      }

      if (runErr) {
        errors.push(`Run for ${periodLabel}: ${runErr.message}`);
        continue;
      }

      // Link payslips to the run (batch id column + junction table)
      await supabase.from("payslips").update({ payroll_batch_id: runId }).in("id", ids);
      const junctionRows = ids.map((pid) => ({ run_id: runId, payslip_id: pid }));
      const { error: junctionErr } = await supabase
        .from("payroll_run_payslips")
        .upsert(junctionRows, { onConflict: "run_id,payslip_id" });
      if (junctionErr) {
        // Non-fatal: legacy payslip_ids column still backs the run.
        console.warn("[import/payroll] junction insert:", junctionErr.message);
      }
      createdRuns.push(runId);
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
    createdRuns,
  });
}
