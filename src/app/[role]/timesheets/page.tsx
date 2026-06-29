"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { format, endOfMonth } from "date-fns";
import { useTimesheetStore, computeTimesheetLocal } from "@/store/timesheet.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useLeaveStore } from "@/store/leave.store";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { useEmployeesStore } from "@/store/employees.store";
import * as tsService from "@/services/timesheet-actions.service";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableEmptyState,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Clock, CheckCircle2, AlertCircle, Eye,
    Check, X, Search, User, Info, FileOutput, Trash2,
    CheckSquare
} from "lucide-react";
import type { Timesheet, AttendanceLog } from "@/types";
import { EmployeeCombobox } from "@/components/ui/employee-combobox";
import { DEFAULT_HOLIDAYS } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";

export default function TimesheetsPage() {
    const { timesheets, ruleSets, getPendingApproval } = useTimesheetStore();
    const { logs, employeeShifts, shiftTemplates, bulkUpsertLogs } = useAttendanceStore();
    const { hasLeaveConflict } = useLeaveStore();
    const { employees } = useEmployeesStore();
    const { currentUser } = useAuthStore();
    const { hasPermission } = useRolesStore();

    const isHoliday = (date: string) => {
        return DEFAULT_HOLIDAYS.find(h => h.date === date);
    };

    const isSupervisor = hasPermission(currentUser.role, "page:attendance");
    const isPayrollAdmin = 
        currentUser.role === "admin" || 
        currentUser.role === "hr" || 
        currentUser.role === "finance" || 
        currentUser.role === "payroll_admin" ||
        hasPermission(currentUser.role, "timesheets:view_all");
    const myEmpId = currentUser.id;

    const getEmpName = useCallback((id: string) => {
        const emp = employees.find(e => e.id === id);
        return emp?.name || id;
    }, [employees]);

    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [empFilter, setEmpFilter] = useState<string>("all");
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
    const [cutoff, setCutoff] = useState<"first" | "second">(() =>
        new Date().getDate() > 15 ? "second" : "first"
    );
    const [viewTs, setViewTs] = useState<Timesheet | null>(null);
    const [showClearDialog, setShowClearDialog] = useState(false);

    // Batch Actions State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const handleBatchAction = async (action: "submit" | "approve" | "reject") => {
        if (selectedIds.length === 0) return;
        
        setComputing(true);
        try {
            let ok = false;
            if (action === "submit") ok = await tsService.submitTimesheets(selectedIds);
            if (action === "approve") ok = await tsService.approveTimesheets(selectedIds, currentUser.name);
            if (action === "reject") ok = await tsService.rejectTimesheets(selectedIds, currentUser.name);

            if (ok) {
                toast.success(`Successfully processed ${selectedIds.length} timesheets.`);
                setSelectedIds([]);
            } else {
                toast.error(`Failed to process selected timesheets.`);
            }
        } finally {
            setComputing(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filtered.length && filtered.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filtered.map(t => t.id));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSubmitAllComputed = async () => {
        const computedIds = filtered.filter(t => t.status === "computed" && (t.employeeId === myEmpId || isPayrollAdmin)).map(t => t.id);
        if (computedIds.length === 0) {
            toast.info("No 'Computed' records available to submit in this view.");
            return;
        }
        if (confirm(`Are you sure you want to submit all ${computedIds.length} computed timesheets for approval?`)) {
            setComputing(true);
            try {
                const ok = await tsService.submitTimesheets(computedIds);
                if (ok) toast.success(`Submitted ${computedIds.length} timesheets.`);
                else toast.error("Failed to submit timesheets.");
            } finally {
                setComputing(false);
            }
        }
    };

    const handleApproveAllSubmitted = async () => {
        if (!isSupervisor && !isPayrollAdmin) return;
        const submittedIds = filtered.filter(t => t.status === "submitted").map(t => t.id);
        if (submittedIds.length === 0) {
            toast.info("No 'Submitted' records found to approve in this period.");
            return;
        }
        if (confirm(`Approve all ${submittedIds.length} submitted timesheets in this period?`)) {
            setComputing(true);
            try {
                const ok = await tsService.approveTimesheets(submittedIds, currentUser.name);
                if (ok) toast.success(`Approved ${submittedIds.length} timesheets.`);
                else toast.error("Failed to approve timesheets.");
            } finally {
                setComputing(false);
            }
        }
    };

    // Quick Compute states (Month + Cutoff)
    const [computeEmpId, setComputeEmpId] = useState("");
    const [computeMonth, setComputeMonth] = useState(format(new Date(), "yyyy-MM"));
    const [computeCutoff, setComputeCutoff] = useState<"first" | "second">(() =>
        new Date().getDate() > 15 ? "second" : "first"
    );
    const [computeRuleSetId, setComputeRuleSetId] = useState("RS-DEFAULT");
    const [computing, setComputing] = useState(false);

    // Period boundary logic
    const getBounds = useCallback((month: string, cut: "first" | "second") => {
        const base = new Date(month + "-01");
        if (cut === "first") {
            return { start: `${month}-01`, end: `${month}-15` };
        } else {
            const eom = endOfMonth(base);
            return { start: `${month}-16`, end: format(eom, "yyyy-MM-dd") };
        }
    }, []);

    const periodBounds = useMemo(() => getBounds(selectedMonth, cutoff), [selectedMonth, cutoff, getBounds]);
    const computeBounds = useMemo(() => getBounds(computeMonth, computeCutoff), [computeMonth, computeCutoff, getBounds]);

    // Ensure the default Rule Set is selected once ruleSets are hydrated from the store
    useEffect(() => {
        if (ruleSets.length > 0 && !ruleSets.find(r => r.id === computeRuleSetId)) {
            setComputeRuleSetId(ruleSets[0].id);
        }
    }, [ruleSets, computeRuleSetId]);

    const getEmployeeShift = (empId: string) => {
        const sid = employeeShifts[empId];
        return sid ? shiftTemplates.find((s) => s.id === sid) : undefined;
    };

    const handleCompute = async () => {
        if (!computeEmpId) {
            toast.error("Please select an employee or 'All Employees.'");
            return;
        }

        const { holidays } = useAttendanceStore.getState();
        const isBulk = computeEmpId === "all";
        
        // Enumerate all dates in the compute period
        const dates: string[] = [];
        const d = new Date(computeBounds.start + "T00:00:00");
        const endD = new Date(computeBounds.end + "T00:00:00");
        while (d <= endD) {
            dates.push(format(d, "yyyy-MM-dd"));
            d.setDate(d.getDate() + 1);
        }

        setComputing(true);
        let totalProcessed = 0;
        const today = format(new Date(), "yyyy-MM-dd");

        try {
            for (const date of dates) {
                // 1. Detect Holiday (Highest Priority for Auto-Compute)
                const isHoliday = holidays.some(h => h.date === date && h.type === "regular");

                // Skip future dates unless it's a holiday
                if (date > today && !isHoliday) continue;

                const targets = isBulk 
                    ? logs.filter(l => l.date === date && (l.status === "present" || isHoliday)).map(l => l.employeeId)
                    : [computeEmpId];

                for (const empId of targets) {
                    const shift = getEmployeeShift(empId);
                    const empLogRaw = logs.find((l) => l.employeeId === empId && l.date === date);

                    // 2. Strict Filter: Only proceed if it's a Holiday OR the employee is explicitly 'Present'
                    if (!isHoliday && (!empLogRaw || empLogRaw.status !== "present")) continue;

                    let empLog = empLogRaw;

                    // Special Holiday Logic: Compute full shift hours even if no check-in exists
                    if (isHoliday) {
                        const stdHours = 8; // Default 8 hours for holiday pay
                        const tsId = `ATT-${date}-${empId}`;
                        const ts: Timesheet = {
                            id: tsId,
                            employeeId: empId,
                            date,
                            ruleSetId: computeRuleSetId,
                            regularHours: stdHours,
                            overtimeHours: 0,
                            nightDiffHours: 0,
                            lateMinutes: 0,
                            undertimeMinutes: 0,
                            totalHours: stdHours,
                            status: "computed",
                            computedAt: new Date().toISOString(),
                            segments: [{
                                id: `SEG-${date}-${empId}-HOL`,
                                timesheetId: tsId,
                                segmentType: "regular",
                                startTime: shift?.startTime || "08:00",
                                endTime: shift?.endTime || "17:00",
                                hours: stdHours,
                                multiplier: 1
                            }]
                        };
                        const ok = await tsService.saveComputedTimesheet(ts);
                        if (ok) totalProcessed++;
                        continue;
                    }

                    // Force Compute: Only for specific employee selection if log is missing
                    if (!empLog && !isBulk) {
                        if (isSupervisor || isPayrollAdmin) {
                            const defaultIn = shift?.startTime || "08:00";
                            const newLog = {
                                employeeId: empId,
                                date,
                                status: "present" as const,
                                checkIn: defaultIn,
                                checkOut: shift?.endTime || "17:00",
                            };
                            bulkUpsertLogs([newLog]);
                            empLog = { id: `ATT-${date}-${empId}`, ...newLog } as unknown as AttendanceLog;
                        }
                    }

                    if (!empLog?.checkIn) continue;

                    const ts = computeTimesheetLocal({
                        employeeId: empId,
                        date,
                        ruleSetId: computeRuleSetId,
                        checkIn: empLog.checkIn,
                        checkOut: empLog.checkOut || shift?.endTime || "17:00",
                        shiftStart: shift?.startTime || "08:00",
                        shiftEnd: shift?.endTime || "17:00",
                        breakDuration: shift?.breakDuration ?? 60,
                        ruleSets
                    });
                    
                    if (ts) {
                        const ok = await tsService.saveComputedTimesheet(ts);
                        if (ok) totalProcessed++;
                    }
                }
            }
            
            if (totalProcessed > 0) {
                toast.success(`Successfully processed ${totalProcessed} timesheet record${totalProcessed > 1 ? "s" : ""}`);
            } else {
                toast.info("No 'Present' logs or 'Holidays' found in this period to compute.");
            }
        } finally {
            setComputing(false);
        }
    };

    const performClear = async (includeApproved: boolean) => {
        const toClear = timesheets.filter((t) => 
            t.date >= periodBounds.start && 
            t.date <= periodBounds.end &&
            (empFilter === "all" || t.employeeId === empFilter) &&
            (includeApproved || t.status !== "approved")
        );

        if (toClear.length === 0) {
            toast.info("No timesheets found to clear in this period.");
            setShowClearDialog(false);
            return;
        }

        setComputing(true);
        let count = 0;
        try {
            for (const ts of toClear) {
                const ok = await tsService.clearTimesheet(ts.id);
                if (ok) count++;
            }
            toast.success(`Cleared ${count} timesheet record${count !== 1 ? "s" : ""}.`);
        } finally {
            setComputing(false);
            setShowClearDialog(false);
        }
    };

    const handleClearClick = () => {
        const periodTimesheets = timesheets.filter(t => 
            t.date >= periodBounds.start && 
            t.date <= periodBounds.end &&
            (empFilter === "all" || t.employeeId === empFilter)
        );

        if (periodTimesheets.length === 0) {
            toast.info("No timesheets found in this period to clear.");
            return;
        }

        const hasApproved = periodTimesheets.some(t => t.status === "approved");

        if (hasApproved) {
            setShowClearDialog(true);
        } else {
            if (confirm(`Are you sure you want to clear ${periodTimesheets.length} timesheets?`)) {
                performClear(false);
            }
        }
    };

    const handleAction = async (id: string, action: "submit" | "approve" | "reject") => {
        let ok = false;
        if (action === "submit") ok = await tsService.submitTimesheet(id);
        if (action === "approve") ok = await tsService.approveTimesheet(id, currentUser.name);
        if (action === "reject") ok = await tsService.rejectTimesheet(id, currentUser.name);
        
        const actionLabel: Record<string, string> = { submit: "submitted", approve: "approved", reject: "rejected" };
        if (ok) toast.success(`Timesheet ${actionLabel[action]}`);
        else toast.error(`Failed to ${action} timesheet. Please try again.`);
    };

    const filtered = useMemo(() => {
        let result = timesheets;
        
        // Apply Period Filtering
        result = result.filter((t) => t.date >= periodBounds.start && t.date <= periodBounds.end);
        
        if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);
        if (empFilter !== "all") result = result.filter((t) => t.employeeId === empFilter);
        
        // Non-admin/supervisor only see their own
        if (!isSupervisor && !isPayrollAdmin && myEmpId) {
            result = result.filter((t) => t.employeeId === myEmpId);
        }
        return result.sort((a, b) => b.date.localeCompare(a.date));
    }, [timesheets, statusFilter, empFilter, isSupervisor, isPayrollAdmin, myEmpId, periodBounds]);

    const pendingCount = getPendingApproval().length;

    const statusColors: Record<string, string> = {
        computed: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
        submitted: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
    };

    return (
        <div className="p-4 space-y-6 max-w-7xl mx-auto pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Clock className="h-6 w-6 text-primary" />
                        Timesheet Approval
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Verify and approve employee hours for payroll processing.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                            Pending Approval
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{pendingCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">Requires supervisor review</p>
                    </CardContent>
                </Card>
                <Card className="md:col-span-3">
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Search className="h-4 w-4" />
                            Bulk Compute Period
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-end gap-3">
                        <div className="space-y-1.5 min-w-[200px]">
                            <Label htmlFor="comp-emp" className="text-xs">Employee</Label>
                            <EmployeeCombobox value={computeEmpId} onValueChange={setComputeEmpId} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Period</Label>
                            <div className="flex items-center gap-1 border rounded-md p-1 bg-muted/20">
                                <Input 
                                    type="month" 
                                    value={computeMonth} 
                                    onChange={(e) => setComputeMonth(e.target.value)} 
                                    className="h-7 w-[120px] text-[10px] bg-transparent border-none focus-visible:ring-0" 
                                />
                                <div className="h-4 w-px bg-border mx-0.5" />
                                <Select value={computeCutoff} onValueChange={(v: "first" | "second") => setComputeCutoff(v)}>
                                    <SelectTrigger className="h-7 w-[90px] text-[10px] bg-transparent border-none focus-visible:ring-0">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="first" className="text-[10px]">1st Cutoff</SelectItem>
                                        <SelectItem value="second" className="text-[10px]">2nd Cutoff</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5 min-w-[150px]">
                            <Label htmlFor="comp-rules" className="text-xs">Rule Set</Label>
                            <Select value={computeRuleSetId} onValueChange={setComputeRuleSetId}>
                                <SelectTrigger id="comp-rules" className="h-9">
                                    <SelectValue placeholder="Select rules" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ruleSets.map(r => (
                                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleCompute} size="sm" className="h-9" disabled={computing}>
                            {computing ? "Processing..." : "Compute & Save Period"}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 whitespace-nowrap">
                            <FileOutput className="h-4 w-4" />
                            All Timesheets
                        </CardTitle>
                        
                        {/* Period Selectors */}
                        <div className="flex items-center gap-1.5 border rounded-lg p-1 bg-muted/30">
                            <Input 
                                type="month" 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="h-7 w-[135px] text-[10px] bg-transparent border-none focus-visible:ring-0"
                            />
                            <div className="h-4 w-px bg-border mx-0.5" />
                            <Select value={cutoff} onValueChange={(v: "first" | "second") => setCutoff(v)}>
                                <SelectTrigger className="h-7 w-[100px] text-[10px] bg-transparent border-none focus-visible:ring-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="first" className="text-[10px]">1st Cutoff</SelectItem>
                                    <SelectItem value="second" className="text-[10px]">2nd Cutoff</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {(isSupervisor || isPayrollAdmin) && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-[10px] gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                onClick={handleClearClick}
                                disabled={computing}
                            >
                                <X className="h-3 w-3" />
                                Clear Period
                            </Button>
                        )}

                        {selectedIds.length > 0 ? (
                            <div className="flex items-center gap-1.5 bg-primary/5 p-1 rounded-md border border-primary/20 ml-2">
                                <span className="text-[10px] font-bold px-2 text-primary">{selectedIds.length} Selected</span>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 text-[9px] gap-1 text-primary hover:bg-primary/10"
                                    onClick={() => handleBatchAction("submit")}
                                >
                                    <Check className="h-3 w-3" />
                                    Submit
                                </Button>
                                {(isSupervisor || isPayrollAdmin) && (
                                    <>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 text-[9px] gap-1 text-emerald-600 hover:bg-emerald-50"
                                            onClick={() => handleBatchAction("approve")}
                                        >
                                            <CheckCircle2 className="h-3 w-3" />
                                            Approve
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 text-[9px] gap-1 text-red-600 hover:bg-red-50"
                                            onClick={() => handleBatchAction("reject")}
                                        >
                                            <X className="h-3 w-3" />
                                            Reject
                                        </Button>
                                    </>
                                )}
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 text-[9px] text-muted-foreground"
                                    onClick={() => setSelectedIds([])}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 ml-2">
                                <Button 
                                    variant="default" 
                                    size="sm" 
                                    className="h-7 text-[10px] gap-1 bg-primary/90"
                                    onClick={handleSubmitAllComputed}
                                    disabled={computing}
                                >
                                    <CheckSquare className="h-3 w-3" />
                                    Submit Period
                                </Button>
                                {(isSupervisor || isPayrollAdmin) && (
                                    <Button 
                                        variant="default" 
                                        size="sm" 
                                        className="h-7 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700"
                                        onClick={handleApproveAllSubmitted}
                                        disabled={computing}
                                    >
                                        <CheckCircle2 className="h-3 w-3" />
                                        Approve Period
                                    </Button>
                                )}
                            </div>
                        )}

                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[10px] gap-1"
                            onClick={() => {
                                const headers = ["Date", "Employee Name", "Employee ID", "Regular", "OT", "Night", "Undertime", "Total", "Status"];
                                const rows = filtered.map(ts => [
                                    ts.date,
                                    getEmpName(ts.employeeId),
                                    ts.employeeId,
                                    ts.regularHours.toFixed(2),
                                    ts.overtimeHours.toFixed(2),
                                    ts.nightDiffHours.toFixed(2),
                                    ts.undertimeMinutes,
                                    ts.totalHours.toFixed(2),
                                    ts.status
                                ]);
                                const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
                                const blob = new Blob([csv], { type: "text/csv" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `timesheets-${selectedMonth}-${cutoff}.csv`;
                                a.click();
                            }}
                        >
                            <FileOutput className="h-3 w-3" />
                            Export CSV
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-8 w-[130px] text-xs">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="computed">Computed</SelectItem>
                                <SelectItem value="submitted">Submitted</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                        {isSupervisor || isPayrollAdmin ? (
                            <div className="w-[180px]">
                                <EmployeeCombobox value={empFilter} onValueChange={setEmpFilter} />
                            </div>
                        ) : null}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="w-[40px] pl-4">
                                    <Checkbox 
                                        checked={filtered.length > 0 && selectedIds.length === filtered.length}
                                        onCheckedChange={toggleSelectAll}
                                    />
                                </TableHead>
                                <TableHead className="w-[100px]">Date</TableHead>
                                <TableHead>Employee</TableHead>
                                <TableHead className="text-right">Regular</TableHead>
                                <TableHead className="text-right">OT</TableHead>
                                <TableHead className="text-right">Night</TableHead>
                                <TableHead className="text-right">Undertime</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableEmptyState
                                    icon={Clock}
                                    title="No timesheets found"
                                    description="Compute timesheets for the selected period to see results here."
                                    colSpan={10}
                                />
                            ) : (
                                filtered.map((ts) => (
                                    <TableRow key={ts.id} className={selectedIds.includes(ts.id) ? "bg-primary/5 hover:bg-primary/10" : ""}>
                                        <TableCell className="pl-4">
                                            <Checkbox 
                                                checked={selectedIds.includes(ts.id)}
                                                onCheckedChange={() => toggleSelect(ts.id)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium text-xs">
                                            <div className="flex flex-col gap-0.5">
                                                {new Date(ts.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                                                {isHoliday(ts.date) && (
                                                    <Badge variant="outline" className="text-[9px] w-fit py-0 px-1 bg-violet-100 text-violet-700 border-violet-200">
                                                        {isHoliday(ts.date)?.name}
                                                    </Badge>
                                                )}
                                                {hasLeaveConflict(ts.employeeId, ts.date) && (
                                                    <Badge variant="outline" className="text-[9px] w-fit py-0 px-1 bg-amber-100 text-amber-700 border-amber-200">
                                                        Approved Leave
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                    {getEmpName(ts.employeeId)}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground ml-4.5 uppercase tracking-tighter">
                                                    {ts.employeeId}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs font-mono">{ts.regularHours.toFixed(2)}</TableCell>
                                        <TableCell className="text-right text-xs font-mono text-amber-600">{ts.overtimeHours > 0 ? ts.overtimeHours.toFixed(2) : "—"}</TableCell>
                                        <TableCell className="text-right text-xs font-mono text-indigo-600">{ts.nightDiffHours > 0 ? ts.nightDiffHours.toFixed(2) : "—"}</TableCell>
                                        <TableCell className="text-right text-xs font-mono text-red-600">{ts.undertimeMinutes > 0 ? ts.undertimeMinutes : "—"}</TableCell>
                                        <TableCell className="text-right text-xs font-bold font-mono">{ts.totalHours.toFixed(2)}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={`text-[10px] uppercase font-bold py-0 h-5 ${statusColors[ts.status]}`}>
                                                {ts.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setViewTs(ts)}>
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                                {ts.status === "computed" && (ts.employeeId === myEmpId || isPayrollAdmin) && (
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" onClick={() => handleAction(ts.id, "submit")}>
                                                        <Check className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                {ts.status === "submitted" && (isSupervisor || isPayrollAdmin) && (
                                                    <>
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600" onClick={() => handleAction(ts.id, "approve")}>
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => handleAction(ts.id, "reject")}>
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Clear Choice Dialog */}
            <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 className="h-5 w-5" />
                            Clear Timesheets Choice
                        </DialogTitle>
                        <DialogDescription>
                            We detected <strong>Approved</strong> timesheets in this period. How would you like to proceed with the cleanup?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Button 
                            variant="outline" 
                            className="flex flex-col h-auto py-3 items-start gap-1"
                            onClick={() => performClear(false)}
                        >
                            <span className="font-bold">Clear Non-Approved Only</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-left">
                                Resets Computed & Submitted records. Approved data stays safe.
                            </span>
                        </Button>
                        <Button 
                            variant="destructive" 
                            className="flex flex-col h-auto py-3 items-start gap-1"
                            onClick={() => performClear(true)}
                        >
                            <span className="font-bold">Clear ALL (Including Approved)</span>
                            <span className="text-[10px] text-destructive-foreground/70 uppercase tracking-wider text-left">
                                Full Reset. Use this for major retroactive corrections.
                            </span>
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowClearDialog(false)}>Cancel</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewTs} onOpenChange={(o) => !o && setViewTs(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-primary" />
                            Timesheet Details
                        </DialogTitle>
                    </DialogHeader>
                    {viewTs && (
                        <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground uppercase">Employee</Label>
                                    <div className="text-sm font-bold text-primary">{getEmpName(viewTs.employeeId)}</div>
                                    <div className="text-[10px] text-muted-foreground uppercase">{viewTs.employeeId}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground uppercase">Date</Label>
                                    <div className="text-sm font-medium">{viewTs.date}</div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground uppercase">Status</Label>
                                    <div>
                                        <Badge variant="outline" className={`text-[10px] uppercase ${statusColors[viewTs.status]}`}>
                                            {viewTs.status}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground uppercase">Computed At</Label>
                                    <div className="text-[11px] text-muted-foreground">{new Date(viewTs.computedAt).toLocaleString()}</div>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <div className="bg-muted/50 p-2 text-xs font-bold border-b">Hours Breakdown</div>
                                <div className="divide-y text-xs">
                                    <div className="p-2 flex justify-between">
                                        <span>Regular Hours</span>
                                        <span className="font-mono">{viewTs.regularHours.toFixed(2)}</span>
                                    </div>
                                    <div className="p-2 flex justify-between text-amber-600">
                                        <span>Overtime Hours</span>
                                        <span className="font-mono">{viewTs.overtimeHours.toFixed(2)}</span>
                                    </div>
                                    <div className="p-2 flex justify-between text-indigo-600">
                                        <span>Night Differential</span>
                                        <span className="font-mono">{viewTs.nightDiffHours.toFixed(2)}</span>
                                    </div>
                                    <div className="p-2 flex justify-between text-red-600">
                                        <span>Undertime Minutes</span>
                                        <span className="font-mono">{viewTs.undertimeMinutes}</span>
                                    </div>
                                    <div className="p-2 flex justify-between font-bold bg-muted/20">
                                        <span>Total Hours Computed</span>
                                        <span className="font-mono">{viewTs.totalHours.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {viewTs.approvedBy && (
                                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg flex items-start gap-3">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Approved By</div>
                                        <div className="text-xs text-emerald-700 dark:text-emerald-500">{viewTs.approvedBy}</div>
                                        <div className="text-[10px] text-emerald-600/70">{new Date(viewTs.approvedAt!).toLocaleString()}</div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-[10px] text-muted-foreground uppercase">Segments</Label>
                                <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                                    {viewTs.segments.map((seg) => (
                                        <div key={seg.id} className="text-[10px] p-1.5 border rounded bg-muted/30 flex justify-between items-center">
                                            <span>{seg.segmentType.toUpperCase()} ({seg.startTime} - {seg.endTime})</span>
                                            <span className="font-mono font-bold">{seg.hours}h</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewTs(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
