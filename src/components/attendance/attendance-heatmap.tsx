"use client";

import { useState, useMemo, useCallback } from "react";
import {
    format, subDays, addDays, eachDayOfInterval, isWeekend, isSameDay,
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    ChevronLeft, ChevronRight, CalendarDays, Filter,
} from "lucide-react";
import type { AttendanceLog, Employee, Project } from "@/types";

/* ─── Status colour map ─────────────────────────────────────── */
const STATUS_COLORS: Record<string, { bg: string; ring: string; label: string }> = {
    present:  { bg: "bg-emerald-500", ring: "ring-emerald-400", label: "Present" },
    absent:   { bg: "bg-red-500",     ring: "ring-red-400",     label: "Absent" },
    on_leave: { bg: "bg-amber-500",   ring: "ring-amber-400",   label: "On Leave" },
    late:     { bg: "bg-orange-500",   ring: "ring-orange-400",  label: "Late" },
    wfh:      { bg: "bg-blue-500",     ring: "ring-blue-400",    label: "WFH" },
    holiday:  { bg: "bg-violet-500",   ring: "ring-violet-400",  label: "Holiday" },
};
const WEEKEND_BG = "bg-muted/40";
const EMPTY_BG   = "bg-muted/20";

type HeatmapStatus = "present" | "absent" | "on_leave" | "late" | "wfh" | "holiday";

function resolveStatus(log: AttendanceLog | undefined, isHoliday: boolean): HeatmapStatus | null {
    if (isHoliday) return "holiday";
    if (!log) return null;
    if (log.status === "present" && log.lateMinutes && log.lateMinutes > 0) return "late";
    return log.status as HeatmapStatus;
}

/* ─── Props ──────────────────────────────────────────────────── */
export interface AttendanceHeatmapProps {
    logs: AttendanceLog[];
    employees: Employee[];
    projects: Project[];
    holidays: Array<{ date: string; name: string }>;
    mode: "admin" | "hr" | "supervisor";
    canEdit: boolean;
    onStatusChange: (employeeId: string, date: string, newStatus: string, checkIn?: string, checkOut?: string, lateMinutes?: number) => void;
}

/* ═══════════════════════════════════════════════════════════════
   ATTENDANCE HEATMAP
   ═══════════════════════════════════════════════════════════════ */
