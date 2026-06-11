"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useDepartmentsStore } from "@/store/departments.store";
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
import { Download, FileSpreadsheet, FileText, Loader2, X, Users, Building2, AlertCircle, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { format, getDaysInMonth, eachDayOfInterval } from "date-fns";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────

type DateRange = "first_half" | "second_half" | "full_month" | "custom";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "first_half", label: "First Half (1st – 15th)" },
  { value: "second_half", label: "Second Half (16th – End)" },
  { value: "full_month", label: "Full Month" },
  { value: "custom", label: "Custom Date Range" },
];

/** Convert "HH:mm" or "HH:mm:ss" or ISO timestamp to "h:mm AM/PM" format */
function formatTimeTo12hr(time: string): string {
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

interface SelectedEmployee {
  id: string;
  name: string;
  department?: string;
}

interface AttendanceExportDialogProps {
  trigger?: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────

export function AttendanceExportDialog({ trigger }: AttendanceExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [dateRange, setDateRange] = useState<DateRange>("full_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
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
  const { logs: attendanceLogs } = useAttendanceStore();

  // Year range: current year ± 2
  const yearOptions = useMemo(() => {
    const curr = new Date().getFullYear();
    return [curr - 2, curr - 1, curr, curr + 1, curr + 2];
  }, []);

  // Filter employees
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

  // Reset on close
  useEffect(() => {
    if (!open) {
      setMonth(new Date().getMonth());
      setYear(new Date().getFullYear());
      setDateRange("full_month");
      setCustomFrom("");
      setCustomTo("");
      setDepartmentId("");
      setSelectedEmployees([]);
      setEmployeeSearch("");
      setErrors({});
      setLoading(false);
      setExportType(null);
    }
  }, [open]);

  // Validate
  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!departmentId && selectedEmployees.length === 0) {
      errs.filter = "Select at least a department or one employee.";
    }
    if (dateRange === "custom" && (!customFrom || !customTo)) {
      errs.date = "Please provide both from and to dates.";
    }
    if (dateRange === "custom" && customFrom && customTo && customFrom > customTo) {
      errs.date = "From date must be before To date.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [departmentId, selectedEmployees, dateRange, customFrom, customTo]);

  // Compute period dates
  const getPeriodDates = useCallback(() => {
    if (dateRange === "custom") {
      return { periodFrom: customFrom, periodTo: customTo };
    }

    const daysInMonth = getDaysInMonth(new Date(year, month));
    const monthStr = String(month + 1).padStart(2, "0");

    if (dateRange === "first_half") {
      return { periodFrom: `${year}-${monthStr}-01`, periodTo: `${year}-${monthStr}-15` };
    } else if (dateRange === "second_half") {
      return { periodFrom: `${year}-${monthStr}-16`, periodTo: `${year}-${monthStr}-${daysInMonth}` };
    }
    return { periodFrom: `${year}-${monthStr}-01`, periodTo: `${year}-${monthStr}-${daysInMonth}` };
  }, [year, month, dateRange, customFrom, customTo]);

  // Get target employees
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

  // Build filename
  const buildFilename = useCallback((ext: string) => {
    const monthName = MONTHS[month];
    const rangeLabel = dateRange === "first_half" ? "FirstHalf" :
      dateRange === "second_half" ? "SecondHalf" :
      dateRange === "full_month" ? "FullMonth" : "Custom";

    if (departmentId && selectedEmployees.length === 0) {
      const dept = departments.find((d) => d.id === departmentId);
      return `Attendance_${dept?.name || "Dept"}_${monthName}_${year}_${rangeLabel}.${ext}`;
    }
    if (selectedEmployees.length > 0 && selectedEmployees.length <= 3) {
      const names = selectedEmployees.map((e) => e.name.split(" ").pop()).join("_");
      return `Attendance_${names}_${monthName}_${year}_${rangeLabel}.${ext}`;
    }
    if (selectedEmployees.length > 3) {
      return `Attendance_${selectedEmployees.length}Employees_${monthName}_${year}_${rangeLabel}.${ext}`;
    }
    return `Attendance_${monthName}_${year}_${rangeLabel}.${ext}`;
  }, [month, year, dateRange, departmentId, departments, selectedEmployees]);

  // Export handler
  const handleExport = useCallback(async (type: "xlsx" | "pdf") => {
    if (!validate()) return;

    setLoading(true);
    setExportType(type);

    try {
      const targetEmployees = getTargetEmployees();
      if (targetEmployees.length === 0) {
        toast.error("No employees found for the selected filters.");
        setLoading(false);
        setExportType(null);
        return;
      }

      const { periodFrom, periodTo } = getPeriodDates();
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      // Build basic tabular data (no template, just clean rows)
      const allRows: Record<string, unknown>[] = [];

      for (const emp of targetEmployees) {
        // Get attendance logs for this employee in the date range
        const empLogs = attendanceLogs.filter(
          (l) => l.employeeId === emp.id && l.date >= periodFrom && l.date <= periodTo
        );

        // Generate all days in the range
        const start = new Date(periodFrom);
        const end = new Date(periodTo);
        const days = eachDayOfInterval({ start, end });

        for (const day of days) {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayName = dayNames[day.getDay()];
          const log = empLogs.find((l) => l.date === dateStr);

          allRows.push({
            "Employee Name": emp.name,
            "Employee ID": emp.id,
            "Department": emp.department || "",
            "Date": format(day, "MMM dd, yyyy"),
            "Day": dayName,
            "Time In": log?.checkIn ? formatTimeTo12hr(log.checkIn) : "",
            "Time Out": log?.checkOut ? formatTimeTo12hr(log.checkOut) : "",
            "Total Hours": log?.hours ?? 0,
            "OT Hours": log?.approvedOTHours ?? 0,
            "Late (min)": log?.lateMinutes ?? 0,
            "Status": log?.status || (day.getDay() === 0 || day.getDay() === 6 ? "rest_day" : "absent"),
            "Check-In Method": log?.checkInMethod || "",
            "Check-Out Method": log?.checkOutMethod || "",
          });
        }
      }

      if (allRows.length === 0) {
        toast.error("No attendance data found for the selected period.");
        setLoading(false);
        setExportType(null);
        return;
      }

      // Build workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(allRows);

      // Auto-size columns
      const headers = Object.keys(allRows[0]);
      ws["!cols"] = headers.map((h) => {
        let maxLen = h.length;
        for (const row of allRows.slice(0, 50)) { // Sample first 50 for perf
          const val = row[h];
          const len = val != null ? String(val).length : 0;
          if (len > maxLen) maxLen = len;
        }
        return { wch: Math.min(maxLen + 2, 30) };
      });

      XLSX.utils.book_append_sheet(wb, ws, "Attendance");

      // Also add a summary sheet
      const summaryRows: Record<string, unknown>[] = targetEmployees.map((emp) => {
        const empLogs = attendanceLogs.filter(
          (l) => l.employeeId === emp.id && l.date >= periodFrom && l.date <= periodTo
        );
        const totalPresent = empLogs.filter((l) => l.status === "present").length;
        const totalAbsent = empLogs.filter((l) => l.status === "absent").length;
        const totalHours = empLogs.reduce((s, l) => s + (l.hours ?? 0), 0);
        const totalLateMin = empLogs.reduce((s, l) => s + (l.lateMinutes ?? 0), 0);
        const totalOT = empLogs.reduce((s, l) => s + (l.approvedOTHours ?? 0), 0);

        return {
          "Employee Name": emp.name,
          "Employee ID": emp.id,
          "Department": emp.department || "",
          "Days Present": totalPresent,
          "Days Absent": totalAbsent,
          "Total Hours": Math.round(totalHours * 100) / 100,
          "Total Late (min)": totalLateMin,
          "Total OT Hours": Math.round(totalOT * 100) / 100,
        };
      });

      const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
      const summaryHeaders = Object.keys(summaryRows[0] || {});
      summaryWs["!cols"] = summaryHeaders.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      if (type === "xlsx") {
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
        toast.success(`Exported ${targetEmployees.length} employee attendance records as XLSX`);
      } else {
        // PDF: Open print window with HTML table
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
          toast.error("Please allow popups to export as PDF.");
          setLoading(false);
          setExportType(null);
          return;
        }

        // Build HTML table for print
        const tableHeaders = Object.keys(allRows[0]);
        const headerRow = tableHeaders.map((h) => `<th>${h}</th>`).join("");
        const bodyRows = allRows.map((row) =>
          `<tr>${tableHeaders.map((h) => `<td>${row[h] ?? ""}</td>`).join("")}</tr>`
        ).join("");

        // Summary table
        const summaryTableHeaders = Object.keys(summaryRows[0] || {});
        const summaryHeaderRow = summaryTableHeaders.map((h) => `<th>${h}</th>`).join("");
        const summaryBodyRows = summaryRows.map((row) =>
          `<tr>${summaryTableHeaders.map((h) => `<td>${row[h] ?? ""}</td>`).join("")}</tr>`
        ).join("");

        const { periodFrom: pf, periodTo: pt } = getPeriodDates();

        printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${buildFilename("pdf")}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; padding: 10mm; }
    h2 { font-size: 14px; margin-bottom: 4px; }
    .period { font-size: 10px; color: #555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f0f0f0; border: 1px solid #ccc; padding: 3px 4px; text-align: left; font-size: 8px; white-space: nowrap; }
    td { border: 1px solid #eee; padding: 2px 4px; font-size: 8px; }
    tr:nth-child(even) { background: #fafafa; }
    h3 { font-size: 11px; margin: 12px 0 4px; }
    @media print { body { padding: 5mm; } }
  </style>
</head>
<body>
  <h2>Attendance Report</h2>
  <p class="period">${pf} to ${pt}</p>
  <h3>Summary</h3>
  <table><thead><tr>${summaryHeaderRow}</tr></thead><tbody>${summaryBodyRows}</tbody></table>
  <h3>Daily Records</h3>
  <table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
</body>
</html>`);
        printWindow.document.close();
        toast.success(`Opened attendance report for PDF export — use Print > Save as PDF`);
      }
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
      setExportType(null);
    }
  }, [validate, getTargetEmployees, getPeriodDates, attendanceLogs, buildFilename]);

  // Add/remove employee tags
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
            <span className="hidden sm:inline">Export Attendance</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Export Attendance Records
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Info banner */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              <CalendarDays className="inline h-3 w-3 mr-1 -mt-px" />
              Exports daily attendance records with time in/out, hours, tardiness, and status. Includes a summary sheet with totals per employee.
            </p>
          </div>

          {/* Month + Year (shown when not custom) */}
          {dateRange !== "custom" && (
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
          )}

          {/* Date Range */}
          <div>
            <label className="text-sm font-medium">Date Range</label>
            <Select value={dateRange} onValueChange={(v) => { setDateRange(v as DateRange); setErrors({}); }}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DATE_RANGE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dateRange === "custom" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-xs text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => { setCustomFrom(e.target.value); setErrors({}); }}
                    className="w-full mt-0.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => { setCustomTo(e.target.value); setErrors({}); }}
                    className="w-full mt-0.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
            )}
            {errors.date && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.date}
              </p>
            )}
          </div>

          {/* Department */}
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

          {/* Employee search + tags */}
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

              {/* Search dropdown */}
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

          {/* Validation error */}
          {errors.filter && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {errors.filter}
            </div>
          )}

          {/* Export contents */}
          <div className="rounded-lg border border-border/50 p-3 space-y-1.5">
            <p className="text-xs font-medium">Export includes:</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              <li>• <strong>Attendance sheet</strong> — daily records per employee (date, day, in/out, hours, late, status)</li>
              <li>• <strong>Summary sheet</strong> — totals per employee (present days, absent, total hours, total late, OT)</li>
            </ul>
          </div>

          {/* Action buttons */}
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
