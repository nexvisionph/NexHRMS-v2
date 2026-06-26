"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useDepartmentsStore } from "@/store/departments.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useDeductionsStore } from "@/store/deductions.store";
import { useLoansStore } from "@/store/loans.store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Download, FileSpreadsheet, FileText, Loader2, X, Users, Building2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, getDaysInMonth } from "date-fns";
import * as XLSX from "xlsx-js-style";
import type { Payslip } from "@/types";

// ─── Types ────────────────────────────────────────────────────

type PayrollRange = "first_half" | "second_half" | "full_month";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const RANGE_OPTIONS: { value: PayrollRange; label: string }[] = [
  { value: "first_half", label: "First Half (1st – 15th)" },
  { value: "second_half", label: "Second Half (16th – End)" },
  { value: "full_month", label: "Full Month" },
];

interface SelectedEmployee {
  id: string;
  name: string;
  department?: string;
}

interface PayrollExportDialogProps {
  trigger?: React.ReactNode;
}

type ExportMode = "period" | "run";

/** Convert "HH:mm" or "HH:mm:ss" or ISO timestamp to "h:mm AM/PM" format */
function formatTo12hr(time: string): string {
  if (!time) return "";
  let hours: number, minutes: number;
  if (time.includes("T")) {
    const d = new Date(time);
    hours = d.getHours();
    minutes = d.getMinutes();
  } else {
    const parts = time.split(":");
    hours = Number(parts[0]);
    minutes = Number(parts[1] || 0);
  }
  if (isNaN(hours) || isNaN(minutes)) return time;
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

interface EmployeePayrollData {
  id: string;
  name: string;
  position: string;
  project: string;
  department: string;
  monthlySalary: number;
  dailyRate: number;
  hourlyRate: number;
  semiMonthlySalary: number;
  periodFrom: string;
  periodTo: string;
  range: string;
  // Earnings
  overtimePay: number;
  totalBasicSalary: number;
  // Dynamic line items
  allowanceItems: { label: string; amount: number }[];
  deductionItems: { label: string; amount: number }[];
  // Government deductions
  withholdingTax: number;
  sssContribution: number;
  sssSalaryLoan: number;
  philhealthContribution: number;
  pagibigContribution: number;
  pagibigLoan: number;
  leaveWithoutPay: number;
  tardinessUndertime: number;
  totalDeductions: number;
  netPay: number;
  // DTR
  dtr: Array<{
    date: string;
    day: string;
    timeIn: string;
    timeOut: string;
    totalHrs: number;
    otHrs: number;
    tardinessHr: number;
    tardinessMin: number;
    absences: number;
  }>;
  // ─── Imported payroll support (migration 063) ──
  imported?: boolean;            // true when payslip.source === "imported"
  importedFileName?: string;     // shown on the amber banner
  dtrFromImport?: boolean;       // true when DTR was sourced from the payslip, not attendance_logs
}

// ─── Build PB-template-matching XLSX sheet ────────────────────
// Matches the layout: Left side = payslip info, Right side = DTR + OT computation
// Uses the exact structure from the Payroll-Export-Template.xlsx

function buildTemplateSheet(emp: EmployeePayrollData): XLSX.WorkSheet {
  // ── Dynamic row computation ──
  // The sheet has: title (R0-R1), spacer (R2), PAY PERIOD (R3), DTR start (R4+)
  // Then: EMPLOYEE INFO header (R6), emp rows (R7-R10), civil status (R11-R12), spacer (R13)
  // Then: ALLOWANCES header, dynamic allowance rows, TOTAL, spacer
  // Then: DEDUCTIONS header, gov deductions + dynamic custom deductions, TOTAL, spacer
  // Then: NET PAY

  const allowanceRows = emp.allowanceItems;
  const deductionRows = [
    { label: "Withholding Tax", amount: emp.withholdingTax },
    { label: "SSS Contribution", amount: emp.sssContribution },
    { label: "PhilHealth Contribution", amount: emp.philhealthContribution },
    { label: "Pag-IBIG Contribution", amount: emp.pagibigContribution },
    ...emp.deductionItems,
    ...(emp.sssSalaryLoan > 0 ? [{ label: "Loan Deduction", amount: emp.sssSalaryLoan }] : []),
    ...(emp.pagibigLoan > 0 ? [{ label: "Pag-IBIG Loan", amount: emp.pagibigLoan }] : []),
    ...(emp.leaveWithoutPay > 0 ? [{ label: "Leave w/o Pay", amount: emp.leaveWithoutPay }] : []),
   ...(emp.tardinessUndertime > 0 ? [{ label: "Absent / Late / Undertime", amount: emp.tardinessUndertime }] : []),
  ];

  // Fixed layout rows
  const EMP_INFO_START = 6;
  const EMP_INFO_END = 12;
  const ALLOWANCES_HEADER = 14;
  const ALLOWANCES_START = ALLOWANCES_HEADER + 1;
  const ALLOWANCES_END = ALLOWANCES_START + allowanceRows.length; // overtime row
  const TOTAL_ALLOWANCES_ROW = ALLOWANCES_END + 1;
  const DEDUCTIONS_HEADER = TOTAL_ALLOWANCES_ROW + 2;
  const DEDUCTIONS_START = DEDUCTIONS_HEADER + 1;
  const DEDUCTIONS_END = DEDUCTIONS_START + deductionRows.length - 1;
  const TOTAL_DEDUCTIONS_ROW = DEDUCTIONS_END + 1;
  const NET_PAY_ROW = TOTAL_DEDUCTIONS_ROW + 2;

  const DTR_DATA_START = 4;
  const dtrRows = emp.dtr.length;
  const dtrTotalsR = DTR_DATA_START + dtrRows;
  const sigHeaderR = dtrTotalsR + 1;
  const sigLabelsR = dtrTotalsR + 3;
  const totalRows = Math.max(NET_PAY_ROW + 3, sigLabelsR + 2);

  // Pre-calculate DTR totals
  const totalHrs = emp.dtr.reduce((s, d) => s + d.totalHrs, 0);
  const totalOt = emp.dtr.reduce((s, d) => s + d.otHrs, 0);
  const totalTardHr = emp.dtr.reduce((s, d) => s + d.tardinessHr, 0);
  const totalTardMin = emp.dtr.reduce((s, d) => s + d.tardinessMin, 0);
  const totalAbsences = emp.dtr.reduce((s, d) => s + d.absences, 0);

  // ── Build grid ──
  const grid: (string | number | null)[][] = Array.from(
    { length: totalRows }, () => Array(25).fill(null)
  );

  // R0: title banners
  grid[0][0] = "NexHRIS";
  grid[0][9] = "COMPUTATION OF INDIVIDUAL OVERTIME PAY & ALLOWANCES";

  // R1: subtitles
  grid[1][0] = "PAYSLIP RECORD";
  grid[1][9] = "DAILY TIME RECORD (DTR)";

  // R3: PAY PERIOD bar + DTR column headers
  grid[3][1] = "PAY PERIOD";
  grid[3][4] = emp.periodFrom + " – " + emp.periodTo;
  grid[3][5] = "RANGE";
  grid[3][7] = emp.range;

  grid[3][9] = "Date";
  grid[3][10] = "Day";
  grid[3][11] = "Time In";
  grid[3][12] = "Time Out";
  grid[3][13] = "Total Hrs";
  grid[3][14] = "OT / UT Hrs";
  grid[3][15] = "Tardiness Hr";
  grid[3][16] = "Tardiness Min";
  grid[3][17] = "Absences (Days)";
  grid[3][18] = "Reg. OT\n(up to 8hrs / excess)";
  grid[3][20] = "Sat/Sun & Spl. Holiday\n(up to 8hrs / excess)";
  grid[3][22] = "Reg. Holiday\n(up to 8hrs / excess)";
  grid[3][24] = "Night Diff";

  // R6: EMPLOYEE INFORMATION header
  grid[EMP_INFO_START][1] = "EMPLOYEE INFORMATION";

  // R7-R10: Employee fields
  grid[7][1] = "Employee No."; grid[7][4] = emp.id;
  grid[7][5] = "Monthly Salary"; grid[7][7] = emp.monthlySalary;
  grid[8][1] = "Full Name"; grid[8][4] = emp.name;
  grid[8][5] = "Daily Rate"; grid[8][7] = emp.dailyRate;
  grid[9][1] = "Position"; grid[9][4] = emp.position;
  grid[9][5] = "Hourly Rate"; grid[9][7] = emp.hourlyRate;
  grid[10][1] = "Project"; grid[10][4] = emp.project;
  grid[10][5] = "Semi-Monthly Pay"; grid[10][7] = emp.semiMonthlySalary;
  grid[11][1] = "Civil Status"; grid[11][4] = "";
  grid[12][1] = "No. of Dependents"; grid[12][4] = "";
  grid[12][5] = "Gross Pay"; grid[12][7] = emp.totalBasicSalary;

  // ALLOWANCES header
  grid[ALLOWANCES_HEADER][1] = "ALLOWANCES";

  // Dynamic allowance rows
  for (let i = 0; i < allowanceRows.length; i++) {
    grid[ALLOWANCES_START + i][1] = allowanceRows[i].label;
    grid[ALLOWANCES_START + i][7] = allowanceRows[i].amount;
  }
  // Overtime row
  grid[ALLOWANCES_END][1] = "Overtime Pay";
  grid[ALLOWANCES_END][7] = emp.overtimePay;

  // TOTAL ALLOWANCES
  const totalAllowances = allowanceRows.reduce((s, a) => s + a.amount, 0) + emp.overtimePay;
  grid[TOTAL_ALLOWANCES_ROW][1] = "TOTAL ALLOWANCES";
  grid[TOTAL_ALLOWANCES_ROW][7] = totalAllowances;

  // DEDUCTIONS header
  grid[DEDUCTIONS_HEADER][1] = "DEDUCTIONS";

  // Dynamic deduction rows (gov + custom)
  for (let i = 0; i < deductionRows.length; i++) {
    grid[DEDUCTIONS_START + i][1] = deductionRows[i].label;
    grid[DEDUCTIONS_START + i][7] = deductionRows[i].amount;
  }

  // TOTAL DEDUCTIONS
  grid[TOTAL_DEDUCTIONS_ROW][1] = "TOTAL DEDUCTIONS";
  grid[TOTAL_DEDUCTIONS_ROW][7] = emp.totalDeductions;

  // NET PAY
  grid[NET_PAY_ROW][1] = "NET PAY";
  grid[NET_PAY_ROW][7] = emp.netPay;

  // ── DTR rows (right side) ──
  for (let i = 0; i < dtrRows; i++) {
    const r = DTR_DATA_START + i;
    if (r >= totalRows) break;
    const d = emp.dtr[i];
    grid[r][9] = d.date;
    grid[r][10] = d.day;
    grid[r][11] = d.timeIn;
    grid[r][12] = d.timeOut;
    grid[r][13] = d.totalHrs;
    grid[r][14] = d.otHrs;
    grid[r][15] = d.tardinessHr;
    grid[r][16] = d.tardinessMin;
    grid[r][17] = d.absences;
  }

  // DTR totals row
  grid[dtrTotalsR][9] = "TOTALS";
  grid[dtrTotalsR][13] = totalHrs;
  grid[dtrTotalsR][14] = totalOt;
  grid[dtrTotalsR][15] = totalTardHr;
  grid[dtrTotalsR][16] = totalTardMin;
  grid[dtrTotalsR][17] = totalAbsences;

  // Signatories
  grid[sigHeaderR][9] = "SIGNATORIES";
  grid[sigLabelsR][9] = "Prepared by";
  grid[sigLabelsR][13] = "Checked by";
  grid[sigLabelsR][17] = "Approved by";
  grid[sigLabelsR][21] = "Received by (Employee)";

  // ── Convert to worksheet ──
  const ws = XLSX.utils.aoa_to_sheet(grid);

  // ── MERGES ──
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 0, c: 9 }, e: { r: 0, c: 24 } },
    { s: { r: 1, c: 9 }, e: { r: 1, c: 24 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 3 } },
    { s: { r: 3, c: 4 }, e: { r: 3, c: 4 } },
    { s: { r: 3, c: 5 }, e: { r: 3, c: 6 } },
    { s: { r: 3, c: 7 }, e: { r: 3, c: 7 } },
    { s: { r: 3, c: 18 }, e: { r: 3, c: 19 } },
    { s: { r: 3, c: 20 }, e: { r: 3, c: 21 } },
    { s: { r: 3, c: 22 }, e: { r: 3, c: 23 } },
    { s: { r: EMP_INFO_START, c: 1 }, e: { r: EMP_INFO_START, c: 7 } },
    ...[7, 8, 9, 10].flatMap(r => [
      { s: { r, c: 1 }, e: { r, c: 3 } },
      { s: { r, c: 5 }, e: { r, c: 6 } },
    ]),
    ...[11, 12].map(r => ({ s: { r, c: 1 }, e: { r, c: 3 } })),
    { s: { r: 12, c: 5 }, e: { r: 12, c: 6 } },
    { s: { r: ALLOWANCES_HEADER, c: 1 }, e: { r: ALLOWANCES_HEADER, c: 7 } },
    ...Array.from({ length: allowanceRows.length + 1 }, (_, i) => ({ s: { r: ALLOWANCES_START + i, c: 1 }, e: { r: ALLOWANCES_START + i, c: 6 } })),
    { s: { r: TOTAL_ALLOWANCES_ROW, c: 1 }, e: { r: TOTAL_ALLOWANCES_ROW, c: 6 } },
    { s: { r: DEDUCTIONS_HEADER, c: 1 }, e: { r: DEDUCTIONS_HEADER, c: 7 } },
    ...Array.from({ length: deductionRows.length }, (_, i) => ({ s: { r: DEDUCTIONS_START + i, c: 1 }, e: { r: DEDUCTIONS_START + i, c: 6 } })),
    { s: { r: TOTAL_DEDUCTIONS_ROW, c: 1 }, e: { r: TOTAL_DEDUCTIONS_ROW, c: 6 } },
    { s: { r: NET_PAY_ROW, c: 1 }, e: { r: NET_PAY_ROW, c: 6 } },
    { s: { r: sigHeaderR, c: 9 }, e: { r: sigHeaderR, c: 24 } },
    { s: { r: sigLabelsR, c: 9 }, e: { r: sigLabelsR, c: 12 } },
    { s: { r: sigLabelsR, c: 13 }, e: { r: sigLabelsR, c: 16 } },
    { s: { r: sigLabelsR, c: 17 }, e: { r: sigLabelsR, c: 20 } },
    { s: { r: sigLabelsR, c: 21 }, e: { r: sigLabelsR, c: 24 } },
  ];

  // ── COLUMN WIDTHS ──
  ws["!cols"] = [
    { wch: 2 }, { wch: 20 }, { wch: 6 }, { wch: 4 }, { wch: 16 }, { wch: 16 }, { wch: 4 }, { wch: 14 }, { wch: 4 },
    { wch: 11.9 }, { wch: 6 }, { wch: 8.5 }, { wch: 8.5 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 11 },
    { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 6 }, { wch: 12 }, { wch: 7.5 }, { wch: 9 },
  ];

  // ── ROW HEIGHTS ──
  ws["!rows"] = Array.from({ length: totalRows }, (_, i) => {
    if (i === 0) return { hpt: 27.75 };
    if (i === 1) return { hpt: 18 };
    if (i === 3) return { hpt: 30 };
    return { hpt: 15.75 };
  });

  // ═══ STYLES ════════════════
  const TEAL = "65B2B2";
  const DK_GRAY = "333333";
  const LT_GRAY = "F2F2F2";
  const NAVY = "1F3864";
  const WHITE = "FFFFFF";
  const TXT = "595959";

  const thinBorder = {
    top: { style: "thin", color: { rgb: "D9D9D9" } },
    bottom: { style: "thin", color: { rgb: "D9D9D9" } },
    left: { style: "thin", color: { rgb: "D9D9D9" } },
    right: { style: "thin", color: { rgb: "D9D9D9" } },
  };

  const tealBanner = { font: { name: "Arial", sz: 14, bold: true, color: { rgb: WHITE } }, fill: { patternType: "solid", fgColor: { rgb: TEAL } }, alignment: { horizontal: "center", vertical: "center" } };
  const subtitleLeft = { font: { name: "Arial", sz: 10, italic: true, color: { rgb: "AAAAAA" } }, fill: { patternType: "solid", fgColor: { rgb: WHITE } }, alignment: { horizontal: "center", vertical: "center" } };
  const subtitleRight = { font: { name: "Arial", sz: 10, bold: true, color: { rgb: WHITE } }, fill: { patternType: "solid", fgColor: { rgb: TEAL } }, alignment: { horizontal: "center", vertical: "center" }, border: thinBorder };
  const dkGrayHdr = { font: { name: "Arial", sz: 9, bold: true, color: { rgb: WHITE } }, fill: { patternType: "solid", fgColor: { rgb: DK_GRAY } }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: "thin", color: { rgb: WHITE } }, bottom: { style: "thin", color: { rgb: WHITE } }, left: { style: "thin", color: { rgb: WHITE } }, right: { style: "thin", color: { rgb: WHITE } } } };
  const tealSection = { font: { name: "Arial", sz: 10, bold: true, color: { rgb: WHITE } }, fill: { patternType: "solid", fgColor: { rgb: TEAL } }, alignment: { horizontal: "left", vertical: "center" }, border: thinBorder };
  const whiteRow = { font: { name: "Arial", sz: 10, color: { rgb: TXT } }, fill: { patternType: "solid", fgColor: { rgb: WHITE } }, alignment: { vertical: "center" }, border: thinBorder };
  const ltGrayRow = { font: { name: "Arial", sz: 10, color: { rgb: TXT } }, fill: { patternType: "solid", fgColor: { rgb: LT_GRAY } }, alignment: { vertical: "center" }, border: thinBorder };
  const netPayStyle = { font: { name: "Arial", sz: 12, bold: true, color: { rgb: NAVY } }, fill: { patternType: "solid", fgColor: { rgb: WHITE } }, alignment: { vertical: "center" }, border: thinBorder };
  const dtrLtGray = { font: { name: "Arial", sz: 9, color: { rgb: TXT } }, fill: { patternType: "solid", fgColor: { rgb: LT_GRAY } }, alignment: { horizontal: "center", vertical: "center" }, border: thinBorder };
  const dtrWhite = { font: { name: "Arial", sz: 9, color: { rgb: TXT } }, fill: { patternType: "solid", fgColor: { rgb: WHITE } }, alignment: { horizontal: "center", vertical: "center" }, border: thinBorder };
  const navyHdr = { font: { name: "Arial", sz: 10, bold: true, color: { rgb: WHITE } }, fill: { patternType: "solid", fgColor: { rgb: NAVY } }, alignment: { horizontal: "center", vertical: "center" }, border: thinBorder };
  const sigLabel = { font: { name: "Arial", sz: 8, bold: true, color: { rgb: TXT } }, alignment: { horizontal: "center", vertical: "center" } };

  interface StyledCell {
    s?: Record<string, unknown>;
    v?: unknown;
    z?: string;
  }

  const styleRange = (r1: number, c1: number, r2: number, c2: number, s: Record<string, unknown>) => {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "z", v: null };
        (ws[addr] as StyledCell).s = { ...(ws[addr] as StyledCell).s, ...s };
      }
    }
  };

  // Apply styles
  styleRange(0, 0, totalRows - 1, 0, { fill: { patternType: "solid", fgColor: { rgb: WHITE } } });
  styleRange(0, 8, totalRows - 1, 8, { fill: { patternType: "solid", fgColor: { rgb: WHITE } } });
  styleRange(0, 0, 0, 7, tealBanner);
  styleRange(0, 9, 0, 24, tealBanner);
  styleRange(1, 0, 1, 7, subtitleLeft);
  styleRange(1, 9, 1, 24, subtitleRight);
  styleRange(3, 1, 3, 7, dkGrayHdr);
  styleRange(3, 9, 3, 24, dkGrayHdr);
  styleRange(EMP_INFO_START, 1, EMP_INFO_START, 7, tealSection);

  const empRowStyles = [whiteRow, ltGrayRow, whiteRow, ltGrayRow];
  empRowStyles.forEach((s, i) => styleRange(7 + i, 1, 7 + i, 7, s));
  styleRange(11, 1, 11, 4, whiteRow);
  styleRange(12, 1, 12, 4, ltGrayRow);
  styleRange(12, 5, 12, 7, ltGrayRow);

  // Allowances section styles
  styleRange(ALLOWANCES_HEADER, 1, ALLOWANCES_HEADER, 7, tealSection);
  for (let i = 0; i <= allowanceRows.length; i++) {
    styleRange(ALLOWANCES_START + i, 1, ALLOWANCES_START + i, 7, i % 2 === 0 ? whiteRow : ltGrayRow);
  }
  styleRange(TOTAL_ALLOWANCES_ROW, 1, TOTAL_ALLOWANCES_ROW, 7, tealSection);

  // Deductions section styles
  styleRange(DEDUCTIONS_HEADER, 1, DEDUCTIONS_HEADER, 7, tealSection);
  for (let i = 0; i < deductionRows.length; i++) {
    styleRange(DEDUCTIONS_START + i, 1, DEDUCTIONS_START + i, 7, i % 2 === 0 ? ltGrayRow : whiteRow);
  }
  styleRange(TOTAL_DEDUCTIONS_ROW, 1, TOTAL_DEDUCTIONS_ROW, 7, tealSection);
  styleRange(NET_PAY_ROW, 1, NET_PAY_ROW, 7, netPayStyle);

  // Right-align monetary values in col H
  for (let r = 7; r <= NET_PAY_ROW; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 7 });
    if (ws[addr] && typeof (ws[addr] as StyledCell).v === "number") {
      (ws[addr] as StyledCell).s = { ...(ws[addr] as StyledCell).s, alignment: { horizontal: "right", vertical: "center" } };
    }
  }

  // DTR data rows
  for (let i = 0; i < dtrRows; i++) {
    const r = DTR_DATA_START + i;
    if (r >= totalRows) break;
    styleRange(r, 9, r, 24, i % 2 === 0 ? dtrLtGray : dtrWhite);
  }
  styleRange(dtrTotalsR, 9, dtrTotalsR, 24, navyHdr);
  styleRange(sigHeaderR, 9, sigHeaderR, 24, navyHdr);
  styleRange(sigLabelsR, 9, sigLabelsR, 12, sigLabel);
  styleRange(sigLabelsR, 13, sigLabelsR, 16, sigLabel);
  styleRange(sigLabelsR, 17, sigLabelsR, 20, sigLabel);
  styleRange(sigLabelsR, 21, sigLabelsR, 24, sigLabel);

  // Currency format
  for (let r = 0; r < totalRows; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 7 });
    if (ws[addr] && typeof (ws[addr] as StyledCell).v === "number") {
      (ws[addr] as StyledCell).z = "₱#,##0.00";
    }
  }

  ws["!freeze"] = { xSplit: 9, ySplit: 4 };

  // Imported payroll → prepend an amber "Imported Payroll" banner row.
  // Done as a post-process shift so the normal (non-imported) layout is byte-for-byte unchanged.
  if (emp.imported) {
    prependImportedBanner(ws, emp.importedFileName);
  }

  return ws;
}

