"use client";

import { useState, useCallback } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { exportToFile, type ExportFormat } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, Loader2, Database } from "lucide-react";
import { toast } from "sonner";

type ExportModule = "payroll" | "attendance";
type RangePreset = "1m" | "3m" | "6m" | "12m" | "custom";

const RANGE_LABELS: Record<RangePreset, string> = {
  "1m": "Last 1 Month",
  "3m": "Last 3 Months",
  "6m": "Last 6 Months",
  "12m": "Last 12 Months",
  "custom": "Custom Range",
};

function getDateRange(preset: RangePreset, customFrom?: string, customTo?: string) {
  if (preset === "custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }
  const monthsMap: Record<string, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 };
  const months = monthsMap[preset] || 1;
  const now = new Date();
  const from = startOfMonth(subMonths(now, months));
  const to = endOfMonth(now);
  return {
    from: format(from, "yyyy-MM-dd"),
    to: format(to, "yyyy-MM-dd"),
  };
}

// ─── Payslip row formatter ────────────────────────────────────────────────────

function formatPayslipRow(p: Record<string, unknown>) {
  return {
    "Payslip ID": p.id,
    "Employee Name": p.employee_name || "",
    "Email": p.employee_email || "",
    "Department": p.employee_department || "",
    "Job Title": p.employee_job_title || "",
    "Period Start": p.period_start,
    "Period End": p.period_end,
    "Pay Frequency": p.pay_frequency,
    "Gross Pay": Number(p.gross_pay) || 0,
    "Allowances": Number(p.allowances) || 0,
    "Holiday Pay": Number(p.holiday_pay) || 0,
    "SSS": Number(p.sss_deduction) || 0,
    "PhilHealth": Number(p.philhealth_deduction) || 0,
    "Pag-IBIG": Number(p.pagibig_deduction) || 0,
    "Tax": Number(p.tax_deduction) || 0,
    "Loan Deduction": Number(p.loan_deduction) || 0,
    "Custom Deductions": Number(p.custom_deductions) || 0,
    "Other Deductions": Number(p.other_deductions) || 0,
    "Net Pay": Number(p.net_pay) || 0,
    "Status": p.status,
    "Issued At": p.issued_at,
    "Published At": p.published_at || "",
    "Signed At": p.signed_at || "",
    "Paid At": p.paid_at || "",
    "Payment Method": p.payment_method || "",
    "Bank Reference": p.bank_reference_id || "",
    "Notes": p.notes || "",
  };
}

function formatPayrollRunRow(r: Record<string, unknown>) {
  return {
    "Run ID": r.id,
    "Period Label": r.period_label,
    "Run Type": r.run_type || "regular",
    "Status": r.status,
    "Locked": r.locked ? "Yes" : "No",
    "Created At": r.created_at,
    "Locked At": r.locked_at || "",
    "Published At": r.published_at || "",
    "Paid At": r.paid_at || "",
    "Completed At": r.completed_at || "",
    "Payslip Count": Array.isArray(r.payslip_ids) ? (r.payslip_ids as string[]).length : 0,
  };
}

// ─── Attendance event row formatter ───────────────────────────────────────────

