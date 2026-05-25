"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useDepartmentsStore } from "@/store/departments.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, Loader2, X, Users, Building2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format, getDaysInMonth } from "date-fns";
import * as XLSX from "xlsx";

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
  mealAllowance: number;
  projectAllowance: number;
  taxiFare: number;
  cola: number;
  othersAdjustment: number;
  totalBasicSalary: number;
  // Deductions
  withholdingTax: number;
  sssContribution: number;
  sssSalaryLoan: number;
  philhealthContribution: number;
  pagibigContribution: number;
  pagibigLoan: number;
  leaveWithoutPay: number;
  tardinessUndertime: number;
  taxDeficiency: number;
  communityTax: number;
  philhealthRefund: number;
  sssProvidentFund: number;
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
}

// ─── Build PB-template-matching XLSX sheet ────────────────────
// Matches the layout: Left side = payslip info, Right side = DTR + OT computation
// Uses the exact structure from the Payroll-Export-Template.xlsx

function buildTemplateSheet(emp: EmployeePayrollData): XLSX.WorkSheet {
  // We'll build a wide sheet: columns A-H for payslip, columns I-W for DTR/OT
  // Using AOA (array of arrays) approach for full control

  const dtrHeaderRow = 2; // DTR starts at row 3 (0-indexed row 2)
  const dtrDataStartRow = 3;

  // Pre-calculate DTR totals
  const totalHrs = emp.dtr.reduce((s, d) => s + d.totalHrs, 0);
  const totalOt = emp.dtr.reduce((s, d) => s + d.otHrs, 0);
  const totalTardHr = emp.dtr.reduce((s, d) => s + d.tardinessHr, 0);
  const totalTardMin = emp.dtr.reduce((s, d) => s + d.tardinessMin, 0);
  const totalAbsences = emp.dtr.reduce((s, d) => s + d.absences, 0);

  // Maximum rows needed
  const maxDtrRows = emp.dtr.length;
  const totalRows = Math.max(45, dtrDataStartRow + maxDtrRows + 5);

  // Initialize empty grid
  const grid: (string | number | null)[][] = Array.from({ length: totalRows }, () =>
    Array(23).fill(null)
  );

  // ═══ LEFT SIDE: PAYSLIP (Columns A-H, 0-7) ═══

  // Row 0: Header
  grid[0][1] = "COMPANY NAME";
  grid[0][9] = "COMPUTATION OF INDIVIDUAL OVERTIME PAY & ALLOWANCES";

  // Row 1: Sub-header
  grid[1][1] = "PAYSLIP RECORD";
  grid[1][9] = "DAILY TIME RECORD (DTR)";

  // Row 2: blank + DTR headers
  // DTR column headers (cols I onwards = index 8+)
  grid[2][9] = "Date";
  grid[2][10] = "Day";
  grid[2][11] = "Time In";
  grid[2][12] = "Time Out";
  grid[2][13] = "Total Hrs";
  grid[2][14] = "OT / UT Hrs";
  grid[2][15] = "Tardiness Hr";
  grid[2][16] = "Tardiness Min";
  grid[2][17] = "Absences (Days)";
  grid[2][18] = "Reg. OT";
  grid[2][19] = "Sat/Sun & Spl. Holiday";
  grid[2][20] = "Reg. Holiday";
  grid[2][21] = "Night Diff";

  // Row 3: PAY PERIOD
  grid[3][2] = "PAY PERIOD";
  grid[3][4] = emp.periodFrom + " - " + emp.periodTo;
  grid[3][6] = "RANGE";
  grid[3][7] = emp.range;

  // Row 5: EMPLOYEE INFORMATION
  grid[5][2] = "EMPLOYEE INFORMATION";

  // Row 6-11: Employee details
  grid[6][2] = "Employee No.";
  grid[6][4] = emp.id;
  grid[6][6] = "Monthly Salary";
  grid[6][7] = emp.monthlySalary;

  grid[7][2] = "Full Name";
  grid[7][4] = emp.name;
  grid[7][6] = "Daily Rate";
  grid[7][7] = emp.dailyRate;

  grid[8][2] = "Position";
  grid[8][4] = emp.position;
  grid[8][6] = "Hourly Rate";
  grid[8][7] = emp.hourlyRate;

  grid[9][2] = "Project";
  grid[9][4] = emp.project;
  grid[9][6] = "Semi-Monthly Pay";
  grid[9][7] = emp.semiMonthlySalary;

  // Row 12: EARNINGS
  grid[12][2] = "EARNINGS";

  grid[13][2] = "Semi-Monthly Basic Salary";
  grid[13][7] = emp.semiMonthlySalary;

  grid[14][2] = "Overtime Pay";
  grid[14][7] = emp.overtimePay;

  grid[15][2] = "Meal Allowance";
  grid[15][7] = emp.mealAllowance;

  grid[16][2] = "Project Allowance";
  grid[16][7] = emp.projectAllowance;

  grid[17][2] = "Taxi Fare";
  grid[17][7] = emp.taxiFare;

  grid[18][2] = "COLA";
  grid[18][7] = emp.cola;

  grid[19][2] = "Others / Adjustment";
  grid[19][7] = emp.othersAdjustment;

  grid[20][2] = "TOTAL BASIC SALARY";
  grid[20][7] = emp.totalBasicSalary;

  // Row 22: DEDUCTIONS
  grid[22][2] = "DEDUCTIONS";

  grid[23][2] = "Withholding Tax";
  grid[23][7] = emp.withholdingTax;

  grid[24][2] = "SSS Contribution";
  grid[24][7] = emp.sssContribution;

  grid[25][2] = "SSS Salary Loan";
  grid[25][7] = emp.sssSalaryLoan;

  grid[26][2] = "PhilHealth Contribution";
  grid[26][7] = emp.philhealthContribution;

  grid[27][2] = "Pag-IBIG Contribution";
  grid[27][7] = emp.pagibigContribution;

  grid[28][2] = "Pag-IBIG Loan";
  grid[28][7] = emp.pagibigLoan;

  grid[29][2] = "Leave w/o Pay";
  grid[29][7] = emp.leaveWithoutPay;

  grid[30][2] = "Tardiness / Undertime";
  grid[30][7] = emp.tardinessUndertime;

  grid[31][2] = "Tax Deficiency / Refund";
  grid[31][7] = emp.taxDeficiency;

  grid[32][2] = "Community Tax Cert.";
  grid[32][7] = emp.communityTax;

  grid[33][2] = "PhilHealth Refund";
  grid[33][7] = emp.philhealthRefund;

  grid[34][2] = "SSS Provident Fund";
  grid[34][7] = emp.sssProvidentFund;

  grid[35][2] = "TOTAL DEDUCTIONS";
  grid[35][7] = emp.totalDeductions;

  // Row 37: NET PAY
  grid[37][2] = "NET PAY";
  grid[37][7] = emp.netPay;

  // ═══ RIGHT SIDE: DTR DATA (starting row 3, columns I-V) ═══

  for (let i = 0; i < emp.dtr.length; i++) {
    const row = dtrDataStartRow + i;
    if (row >= totalRows) break;
    const d = emp.dtr[i];
    grid[row][9] = d.date;
    grid[row][10] = d.day;
    grid[row][11] = d.timeIn;
    grid[row][12] = d.timeOut;
    grid[row][13] = d.totalHrs;
    grid[row][14] = d.otHrs;
    grid[row][15] = d.tardinessHr;
    grid[row][16] = d.tardinessMin;
    grid[row][17] = d.absences;
  }

  // DTR TOTALS row
  const totalsRow = dtrDataStartRow + emp.dtr.length;
  if (totalsRow < totalRows) {
    grid[totalsRow][9] = "TOTALS";
    grid[totalsRow][13] = totalHrs;
    grid[totalsRow][14] = totalOt;
    grid[totalsRow][15] = totalTardHr;
    grid[totalsRow][16] = totalTardMin;
    grid[totalsRow][17] = totalAbsences;
  }

  // SIGNATORIES (below deductions or DTR totals, whichever is lower)
  const sigRow = Math.max(39, totalsRow + 2);
  if (sigRow < totalRows - 2) {
    grid[sigRow][2] = "SIGNATORIES";
    grid[sigRow + 2][2] = "Prepared by";
    grid[sigRow + 2][4] = "Checked by";
    grid[sigRow + 2][6] = "Approved by";
    grid[sigRow + 2][8] = "Received by (Employee)";
  }

  // Convert grid to worksheet
  const ws = XLSX.utils.aoa_to_sheet(grid);

  // Column widths matching the template
  ws["!cols"] = [
    { wch: 2 },   // A - spacer
    { wch: 4 },   // B - spacer
    { wch: 22 },  // C - labels
    { wch: 4 },   // D - spacer
    { wch: 20 },  // E - values
    { wch: 4 },   // F - spacer
    { wch: 16 },  // G - right labels
    { wch: 14 },  // H - right values
    { wch: 2 },   // I - spacer between sections
    { wch: 10 },  // J - Date
    { wch: 5 },   // K - Day
    { wch: 8 },   // L - Time In
    { wch: 8 },   // M - Time Out
    { wch: 8 },   // N - Total Hrs
    { wch: 9 },   // O - OT/UT Hrs
    { wch: 9 },   // P - Tardiness Hr
    { wch: 9 },   // Q - Tardiness Min
    { wch: 10 },  // R - Absences
    { wch: 8 },   // S - Reg OT
    { wch: 10 },  // T - Sat/Sun
    { wch: 10 },  // U - Reg Holiday
    { wch: 8 },   // V - Night Diff
  ];

  return ws;
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
        <div class="header">
          <h2>PAYROLL SLIP</h2>
          <p class="company">[COMPANY NAME]</p>
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
            </table>

            <div class="section-title">EARNINGS</div>
            <table class="detail-table">
              <tr><td>Semi-Monthly Basic Salary</td><td class="num">${fmt(emp.semiMonthlySalary)}</td></tr>
              <tr><td>Overtime Pay</td><td class="num">${fmt(emp.overtimePay)}</td></tr>
              <tr><td>Meal Allowance</td><td class="num">${fmt(emp.mealAllowance)}</td></tr>
              <tr><td>Project Allowance</td><td class="num">${fmt(emp.projectAllowance)}</td></tr>
              <tr><td>Taxi Fare</td><td class="num">${fmt(emp.taxiFare)}</td></tr>
              <tr><td>COLA</td><td class="num">${fmt(emp.cola)}</td></tr>
              <tr><td>Others / Adjustment</td><td class="num">${fmt(emp.othersAdjustment)}</td></tr>
              <tr class="total-row"><td><strong>TOTAL BASIC SALARY</strong></td><td class="num"><strong>${fmt(emp.totalBasicSalary)}</strong></td></tr>
            </table>

            <div class="section-title">DEDUCTIONS</div>
            <table class="detail-table">
              <tr><td>Withholding Tax</td><td class="num">${fmt(emp.withholdingTax)}</td></tr>
              <tr><td>SSS Contribution</td><td class="num">${fmt(emp.sssContribution)}</td></tr>
              <tr><td>SSS Salary Loan</td><td class="num">${fmt(emp.sssSalaryLoan)}</td></tr>
              <tr><td>PhilHealth Contribution</td><td class="num">${fmt(emp.philhealthContribution)}</td></tr>
              <tr><td>Pag-IBIG Contribution</td><td class="num">${fmt(emp.pagibigContribution)}</td></tr>
              <tr><td>Pag-IBIG Loan</td><td class="num">${fmt(emp.pagibigLoan)}</td></tr>
              <tr><td>Leave w/o Pay</td><td class="num">${fmt(emp.leaveWithoutPay)}</td></tr>
              <tr><td>Tardiness / Undertime</td><td class="num">${fmt(emp.tardinessUndertime)}</td></tr>
              <tr><td>Tax Deficiency / Refund</td><td class="num">${fmt(emp.taxDeficiency)}</td></tr>
              <tr><td>Community Tax Cert.</td><td class="num">${fmt(emp.communityTax)}</td></tr>
              <tr><td>PhilHealth Refund</td><td class="num">${fmt(emp.philhealthRefund)}</td></tr>
              <tr><td>SSS Provident Fund</td><td class="num">${fmt(emp.sssProvidentFund)}</td></tr>
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

// ─── Component ────────────────────────────────────────────────

export function PayrollExportDialog({ trigger }: PayrollExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [range, setRange] = useState<PayrollRange>("first_half");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [selectedEmployees, setSelectedEmployees] = useState<SelectedEmployee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] = useState<"xlsx" | "pdf" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allDepartments = useDepartmentsStore((s) => s.departments);
  const departments = useMemo(() => allDepartments.filter((d) => d.isActive), [allDepartments]);
  const employees = useEmployeesStore((s) => s.employees);
  const { payslips } = usePayrollStore();
  const { logs: attendanceLogs } = useAttendanceStore();

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
      setMonth(new Date().getMonth());
      setYear(new Date().getFullYear());
      setRange("first_half");
      setDepartmentId("");
      setSelectedEmployees([]);
      setEmployeeSearch("");
      setErrors({});
      setLoading(false);
      setExportType(null);
    }
  }, [open]);

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!departmentId && selectedEmployees.length === 0) {
      errs.filter = "Select at least a department or one employee.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [departmentId, selectedEmployees]);

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
        dtrEntries.push({
          date: format(d, "MMM dd"),
          day: dayName,
          timeIn: log.checkIn ? (log.checkIn.includes("T") ? log.checkIn.split("T")[1]?.split(".")[0]?.slice(0, 5) || "" : log.checkIn.slice(0, 5)) : "",
          timeOut: log.checkOut ? (log.checkOut.includes("T") ? log.checkOut.split("T")[1]?.split(".")[0]?.slice(0, 5) || "" : log.checkOut.slice(0, 5)) : "",
          totalHrs: log.hours ?? 0,
          otHrs: log.approvedOTHours ?? 0,
          tardinessHr: Math.floor(lateMin / 60),
          tardinessMin: lateMin % 60,
          absences: log.status === "absent" ? 1 : 0,
        });
      } else {
        dtrEntries.push({
          date: format(d, "MMM dd"),
          day: dayName,
          timeIn: "",
          timeOut: "",
          totalHrs: 0,
          otHrs: 0,
          tardinessHr: 0,
          tardinessMin: 0,
          absences: d.getDay() !== 0 && d.getDay() !== 6 ? 1 : 0,
        });
      }
    }
    return dtrEntries;
  }, [attendanceLogs]);

  // Build all employee data for export
  const buildEmployeeData = useCallback((): EmployeePayrollData[] => {
    const targetEmployees = getTargetEmployees();
    const { periodFrom, periodTo } = getPeriodDates();
    const rangeLabel = range === "first_half" ? "First Half" : range === "second_half" ? "Second Half" : "Full Month";

    return targetEmployees.map((emp) => {
      const payslip = payslips.find((p) =>
        p.employeeId === emp.id && p.periodStart <= periodTo && p.periodEnd >= periodFrom
      );
      const monthlySalary = emp.salary ?? 0;
      const dailyRate = Math.round((monthlySalary / 22) * 100) / 100;
      const hourlyRate = Math.round((dailyRate / 8) * 100) / 100;
      const semiMonthlySalary = Math.round((monthlySalary / 2) * 100) / 100;
      const dtr = getDTRForEmployee(emp.id, periodFrom, periodTo);

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
        periodFrom: format(new Date(periodFrom), "MMM dd, yyyy"),
        periodTo: format(new Date(periodTo), "MMM dd, yyyy"),
        range: rangeLabel,
        overtimePay: payslip ? Number(payslip.overtimePay ?? 0) : 0,
        mealAllowance: 0,
        projectAllowance: 0,
        taxiFare: 0,
        cola: 0,
        othersAdjustment: payslip ? Number(payslip.allowances ?? 0) : 0,
        totalBasicSalary: payslip ? Number(payslip.grossPay ?? 0) : semiMonthlySalary,
        withholdingTax: payslip ? Number(payslip.taxDeduction ?? 0) : 0,
        sssContribution: payslip ? Number(payslip.sssDeduction ?? 0) : 0,
        sssSalaryLoan: payslip ? Number(payslip.loanDeduction ?? 0) : 0,
        philhealthContribution: payslip ? Number(payslip.philhealthDeduction ?? 0) : 0,
        pagibigContribution: payslip ? Number(payslip.pagibigDeduction ?? 0) : 0,
        pagibigLoan: 0,
        leaveWithoutPay: 0,
        tardinessUndertime: payslip ? Number(payslip.lateDeduction ?? 0) : 0,
        taxDeficiency: 0,
        communityTax: 0,
        philhealthRefund: 0,
        sssProvidentFund: 0,
        totalDeductions: payslip
          ? Number(payslip.sssDeduction ?? 0) + Number(payslip.philhealthDeduction ?? 0) +
            Number(payslip.pagibigDeduction ?? 0) + Number(payslip.taxDeduction ?? 0) +
            Number(payslip.loanDeduction ?? 0) + Number(payslip.otherDeductions ?? 0) +
            Number(payslip.customDeductions ?? 0)
          : 0,
        netPay: payslip ? Number(payslip.netPay ?? 0) : semiMonthlySalary,
        dtr,
      };
    });
  }, [getTargetEmployees, getPeriodDates, range, payslips, getDTRForEmployee]);

  const handleExport = useCallback(async (type: "xlsx" | "pdf") => {
    if (!validate()) return;

    setLoading(true);
    setExportType(type);

    try {
      const employeeData = buildEmployeeData();
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
  }, [validate, buildEmployeeData, buildFilename]);

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
