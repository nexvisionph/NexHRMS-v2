"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePayrollStore } from "@/store/payroll.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useLeaveStore } from "@/store/leave.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ShieldCheck,
    Clock,
    FileText,
    Banknote,
    CalendarClock,
    Settings2,
    ArrowRight,
    ExternalLink,
    Wrench,
    Trash2,
    UserCog,
} from "lucide-react";
import { toast } from "sonner";
import type { Payslip } from "@/types";

/* ═══════════════════════════════════════════════════════════════
   Payroll Pre-Run Readiness Checklist (FEAT-01 / FEAT-02)
   ═══════════════════════════════════════════════════════════════ */

interface PayrollReadinessChecklistProps {
    runId: string;
    periodLabel: string;
    payslipIds: string[];
    onAllChecksPassed: (passed: boolean) => void;
    onSwitchTab?: (tab: string) => void;
    role?: string;
}

interface CheckResult {
    id: string;
    label: string;
    passed: boolean;
    blocking: boolean;
    message: string;
    count?: number;
    icon: React.ReactNode;
    navHint?: { label: string; tab?: string; href?: string };
    hasFixModal?: boolean;
}

// ── Fix Modal ────────────────────────────────────────────────────
interface FixModalProps {
    open: boolean;
    onClose: () => void;
    badPayslips: Payslip[];
    getEmpName: (id: string) => string;
    deletePayslip: (id: string) => void;
    role: string;
}

