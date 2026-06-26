"use client";

import { useState, useMemo, useEffect } from "react";
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
import { Plus, Clock3, Users, UserCog, Pencil, Trash2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { ShiftTemplate } from "@/types";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PAGE_SIZES = [10, 20, 50];

/** Maps shift name keywords → badge colour classes (icon-bg + text, light & dark) */
function getShiftColor(name: string | undefined): string {
    if (!name) return "bg-slate-500/15 text-slate-600 dark:text-slate-300";
    const n = name.toLowerCase();
    if (n.includes("night")) return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    if (n.includes("mid"))   return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    if (n.includes("day") || n.includes("morning") || n.includes("am"))
                             return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    // Default for any other named shift — reuse purple as before
    return "bg-purple-500/15 text-purple-700 dark:text-purple-400";
}

export default function ShiftsPage() {
    const { shiftTemplates, employeeShifts, createShift, assignShift, unassignShift, updateShift, deleteShift } = useAttendanceStore();
    const employees = useEmployeesStore((s) => s.employees);
    const updateEmployee = useEmployeesStore((s) => s.updateEmployee);
    const currentUser = useAuthStore((s) => s.currentUser);

    const { hasPermission } = useRolesStore();
    const canManage = hasPermission(currentUser.role, "settings:shifts");

    // Create Shift dialog
    const [createOpen, setCreateOpen] = useState(false);
    const [shiftName, setShiftName] = useState("");
    const [shiftStart, setShiftStart] = useState("08:00");
    const [shiftEnd, setShiftEnd] = useState("17:00");
    const [gracePeriod, setGracePeriod] = useState("10");
    const [breakDuration, setBreakDuration] = useState("60");
    const [workDays, setWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);

    // Edit Shift dialog
    const [editOpen, setEditOpen] = useState(false);
    const [editingShift, setEditingShift] = useState<ShiftTemplate | null>(null);
    const [editName, setEditName] = useState("");
    const [editStart, setEditStart] = useState("08:00");
    const [editEnd, setEditEnd] = useState("17:00");
    const [editGrace, setEditGrace] = useState("10");
    const [editBreak, setEditBreak] = useState("60");
    const [editWorkDays, setEditWorkDays] = useState<number[]>([1, 2, 3, 4, 5]);
    const [deleteShiftId, setDeleteShiftId] = useState<string | null>(null);

    // Assign Shift dialog
    const [assignOpen, setAssignOpen] = useState(false);
    const [assignEmpIds, setAssignEmpIds] = useState<string[]>([]);
    const [assignShiftId, setAssignShiftId] = useState("");
    const [assignEmpSearch, setAssignEmpSearch] = useState("");
    const [assignEmpFocused, setAssignEmpFocused] = useState(false);

    // Employee Assignments tab — search, filter, pagination
    const [assignSearch, setAssignSearch] = useState("");
    const [assignDeptFilter, setAssignDeptFilter] = useState("all");
    const [assignShiftFilter, setAssignShiftFilter] = useState("all");
    const [assignPage, setAssignPage] = useState(1);
    const [assignPageSize, setAssignPageSize] = useState(10);

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;
    const getShiftName = (id: string) => shiftTemplates.find((s) => s.id === id)?.name || id;

    const getEmpCountForShift = (shiftId: string) =>
        Object.values(employeeShifts).filter((sid) => sid === shiftId).length;

    const toggleWorkDay = (day: number) => {
        setWorkDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
        );
    };

    const openEditShift = (shift: ShiftTemplate) => {
        setEditingShift(shift);
        setEditName(shift.name);
        setEditStart(shift.startTime);
        setEditEnd(shift.endTime);
        setEditGrace(String(shift.gracePeriod));
        setEditBreak(String(shift.breakDuration));
        setEditWorkDays(shift.workDays);
        setEditOpen(true);
    };

    const handleEditSave = () => {
        if (!editingShift || !editName || !editStart || !editEnd) { toast.error("All fields required"); return; }
        updateShift(editingShift.id, { name: editName, startTime: editStart, endTime: editEnd, gracePeriod: Number(editGrace) || 10, breakDuration: Number(editBreak) || 60, workDays: editWorkDays });
        toast.success(`Shift "${editName}" updated`);
        setEditOpen(false); setEditingShift(null);
    };

    const handleCreate = () => {
        if (!shiftName || !shiftStart || !shiftEnd) {
            toast.error("Name, start time, and end time are required");
            return;
        }
        createShift({
            name: shiftName,
            startTime: shiftStart,
            endTime: shiftEnd,
            gracePeriod: Number(gracePeriod) || 10,
            breakDuration: Number(breakDuration) || 60,
            workDays,
        });
        toast.success(`Shift "${shiftName}" created`);
        setCreateOpen(false);
        setShiftName(""); setShiftStart("08:00"); setShiftEnd("17:00");
        setGracePeriod("10"); setBreakDuration("60"); setWorkDays([1, 2, 3, 4, 5]);
    };

    const handleAssign = () => {
        if (assignEmpIds.length === 0 || !assignShiftId) {
            toast.error("Please select at least one employee and a shift");
            return;
        }
        assignEmpIds.forEach((empId) => {
            assignShift(empId, assignShiftId);
            updateEmployee(empId, { shiftId: assignShiftId });
        });
        const shiftLabel = getShiftName(assignShiftId);
        toast.success(
            assignEmpIds.length === 1
                ? `Shift assigned to ${getEmpName(assignEmpIds[0])}`
                : `Shift "${shiftLabel}" assigned to ${assignEmpIds.length} employees`
        );
        setAssignOpen(false);
        setAssignEmpIds([]);
        setAssignShiftId("");
        setAssignEmpSearch("");
    };

    const handleQuickAssign = (empId: string, shiftId: string | null) => {
        if (shiftId) {
            assignShift(empId, shiftId);
            updateEmployee(empId, { shiftId });
            toast.success(`Shift assigned to ${getEmpName(empId)}`);
        } else {
            unassignShift(empId);
            updateEmployee(empId, { shiftId: undefined });
            toast.success("Shift unassigned");
        }
    };

    const assignedEmployees = useMemo(() => {
        return employees.filter((e) => employeeShifts[e.id] && e.status === "active");
    }, [employees, employeeShifts]);

    const unassignedEmployees = useMemo(() => {
        return employees.filter((e) => !employeeShifts[e.id] && e.status === "active");
    }, [employees, employeeShifts]);

    // Unique departments for filter
    const uniqueDepartments = useMemo(() => {
        const set = new Set(employees.filter((e) => e.status === "active" && e.department).map((e) => e.department));
        return Array.from(set).sort();
    }, [employees]);

    // Filtered + paginated active employees for Assignments tab
    const filteredAssignments = useMemo(() => {
        return employees.filter((e) => {
            if (e.status !== "active") return false;
            if (assignSearch && !e.name.toLowerCase().includes(assignSearch.toLowerCase())) return false;
            if (assignDeptFilter !== "all" && e.department !== assignDeptFilter) return false;
            if (assignShiftFilter !== "all") {
                const sid = employeeShifts[e.id];
                if (assignShiftFilter === "unassigned" && sid) return false;
                if (assignShiftFilter !== "unassigned" && sid !== assignShiftFilter) return false;
            }
            return true;
        });
    }, [employees, employeeShifts, assignSearch, assignDeptFilter, assignShiftFilter]);

    const [prevAssignFilters, setPrevAssignFilters] = useState({ assignSearch, assignDeptFilter, assignShiftFilter, assignPageSize });
    if (
        prevAssignFilters.assignSearch !== assignSearch ||
        prevAssignFilters.assignDeptFilter !== assignDeptFilter ||
        prevAssignFilters.assignShiftFilter !== assignShiftFilter ||
        prevAssignFilters.assignPageSize !== assignPageSize
    ) {
        setPrevAssignFilters({ assignSearch, assignDeptFilter, assignShiftFilter, assignPageSize });
        setAssignPage(1);
    }

    const assignTotalPages = Math.max(1, Math.ceil(filteredAssignments.length / assignPageSize));
    const assignSafePage = Math.min(assignPage, assignTotalPages);
    const paginatedAssignments = filteredAssignments.slice(
        (assignSafePage - 1) * assignPageSize,
        assignSafePage * assignPageSize,
    );

    // Filtered employees inside the Assign Shift modal
    const filteredModalEmployees = useMemo(() => {
        if (!assignEmpSearch) return employees.filter((e) => e.status === "active" && e.id);
        return employees.filter((e) => e.status === "active" && e.id && e.name.toLowerCase().includes(assignEmpSearch.toLowerCase()));
    }, [employees, assignEmpSearch]);

    if (!canManage) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Clock3 className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Shift Management</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Configure and assign work shifts</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAssignOpen(true)}>
                        <UserCog className="h-4 w-4" /> Assign Shift
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4" /> Create Shift
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border border-purple-500/20 bg-purple-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Shift Templates</p>
                        <p className="text-2xl font-bold mt-1">{shiftTemplates.length}</p>
                    </CardContent>
                </Card>
                <Card className="border border-emerald-500/20 bg-emerald-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Assigned</p>
                        <p className="text-2xl font-bold mt-1">{assignedEmployees.length}</p>
                    </CardContent>
                </Card>
                <Card className="border border-amber-500/20 bg-amber-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Unassigned</p>
                        <p className="text-2xl font-bold mt-1">{unassignedEmployees.length}</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="templates">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="templates" className="gap-1.5">
                        <Clock3 className="h-3.5 w-3.5" /> Shift Templates
                    </TabsTrigger>
                    <TabsTrigger value="assignments" className="gap-1.5">
                        <Users className="h-3.5 w-3.5" /> Employee Assignments
                    </TabsTrigger>
                </TabsList>

                {/* Shift Templates */}
                <TabsContent value="templates" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Shift Name</TableHead>
                                        <TableHead className="text-xs">Time In</TableHead>
                                        <TableHead className="text-xs">Time Out</TableHead>
                                        <TableHead className="text-xs">Grace Period</TableHead>
                                        <TableHead className="text-xs">Break</TableHead>
                                        <TableHead className="text-xs">Work Days</TableHead>
                                        <TableHead className="text-xs">Employees</TableHead>
                                        <TableHead className="text-xs w-20">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shiftTemplates.length === 0 ? (
                                        <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No shift templates yet</TableCell></TableRow>
                                    ) : shiftTemplates.map((shift) => (
                                        <TableRow key={shift.id}>
                                            <TableCell className="text-sm font-medium">{shift.name}</TableCell>
                                            <TableCell className="text-sm font-mono">{shift.startTime}</TableCell>
                                            <TableCell className="text-sm font-mono">{shift.endTime}</TableCell>
                                            <TableCell className="text-sm">{shift.gracePeriod}m</TableCell>
                                            <TableCell className="text-sm">{shift.breakDuration}m</TableCell>
                                            <TableCell>
                                                <div className="flex gap-1 flex-wrap">
                                                    {shift.workDays.map((d) => (
                                                        <Badge key={d} variant="secondary" className="text-[9px] px-1.5 py-0.5">{DAY_LABELS[d]}</Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="text-[10px]">
                                                    <Users className="h-3 w-3 mr-1" />
                                                    {getEmpCountForShift(shift.id)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditShift(shift)} title="Edit shift">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => setDeleteShiftId(shift.id)} title="Delete shift">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
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

                {/* Employee Assignments */}
                <TabsContent value="assignments" className="mt-4 space-y-4">
                    {/* Search + Filter Bar */}
                    <Card className="border border-border/50">
                        <CardContent className="p-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative flex-1 min-w-[180px]">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                    <Input
                                        placeholder="Search employee..."
                                        value={assignSearch}
                                        onChange={(e) => setAssignSearch(e.target.value)}
                                        className="pl-8 h-9 text-sm"
                                    />
                                </div>
                                <Select value={assignDeptFilter} onValueChange={setAssignDeptFilter}>
                                    <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
                                        <SelectValue placeholder="Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Departments</SelectItem>
                                        {uniqueDepartments.map((d) => (
                                            <SelectItem key={d} value={d}>{d}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={assignShiftFilter} onValueChange={setAssignShiftFilter}>
                                    <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
                                        <SelectValue placeholder="Shift" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Shifts</SelectItem>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {shiftTemplates.filter((s) => s.id).map((s) => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table className="table-fixed w-full">
                                <colgroup>
                                    <col className="w-[28%]" />
                                    <col className="w-[22%]" />
                                    <col className="w-[30%]" />
                                    <col className="w-[20%]" />
                                </colgroup>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-sm font-semibold">Employee</TableHead>
                                        <TableHead className="text-sm font-semibold">Department</TableHead>
                                        <TableHead className="text-sm font-semibold">Assigned Shift</TableHead>
                                        <TableHead className="text-sm font-semibold">Hours</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAssignments.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No employees match your filters</TableCell></TableRow>
                                    ) : paginatedAssignments.map((emp) => {
                                        const shiftId = employeeShifts[emp.id];
                                        const shift = shiftTemplates.find((s) => s.id === shiftId);
                                        return (
                                            <TableRow key={emp.id}>
                                                <TableCell className="text-sm font-medium truncate">{emp.name}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground truncate">{emp.department}</TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={shiftId || "unassigned"}
                                                        onValueChange={(val) => handleQuickAssign(emp.id, val === "unassigned" ? null : val)}
                                                    >
                                                        <SelectTrigger className="h-8 w-[160px] max-w-full text-sm">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="unassigned">
                                                                <Badge variant="secondary" className="text-[10px] bg-slate-500/15 text-slate-600 dark:text-slate-300 border-0">
                                                                    Unassigned
                                                                </Badge>
                                                            </SelectItem>
                                                            {shiftTemplates.filter((s) => s.id).map((s) => (
                                                                <SelectItem key={s.id} value={s.id}>
                                                                    <Badge variant="secondary" className={`text-[10px] border-0 ${getShiftColor(s.name)}`}>
                                                                        {s.name}
                                                                    </Badge>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {shift ? `${shift.startTime} – ${shift.endTime}` : "—"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                    </Card>

                    {/* Pagination */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Rows per page:</span>
                            <Select value={String(assignPageSize)} onValueChange={(v) => { setAssignPageSize(Number(v)); setAssignPage(1); }}>
                                <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                Page {assignSafePage} of {assignTotalPages}
                                {filteredAssignments.length > 0 && <span className="ml-1">({filteredAssignments.length} total)</span>}
                            </span>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={assignSafePage <= 1} onClick={() => setAssignPage(assignSafePage - 1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={assignSafePage >= assignTotalPages} onClick={() => setAssignPage(assignSafePage + 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Edit Shift Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit Shift Template</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium">Shift Name</label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground">Time In</label>
                                <Input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Time Out</label>
                                <Input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="mt-1" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground">Grace Period (min)</label>
                                <Input type="number" min="0" max="60" value={editGrace} onChange={(e) => setEditGrace(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Break Duration (min)</label>
                                <Input type="number" min="0" max="120" value={editBreak} onChange={(e) => setEditBreak(e.target.value)} className="mt-1" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-2">Work Days</label>
                            <div className="flex gap-2 flex-wrap">
                                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => setEditWorkDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort())}
                                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                            editWorkDays.includes(day)
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-background border-border text-muted-foreground hover:bg-muted"
                                        }`}
                                    >
                                        {DAY_LABELS[day]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleEditSave}>Save Changes</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Shift Confirmation */}
            <AlertDialog open={!!deleteShiftId} onOpenChange={(o) => !o && setDeleteShiftId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Shift Template?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{shiftTemplates.find((s) => s.id === deleteShiftId)?.name}&rdquo; will be deleted. Employees assigned to this shift will become unassigned.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (deleteShiftId) { const n = shiftTemplates.find((s) => s.id === deleteShiftId)?.name; deleteShift(deleteShiftId); toast.success(`Shift "${n}" deleted`); setDeleteShiftId(null); } }}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Create Shift Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Create Shift Template</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="grid gap-1.5">
                            <label className="text-sm font-medium">Shift Name</label>
                            <Input
                                value={shiftName}
                                onChange={(e) => {
                                    if (e.target.value.length <= 50) {
                                        setShiftName(e.target.value);
                                    }
                                }}
                                placeholder="e.g. Morning Shift"
                                maxLength={50}
                            />
                            <p className={`text-xs ${(50 - shiftName.length) <= 0 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                                {50 - shiftName.length} characters remaining
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground">Time In</label>
                                <Input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Time Out</label>
                                <Input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} className="mt-1" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground">Grace Period (min)</label>
                                <Input type="number" min="0" max="60" value={gracePeriod} onChange={(e) => setGracePeriod(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Break Duration (min)</label>
                                <Input type="number" min="0" max="120" value={breakDuration} onChange={(e) => setBreakDuration(e.target.value)} className="mt-1" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-muted-foreground block mb-2">Work Days</label>
                            <div className="flex gap-2 flex-wrap">
                                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => toggleWorkDay(day)}
                                        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                                            workDays.includes(day)
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-background border-border text-muted-foreground hover:bg-muted"
                                        }`}
                                    >
                                        {DAY_LABELS[day]}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <Button onClick={handleCreate} className="w-full">Create Shift</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={assignOpen} onOpenChange={(o) => { setAssignOpen(o); if (!o) { setAssignEmpSearch(""); setAssignEmpIds([]); setAssignShiftId(""); setAssignEmpFocused(false); } }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><UserCog className="h-4 w-4" /> Assign Shift</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">

                        {/* Employee multi-select */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-sm font-medium">Employees</label>
                                {assignEmpIds.length > 0 && (
                                    <span className="text-xs text-muted-foreground">{assignEmpIds.length} selected</span>
                                )}
                            </div>

                            {/* Focus trap sentinel — Radix Dialog focuses the first focusable element;
                                this invisible button absorbs that initial focus so the Input stays idle */}
                            <button type="button" className="sr-only" aria-hidden="true" tabIndex={0} />

                            {/* Search input */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                    placeholder="Search and select employees..."
                                    value={assignEmpSearch}
                                    onChange={(e) => setAssignEmpSearch(e.target.value)}
                                    onFocus={() => setAssignEmpFocused(true)}
                                    onBlur={() => setTimeout(() => setAssignEmpFocused(false), 150)}
                                    className="pl-8 h-9 text-sm"
                                    autoComplete="off"
                                    tabIndex={-1}
                                />
                            </div>

                            {/* Dropdown — only while focused */}
                            {assignEmpFocused && (
                                <div className="mt-1 border border-border rounded-md max-h-44 overflow-y-auto divide-y divide-border/50 bg-popover shadow-md">
                                    {filteredModalEmployees.length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-4">No employees found</p>
                                    ) : filteredModalEmployees.map((e) => {
                                        const isSelected = assignEmpIds.includes(e.id);
                                        return (
                                            <button
                                                key={e.id}
                                                type="button"
                                                onMouseDown={(ev) => ev.preventDefault()}
                                                onClick={() => {
                                                    setAssignEmpIds((prev) =>
                                                        isSelected ? prev.filter((x) => x !== e.id) : [...prev, e.id]
                                                    );
                                                    setAssignEmpSearch("");
                                                }}
                                                className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted flex items-center justify-between gap-2 ${isSelected ? "bg-primary/10" : ""}`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center text-[10px] font-bold transition-colors ${isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                                                        {isSelected ? "✓" : ""}
                                                    </span>
                                                    <span className="truncate">{e.name}</span>
                                                </div>
                                                {employeeShifts[e.id] && (
                                                    <Badge variant="secondary" className={`text-[9px] border-0 shrink-0 ${getShiftColor(getShiftName(employeeShifts[e.id]))}`}>
                                                        {getShiftName(employeeShifts[e.id])}
                                                    </Badge>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Selected employee tags — shown below the search/dropdown */}
                            {assignEmpIds.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2 p-2 rounded-md border border-border bg-muted/30">
                                    {assignEmpIds.map((id) => {
                                        const emp = employees.find((e) => e.id === id);
                                        return emp ? (
                                            <span
                                                key={id}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                                            >
                                                {emp.name}
                                                <button
                                                    type="button"
                                                    onMouseDown={(ev) => ev.preventDefault()}
                                                    onClick={() => setAssignEmpIds((prev) => prev.filter((x) => x !== id))}
                                                    className="ml-0.5 hover:text-red-500 transition-colors leading-none"
                                                    aria-label={`Remove ${emp.name}`}
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Shift selector */}
                        <div>
                            <label className="text-sm font-medium">Shift</label>
                            <Select value={assignShiftId} onValueChange={setAssignShiftId}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Select shift" /></SelectTrigger>
                                <SelectContent>
                                    {shiftTemplates.filter((s) => s.id).map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name} ({s.startTime} – {s.endTime})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button onClick={handleAssign} className="w-full" disabled={assignEmpIds.length === 0 || !assignShiftId}>
                            Assign Shift{assignEmpIds.length > 1 ? ` to ${assignEmpIds.length} Employees` : ""}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}