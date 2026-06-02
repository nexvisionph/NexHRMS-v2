"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  downloadImportTemplate,
  parseImportFile,
  type ExportFormat,
  PAYROLL_TEMPLATE_HEADERS,
  ATTENDANCE_TEMPLATE_HEADERS,
  EMPLOYEES_TEMPLATE_HEADERS,
} from "@/lib/export-utils";
import { useEmployeesStore } from "@/store/employees.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useDepartmentsStore } from "@/store/departments.store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileUp,
  ShieldCheck,
  RotateCcw,
  Info,
  Trash2,
  ArrowRight,
  Pencil,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type ImportModule = "payroll" | "attendance" | "employees";
type RowStatus = "valid" | "duplicate" | "error";

const REQUIRED_COLS: Record<ImportModule, string[]> = {
  employees: ["Name", "Email"],
  payroll: ["Employee Name", "Email"],
  attendance: ["Employee Name", "Email", "Event Type", "Date"],
};

const MODULE_LABELS: Record<ImportModule, string> = {
  employees: "Employee",
  payroll: "Payroll",
  attendance: "Attendance",
};

interface RowValidation {
  row: number;
  status: RowStatus;
  message: string;
  employee?: string;
  period?: string;
  detail?: string;
  name?: string;
  email?: string;
}

interface ValidationResult {
  dryRun: boolean;
  valid: number;
  duplicates: number;
  errors: number;
  rowValidations: RowValidation[];
  duplicateDetails: string[];
  errorDetails: string[];
}

interface ImportResult {
  dryRun: boolean;
  imported: number;
  valid: number;
  duplicates: number;
  errors: number;
  rowValidations: RowValidation[];
  duplicateDetails: string[];
  errorDetails: string[];
}

interface ImportDataDialogProps {
  module: ImportModule;
  trigger?: React.ReactNode;
  onImportComplete?: () => void;
}

const STATUS_CONFIG = {
  valid: {
    icon: CheckCircle,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    label: "Ready",
  },
  duplicate: {
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    label: "Duplicate",
  },
  error: {
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    label: "Error",
  },
} as const;

// ─── Payroll template columns ─────────────────────────────────────────────────

const PAYROLL_TEMPLATE_COLS = [
  "Employee Name",
  "Email",
  "Department",
  "Job Title",
  "Period Start",
  "Period End",
  "Pay Frequency",
  "Gross Pay",
  "Allowances",
  "Holiday Pay",
  "SSS",
  "PhilHealth",
  "Pag-IBIG",
  "Tax",
  "Loan Deduction",
  "Custom Deductions",
  "Other Deductions",
  "Net Pay",
  "Payment Method",
  "Bank Reference",
  "Notes",
] as const;

type PayrollRow = Record<(typeof PAYROLL_TEMPLATE_COLS)[number] | string, string>;

// ─── Imported-payroll auto-field detection ────────────────────────────────────
// Reserved row keys (prefixed "__") carry imported-only metadata through the
// dialog as plain strings so the Record<string,string> contract is preserved.
// The /api/import/payroll route reads these keys to persist DTR + custom items.

const KNOWN_PAYROLL_HEADERS = new Set(
  [
    ...PAYROLL_TEMPLATE_COLS,
    "Employee No", "Employee ID", "Full Name", "Position",
    "Pay Period From", "Pay Period To", "Frequency", "Gross", "Monthly Salary",
    "Basic Pay", "SSS Contribution", "PhilHealth Contribution", "Pag-IBIG Contribution",
    "HDMF", "Withholding Tax", "BIR", "OT", "Overtime Pay", "Loan",
  ].map((h) => h.toLowerCase())
);

// Maps a DTR-style header (case-insensitive) to its reserved key. Receipt-only.
function dtrKeyForHeader(header: string): string | null {
  const h = header.trim().toLowerCase();
  if (h === "days present") return "__dtrDaysPresent";
  if (h === "days absent" || h === "absences") return "__dtrDaysAbsent";
  if (h === "late (min)" || h === "tardiness min" || h === "late min") return "__dtrLateMinutes";
  if (h === "ot hours") return "__dtrOtHours";
  if (h === "tard hr" || h === "tardiness hr") return "__dtrTardHours";
  return null;
}

const DTR_FIELD_LABELS: Record<string, string> = {
  __dtrDaysPresent: "Days Present",
  __dtrDaysAbsent: "Days Absent",
  __dtrLateMinutes: "Late (min)",
  __dtrOtHours: "OT Hours",
  __dtrTardHours: "Tard Hr",
};
const DTR_FIELD_KEYS = Object.keys(DTR_FIELD_LABELS);

/**
 * Scans every column of a raw parsed row. Known template/system columns are left
 * on the row as-is; DTR columns become __dtr* reserved keys; any remaining column
 * with a value becomes a custom field key "__custom__<Label>".
 * Returns a new row object (does not mutate input).
 */
function detectImportedFields(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...row };
  for (const [header, value] of Object.entries(row)) {
    if (header.startsWith("__")) continue;
    const v = (value ?? "").toString().trim();
    if (!v) continue;

    const dtrKey = dtrKeyForHeader(header);
    if (dtrKey) {
      out[dtrKey] = v;
      continue;
    }
    // Known system/template column → leave on the row untouched
    if (KNOWN_PAYROLL_HEADERS.has(header.trim().toLowerCase())) continue;
    // Unknown column with a value → custom field (default: deduction)
    out[`__custom__${header}`] = v;
  }
  return out;
}

/**
 * Builds the reserved "__"-prefixed payload the API route expects, from an
 * (already edited) payroll row. Tags it as an imported payslip.
 */
function buildImportedRowPayload(
  row: Record<string, string>,
  fileName: string
): Record<string, string> {
  const payload: Record<string, string> = { ...row, __source: "imported", __importedFileName: fileName };

  // Custom columns → line items (type stored under __customType__<Label>, default deduction)
  const lineItems: Array<{ label: string; type: string; amount: number }> = [];
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith("__custom__")) continue;
    const label = key.slice("__custom__".length);
    const amount = Number(String(value).replace(/[₱,\s]/g, ""));
    if (!label || isNaN(amount) || amount === 0) continue;
    const type = row[`__customType__${label}`] === "earning" ? "earning" : "deduction";
    lineItems.push({ label, type, amount });
  }
  if (lineItems.length > 0) payload.__lineItemsJson = JSON.stringify(lineItems);

  return payload;
}

// ─── PB File Converter ────────────────────────────────────────────────────────

/**
 * Detects whether an uploaded file's headers match the payroll template.
 * Returns true if it looks like a PB-format file that needs conversion.
 */
function isPBFormat(headers: string[]): boolean {
  const normalised = headers.map((h) => h.trim().toLowerCase());
  const templateKeys = PAYROLL_TEMPLATE_COLS.map((c) => c.toLowerCase());
  // If fewer than half the template columns are present, treat it as PB format
  const matchCount = templateKeys.filter((t) => normalised.includes(t)).length;
  return matchCount < PAYROLL_TEMPLATE_COLS.length / 2;
}

/**
 * Converts a raw row array parsed from a PB XLS file (no header row —
 * sheet_to_json called with header:1) into a PayrollRow matching the template.
 *
 * The REAL PB files from KEI have MULTIPLE SHEETS — one per employee.
 * Each sheet has two identical blocks side-by-side (left + right).
 * Both blocks have "NAME" as placeholder and fall back to row 0 col 18.
 *
 * Block layout (per sheet):
 *   Left  block → name col = 4, value col = 7, period-start col = 3
 *   Right block → name col = 12, value col = 15, period-start col = 11
 */
