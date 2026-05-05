"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { usePayrollStore } from "@/store/payroll.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useLeaveStore } from "@/store/leave.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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
    FileWarning,
    Send,
    Eye,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════
   Payroll Pre-Run Readiness Checklist (FEAT-01 / FEAT-02)

   Validation gate rendered inside the Lock Run confirmation dialog.
   Reads from Zustand stores — no API calls.
   Communicates pass/fail to parent via onAllChecksPassed callback.
   Includes inline actions for publishing draft payslips.
   ═══════════════════════════════════════════════════════════════ */

interface PayrollReadinessChecklistProps {
    /** ID of the PayrollRun being locked */
    runId: string;
    /** Period label (e.g. "2026-05-01/2026-05-15") */
    periodLabel: string;
    /** Payslip IDs belonging to this run */
    payslipIds: string[];
    /** Callback fired whenever blocking-check result changes */
    onAllChecksPassed: (passed: boolean) => void;
}

interface CheckResult {
    id: string;
    label: string;
    passed: boolean;
    blocking: boolean;
    message: string;
    count?: number;
    icon: React.ReactNode;
}

export function PayrollReadinessChecklist({
    runId,
    periodLabel,
    payslipIds,
    onAllChecksPassed,
}: PayrollReadinessChecklistProps) {
    // ── Store selectors ──────────────────────────────────────────
    const payslips = usePayrollStore((s) => s.payslips);
    const adjustments = usePayrollStore((s) => s.adjustments);
    const publishPayslip = usePayrollStore((s) => s.publishPayslip);
    const exceptions = useAttendanceStore((s) => s.exceptions);
    const getPendingLeaves = useLeaveStore((s) => s.getPending);
    const employees = useEmployeesStore((s) => s.employees);

    const [showReview, setShowReview] = useState(false);

    // Parse period from label "YYYY-MM-DD/YYYY-MM-DD"
    const [periodStart, periodEnd] = periodLabel.split("/");

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    // ── Run payslips in this run ─────────────────────────────────
    const runPayslips = useMemo(
        () => payslips.filter((p) => payslipIds.includes(p.id)),
        [payslips, payslipIds]
    );
    const draftPayslips = useMemo(
        () => runPayslips.filter((p) => p.status === "draft"),
        [runPayslips]
    );

    // ── Run all 6 checks ─────────────────────────────────────────
    const checks = useMemo<CheckResult[]>(() => {
        // Check 1 — Missing clock-outs (BLOCKING)
        const missingOuts = exceptions.filter(
            (ex) =>
                ex.flag === "missing_out" &&
                !ex.resolvedAt &&
                periodStart && periodEnd &&
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
        };

        // Check 2 — Payslips exist for this run (BLOCKING)
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
        };

        // Check 3 — No zero or negative net pay (BLOCKING)
        const badNetPay = runPayslips.filter((p) => p.netPay <= 0);
        const check3: CheckResult = {
            id: "no-zero-netpay",
            label: "No zero/negative net pay",
            passed: badNetPay.length === 0,
            blocking: true,
            message:
                badNetPay.length === 0
                    ? "All payslips have positive net pay"
                    : `${badNetPay.length} payslip(s) have ₱0 or negative net pay`,
            count: badNetPay.length,
            icon: <Banknote className="h-4 w-4" />,
        };

        // Check 4 — All payslips published (BLOCKING)
        const check4: CheckResult = {
            id: "all-published",
            label: "All payslips published",
            passed: draftPayslips.length === 0,
            blocking: true,
            message:
                draftPayslips.length === 0
                    ? "All payslips have been published"
                    : `${draftPayslips.length} payslip(s) are still in draft — publish before locking`,
            count: draftPayslips.length,
            icon: <FileWarning className="h-4 w-4" />,
        };

        // Check 5 — No pending leave requests in period (WARNING)
        const pendingLeaves = periodStart && periodEnd
            ? getPendingLeaves().filter(
                (r) => r.startDate <= periodEnd && r.endDate >= periodStart
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
        };

        // Check 6 — No pending payroll adjustments (WARNING)
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
        };

        return [check1, check2, check3, check4, check5, check6];
    }, [exceptions, runPayslips, draftPayslips, adjustments, getPendingLeaves, periodStart, periodEnd]);

    // ── Derive overall readiness ─────────────────────────────────
    const blockingFailed = checks.filter((c) => c.blocking && !c.passed);
    const warningsFailed = checks.filter((c) => !c.blocking && !c.passed);
    const allClear = blockingFailed.length === 0;

    // Stable ref for callback — avoids infinite loop when parent passes inline arrow
    const callbackRef = useRef(onAllChecksPassed);
    useEffect(() => {
        callbackRef.current = onAllChecksPassed;
    }, [onAllChecksPassed]);

    // Notify parent only when readiness actually changes
    useEffect(() => {
        callbackRef.current(allClear);
    }, [allClear]);

    // ── Publish all draft payslips in this run ───────────────────
    const handlePublishAll = () => {
        draftPayslips.forEach((p) => publishPayslip(p.id));
        toast.success(`Published ${draftPayslips.length} payslip(s)`);
        setShowReview(false);
    };

    // ── Render ───────────────────────────────────────────────────
    return (
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
                            {warningsFailed.length} Warning{warningsFailed.length > 1 ? "s" : ""}
                        </Badge>
                    )}
                    {!allClear && (
                        <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 text-[10px] border-0">
                            {blockingFailed.length} Blocker{blockingFailed.length > 1 ? "s" : ""}
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

                                {/* Check icon + label */}
                                <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                                    {check.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium leading-tight">
                                        {check.label}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                                        {check.message}
                                    </p>
                                </div>

                                {/* Count badge */}
                                {!check.passed && check.count !== undefined && check.count > 0 && (
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

                            {/* Draft payslips action row */}
                            {check.id === "all-published" && !check.passed && (
                                <div className="mt-1.5 ml-6 space-y-2">
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            className="h-7 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700"
                                            onClick={handlePublishAll}
                                        >
                                            <Send className="h-3 w-3" />
                                            Publish All ({draftPayslips.length})
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs gap-1.5"
                                            onClick={() => setShowReview(!showReview)}
                                        >
                                            <Eye className="h-3 w-3" />
                                            Review & Publish
                                            {showReview
                                                ? <ChevronUp className="h-3 w-3" />
                                                : <ChevronDown className="h-3 w-3" />}
                                        </Button>
                                    </div>

                                    {/* Inline review table */}
                                    {showReview && (
                                        <div className="border border-border/50 rounded-lg overflow-hidden max-h-[180px] overflow-y-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="text-[10px] py-1.5">Employee</TableHead>
                                                        <TableHead className="text-[10px] py-1.5">Net Pay</TableHead>
                                                        <TableHead className="text-[10px] py-1.5">Status</TableHead>
                                                        <TableHead className="text-[10px] py-1.5 w-20"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {draftPayslips.map((ps) => (
                                                        <TableRow key={ps.id}>
                                                            <TableCell className="text-xs py-1.5 font-medium">
                                                                {getEmpName(ps.employeeId)}
                                                            </TableCell>
                                                            <TableCell className="text-xs py-1.5">
                                                                ₱{ps.netPay.toLocaleString()}
                                                            </TableCell>
                                                            <TableCell className="py-1.5">
                                                                <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400">
                                                                    draft
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="py-1.5">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 text-[10px] text-violet-600 hover:text-violet-700"
                                                                    onClick={() => {
                                                                        publishPayslip(ps.id);
                                                                        toast.success(`Published payslip for ${getEmpName(ps.employeeId)}`);
                                                                    }}
                                                                >
                                                                    <Send className="h-3 w-3 mr-1" />
                                                                    Publish
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer status */}
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
    );
}
