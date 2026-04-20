"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
    format, subDays, eachDayOfInterval, isWeekend, isSameDay,
    startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, addWeeks,
    subMonths, addMonths,
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
    ChevronLeft, ChevronRight, CalendarDays, Filter, Clock, Briefcase, Calendar,
} from "lucide-react";
import type { AttendanceLog, Employee, Project, ShiftTemplate } from "@/types";

/* ─── Status colour map ─────────────────────────────────────── */
const STATUS_COLORS: Record<string, { bg: string; ring: string; label: string; text: string }> = {
    present:  { bg: "bg-emerald-500", ring: "ring-emerald-400", label: "Present",  text: "text-emerald-700 dark:text-emerald-400" },
    absent:   { bg: "bg-red-500",     ring: "ring-red-400",     label: "Absent",   text: "text-red-700 dark:text-red-400" },
    on_leave: { bg: "bg-amber-500",   ring: "ring-amber-400",   label: "On Leave", text: "text-amber-700 dark:text-amber-400" },
    late:     { bg: "bg-orange-500",   ring: "ring-orange-400",  label: "Late",     text: "text-orange-700 dark:text-orange-400" },
    wfh:      { bg: "bg-blue-500",     ring: "ring-blue-400",    label: "WFH",      text: "text-blue-700 dark:text-blue-400" },
    holiday:  { bg: "bg-violet-500",   ring: "ring-violet-400",  label: "Holiday",  text: "text-violet-700 dark:text-violet-400" },
};
const WEEKEND_BG = "bg-muted/40";
const EMPTY_BG   = "bg-muted/20";

type HeatmapStatus = "present" | "absent" | "on_leave" | "late" | "wfh" | "holiday";
type ViewMode = "week" | "2weeks" | "month";

const VIEW_LABELS: Record<ViewMode, string> = {
    week: "Week",
    "2weeks": "2 Weeks",
    month: "Month",
};

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
    shiftTemplates?: ShiftTemplate[];
    employeeShifts?: Record<string, string>; // employeeId -> shiftId
    onStatusChange: (employeeId: string, date: string, newStatus: string, checkIn?: string, checkOut?: string, lateMinutes?: number) => void;
}

/* ═══════════════════════════════════════════════════════════════
   ATTENDANCE HEATMAP
   ═══════════════════════════════════════════════════════════════ */
