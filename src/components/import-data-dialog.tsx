"use client";

<<<<<<< HEAD
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

interface ImportDataDialogProps {
    module: string;
    onImportComplete?: () => void;
}

export function ImportDataDialog({ module, onImportComplete }: ImportDataDialogProps) {
    return null; // Placeholder — import functionality coming soon
=======
import { useState, useCallback, useRef } from "react";
import {
  downloadImportTemplate,
  parseImportFile,
  type ExportFormat,
  PAYROLL_TEMPLATE_HEADERS,
  ATTENDANCE_TEMPLATE_HEADERS,
} from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Loader2,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileUp,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

type ImportModule = "payroll" | "attendance";
type RowStatus = "valid" | "duplicate" | "error";

interface RowValidation {
  row: number;
  status: RowStatus;
  message: string;
  employee?: string;
  period?: string;
  detail?: string;
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
  valid: { icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", label: "Ready" },
  duplicate: { icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Duplicate" },
  error: { icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Error" },
} as const;

export function ImportDataDialog({
  module,
  trigger,
  onImportComplete,
}: ImportDataDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [expandedSection, setExpandedSection] = useState<RowStatus | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const expectedHeaders =
    module === "payroll" ? PAYROLL_TEMPLATE_HEADERS : ATTENDANCE_TEMPLATE_HEADERS;

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setValidation(null);
    setResult(null);
    setExpandedSection(null);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

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
        const missingCols = ["Employee Name"].filter(
          (col) => !fileHeaders.some((h) => h.trim().toLowerCase() === col.toLowerCase())
        );
        if (missingCols.length > 0) {
          toast.error(`Missing required column(s): ${missingCols.join(", ")}. Download the template for the correct format.`);
          setLoading(false);
          return;
        }

        setPreview(rows);
        setLoading(false);

        // Automatically run server-side dry run validation
        setValidating(true);
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
            toast.warning("No valid rows found. Check the validation details below.");
          }
        } catch {
          toast.error("Failed to validate with server. You can still try importing.");
        } finally {
          setValidating(false);
        }
      } catch (err) {
        toast.error(`Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    },
    [module]
  );

  const handleImport = useCallback(async () => {
    if (!preview || preview.length === 0) return;

    if (validation && validation.valid === 0) {
      toast.error("No valid rows to import. Fix the errors and re-upload.");
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      const res = await fetch(`/api/import/${module}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview, dryRun: false }),
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
          `Imported ${data.imported} record(s)${data.duplicates > 0 ? `, ${data.duplicates} duplicate(s) skipped` : ""}${data.errors > 0 ? `, ${data.errors} error(s)` : ""}`
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
  }, [preview, module, onImportComplete, validation]);

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

  return (
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
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Import {module === "payroll" ? "Payroll" : "Attendance"} Data
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2 overflow-y-auto pr-1">
          {/* Download Template Section */}
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-2">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
              <Download className="inline h-3 w-3 mr-1 -mt-px" />
              Download a template first to ensure your data matches the expected format.
            </p>
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
          </div>

          {/* Upload Section */}
          <div>
            <label className="text-sm font-medium">Upload File</label>
            <div
              className="mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/60 p-6 cursor-pointer hover:border-primary/40 transition-colors"
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
                    {preview ? `${preview.length} row(s) parsed` : "Parsing..."}
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-1">
                    Click to upload XLSX or CSV
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Max 5 MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Validating Indicator */}
          {validating && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <p className="text-xs text-blue-700 dark:text-blue-400">
                Validating rows and checking for duplicates...
              </p>
            </div>
          )}

          {/* Validation / Result Summary */}
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
                      className={`text-center p-2 rounded-md ${cfg.bg} border ${cfg.border} transition-all ${count > 0 ? "cursor-pointer hover:ring-1 hover:ring-offset-1" : "opacity-50"} ${isExpanded ? "ring-1 ring-offset-1" : ""}`}
                      onClick={() => count > 0 && setExpandedSection(isExpanded ? null : status)}
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

              {/* Per-row details (expanded) */}
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
                  <div className="max-h-48 overflow-y-auto divide-y divide-border/20">
                    {activeValidations
                      .filter((r) => r.status === expandedSection)
                      .map((r) => {
                        const cfg = STATUS_CONFIG[r.status];
                        const Icon = cfg.icon;
                        return (
                          <div key={r.row} className="px-3 py-1.5 flex items-start gap-2 text-xs">
                            <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${cfg.color}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                                  #{r.row}
                                </Badge>
                                {r.employee && (
                                  <span className="font-medium truncate">{r.employee}</span>
                                )}
                                {(r.period || r.detail) && (
                                  <span className="text-muted-foreground truncate">
                                    {r.period || r.detail}
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

              {/* All-valid banner */}
              {activeCounts.valid > 0 && activeCounts.duplicates === 0 && activeCounts.errors === 0 && !result && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    All {activeCounts.valid} row(s) validated — no duplicates found. Ready to import.
                  </p>
                </div>
              )}

              {/* Has-issues warning */}
              {!result && (activeCounts.duplicates > 0 || activeCounts.errors > 0) && activeCounts.valid > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {activeCounts.valid} row(s) will be imported.{" "}
                    {activeCounts.duplicates > 0 && `${activeCounts.duplicates} duplicate(s) will be skipped. `}
                    {activeCounts.errors > 0 && `${activeCounts.errors} row(s) have errors. `}
                    Click the counts above to see details.
                  </p>
                </div>
              )}

              {/* All-bad warning */}
              {!result && activeCounts.valid === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
                  <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 dark:text-red-400">
                    No valid rows to import. All rows are either duplicates or have errors. Click the counts above for details.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
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
                    !preview ||
                    preview.length === 0 ||
                    importing ||
                    validating ||
                    (validation !== null && validation.valid === 0)
                  }
                >
                  {importing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Importing...</>
                  ) : validation ? (
                    <>
                      <Upload className="h-4 w-4" />{" "}
                      Import {validation.valid} Valid Row(s)
                      {validation.duplicates > 0 && (
                        <span className="text-amber-400 text-[10px]">
                          ({validation.duplicates} skipped)
                        </span>
                      )}
                    </>
                  ) : (
                    <><Upload className="h-4 w-4" /> Import {preview ? `${preview.length} Row(s)` : ""}</>
                  )}
                </Button>
              </>
            )}
          </div>

          {/* Format info */}
          <div className="rounded-lg border border-border/50 p-3 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground">
              Expected format ({module === "payroll" ? "Payroll" : "Attendance"}):
            </p>
            <p className="text-[10px] text-muted-foreground">
              {(expectedHeaders as readonly string[]).slice(0, 6).join(", ")}
              {expectedHeaders.length > 6 &&
                `, + ${expectedHeaders.length - 6} more columns`}
            </p>
            <p className="text-[10px] text-muted-foreground italic">
              Compatible with the exported backup format. Duplicates are checked before import.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
>>>>>>> 3a470fc (fix: employee delete tombstone, 401 session refresh, delete API route, import dryRun validation)
}
