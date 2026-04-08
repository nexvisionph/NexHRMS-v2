"use client";

import { useState, useMemo } from "react";
import { useTimesheetStore } from "@/store/timesheet.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Calculator, CheckCircle, XCircle, Eye, Clock, Timer, Moon, Zap } from "lucide-react";
import { toast } from "sonner";
import type { Timesheet } from "@/types";

export default function TimesheetsPage() {
    const { timesheets, ruleSets, computeTimesheet, submitTimesheet, approveTimesheet, rejectTimesheet, getPendingApproval, addRuleSet } = useTimesheetStore();
    const { logs, shiftTemplates, employeeShifts } = useAttendanceStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);

    const { hasPermission } = useRolesStore();
    const hasTimesheetAccess = hasPermission(currentUser.role, "page:timesheets");
    const isSupervisor = hasPermission(currentUser.role, "timesheets:view_all");
    const isPayrollAdmin = hasPermission(currentUser.role, "payroll:generate");
    const canApprove = hasPermission(currentUser.role, "timesheets:approve");

    // Helper: look up the shift assigned to an employee
    const getEmployeeShift = (empId: string) => {
        const shiftId = employeeShifts?.[empId];
        return shiftTemplates?.find((t) => t.id === shiftId);
    };

    const [statusFilter, setStatusFilter] = useState("all");
    const [empFilter, setEmpFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("");
    const [viewTs, setViewTs] = useState<Timesheet | null>(null);

    // Compute timesheet dialog
    const [computeOpen, setComputeOpen] = useState(false);
    const [computeEmpId, setComputeEmpId] = useState("");
    const [computeDate, setComputeDate] = useState("");
    const [computeShiftStart, setComputeShiftStart] = useState("08:00");
    const [computeShiftEnd, setComputeShiftEnd] = useState("17:00");
    const [computeRuleSetId, setComputeRuleSetId] = useState("RS-DEFAULT");

    // Rule set editor
    const [editRsOpen, setEditRsOpen] = useState(false);
    const [rsName, setRsName] = useState("");
    const [rsStdHours, setRsStdHours] = useState("8");
    const [rsGrace, setRsGrace] = useState("10");
    const [rsRounding, setRsRounding] = useState("nearest_15");
    const [rsOtApproval, setRsOtApproval] = useState(true);

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    const myEmpId = employees.find((e) => e.name === currentUser.name || e.email?.toLowerCase() === currentUser.email?.toLowerCase())?.id;

    // When employee changes in compute dialog, auto-fill their assigned shift times
    const handleComputeEmpChange = (empId: string) => {
        setComputeEmpId(empId);
        const shift = getEmployeeShift(empId);
        if (shift) {
            setComputeShiftStart(shift.startTime);
            setComputeShiftEnd(shift.endTime);
        } else {
            setComputeShiftStart("08:00");
            setComputeShiftEnd("17:00");
        }
    };

    // Bulk compute: generate timesheets for every checked-in log that doesn't have one yet
    const handleBulkCompute = () => {
        // Keys for timesheets that are already past "computed" (submitted/approved/rejected) — skip these
        const lockedKeys = new Set(
            timesheets
                .filter((t) => t.status !== "computed")
                .map((t) => `${t.employeeId}|${t.date}`)
        );
        // Keys for ALL existing timesheets — to skip re-computation of already-computed ones
        const allTimesheetKeys = new Set(timesheets.map((t) => `${t.employeeId}|${t.date}`));
        // Only process logs that have a check-in AND no timesheet at all yet
        const toCompute = logs.filter(
            (l) => l.checkIn && l.status === "present" && !allTimesheetKeys.has(`${l.employeeId}|${l.date}`) && !lockedKeys.has(`${l.employeeId}|${l.date}`)
        );
        if (toCompute.length === 0) { toast.info("No new attendance logs to compute."); return; }
        let count = 0;
        toCompute.forEach((log) => {
            const shift = getEmployeeShift(log.employeeId);
            computeTimesheet({
                employeeId: log.employeeId,
                date: log.date,
                ruleSetId: computeRuleSetId,
                checkIn: log.checkIn!,
                checkOut: log.checkOut || shift?.endTime || "17:00",
                shiftStart: shift?.startTime || "08:00",
                shiftEnd: shift?.endTime || "17:00",
                breakDuration: shift?.breakDuration ?? 60,
            });
            count++;
        });
        toast.success(`Bulk computed ${count} timesheet${count !== 1 ? "s" : ""}.`);
    };

    const filtered = useMemo(() => {
        let result = timesheets;
        if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);
        if (empFilter !== "all") result = result.filter((t) => t.employeeId === empFilter);
        if (dateFilter) result = result.filter((t) => t.date === dateFilter);
        // Non-admin/supervisor only see their own
        if (!isSupervisor && !isPayrollAdmin && myEmpId) {
            result = result.filter((t) => t.employeeId === myEmpId);
        }
        return result.sort((a, b) => b.date.localeCompare(a.date));
    }, [timesheets, statusFilter, empFilter, dateFilter, isSupervisor, isPayrollAdmin, myEmpId]);

    const pendingCount = getPendingApproval().length;

    const statusColors: Record<string, string> = {
        computed: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
        submitted: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
    };

    const handleCompute = () => {
        if (!computeEmpId || !computeDate) {
            toast.error("Select an employee and date");
            return;
        }
        const empLogs = logs.filter((l) => l.employeeId === computeEmpId && l.date === computeDate);
        if (empLogs.length === 0) {
            toast.error("No attendance log found for this employee on this date");
            return;
        }
        const log = empLogs[0];
        if (!log.checkIn) {
            toast.error("Employee has no check-in for this date");
            return;
        }
        computeTimesheet({
            employeeId: computeEmpId,
            date: computeDate,
            ruleSetId: computeRuleSetId,
            checkIn: log.checkIn,
            checkOut: log.checkOut || "17:00",
            shiftStart: computeShiftStart,
            shiftEnd: computeShiftEnd,
            breakDuration: 60,
        });
        toast.success(`Timesheet computed for ${getEmpName(computeEmpId)} on ${computeDate}`);
        setComputeOpen(false);
    };

    const handleAddRuleSet = () => {
        if (!rsName) { toast.error("Rule set name required"); return; }
        addRuleSet({
            name: rsName,
            standardHoursPerDay: Number(rsStdHours),
            graceMinutes: Number(rsGrace),
            roundingPolicy: rsRounding as "none" | "nearest_15" | "nearest_30",
            overtimeRequiresApproval: rsOtApproval,
            nightDiffStart: "22:00",
            nightDiffEnd: "06:00",
            holidayMultiplier: 1.0,
        });
        toast.success("Rule set created");
        setEditRsOpen(false);
        setRsName("");
    };

    if (!hasTimesheetAccess) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <ClipboardList className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">You don&apos;t have access to timesheets.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Timesheets</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Computed from attendance events + rule sets
                        {pendingCount > 0 && <span className="ml-2 text-amber-600 font-medium">({pendingCount} pending approval)</span>}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                {(isSupervisor || isPayrollAdmin) && (
                        <>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBulkCompute}>
                                <Zap className="h-4 w-4" /> Bulk Compute
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setComputeOpen(true)}>
                                <Calculator className="h-4 w-4" /> Compute Single
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="border border-slate-500/20 bg-slate-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Computed</p>
                        <p className="text-2xl font-bold mt-1">{timesheets.filter((t) => t.status === "computed").length}</p>
                    </CardContent>
                </Card>
                <Card className="border border-amber-500/20 bg-amber-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Pending Approval</p>
                        <p className="text-2xl font-bold mt-1">{pendingCount}</p>
                    </CardContent>
                </Card>
                <Card className="border border-emerald-500/20 bg-emerald-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Approved</p>
                        <p className="text-2xl font-bold mt-1">{timesheets.filter((t) => t.status === "approved").length}</p>
                    </CardContent>
                </Card>
                <Card className="border border-blue-500/20 bg-blue-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Rule Sets</p>
                        <p className="text-2xl font-bold mt-1">{ruleSets.length}</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="timesheets">
                <TabsList className="w-full overflow-x-auto justify-start">
                    <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
                    <TabsTrigger value="rulesets" className="gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5" /> Rule Sets
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="timesheets" className="mt-4 space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full sm:w-[180px]" />
                        {isSupervisor && (
                            <Select value={empFilter} onValueChange={setEmpFilter}>
                                <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="All Employees" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Employees</SelectItem>
                                    {employees.filter((e) => e.status === "active" && e.id).map((e) => (
                                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="computed">Computed</SelectItem>
                                <SelectItem value="submitted">Submitted</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Date</TableHead>
                                        <TableHead className="text-xs">Employee</TableHead>
                                        <TableHead className="text-xs">Regular</TableHead>
                                        <TableHead className="text-xs">OT</TableHead>
                                        <TableHead className="text-xs">Night Diff</TableHead>
                                        <TableHead className="text-xs">Late</TableHead>
                                        <TableHead className="text-xs">Undertime</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                        <TableHead className="text-xs w-28">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">No timesheets found</TableCell></TableRow>
                                    ) : filtered.map((ts) => (
                                        <TableRow key={ts.id}>
                                            <TableCell className="text-sm">{ts.date}</TableCell>
                                            <TableCell className="text-sm font-medium">{getEmpName(ts.employeeId)}</TableCell>
                                            <TableCell className="text-sm">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                    {ts.regularHours.toFixed(1)}h
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {ts.overtimeHours > 0 ? (
                                                    <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400">
                                                        <Timer className="h-2.5 w-2.5 mr-0.5" />+{ts.overtimeHours.toFixed(1)}h
                                                    </Badge>
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {ts.nightDiffHours > 0 ? (
                                                    <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-700 dark:text-violet-400">
                                                        <Moon className="h-2.5 w-2.5 mr-0.5" />{ts.nightDiffHours.toFixed(1)}h
                                                    </Badge>
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {ts.lateMinutes > 0 ? (
                                                    <span className="text-amber-600 dark:text-amber-400 text-xs">+{ts.lateMinutes}m</span>
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {ts.undertimeMinutes > 0 ? (
                                                    <span className="text-red-500 text-xs">-{ts.undertimeMinutes}m</span>
                                                ) : "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={`text-[10px] ${statusColors[ts.status]}`}>
                                                    {ts.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewTs(ts)} title="View details">
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>
                                                    {ts.status === "computed" && (
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => { submitTimesheet(ts.id); toast.success("Timesheet submitted for approval"); }} title="Submit">
                                                            <ClipboardList className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                    {canApprove && ts.status === "submitted" && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => { approveTimesheet(ts.id, currentUser.id); toast.success("Timesheet approved"); }} title="Approve">
                                                                <CheckCircle className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => { rejectTimesheet(ts.id, currentUser.id); toast.success("Timesheet rejected"); }} title="Reject">
                                                                <XCircle className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rulesets" className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Attendance Rule Sets</p>
                        {isSupervisor && (
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditRsOpen(true)}>
                                <ClipboardList className="h-3.5 w-3.5" /> Add Rule Set
                            </Button>
                        )}
                    </div>
                    <div className="grid gap-4">
                        {ruleSets.map((rs) => (
                            <Card key={rs.id} className="border border-border/50">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="font-medium text-sm">{rs.name}</p>
                                            <p className="text-xs text-muted-foreground">ID: {rs.id}</p>
                                        </div>
                                        <Badge variant="secondary" className="text-[10px]">{rs.id.slice(0, 8)}</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <p className="text-muted-foreground">Std Hours/Day</p>
                                            <p className="font-medium">{rs.standardHoursPerDay}h</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Grace Period</p>
                                            <p className="font-medium">{rs.graceMinutes}min</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Rounding</p>
                                            <p className="font-medium capitalize">{rs.roundingPolicy.replace("_", " ")}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">OT Approval</p>
                                            <Badge variant="outline" className={`text-[10px] ${rs.overtimeRequiresApproval ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-700"}`}>
                                                {rs.overtimeRequiresApproval ? "Required" : "Auto"}
                                            </Badge>
                                        </div>
                                        {rs.nightDiffStart && (
                                            <div>
                                                <p className="text-muted-foreground">Night Diff</p>
                                                <p className="font-medium">{rs.nightDiffStart}–{rs.nightDiffEnd}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-muted-foreground">Holiday Multiplier</p>
                                            <p className="font-medium">{rs.holidayMultiplier}×</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Compute Timesheet Dialog */}
            <Dialog open={computeOpen} onOpenChange={setComputeOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Compute Timesheet</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium">Employee</label>
                            <Select value={computeEmpId} onValueChange={handleComputeEmpChange}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                                <SelectContent>
                                    {employees.filter((e) => e.status === "active" && e.id).map((e) => {
                                        const shift = getEmployeeShift(e.id);
                                        return (
                                            <SelectItem key={e.id} value={e.id}>
                                                {e.name}{shift ? ` · ${shift.name}` : ""}
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Date</label>
                            <Input type="date" value={computeDate} onChange={(e) => setComputeDate(e.target.value)} className="mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">Shift Start</label>
                                <Input type="time" value={computeShiftStart} onChange={(e) => setComputeShiftStart(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Shift End</label>
                                <Input type="time" value={computeShiftEnd} onChange={(e) => setComputeShiftEnd(e.target.value)} className="mt-1" />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Rule Set</label>
                            <Select value={computeRuleSetId} onValueChange={setComputeRuleSetId}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ruleSets.filter((rs) => rs.id).map((rs) => (
                                        <SelectItem key={rs.id} value={rs.id}>{rs.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleCompute} className="w-full">Compute</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add Rule Set Dialog */}
            <Dialog open={editRsOpen} onOpenChange={setEditRsOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Add Attendance Rule Set</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium">Name</label>
                            <Input value={rsName} onChange={(e) => setRsName(e.target.value)} placeholder="e.g. Night Shift Rules" className="mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">Std Hours/Day</label>
                                <Input type="number" value={rsStdHours} onChange={(e) => setRsStdHours(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Grace Minutes</label>
                                <Input type="number" value={rsGrace} onChange={(e) => setRsGrace(e.target.value)} className="mt-1" />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Rounding Policy</label>
                            <Select value={rsRounding} onValueChange={setRsRounding}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="nearest_15">Nearest 15 min</SelectItem>
                                    <SelectItem value="nearest_30">Nearest 30 min</SelectItem>
                                    <SelectItem value="none">None (Exact)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">OT Requires Approval</label>
                            <Button
                                variant={rsOtApproval ? "default" : "outline"}
                                size="sm"
                                onClick={() => setRsOtApproval(!rsOtApproval)}
                            >
                                {rsOtApproval ? "Yes" : "No"}
                            </Button>
                        </div>
                        <Button onClick={handleAddRuleSet} className="w-full">Create Rule Set</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Timesheet Detail Dialog */}
            <Dialog open={!!viewTs} onOpenChange={() => setViewTs(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Timesheet Detail</DialogTitle></DialogHeader>
                    {viewTs && (
                        <div className="space-y-4 pt-2">
                            <Card className="border border-border/50">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{getEmpName(viewTs.employeeId)}</p>
                                            <p className="text-xs text-muted-foreground">{viewTs.date}</p>
                                        </div>
                                        <Badge variant="secondary" className={`text-[10px] ${statusColors[viewTs.status]}`}>
                                            {viewTs.status}
                                        </Badge>
                                    </div>

                                    <div className="border-t border-border/50 pt-3 space-y-2">
                                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">Time Summary</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Total Hours</span>
                                                <span className="font-mono">{viewTs.totalHours.toFixed(2)}h</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Segments</span>
                                                <span className="font-mono">{viewTs.segments.length}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Regular Hours</span>
                                                <span className="font-medium">{viewTs.regularHours.toFixed(2)}h</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Overtime</span>
                                                <span className="font-medium text-blue-600">{viewTs.overtimeHours.toFixed(2)}h</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Night Diff</span>
                                                <span className="font-medium text-violet-600">{viewTs.nightDiffHours.toFixed(2)}h</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Late</span>
                                                <span className="font-medium text-amber-600">{viewTs.lateMinutes}min</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Undertime</span>
                                                <span className="font-medium text-red-500">{viewTs.undertimeMinutes}min</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-t border-border/50 pt-3 space-y-1 text-xs text-muted-foreground">
                                        <div className="flex justify-between">
                                            <span>Rule Set</span>
                                            <span className="font-mono">{viewTs.ruleSetId}</span>
                                        </div>
                                        {viewTs.approvedBy && (
                                            <div className="flex justify-between">
                                                <span>Approved By</span>
                                                <span>{viewTs.approvedBy}</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
