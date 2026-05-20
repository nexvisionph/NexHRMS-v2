"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  downloadImportTemplate,
  parseImportFile,
  type ExportFormat,
  PAYROLL_TEMPLATE_HEADERS,
  ATTENDANCE_TEMPLATE_HEADERS,
  EMPLOYEES_TEMPLATE_HEADERS,
} from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
 * The PB sheet contains two employee pay-slip blocks side-by-side:
 *   Left  block → value column = col index 7
 *   Right block → value column = col index 15
 */
function convertPBRawToPayrollRows(
  rawRows: Record<string, unknown>[]
): PayrollRow[] {
  // rawRows from parseImportFile will arrive with numeric string keys when
  // the file has no header row — but parseImportFile calls xlsx sheet_to_json
  // which uses the first row as keys. For a PB file the first row is mostly
  // blank so numeric keys end up as "0","1",... We re-key to numbers for clarity.
  const raw = rawRows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v]))
  );

  function parseDateSerial(v: unknown): string {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "string" && v.includes("-")) return v.split(" ")[0];
    if (typeof v === "number") {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return d.toISOString().split("T")[0];
    }
    return String(v).split(" ")[0];
  }

  function getCell(rows: typeof raw, rowIdx: number, colIdx: number): unknown {
    const row = rows[rowIdx];
    if (!row) return null;
    // keys could be numeric strings or the actual header value
    const v = row[colIdx] ?? row[String(colIdx)];
    return v === undefined || v === null || v === "" ? null : v;
  }

  function numCell(rows: typeof raw, rowIdx: number, colIdx: number): number {
    const v = getCell(rows, rowIdx, colIdx);
    if (v === null) return 0;
    const f = parseFloat(String(v));
    return isNaN(f) ? 0 : f;
  }

  function strCell(rows: typeof raw, rowIdx: number, colIdx: number): string {
    const v = getCell(rows, rowIdx, colIdx);
    return v === null ? "" : String(v).trim();
  }

  const blocks: Array<{ nameCol: number; valCol: number; fromCol: number }> = [
    { nameCol: 4, valCol: 7, fromCol: 3 },
    { nameCol: 12, valCol: 15, fromCol: 11 },
  ];

  const employees: PayrollRow[] = [];

  for (const blk of blocks) {
    const name =
      strCell(raw, 4, blk.nameCol) || strCell(raw, 0, 18);
    if (!name || name === "NAME") continue;

    const periodFrom = parseDateSerial(getCell(raw, 2, blk.fromCol));
    const periodTo = parseDateSerial(getCell(raw, 2, blk.fromCol + 2));
    const position = strCell(raw, 5, blk.nameCol);
    const project = strCell(raw, 6, blk.nameCol);

    const totalBasic = numCell(raw, 15, blk.valCol);
    const overtimePay = numCell(raw, 17, blk.valCol);
    const mealAllowance = numCell(raw, 18, blk.valCol);
    const projectAllow = numCell(raw, 19, blk.valCol);
    const taxiFare = numCell(raw, 20, blk.valCol);
    const othersAllow = numCell(raw, 21, blk.valCol);
    const totalAllowances = numCell(raw, 22, blk.valCol);
    const withholdingTax = numCell(raw, 24, blk.valCol);
    const sss = numCell(raw, 25, blk.valCol);
    const sssLoan = numCell(raw, 26, blk.valCol);
    const philhealth = numCell(raw, 27, blk.valCol);
    const pagibig = numCell(raw, 28, blk.valCol);
    const pagibigLoan = numCell(raw, 29, blk.valCol);
    const taxDef = numCell(raw, 30, blk.valCol);
    const communityTax = numCell(raw, 31, blk.valCol);
    const netPay = numCell(raw, 33, blk.valCol);

    const grossPay = totalBasic + totalAllowances;
    const loanDeduction = sssLoan + pagibigLoan;
    const customDeductions = taxDef + communityTax;
    const lwop = numCell(raw, 13, blk.valCol);
    const tardiness = numCell(raw, 14, blk.valCol);
    const adj = numCell(raw, 12, blk.valCol);
    const otherDeductions = lwop + tardiness + adj;

    const noteParts: string[] = [];
    if (project) noteParts.push(`Project: ${project}`);
    if (overtimePay > 0) noteParts.push(`OT: ${overtimePay.toFixed(2)}`);
    if (mealAllowance > 0) noteParts.push(`Meal: ${mealAllowance.toFixed(2)}`);
    if (taxiFare > 0) noteParts.push(`Taxi: ${taxiFare.toFixed(2)}`);
    if (projectAllow > 0) noteParts.push(`Proj allowance: ${projectAllow.toFixed(2)}`);
    if (othersAllow > 0) noteParts.push(`Others: ${othersAllow.toFixed(2)}`);

    employees.push({
      "Employee Name": name,
      Email: "",
      Department: "",
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
      "Custom Deductions": customDeductions.toFixed(2),
      "Other Deductions": otherDeductions.toFixed(2),
      "Net Pay": netPay.toFixed(2),
      "Payment Method": "",
      "Bank Reference": "",
      Notes: noteParts.join(" | "),
    });
  }

  return employees;
}