function convertPBRawToPayrollRows(
  rawRows: Record<string, unknown>[],
  allSheets?: Array<Record<string, unknown>[]>
): PayrollRow[] {
  // If allSheets provided, process each sheet; otherwise process single sheet
  const sheetsToProcess = allSheets && allSheets.length > 0 ? allSheets : [rawRows];

  function parseDateSerial(v: unknown): string {
    if (v === null || v === undefined || v === "") return "";
    // Excel serial number (e.g. 46112)
    if (typeof v === "number") {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    }
    const s = String(v).trim();
    // Already ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split("T")[0].split(" ")[0];
    // DD-Mon-YY or D-Mon-YY (e.g. "11-Apr-26", "26-Mar-26")
    const dmy = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
    if (dmy) {
      const months: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
      const mon = months[dmy[2].toLowerCase()];
      if (mon) {
        const yr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
        return `${yr}-${mon}-${dmy[1].padStart(2, "0")}`;
      }
    }
    // MM-DD-YYYY or M/D/YYYY fallback
    const mdy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
    return s.split(" ")[0];
  }

  function getCell(rows: Record<string, unknown>[], rowIdx: number, colIdx: number): unknown {
    const row = rows[rowIdx];
    if (!row) return null;
    const v = row[colIdx] ?? row[String(colIdx)];
    return v === undefined || v === null || v === "" ? null : v;
  }

  function numCell(rows: Record<string, unknown>[], rowIdx: number, colIdx: number): number {
    const v = getCell(rows, rowIdx, colIdx);
    if (v === null) return 0;
    if (typeof v === "number") return isNaN(v) ? 0 : v;
    // Strip commas, "- 0", currency symbols, spaces
    let s = String(v).replace(/,/g, "").replace(/[₱P\s]/g, "").trim();
    // Handle "- 0" pattern (common in PB files for zero values)
    if (s === "-0" || s === "-" || s === "- 0") return 0;
    if (s.startsWith("- ")) s = "-" + s.slice(2);
    const f = parseFloat(s);
    return isNaN(f) ? 0 : f;
  }

  function strCell(rows: Record<string, unknown>[], rowIdx: number, colIdx: number): string {
    const v = getCell(rows, rowIdx, colIdx);
    return v === null ? "" : String(v).trim();
  }

  const blocks: Array<{ nameCol: number; valCol: number; fromCol: number }> = [
    { nameCol: 4, valCol: 7, fromCol: 3 },
    { nameCol: 12, valCol: 15, fromCol: 11 },
  ];

  const employees: PayrollRow[] = [];

  for (const sheetRows of sheetsToProcess) {
    const raw = sheetRows.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v]))
    );

    // Skip sheets with too few rows (empty sheets)
    if (raw.length < 15) continue;

    for (const blk of blocks) {
      // Employee name: row 4 at nameCol; fallback to row 0 col 18-19
      let name = strCell(raw, 4, blk.nameCol);
      if (!name || name.toUpperCase() === "NAME") {
        // Fallback: row 0 col 18 or col 19 (name is typically one cell to the right of "NAME" label)
        name = strCell(raw, 0, 19) || strCell(raw, 0, 18);
      }
      if (!name || name.toUpperCase() === "NAME") continue;

      const periodFrom = parseDateSerial(getCell(raw, 2, blk.fromCol));
      const periodTo = parseDateSerial(getCell(raw, 2, blk.fromCol + 2));
      const position = strCell(raw, 5, blk.nameCol);
      const project = strCell(raw, 6, blk.nameCol);

      // ── Header fields (Monthly Salary, Rate/day) ──
      const monthlySalary = numCell(raw, 7, blk.valCol);
      const dailyRate = numCell(raw, 8, blk.valCol);
      // Hourly rate is at row 0 col 21 (right-side header) or derive from daily/8
      const hourlyRate = dailyRate > 0 ? Math.round((dailyRate / 8) * 100) / 100 : 0;

      // ── BASIC SALARY section ──
      const semiMonthly = numCell(raw, 11, blk.valCol);
      // Row 12: can be "Overtime Pay" or "Adjustment" depending on the employee
      const basicOTOrAdj = numCell(raw, 12, blk.valCol);
      const lwop = numCell(raw, 13, blk.valCol);
      const tardiness = numCell(raw, 14, blk.valCol);
      const totalBasic = numCell(raw, 15, blk.valCol);

      // ── OVERTIME & OTHER ALLOWANCES section ──
      const otAllowances = numCell(raw, 17, blk.valCol);
      const mealAllowance = numCell(raw, 18, blk.valCol);
      const projectAllow = numCell(raw, 19, blk.valCol);
      const taxiFare = numCell(raw, 20, blk.valCol);
      const othersAllow = numCell(raw, 21, blk.valCol);
      const totalAllowances = numCell(raw, 22, blk.valCol);

      // ── DEDUCTIONS section ──
      const withholdingTax = numCell(raw, 24, blk.valCol);
      const sss = numCell(raw, 25, blk.valCol);
      const sssLoan = numCell(raw, 26, blk.valCol);
      const philhealth = numCell(raw, 27, blk.valCol);
      const pagibig = numCell(raw, 28, blk.valCol);
      const pagibigLoan = numCell(raw, 29, blk.valCol);
      const taxDef = numCell(raw, 30, blk.valCol);
      const healthcard = numCell(raw, 31, blk.valCol);
      const netPay = numCell(raw, 33, blk.valCol);

      // Determine if row 12 is OT or adjustment:
      // If totalBasic = semiMonthly + row12 - lwop - tardiness, then row12 is OT added to basic
      // If row12 is positive and contributes to totalBasic, it's OT in the basic salary section
      const basicOvertimePay = basicOTOrAdj > 0 ? basicOTOrAdj : 0;
      const adjustment = basicOTOrAdj < 0 ? basicOTOrAdj : 0;

      // Total overtime = OT in basic salary section + OT in allowances section
      const totalOvertimePay = basicOvertimePay + otAllowances;

      // Gross Pay = Total Basic Salary (which already includes semi-monthly + OT - deductions)
      const grossPay = totalBasic;
      const loanDeduction = sssLoan + pagibigLoan;
      const customDeductions = taxDef + healthcard;
      const otherDeductions = lwop + tardiness + (adjustment < 0 ? Math.abs(adjustment) : 0);

      // Skip blocks where everything is zero (empty / no real data)
      if (totalBasic === 0 && netPay === 0 && grossPay === 0) continue;

      // Build custom line items for allowances that have values
      const lineItems: Array<{ label: string; type: string; amount: number }> = [];
      if (mealAllowance > 0) lineItems.push({ label: "Meal Allowance", type: "earning", amount: mealAllowance });
      if (projectAllow > 0) lineItems.push({ label: "Project Allowance", type: "earning", amount: projectAllow });
      if (taxiFare > 0) lineItems.push({ label: "Taxi Fare", type: "earning", amount: taxiFare });
      if (othersAllow > 0) lineItems.push({ label: "Others", type: "earning", amount: othersAllow });
      // Individual deductions as line items
      if (healthcard > 0) lineItems.push({ label: "Healthcard", type: "deduction", amount: healthcard });
      if (taxDef > 0) lineItems.push({ label: "Tax Refund/Deficit", type: "deduction", amount: taxDef });

      const noteParts: string[] = [];
      if (project) noteParts.push(`Project: ${project}`);
      if (monthlySalary > 0) noteParts.push(`Monthly: ${monthlySalary.toLocaleString()}`);

      const row: PayrollRow = {
        "Employee Name": name,
        Email: "",
        Department: project || "",
        "Job Title": position,
        "Period Start": String(periodFrom),
        "Period End": String(periodTo),
        "Pay Frequency": "Semi-monthly",
        "Gross Pay": grossPay.toFixed(2),
        Allowances: totalAllowances.toFixed(2),
        "Holiday Pay": "0.00",
        SSS: sss.toFixed(2),
        PhilHealth: philhealth.toFixed(2),
        "Pag-IBIG": pagibig.toFixed(2),
        Tax: withholdingTax.toFixed(2),
        "Loan Deduction": loanDeduction.toFixed(2),
        "Custom Deductions": "0.00",
        "Other Deductions": otherDeductions.toFixed(2),
        "Net Pay": netPay.toFixed(2),
        "Payment Method": "",
        "Bank Reference": "",
        Notes: noteParts.join(" | "),
      };

      // Pass through imported metadata via reserved keys
      row["__source"] = "imported";
      row["__monthlySalary"] = monthlySalary.toFixed(2);
      row["__dailyRate"] = dailyRate.toFixed(2);
      row["__hourlyRate"] = hourlyRate.toFixed(2);
      row["__semiMonthly"] = semiMonthly.toFixed(2);
      if (totalOvertimePay > 0) row["__overtimePay"] = totalOvertimePay.toFixed(2);
      if (lwop > 0) row["__leaveWithoutPay"] = lwop.toFixed(2);
      if (tardiness > 0) row["__tardiness"] = tardiness.toFixed(2);
      if (lineItems.length > 0) row["__lineItemsJson"] = JSON.stringify(lineItems);

      // ── Extract per-day DTR from the right-side grid ──
      // Actual column layout (from XLSX parse, 0-indexed):
      //   17: Day label (SAT/SUN/HOL/DEC HD) — only for special days
      //   18: Date number (26, 27, etc.)
      //   19: IN hour
      //   20: IN minute
      //   21: Scheduled hours (8.00) — skip
      //   22: OUT hour (single digit, unreliable)
      //   23: OUT minute
      //   24: OUT time as decimal from midnight (e.g., 16.87 = 4:52 PM)
      //   25: Working hours (total hours worked, lunch already deducted by PB)
      //   26: OT/UT decimal (positive = OT, negative = undertime)
      const dtrPerDay: Array<{ date: string; day?: string; timeIn?: string; timeOut?: string; totalHrs?: number; otHrs?: number }> = [];
      const dtrStartRow = 15;
      const maxDtrRows = 20;
      const resolveDateInPeriod = (dayNum: number): string => {
        if (!periodFrom || !periodTo || dayNum <= 0) return "";
        const from = new Date(periodFrom);
        const to = new Date(periodTo);
        if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return "";
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
          if (d.getDate() === dayNum) return d.toISOString().split("T")[0];
        }
        return "";
      };

      for (let ri = dtrStartRow; ri < dtrStartRow + maxDtrRows && ri < raw.length; ri++) {
        const col17 = strCell(raw, ri, 17);
        const col18 = numCell(raw, ri, 18);
        const col19 = numCell(raw, ri, 19);
        const col20 = numCell(raw, ri, 20);
        const col24 = numCell(raw, ri, 24); // OUT as decimal from midnight
        const col25 = numCell(raw, ri, 25); // Working hours
        const col26 = numCell(raw, ri, 26); // OT/UT

        // Date number is always at col 18
        const dayNum = (col18 > 0 && col18 <= 31) ? Math.round(col18) : 0;
        if (dayNum === 0) continue;

        // Day label from col 17
        let dayLabel = "";
        if (col17 && /^(SAT|SUN|HOL|DEC|WFH|wfh)/i.test(col17)) {
          dayLabel = col17.trim();
        }

        // IN time from col 19 (hour) and col 20 (minute)
        let timeIn = "";
        const inH = Math.floor(col19);
        const inM = Math.round(col20);
        if (inH > 0 || inM > 0) {
          timeIn = `${String(inH).padStart(2, "0")}:${String(inM).padStart(2, "0")}`;
        }

        // OUT time from col 24 (decimal hours from midnight, e.g., 16.87 = 16:52)
        let timeOut = "";
        if (col24 > 0) {
          const outH = Math.floor(col24);
          const outM = Math.round((col24 - outH) * 60);
          timeOut = `${String(outH).padStart(2, "0")}:${String(outM).padStart(2, "0")}`;
        }

        // Working hours (col 25) and OT (col 26)
        const workingHrs = col25;
        const otUt = col26;

        const resolvedDate = resolveDateInPeriod(dayNum);
        if (!resolvedDate) continue; // skip rows outside the imported payroll period

        dtrPerDay.push({
          date: resolvedDate,
          day: dayLabel || undefined,
          timeIn: timeIn || undefined,
          timeOut: timeOut || undefined,
          totalHrs: workingHrs > 0 ? Math.round(workingHrs * 100) / 100 : undefined,
          otHrs: otUt !== 0 ? Math.round(otUt * 100) / 100 : undefined,
        });
      }

      if (dtrPerDay.length > 0) {
        row["__dtrPerDayJson"] = JSON.stringify(dtrPerDay);
      }

      employees.push(row);
    }
  }

  return employees;
}

// ─── NexHRIS Export Format Converter ──────────────────────────────────────────

/**
 * Detects whether an uploaded file is in the new NexHRIS dynamic export format.
 * Checks for "NexHRIS" company name and "ALLOWANCES"/"DEDUCTIONS" section headers.
 */
function isNexHRISFormat(rawRows: Record<string, unknown>[]): boolean {
  if (rawRows.length < 10) return false;
  // Check if cell A1 or B1 contains "NexHRIS"
  const firstRowValues = Object.values(rawRows[0] || {}).map(v => String(v || "").trim());
  const hasNexHRIS = firstRowValues.some(v => v === "NexHRIS");
  if (!hasNexHRIS) return false;
  // Check for ALLOWANCES or DEDUCTIONS section header in column B
  const hasSectionHeaders = rawRows.some(row => {
    const vals = Object.values(row).map(v => String(v || "").trim());
    return vals.includes("ALLOWANCES") || vals.includes("DEDUCTIONS");
  });
  return hasSectionHeaders;
}

/**
 * Converts NexHRIS format sheets (one per employee) into PayrollRows.
 * Reads dynamic ALLOWANCES and DEDUCTIONS sections.
 */