/**
 * Shifts an existing worksheet down by one row and inserts a full-width amber
 * "Imported Payroll" banner at the top. Only used for imported payslips.
 */
function prependImportedBanner(ws: XLSX.WorkSheet, fileName?: string) {
  const AMBER = "F59E0B";
  const WHITE = "FFFFFF";
  const MAX_COL = 24;

  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);

  // 1. Move every cell down one row (iterate from the bottom up to avoid clobber)
  for (let r = range.e.r; r >= range.s.r; r--) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const from = XLSX.utils.encode_cell({ r, c });
      const to = XLSX.utils.encode_cell({ r: r + 1, c });
      if (ws[from]) {
        ws[to] = ws[from];
        delete ws[from];
      } else {
        delete ws[to];
      }
    }
  }

  // 2. Banner cell at row 0
  const bannerText = `Imported Payroll${fileName ? ` — ${fileName}` : ""}`;
  ws["A1"] = {
    t: "s",
    v: bannerText,
    s: {
      font: { name: "Arial", sz: 12, bold: true, color: { rgb: WHITE } },
      fill: { patternType: "solid", fgColor: { rgb: AMBER } },
      alignment: { horizontal: "center", vertical: "center" },
    },
  };

  // 3. Shift existing merges down + add the banner merge
  const merges = (ws["!merges"] as XLSX.Range[] | undefined) ?? [];
  const shifted = merges.map((m) => ({
    s: { r: m.s.r + 1, c: m.s.c },
    e: { r: m.e.r + 1, c: m.e.c },
  }));
  shifted.unshift({ s: { r: 0, c: 0 }, e: { r: 0, c: MAX_COL } });
  ws["!merges"] = shifted;

  // 4. Shift row heights down + add banner row height
  const rows = (ws["!rows"] as XLSX.RowInfo[] | undefined) ?? [];
  ws["!rows"] = [{ hpt: 22 }, ...rows];

  // 5. Expand the ref + nudge the freeze down one row
  range.e.r += 1;
  ws["!ref"] = XLSX.utils.encode_range(range);
  if (ws["!freeze"]) {
    (ws["!freeze"] as { xSplit: number; ySplit: number }).ySplit += 1;
  }
}