export function AttendanceHeatmap({
    logs, employees, projects, holidays, canEdit, onStatusChange,
    shiftTemplates = [], employeeShifts = {},
}: AttendanceHeatmapProps) {
    // ─── View mode (default: weekly) ──────────────────────────────
    const [viewMode, setViewMode] = useState<ViewMode>("week");
    const [anchorDate, setAnchorDate] = useState(() => new Date());

    const dateRange = useMemo(() => {
        if (viewMode === "week") {
            const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
            const end = endOfWeek(anchorDate, { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end });
        }
        if (viewMode === "2weeks") {
            const thisWeekStart = startOfWeek(anchorDate, { weekStartsOn: 1 });
            const start = subDays(thisWeekStart, 7);
            const end = endOfWeek(anchorDate, { weekStartsOn: 1 });
            return eachDayOfInterval({ start, end });
        }
        // month
        const start = startOfMonth(anchorDate);
        const end = endOfMonth(anchorDate);
        return eachDayOfInterval({ start, end });
    }, [anchorDate, viewMode]);

    const isCompact = viewMode === "month";

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

    // Status filter: filter employees by their status on today's date (or the
    // nearest past date in the visible range). Previously used `dateRange.some`
    // which showed employees with e.g. "on_leave" under the "Present" filter
    // because they had a present day earlier in the week.
    const displayEmployees = useMemo(() => {
        if (statusFilter === "all") return filteredEmployees;
        const today = format(new Date(), "yyyy-MM-dd");
        return filteredEmployees.filter((emp) => {
            const dateStr = today;
            const log = logMap.get(`${emp.id}|${dateStr}`);
            const status = resolveStatus(log, holidayDates.has(dateStr));
            return status === statusFilter;
        });
    }, [filteredEmployees, statusFilter, logMap, holidayDates]);

    // ─── Modal state ──────────────────────────────────────────────
    const [modalOpen, setModalOpen] = useState(false);
    const [modalEmpId, setModalEmpId] = useState("");
    const [modalDate, setModalDate] = useState("");
    const [modalStatus, setModalStatus] = useState("present");
    const [modalCheckIn, setModalCheckIn] = useState("");
    const [modalCheckOut, setModalCheckOut] = useState("");
    const [modalLate, setModalLate] = useState("0");

    // Get employee's assigned shift
    const getEmployeeShift = useCallback((empId: string): ShiftTemplate | undefined => {
        const shiftId = employeeShifts[empId];
        if (!shiftId) return shiftTemplates[0]; // fallback to first shift (Day Shift)
        return shiftTemplates.find((s) => s.id === shiftId) || shiftTemplates[0];
    }, [employeeShifts, shiftTemplates]);

    const modalEmp = employees.find((e) => e.id === modalEmpId);
    const modalShift = modalEmpId ? getEmployeeShift(modalEmpId) : undefined;

    // Calculate late minutes based on check-in time and shift start
    const computeLateMinutes = useCallback((checkInTime: string, shift?: ShiftTemplate): number => {
        if (!checkInTime || !shift) return 0;
        const [inH, inM] = checkInTime.split(":").map(Number);
        const [shiftH, shiftM] = shift.startTime.split(":").map(Number);
        const inTotal = inH * 60 + inM;
        const shiftTotal = shiftH * 60 + shiftM;
        const gracePeriod = shift.gracePeriod || 10;
        const late = inTotal - shiftTotal - gracePeriod;
        return Math.max(0, late);
    }, []);

    // Calculate hours worked
    const computeHoursWorked = useCallback((checkIn: string, checkOut: string): number => {
        if (!checkIn || !checkOut) return 0;
        const [inH, inM] = checkIn.split(":").map(Number);
        const [outH, outM] = checkOut.split(":").map(Number);
        const inTotal = inH * 60 + inM;
        const outTotal = outH * 60 + outM;
        const diffMin = outTotal >= inTotal ? outTotal - inTotal : 24 * 60 - inTotal + outTotal;
        return Math.round((diffMin / 60) * 10) / 10;
    }, []);

    // Auto-update late minutes when check-in changes
    useEffect(() => {
        if (modalCheckIn && modalShift) {
            const late = computeLateMinutes(modalCheckIn, modalShift);
            setModalLate(String(late));
            // Auto-set status to present if check-in exists
            if (modalStatus === "absent") {
                setModalStatus("present");
            }
        } else if (!modalCheckIn && modalStatus === "present") {
            // If check-in is cleared and status is present, suggest absent
            setModalLate("0");
        }
    }, [modalCheckIn, modalShift, computeLateMinutes, modalStatus]);

    const openCellModal = useCallback((empId: string, date: Date) => {
        if (!canEdit) return;
        const dateStr = format(date, "yyyy-MM-dd");
        const log = logMap.get(`${empId}|${dateStr}`);
        setModalEmpId(empId);
        setModalDate(dateStr);
        
        // Determine initial status
        if (log) {
            setModalStatus(log.status);
            setModalCheckIn(log.checkIn || "");
            setModalCheckOut(log.checkOut || "");
            setModalLate(log.lateMinutes != null ? String(log.lateMinutes) : "0");
        } else {
            // No existing log - determine if should default to absent (past date) or present
            const today = new Date();
            const targetDate = new Date(dateStr + "T12:00:00");
            const isPast = targetDate < today && format(targetDate, "yyyy-MM-dd") !== format(today, "yyyy-MM-dd");
            setModalStatus(isPast ? "absent" : "present");
            setModalCheckIn("");
            setModalCheckOut("");
            setModalLate("0");
        }
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

    // ─── Navigation ───────────────────────────────────────────────
    const goBack = () => {
        if (viewMode === "week") setAnchorDate((d) => subWeeks(d, 1));
        else if (viewMode === "2weeks") setAnchorDate((d) => subWeeks(d, 2));
        else setAnchorDate((d) => subMonths(d, 1));
    };
    const goForward = () => {
        if (viewMode === "week") setAnchorDate((d) => addWeeks(d, 1));
        else if (viewMode === "2weeks") setAnchorDate((d) => addWeeks(d, 2));
        else setAnchorDate((d) => addMonths(d, 1));
    };
    const goToday = () => setAnchorDate(new Date());

    // ─── Summary stats (today only) ─────────────────────────────
    const stats = useMemo(() => {
        let present = 0, absent = 0, late = 0, onLeave = 0;
        const todayStr = format(new Date(), "yyyy-MM-dd");
        if (isWeekend(new Date()) || holidayDates.has(todayStr)) {
            return { present, absent, late, onLeave };
        }
        filteredEmployees.forEach((emp) => {
            const log = logMap.get(`${emp.id}|${todayStr}`);
            if (!log) return;
            if (log.status === "present") {
                if (log.lateMinutes && log.lateMinutes > 0) late++;
                else present++;
            } else if (log.status === "absent") absent++;
            else if (log.status === "on_leave") onLeave++;
        });
        return { present, absent, late, onLeave };
    }, [filteredEmployees, logMap, holidayDates]);

    // ─── Cell size based on view ──────────────────────────────────
    const cellW = isCompact ? "w-[28px]" : viewMode === "2weeks" ? "w-[48px]" : "w-[80px]";
    const cellH = isCompact ? "h-[28px]" : viewMode === "2weeks" ? "h-[40px]" : "h-[44px]";
    const dotSize = isCompact ? "w-3 h-3" : "w-4 h-4";
    const empColW = isCompact ? "w-[200px]" : "w-[220px]";

    return (
        <div className="space-y-4">
            {/* ─── Summary Cards ──────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryCard label="Present" count={stats.present} color="bg-emerald-500" />
                <SummaryCard label="Absent" count={stats.absent} color="bg-red-500" />
                <SummaryCard label="Late" count={stats.late} color="bg-orange-500" />
                <SummaryCard label="On Leave" count={stats.onLeave} color="bg-amber-500" />
            </div>

            {/* ─── Toolbar: View Toggle + Filters ─────────────────── */}
            <Card className="border border-border/40 shadow-sm">
                <CardContent className="p-3 space-y-3">
                    {/* Row 1: View toggle + navigation */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                            {(["week", "2weeks", "month"] as ViewMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setViewMode(mode)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                        viewMode === mode
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {VIEW_LABELS[mode]}
                                </button>
                            ))}
                        </div>
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
                            <span className="text-xs text-muted-foreground hidden sm:inline ml-1">
                                {viewMode === "month"
                                    ? format(anchorDate, "MMMM yyyy")
                                    : `${format(dateRange[0], "MMM d")} — ${format(dateRange[dateRange.length - 1], "MMM d, yyyy")}`}
                            </span>
                        </div>
                    </div>
                    {/* Row 2: Filters */}
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
                        <span className="text-xs text-muted-foreground ml-auto">
                            {displayEmployees.length} employee{displayEmployees.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* ─── Heatmap Grid ───────────────────────────────────── */}
            <Card className="border border-border/40 shadow-sm">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <div className="min-w-fit">
                            {/* Header: dates */}
                            <div className="flex border-b border-border/40 sticky top-0 bg-background z-10">
                                <div className={`shrink-0 ${empColW} p-2 border-r border-border/40 bg-muted/30`}>
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
                                                className={`${cellW} shrink-0 text-center border-r border-border/30 flex flex-col items-center justify-center ${
                                                    isCompact ? "py-1.5" : "py-2"
                                                } ${
                                                    isToday ? "bg-blue-500/10" : isHol ? "bg-violet-500/5" : isWknd ? "bg-muted/20" : ""
                                                }`}
                                            >
                                                <p className={`${isCompact ? "text-[8px]" : "text-[10px]"} leading-tight font-medium ${
                                                    isToday ? "text-blue-600 dark:text-blue-400" : isWknd ? "text-muted-foreground/60" : "text-muted-foreground"
                                                }`}>
                                                    {isCompact ? format(d, "EEE").charAt(0) : format(d, "EEE")}
                                                </p>
                                                <p className={`${isCompact ? "text-[9px]" : "text-xs"} leading-tight font-mono ${
                                                    isToday ? "font-bold text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                                                }`}>
                                                    {isCompact ? format(d, "d") : format(d, "d MMM")}
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
                                        <div className={`shrink-0 ${empColW} p-2 border-r border-border/40 flex flex-col justify-center`}>
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
                                                                className={`${cellW} ${cellH} shrink-0 flex flex-col items-center justify-center gap-0.5 border-r border-border/30 transition-all ${
                                                                    canEdit && !isWknd && !isFuture
                                                                        ? "cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-offset-background " + (colorInfo?.ring || "hover:ring-muted-foreground/30")
                                                                        : "cursor-default"
                                                                } ${isWknd ? "bg-muted/10" : ""}`}
                                                                onClick={() => {
                                                                    if (canEdit && !isWknd && !isFuture) {
                                                                        openCellModal(emp.id, d);
                                                                    }
                                                                }}
                                                                disabled={isWknd || isFuture}
                                                            >
                                                                {isWknd ? (
                                                                    <span className={`${dotSize} rounded-full ${WEEKEND_BG}`} />
                                                                ) : isFuture ? (
                                                                    <span className={`${dotSize} rounded-full ${EMPTY_BG}`} />
                                                                ) : colorInfo ? (
                                                                    <>
                                                                        <span className={`${dotSize} rounded-full ${colorInfo.bg} ${
                                                                            status === "present" ? "opacity-90" : ""
                                                                        }`} />
                                                                        {!isCompact && (
                                                                            <span className={`text-[9px] leading-none font-medium ${colorInfo.text}`}>
                                                                                {colorInfo.label}
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <span className={`${dotSize} rounded-full ${EMPTY_BG} border border-dashed border-muted-foreground/20`} />
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
                                                                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${STATUS_COLORS[status]?.bg}`} />
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground px-1">
                <span className="font-semibold text-foreground/70 uppercase tracking-wider text-[10px]">Legend</span>
                {Object.entries(STATUS_COLORS).map(([key, val]) => (
                    <span key={key} className="flex items-center gap-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${val.bg}`} /> {val.label}
                    </span>
                ))}
                <span className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${WEEKEND_BG} border border-muted-foreground/20`} /> Weekend
                </span>
                <span className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${EMPTY_BG} border border-dashed border-muted-foreground/20`} /> No Data
                </span>
            </div>

            {/* ═══ Status Change Modal ════════════════════════════════ */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" /> Update Attendance
                        </DialogTitle>
                    </DialogHeader>
                    {modalEmp && (
                        <div className="space-y-4 pt-2">
                            {/* Employee Info Card */}
                            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium">{modalEmp.name}</p>
                                    <Badge variant="secondary" className="text-[10px]">{modalEmp.workType || "WFO"}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {modalEmp.department} · {format(new Date(modalDate + "T12:00:00"), "EEEE, MMM d, yyyy")}
                                </p>
                                
                                {/* Shift Info */}
                                {modalShift && (
                                    <div className="flex items-center gap-2 pt-1">
                                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-xs">
                                            <span className="font-medium">{modalShift.name}</span>
                                            <span className="text-muted-foreground"> · {modalShift.startTime} – {modalShift.endTime}</span>
                                            <span className="text-muted-foreground/70"> (grace: {modalShift.gracePeriod || 10}min)</span>
                                        </span>
                                    </div>
                                )}
                                
                                {/* Work Days */}
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                        Work Days: {modalEmp.workDays?.join(", ") || "Mon, Tue, Wed, Thu, Fri"}
                                    </span>
                                </div>

                                {/* Project Assignment */}
                                {(() => {
                                    const proj = getProjectForEmp(modalEmpId);
                                    return proj ? (
                                        <div className="flex items-center gap-2">
                                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">
                                                Project: {proj.name}
                                            </span>
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            {/* Status Selection */}
                            <div>
                                <label className="text-sm font-medium">Status</label>
                                <Select value={modalStatus} onValueChange={(val) => {
                                    setModalStatus(val);
                                    if (val === "absent" || val === "on_leave") {
                                        setModalCheckIn("");
                                        setModalCheckOut("");
                                        setModalLate("0");
                                    }
                                }}>
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
                                            <Input 
                                                type="time" 
                                                value={modalCheckIn} 
                                                onChange={(e) => setModalCheckIn(e.target.value)} 
                                                className="mt-1" 
                                            />
                                            {modalShift && (
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    Shift starts: {modalShift.startTime}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Check Out</label>
                                            <Input 
                                                type="time" 
                                                value={modalCheckOut} 
                                                onChange={(e) => setModalCheckOut(e.target.value)} 
                                                className="mt-1" 
                                            />
                                            {modalShift && (
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    Shift ends: {modalShift.endTime}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Late Minutes (auto-computed) */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-sm font-medium">Late Minutes</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Input 
                                                    type="number" 
                                                    min="0" 
                                                    max="480" 
                                                    value={modalLate} 
                                                    onChange={(e) => setModalLate(e.target.value)} 
                                                    className="flex-1"
                                                />
                                                {Number(modalLate) > 0 && (
                                                    <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/30">
                                                        +{modalLate}m late
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                Auto-computed from shift start + grace period
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Hours Worked</label>
                                            <div className="mt-1 h-9 flex items-center px-3 bg-muted/50 rounded-md text-sm">
                                                {modalCheckIn && modalCheckOut 
                                                    ? `${computeHoursWorked(modalCheckIn, modalCheckOut)}h`
                                                    : "—"
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                This change will be logged for audit purposes.
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

/* ─── KPI Summary Card (modern SaaS style) ──────────────────── */
function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
    return (
        <div className="group relative rounded-xl border border-border/40 bg-gradient-to-br from-background to-muted/20 p-4 transition-all hover:shadow-md hover:border-border/60">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                    <p className="text-2xl font-bold tracking-tight mt-1">{count}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl ${color}/10 flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <span className={`h-4 w-4 rounded-full ${color} shadow-sm`} />
                </div>
            </div>
        </div>
    );
}