function convertNexHRISToPayrollRows(
  allSheets: Array<Record<string, unknown>[]>
): PayrollRow[] {
  const employees: PayrollRow[] = [];

  for (const sheetRows of allSheets) {
    if (sheetRows.length < 10) continue;

    const raw = sheetRows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v])));

    // Helper to get cell value by column index
    const getCell = (rowIdx: number, colIdx: number): string => {
      const row = raw[rowIdx];
      if (!row) return "";
      const v = row[colIdx] ?? row[String(colIdx)];
      return v === undefined || v === null ? "" : String(v).trim();
    };
    const numVal = (rowIdx: number, colIdx: number): number => {
      const s = getCell(rowIdx, colIdx).replace(/[₱,\s]/g, "");
      const f = parseFloat(s);
      return isNaN(f) ? 0 : f;
    };

    // Find employee name — R8 col 4 in the NexHRIS sheet layout
    // (grid[8][4] = emp.name, grid[7][4] = emp.id)
    const name = getCell(8, 4);
    if (!name) continue;

    // Employee ID — R7 col 4
    const empId = getCell(7, 4);

    // Period (R3, col 4) — format: "MMM dd, yyyy – MMM dd, yyyy" (em dash)
    const periodStr = getCell(3, 4);
    let periodStart = "";
    let periodEnd = "";
    if (periodStr) {
      // Split on em dash (–) or regular dash surrounded by spaces
      const parts = periodStr.split(/\s*[–\-]\s*/);
      if (parts.length >= 2) {
        try {
          const fromDate = new Date(parts[0].trim());
          const toDate = new Date(parts[parts.length - 1].trim());
          if (!isNaN(fromDate.getTime())) periodStart = fromDate.toISOString().split("T")[0];
          if (!isNaN(toDate.getTime())) periodEnd = toDate.toISOString().split("T")[0];
        } catch { /* use raw strings */ }
      }
    }

    // Monthly salary, daily rate from R7-R10
    const monthlySalary = numVal(7, 7);
    const position = getCell(9, 4);
    const department = getCell(10, 4);

    // Find ALLOWANCES and DEDUCTIONS sections
    let allowancesHeaderRow = -1;
    let deductionsHeaderRow = -1;
    let totalAllowancesRow = -1;
    let totalDeductionsRow = -1;
    let netPayRow = -1;

    for (let i = 0; i < raw.length; i++) {
      const cellB = getCell(i, 1);
      if (cellB === "ALLOWANCES") allowancesHeaderRow = i;
      else if (cellB === "TOTAL ALLOWANCES") totalAllowancesRow = i;
      else if (cellB === "DEDUCTIONS") deductionsHeaderRow = i;
      else if (cellB === "TOTAL DEDUCTIONS") totalDeductionsRow = i;
      else if (cellB === "NET PAY") netPayRow = i;
    }

    // Parse allowance rows
    let totalAllowances = 0;
    const allowanceNotes: string[] = [];
    if (allowancesHeaderRow >= 0 && totalAllowancesRow > allowancesHeaderRow) {
      for (let i = allowancesHeaderRow + 1; i < totalAllowancesRow; i++) {
        const label = getCell(i, 1);
        const amount = numVal(i, 7);
        if (label && amount > 0) {
          totalAllowances += amount;
          allowanceNotes.push(`${label}: ${amount.toFixed(2)}`);
        }
      }
    }

    // Parse deduction rows
    let sss = 0, philhealth = 0, pagibig = 0, tax = 0, loanDeduction = 0, customDeductions = 0;
    if (deductionsHeaderRow >= 0 && totalDeductionsRow > deductionsHeaderRow) {
      for (let i = deductionsHeaderRow + 1; i < totalDeductionsRow; i++) {
        const label = getCell(i, 1).toLowerCase();
        const amount = numVal(i, 7);
        if (!label || amount === 0) continue;

        if (label.includes("sss") && label.includes("loan")) loanDeduction += amount;
        else if (label.includes("sss")) sss += amount;
        else if (label.includes("philhealth")) philhealth += amount;
        else if (label.includes("pag-ibig") || label.includes("pagibig") || label.includes("hdmf")) {
          if (label.includes("loan")) loanDeduction += amount;
          else pagibig += amount;
        }
        else if (label.includes("withholding") || label.includes("tax") || label.includes("bir")) tax += amount;
        else customDeductions += amount;
      }
    }

    const totalDeductions = numVal(totalDeductionsRow, 7) || (sss + philhealth + pagibig + tax + loanDeduction + customDeductions);
    const netPay = numVal(netPayRow, 7);
    const grossPay = monthlySalary > 0 ? monthlySalary / 2 : (netPay + totalDeductions - totalAllowances);

    if (netPay === 0 && grossPay === 0) continue;

    // Embed the employee ID (from R7 col 4) in Notes for reliable re-import matching
    const noteStr = [
      empId ? `ID:${empId}` : "",
      allowanceNotes.length > 0 ? `Allowances: ${allowanceNotes.join(", ")}` : "",
    ].filter(Boolean).join(" | ");

    employees.push({
      "Employee Name": name,
      Email: "",
      Department: department,
      "Job Title": position,
      "Period Start": periodStart,
      "Period End": periodEnd,
      "Pay Frequency": "Semi-monthly",
      "Gross Pay": grossPay.toFixed(2),
      Allowances: totalAllowances.toFixed(2),
      "Holiday Pay": "0.00",
      SSS: sss.toFixed(2),
      PhilHealth: philhealth.toFixed(2),
      "Pag-IBIG": pagibig.toFixed(2),
      Tax: tax.toFixed(2),
      "Loan Deduction": loanDeduction.toFixed(2),
      "Custom Deductions": customDeductions.toFixed(2),
      "Other Deductions": "0.00",
      "Net Pay": netPay.toFixed(2),
      "Payment Method": "",
      "Bank Reference": "",
      Notes: noteStr,
    });
  }

  return employees;
}

// ─── Field layout helpers (matching the interfaces-field pattern) ─────────────

/**
 * Renders the imported-only field groups for one row:
 *  - Custom fields (unknown columns) — editable label/type/amount, type defaults to deduction
 *  - Attendance (DTR) — read-only-style numeric inputs, receipt only
 * Only renders when the row actually has such fields.
 */