// ─── PDF Generation (browser-based via print window) ──────────

function generatePayrollPDF(employees: EmployeePayrollData[], filename: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("Please allow popups to export as PDF.");
    return;
  }

  const pagesHtml = employees.map((emp) => {
    const dtrRows = emp.dtr.map((d) => `
      <tr>
        <td>${d.date}</td>
        <td>${d.day}</td>
        <td>${d.timeIn}</td>
        <td>${d.timeOut}</td>
        <td class="num">${d.totalHrs || ""}</td>
        <td class="num">${d.otHrs || ""}</td>
        <td class="num">${d.tardinessHr || ""}</td>
        <td class="num">${d.tardinessMin || ""}</td>
        <td class="num">${d.absences || ""}</td>
      </tr>
    `).join("");

    const totalHrs = emp.dtr.reduce((s, d) => s + d.totalHrs, 0);
    const totalOt = emp.dtr.reduce((s, d) => s + d.otHrs, 0);
    const totalTardHr = emp.dtr.reduce((s, d) => s + d.tardinessHr, 0);
    const totalTardMin = emp.dtr.reduce((s, d) => s + d.tardinessMin, 0);
    const totalAbsences = emp.dtr.reduce((s, d) => s + d.absences, 0);

    const fmt = (n: number) => n ? `₱ ${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—";

    return `
      <div class="page">
        ${emp.imported ? `<div class="imported-banner">Imported Payroll${emp.importedFileName ? ` — ${emp.importedFileName}` : ""}</div>` : ""}
        <div class="header">
          <h2>PAYROLL SLIP</h2>
          <p class="company">NexHRIS</p>
        </div>

        <div class="two-col">
          <!-- LEFT: Payslip -->
          <div class="left">
            <div class="section-title">PAY PERIOD: ${emp.periodFrom} – ${emp.periodTo} &nbsp;&nbsp; (${emp.range})</div>

            <table class="info-table">
              <tr><td class="label">Employee No.</td><td>${emp.id}</td><td class="label">Monthly Salary</td><td class="num">${fmt(emp.monthlySalary)}</td></tr>
              <tr><td class="label">Full Name</td><td>${emp.name}</td><td class="label">Daily Rate</td><td class="num">${fmt(emp.dailyRate)}</td></tr>
              <tr><td class="label">Position</td><td>${emp.position}</td><td class="label">Hourly Rate</td><td class="num">${fmt(emp.hourlyRate)}</td></tr>
              <tr><td class="label">Project</td><td>${emp.project}</td><td class="label">Semi-Monthly Pay</td><td class="num">${fmt(emp.semiMonthlySalary)}</td></tr>
              <tr><td class="label"></td><td></td><td class="label">Gross Pay</td><td class="num">${fmt(emp.totalBasicSalary)}</td></tr>
            </table>

            <div class="section-title">ALLOWANCES</div>
            <table class="detail-table">
              ${emp.allowanceItems.map(a => `<tr><td>${a.label}</td><td class="num">${fmt(a.amount)}</td></tr>`).join("")}
              <tr><td>Overtime Pay</td><td class="num">${fmt(emp.overtimePay)}</td></tr>
              <tr class="total-row"><td><strong>TOTAL ALLOWANCES</strong></td><td class="num"><strong>${fmt(emp.allowanceItems.reduce((s, a) => s + a.amount, 0) + emp.overtimePay)}</strong></td></tr>
            </table>

            <div class="section-title">DEDUCTIONS</div>
            <table class="detail-table">
              <tr><td>Withholding Tax</td><td class="num">${fmt(emp.withholdingTax)}</td></tr>
              <tr><td>SSS Contribution</td><td class="num">${fmt(emp.sssContribution)}</td></tr>
              <tr><td>PhilHealth Contribution</td><td class="num">${fmt(emp.philhealthContribution)}</td></tr>
              <tr><td>Pag-IBIG Contribution</td><td class="num">${fmt(emp.pagibigContribution)}</td></tr>
              ${emp.deductionItems.map(d => `<tr><td>${d.label}</td><td class="num">${fmt(d.amount)}</td></tr>`).join("")}
              ${emp.sssSalaryLoan > 0 ? `<tr><td>Loan Deduction</td><td class="num">${fmt(emp.sssSalaryLoan)}</td></tr>` : ""}
              ${emp.pagibigLoan > 0 ? `<tr><td>Pag-IBIG Loan</td><td class="num">${fmt(emp.pagibigLoan)}</td></tr>` : ""}
              ${emp.tardinessUndertime > 0 ? `<tr><td>Tardiness / Undertime</td><td class="num">${fmt(emp.tardinessUndertime)}</td></tr>` : ""}
              <tr class="total-row"><td><strong>TOTAL DEDUCTIONS</strong></td><td class="num"><strong>${fmt(emp.totalDeductions)}</strong></td></tr>
            </table>

            <table class="detail-table net-pay">
              <tr class="total-row"><td><strong>NET PAY</strong></td><td class="num"><strong>${fmt(emp.netPay)}</strong></td></tr>
            </table>
          </div>

          <!-- RIGHT: DTR -->
          <div class="right">
            <div class="section-title">DAILY TIME RECORD (DTR)</div>
            <table class="dtr-table">
              <thead>
                <tr>
                  <th>Date</th><th>Day</th><th>In</th><th>Out</th>
                  <th>Hrs</th><th>OT</th><th>Tard Hr</th><th>Tard Min</th><th>Abs</th>
                </tr>
              </thead>
              <tbody>
                ${dtrRows}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="4"><strong>TOTALS</strong></td>
                  <td class="num"><strong>${totalHrs.toFixed(1)}</strong></td>
                  <td class="num"><strong>${totalOt.toFixed(1)}</strong></td>
                  <td class="num"><strong>${totalTardHr}</strong></td>
                  <td class="num"><strong>${totalTardMin}</strong></td>
                  <td class="num"><strong>${totalAbsences}</strong></td>
                </tr>
              </tfoot>
            </table>
            ${emp.dtrFromImport ? `<p class="dtr-note">Attendance data sourced from imported file — not recorded in system</p>` : ""}
          </div>
        </div>

        <div class="signatories">
          <div class="sig-block"><div class="sig-line"></div><p>Prepared by</p></div>
          <div class="sig-block"><div class="sig-line"></div><p>Checked by</p></div>
          <div class="sig-block"><div class="sig-line"></div><p>Approved by</p></div>
          <div class="sig-block"><div class="sig-line"></div><p>Received by (Employee)</p></div>
        </div>
      </div>
    `;
  }).join("");

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${filename}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; color: #222; }
    .page { page-break-after: always; padding: 12mm 10mm; }
    .page:last-child { page-break-after: auto; }
    .imported-banner { background: #f59e0b; color: #fff; font-weight: 700; font-size: 11px; text-align: center; padding: 6px 8px; margin-bottom: 8px; border-radius: 3px; letter-spacing: 0.03em; }
    .dtr-note { font-size: 7px; color: #b45309; font-style: italic; margin-top: 4px; }
    .header { text-align: center; margin-bottom: 8px; }
    .header h2 { font-size: 14px; font-weight: 700; }
    .header .company { font-size: 11px; color: #555; }
    .two-col { display: flex; gap: 12px; }
    .left { flex: 1; min-width: 0; }
    .right { flex: 1.1; min-width: 0; }
    .section-title { font-weight: 700; font-size: 9px; margin: 6px 0 3px; padding: 2px 4px; background: #f0f0f0; border: 1px solid #ccc; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .info-table td { padding: 2px 4px; border: 1px solid #ddd; font-size: 8.5px; }
    .info-table .label { font-weight: 600; width: 28%; background: #fafafa; }
    .detail-table { width: 100%; border-collapse: collapse; }
    .detail-table td { padding: 1.5px 4px; border-bottom: 1px solid #eee; font-size: 8.5px; }
    .detail-table .num { text-align: right; font-variant-numeric: tabular-nums; }
    .detail-table .total-row td { border-top: 1.5px solid #333; border-bottom: 1.5px solid #333; background: #f8f8f8; }
    .net-pay { margin-top: 4px; }
    .net-pay .total-row td { background: #e8f5e9; font-size: 10px; }
    .dtr-table { width: 100%; border-collapse: collapse; font-size: 7.5px; }
    .dtr-table th { background: #f0f0f0; border: 1px solid #ccc; padding: 2px 2px; text-align: center; font-size: 7px; }
    .dtr-table td { border: 1px solid #eee; padding: 1.5px 2px; text-align: center; }
    .dtr-table .num { text-align: right; }
    .dtr-table .total-row td { border-top: 1.5px solid #333; background: #f8f8f8; font-weight: 700; }
    .signatories { display: flex; justify-content: space-between; margin-top: 16px; padding-top: 8px; }
    .sig-block { text-align: center; flex: 1; }
    .sig-line { border-bottom: 1px solid #333; margin: 0 8px 4px; height: 24px; }
    .sig-block p { font-size: 7.5px; color: #555; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 8mm 6mm; }
    }
  </style>
</head>
<body>
  ${pagesHtml}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>`);
  printWindow.document.close();
}

