"use client";

/**
 * Backfill from Attendance Modal
 *
 * Allows HR/admin to select employees + date range, previews computed payroll
 * for each detected cycle, then creates all payroll runs in Draft status.
 */

import { useState, useMemo } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { usePayrollStore } from "@/store/payroll.store";
import { previewBackfill, executeBackfill, type BackfillResult } from "@/services/payroll-backfill.service";
import { detectCycles } from "@/lib/payroll-computation-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calculator, Loader2, CheckCircle, XCircle, SkipForward, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BackfillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "select" | "preview" | "executing" | "done";

// ─── Component ───────────────────────────────────────────────────────────────

export function BackfillModal({ open, onOpenChange }: BackfillModalProps) {
  const employees = useEmployeesStore((s) => s.employees).filter((e) => e.status === "active");

  // State
  const [step, setStep] = useState<Step>("select");
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [computeWorkDays, setComputeWorkDays] = useState("21.5");
  const [searchTerm, setSearchTerm] = useState("");
  const [previewResults, setPreviewResults] = useState<BackfillResult[]>([]);
  const [finalResults, setFinalResults] = useState<BackfillResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filtered employees for search
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees;
    const q = searchTerm.toLowerCase();
    return employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q)
    );
  }, [employees, searchTerm]);

  // Detected cycles preview
  const detectedCycles = useMemo(() => {
    if (!startDate || !endDate || startDate > endDate) return [];
    return detectCycles(startDate, endDate);
  }, [startDate, endDate]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handlePreview = () => {
    if (selectedEmpIds.size === 0) { toast.error("Select at least one employee"); return; }
    if (!startDate || !endDate) { toast.error("Set a date range"); return; }
    if (startDate > endDate) { toast.error("Start date must be before end date"); return; }

    const results = previewBackfill({
      employeeIds: Array.from(selectedEmpIds),
      startDate,
      endDate,
      computeWorkDays: Number(computeWorkDays) || 21.5,
    });

    setPreviewResults(results);
    setStep("preview");
  };

  const handleExecute = async () => {
    setStep("executing");
    setIsProcessing(true);

    try {
      const results = await executeBackfill({
        employeeIds: Array.from(selectedEmpIds),
        startDate,
        endDate,
        computeWorkDays: Number(computeWorkDays) || 21.5,
      });

      setFinalResults(results);
      setStep("done");

      const totalIssued = results.reduce((s, r) => s + r.totalIssued, 0);
      const totalSkipped = results.reduce((s, r) => s + r.totalSkipped, 0);
      const totalErrors = results.reduce((s, r) => s + r.totalErrors, 0);

      if (totalIssued > 0) toast.success(`Created ${totalIssued} payslip(s) in Draft status`);
      if (totalSkipped > 0) toast.warning(`Skipped ${totalSkipped} duplicate(s)`);
      if (totalErrors > 0) toast.error(`${totalErrors} cycle(s) failed`);
    } catch (err) {
      toast.error(`Backfill failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setStep("preview");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setStep("select");
      setSelectedEmpIds(new Set());
      setStartDate("");
      setEndDate("");
      setPreviewResults([]);
      setFinalResults([]);
      setSearchTerm("");
    }, 200);
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEmpIds.size === filteredEmployees.length) {
      setSelectedEmpIds(new Set());
    } else {
      setSelectedEmpIds(new Set(filteredEmployees.map((e) => e.id)));
    }
  };

  const formatCurrency = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Backfill from Attendance
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Select employees and date range to compute payroll from attendance records."}
            {step === "preview" && "Review computed figures before creating payslips."}
            {step === "executing" && "Creating payslips..."}
            {step === "done" && "Backfill complete. All payslips created in Draft status."}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step 1: Select ─────────────────────────────────────────── */}
        {step === "select" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Date Range */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Work Days Divisor</label>
                <Input type="number" step="0.5" min="1" max="31" value={computeWorkDays} onChange={(e) => setComputeWorkDays(e.target.value)} className="mt-1" />
                <p className="text-[10px] text-muted-foreground mt-0.5">For rate_per_day = salary / this</p>
              </div>
            </div>

            {/* Detected Cycles */}
            {detectedCycles.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-medium mb-1">Detected Cycles ({detectedCycles.length}):</p>
                <div className="flex flex-wrap gap-1">
                  {detectedCycles.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      {c.periodStart} → {c.periodEnd}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Employee Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  Employees ({selectedEmpIds.size} selected)
                </label>
                <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs h-7">
                  {selectedEmpIds.size === filteredEmployees.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-2"
              />
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleEmployee(emp.id)}
                  >
                    <Checkbox checked={selectedEmpIds.has(emp.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.department} · {formatCurrency(emp.salary)}/mo
                      </p>
                    </div>
                  </div>
                ))}
                {filteredEmployees.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No employees found</p>
                )}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handlePreview} disabled={selectedEmpIds.size === 0 || !startDate || !endDate}>
                Preview Computation
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ─── Step 2: Preview ────────────────────────────────────────── */}
        {step === "preview" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <ScrollArea className="flex-1">
              {previewResults.map((result) => (
                <div key={result.employeeId} className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-semibold">{result.employeeName}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {result.totalIssued} cycle(s)
                    </Badge>
                    {result.totalSkipped > 0 && (
                      <Badge variant="outline" className="text-[10px] text-amber-600">
                        {result.totalSkipped} skipped
                      </Badge>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Period</TableHead>
                        <TableHead className="text-xs text-right">Basic</TableHead>
                        <TableHead className="text-xs text-right">OT Pay</TableHead>
                        <TableHead className="text-xs text-right">Deductions</TableHead>
                        <TableHead className="text-xs text-right">Net Pay</TableHead>
                        <TableHead className="text-xs text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.cycles.map((cr, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">
                            {cr.cycle.periodStart} → {cr.cycle.periodEnd}
                          </TableCell>
                          {cr.status === "success" ? (
                            <>
                              <TableCell className="text-xs text-right">{formatCurrency(cr.computed.totalBasic)}</TableCell>
                              <TableCell className="text-xs text-right">{formatCurrency(cr.computed.totalOtPay)}</TableCell>
                              <TableCell className="text-xs text-right">{formatCurrency(cr.computed.totalDeductions)}</TableCell>
                              <TableCell className="text-xs text-right font-medium">{formatCurrency(cr.computed.netPay)}</TableCell>
                              <TableCell className="text-center">
                                <CheckCircle className="h-3.5 w-3.5 text-green-600 mx-auto" />
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell colSpan={4} className="text-xs text-muted-foreground">
                                {cr.status === "skipped_duplicate" ? "Duplicate — payslip already exists" : cr.error}
                              </TableCell>
                              <TableCell className="text-center">
                                {cr.status === "skipped_duplicate" ? (
                                  <SkipForward className="h-3.5 w-3.5 text-amber-500 mx-auto" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-red-500 mx-auto" />
                                )}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </ScrollArea>

            <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                All payslips will be created in <strong>Draft</strong> status. Review and lock via the standard payroll workflow.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
              <Button onClick={handleExecute} disabled={previewResults.every((r) => r.totalIssued === 0)}>
                Confirm & Create {previewResults.reduce((s, r) => s + r.totalIssued, 0)} Payslip(s)
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ─── Step 3: Executing ──────────────────────────────────────── */}
        {step === "executing" && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Computing payroll and creating payslips...</p>
            </div>
          </div>
        )}

        {/* ─── Step 4: Done ───────────────────────────────────────────── */}
        {step === "done" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium">
                Created {finalResults.reduce((s, r) => s + r.totalIssued, 0)} payslip(s) in Draft status
              </p>
              {finalResults.reduce((s, r) => s + r.totalSkipped, 0) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {finalResults.reduce((s, r) => s + r.totalSkipped, 0)} duplicate(s) skipped
                </p>
              )}
            </div>

            <ScrollArea className="flex-1">
              {finalResults.map((result) => (
                <div key={result.employeeId} className="mb-3">
                  <p className="text-sm font-medium">{result.employeeName}</p>
                  <div className="flex gap-2 mt-1">
                    {result.totalIssued > 0 && <Badge className="text-[10px]">{result.totalIssued} created</Badge>}
                    {result.totalSkipped > 0 && <Badge variant="outline" className="text-[10px]">{result.totalSkipped} skipped</Badge>}
                    {result.totalErrors > 0 && <Badge variant="destructive" className="text-[10px]">{result.totalErrors} errors</Badge>}
                  </div>
                </div>
              ))}
            </ScrollArea>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