export function AttendanceHeatmap({
    logs, employees, projects, holidays, canEdit, onStatusChange,
}: AttendanceHeatmapProps) {
    // ─── Date range (default: last 30 days) ───────────────────────
    const [endDate, setEndDate] = useState(() => new Date());
    const [daysToShow, setDaysToShow] = useState(30);

    const dateRange = useMemo(() => {
        const start = subDays(endDate, daysToShow - 1);
        return eachDayOfInterval({ start, end: endDate });
    }, [endDate, daysToShow]);

    const holidayDates = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);

    // ─── Filters ──────────────────────────────────────────────────
    const [deptFilter, setDeptFilter] = useState("all");
    const [projectFilter, setProjectFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const departments = useMemo(() => {
        const set = new Set(employees.filter((e) => e.status === "active").map((e) => e.department));
        return Array.from(set).sort();
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        return employees
            .filter((e) => e.status === "active")
            .filter((e) => deptFilter === "all" || e.department === deptFilter)
            .filter((e) => {
                if (projectFilter === "all") return true;
                const proj = projects.find((p) => p.id === projectFilter);
                return proj?.assignedEmployeeIds?.includes(e.id);
            })
            .filter((e) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q);
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [employees, deptFilter, projectFilter, searchQuery, projects]);

    // ─── Build lookup: employeeId+date → log ──────────────────────
    const logMap = useMemo(() => {
        const map = new Map<string, AttendanceLog>();
        logs.forEach((l) => map.set(`${l.employeeId}|${l.date}`, l));
        return map;
    }, [logs]);

    // Status filter: further filter employees who match the status on any visible day
    const displayEmployees = useMemo(() => {
        if (statusFilter === "all") return filteredEmployees;
        return filteredEmployees.filter((emp) =>
            dateRange.some((d) => {
                const dateStr = format(d, "yyyy-MM-dd");
                const log = logMap.get(`${emp.id}|${dateStr}`);
                const status = resolveStatus(log, holidayDates.has(dateStr));
                return status === statusFilter;
            })
        );
    }, [filteredEmployees, statusFilter, dateRange, logMap, holidayDates]);

    // ─── Modal state ──────────────────────────────────────────────
    const [modalOpen, setModalOpen] = useState(false);
    const [modalEmpId, setModalEmpId] = useState("");
    const [modalDate, setModalDate] = useState("");
    const [modalStatus, setModalStatus] = useState("present");
    const [modalCheckIn, setModalCheckIn] = useState("");
    const [modalCheckOut, setModalCheckOut] = useState("");
    const [modalLate, setModalLate] = useState("0");

    const openCellModal = useCallback((empId: string, date: Date) => {
        if (!canEdit) return;
        const dateStr = format(date, "yyyy-MM-dd");
        const log = logMap.get(`${empId}|${dateStr}`);
        setModalEmpId(empId);
        setModalDate(dateStr);
        setModalStatus(log?.status || "present");
        setModalCheckIn(log?.checkIn || "");
        setModalCheckOut(log?.checkOut || "");
        setModalLate(log?.lateMinutes != null ? String(log.lateMinutes) : "0");
        setModalOpen(true);
    }, [canEdit, logMap]);

    const handleSaveStatus = () => {
        onStatusChange(
            modalEmpId,
            modalDate,
            modalStatus,
            modalCheckIn || undefined,
            modalCheckOut || undefined,
            modalLate ? Number(modalLate) : undefined,
        );
        setModalOpen(false);
    };

    const getProjectForEmp = (empId: string) => {
        return projects.find((p) => p.assignedEmployeeIds?.includes(empId));
    };

    const modalEmp = employees.find((e) => e.id === modalEmpId);

    // ─── Navigation ───────────────────────────────────────────────
    const goBack = () => setEndDate((d) => subDays(d, 7));
    const goForward = () => setEndDate((d) => addDays(d, 7));
    const goToday = () => setEndDate(new Date());

    // ─── Summary stats ────────────────────────────────────────────
    const stats = useMemo(() => {
        let present = 0, absent = 0, late = 0, onLeave = 0;
        displayEmployees.forEach((emp) => {
            dateRange.forEach((d) => {
                if (isWeekend(d)) return;
                const dateStr = format(d, "yyyy-MM-dd");
                if (holidayDates.has(dateStr)) return;
                const log = logMap.get(`${emp.id}|${dateStr}`);
                if (!log) return;
                if (log.status === "present") {
                    if (log.lateMinutes && log.lateMinutes > 0) late++;
                    else present++;
                } else if (log.status === "absent") absent++;
                else if (log.status === "on_leave") onLeave++;
            });
        });
        return { present, absent, late, onLeave };
    }, [displayEmployees, dateRange, logMap, holidayDates]);

    return (
        <div className="space-y-4">
            {/* ─── Summary Cards ──────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryCard label="Present" count={stats.present} color="bg-emerald-500" />
                <SummaryCard label="Absent" count={stats.absent} color="bg-red-500" />
                <SummaryCard label="Late" count={stats.late} color="bg-orange-500" />
                <SummaryCard label="On Leave" count={stats.onLeave} color="bg-amber-500" />
            </div>

            {/* ─── Filters ────────────────────────────────────────── */}
            <Card className="border border-border/50">
                <CardContent className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                            placeholder="Search employee..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-[180px] h-8 text-xs"
                        />
                        <Select value={deptFilter} onValueChange={setDeptFilter}>
                            <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
                                <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.filter(Boolean).map((d) => (
                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={projectFilter} onValueChange={setProjectFilter}>
                            <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
                                <SelectValue placeholder="All Projects" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Projects</SelectItem>
                                {projects.filter((p) => p.id).map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="present">Present</SelectItem>
                                <SelectItem value="late">Late</SelectItem>
                                <SelectItem value="absent">Absent</SelectItem>
                                <SelectItem value="on_leave">On Leave</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={String(daysToShow)} onValueChange={(v) => setDaysToShow(Number(v))}>
                            <SelectTrigger className="w-full sm:w-[110px] h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7">7 Days</SelectItem>
                                <SelectItem value="14">14 Days</SelectItem>
                                <SelectItem value="30">30 Days</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* ─── Date Navigation ────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={goBack}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={goToday}>
                        <CalendarDays className="h-3.5 w-3.5" /> Today
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={goForward}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    {format(dateRange[0], "MMM d")} — {format(dateRange[dateRange.length - 1], "MMM d, yyyy")}
                    {" · "}{displayEmployees.length} employee{displayEmployees.length !== 1 ? "s" : ""}
                </p>
            </div>

            {/* ─── Heatmap Grid ───────────────────────────────────── */}
            <Card className="border border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <div className="min-w-fit">
                            {/* Header: dates */}
                            <div className="flex border-b border-border/50">
                                <div className="shrink-0 w-[200px] p-2 border-r border-border/50 bg-muted/30">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Employee / Role</p>
                                </div>
                                <div className="flex">
                                    {dateRange.map((d) => {
                                        const isWknd = isWeekend(d);
                                        const isHol = holidayDates.has(format(d, "yyyy-MM-dd"));
                                        const isToday = isSameDay(d, new Date());
                                        return (
                                            <div
                                                key={d.toISOString()}
                                                className={`w-[28px] shrink-0 text-center py-1.5 border-r border-border/30 ${isToday ? "bg-blue-500/10" : isHol ? "bg-violet-500/5" : isWknd ? "bg-muted/20" : ""}`}
                                            >
                                                <p className={`text-[8px] leading-tight ${isToday ? "font-bold text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
                                                    {format(d, "EEE").charAt(0)}
                                                </p>
                                                <p className={`text-[9px] leading-tight font-mono ${isToday ? "font-bold text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
                                                    {format(d, "d")}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Rows: employees */}
                            {displayEmployees.length === 0 ? (
                                <div className="p-8 text-center text-sm text-muted-foreground">No employees match the current filters.</div>
                            ) : displayEmployees.map((emp) => {
                                const proj = getProjectForEmp(emp.id);
                                return (
                                    <div key={emp.id} className="flex border-b border-border/30 hover:bg-muted/10 transition-colors">
                                        {/* Employee name + role + project */}
                                        <div className="shrink-0 w-[200px] p-2 border-r border-border/50 flex flex-col justify-center">
                                            <p className="text-xs font-medium truncate">{emp.name}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">
                                                {emp.role} · {proj ? proj.name : emp.department}
                                            </p>
                                        </div>
                                        {/* Cells */}
                                        <div className="flex">
                                            {dateRange.map((d) => {
                                                const dateStr = format(d, "yyyy-MM-dd");
                                                const isWknd = isWeekend(d);
                                                const isHol = holidayDates.has(dateStr);
                                                const log = logMap.get(`${emp.id}|${dateStr}`);
                                                const status = resolveStatus(log, isHol);
                                                const colorInfo = status ? STATUS_COLORS[status] : null;
                                                const isFuture = d > new Date();
                                                const holName = holidays.find((h) => h.date === dateStr)?.name;

                                                return (
                                                    <Tooltip key={dateStr}>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className={`w-[28px] h-[28px] shrink-0 flex items-center justify-center border-r border-border/30 transition-all ${
                                                                    canEdit && !isWknd && !isFuture
                                                                        ? "cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-offset-background " + (colorInfo?.ring || "hover:ring-muted-foreground/30")
                                                                        : "cursor-default"
                                                                }`}
                                                                onClick={() => {
                                                                    if (canEdit && !isWknd && !isFuture) {
                                                                        openCellModal(emp.id, d);
                                                                    }
                                                                }}
                                                                disabled={isWknd || isFuture}
                                                            >
                                                                {isWknd ? (
                                                                    <span className={`w-3 h-3 rounded-sm ${WEEKEND_BG}`} />
                                                                ) : isFuture ? (
                                                                    <span className={`w-3 h-3 rounded-sm ${EMPTY_BG}`} />
                                                                ) : colorInfo ? (
                                                                    <span className={`w-3 h-3 rounded-sm ${colorInfo.bg} ${
                                                                        status === "present" ? "opacity-90" : ""
                                                                    }`} />
                                                                ) : (
                                                                    <span className={`w-3 h-3 rounded-sm ${EMPTY_BG} border border-dashed border-muted-foreground/20`} />
                                                                )}
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-xs max-w-[200px]">
                                                            <p className="font-semibold">{emp.name}</p>
                                                            <p className="text-muted-foreground">{format(d, "EEE, MMM d, yyyy")}</p>
                                                            {isWknd && <p className="text-muted-foreground italic">Weekend</p>}
                                                            {isHol && <p className="text-violet-500">{holName || "Holiday"}</p>}
                                                            {status && !isWknd && (
                                                                <p className="mt-0.5">
                                                                    <span className={`inline-block w-2 h-2 rounded-sm mr-1 ${STATUS_COLORS[status]?.bg}`} />
                                                                    {STATUS_COLORS[status]?.label}
                                                                    {status === "late" && log?.lateMinutes ? ` (+${log.lateMinutes}m)` : ""}
                                                                </p>
                                                            )}
                                                            {log?.checkIn && <p className="text-muted-foreground">In: {log.checkIn} · Out: {log.checkOut || "—"}</p>}
                                                            {!log && !isWknd && !isHol && !isFuture && (
                                                                <p className="text-muted-foreground italic">No record</p>
                                                            )}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ─── Legend ──────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium">Legend:</span>
                {Object.entries(STATUS_COLORS).map(([key, val]) => (
                    <span key={key} className="flex items-center gap-1">
                        <span className={`w-2.5 h-2.5 rounded-sm ${val.bg}`} /> {val.label}
                    </span>
                ))}
                <span className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-sm ${WEEKEND_BG} border border-muted-foreground/20`} /> Weekend
                </span>
                <span className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-sm ${EMPTY_BG} border border-dashed border-muted-foreground/20`} /> No Data
                </span>
            </div>

            {/* ═══ Status Change Modal ════════════════════════════════ */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" /> Update Attendance
                        </DialogTitle>
                    </DialogHeader>
                    {modalEmp && (
                        <div className="space-y-4 pt-2">
                            <div className="bg-muted/30 rounded-lg p-3">
                                <p className="text-sm font-medium">{modalEmp.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {modalEmp.department} · {format(new Date(modalDate + "T12:00:00"), "EEEE, MMM d, yyyy")}
                                </p>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Status</label>
                                <Select value={modalStatus} onValueChange={setModalStatus}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="present">Present</SelectItem>
                                        <SelectItem value="absent">Absent</SelectItem>
                                        <SelectItem value="on_leave">On Leave</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {modalStatus === "present" && (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-sm font-medium">Check In</label>
                                            <Input type="time" value={modalCheckIn} onChange={(e) => setModalCheckIn(e.target.value)} className="mt-1" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Check Out</label>
                                            <Input type="time" value={modalCheckOut} onChange={(e) => setModalCheckOut(e.target.value)} className="mt-1" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Late Minutes</label>
                                        <Input type="number" min="0" max="480" value={modalLate} onChange={(e) => setModalLate(e.target.value)} placeholder="0" className="mt-1" />
                                    </div>
                                </>
                            )}

                            <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                ⚠️ This change will be logged for audit purposes.
                            </p>

                            <div className="flex gap-2 pt-1">
                                <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
                                <Button className="flex-1" onClick={handleSaveStatus}>Save</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ─── Small summary card ─────────────────────────────────────── */
function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
    return (
        <div className="rounded-lg border border-border/50 p-3 flex items-center gap-3">
            <div className={`h-8 w-8 rounded-full ${color}/15 flex items-center justify-center`}>
                <span className={`h-3 w-3 rounded-full ${color}`} />
            </div>
            <div>
                <p className="text-lg font-bold leading-none">{count}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
        </div>
    );
}