function formatAttendanceRow(e: Record<string, unknown>) {
  return {
    "Event ID": e.id,
    "Employee Name": e.employee_name || "",
    "Email": e.employee_email || "",
    "Department": e.employee_department || "",
    "Event Type": e.event_type,
    "Timestamp (UTC)": e.timestamp_utc,
    "Date": e.timestamp_utc ? String(e.timestamp_utc).split("T")[0] : "",
    "Time": e.timestamp_utc ? String(e.timestamp_utc).split("T")[1]?.split(".")[0] || "" : "",
    "Project ID": e.project_id || "",
    "Device ID": e.device_id || "",
    "GPS Lat": e.gps_lat ?? "",
    "GPS Lng": e.gps_lng ?? "",
    "GPS Accuracy (m)": e.gps_accuracy_meters ?? "",
    "Geofence Pass": e.geofence_pass != null ? (e.geofence_pass ? "Yes" : "No") : "",
    "Face Verified": e.face_verified != null ? (e.face_verified ? "Yes" : "No") : "",
    "Device Integrity": e.device_integrity_result || "",
    "Mock Location": e.mock_location_detected != null ? (e.mock_location_detected ? "Yes" : "No") : "",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ExportBackupDialogProps {
  module: ExportModule;
  trigger?: React.ReactNode;
}

export function ExportBackupDialog({ module, trigger }: ExportBackupDialogProps) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<RangePreset>("1m");
  const [fileFormat, setFileFormat] = useState<ExportFormat>("xlsx");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ count: number; at: string } | null>(null);

  const handleExport = useCallback(async () => {
    const { from, to } = getDateRange(range, customFrom, customTo);
    if (!from || !to) {
      toast.error("Please select a valid date range");
      return;
    }

    setLoading(true);
    setLastResult(null);

    try {
      const res = await fetch(`/api/export/${module}?from=${from}&to=${to}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" }));
        toast.error(err.error || "Export failed");
        return;
      }

      const data = await res.json();
      const dateLabel = `${from}_to_${to}`;

      if (module === "payroll") {
        const payslipRows = (data.payslips || []).map(formatPayslipRow);
        const runRows = (data.runs || []).map(formatPayrollRunRow);

        if (payslipRows.length === 0 && runRows.length === 0) {
          toast.error("No payroll data found for this period");
          return;
        }

        exportToFile({
          filename: `payroll-backup_${dateLabel}`,
          format: fileFormat,
          sheets: [
            { name: "Payslips", data: payslipRows },
            { name: "Payroll Runs", data: runRows },
          ],
        });

        setLastResult({ count: payslipRows.length, at: new Date().toLocaleString() });
        toast.success(`Exported ${payslipRows.length} payslips + ${runRows.length} runs`);
      } else {
        const eventRows = (data.events || []).map(formatAttendanceRow);

        if (eventRows.length === 0) {
          toast.error("No attendance data found for this period");
          return;
        }

        exportToFile({
          filename: `attendance-backup_${dateLabel}`,
          format: fileFormat,
          sheets: [{ name: "Attendance Events", data: eventRows }],
        });

        setLastResult({ count: eventRows.length, at: new Date().toLocaleString() });
        toast.success(`Exported ${eventRows.length} attendance events`);
      }
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [module, range, fileFormat, customFrom, customTo]);

  const { from: previewFrom, to: previewTo } = getDateRange(range, customFrom, customTo);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Export Backup</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Export {module === "payroll" ? "Payroll" : "Attendance"} Backup
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Info banner */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              <Database className="inline h-3 w-3 mr-1 -mt-px" />
              <strong>Data Backup:</strong> Exports are fetched directly from the database for accuracy. Use this to back up your data regularly since the free Supabase plan does not include automatic snapshots.
            </p>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-sm font-medium">Date Range</label>
            <Select value={range} onValueChange={(v) => setRange(v as RangePreset)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(RANGE_LABELS) as [RangePreset, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {range === "custom" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="text-xs text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full mt-0.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full mt-0.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
            )}
            {range !== "custom" && (
              <p className="text-xs text-muted-foreground mt-1 font-mono bg-muted px-2 py-1 rounded">
                {previewFrom} → {previewTo}
              </p>
            )}
          </div>

          {/* File Format */}
          <div>
            <label className="text-sm font-medium">File Format</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button
                type="button"
                variant={fileFormat === "xlsx" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 justify-start"
                onClick={() => setFileFormat("xlsx")}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (.xlsx)
              </Button>
              <Button
                type="button"
                variant={fileFormat === "csv" ? "default" : "outline"}
                size="sm"
                className="gap-1.5 justify-start"
                onClick={() => setFileFormat("csv")}
              >
                <FileText className="h-3.5 w-3.5" /> CSV (.csv)
              </Button>
            </div>
            {module === "payroll" && fileFormat === "xlsx" && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Excel export includes separate sheets for Payslips and Payroll Runs.
              </p>
            )}
            {module === "payroll" && fileFormat === "csv" && (
              <p className="text-[10px] text-muted-foreground mt-1">
                CSV export includes Payslips only (single sheet). Use Excel for the full backup.
              </p>
            )}
          </div>

          {/* Export Contents */}
          <div className="rounded-lg border border-border/50 p-3 space-y-1.5">
            <p className="text-xs font-medium">Export includes:</p>
            {module === "payroll" ? (
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• Payslips — all fields (gross, deductions, net, status, dates)</li>
                <li>• Employee details (name, email, department, job title)</li>
                <li>• Payroll runs — period, status, locked/paid dates</li>
                <li>• Payment info (method, bank reference)</li>
              </ul>
            ) : (
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• Attendance events — IN/OUT/BREAK_START/BREAK_END</li>
                <li>• Employee details (name, email, department)</li>
                <li>• GPS coordinates, accuracy, geofence status</li>
                <li>• Security evidence (face, device integrity, mock detection)</li>
              </ul>
            )}
          </div>

          {/* Last result */}
          {lastResult && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                Last export: {lastResult.count} records at {lastResult.at}
              </Badge>
            </div>
          )}

          {/* Export button */}
          <Button
            className="w-full gap-2"
            onClick={handleExport}
            disabled={loading || (range === "custom" && (!customFrom || !customTo))}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Exporting...</>
            ) : (
              <><Download className="h-4 w-4" /> Export {fileFormat.toUpperCase()}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