// ─── DTR from imported payslip (Part 3) ───────────────────────
// For imported payslips, DTR is sourced from the payslip record (receipt only),
// never from attendance_logs. Uses per-day rows if the file provided them,
// otherwise renders blank per-day rows and relies on the TOTALS row built from
// the imported summary fields.
function buildDtrFromPayslip(
  payslip: Payslip,
  periodFrom: string,
  periodTo: string
): EmployeePayrollData["dtr"] {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const perDay = payslip.dtrPerDayJson;

  // Case 1 — file provided per-day rows
  if (Array.isArray(perDay) && perDay.length > 0) {
    return perDay.map((r) => {
      let dayLabel = r.day || "";
      let dateLabel = r.date || "";
      const parsed = r.date ? new Date(r.date) : null;
      if (parsed && !isNaN(parsed.getTime())) {
        dayLabel = dayLabel || dayNames[parsed.getDay()];
        dateLabel = format(parsed, "MMM dd");
      }
      return {
        date: dateLabel,
        day: dayLabel,
        timeIn: r.timeIn ? formatTo12hr(r.timeIn) : "",
        timeOut: r.timeOut ? formatTo12hr(r.timeOut) : "",
        totalHrs: r.totalHrs ?? 0,
        otHrs: r.otHrs ?? 0,
        tardinessHr: r.tardinessHr ?? 0,
        tardinessMin: r.tardinessMin ?? 0,
        absences: r.absences ?? 0,
      };
    });
  }

  // Case 2 — only summary totals. Render one blank row per calendar day so the
  // grid keeps its shape; the TOTALS row downstream sums these (all zero), so we
  // fold the imported summary into a single synthetic "summary" row instead.
  const present = payslip.dtrDaysPresent ?? 0;
  const absent = payslip.dtrDaysAbsent ?? 0;
  const lateMin = payslip.dtrLateMinutes ?? 0;
  const otHrs = payslip.dtrOtHours ?? 0;
  const tardHrs = payslip.dtrTardHours ?? 0;
  const hasSummary = present || absent || lateMin || otHrs || tardHrs;
  if (!hasSummary) return [];

  // Single summary row carrying the imported totals.
  return [
    {
      date: `${periodFrom} – ${periodTo}`,
      day: "Summary",
      timeIn: "",
      timeOut: "",
      totalHrs: 0,
      otHrs,
      tardinessHr: Math.floor(tardHrs),
      tardinessMin: lateMin,
      absences: absent,
    },
  ];
}

