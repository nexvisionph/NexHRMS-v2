"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useLeaveStore } from "@/store/leave.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useEventsStore } from "@/store/events.store";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { formatCurrency, getInitials } from "@/lib/format";
import type { LeaveType } from "@/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
    LogIn, LogOut, Clock, CalendarDays, CalendarOff, Banknote,
    FileText, Plus, ChevronRight, Calendar, Cake, TrendingUp,
    ArrowRight, Briefcase, Timer, AlertCircle,
} from "lucide-react";
import { parseISO, isAfter, startOfDay, isToday, format } from "date-fns";

/* ─── Helpers ───────────────────────────────────────────────── */

function formatTimeAmPm(time: string | null | undefined): string {
    if (!time) return "—";
    const [h, m] = time.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return time;
    const hour12 = h % 12 || 12;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/* ─── Main Component ─────────────────────────────────────────── */

export function EmployeeDashboard() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const rh = useRoleHref();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">
                    Welcome back, {currentUser.name.split(" ")[0]}!
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Your personal workspace — attendance, leave, and payslips.
                </p>
            </div>

            {/* Row 1: Attendance Status + Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <AttendanceStatusCard />
                <QuickStatCards />
            </div>

            {/* Row 2: Leave Balance (full width) */}
            <LeaveBalanceCard />

            {/* Row 3: Latest Payslip + Leave Requests */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <LatestPayslipCard />
                <div className="lg:col-span-2">
                    <LeaveRequestsCard />
                </div>
            </div>

            {/* Row 4: Events + Birthdays */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <EventsCard />
                <BirthdaysCard />
            </div>
        </div>
    );
}

/* ─── 1. Attendance Status Card ─────────────────────────────── */

function AttendanceStatusCard() {
    const rh = useRoleHref();
    const [status, setStatus] = useState<string>("loading");
    const [checkIn, setCheckIn] = useState<string | null>(null);
    const [checkOut, setCheckOut] = useState<string | null>(null);
    const [weekStats, setWeekStats] = useState({ presentDays: 0, totalHours: 0, lateDays: 0 });

    useEffect(() => {
        let mounted = true;
        const fetchStatus = async () => {
            try {
                const res = await fetch("/api/attendance/my-status");
                if (!res.ok) throw new Error("Failed to fetch");
                const data = await res.json();
                if (!mounted) return;
                if (data.log) {
                    setStatus(data.log.status || "present");
                    setCheckIn(data.log.checkIn || null);
                    setCheckOut(data.log.checkOut || null);
                } else {
                    setStatus("absent");
                }
                if (data.weekStats) setWeekStats(data.weekStats);
            } catch {
                if (mounted && status === "loading") setStatus("absent");
            }
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000);
        return () => { mounted = false; clearInterval(interval); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const statusConfig: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; label: string }> = {
        loading: { bg: "bg-muted/30", border: "border-muted", text: "text-muted-foreground", icon: <Clock className="h-5 w-5 animate-pulse" />, label: "Loading..." },
        present: { bg: "bg-emerald-500/5", border: "border-emerald-500/30", text: "text-emerald-700 dark:text-emerald-400", icon: <LogIn className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />, label: "Present" },
        absent: { bg: "bg-red-500/5", border: "border-red-400/30", text: "text-red-700 dark:text-red-400", icon: <LogOut className="h-5 w-5 text-red-500 dark:text-red-400" />, label: "Absent" },
        on_leave: { bg: "bg-amber-500/5", border: "border-amber-400/30", text: "text-amber-700 dark:text-amber-400", icon: <CalendarOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />, label: "On Leave" },
    };

    const cfg = statusConfig[status] || statusConfig.absent;

    return (
        <Link href={rh("/attendance")} className="block lg:col-span-2">
            <Card className={`${cfg.bg} ${cfg.border} border-2 cursor-pointer hover:shadow-md transition-all group h-full`}>
                <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-white/60 dark:bg-black/20 shadow-sm">
                                {cfg.icon}
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today&apos;s Status</p>
                                <p className={`text-2xl font-bold capitalize mt-0.5 ${cfg.text}`}>{cfg.label}</p>
                                {status !== "loading" && (
                                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                                        {checkIn && (
                                            <span className="flex items-center gap-1">
                                                <LogIn className="h-3 w-3" /> In: {formatTimeAmPm(checkIn)}
                                            </span>
                                        )}
                                        {checkOut && (
                                            <span className="flex items-center gap-1">
                                                <LogOut className="h-3 w-3" /> Out: {formatTimeAmPm(checkOut)}
                                            </span>
                                        )}
                                        {!checkIn && !checkOut && status === "absent" && (
                                            <span className="flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" /> No check-in recorded
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                    </div>

                    {status !== "loading" && (
                        <>
                            <Separator className="my-4 opacity-50" />
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center">
                                    <p className="text-2xl font-bold tabular-nums">
                                        {weekStats.presentDays}<span className="text-sm font-normal text-muted-foreground">/5</span>
                                    </p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">Days Present</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold tabular-nums">{weekStats.totalHours}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">Hours Worked</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold tabular-nums">{weekStats.lateDays}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">Late Days</p>
                                </div>
                            </div>
                        </>
                    )}

                    {status === "loading" && (
                        <div className="mt-4 space-y-2">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}

/* ─── 2. Quick Stat Cards (alongside attendance) ────────────── */

function QuickStatCards() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const employees = useEmployeesStore((s) => s.employees);
    const leaveRequests = useLeaveStore((s) => s.requests);
    const payslips = usePayrollStore((s) => s.payslips);
    const rh = useRoleHref();

    const empRecord = useMemo(
        () => employees.find((e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name),
        [employees, currentUser]
    );

    const pendingLeaves = useMemo(
        () => empRecord ? leaveRequests.filter((r) => r.employeeId === empRecord.id && r.status === "pending").length : 0,
        [leaveRequests, empRecord]
    );

    const approvedLeaves = useMemo(
        () => empRecord ? leaveRequests.filter((r) => r.employeeId === empRecord.id && r.status === "approved" && new Date(r.startDate).getFullYear() === new Date().getFullYear()).length : 0,
        [leaveRequests, empRecord]
    );

    const latestPayslip = useMemo(() => {
        if (!empRecord) return null;
        return payslips
            .filter((p) => p.employeeId === empRecord.id && ["draft", "published", "signed"].includes(p.status))
            .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0] || null;
    }, [payslips, empRecord]);

    const stats = [
        {
            label: "Pending Leaves",
            value: pendingLeaves,
            icon: <Clock className="h-4 w-4" />,
            href: rh("/leave"),
            color: "text-amber-600 dark:text-amber-400",
            bgColor: "bg-amber-500/10",
        },
        {
            label: "Used This Year",
            value: `${approvedLeaves} days`,
            icon: <CalendarDays className="h-4 w-4" />,
            href: rh("/leave"),
            color: "text-blue-600 dark:text-blue-400",
            bgColor: "bg-blue-500/10",
        },
    ];

    return (
        <>
            {stats.map((stat) => (
                <Link key={stat.label} href={stat.href} className="block">
                    <Card className="border border-border/50 cursor-pointer hover:shadow-md hover:border-primary/20 transition-all h-full group">
                        <CardContent className="p-5 flex flex-col justify-between h-full">
                            <div className="flex items-center justify-between">
                                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                                    <span className={stat.color}>{stat.icon}</span>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="mt-3">
                                <p className="text-2xl font-bold">{stat.value}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </>
    );
}

/* ─── 3. Leave Balance Card ──────────────────────────────────── */

function LeaveBalanceCard() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const employees = useEmployeesStore((s) => s.employees);
    const leaveRequests = useLeaveStore((s) => s.requests);
    const rh = useRoleHref();

    const empRecord = useMemo(
        () => employees.find((e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name),
        [employees, currentUser]
    );

    const leaveTypes: LeaveType[] = ["VL", "SL", "EL", "ML", "PL", "SPL", "OTHER"];
    const leaveLabels: Record<LeaveType, string> = {
        VL: "Vacation Leave", SL: "Sick Leave", EL: "Emergency Leave",
        OTHER: "Other Leave", ML: "Maternity Leave", PL: "Paternity Leave", SPL: "Solo Parent Leave",
    };
    const leaveColors: Record<LeaveType, string> = {
        VL: "bg-blue-500", SL: "bg-rose-500", EL: "bg-amber-500",
        OTHER: "bg-slate-400", ML: "bg-pink-500", PL: "bg-indigo-500", SPL: "bg-teal-500",
    };

    const currentYear = new Date().getFullYear();

    const myLeaves = useMemo(() => {
        if (!empRecord) return [];
        return leaveRequests.filter((r) => r.employeeId === empRecord.id);
    }, [leaveRequests, empRecord]);

    const leaveUsage = useMemo(() => {
        return leaveTypes.map((type) => {
            const approved = myLeaves.filter(
                (r) => r.type === type && r.status === "approved" && new Date(r.startDate).getFullYear() === currentYear
            );
            const used = approved.reduce((sum, r) => {
                const days = Math.ceil((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86400000) + 1;
                return sum + days;
            }, 0);
            return { type, label: leaveLabels[type], used, alloc: 15, color: leaveColors[type] };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myLeaves, currentYear]);

    const totalUsed = leaveUsage.reduce((sum, l) => sum + l.used, 0);
    const totalAlloc = leaveUsage.reduce((sum, l) => sum + l.alloc, 0);

    return (
        <Card className="border border-border/50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-violet-500/10">
                            <CalendarOff className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-semibold">Leave Balance {currentYear}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {totalUsed} of {totalAlloc} total days used
                            </p>
                        </div>
                    </div>
                    <Link href={rh("/leave")}>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                            <Plus className="h-3.5 w-3.5" /> Request Leave
                        </Button>
                    </Link>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                    {leaveUsage.map((l) => (
                        <div key={l.type} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{l.label}</span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {l.used} / {l.alloc}
                                </span>
                            </div>
                            <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${l.color}`}
                                    style={{ width: `${l.alloc > 0 ? Math.min((l.used / l.alloc) * 100, 100) : 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── 4. Latest Payslip Card ─────────────────────────────────── */

function LatestPayslipCard() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const employees = useEmployeesStore((s) => s.employees);
    const payslips = usePayrollStore((s) => s.payslips);
    const rh = useRoleHref();

    const empRecord = useMemo(
        () => employees.find((e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name),
        [employees, currentUser]
    );

    const latestPayslip = useMemo(() => {
        if (!empRecord) return null;
        return payslips
            .filter((p) => p.employeeId === empRecord.id && ["draft", "published", "signed"].includes(p.status))
            .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0] || null;
    }, [payslips, empRecord]);

    const statusColors: Record<string, string> = {
        draft: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
        published: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
        signed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    };

    return (
        <Link href={rh("/payroll")} className="block">
            <Card className="border border-border/50 cursor-pointer hover:shadow-md hover:border-primary/20 transition-all h-full group">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-emerald-500/10">
                                <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">Latest Payslip</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {latestPayslip ? (
                        <div className="space-y-3">
                            <p className="text-3xl font-bold tracking-tight">{formatCurrency(latestPayslip.netPay)}</p>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-[10px] font-medium ${statusColors[latestPayslip.status] || ""}`}>
                                    {latestPayslip.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{latestPayslip.issuedAt}</span>
                            </div>
                            <Separator className="opacity-50" />
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <p className="text-muted-foreground">Gross Pay</p>
                                    <p className="font-semibold mt-0.5">{formatCurrency(latestPayslip.grossPay)}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Deductions</p>
                                    <p className="font-semibold mt-0.5 text-red-600 dark:text-red-400">
                                        -{formatCurrency(latestPayslip.grossPay - latestPayslip.netPay + latestPayslip.allowances)}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-primary font-medium flex items-center gap-1 pt-1">
                                View all payslips <ArrowRight className="h-3 w-3" />
                            </p>
                        </div>
                    ) : (
                        <div className="py-6 text-center">
                            <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                            <p className="text-sm text-muted-foreground mt-2">No payslips yet</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}

/* ─── 5. Leave Requests Card ─────────────────────────────────── */

function LeaveRequestsCard() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const employees = useEmployeesStore((s) => s.employees);
    const leaveRequests = useLeaveStore((s) => s.requests);
    const rh = useRoleHref();

    const empRecord = useMemo(
        () => employees.find((e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name),
        [employees, currentUser]
    );

    const myLeaves = useMemo(() => {
        if (!empRecord) return [];
        return leaveRequests
            .filter((r) => r.employeeId === empRecord.id)
            .sort((a, b) => b.startDate.localeCompare(a.startDate))
            .slice(0, 5);
    }, [leaveRequests, empRecord]);

    const leaveLabels: Record<string, string> = {
        VL: "Vacation", SL: "Sick", EL: "Emergency", OTHER: "Other", ML: "Maternity", PL: "Paternity", SPL: "Solo Parent",
    };

    const statusConfig: Record<string, { color: string; dot: string }> = {
        pending: { color: "bg-amber-500/10 text-amber-700 dark:text-amber-400", dot: "bg-amber-500" },
        approved: { color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500" },
        rejected: { color: "bg-red-500/10 text-red-700 dark:text-red-400", dot: "bg-red-500" },
    };

    return (
        <Card className="border border-border/50 h-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-sky-500/10">
                            <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        </div>
                        <CardTitle className="text-base font-semibold">My Leave Requests</CardTitle>
                    </div>
                    <Link href={rh("/leave")}>
                        <Button variant="ghost" size="sm" className="text-xs gap-1">
                            View All <ChevronRight className="h-3 w-3" />
                        </Button>
                    </Link>
                </div>
            </CardHeader>
            <CardContent>
                {myLeaves.length === 0 ? (
                    <div className="py-8 text-center">
                        <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                        <p className="text-sm text-muted-foreground mt-2">No leave requests yet</p>
                        <Link href={rh("/leave")}>
                            <Button variant="outline" size="sm" className="mt-3 gap-1.5 text-xs">
                                <Plus className="h-3.5 w-3.5" /> Request Leave
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {myLeaves.map((req) => {
                            const days = Math.ceil((new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / 86400000) + 1;
                            const sc = statusConfig[req.status] || statusConfig.pending;
                            return (
                                <div key={req.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className={`h-2 w-2 rounded-full shrink-0 ${sc.dot}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium">{leaveLabels[req.type] || req.type}</p>
                                            <Badge variant="secondary" className={`text-[10px] ${sc.color}`}>
                                                {req.status}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {req.startDate} → {req.endDate} · {days} day{days !== 1 ? "s" : ""}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/* ─── 6. Events Card ─────────────────────────────────────────── */

function EventsCard() {
    const { events } = useEventsStore();
    const rh = useRoleHref();
    const today = startOfDay(new Date());

    const upcoming = useMemo(
        () => [...events]
            .filter((e) => {
                const eventDate = parseISO(e.date);
                return isAfter(eventDate, today) || isToday(eventDate);
            })
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 5),
        [events, today]
    );

    return (
        <Card className="border border-border/50 h-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-violet-500/10">
                            <Calendar className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <CardTitle className="text-base font-semibold">Events & Meetings</CardTitle>
                    </div>
                    <Link href={rh("/events")}>
                        <Button variant="ghost" size="sm" className="text-xs gap-1">
                            View All <ChevronRight className="h-3 w-3" />
                        </Button>
                    </Link>
                </div>
            </CardHeader>
            <CardContent>
                {upcoming.length === 0 ? (
                    <div className="py-8 text-center">
                        <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                        <p className="text-sm text-muted-foreground mt-2">No upcoming events</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {upcoming.map((evt) => (
                            <div key={evt.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="h-10 w-10 rounded-lg bg-primary/5 border border-border/50 flex flex-col items-center justify-center shrink-0">
                                    <span className="text-[10px] font-medium text-muted-foreground uppercase leading-none">
                                        {format(parseISO(evt.date), "MMM")}
                                    </span>
                                    <span className="text-sm font-bold leading-tight">
                                        {format(parseISO(evt.date), "d")}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{evt.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {format(parseISO(evt.date), "EEEE")} · {evt.time}
                                    </p>
                                </div>
                                <Badge variant="secondary" className="text-[10px] shrink-0">{evt.type}</Badge>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/* ─── 7. Birthdays Card ──────────────────────────────────────── */

function BirthdaysCard() {
    const employees = useEmployeesStore((s) => s.employees);
    const currentMonth = new Date().getMonth();
    const monthName = format(new Date(), "MMMM");

    const birthdays = useMemo(() => {
        return employees
            .filter((e) => e.birthday && new Date(e.birthday).getMonth() === currentMonth && e.status === "active")
            .sort((a, b) => new Date(a.birthday!).getDate() - new Date(b.birthday!).getDate());
    }, [employees, currentMonth]);

    return (
        <Card className="border border-border/50 h-full">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-pink-500/10">
                        <Cake className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-semibold">Birthdays</CardTitle>
                        <p className="text-xs text-muted-foreground">{monthName} · {birthdays.length} celebration{birthdays.length !== 1 ? "s" : ""}</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {birthdays.length === 0 ? (
                    <div className="py-8 text-center">
                        <Cake className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                        <p className="text-sm text-muted-foreground mt-2">No birthdays this month</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {birthdays.slice(0, 5).map((emp) => {
                            const bday = new Date(emp.birthday!);
                            const isToday_ = bday.getDate() === new Date().getDate() && bday.getMonth() === new Date().getMonth();
                            return (
                                <div key={emp.id} className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${isToday_ ? "bg-pink-500/5 border border-pink-500/20" : "hover:bg-muted/50"}`}>
                                    <Avatar className="h-9 w-9">
                                        <AvatarFallback className="text-xs bg-muted font-medium">{getInitials(emp.name)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-sm font-medium truncate">{emp.name}</p>
                                            {isToday_ && <Badge className="text-[9px] bg-pink-500 text-white">Today! 🎂</Badge>}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{emp.department}</p>
                                    </div>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                        {format(bday, "MMM d")}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