function ZeroNetPayFixModal({
    open,
    onClose,
    badPayslips,
    getEmpName,
    deletePayslip,
    role,
}: FixModalProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const allSelected = badPayslips.length > 0 && selected.size === badPayslips.length;
    const someSelected = selected.size > 0 && !allSelected;

    const toggleAll = () => {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(badPayslips.map((p) => p.id)));
        }
    };

    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleRemoveSelected = () => {
        if (selected.size === 0) return;
        // Only draft payslips can be deleted
        const toDelete = badPayslips.filter(
            (p) => selected.has(p.id) && p.status === "draft"
        );
        const nonDraft = selected.size - toDelete.length;
        toDelete.forEach((p) => deletePayslip(p.id));
        if (toDelete.length > 0)
            toast.success(
                `Removed ${toDelete.length} payslip${toDelete.length > 1 ? "s" : ""} from this run`
            );
        if (nonDraft > 0)
            toast.warning(
                `${nonDraft} payslip${nonDraft > 1 ? "s" : ""} skipped — only draft payslips can be removed`
            );
        setSelected(new Set());
    };

    return (
        <Dialog open={open} onOpenChange={(v) => {
            if (!v) {
                setSelected(new Set());
                onClose();
            }
        }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-amber-500" />
                        Fix Zero Net Pay Payslips
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Select employees to remove from this run, or visit their profile to update salary/deductions before re-issuing.
                    </p>
                </DialogHeader>

                {/* Toolbar */}
                <div className="flex items-center justify-between pt-1 pb-1 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="select-all-bad"
                            checked={allSelected ? true : someSelected ? "indeterminate" : false}
                            onCheckedChange={toggleAll}
                        />
                        <label
                            htmlFor="select-all-bad"
                            className="text-xs font-medium cursor-pointer select-none"
                        >
                            {allSelected ? "Deselect all" : "Select all"}{" "}
                            <span className="text-muted-foreground">
                                ({badPayslips.length})
                            </span>
                        </label>
                    </div>

                    <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-3 text-[11px] gap-1.5"
                        disabled={selected.size === 0}
                        onClick={handleRemoveSelected}
                    >
                        <Trash2 className="h-3 w-3" />
                        Remove selected ({selected.size})
                    </Button>
                </div>

                {/* Payslip rows */}
                <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1 mt-1">
                    {badPayslips.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-8">
                            ✓ All resolved — you can now lock the run
                        </p>
                    )}

                    {badPayslips.map((ps) => {
                        const empName = getEmpName(ps.employeeId);
                        const isChecked = selected.has(ps.id);
                        const isDraft = ps.status === "draft";

                        return (
                            <div
                                key={ps.id}
                                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
                                    isChecked
                                        ? "bg-red-500/10 border-red-500/40"
                                        : "bg-red-500/5 border-red-500/20 hover:bg-red-500/8"
                                }`}
                                onClick={() => toggleOne(ps.id)}
                            >
                                {/* Checkbox */}
                                <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => toggleOne(ps.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="shrink-0"
                                />

                                {/* Employee info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium leading-tight truncate">
                                        {empName}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {ps.id}
                                        {" · "}Gross ₱{(ps.grossPay || 0).toLocaleString()}
                                        {" · "}
                                        <span className={isDraft ? "text-amber-500" : "text-blue-500"}>
                                            {ps.status}
                                        </span>
                                    </p>
                                </div>

                                {/* Profile link */}
                                <Link
                                    href={`/${role}/employees/${ps.employeeId}`}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Open employee profile to update salary"
                                >
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-[10px] gap-1 shrink-0"
                                    >
                                        <UserCog className="h-3 w-3" />
                                        Edit Salary
                                        <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                                    </Button>
                                </Link>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50 mt-1">
                    <p className="text-[10px] text-muted-foreground">
                        Only <strong>draft</strong> payslips can be removed from a run.
                    </p>
                    <Button size="sm" onClick={onClose}>
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Component ───────────────────────────────────────────────
export function PayrollReadinessChecklist({
    runId,
    periodLabel,
    payslipIds,
    onAllChecksPassed,
    onSwitchTab,
    role = "admin",
}: PayrollReadinessChecklistProps) {
    const payslips = usePayrollStore((s) => s.payslips);
    const adjustments = usePayrollStore((s) => s.adjustments);
    const deletePayslip = usePayrollStore((s) => s.deletePayslip);
    const exceptions = useAttendanceStore((s) => s.exceptions);
    const getPendingLeaves = useLeaveStore((s) => s.getPending);
    const employees = useEmployeesStore((s) => s.employees);

    const [fixModalOpen, setFixModalOpen] = useState(false);

    const [periodStart, periodEnd] = periodLabel.split("/");
    const getEmpName = (id: string) =>
        employees.find((e) => e.id === id)?.name || id;

    const runPayslips = useMemo(
        () => payslips.filter((p) => payslipIds.includes(p.id)),
        [payslips, payslipIds]
    );

    const badNetPay = useMemo(
        () => runPayslips.filter((p) => p.netPay <= 0),
        [runPayslips]
    );

    const checks = useMemo<CheckResult[]>(() => {
        // Check 1 — Missing clock-outs (BLOCKING)
        const missingOuts = exceptions.filter(
            (ex) =>
                ex.flag === "missing_out" &&
                !ex.resolvedAt &&
                periodStart &&
                periodEnd &&
                ex.date >= periodStart &&
                ex.date <= periodEnd
        );
        const check1: CheckResult = {
            id: "missing-clockout",
            label: "No missing clock-outs",
            passed: missingOuts.length === 0,
            blocking: true,
            message:
                missingOuts.length === 0
                    ? "All employees have complete attendance records"
                    : `${missingOuts.length} employee(s) have missing clock-out in this period`,
            count: missingOuts.length,
            icon: <Clock className="h-4 w-4" />,
            navHint: { label: "Go to Attendance", href: `/${role}/attendance` },
        };

        // Check 2 — Payslips exist (BLOCKING)
        const check2: CheckResult = {
            id: "payslips-exist",
            label: "Payslips generated",
            passed: runPayslips.length > 0,
            blocking: true,
            message:
                runPayslips.length > 0
                    ? `${runPayslips.length} payslip(s) in this run`
                    : "No payslips have been generated for this run",
            count: runPayslips.length,
            icon: <FileText className="h-4 w-4" />,
            navHint: { label: "Issue Payslips", tab: "payslips" },
        };

        // Check 3 — No zero/negative net pay (BLOCKING)
        const bad = runPayslips.filter((p) => p.netPay <= 0);
        const badNames = bad
            .slice(0, 3)
            .map((p) => getEmpName(p.employeeId))
            .join(", ");
        const badExtra = bad.length > 3 ? ` +${bad.length - 3} more` : "";
        const check3: CheckResult = {
            id: "no-zero-netpay",
            label: "No zero/negative net pay",
            passed: bad.length === 0,
            blocking: true,
            message:
                bad.length === 0
                    ? "All payslips have positive net pay"
                    : `${bad.length} payslip(s) have ₱0 net pay: ${badNames}${badExtra}`,
            count: bad.length,
            icon: <Banknote className="h-4 w-4" />,
            hasFixModal: bad.length > 0,
        };

        // Check 4 — No pending leave requests (WARNING)
        const pendingLeaves =
            periodStart && periodEnd
                ? getPendingLeaves().filter(
                      (r) =>
                          r.startDate <= periodEnd && r.endDate >= periodStart
                  )
                : [];
        const check5: CheckResult = {
            id: "pending-leaves",
            label: "No pending leave requests",
            passed: pendingLeaves.length === 0,
            blocking: false,
            message:
                pendingLeaves.length === 0
                    ? "No pending leave requests in this period"
                    : `${pendingLeaves.length} leave request(s) are still pending — may affect attendance`,
            count: pendingLeaves.length,
            icon: <CalendarClock className="h-4 w-4" />,
            navHint: { label: "Go to Leave", href: `/${role}/leave` },
        };

        // Check 5 — No pending adjustments (WARNING)
        const pendingAdj = adjustments.filter((a) => a.status === "pending");
        const check6: CheckResult = {
            id: "pending-adjustments",
            label: "No pending adjustments",
            passed: pendingAdj.length === 0,
            blocking: false,
            message:
                pendingAdj.length === 0
                    ? "No pending payroll adjustments"
                    : `${pendingAdj.length} adjustment(s) are pending and may not be included`,
            count: pendingAdj.length,
            icon: <Settings2 className="h-4 w-4" />,
            navHint: { label: "View Management", tab: "management" },
        };

        return [check1, check2, check3, check5, check6];
    }, [exceptions, runPayslips, adjustments, getPendingLeaves, periodStart, periodEnd, getEmpName, role]);

    const blockingFailed = checks.filter((c) => c.blocking && !c.passed);
    const warningsFailed = checks.filter((c) => !c.blocking && !c.passed);
    const allClear = blockingFailed.length === 0;

    const callbackRef = useRef(onAllChecksPassed);
    useEffect(() => {
        callbackRef.current = onAllChecksPassed;
    }, [onAllChecksPassed]);
    useEffect(() => {
        callbackRef.current(allClear);
    }, [allClear]);

    return (
        <>
            <Card className="border border-border/60 bg-muted/20">
                <CardContent className="p-4 space-y-3 max-h-[360px] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-4.5 w-4.5 text-violet-500" />
                            <div>
                                <h4 className="text-sm font-semibold leading-tight">
                                    Payroll Run Checklist
                                </h4>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {periodStart} — {periodEnd}
                                </p>
                            </div>
                        </div>
                        {allClear && warningsFailed.length === 0 && (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] border-0">
                                All Clear
                            </Badge>
                        )}
                        {allClear && warningsFailed.length > 0 && (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] border-0">
                                {warningsFailed.length} Warning
                                {warningsFailed.length > 1 ? "s" : ""}
                            </Badge>
                        )}
                        {!allClear && (
                            <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 text-[10px] border-0">
                                {blockingFailed.length} Blocker
                                {blockingFailed.length > 1 ? "s" : ""}
                            </Badge>
                        )}
                    </div>

                    {/* Check rows */}
                    <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0 pr-1">
                        {checks.map((check) => (
                            <div key={check.id}>
                                <div
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
                                        check.passed
                                            ? "bg-emerald-500/5 border-emerald-500/20"
                                            : check.blocking
                                            ? "bg-red-500/5 border-red-500/20"
                                            : "bg-amber-500/5 border-amber-500/20"
                                    }`}
                                >
                                    {/* Status icon */}
                                    <div className="shrink-0">
                                        {check.passed ? (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                        ) : check.blocking ? (
                                            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                        ) : (
                                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                        )}
                                    </div>

                                    {/* Check type icon */}
                                    <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                                        {check.icon}
                                    </div>

                                    {/* Label + message */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium leading-tight">
                                            {check.label}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                            {check.message}
                                        </p>
                                    </div>

                                    {/* Count badge */}
                                    {!check.passed &&
                                        check.count !== undefined &&
                                        check.count > 0 && (
                                            <Badge
                                                variant="secondary"
                                                className={`text-[10px] shrink-0 ${
                                                    check.blocking
                                                        ? "bg-red-500/15 text-red-700 dark:text-red-400"
                                                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                                }`}
                                            >
                                                {check.count}
                                            </Badge>
                                        )}
                                    {check.passed && (
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shrink-0"
                                        >
                                            OK
                                        </Badge>
                                    )}
                                </div>

                                {/* Actions for failed checks */}
                                {!check.passed && (
                                    <div className="mt-1.5 ml-6 flex items-center gap-1.5">
                                        {/* Fix Modal — zero net pay only */}
                                        {check.hasFixModal && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 text-[10px] gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                                                onClick={() =>
                                                    setFixModalOpen(true)
                                                }
                                            >
                                                <Wrench className="h-3 w-3" />
                                                Fix Now
                                            </Button>
                                        )}

                                        {/* Standard nav hint */}
                                        {check.navHint && (
                                            <>
                                                {check.navHint.href ? (
                                                    <Link
                                                        href={check.navHint.href}
                                                    >
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 text-[10px] gap-1"
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                            {check.navHint.label}
                                                        </Button>
                                                    </Link>
                                                ) : check.navHint.tab &&
                                                  onSwitchTab ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 text-[10px] gap-1"
                                                        onClick={() =>
                                                            onSwitchTab(
                                                                check.navHint!.tab!
                                                            )
                                                        }
                                                    >
                                                        <ArrowRight className="h-3 w-3" />
                                                        {check.navHint.label}
                                                    </Button>
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div
                        className={`text-xs font-medium px-3 py-2 rounded-md ${
                            !allClear
                                ? "bg-red-500/10 text-red-700 dark:text-red-400"
                                : warningsFailed.length > 0
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        }`}
                    >
                        {!allClear
                            ? `${blockingFailed.length} issue(s) must be resolved before locking`
                            : warningsFailed.length > 0
                            ? `Ready to lock — ${warningsFailed.length} warning(s) noted`
                            : "All checks passed — ready to lock"}
                    </div>
                </CardContent>
            </Card>

            {/* Zero Net Pay Fix Modal */}
            <ZeroNetPayFixModal
                open={fixModalOpen}
                onClose={() => setFixModalOpen(false)}
                badPayslips={badNetPay}
                getEmpName={getEmpName}
                deletePayslip={deletePayslip}
                role={role}
            />
        </>
    );
}