function ImportedExtrasFields({
  row,
  rowIdx,
  updateCell,
}: {
  row: Record<string, string>;
  rowIdx: number;
  updateCell: (rowIdx: number, col: string, value: string) => void;
}) {
  const customKeys = Object.keys(row).filter((k) => k.startsWith("__custom__"));
  const hasDtr = DTR_FIELD_KEYS.some((k) => row[k]?.toString().trim());

  if (customKeys.length === 0 && !hasDtr) return null;

  return (
    <>
      {customKeys.length > 0 && (
        <div>
          <Separator className="mb-4" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
            Custom Fields <span className="text-muted-foreground/60 normal-case">(detected from file)</span>
          </p>
          <div className="space-y-2.5">
            {customKeys.map((key) => {
              const label = key.slice("__custom__".length);
              const typeKey = `__customType__${label}`;
              const type = row[typeKey] === "earning" ? "earning" : "deduction";
              return (
                <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-muted-foreground leading-none">Label</label>
                    <Input
                      value={label}
                      onChange={(e) => {
                        const newLabel = e.target.value;
                        // Re-key the custom column when the label changes
                        updateCell(rowIdx, `__custom__${newLabel}`, row[key] ?? "");
                        updateCell(rowIdx, `__customType__${newLabel}`, type);
                        updateCell(rowIdx, key, ""); // clear old key (empty = dropped)
                        if (typeKey !== `__customType__${newLabel}`) updateCell(rowIdx, typeKey, "");
                      }}
                      className="h-7 text-xs px-2 border-border/50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-muted-foreground leading-none">Section</label>
                    <Select value={type} onValueChange={(v) => updateCell(rowIdx, typeKey, v)}>
                      <SelectTrigger className="!h-7 min-h-0 w-full px-2 text-xs border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deduction">Deduction</SelectItem>
                        <SelectItem value="earning">Earning</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-muted-foreground leading-none">Amount</label>
                    <Input
                      value={row[key] ?? ""}
                      onChange={(e) => updateCell(rowIdx, key, e.target.value)}
                      className="h-7 text-xs px-2 border-border/50"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasDtr && (
        <div>
          <Separator className="mb-4" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Attendance (DTR)
          </p>
          <p className="text-[9px] text-muted-foreground mb-2.5">
            Attendance data — will appear on receipt only, not saved to attendance_logs
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {DTR_FIELD_KEYS.map((key) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-muted-foreground leading-none">
                  {DTR_FIELD_LABELS[key]}
                </label>
                <Input
                  type="number"
                  value={row[key] ?? ""}
                  placeholder="—"
                  onChange={(e) => updateCell(rowIdx, key, e.target.value)}
                  className="h-7 text-xs px-2 border-border/50"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SectionLegend({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      {children}
    </p>
  );
}

interface LabeledFieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  description?: string;
}

function LabeledField({ label, required, children, description }: LabeledFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium leading-none text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {description && (
        <p className="text-[10px] text-muted-foreground leading-normal">{description}</p>
      )}
    </div>
  );
}

// ─── PB Preview Dialog ────────────────────────────────────────────────────────

interface PBPreviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: PayrollRow[];
  onRowsChange: (rows: PayrollRow[]) => void;
  onConfirm: () => void;
  confirming: boolean;
  fileName: string;
}

/** Normalise name for fuzzy comparison */
function normaliseForMatch(raw: string): string {
  return raw.replace(/[.,\-_]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

type PBRowStatus = "matched" | "warning" | "unmatched";

function PBPreviewDialog({
  open,
  onOpenChange,
  rows,
  onRowsChange,
  onConfirm,
  confirming,
  fileName,
}: PBPreviewDialogProps) {
  const employees = useEmployeesStore((s) => s.employees);
  const existingPayslips = usePayrollStore((s) => s.payslips);
  const departments = useDepartmentsStore((s) => s.departments);

  const updateCell = useCallback(
    (rowIdx: number, col: string, value: string) => {
      onRowsChange(
        rows.map((r, i) => (i === rowIdx ? { ...r, [col]: value } : r))
      );
    },
    [rows, onRowsChange]
  );

  // ── Employee matching & status computation ─────────────────────────────────
  const rowStatuses = useMemo(() => {
    // Build a set of existing (employeeId|periodStart|periodEnd) keys for O(1) lookup
    const existingKeys = new Set(
      existingPayslips.map((p) => `${p.employeeId}|${p.periodStart}|${p.periodEnd}`)
    );

    return rows.map((row, rowIdx) => {
      const name = (row["Employee Name"] || "").trim();
      const email = (row["Email"] || "").trim();
      const netPay = parseFloat(row["Net Pay"] || "0");
      const periodStart = (row["Period Start"] || "").trim();
      const periodEnd = (row["Period End"] || "").trim();

      // Try to match employee by name
      const normName = normaliseForMatch(name);
      const matchedEmployee = employees.find(
        (e) => normaliseForMatch(e.name) === normName
      );

      const hints: string[] = [];
      let status: PBRowStatus = "matched";

      if (!matchedEmployee) {
        status = "unmatched";
        hints.push(`No employee matched for "${name}"`);
      } else {
        if (!email && matchedEmployee.email) {
          hints.push("Email auto-filled from employee record");
        }
        // ── Duplicate check against existing payslips ──────────────────
        if (periodStart && periodEnd) {
          const dupKey = `${matchedEmployee.id}|${periodStart}|${periodEnd}`;
          if (existingKeys.has(dupKey)) {
            status = "warning";
            hints.push(`Duplicate — payslip already exists for ${periodStart} – ${periodEnd}`);
          }
        }
        // ── Duplicate within this import batch (same name + period) ────
        const batchDup = rows.slice(0, rowIdx).some((prev) => {
          const prevNorm = normaliseForMatch((prev["Employee Name"] || "").trim());
          return (
            prevNorm === normName &&
            (prev["Period Start"] || "") === periodStart &&
            (prev["Period End"] || "") === periodEnd
          );
        });
        if (batchDup) {
          if (status = "unmatched") status = "warning";
          hints.push("Duplicate within this import — same employee and period appears above");
        }
      }

      if (!periodStart || !periodEnd) {
        if (status !== "unmatched") status = "warning";
        hints.push("Pay period missing — check PB file");
      }
      if (isNaN(netPay) || netPay === 0) {
        if (status !== "unmatched") status = "warning";
        hints.push("Net pay is zero — verify before importing");
      }
      // Net-pay reconciliation: computed (gross + allowances + custom earnings
      // − deductions) vs the imported net. Imported figure always wins.
      const grossVal = parseFloat(row["Gross Pay"] || "0") || 0;
      const allowVal = parseFloat(row["Allowances"] || "0") || 0;
      const dedVal =
        (parseFloat(row["SSS"] || "0") || 0) +
        (parseFloat(row["PhilHealth"] || "0") || 0) +
        (parseFloat(row["Pag-IBIG"] || "0") || 0) +
        (parseFloat(row["Tax"] || "0") || 0) +
        (parseFloat(row["Loan Deduction"] || "0") || 0) +
        (parseFloat(row["Custom Deductions"] || "0") || 0) +
        (parseFloat(row["Other Deductions"] || "0") || 0);
      let customEarn = 0;
      let customDed = 0;
      for (const [k, v] of Object.entries(row)) {
        if (!k.startsWith("__custom__")) continue;
        const label = k.slice("__custom__".length);
        const amt = parseFloat(String(v).replace(/[₱,\s]/g, "")) || 0;
        if (row[`__customType__${label}`] === "earning") customEarn += amt;
        else customDed += amt;
      }
      const computedNet = grossVal + allowVal + customEarn - dedVal - customDed;
      if (!isNaN(netPay) && netPay !== 0 && Math.abs(computedNet - netPay) > 0.01) {
        if (status === "matched") status = "warning";
        hints.push("Imported net pay differs from computed. Deductions-based computed net will be used on import.");
      }

      return { status, hints, matchedEmployee };
    });
  }, [rows, employees, existingPayslips]);

  // Counts
  const counts = useMemo(() => {
    let matched = 0;
    let warning = 0;
    let unmatched = 0;
    for (const rs of rowStatuses) {
      if (rs.status === "matched") matched++;
      else if (rs.status === "warning") warning++;
      else unmatched++;
    }
    return { matched, warning, unmatched };
  }, [rowStatuses]);

  const deleteRow = useCallback(
    (rowIdx: number) => {
      onRowsChange(rows.filter((_, i) => i !== rowIdx));
    },
    [rows, onRowsChange]
  );

  const missingEmailCount = rows.filter((r) => !r["Email"]?.trim()).length;

  // Group template columns into logical sections for the FieldSet layout
  const sections: Array<{
    legend: string;
    fields: Array<(typeof PAYROLL_TEMPLATE_COLS)[number]>;
  }> = [
    {
      legend: "Employee",
      fields: ["Employee Name", "Email", "Department", "Job Title"],
    },
    {
      legend: "Pay Period",
      fields: ["Period Start", "Period End", "Pay Frequency"],
    },
    {
      legend: "Earnings",
      fields: ["Gross Pay", "Allowances", "Holiday Pay"],
    },
    {
      legend: "Deductions",
      fields: [
        "SSS",
        "PhilHealth",
        "Pag-IBIG",
        "Tax",
        "Loan Deduction",
        "Custom Deductions",
        "Other Deductions",
      ],
    },
    {
      legend: "Payment",
      fields: ["Net Pay", "Payment Method", "Bank Reference", "Notes"],
    },
  ];

  const requiredFields = new Set(["Employee Name", "Email", "Period Start", "Period End", "Gross Pay"]);

  // Count rows still missing any required field (used to gate the confirm button)
  const missingRequiredCount = rows.filter((r) =>
    ["Employee Name", "Period Start", "Period End", "Gross Pay"].some((c) => !r[c]?.toString().trim())
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <DialogHeader className="shrink-0 px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold leading-none">
                  Review Converted Payroll Data
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground mt-1 truncate">
                  {fileName} · PB format · {rows.length} record{rows.length !== 1 ? "s" : ""}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle className="h-3 w-3" />{counts.matched}
              </span>
              {counts.warning > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="h-3 w-3" />{counts.warning}
                </span>
              )}
              {counts.unmatched > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
                  <XCircle className="h-3 w-3" />{counts.unmatched}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* ── Summary tiles ──────────────────────────────────────────── */}
        <div className="shrink-0 px-6 pt-4 grid grid-cols-3 gap-3">
          {([
            { label: "Matched",   count: counts.matched,   Icon: UserCheck,     color: "emerald" },
            { label: "Warnings",  count: counts.warning,   Icon: AlertTriangle, color: "amber"   },
            { label: "Unmatched", count: counts.unmatched, Icon: UserX,         color: "red"     },
          ] as const).map(({ label, count, Icon, color }) => (
            <div key={label} className={`flex items-center gap-3 rounded-lg border p-3
              ${color === "emerald" ? "border-emerald-500/20 bg-emerald-500/5" : ""}
              ${color === "amber"   ? "border-amber-500/20  bg-amber-500/5"   : ""}
              ${color === "red"     ? "border-red-500/20    bg-red-500/5"     : ""}
            `}>
              <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0
                ${color === "emerald" ? "bg-emerald-500/15" : ""}
                ${color === "amber"   ? "bg-amber-500/15"   : ""}
                ${color === "red"     ? "bg-red-500/15"     : ""}
              `}>
                <Icon className={`h-4 w-4
                  ${color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : ""}
                  ${color === "amber"   ? "text-amber-600   dark:text-amber-400"   : ""}
                  ${color === "red"     ? "text-red-600     dark:text-red-400"     : ""}
                `} />
              </div>
              <div>
                <p className={`text-xl font-bold leading-none
                  ${color === "emerald" ? "text-emerald-700 dark:text-emerald-400" : ""}
                  ${color === "amber"   ? "text-amber-700   dark:text-amber-400"   : ""}
                  ${color === "red"     ? "text-red-700     dark:text-red-400"     : ""}
                `}>{count}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Alert banners ───────────────────────────────────────────── */}
        <div className="shrink-0 px-6 pt-3 space-y-2">
          {counts.unmatched > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
              <UserX className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                <strong>{counts.unmatched} record{counts.unmatched !== 1 ? "s" : ""} unmatched</strong> — no employee found in the system.
                Fill in the Email manually or remove these records before importing.
              </p>
            </div>
          )}
          {missingEmailCount > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                <strong>{missingEmailCount} email{missingEmailCount !== 1 ? "s" : ""} missing</strong> — Email is required for every record before importing.
              </p>
            </div>
          )}
        </div>

        {/* ── Scrollable records ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {rows.map((row, rowIdx) => {
            const rs = rowStatuses[rowIdx];
            const isUnmatched = rs?.status === "unmatched";
            const isWarning   = rs?.status === "warning";

            const cardBorder = isUnmatched ? "border-red-500/30"   : isWarning ? "border-amber-500/30"  : "border-border/60";
            const headerBg   = isUnmatched ? "bg-red-500/5"        : isWarning ? "bg-amber-500/5"       : "bg-muted/30";
            const iconBg     = isUnmatched ? "bg-red-500/10"       : isWarning ? "bg-amber-500/10"      : "bg-emerald-500/10";
            const iconColor  = isUnmatched ? "text-red-600 dark:text-red-400" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
            const StatusIcon = isUnmatched ? UserX : isWarning ? AlertTriangle : UserCheck;
            const statusPill = isUnmatched
              ? <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">Unmatched</span>
              : isWarning
              ? <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">Warning</span>
              : <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">Matched</span>;

            return (
              <div key={rowIdx} className={`rounded-xl border ${cardBorder} bg-card overflow-hidden`}>
                {/* Card header */}
                <div className={`flex items-center justify-between px-4 py-2.5 ${headerBg} border-b border-border/30`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`h-6 w-6 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
                      <StatusIcon className={`h-3.5 w-3.5 ${iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium leading-none">
                          {row["Employee Name"] || <span className="text-muted-foreground italic">Unnamed</span>}
                        </span>
                        {statusPill}
                      </div>
                      {(row["Job Title"] || row["Department"]) && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {[row["Job Title"], row["Department"]].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <button type="button" title="Remove record" onClick={() => deleteRow(rowIdx)}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 ml-2">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Inline hints */}
                {rs && rs.hints.length > 0 && (
                  <div className={`px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 border-b border-border/20
                    ${isUnmatched ? "bg-red-500/5" : "bg-amber-500/5"}
                  `}>
                    {rs.hints.map((h, i) => (
                      <span key={i} className={`text-[10px] flex items-center gap-1
                        ${isUnmatched ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}
                      `}>
                        {isUnmatched ? <XCircle className="h-3 w-3 shrink-0" /> : <AlertTriangle className="h-3 w-3 shrink-0" />}
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                {/* Field sections */}
                <div className="px-4 py-4 space-y-4">
                  {sections.map((section, sIdx) => (
                    <div key={section.legend}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                        {section.legend}
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4 auto-rows-fr">
                        {section.fields.map((col) => {
                          const val = row[col] ?? "";
                          const isRequired = requiredFields.has(col);
                          const isEmpty = isRequired && !val.trim();
                          const isDept = col === "Department";
                          return (
                            <div key={col} className="flex flex-col gap-1">
                              <label className="text-[10px] font-medium text-muted-foreground leading-none">
                                {col}{isRequired && <span className="text-destructive ml-0.5">*</span>}
                              </label>
                              {isDept ? (
                                <Select
                                  value={val || "none"}
                                  onValueChange={(v) => updateCell(rowIdx, col, v === "none" ? "" : v)}
                                >
                                  <SelectTrigger
                                    className={[
                                      "!h-7 min-h-0 w-full px-2 text-xs",
                                      "[&>span]:truncate",
                                      "[&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0",
                                      isEmpty
                                        ? "border-destructive/60 bg-destructive/5 focus-visible:ring-destructive/40"
                                        : "border-border/50",
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                  >
                                    <SelectValue placeholder="Select department" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none"></SelectItem>
                                    {departments.filter((d) => d.isActive).map((d) => (
                                      <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={val}
                                  placeholder={isRequired ? `${col} (required)` : "—"}
                                  onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                                  className={["h-7 text-xs px-2",
                                    isEmpty ? "border-destructive/60 bg-destructive/5 focus-visible:ring-destructive/40" : "border-border/50",
                                  ].filter(Boolean).join(" ")}
                                />
                              )}
                              {isEmpty && <p className="text-[9px] text-destructive leading-none">Required</p>}
                            </div>
                          );
                        })}
                      </div>
                      {sIdx < sections.length - 1 && <Separator className="mt-4" />}
                    </div>
                  ))}
                  <ImportedExtrasFields row={row} rowIdx={rowIdx} updateCell={updateCell} />
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">All records removed</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Go back to upload a new file.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-3.5 flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{rows.length}</span>
            <span>record{rows.length !== 1 ? "s" : ""}</span>
            {counts.unmatched > 0 && <span className="text-red-600 dark:text-red-400">· {counts.unmatched} unmatched</span>}
            {missingEmailCount > 0 && <span className="text-amber-600 dark:text-amber-400">· {missingEmailCount} email{missingEmailCount !== 1 ? "s" : ""} missing</span>}
            {counts.unmatched === 0 && missingEmailCount === 0 && rows.length > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400">· ready to import</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
              Back
            </Button>
            <Button size="sm" className="gap-1.5 text-xs h-8" onClick={onConfirm}
              disabled={rows.length === 0 || confirming || missingEmailCount > 0 || missingRequiredCount > 0}>
              {confirming
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Importing…</>
                : <><Upload className="h-3.5 w-3.5" />Confirm Import<ArrowRight className="h-3.5 w-3.5" /></>
              }
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Template Preview Dialog ──────────────────────────────────────────────────

/**
 * Preview/edit dialog for standard-template uploads (payroll, attendance, employees).
 * Mirrors the PBPreviewDialog card-based layout with the same validation badges,
 * duplicate warnings, and editable fields.
 */

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: Record<string, string>[];
  onRowsChange: (rows: Record<string, string>[]) => void;
  onConfirm: () => void;
  confirming: boolean;
  validating: boolean;
  onRevalidate: () => void;
  fileName: string;
  module: ImportModule;
  validation: ValidationResult | null;
}

function TemplatePreviewDialog({
  open,
  onOpenChange,
  rows,
  onRowsChange,
  onConfirm,
  confirming,
  validating,
  onRevalidate,
  fileName,
  module,
  validation,
}: TemplatePreviewDialogProps) {
  const employees = useEmployeesStore((s) => s.employees);
  const existingPayslips = usePayrollStore((s) => s.payslips);
  const departments = useDepartmentsStore((s) => s.departments);

  const isEmployees = module === "employees";
  const isPayroll = module === "payroll";
  const isAttendance = module === "attendance";

  const updateCell = useCallback(
    (rowIdx: number, col: string, value: string) => {
      onRowsChange(rows.map((r, i) => (i === rowIdx ? { ...r, [col]: value } : r)));
    },
    [rows, onRowsChange]
  );

  const deleteRow = useCallback(
    (rowIdx: number) => {
      onRowsChange(rows.filter((_, i) => i !== rowIdx));
    },
    [rows, onRowsChange]
  );

  // ── Column sections per module ──────────────────────────────────────────────
  const sections = useMemo((): Array<{ legend: string; fields: string[] }> => {
    if (isPayroll) {
      return [
        { legend: "Employee", fields: ["Employee Name", "Email", "Department", "Job Title"] },
        { legend: "Pay Period", fields: ["Period Start", "Period End", "Pay Frequency"] },
        { legend: "Earnings", fields: ["Gross Pay", "Allowances", "Holiday Pay"] },
        {
          legend: "Deductions",
          fields: ["SSS", "PhilHealth", "Pag-IBIG", "Tax", "Loan Deduction", "Custom Deductions", "Other Deductions"],
        },
        { legend: "Payment", fields: ["Net Pay", "Payment Method", "Bank Reference", "Notes"] },
      ];
    }
    if (isAttendance) {
      return [
        { legend: "Employee", fields: ["Employee Name", "Email"] },
        { legend: "Event", fields: ["Event Type", "Date", "Time In", "Time Out", "Hours", "Notes"] },
      ];
    }
    // employees
    return [
      { legend: "Identity", fields: ["Name", "Email"] },
      { legend: "Details", fields: ["Phone", "Birthday", "Address"] },
    ];
  }, [isPayroll, isAttendance]);

  const requiredFields = useMemo(() => {
    const base = new Set(REQUIRED_COLS[module]);
    // Payroll imports also require period + gross pay before confirm (Part 1, Step 4)
    if (module === "payroll") {
      base.add("Period Start");
      base.add("Period End");
      base.add("Gross Pay");
    }
    return base;
  }, [module]);

  // ── Row status — reuse same logic as PBPreviewDialog for payroll; generic for others ──
  const rowStatuses = useMemo(() => {
    if (isPayroll) {
      const existingKeys = new Set(
        existingPayslips.map((p) => `${p.employeeId}|${p.periodStart}|${p.periodEnd}`)
      );
      return rows.map((row, rowIdx) => {
        const name = (row["Employee Name"] || "").trim();
        const email = (row["Email"] || "").trim();
        const netPay = parseFloat(row["Net Pay"] || "0");
        const periodStart = (row["Period Start"] || "").trim();
        const periodEnd = (row["Period End"] || "").trim();
        const normName = normaliseForMatch(name);
        const matchedEmployee =
          email
            ? employees.find((e) => e.email?.toLowerCase() === email.toLowerCase())
            : employees.find((e) => normaliseForMatch(e.name) === normName);

        const hints: string[] = [];
        let status: PBRowStatus = "matched";

        if (!matchedEmployee) {
          status = "unmatched";
          hints.push(`No employee matched for "${name || email}"`);
        } else {
          if (periodStart && periodEnd) {
            const dupKey = `${matchedEmployee.id}|${periodStart}|${periodEnd}`;
            if (existingKeys.has(dupKey)) {
              status = "warning";
              hints.push(`Duplicate — payslip already exists for ${periodStart} – ${periodEnd}`);
            }
          }
          // Within-batch duplicate
          const batchDup = rows.slice(0, rowIdx).some((prev) => {
            const prevMatch = employees.find(
              (e) =>
                e.email?.toLowerCase() === (prev["Email"] || "").trim().toLowerCase() ||
                normaliseForMatch(e.name) === normaliseForMatch((prev["Employee Name"] || "").trim())
            );
            return (
              prevMatch?.id === matchedEmployee.id &&
              (prev["Period Start"] || "") === periodStart &&
              (prev["Period End"] || "") === periodEnd
            );
          });
          if (batchDup) {
            status = "warning";
            hints.push("Duplicate within this import — same employee and period appears above");
          }
        }
        if (!periodStart || !periodEnd) {
          if (status !== "unmatched") status = "warning";
          hints.push("Pay period missing");
        }
        if (isNaN(netPay) || netPay === 0) {
          if (status !== "unmatched") status = "warning";
          hints.push("Net pay is zero — verify before importing");
        }
        return { status, hints, matchedEmployee };
      });
    }

    // For attendance & employees: derive status from validation result if available
    return rows.map((row, rowIdx) => {
      const rv = validation?.rowValidations?.find((v) => v.row === rowIdx + 1);
      const hints: string[] = [];
      let status: PBRowStatus = "matched";
      if (rv) {
        if (rv.status === "error") { status = "unmatched"; hints.push(rv.message); }
        else if (rv.status === "duplicate") { status = "warning"; hints.push(rv.message); }
      }
      // Basic required-field check
      for (const req of REQUIRED_COLS[module]) {
        if (!row[req]?.trim()) {
          if (status === "matched") status = "unmatched";
          hints.push(`${req} is required`);
        }
      }
      return { status, hints, matchedEmployee: null };
    });
  }, [isPayroll, rows, employees, existingPayslips, validation, module]);

  const counts = useMemo(() => {
    let matched = 0; let warning = 0; let unmatched = 0;
    for (const rs of rowStatuses) {
      if (rs.status === "matched") matched++;
      else if (rs.status === "warning") warning++;
      else unmatched++;
    }
    return { matched, warning, unmatched };
  }, [rowStatuses]);

  const missingRequiredCount = rows.filter((r) =>
    Array.from(requiredFields).some((c) => !r[c]?.trim())
  ).length;

  const isReady = rows.length > 0 && missingRequiredCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <DialogHeader className="shrink-0 px-6 pt-5 pb-4 border-b border-border/60">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold leading-none">
                  Review {MODULE_LABELS[module]} Data
                </DialogTitle>
                <DialogDescription className="text-[11px] text-muted-foreground mt-1 truncate">
                  {fileName} · Template format · {rows.length} record{rows.length !== 1 ? "s" : ""}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle className="h-3 w-3" />{counts.matched}
              </span>
              {counts.warning > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="h-3 w-3" />{counts.warning}
                </span>
              )}
              {counts.unmatched > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">
                  <XCircle className="h-3 w-3" />{counts.unmatched}
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* ── Summary tiles ──────────────────────────────────────────── */}
        <div className="shrink-0 px-6 pt-4 grid grid-cols-3 gap-3">
          {([
            { label: "Ready",     count: counts.matched,   Icon: UserCheck,     color: "emerald" },
            { label: "Warnings",  count: counts.warning,   Icon: AlertTriangle, color: "amber"   },
            { label: "Issues",    count: counts.unmatched, Icon: UserX,         color: "red"     },
          ] as const).map(({ label, count, Icon, color }) => (
            <div key={label} className={`flex items-center gap-3 rounded-lg border p-3
              ${color === "emerald" ? "border-emerald-500/20 bg-emerald-500/5" : ""}
              ${color === "amber"   ? "border-amber-500/20  bg-amber-500/5"   : ""}
              ${color === "red"     ? "border-red-500/20    bg-red-500/5"     : ""}
            `}>
              <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0
                ${color === "emerald" ? "bg-emerald-500/15" : ""}
                ${color === "amber"   ? "bg-amber-500/15"   : ""}
                ${color === "red"     ? "bg-red-500/15"     : ""}
              `}>
                <Icon className={`h-4 w-4
                  ${color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : ""}
                  ${color === "amber"   ? "text-amber-600   dark:text-amber-400"   : ""}
                  ${color === "red"     ? "text-red-600     dark:text-red-400"     : ""}
                `} />
              </div>
              <div>
                <p className={`text-xl font-bold leading-none
                  ${color === "emerald" ? "text-emerald-700 dark:text-emerald-400" : ""}
                  ${color === "amber"   ? "text-amber-700   dark:text-amber-400"   : ""}
                  ${color === "red"     ? "text-red-700     dark:text-red-400"     : ""}
                `}>{count}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Alert banners ───────────────────────────────────────────── */}
        <div className="shrink-0 px-6 pt-3 space-y-2">
          {counts.unmatched > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
              <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                <strong>{counts.unmatched} record{counts.unmatched !== 1 ? "s" : ""} have issues</strong> — fill in the required fields or remove them before importing.
              </p>
            </div>
          )}
          {counts.warning > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                <strong>{counts.warning} duplicate{counts.warning !== 1 ? "s" : ""} detected</strong> — these records already exist. They will be skipped unless removed.
              </p>
            </div>
          )}
          {isReady && counts.unmatched === 0 && counts.warning === 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                All {rows.length} record{rows.length !== 1 ? "s" : ""} validated — no duplicates found. Ready to import.
              </p>
            </div>
          )}
        </div>

        {/* ── Scrollable records ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {rows.map((row, rowIdx) => {
            const rs = rowStatuses[rowIdx];
            const isUnmatched = rs?.status === "unmatched";
            const isWarning   = rs?.status === "warning";

            const cardBorder = isUnmatched ? "border-red-500/30"   : isWarning ? "border-amber-500/30"  : "border-border/60";
            const headerBg   = isUnmatched ? "bg-red-500/5"        : isWarning ? "bg-amber-500/5"       : "bg-muted/30";
            const iconBg     = isUnmatched ? "bg-red-500/10"       : isWarning ? "bg-amber-500/10"      : "bg-emerald-500/10";
            const iconColor  = isUnmatched
              ? "text-red-600 dark:text-red-400"
              : isWarning
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400";
            const StatusIcon = isUnmatched ? UserX : isWarning ? AlertTriangle : UserCheck;
            const statusPill = isUnmatched
              ? <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20">Issue</span>
              : isWarning
              ? <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">Duplicate</span>
              : <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">Ready</span>;

            // Display name based on module
            const displayName =
              row["Employee Name"] || row["Name"] ||
              <span className="text-muted-foreground italic">Unnamed</span>;
            const displaySub =
              isPayroll
                ? [row["Job Title"], row["Department"]].filter(Boolean).join(" · ")
                : isAttendance
                ? [row["Event Type"], row["Date"]].filter(Boolean).join(" · ")
                : [row["Email"]].filter(Boolean).join("");

            return (
              <div key={rowIdx} className={`rounded-xl border ${cardBorder} bg-card overflow-hidden`}>
                {/* Card header */}
                <div className={`flex items-center justify-between px-4 py-2.5 ${headerBg} border-b border-border/30`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`h-6 w-6 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
                      <StatusIcon className={`h-3.5 w-3.5 ${iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium leading-none">{displayName}</span>
                        {statusPill}
                      </div>
                      {displaySub && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{displaySub}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    title="Remove record"
                    onClick={() => deleteRow(rowIdx)}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 ml-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Inline hints */}
                {rs && rs.hints.length > 0 && (
                  <div className={`px-4 py-2 flex flex-wrap gap-x-4 gap-y-1 border-b border-border/20 ${isUnmatched ? "bg-red-500/5" : "bg-amber-500/5"}`}>
                    {rs.hints.map((h, i) => (
                      <span key={i} className={`text-[10px] flex items-center gap-1 ${isUnmatched ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {isUnmatched ? <XCircle className="h-3 w-3 shrink-0" /> : <AlertTriangle className="h-3 w-3 shrink-0" />}
                        {h}
                      </span>
                    ))}
                  </div>
                )}

                {/* Field sections */}
                <div className="px-4 py-4 space-y-4">
                  {sections.map((section, sIdx) => {
                    // Only render sections whose fields exist in the row
                    const relevantFields = section.fields.filter(
                      (f) => row.hasOwnProperty(f) || requiredFields.has(f)
                    );
                    if (relevantFields.length === 0) return null;
                    return (
                      <div key={section.legend}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                          {section.legend}
                        </p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4 auto-rows-fr">
                          {relevantFields.map((col) => {
                            const val = row[col] ?? "";
                            const isRequired = requiredFields.has(col);
                            const isEmpty = isRequired && !val.trim();
                            const isDept = col === "Department";
                            return (
                              <div key={col} className="flex flex-col gap-1">
                                <label className="text-[10px] font-medium text-muted-foreground leading-none">
                                  {col}{isRequired && <span className="text-destructive ml-0.5">*</span>}
                                </label>
                                {isDept ? (
                                  <Select
                                    value={val || "none"}
                                    onValueChange={(v) => updateCell(rowIdx, col, v === "none" ? "" : v)}
                                  >
                                    <SelectTrigger className={["!h-7 min-h-0 w-full px-2 text-xs [&>span]:truncate [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0", isEmpty ? "border-destructive/60 bg-destructive/5 focus-visible:ring-destructive/40" : "border-border/50"].filter(Boolean).join(" ")}>
                                      <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none"></SelectItem>
                                      {departments.filter((d) => d.isActive).map((d) => (
                                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    value={val}
                                    placeholder={isRequired ? `${col} (required)` : "—"}
                                    onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                                    className={["h-7 text-xs px-2", isEmpty ? "border-destructive/60 bg-destructive/5 focus-visible:ring-destructive/40" : "border-border/50"].filter(Boolean).join(" ")}
                                  />
                                )}
                                {isEmpty && <p className="text-[9px] text-destructive leading-none">Required</p>}
                              </div>
                            );
                          })}
                        </div>
                        {sIdx < sections.length - 1 && <Separator className="mt-4" />}
                      </div>
                    );
                  })}
                  {isPayroll && (
                    <ImportedExtrasFields row={row} rowIdx={rowIdx} updateCell={updateCell} />
                  )}
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">All records removed</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Go back to upload a new file.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-3.5 flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{rows.length}</span>
            <span>record{rows.length !== 1 ? "s" : ""}</span>
            {counts.unmatched > 0 && <span className="text-red-600 dark:text-red-400">· {counts.unmatched} issue{counts.unmatched !== 1 ? "s" : ""}</span>}
            {counts.warning > 0 && <span className="text-amber-600 dark:text-amber-400">· {counts.warning} duplicate{counts.warning !== 1 ? "s" : ""}</span>}
            {counts.unmatched === 0 && counts.warning === 0 && rows.length > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400">· ready to import</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={onRevalidate}
              disabled={validating || rows.length === 0}
            >
              {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {validating ? "Validating…" : "Re-validate"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-8">
              Back
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={onConfirm}
              disabled={rows.length === 0 || confirming || missingRequiredCount > 0}
            >
              {confirming
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Importing…</>
                : <><Upload className="h-3.5 w-3.5" />Confirm Import<ArrowRight className="h-3.5 w-3.5" /></>
              }
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ImportDataDialog ────────────────────────────────────────────────────

export function ImportDataDialog({
  module,
  trigger,
  onImportComplete,
}: ImportDataDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [editedRows, setEditedRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [expandedSection, setExpandedSection] = useState<RowStatus | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // PB converter state
  const [pbPreviewOpen, setPbPreviewOpen] = useState(false);
  const [pbRows, setPbRows] = useState<PayrollRow[]>([]);
  const [pbFileName, setPbFileName] = useState("");
  const [pbImporting, setPbImporting] = useState(false);

  // Template preview dialog state (standard template uploads)
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false);
  const [templatePreviewRows, setTemplatePreviewRows] = useState<Record<string, string>[]>([]);
  const [templatePreviewFileName, setTemplatePreviewFileName] = useState("");
  const [templateImporting, setTemplateImporting] = useState(false);

  const isEmployees = module === "employees";
  const isPayroll = module === "payroll";
  const expectedHeaders =
    module === "payroll"
      ? PAYROLL_TEMPLATE_HEADERS
      : module === "attendance"
      ? ATTENDANCE_TEMPLATE_HEADERS
      : EMPLOYEES_TEMPLATE_HEADERS;

  const reset = useCallback(() => {
    setFile(null);
    setEditedRows([]);
    setValidation(null);
    setResult(null);
    setExpandedSection(null);
    setTemplatePreviewRows([]);
    setTemplatePreviewFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────────

  const runValidation = useCallback(
    async (rows: Record<string, string>[]) => {
      if (rows.length === 0) return;
      setValidating(true);
      setValidation(null);
      try {
        const res = await fetch(`/api/import/${module}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows, dryRun: true }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Validation failed" }));
          toast.error(err.error || "Validation failed");
          return;
        }
        const data: ValidationResult = await res.json();
        setValidation(data);
        if (data.valid === rows.length) {
          toast.success(`All ${data.valid} row(s) are valid and ready to import`);
        } else if (data.valid > 0) {
          toast.info(`${data.valid} valid, ${data.duplicates} duplicate(s), ${data.errors} error(s)`);
        } else {
          toast.warning("No valid rows. Fix the highlighted errors and re-validate.");
        }
      } catch {
        toast.error("Failed to validate. You can still try importing.");
      } finally {
        setValidating(false);
      }
    },
    [module]
  );

  // ── Editable table helpers ──────────────────────────────────────────────────

  const handleCellEdit = useCallback((rowIdx: number, col: string, value: string) => {
    setEditedRows((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, [col]: value } : r))
    );
    setValidation(null);
  }, []);

  const handleDeleteRow = useCallback((rowIdx: number) => {
    setEditedRows((prev) => prev.filter((_, i) => i !== rowIdx));
    setValidation(null);
  }, []);

  // ── File select ─────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;

      const ext = f.name.split(".").pop()?.toLowerCase();
      if (!["xlsx", "csv", "xls"].includes(ext || "")) {
        toast.error("Please upload an XLSX or CSV file");
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error("File too large. Maximum 5 MB.");
        return;
      }

      setFile(f);
      setResult(null);
      setValidation(null);
      setLoading(true);

      try {
        const rows = await parseImportFile(f);
        if (rows.length === 0) {
          toast.error("File is empty or has no data rows");
          setLoading(false);
          return;
        }

        const fileHeaders = Object.keys(rows[0]);

        // ── PB / NexHRIS format detection (payroll module only) ───────────────
        if (isPayroll && isPBFormat(fileHeaders)) {
          // Re-read with header:1 to get array-of-arrays keyed by col index
          // Process ALL sheets — each sheet typically contains one employee
          const buf = await f.arrayBuffer();
          const wb = XLSX.read(new Uint8Array(buf), { type: "array" });

          const allSheets: Array<Record<string, unknown>[]> = [];
          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            if (!ws) continue;
            const arrayRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
              header: 1,
              defval: "",
              raw: true,
            });
            // Convert each row array to Record<number, unknown>
            const indexedRows = arrayRows.map((row) =>
              Object.fromEntries((row as unknown[]).map((cell, i) => [i, cell]))
            );
            if (indexedRows.length > 5) allSheets.push(indexedRows);
          }

          // ── Try NexHRIS format FIRST (check for "NexHRIS" + section headers) ──
          if (allSheets.length > 0 && isNexHRISFormat(allSheets[0])) {
            const converted = convertNexHRISToPayrollRows(allSheets);
            if (converted.length > 0) {
              const allEmployees = useEmployeesStore.getState().employees;
              let matchedCount = 0;
              const enriched = converted.map((row) => {
                const name = (row["Employee Name"] || "").trim();
                const normName = normaliseForMatch(name);
                // Try matching by employee ID first (most reliable), then by name
                const empId = (row["Notes"] || "").match(/ID:(EMP-\w+)/)?.[1] || "";
                const emp = (empId ? allEmployees.find((e) => e.id === empId) : null)
                  || allEmployees.find((e) => normaliseForMatch(e.name) === normName);
                if (emp) {
                  matchedCount++;
                  return { ...row, Email: row["Email"] || emp.email || "", Department: row["Department"] || emp.department || "", "Job Title": row["Job Title"] || emp.jobTitle || "" };
                }
                return row;
              });

              toast.info(`NexHRIS format detected — ${enriched.length} record(s) converted, ${matchedCount} matched. Review before importing.`);
              setPbRows(enriched);
              setPbFileName(f.name);
              setLoading(false);
              setPbPreviewOpen(true);
              return;
            }
          }

          // ── Fall back to PB format converter ──
          const converted = convertPBRawToPayrollRows(
            allSheets[0] ?? [],
            allSheets
          );
          if (converted.length === 0) {
            toast.error(
              "Could not find employee records in the PB file. Make sure it's a valid Payroll Bureau export."
            );
            setLoading(false);
            return;
          }

          // Deduplicate: same employee name + same period → keep first occurrence
          const seen = new Set<string>();
          const deduped = converted.filter((row) => {
            const key = `${(row["Employee Name"] || "").trim().toLowerCase()}__${row["Period Start"] || ""}__${row["Period End"] || ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          // Auto-match employees by name and fill in Email + Department
          const allEmployees = useEmployeesStore.getState().employees;
          let matchedCount = 0;
          const enriched = deduped.map((row) => {
            const name = (row["Employee Name"] || "").trim();
            const normName = normaliseForMatch(name);
            const emp = allEmployees.find((e) => normaliseForMatch(e.name) === normName);
            if (emp) {
              matchedCount++;
              return {
                ...row,
                Email: row["Email"] || emp.email || "",
                Department: row["Department"] || emp.department || "",
                "Job Title": row["Job Title"] || emp.jobTitle || "",
              };
            }
            return row;
          });

          const removedCount = converted.length - deduped.length;
          const unmatchedCount = enriched.length - matchedCount;
          const parts: string[] = [`PB format detected — ${enriched.length} record(s) converted`];
          if (removedCount > 0) parts.push(`${removedCount} duplicate(s) removed`);
          parts.push(`${matchedCount} matched`);
          if (unmatchedCount > 0) parts.push(`${unmatchedCount} unmatched`);
          toast.info(parts.join(", ") + ". Review before importing.");

          setPbRows(enriched);
          setPbFileName(f.name);
          setLoading(false);
          setPbPreviewOpen(true);
          return;
        }

        // ── Standard template format ────────────────────────────────────────
        const missingCols = REQUIRED_COLS[module].filter(
          (col) =>
            !fileHeaders.some((h) => h.trim().toLowerCase() === col.toLowerCase())
        );
        if (missingCols.length > 0) {
          toast.error(
            `Missing required column(s): ${missingCols.join(", ")}. Download the template for the correct format.`
          );
          setLoading(false);
          return;
        }

        const stringRows = rows.map((r) => {
          const base = Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k, String(v ?? "")])
          ) as Record<string, string>;
          // Auto-detect DTR + custom columns for payroll imports only
          return isPayroll ? detectImportedFields(base) : base;
        });

        // Open the template preview dialog (mirrors PB flow)
        setTemplatePreviewRows(stringRows);
        setTemplatePreviewFileName(f.name);
        setEditedRows(stringRows);
        setLoading(false);
        setTemplatePreviewOpen(true);
        // Run validation in background so the preview has status info
        runValidation(stringRows);
      } catch (err) {
        toast.error(
          `Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      } finally {
        setLoading(false);
      }
    },
    [isPayroll, module, runValidation]
  );

  // ── Standard import ─────────────────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (editedRows.length === 0) return;
    if (validation && validation.valid === 0) {
      toast.error("No valid rows to import. Fix the errors and re-validate.");
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/import/${module}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: editedRows, dryRun: false }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Import failed" }));
        toast.error(err.error || "Import failed");
        return;
      }
      const data: ImportResult = await res.json();
      setResult(data);
      if (data.imported > 0) {
        toast.success(
          `Imported ${data.imported} record(s)${
            data.duplicates > 0 ? `, ${data.duplicates} duplicate(s) skipped` : ""
          }${data.errors > 0 ? `, ${data.errors} error(s)` : ""}`
        );
        onImportComplete?.();
      } else if (data.duplicates > 0) {
        toast.warning(`All ${data.duplicates} record(s) are duplicates — nothing imported`);
      } else {
        toast.error(`Import failed with ${data.errors} error(s)`);
      }
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setImporting(false);
    }
  }, [editedRows, module, onImportComplete, validation]);

  // ── PB confirm import ───────────────────────────────────────────────────────

  const handlePBConfirmImport = useCallback(async () => {
    if (pbRows.length === 0) return;
    setPbImporting(true);
    try {
      const stringRows = pbRows.map((r) => {
        const base = Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k, String(v ?? "")])
        ) as Record<string, string>;
        // Tag as imported + surface DTR/custom columns for the API route
        return buildImportedRowPayload(detectImportedFields(base), pbFileName);
      });
      const res = await fetch(`/api/import/${module}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: stringRows, dryRun: false }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Import failed" }));
        toast.error(err.error || "Import failed");
        return;
      }
      const data: ImportResult = await res.json();
      if (data.imported > 0) {
        toast.success(
          `Imported ${data.imported} record(s)${
            data.duplicates > 0 ? `, ${data.duplicates} duplicate(s) skipped` : ""
          }`
        );
        onImportComplete?.();
        setPbPreviewOpen(false);
        setOpen(false);
        reset();
      } else if (data.duplicates > 0) {
        toast.warning(`All ${data.duplicates} record(s) are duplicates — nothing imported`);
      } else {
        toast.error(`Import failed with ${data.errors} error(s)`);
      }
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setPbImporting(false);
    }
  }, [pbRows, module, onImportComplete, reset, pbFileName]);

  // ── Template preview confirm import ─────────────────────────────────────────

  const handleTemplateConfirmImport = useCallback(async () => {
    if (templatePreviewRows.length === 0) return;
    if (validation && validation.valid === 0) {
      toast.error("No valid rows to import. Fix the errors and re-validate.");
      return;
    }
    setTemplateImporting(true);
    setResult(null);
    try {
      // For payroll imports, tag rows as imported and surface DTR/custom columns
      // so the API route creates a locked run + persists receipt-only DTR data.
      const outRows =
        module === "payroll"
          ? templatePreviewRows.map((r) =>
              buildImportedRowPayload(detectImportedFields(r), templatePreviewFileName)
            )
          : templatePreviewRows;
      const res = await fetch(`/api/import/${module}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: outRows, dryRun: false }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Import failed" }));
        toast.error(err.error || "Import failed");
        return;
      }
      const data: ImportResult = await res.json();
      if (data.imported > 0) {
        toast.success(
          `Imported ${data.imported} record(s)${
            data.duplicates > 0 ? `, ${data.duplicates} duplicate(s) skipped` : ""
          }${data.errors > 0 ? `, ${data.errors} error(s)` : ""}`
        );
        onImportComplete?.();
        setTemplatePreviewOpen(false);
        setOpen(false);
        reset();
      } else if (data.duplicates > 0) {
        toast.warning(`All ${data.duplicates} record(s) are duplicates — nothing imported`);
      } else {
        toast.error(`Import failed with ${data.errors} error(s)`);
      }
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setTemplateImporting(false);
    }
  }, [templatePreviewRows, module, onImportComplete, reset, validation, templatePreviewFileName]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const handleDownloadTemplate = useCallback(
    (format: ExportFormat) => {
      downloadImportTemplate(module, format);
      toast.success(`${format.toUpperCase()} template downloaded`);
    },
    [module]
  );

  const activeValidations = result?.rowValidations ?? validation?.rowValidations;
  const activeCounts = result
    ? { valid: result.imported, duplicates: result.duplicates, errors: result.errors }
    : validation
    ? { valid: validation.valid, duplicates: validation.duplicates, errors: validation.errors }
    : null;

  const rowStatusMap = useMemo(() => {
    const map = new Map<number, RowValidation>();
    if (activeValidations) {
      for (const v of activeValidations) map.set(v.row - 1, v);
    }
    return map;
  }, [activeValidations]);

  const showPreviewTable = isEmployees && editedRows.length > 0 && !result;
  const employeeCols = ["Name", "Email", "Phone", "Birthday", "Address"] as const;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Template Preview Dialog (standard template uploads) ────────────── */}
      <TemplatePreviewDialog
        open={templatePreviewOpen}
        onOpenChange={(v) => {
          setTemplatePreviewOpen(v);
          if (!v) {
            setTemplatePreviewRows([]);
            setTemplatePreviewFileName("");
            reset();
          }
        }}
        rows={templatePreviewRows}
        onRowsChange={(rows) => {
          setTemplatePreviewRows(rows);
          setEditedRows(rows);
          setValidation(null);
        }}
        onConfirm={handleTemplateConfirmImport}
        confirming={templateImporting}
        validating={validating}
        onRevalidate={() => runValidation(templatePreviewRows)}
        fileName={templatePreviewFileName}
        module={module}
        validation={validation}
      />

      {/* ── PB Preview Dialog (second popup) ───────────────────────────────── */}
      <PBPreviewDialog
        open={pbPreviewOpen}
        onOpenChange={(v) => {
          setPbPreviewOpen(v);
          if (!v) {
            setPbRows([]);
            setPbFileName("");
            reset();
          }
        }}
        rows={pbRows}
        onRowsChange={setPbRows}
        onConfirm={handlePBConfirmImport}
        confirming={pbImporting}
        fileName={pbFileName}
      />

      {/* ── Main upload dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
          )}
        </DialogTrigger>
        <DialogContent
          className={`${
            showPreviewTable ? "sm:max-w-3xl" : "max-w-lg"
          } max-h-[90vh] flex flex-col transition-all duration-200`}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              Import {MODULE_LABELS[module]} Data
            </DialogTitle>
            <DialogDescription className="sr-only">
              Upload an XLSX or CSV file to import {MODULE_LABELS[module].toLowerCase()} data into the system.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 overflow-y-auto pr-1">

            {/* ── Guide ──────────────────────────────────────────────────── */}
            {isEmployees ? (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  Import Guide — Employees
                </p>
                <ul className="text-[11px] text-blue-700/90 dark:text-blue-300/90 space-y-0.5 list-none">
                  <li>✦ <strong>Name</strong> and <strong>Email</strong> are required.</li>
                  <li>✦ <strong>Duplicate emails</strong> are automatically detected and skipped.</li>
                  <li>✦ Only <strong>@nexsdsi.com</strong> email addresses are accepted.</li>
                  <li>✦ <strong>Birthday</strong> must be <code className="bg-blue-100 dark:bg-blue-900/50 px-0.5 rounded text-[10px]">YYYY-MM-DD</code>.</li>
                  <li>✦ You can <strong>edit any cell</strong> in the preview table below before importing.</li>
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-1">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  Import Guide — {MODULE_LABELS[module]}
                </p>
                <p className="text-[11px] text-blue-700/90 dark:text-blue-300/90">
                  Download the template first. Column names are <strong>case-sensitive</strong>.{" "}
                  {isPayroll && (
                    <>Payroll Bureau (PB) files are <strong>automatically detected and converted</strong>.</>
                  )}
                </p>
                <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80">
                  Required: {REQUIRED_COLS[module].join(", ")}
                </p>
              </div>
            )}

            {/* ── Template Download ───────────────────────────────────────── */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 flex-1 text-xs"
                onClick={() => handleDownloadTemplate("xlsx")}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> XLSX Template
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 flex-1 text-xs"
                onClick={() => handleDownloadTemplate("csv")}
              >
                <FileText className="h-3.5 w-3.5" /> CSV Template
              </Button>
            </div>

            {/* ── Upload Zone ─────────────────────────────────────────────── */}
            <div>
              <label className="text-sm font-medium">Upload File</label>
              <div
                className="mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/60 p-5 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.csv,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {loading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : file ? (
                  <div className="text-center">
                    <FileSpreadsheet className="h-8 w-8 mx-auto text-primary" />
                    <p className="text-sm font-medium mt-1">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {editedRows.length > 0
                        ? `${editedRows.length} row(s) loaded`
                        : "Parsing..."}
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-1">
                      Click to upload XLSX or CSV
                    </p>
                    {isPayroll && (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
                        Payroll Bureau (PB) files also accepted
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">Max 5 MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Employee Preview & Edit Table ────────────────────────────── */}
            {showPreviewTable && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Preview &amp; Edit{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({editedRows.length} row{editedRows.length !== 1 ? "s" : ""} · click any cell to edit)
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 px-2 gap-1"
                    onClick={() => runValidation(editedRows)}
                    disabled={validating}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {validation ? "Re-validate" : "Validate"}
                  </Button>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-muted/60 sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-7 border-b border-border">#</th>
                          {employeeCols.map((col) => (
                            <th
                              key={col}
                              className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b border-border whitespace-nowrap"
                            >
                              {col}
                              {(col === "Name" || col === "Email") && (
                                <span className="text-red-500 ml-0.5">*</span>
                              )}
                            </th>
                          ))}
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b border-border w-16">
                            Status
                          </th>
                          <th className="w-8 border-b border-border" />
                        </tr>
                      </thead>
                      <tbody>
                        {editedRows.map((row, idx) => {
                          const rv = rowStatusMap.get(idx);
                          const rowBg =
                            rv?.status === "error"
                              ? "bg-red-500/5"
                              : rv?.status === "duplicate"
                              ? "bg-amber-500/5"
                              : rv?.status === "valid"
                              ? "bg-emerald-500/5"
                              : "";
                          return (
                            <tr key={idx} className={`${rowBg} border-b border-border/30 last:border-0`}>
                              <td className="px-2 py-1 text-muted-foreground text-center">{idx + 1}</td>
                              {employeeCols.map((col) => {
                                const val = row[col] ?? "";
                                const isRequired = col === "Name" || col === "Email";
                                const isEmpty = isRequired && !val.trim();
                                const isBadBirthday =
                                  col === "Birthday" && val && !/^\d{4}-\d{2}-\d{2}$/.test(val);
                                return (
                                  <td key={col} className="px-1 py-0.5">
                                    <input
                                      className={`w-full min-w-[80px] bg-transparent rounded px-1.5 py-0.5 text-xs border focus:outline-none focus:ring-1 focus:ring-primary/60 transition-colors ${
                                        isEmpty
                                          ? "border-red-400/70 bg-red-500/5"
                                          : isBadBirthday
                                          ? "border-amber-400/70 bg-amber-500/5"
                                          : "border-transparent hover:border-border/70 focus:border-border"
                                      }`}
                                      value={val}
                                      placeholder={
                                        col === "Birthday"
                                          ? "YYYY-MM-DD"
                                          : isRequired
                                          ? `${col} (required)`
                                          : col
                                      }
                                      onChange={(e) => handleCellEdit(idx, col, e.target.value)}
                                    />
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1">
                                {validating ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                ) : rv ? (
                                  <span
                                    className={`inline-flex items-center gap-0.5 font-medium text-[10px] cursor-help ${
                                      rv.status === "valid"
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : rv.status === "duplicate"
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-red-600 dark:text-red-400"
                                    }`}
                                    title={rv.message}
                                  >
                                    {rv.status === "valid" ? (
                                      <CheckCircle className="h-3 w-3" />
                                    ) : rv.status === "duplicate" ? (
                                      <AlertTriangle className="h-3 w-3" />
                                    ) : (
                                      <XCircle className="h-3 w-3" />
                                    )}
                                    {rv.status === "valid" ? "OK" : rv.status === "duplicate" ? "Dup" : "Err"}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-1 py-1 text-center">
                                <button
                                  type="button"
                                  title="Remove row"
                                  className="p-0.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                                  onClick={() => handleDeleteRow(idx)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                {validation && (
                  <p className="text-[10px] text-muted-foreground">
                    Hover the status badge to see the error. Edit any cell to clear validation — click Re-validate to recheck.
                  </p>
                )}
              </div>
            )}

            {/* ── Validating spinner ──────────────────────────────────────── */}
            {validating && !showPreviewTable && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Validating rows and checking for duplicates…
                </p>
              </div>
            )}

            {/* ── Validation / Result Summary ─────────────────────────────── */}
            {activeCounts && !validating && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {(["valid", "duplicate", "error"] as const).map((status) => {
                    const cfg = STATUS_CONFIG[status];
                    const Icon = cfg.icon;
                    const count =
                      status === "valid"
                        ? activeCounts.valid
                        : status === "duplicate"
                        ? activeCounts.duplicates
                        : activeCounts.errors;
                    const isExpanded = expandedSection === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        className={`text-center p-2 rounded-md ${cfg.bg} border ${cfg.border} transition-all ${
                          count > 0 ? "cursor-pointer hover:ring-1 hover:ring-offset-1" : "opacity-50"
                        } ${isExpanded ? "ring-1 ring-offset-1" : ""}`}
                        onClick={() =>
                          count > 0 && setExpandedSection(isExpanded ? null : status)
                        }
                        disabled={count === 0}
                      >
                        <Icon className={`h-4 w-4 mx-auto ${cfg.color}`} />
                        <p className={`text-lg font-bold ${cfg.color}`}>{count}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {result ? (status === "valid" ? "Imported" : cfg.label) : cfg.label}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {expandedSection && activeValidations && (
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <div className="px-3 py-1.5 bg-muted/30 border-b border-border/30 flex items-center justify-between">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {STATUS_CONFIG[expandedSection].label} Rows
                      </p>
                      <button
                        type="button"
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => setExpandedSection(null)}
                      >
                        Close
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-border/20">
                      {activeValidations
                        .filter((r) => r.status === expandedSection)
                        .map((r) => {
                          const cfg = STATUS_CONFIG[r.status];
                          const Icon = cfg.icon;
                          return (
                            <div key={r.row} className="px-3 py-1.5 flex items-start gap-2 text-xs">
                              <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cfg.color}`} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                                    #{r.row}
                                  </Badge>
                                  {(r.employee ?? r.name) && (
                                    <span className="font-medium truncate">
                                      {r.employee ?? r.name}
                                    </span>
                                  )}
                                  {(r.period ?? r.detail ?? r.email) && (
                                    <span className="text-muted-foreground truncate">
                                      {r.period ?? r.detail ?? r.email}
                                    </span>
                                  )}
                                </div>
                                <p className={`text-[10px] ${cfg.color} mt-0.5`}>{r.message}</p>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {activeCounts.valid > 0 &&
                  activeCounts.duplicates === 0 &&
                  activeCounts.errors === 0 &&
                  !result && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        All {activeCounts.valid} row(s) validated — no duplicates found. Ready to import.
                      </p>
                    </div>
                  )}

                {!result &&
                  (activeCounts.duplicates > 0 || activeCounts.errors > 0) &&
                  activeCounts.valid > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {activeCounts.valid} row(s) will be imported.{" "}
                        {activeCounts.duplicates > 0 &&
                          `${activeCounts.duplicates} duplicate(s) will be skipped. `}
                        {activeCounts.errors > 0 && `${activeCounts.errors} row(s) have errors. `}
                        {isEmployees
                          ? "Edit cells and re-validate to fix."
                          : "Click counts above for details."}
                      </p>
                    </div>
                  )}

                {!result && activeCounts.valid === 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-700 dark:text-red-400">
                      No valid rows to import.{" "}
                      {isEmployees
                        ? "Edit the highlighted cells above and click Re-validate."
                        : "All rows are either duplicates or have errors. Click the counts above for details."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Action Buttons ──────────────────────────────────────────── */}
            <div className="flex gap-2">
              {result ? (
                <Button className="flex-1 gap-2" variant="outline" onClick={reset}>
                  <RotateCcw className="h-4 w-4" /> Import Another File
                </Button>
              ) : (
                <>
                  {file && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={reset}>
                      <RotateCcw className="h-3.5 w-3.5" /> Reset
                    </Button>
                  )}
                  <Button
                    className="flex-1 gap-2"
                    onClick={handleImport}
                    disabled={
                      editedRows.length === 0 ||
                      importing ||
                      validating ||
                      (validation !== null && validation.valid === 0)
                    }
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Importing…
                      </>
                    ) : validation ? (
                      <>
                        <Upload className="h-4 w-4" /> Import {validation.valid} Valid Row(s)
                        {validation.duplicates > 0 && (
                          <span className="text-amber-400 text-[10px]">
                            ({validation.duplicates} skipped)
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />{" "}
                        Import{editedRows.length > 0 ? ` ${editedRows.length} Row(s)` : ""}
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>

            {/* ── Format Reference Footer ─────────────────────────────────── */}
            <div className="rounded-lg border border-border/40 p-3 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">
                Expected columns ({MODULE_LABELS[module]}):
              </p>
              <p className="text-[10px] text-muted-foreground">
                {(expectedHeaders as readonly string[]).join(", ")}
              </p>
              <p className="text-[10px] text-muted-foreground italic">
                {isEmployees
                  ? "Only Name and Email are required. Admin completes role, department, and pay details in the system after import."
                  : isPayroll
                  ? "Compatible with the exported backup format and Payroll Bureau (PB) XLS files. Duplicates are checked before import."
                  : "Compatible with the exported backup format. Duplicates are checked before import."}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}