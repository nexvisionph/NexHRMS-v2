"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useOTReviewStore } from "@/store/overtime-review.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useDepartmentsStore } from "@/store/departments.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
    Clock, CheckCircle, XCircle, AlertCircle, Eye, Loader2,
    ChevronDown, ChevronUp, RefreshCw, Filter, Users, Calculator,
    TrendingUp, Calendar, Edit, Save, X,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { format, subMonths } from "date-fns";
import type { OTRecord, OTRecordStatus, OTType } from "@/types";
import { OT_TYPE_LABELS } from "@/lib/ot-computation";
import { useParams } from "next/navigation";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   STATUS + TYPE UI HELPERS
═══════════════════════════════════════════════════════════════ */

const STATUS_CONFIG: Record<OTRecordStatus, { label: string; className: string }> = {
    pending:              { label: "Pending",            className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300/50" },
    approved:             { label: "Approved",           className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300/50" },
    partially_approved:   { label: "Partial",            className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-300/50" },
    rejected:             { label: "Rejected",           className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-300/50" },
    locked:               { label: "Locked",             className: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-300/50" },
    included_in_payroll:  { label: "In Payroll",         className: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-300/50" },
};

function StatusBadge({ status }: { status: OTRecordStatus }) {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    return (
        <Badge variant="outline" className={`text-[10px] font-semibold border ${cfg.className}`}>
            {cfg.label}
        </Badge>
    );
}

function aggregateStatus(statuses: OTRecordStatus[]): OTRecordStatus {
    if (statuses.length === 0) return "pending";
    if (statuses.every((s) => s === "approved")) return "approved";
    if (statuses.every((s) => s === "rejected")) return "rejected";
    if (statuses.every((s) => s === "included_in_payroll")) return "included_in_payroll";
    if (statuses.every((s) => s === "locked")) return "locked";
    if (statuses.some((s) => s === "pending")) return "pending";
    return "partially_approved";
}

/* ═══════════════════════════════════════════════════════════════
   MAIN VIEW
═══════════════════════════════════════════════════════════════ */

export default function OTReviewView() {
    const params = useParams();
    const role = params.role as string;

    const { records, isLoading, fetchRecords, computeForPeriod, approveRecord, rejectRecord, batchApprove, batchReject } = useOTReviewStore();
    const currentUser = useAuthStore((s) => s.currentUser);
    const employees = useEmployeesStore((s) => s.employees);
    const departments = useDepartmentsStore((s) => s.departments);

    // ─── Filter state ────────────────────────────────────────────
    const last6Months = useMemo(() => Array.from({ length: 6 }, (_, i) => format(subMonths(new Date(), i), "yyyy-MM")), []);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
    const [cutoff, setCutoff] = useState<"first" | "second" | "full">("first");
    const [deptFilter, setDeptFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState<OTRecordStatus | "all">("all");
    const [otTypeFilter, setOtTypeFilter] = useState<OTType | "all">("all");
    const [empSearch, setEmpSearch] = useState("");

    // ─── Computed period ─────────────────────────────────────────
    const { periodStart, periodEnd, periodId } = useMemo(() => {
        const base = selectedMonth;
        let start: string, end: string;
        if (cutoff === "first") {
            start = `${base}-01`;
            end = `${base}-15`;
        } else if (cutoff === "second") {
            const lastDay = new Date(parseInt(base.slice(0, 4)), parseInt(base.slice(5, 7)), 0).getDate();
            start = `${base}-16`;
            end = `${base}-${lastDay}`;
        } else {
            const lastDay = new Date(parseInt(base.slice(0, 4)), parseInt(base.slice(5, 7)), 0).getDate();
            start = `${base}-01`;
            end = `${base}-${lastDay}`;
        }
        return { periodStart: start, periodEnd: end, periodId: `${start}/${end}` };
    }, [selectedMonth, cutoff]);

    // ─── Load OT records on filter change ────────────────────────
    const loadRecords = useCallback(() => {
        fetchRecords({ periodStart, periodEnd });
    }, [fetchRecords, periodStart, periodEnd]);

    useEffect(() => { loadRecords(); }, [loadRecords]);

    // ─── Dialogs ─────────────────────────────────────────────────
    const [breakdownEmployee, setBreakdownEmployee] = useState<string | null>(null);
    const [computeConfirmOpen, setComputeConfirmOpen] = useState(false);
    const [isComputing, setIsComputing] = useState(false);

    // ─── Filter records for the current period ───────────────────
    const periodRecords = useMemo(
        () => records.filter((r) => r.payrollPeriodId === periodId),
        [records, periodId]
    );

    // ─── Group by employee ───────────────────────────────────────
    const employeeGroups = useMemo(() => {
        const map = new Map<string, OTRecord[]>();
        for (const r of periodRecords) {
            if (!map.has(r.employeeId)) map.set(r.employeeId, []);
            map.get(r.employeeId)!.push(r);
        }
        return map;
    }, [periodRecords]);

    const getEmployee = (id: string) => employees.find((e) => e.id === id);

    // ─── Build summary rows (per employee) ───────────────────────
    type EmpSummary = {
        employeeId: string;
        name: string;
        department: string;
        computedHours: number;
        approvedHours: number;
        computedAmount: number;
        approvedAmount: number;
        status: OTRecordStatus;
        records: OTRecord[];
    };

    const summaryRows = useMemo<EmpSummary[]>(() => {
        const rows: EmpSummary[] = [];
        employeeGroups.forEach((recs, empId) => {
            const emp = getEmployee(empId);
            const dept = emp?.department ?? recs[0]?.employee?.department ?? "—";
            // Dept filter
            if (deptFilter !== "all" && dept !== deptFilter) return;
            // Status filter
            const aggStatus = aggregateStatus(recs.map((r) => r.status));
            if (statusFilter !== "all" && aggStatus !== statusFilter) return;
            // OT type filter
            if (otTypeFilter !== "all" && !recs.some((r) => r.otType === otTypeFilter)) return;
            // Name search
            const name = emp?.name ?? empId;
            if (empSearch && !name.toLowerCase().includes(empSearch.toLowerCase())) return;

            rows.push({
                employeeId: empId,
                name,
                department: dept,
                computedHours: recs.reduce((s, r) => s + r.computedOtHours, 0),
                approvedHours: recs.reduce((s, r) => s + (r.approvedOtHours ?? 0), 0),
                computedAmount: recs.reduce((s, r) => s + r.computedAmount, 0),
                approvedAmount: recs.reduce((s, r) => s + (r.approvedAmount ?? 0), 0),
                status: aggStatus,
                records: recs,
            });
        });
        return rows.sort((a, b) => {
            // Pending first
            if (a.status === "pending" && b.status !== "pending") return -1;
            if (b.status === "pending" && a.status !== "pending") return 1;
            return a.name.localeCompare(b.name);
        });
    }, [employeeGroups, deptFilter, statusFilter, otTypeFilter, empSearch, employees]);

    // ─── Summary stats ───────────────────────────────────────────
    const stats = useMemo(() => ({
        totalPending: periodRecords.filter((r) => r.status === "pending").length,
        totalApprovedHours: periodRecords.reduce((s, r) => s + (r.approvedOtHours ?? 0), 0),
        totalApprovedAmount: periodRecords.reduce((s, r) => s + (r.approvedAmount ?? 0), 0),
        totalComputedHours: periodRecords.reduce((s, r) => s + r.computedOtHours, 0),
        employeeCount: employeeGroups.size,
    }), [periodRecords, employeeGroups]);

    // ─── Compute OT handler ──────────────────────────────────────
    const handleCompute = async () => {
        setIsComputing(true);
        setComputeConfirmOpen(false);
        try {
            const result = await computeForPeriod(periodStart, periodEnd);
            if (result.created === 0) {
                toast.info("No new OT records found for this period.");
            } else {
                toast.success(`${result.created} OT record${result.created !== 1 ? "s" : ""} computed successfully.`);
            }
        } catch {
            toast.error("Failed to compute OT records.");
        } finally {
            setIsComputing(false);
        }
    };

    const uniqueDepts = useMemo(
        () => [...new Set(employees.filter((e) => e.status === "active").map((e) => e.department).filter(Boolean))].sort(),
        [employees]
    );

    return (
        <div className="space-y-6">
            {/* ─── Header ─────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Clock className="h-6 w-6 text-amber-500" />
                        Overtime Review
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Review and approve computed OT before payroll inclusion
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadRecords}
                        disabled={isLoading}
                        className="gap-1.5"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => setComputeConfirmOpen(true)}
                        disabled={isComputing}
                    >
                        {isComputing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calculator className="h-3.5 w-3.5" />}
                        Compute OT
                    </Button>
                </div>
            </div>

            {/* ─── Stats Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground uppercase font-medium">Pending Review</p>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.totalPending}</p>
                        <p className="text-[10px] text-muted-foreground">records</p>
                    </CardContent>
                </Card>
                <Card className="border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground uppercase font-medium">Approved OT Hours</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.totalApprovedHours.toFixed(1)}</p>
                        <p className="text-[10px] text-muted-foreground">hours approved</p>
                    </CardContent>
                </Card>
                <Card className="border border-purple-200/60 dark:border-purple-800/40 bg-purple-50/50 dark:bg-purple-950/20">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground uppercase font-medium">Approved OT Amount</p>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{formatCurrency(stats.totalApprovedAmount)}</p>
                        <p className="text-[10px] text-muted-foreground">for payroll</p>
                    </CardContent>
                </Card>
                <Card className="border border-slate-200/60 dark:border-slate-800/40">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground uppercase font-medium">Total Computed</p>
                        <p className="text-2xl font-bold mt-1">{stats.totalComputedHours.toFixed(1)}</p>
                        <p className="text-[10px] text-muted-foreground">{stats.employeeCount} employees with OT</p>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Filters ─────────────────────────────────────── */}
            <Card className="border border-border/50">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Filter className="h-3.5 w-3.5" />
                            Filters
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">Month</Label>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="h-8 w-36 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {last6Months.map((m) => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">Cutoff</Label>
                            <Select value={cutoff} onValueChange={(v) => setCutoff(v as typeof cutoff)}>
                                <SelectTrigger className="h-8 w-36 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="first">1st (1–15)</SelectItem>
                                    <SelectItem value="second">2nd (16–EOM)</SelectItem>
                                    <SelectItem value="full">Full Month</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">Department</Label>
                            <Select value={deptFilter} onValueChange={setDeptFilter}>
                                <SelectTrigger className="h-8 w-40 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Depts</SelectItem>
                                    {uniqueDepts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">Status</Label>
                            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                                <SelectTrigger className="h-8 w-40 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="partially_approved">Partial</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                    <SelectItem value="included_in_payroll">In Payroll</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">OT Type</Label>
                            <Select value={otTypeFilter} onValueChange={(v) => setOtTypeFilter(v as typeof otTypeFilter)}>
                                <SelectTrigger className="h-8 w-44 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    {(Object.entries(OT_TYPE_LABELS) as [OTType, string][]).map(([k, v]) => (
                                        <SelectItem key={k} value={k}>{v}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                            <Label className="text-[10px] text-muted-foreground uppercase">Employee</Label>
                            <Input
                                placeholder="Search by name…"
                                value={empSearch}
                                onChange={(e) => setEmpSearch(e.target.value)}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                        Period: <span className="font-mono font-medium">{periodStart} → {periodEnd}</span>
                        {" · "}{summaryRows.length} employee{summaryRows.length !== 1 ? "s" : ""} with OT
                    </p>
                </CardContent>
            </Card>

            {/* ─── Main Table ──────────────────────────────────── */}
            <Card className="border border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="text-xs">Employee</TableHead>
                                    <TableHead className="text-xs">Department</TableHead>
                                    <TableHead className="text-xs text-right">Computed Hrs</TableHead>
                                    <TableHead className="text-xs text-right">Approved Hrs</TableHead>
                                    <TableHead className="text-xs text-right">Computed Amt</TableHead>
                                    <TableHead className="text-xs text-right">Approved Amt</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                                            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                                            Loading OT records…
                                        </TableCell>
                                    </TableRow>
                                ) : summaryRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                                            <Clock className="h-8 w-8 mx-auto mb-3 opacity-30" />
                                            <p className="font-medium">No OT records for this period</p>
                                            <p className="text-xs mt-1">Click <strong>Compute OT</strong> to detect overtime from attendance logs.</p>
                                        </TableCell>
                                    </TableRow>
                                ) : summaryRows.map((row) => (
                                    <TableRow key={row.employeeId} className="hover:bg-muted/20">
                                        <TableCell className="font-medium text-sm">{row.name}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{row.department}</TableCell>
                                        <TableCell className="text-right font-mono text-sm">{row.computedHours.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                            {row.approvedHours.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">{formatCurrency(row.computedAmount)}</TableCell>
                                        <TableCell className="text-right text-sm font-semibold">{formatCurrency(row.approvedAmount)}</TableCell>
                                        <TableCell><StatusBadge status={row.status} /></TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 gap-1 text-xs"
                                                onClick={() => setBreakdownEmployee(row.employeeId)}
                                            >
                                                <Eye className="h-3 w-3" />
                                                View Breakdown
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* ─── Employee Breakdown Dialog ───────────────────── */}
            {breakdownEmployee && (
                <EmployeeBreakdownDialog
                    employeeId={breakdownEmployee}
                    records={(employeeGroups.get(breakdownEmployee) ?? []).sort((a, b) => a.otDate.localeCompare(b.otDate))}
                    employeeName={getEmployee(breakdownEmployee)?.name ?? breakdownEmployee}
                    reviewerId={currentUser.id}
                    onApprove={approveRecord}
                    onReject={rejectRecord}
                    onBatchApprove={(ids) => batchApprove(ids, currentUser.id)}
                    onBatchReject={(ids, remarks) => batchReject(ids, remarks, currentUser.id)}
                    onClose={() => setBreakdownEmployee(null)}
                />
            )}

            {/* ─── Compute Confirm Dialog ──────────────────────── */}
            <AlertDialog open={computeConfirmOpen} onOpenChange={setComputeConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Compute OT for {periodStart} → {periodEnd}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will scan attendance logs for this period, detect overtime hours based on shift schedules, and create <strong>Pending</strong> OT records for HR review.
                            Existing OT records will not be duplicated.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCompute} className="bg-amber-600 hover:bg-amber-700">
                            Compute OT
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   EMPLOYEE BREAKDOWN DIALOG
═══════════════════════════════════════════════════════════════ */

function EmployeeBreakdownDialog({
    employeeId,
    records,
    employeeName,
    reviewerId,
    onApprove,
    onReject,
    onBatchApprove,
    onBatchReject,
    onClose,
}: {
    employeeId: string;
    records: OTRecord[];
    employeeName: string;
    reviewerId: string;
    onApprove: (id: string, hours: number, remarks?: string, reviewedBy?: string) => Promise<void>;
    onReject: (id: string, remarks?: string, reviewedBy?: string) => Promise<void>;
    onBatchApprove: (ids: string[]) => Promise<void>;
    onBatchReject: (ids: string[], remarks?: string) => Promise<void>;
    onClose: () => void;
}) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editHours, setEditHours] = useState("");
    const [editRemarks, setEditRemarks] = useState("");
    const [saving, setSaving] = useState<string | null>(null);
    const [batchRemarksOpen, setBatchRemarksOpen] = useState(false);
    const [batchAction, setBatchAction] = useState<"approve" | "reject">("approve");
    const [batchRemarks, setBatchRemarks] = useState("");

    const pendingIds = records.filter((r) => r.status === "pending").map((r) => r.id);
    const totalComputed = records.reduce((s, r) => s + r.computedOtHours, 0);
    const totalApproved = records.reduce((s, r) => s + (r.approvedOtHours ?? 0), 0);
    const totalApprovedAmt = records.reduce((s, r) => s + (r.approvedAmount ?? 0), 0);

    const openEdit = (rec: OTRecord) => {
        setEditingId(rec.id);
        setEditHours(String(rec.approvedOtHours ?? rec.computedOtHours));
        setEditRemarks(rec.remarks ?? "");
    };

    const handleSaveApprove = async (id: string) => {
        const h = parseFloat(editHours);
        if (isNaN(h) || h < 0) { toast.error("Enter a valid number of hours"); return; }
        setSaving(id);
        await onApprove(id, h, editRemarks, reviewerId);
        setSaving(null);
        setEditingId(null);
    };

    const handleRejectSingle = async (id: string) => {
        setSaving(id);
        await onReject(id, editingId === id ? editRemarks : undefined, reviewerId);
        setSaving(null);
        setEditingId(null);
    };

    const handleBatchAction = async () => {
        setBatchRemarksOpen(false);
        if (batchAction === "approve") {
            await onBatchApprove(pendingIds);
            toast.success(`Approved ${pendingIds.length} OT record${pendingIds.length !== 1 ? "s" : ""}`);
        } else {
            await onBatchReject(pendingIds, batchRemarks);
            toast.success(`Rejected ${pendingIds.length} OT record${pendingIds.length !== 1 ? "s" : ""}`);
        }
        setBatchRemarks("");
    };

    return (
        <Dialog open onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-amber-500" />
                        OT Breakdown — {employeeName}
                    </DialogTitle>
                </DialogHeader>

                {/* Summary bar */}
                <div className="flex flex-wrap gap-4 p-3 bg-muted/30 rounded-lg text-sm">
                    <div>
                        <span className="text-muted-foreground text-xs">Computed</span>
                        <p className="font-bold font-mono">{totalComputed.toFixed(2)} hrs</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground text-xs">Approved</span>
                        <p className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{totalApproved.toFixed(2)} hrs</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground text-xs">Approved Amount</span>
                        <p className="font-bold">{formatCurrency(totalApprovedAmt)}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        {pendingIds.length > 0 && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1 border-red-300 text-red-600 hover:bg-red-50"
                                    onClick={() => { setBatchAction("reject"); setBatchRemarksOpen(true); }}
                                >
                                    <XCircle className="h-3 w-3" />
                                    Reject All Pending
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => onBatchApprove(pendingIds).then(() => toast.success("All pending OT approved"))}
                                >
                                    <CheckCircle className="h-3 w-3" />
                                    Approve All Pending
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Records table */}
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/20">
                                <TableHead className="text-xs">Date</TableHead>
                                <TableHead className="text-xs">Shift Out</TableHead>
                                <TableHead className="text-xs">Actual Out</TableHead>
                                <TableHead className="text-xs text-right">Computed Hrs</TableHead>
                                <TableHead className="text-xs text-right">Approved Hrs</TableHead>
                                <TableHead className="text-xs">OT Type</TableHead>
                                <TableHead className="text-xs text-right">Computed Amt</TableHead>
                                <TableHead className="text-xs text-right">Approved Amt</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs">Remarks</TableHead>
                                <TableHead className="text-xs text-center">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {records.map((rec) => (
                                <TableRow key={rec.id} className={editingId === rec.id ? "bg-amber-50/50 dark:bg-amber-950/20" : "hover:bg-muted/10"}>
                                    <TableCell className="text-xs font-mono">{rec.otDate}</TableCell>
                                    <TableCell className="text-xs font-mono">{rec.scheduledTimeOut ?? "—"}</TableCell>
                                    <TableCell className="text-xs font-mono">{rec.actualTimeOut ?? "—"}</TableCell>
                                    <TableCell className="text-right text-xs font-mono">{rec.computedOtHours.toFixed(2)}</TableCell>
                                    <TableCell className="text-right text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                        {rec.approvedOtHours != null ? rec.approvedOtHours.toFixed(2) : "—"}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-[10px] font-medium">{OT_TYPE_LABELS[rec.otType]}</span>
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">{formatCurrency(rec.computedAmount)}</TableCell>
                                    <TableCell className="text-right text-xs font-semibold">
                                        {rec.approvedAmount != null ? formatCurrency(rec.approvedAmount) : "—"}
                                    </TableCell>
                                    <TableCell><StatusBadge status={rec.status} /></TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate" title={rec.remarks ?? ""}>
                                        {rec.remarks || "—"}
                                    </TableCell>
                                    <TableCell>
                                        {rec.status === "locked" || rec.status === "included_in_payroll" ? (
                                            <span className="text-[10px] text-muted-foreground">Locked</span>
                                        ) : editingId === rec.id ? (
                                            <div className="flex flex-col gap-1.5 min-w-[220px]">
                                                <div className="flex items-center gap-1.5">
                                                    <Input
                                                        type="number"
                                                        step="0.25"
                                                        min="0"
                                                        max={rec.computedOtHours + 1}
                                                        value={editHours}
                                                        onChange={(e) => setEditHours(e.target.value)}
                                                        className="h-7 text-xs w-20"
                                                        placeholder="hrs"
                                                    />
                                                    <span className="text-xs text-muted-foreground">/ {rec.computedOtHours} hrs</span>
                                                </div>
                                                <Input
                                                    value={editRemarks}
                                                    onChange={(e) => setEditRemarks(e.target.value)}
                                                    className="h-7 text-xs"
                                                    placeholder="Remarks…"
                                                />
                                                <div className="flex gap-1">
                                                    <Button
                                                        size="sm"
                                                        className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                                                        onClick={() => handleSaveApprove(rec.id)}
                                                        disabled={saving === rec.id}
                                                    >
                                                        {saving === rec.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Save className="h-2.5 w-2.5" />}
                                                        Save
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-6 text-[10px] border-red-300 text-red-600 px-2"
                                                        onClick={() => handleRejectSingle(rec.id)}
                                                        disabled={saving === rec.id}
                                                    >
                                                        <XCircle className="h-2.5 w-2.5" />
                                                        Reject
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 text-[10px] px-1"
                                                        onClick={() => setEditingId(null)}
                                                    >
                                                        <X className="h-2.5 w-2.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                {rec.status === "pending" && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                                            title="Approve"
                                                            onClick={async () => {
                                                                setSaving(rec.id);
                                                                await onApprove(rec.id, rec.computedOtHours, undefined, reviewerId);
                                                                setSaving(null);
                                                            }}
                                                            disabled={saving === rec.id}
                                                        >
                                                            {saving === rec.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-red-500 hover:bg-red-50 hover:text-red-700"
                                                            title="Reject"
                                                            onClick={async () => {
                                                                setSaving(rec.id);
                                                                await onReject(rec.id, undefined, reviewerId);
                                                                setSaving(null);
                                                            }}
                                                            disabled={saving === rec.id}
                                                        >
                                                            <XCircle className="h-3 w-3" />
                                                        </Button>
                                                    </>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                    title="Edit approved hours"
                                                    onClick={() => openEdit(rec)}
                                                >
                                                    <Edit className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>

            {/* Batch reject remarks dialog */}
            <AlertDialog open={batchRemarksOpen} onOpenChange={setBatchRemarksOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject All Pending OT?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingIds.length} pending OT record{pendingIds.length !== 1 ? "s" : ""} will be rejected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-1">
                        <Textarea
                            placeholder="Reason for rejection (optional)…"
                            value={batchRemarks}
                            onChange={(e) => setBatchRemarks(e.target.value)}
                            className="text-sm"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBatchAction} className="bg-red-600 hover:bg-red-700">
                            Reject All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    );
}