// ─── Component ────────────────────────────────────────────────

export function PayrollExportDialog({ trigger }: PayrollExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("run");
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [range, setRange] = useState<PayrollRange>("first_half");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [selectedEmployees, setSelectedEmployees] = useState<SelectedEmployee[]>([]);
  const [runEmployeeId, setRunEmployeeId] = useState<string>("");
  const [selectedRunPayslipId, setSelectedRunPayslipId] = useState<string>("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] = useState<"xlsx" | "pdf" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allDepartments = useDepartmentsStore((s) => s.departments);
  const departments = useMemo(() => allDepartments.filter((d) => d.isActive), [allDepartments]);
  const employees = useEmployeesStore((s) => s.employees);
  const { payslips, runs } = usePayrollStore();
  const { logs: attendanceLogs, overtimeRequests } = useAttendanceStore();
const { templates: deductionTemplates, computeDeductionsForEmployee, fetchTemplates, fetchAssignments } = useDeductionsStore();

  const yearOptions = useMemo(() => {
    const curr = new Date().getFullYear();
    return [curr - 2, curr - 1, curr, curr + 1, curr + 2];
  }, []);

  const filteredEmployees = useMemo(() => {
    let pool = employees.filter((e) => e.status === "active");
    if (departmentId) {
      const dept = departments.find((d) => d.id === departmentId);
      if (dept) pool = pool.filter((e) => e.department === dept.name);
    }
    if (employeeSearch.trim()) {
      const q = employeeSearch.toLowerCase();
      pool = pool.filter((e) => e.name.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q));
    }
    const selectedIds = new Set(selectedEmployees.map((s) => s.id));
    return pool.filter((e) => !selectedIds.has(e.id));
  }, [employees, departmentId, departments, employeeSearch, selectedEmployees]);

  const isDeptDisabled = selectedEmployees.length > 0;

  useEffect(() => {
    if (!open) {
      setExportMode("run");
      setMonth(new Date().getMonth());
      setYear(new Date().getFullYear());
      setRange("first_half");
      setDepartmentId("");
      setSelectedEmployees([]);
      setRunEmployeeId("");
      setSelectedRunPayslipId("");
      setEmployeeSearch("");
      setErrors({});
      setLoading(false);
      setExportType(null);
    }
  }, [open]);
  
  
  useEffect(() => {
  if (open) {
    fetchTemplates();
    fetchAssignments();
  }
}, [open, fetchTemplates, fetchAssignments]);

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (exportMode === "run") {
      if (!runEmployeeId) errs.filter = "Select an employee.";
      else if (!selectedRunPayslipId) errs.filter = "Select a payroll run.";
    } else if (!departmentId && selectedEmployees.length === 0) {
      errs.filter = "Select at least a department or one employee.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [departmentId, selectedEmployees, exportMode, runEmployeeId, selectedRunPayslipId]);

  const getPeriodDates = useCallback(() => {
    const daysInMonth = getDaysInMonth(new Date(year, month));
    if (range === "first_half") {
      return {
        periodFrom: `${year}-${String(month + 1).padStart(2, "0")}-01`,
        periodTo: `${year}-${String(month + 1).padStart(2, "0")}-15`,
      };
    } else if (range === "second_half") {
      return {
        periodFrom: `${year}-${String(month + 1).padStart(2, "0")}-16`,
        periodTo: `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`,
      };
    }
    return {
      periodFrom: `${year}-${String(month + 1).padStart(2, "0")}-01`,
      periodTo: `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`,
    };
  }, [year, month, range]);

  const getTargetEmployees = useCallback(() => {
    if (selectedEmployees.length > 0) {
      return employees.filter((e) => selectedEmployees.some((s) => s.id === e.id));
    }
    if (departmentId) {
      const dept = departments.find((d) => d.id === departmentId);
      if (dept) return employees.filter((e) => e.status === "active" && e.department === dept.name);
    }
    return [];
  }, [selectedEmployees, departmentId, employees, departments]);

  const buildFilename = useCallback((ext: string) => {
    const monthName = MONTHS[month];
    const rangeLabel = range === "first_half" ? "FirstHalf" : range === "second_half" ? "SecondHalf" : "FullMonth";
    if (departmentId && selectedEmployees.length === 0) {
      const dept = departments.find((d) => d.id === departmentId);
      return `Payroll_${dept?.name || "Dept"}_${monthName}_${year}_${rangeLabel}.${ext}`;
    }
    if (selectedEmployees.length > 0 && selectedEmployees.length <= 3) {
      const names = selectedEmployees.map((e) => e.name.split(" ").pop()).join("_");
      return `Payroll_${names}_${monthName}_${year}_${rangeLabel}.${ext}`;
    }
    if (selectedEmployees.length > 3) {
      return `Payroll_${selectedEmployees.length}Employees_${monthName}_${year}_${rangeLabel}.${ext}`;
    }
    return `Payroll_${monthName}_${year}_${rangeLabel}.${ext}`;
  }, [month, year, range, departmentId, departments, selectedEmployees]);

  const getDTRForEmployee = useCallback((employeeId: string, periodFrom: string, periodTo: string) => {
    const logs = attendanceLogs.filter((l) => l.employeeId === employeeId && l.date >= periodFrom && l.date <= periodTo);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const start = new Date(periodFrom);
    const end = new Date(periodTo);
    const dtrEntries: EmployeePayrollData["dtr"] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = format(d, "yyyy-MM-dd");
      const dayName = dayNames[d.getDay()];
      const log = logs.find((l) => l.date === dateStr);

      if (log) {
        const lateMin = log.lateMinutes ?? 0;
        const rawHrs = log.hours ?? 0;
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

        // PB-style calculation:
        // Weekdays: count from 8:00 AM (ignore early clock-in) to OUT, minus 1hr lunch
        // Weekends/holidays: count from actual IN to OUT, minus 1hr lunch if > 5hrs
        let totalHrs: number;
        if (!isWeekend && log.checkIn && log.checkOut) {
          // Parse check-out time to compute hours from 8:00
          const outParts = (log.checkOut.includes("T") ? log.checkOut.split("T")[1]?.split(".")[0] || "" : log.checkOut).split(":");
          const outDecimal = Number(outParts[0] || 0) + Number(outParts[1] || 0) / 60;
          const scheduledStart = 8.0; // 8:00 AM
          const hrsFromSchedule = outDecimal - scheduledStart;
          // Deduct 1hr lunch
          totalHrs = Math.round((hrsFromSchedule - 1) * 100) / 100;
          if (totalHrs < 0) totalHrs = 0;
        } else {
          // Weekends: use raw hours minus 1hr lunch if worked > 5hrs
          const lunchDeduction = rawHrs > 5 ? 1 : 0;
          totalHrs = Math.round((rawHrs - lunchDeduction) * 100) / 100;
        }

        // OT: first check approved OT requests, then compute as hours > 8
        const approvedOT = overtimeRequests
          .filter(r => r.employeeId === employeeId && r.date === dateStr && r.status === "approved")
          .reduce((sum, r) => sum + (r.hoursRequested || 0), 0);
        const computedOT = totalHrs > 8 ? Math.round((totalHrs - 8) * 100) / 100 : 0;
        dtrEntries.push({
          date: format(d, "MMM dd"),
          day: dayName,
          timeIn: log.checkIn ? formatTo12hr(log.checkIn) : "",
          timeOut: log.checkOut ? formatTo12hr(log.checkOut) : "",
          totalHrs,
          otHrs: approvedOT > 0 ? approvedOT : computedOT,
          tardinessHr: Math.floor(lateMin / 60),
          tardinessMin: lateMin % 60,
          absences: log.status === "absent" ? 1 : 0,
        });
      } else {
                const absentOtHrs = overtimeRequests
            .filter(r => r.employeeId === employeeId && r.date === dateStr && r.status === "approved")
            .reduce((sum, r) => sum + (r.hoursRequested || 0), 0);
            dtrEntries.push({
            date: format(d, "MMM dd"),
            day: dayName,
            timeIn: "",
            timeOut: "",
            totalHrs: 0,
            otHrs: absentOtHrs,
            tardinessHr: 0,
            tardinessMin: 0,
            absences: d.getDay() !== 0 && d.getDay() !== 6 ? 1 : 0,
        });
      }
    }
    return dtrEntries;
  }, [attendanceLogs]);

  const runPayslipOptions = useMemo(() => {
    if (!runEmployeeId) return [];
    return payslips
      .filter((p) => {
        if (p.employeeId !== runEmployeeId) return false;
        const associatedRun = runs.find((r) => r.id === p.payrollBatchId);
        return associatedRun?.status === "completed";
      })
      .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
      .map((p) => ({
        id: p.id,
        label: `${p.periodStart} to ${p.periodEnd} (${String(p.payFrequency || "").replace(/_/g, "-") || "period"})`,
        source: p.source === "imported" || p.computedExternally ? "Imported" : "System",
      }));
  }, [payslips, runs, runEmployeeId]);

  const runEmployeeOptions = useMemo(() =>
    employees
      .filter((e) => e.status === "active")
      .map((e) => ({
        value: e.id,
        label: `${e.name}${e.department ? ` — ${e.department}` : ""}${e.email ? ` (${e.email})` : ""}`,
      })),
  [employees]);

  useEffect(() => {
    if (!runEmployeeId) {
      setSelectedRunPayslipId("");
      return;
    }
    if (!runPayslipOptions.some((opt) => opt.id === selectedRunPayslipId)) {
      setSelectedRunPayslipId("");
    }
  }, [runEmployeeId, runPayslipOptions, selectedRunPayslipId]);

  // Build all employee data for export
  const buildEmployeeData = useCallback((): EmployeePayrollData[] => {
    const targetEmployees = getTargetEmployees();
    const { periodFrom, periodTo } = getPeriodDates();
    const rangeLabel = range === "first_half" ? "First Half" : range === "second_half" ? "Second Half" : "Full Month";

    return targetEmployees.map((emp) => {
      const payslip = payslips.find((p) =>
        p.employeeId === emp.id && p.periodStart <= periodTo && p.periodEnd >= periodFrom
      );

      // ── Imported payroll branch (Part 3) ─────────────────────────────────
      // For imported payslips, DTR comes from the payslip record (receipt only),
      // NOT from attendance_logs. Normal payslips are unchanged.
      const isImported = payslip?.source === "imported" || payslip?.computedExternally === true;

      // For imported payslips, use rates from the payslip record (from the original file).
      // For normal payslips, derive from the employee's current salary.
      const baseSalary = emp.salary ?? 0;

      // Try to get monthly salary from notes (imported payslips store "Monthly: X" in notes)
      let importedMonthlySalary = 0;
      if (payslip?.notes) {
        const monthlyMatch = payslip.notes.match(/Monthly:\s*([\d,]+(?:\.\d+)?)/);
        if (monthlyMatch) {
          importedMonthlySalary = Number(monthlyMatch[1].replace(/,/g, "")) || 0;
        }
      }

      const monthlySalary = (payslip?.dailyRate && payslip.dailyRate > 0)
        ? (importedMonthlySalary > 0 ? importedMonthlySalary : Math.round(baseSalary * 100) / 100)
        : baseSalary;
      const dailyRate = (payslip?.dailyRate && payslip.dailyRate > 0)
        ? payslip.dailyRate
        : Math.round((baseSalary / 22) * 100) / 100;
      const hourlyRate = (payslip?.hourlyRate && payslip.hourlyRate > 0)
        ? payslip.hourlyRate
        : Math.round((dailyRate / 8) * 100) / 100;
      const semiMonthlySalary = Math.round((monthlySalary / 2) * 100) / 100;

      const dtr = isImported
        ? buildDtrFromPayslip(payslip!, isImported && payslip?.periodStart ? payslip.periodStart : periodFrom, isImported && payslip?.periodEnd ? payslip.periodEnd : periodTo)
        : (payslip?.dtrPerDayJson && payslip.dtrPerDayJson.length > 0)
          ? buildDtrFromPayslip(payslip, payslip.periodStart || periodFrom, payslip.periodEnd || periodTo)
          : getDTRForEmployee(emp.id, periodFrom, periodTo);

      // ── Dynamic line items from payslip ──────────────────────────────────
      // lineItemsJson holds custom deduction-template items (allowances + deductions).
      // If the payslip was issued before lineItemsJson was saved (older payslips),
      // fall back to computing them live from the deductions store.
      // For imported payslips: ONLY use what's on the payslip record — never compute
      // from the deduction templates, since the imported file is the source of truth.
      const lineItems = payslip?.lineItemsJson;
      let customAllowanceItems: { label: string; amount: number }[];
      let customDeductionItems: { label: string; amount: number }[];

      if (lineItems && lineItems.length > 0) {
        // Payslip has stored line items — use them directly
        customAllowanceItems = lineItems
          .filter((li) => li.type === "earning")
          .map((li) => ({ label: li.label, amount: li.amount }));
        customDeductionItems = lineItems
          .filter((li) => li.type === "deduction")
          .map((li) => ({ label: li.label, amount: li.amount }));
      } else if (isImported) {
        // Imported payslip without line items — don't compute from templates.
        // The imported file's figures are final; system deductions don't apply.
        customAllowanceItems = [];
        customDeductionItems = [];
      } else {
        // Fallback: compute live from the deductions store (covers older payslips)
        const workDays = emp.workDays?.length
          ? Math.round(emp.workDays.length * (22 / 5))
          : 22;
        const liveItems = emp.deductionExempt
          ? []
          : computeDeductionsForEmployee(emp.id, emp.salary ?? 0, workDays);
        customAllowanceItems = liveItems
          .filter((item) => deductionTemplates.find((t) => t.id === item.templateId)?.type === "allowance")
          .map((item) => ({ label: item.label, amount: item.amount }));
        customDeductionItems = liveItems
          .filter((item) => deductionTemplates.find((t) => t.id === item.templateId)?.type === "deduction")
          .map((item) => ({ label: item.label, amount: item.amount }));
      }

      // Build allowanceItems — custom allowances only (no base salary row per the template)
      const allowanceItems = [...customAllowanceItems];

      // ── Approved OT for this period ───────────────────────────────────────
      // If the payslip has an overtimePay snapshot, use it.
      // Otherwise sum approved OT requests for the period as a fallback.
      let overtimePay = payslip ? Number(payslip.overtimePay ?? 0) : 0;
      if (overtimePay === 0) {
        const approvedOT = overtimeRequests.filter(
          (r) =>
            r.employeeId === emp.id &&
            r.status === "approved" &&
            r.date >= periodFrom &&
            r.date <= periodTo
        );
        const approvedOTHours = approvedOT.reduce((sum, r) => sum + (r.hoursRequested || 0), 0);
        if (approvedOTHours > 0) {
          const hrRate = Math.round(dailyRate / 8);
          overtimePay = Math.round(approvedOTHours * hrRate * 1.25);
        }
      }

      const loanDeductions = payslip
        ? useLoansStore.getState().getAllDeductions().filter((d) => d.payslipId === payslip.id)
        : [];

      const itemizedLoans = loanDeductions.map((d) => {
        const loan = useLoansStore.getState().loans.find((l) => l.id === d.loanId);
        let label = "Loan Deduction";
        if (loan) {
          if (loan.type === "cash_advance") {
            label = "Cash Advance";
          } else if (loan.type === "salary_loan") {
            label = "Company Loan";
          } else if (loan.type === "government_loan" || loan.type === "sss" || loan.type === "pagibig") {
            let agencyLabel = (loan.agency || loan.type || "").toUpperCase();
            if (agencyLabel === "PAGIBIG") {
              agencyLabel = "Pag-IBIG";
            }
            let subType = "Loan";
            if (loan.loanType === "salary_loan" || loan.loanType === "salary") {
              subType = "Salary Loan";
            } else if (loan.loanType === "calamity_loan" || loan.loanType === "calamity") {
              subType = "Calamity Loan";
            } else if (loan.loanType === "mpl") {
              subType = "Multi-Purpose Loan";
            } else if (loan.loanType) {
              subType = `${loan.loanType.charAt(0).toUpperCase()}${loan.loanType.slice(1)} Loan`;
            }
            label = agencyLabel ? `${agencyLabel} ${subType}` : subType;
          } else {
            label = loan.remarks || "Loan";
          }
        }
        return { label, amount: d.amount };
      });

      const deductionItems = [
        ...customDeductionItems,
        ...itemizedLoans,
        // Only show "Custom Deductions" lump sum if no individual line items exist
        ...(customDeductionItems.length === 0 && payslip && Number(payslip.customDeductions ?? 0) > 0
          ? [{ label: "Custom Deductions", amount: Number(payslip.customDeductions ?? 0) }]
          : []),
        ...(payslip && Number(payslip.otherDeductions ?? 0) > 0
          ? [{ label: "Other Deductions", amount: Number(payslip.otherDeductions ?? 0) }]
          : []),
      ];

      return {
        id: emp.id,
        name: emp.name,
        position: emp.jobTitle || "",
        project: emp.department || "",
        department: emp.department || "",
        monthlySalary,
        dailyRate,
        hourlyRate,
        semiMonthlySalary,
        periodFrom: isImported && payslip?.periodStart
          ? format(new Date(payslip.periodStart), "MMM dd, yyyy")
          : format(new Date(periodFrom), "MMM dd, yyyy"),
        periodTo: isImported && payslip?.periodEnd
          ? format(new Date(payslip.periodEnd), "MMM dd, yyyy")
          : format(new Date(periodTo), "MMM dd, yyyy"),
        range: isImported && payslip?.periodStart
          ? `Imported (${payslip.periodStart} to ${payslip.periodEnd})`
          : rangeLabel,
        overtimePay,
        totalBasicSalary: payslip ? Number(payslip.grossPay ?? semiMonthlySalary) : semiMonthlySalary,
        allowanceItems,
        deductionItems,
        withholdingTax: payslip ? Number(payslip.taxDeduction ?? 0) : 0,
        sssContribution: payslip ? Number(payslip.sssDeduction ?? 0) : 0,
        sssSalaryLoan: payslip && itemizedLoans.length === 0 ? Number(payslip.loanDeduction ?? 0) : 0,
        philhealthContribution: payslip ? Number(payslip.philhealthDeduction ?? 0) : 0,
        pagibigContribution: payslip ? Number(payslip.pagibigDeduction ?? 0) : 0,
        pagibigLoan: 0,
        leaveWithoutPay: 0,
       tardinessUndertime: payslip ? Number(payslip.lateDeduction ?? 0) + Number(payslip.undertimeDeduction ?? 0) + Number(payslip.absentDeduction ?? 0) : 0,
        totalDeductions: payslip
        ? Number(payslip.sssDeduction ?? 0) + Number(payslip.philhealthDeduction ?? 0) +
          Number(payslip.pagibigDeduction ?? 0) + Number(payslip.taxDeduction ?? 0) +
          Number(payslip.loanDeduction ?? 0) + Number(payslip.otherDeductions ?? 0) +
          Number(payslip.customDeductions ?? 0) + Number(payslip.absentDeduction ?? 0) +
          Number(payslip.lateDeduction ?? 0) + Number(payslip.undertimeDeduction ?? 0)
        : 0,
        netPay: payslip ? Number(payslip.netPay ?? 0) : semiMonthlySalary,
        dtr,
        imported: isImported,
        importedFileName: payslip?.importedFileName ?? undefined,
        dtrFromImport: isImported,
      };
    });
  }, [getTargetEmployees, getPeriodDates, range, payslips, getDTRForEmployee, overtimeRequests, computeDeductionsForEmployee, deductionTemplates]);

  const buildEmployeeDataByRun = useCallback((): EmployeePayrollData[] => {
    if (!runEmployeeId || !selectedRunPayslipId) return [];
    const emp = employees.find((e) => e.id === runEmployeeId);
    const payslip = payslips.find((p) => p.id === selectedRunPayslipId && p.employeeId === runEmployeeId);
    if (!emp || !payslip) return [];

    const isImported = payslip.source === "imported" || payslip.computedExternally === true;
    const baseSalary = emp.salary ?? 0;
    let importedMonthlySalary = 0;
    if (payslip.notes) {
      const monthlyMatch = payslip.notes.match(/Monthly:\s*([\d,]+(?:\.\d+)?)/);
      if (monthlyMatch) importedMonthlySalary = Number(monthlyMatch[1].replace(/,/g, "")) || 0;
    }
    const monthlySalary = (payslip.dailyRate && payslip.dailyRate > 0)
      ? (importedMonthlySalary > 0 ? importedMonthlySalary : Math.round(baseSalary * 100) / 100)
      : baseSalary;
    const dailyRate = (payslip.dailyRate && payslip.dailyRate > 0)
      ? payslip.dailyRate
      : Math.round((baseSalary / 22) * 100) / 100;
    const hourlyRate = (payslip.hourlyRate && payslip.hourlyRate > 0)
      ? payslip.hourlyRate
      : Math.round((dailyRate / 8) * 100) / 100;
    const semiMonthlySalary = Math.round((monthlySalary / 2) * 100) / 100;

    const dtr = isImported
      ? buildDtrFromPayslip(payslip, payslip.periodStart || "", payslip.periodEnd || "")
      : (payslip.dtrPerDayJson && payslip.dtrPerDayJson.length > 0)
        ? buildDtrFromPayslip(payslip, payslip.periodStart, payslip.periodEnd)
        : getDTRForEmployee(emp.id, payslip.periodStart, payslip.periodEnd);

    const lineItems = payslip.lineItemsJson;
    let customAllowanceItems: { label: string; amount: number }[] = [];
    let customDeductionItems: { label: string; amount: number }[] = [];
    if (lineItems && lineItems.length > 0) {
      customAllowanceItems = lineItems.filter((li) => li.type === "earning").map((li) => ({ label: li.label, amount: li.amount }));
      customDeductionItems = lineItems.filter((li) => li.type === "deduction").map((li) => ({ label: li.label, amount: li.amount }));
    }
    const loanDeductions = useLoansStore.getState().getAllDeductions().filter((d) => d.payslipId === payslip.id);
    const itemizedLoans = loanDeductions.map((d) => {
      const loan = useLoansStore.getState().loans.find((l) => l.id === d.loanId);
      let label = "Loan Deduction";
      if (loan) {
        if (loan.type === "cash_advance") {
          label = "Cash Advance";
        } else if (loan.type === "salary_loan") {
          label = "Company Loan";
        } else if (loan.type === "government_loan" || loan.type === "sss" || loan.type === "pagibig") {
          let agencyLabel = (loan.agency || loan.type || "").toUpperCase();
          if (agencyLabel === "PAGIBIG") {
            agencyLabel = "Pag-IBIG";
          }
          let subType = "Loan";
          if (loan.loanType === "salary_loan" || loan.loanType === "salary") {
            subType = "Salary Loan";
          } else if (loan.loanType === "calamity_loan" || loan.loanType === "calamity") {
            subType = "Calamity Loan";
          } else if (loan.loanType === "mpl") {
            subType = "Multi-Purpose Loan";
          } else if (loan.loanType) {
            subType = `${loan.loanType.charAt(0).toUpperCase()}${loan.loanType.slice(1)} Loan`;
          }
          label = agencyLabel ? `${agencyLabel} ${subType}` : subType;
        } else {
          label = loan.remarks || "Loan";
        }
      }
      return { label, amount: d.amount };
    });

    const deductionItems = [
      ...customDeductionItems,
      ...itemizedLoans,
      // Only show "Custom Deductions" as a lump sum if there are no individual line items
      ...(customDeductionItems.length === 0 && Number(payslip.customDeductions ?? 0) > 0
        ? [{ label: "Custom Deductions", amount: Number(payslip.customDeductions ?? 0) }]
        : []),
      ...(Number(payslip.otherDeductions ?? 0) > 0
        ? [{ label: "Other Deductions", amount: Number(payslip.otherDeductions ?? 0) }]
        : []),
    ];

    // Total deductions: use individual line items when available to avoid double-counting
    const customDedForTotal = customDeductionItems.length > 0
      ? customDeductionItems.reduce((s, i) => s + i.amount, 0)
      : Number(payslip.customDeductions ?? 0);

    return [{
      id: emp.id,
      name: emp.name,
      position: emp.jobTitle || "",
      project: emp.department || "",
      department: emp.department || "",
      monthlySalary,
      dailyRate,
      hourlyRate,
      semiMonthlySalary,
      periodFrom: format(new Date(payslip.periodStart), "MMM dd, yyyy"),
      periodTo: format(new Date(payslip.periodEnd), "MMM dd, yyyy"),
      range: `${String(payslip.payFrequency || "period").replace(/_/g, "-")} (${payslip.periodStart} to ${payslip.periodEnd})`,
      overtimePay: Number(payslip.overtimePay ?? 0),
      totalBasicSalary: Number(payslip.grossPay ?? semiMonthlySalary),
      allowanceItems: customAllowanceItems,
      deductionItems,
      withholdingTax: Number(payslip.taxDeduction ?? 0),
      sssContribution: Number(payslip.sssDeduction ?? 0),
      sssSalaryLoan: itemizedLoans.length === 0 ? Number(payslip.loanDeduction ?? 0) : 0,
      philhealthContribution: Number(payslip.philhealthDeduction ?? 0),
      pagibigContribution: Number(payslip.pagibigDeduction ?? 0),
      pagibigLoan: 0,
      leaveWithoutPay: 0,
      tardinessUndertime: Number(payslip.lateDeduction ?? 0) + Number(payslip.undertimeDeduction ?? 0) + Number(payslip.absentDeduction ?? 0),
      totalDeductions: Number(payslip.sssDeduction ?? 0) + Number(payslip.philhealthDeduction ?? 0) +
        Number(payslip.pagibigDeduction ?? 0) + Number(payslip.taxDeduction ?? 0) +
        Number(payslip.loanDeduction ?? 0) + Number(payslip.otherDeductions ?? 0) +
        customDedForTotal + Number(payslip.absentDeduction ?? 0) +
        Number(payslip.lateDeduction ?? 0) + Number(payslip.undertimeDeduction ?? 0),
      netPay: Number(payslip.netPay ?? 0),
      dtr,
      imported: isImported,
      importedFileName: payslip.importedFileName ?? undefined,
      dtrFromImport: isImported,
    }];
  }, [employees, payslips, runEmployeeId, selectedRunPayslipId, getDTRForEmployee]);

  const handleExport = useCallback(async (type: "xlsx" | "pdf") => {
    if (!validate()) return;

    setLoading(true);
    setExportType(type);

    try {
      const employeeData = exportMode === "run" ? buildEmployeeDataByRun() : buildEmployeeData();
      if (employeeData.length === 0) {
        toast.error("No employees found for the selected filters.");
        setLoading(false);
        setExportType(null);
        return;
      }

      if (type === "pdf") {
        // Open print window with formatted payslip pages
        generatePayrollPDF(employeeData, buildFilename("pdf"));
        toast.success(`Opened ${employeeData.length} payslip(s) for PDF export — use Print > Save as PDF`);
      } else {
        // XLSX with template layout
        const wb = XLSX.utils.book_new();

        for (const emp of employeeData) {
          const ws = buildTemplateSheet(emp);
          let sheetName = emp.name.slice(0, 31);
          if (wb.SheetNames.includes(sheetName)) {
            sheetName = `${emp.name.slice(0, 24)} (${emp.id.slice(-5)})`;
          }
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        const blob = new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = buildFilename("xlsx");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Exported ${employeeData.length} employee payslip(s) as XLSX`);
      }
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
      setExportType(null);
    }
  }, [validate, buildEmployeeData, buildEmployeeDataByRun, buildFilename, exportMode]);

  const handleAddEmployee = (emp: { id: string; name: string; department?: string }) => {
    setSelectedEmployees((prev) => [...prev, { id: emp.id, name: emp.name, department: emp.department }]);
    setEmployeeSearch("");
    setShowDropdown(false);
  };

  const handleRemoveEmployee = (id: string) => {
    setSelectedEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export Payroll</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Export Payroll (PB Template)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              <FileSpreadsheet className="inline h-3 w-3 mr-1 -mt-px" />
              Generates one sheet per employee matching the PB payslip template — Employee Info &amp; Earnings on the left, DTR on the right.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Export Mode</label>
            <Select value={exportMode} onValueChange={(v) => setExportMode(v as ExportMode)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="run">By Payroll Run (recommended)</SelectItem>
                <SelectItem value="period">By Period (legacy)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {exportMode === "run" ? (
            <>
              <div>
                <label className="text-sm font-medium">Employee</label>
                <div className="mt-1">
                  <SearchableSelect
                    value={runEmployeeId}
                    onValueChange={(v) => { setRunEmployeeId(v); setErrors({}); }}
                    options={runEmployeeOptions}
                    placeholder="Select employee"
                    searchPlaceholder="Search employee..."
                    className="w-full"
                    popoverWidth="w-[420px]"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Payroll Run</label>
                <Select
                  value={selectedRunPayslipId}
                  onValueChange={(v) => { setSelectedRunPayslipId(v); setErrors({}); }}
                  disabled={!runEmployeeId}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder={runEmployeeId ? "Select payroll run" : "Select employee first"} /></SelectTrigger>
                  <SelectContent>
                    {runPayslipOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label} • {opt.source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Month</label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Year</label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Pay Period Range</label>
            <Select value={range} onValueChange={(v) => setRange(v as PayrollRange)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Department</label>
            <Select
              value={departmentId}
              onValueChange={(v) => { setDepartmentId(v === "__all__" ? "" : v); setErrors({}); }}
              disabled={isDeptDisabled}
            >
              <SelectTrigger className={`mt-1 ${isDeptDisabled ? "opacity-50" : ""}`}>
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      {d.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isDeptDisabled && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Department locked — clear employee tags to change.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">Employees</label>
            <div className="mt-1 relative">
              <div className="flex flex-wrap gap-1.5 p-2 min-h-[38px] rounded-md border border-input bg-background">
                {selectedEmployees.map((emp) => (
                  <Badge key={emp.id} variant="secondary" className="gap-1 text-xs pr-1">
                    {emp.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmployee(emp.id)}
                      className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  placeholder={selectedEmployees.length === 0 ? "Search employees..." : "Add more..."}
                  value={employeeSearch}
                  onChange={(e) => { setEmployeeSearch(e.target.value); setShowDropdown(true); setErrors({}); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  className="border-0 shadow-none p-0 h-6 flex-1 min-w-[120px] focus-visible:ring-0"
                />
              </div>

              {showDropdown && employeeSearch.trim() && filteredEmployees.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-md max-h-[200px] overflow-y-auto">
                  {filteredEmployees.slice(0, 10).map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleAddEmployee({ id: emp.id, name: emp.name, department: emp.department })}
                    >
                      <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{emp.name}</p>
                        {emp.department && <p className="text-[10px] text-muted-foreground">{emp.department}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && employeeSearch.trim() && filteredEmployees.length === 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-md p-3">
                  <p className="text-xs text-muted-foreground text-center">No employees found</p>
                </div>
              )}
            </div>
          </div>
            </>
          )}

          {errors.filter && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {errors.filter}
            </div>
          )}

          <div className="rounded-lg border border-border/50 p-3 space-y-1.5">
            <p className="text-xs font-medium">Export includes per employee sheet:</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• Employee Information (ID, Name, Position, Salary rates)</li>
              <li>• Earnings breakdown (Basic, OT, Allowances)</li>
              <li>• Government &amp; loan deductions</li>
              <li>• Daily Time Record (DTR) with hours &amp; tardiness</li>
              <li>• Net Pay computation &amp; Signatories</li>
            </ul>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleExport("pdf")}
              disabled={loading}
              className="flex-1 gap-1.5"
            >
              {loading && exportType === "pdf" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Exporting...</>
              ) : (
                <><FileText className="h-4 w-4" /> Export PDF</>
              )}
            </Button>
            <Button
              onClick={() => handleExport("xlsx")}
              disabled={loading}
              className="flex-1 gap-1.5"
            >
              {loading && exportType === "xlsx" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Exporting...</>
              ) : (
                <><FileSpreadsheet className="h-4 w-4" /> Export XLSX</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}