// ─── Field layout helpers (matching the interfaces-field pattern) ─────────────

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

function PBPreviewDialog({
  open,
  onOpenChange,
  rows,
  onRowsChange,
  onConfirm,
  confirming,
  fileName,
}: PBPreviewDialogProps) {
  const updateCell = useCallback(
    (rowIdx: number, col: string, value: string) => {
      onRowsChange(
        rows.map((r, i) => (i === rowIdx ? { ...r, [col]: value } : r))
      );
    },
    [rows, onRowsChange]
  );

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

  const requiredFields = new Set(["Employee Name", "Email"]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Pencil className="h-4 w-4 text-muted-foreground" />
                Review Converted Payroll Data
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{fileName}</span>
                {" "}was converted from PB format.{" "}
                Edit any field below before confirming the import.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-[10px] h-5 gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                {rows.length} record{rows.length !== 1 ? "s" : ""}
              </Badge>
              {missingEmailCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 gap-1 border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {missingEmailCount} email{missingEmailCount !== 1 ? "s" : ""} missing
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* ── Email warning ───────────────────────────────────────────── */}
        {missingEmailCount > 0 && (
          <div className="shrink-0 mx-6 mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              <strong>Email is required</strong> for each record. Fill in the Email
              fields below — they were not present in the PB file.
            </p>
          </div>
        )}

        {/* ── Scrollable records ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="rounded-2xl border border-border/60 bg-card overflow-hidden"
            >
              {/* Record header */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-primary">
                      {rowIdx + 1}
                    </span>
                  </div>
                  <span className="text-sm font-medium leading-none">
                    {row["Employee Name"] || (
                      <span className="text-muted-foreground italic">Unnamed employee</span>
                    )}
                  </span>
                  {row["Job Title"] && (
                    <span className="text-xs text-muted-foreground">· {row["Job Title"]}</span>
                  )}
                </div>
                <button
                  type="button"
                  title="Remove record"
                  onClick={() => deleteRow(rowIdx)}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* FieldSet body */}
              <div className="px-5 py-4 space-y-5">
                {sections.map((section, sIdx) => (
                  <div key={section.legend}>
                    {/* FieldSet equivalent */}
                    <fieldset className="flex flex-col gap-3">
                      <SectionLegend>{section.legend}</SectionLegend>
                      {/* FieldGroup responsive grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                        {section.fields.map((col) => {
                          const val = row[col] ?? "";
                          const isRequired = requiredFields.has(col);
                          const isEmpty = isRequired && !val.trim();
                          return (
                            <LabeledField
                              key={col}
                              label={col}
                              required={isRequired}
                              description={
                                isEmpty ? "Required — please fill in" : undefined
                              }
                            >
                              <Input
                                value={val}
                                placeholder={isRequired ? `${col} (required)` : col}
                                onChange={(e) =>
                                  updateCell(rowIdx, col, e.target.value)
                                }
                                className={[
                                  "h-8 text-xs",
                                  isEmpty
                                    ? "border-destructive/60 bg-destructive/5 focus-visible:ring-destructive/40"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              />
                            </LabeledField>
                          );
                        })}
                      </div>
                    </fieldset>

                    {/* Separator between sections (not after last) */}
                    {sIdx < sections.length - 1 && (
                      <Separator className="mt-5" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <XCircle className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                All records removed. Go back to upload a new file.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <DialogFooter className="shrink-0 border-t border-border/60 px-6 py-4 flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xs">
            {rows.length} record{rows.length !== 1 ? "s" : ""} ready to import.{" "}
            {missingEmailCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                Fill in {missingEmailCount} missing email{missingEmailCount !== 1 ? "s" : ""} first.
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Back
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              onClick={onConfirm}
              disabled={
                rows.length === 0 ||
                confirming ||
                missingEmailCount > 0
              }
            >
              {confirming ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  Confirm Import
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
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

        // ── PB format detection (payroll module only) ───────────────────────
        if (isPayroll && isPBFormat(fileHeaders)) {
          const converted = convertPBRawToPayrollRows(
            rows as Record<string, unknown>[]
          );
          if (converted.length === 0) {
            toast.error(
              "Could not find employee records in the PB file. Make sure it's a valid Payroll Bureau export."
            );
            setLoading(false);
            return;
          }
          toast.info(
            `PB format detected — ${converted.length} record(s) converted. Review and edit before importing.`
          );
          setPbRows(converted);
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

        const stringRows = rows.map((r) =>
          Object.fromEntries(
            Object.entries(r).map(([k, v]) => [k, String(v ?? "")])
          )
        );
        setEditedRows(stringRows);
        setLoading(false);
        await runValidation(stringRows);
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
      const stringRows = pbRows.map((r) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [k, String(v ?? "")])
        )
      );
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
  }, [pbRows, module, onImportComplete, reset]);

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