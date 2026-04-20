"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useLeaveStore } from "@/store/leave.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useLoansStore } from "@/store/loans.store";
import { useEventsStore } from "@/store/events.store";
import { useAuditStore } from "@/store/audit.store";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { formatCurrency, getInitials, formatDate } from "@/lib/format";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Users, UserCheck, UserX, CalendarOff, ArrowUpRight,
    Clock, Banknote, FileText, ChevronRight, Cake,
    AlertCircle, CreditCard, Activity, UserPlus, ArrowDownRight,
} from "lucide-react";
import {
    ResponsiveContainer, XAxis, YAxis, CartesianGrid,
    Tooltip as RechartsTooltip, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { isToday, parseISO, isAfter, startOfDay, format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";

/* ─── Main Component ─────────────────────────────────────────── */

export function AdminDashboard() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const rh = useRoleHref();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Welcome back, {currentUser.name.split(" ")[0]}!
                    </h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Full system overview — employees, attendance, payroll, and financials.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={rh("/employees/manage")}>
                            <UserPlus className="h-4 w-4 mr-1.5" /> Add Employee
                        </Link>
                    </Button>
                    <Button size="sm" asChild>
                        <Link href={rh("/payroll")}>
                            <Banknote className="h-4 w-4 mr-1.5" /> Run Payroll
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Row 1: KPI Stats */}
            <KpiStatsRow />

            {/* Row 2: Attendance Trend + Department Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                    <AttendanceTrendChart />
                </div>
                <DepartmentDistributionChart />
            </div>

            {/* Row 3: Pending Actions + Recent Hires + Payroll Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <PendingActionsCard />
                <PayrollSummaryCard />
                <RecentHiresCard />
            </div>

            {/* Row 4: Upcoming Events + Birthdays */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <UpcomingEventsCard />
                <BirthdaysCard />
            </div>

            {/* Row 5: Recent Activity */}
            <RecentActivityCard />
        </div>
    );
}

/* ─── 1. KPI Stats Row ──────────────────────────────────────── */

function KpiStatsRow() {
    const employees = useEmployeesStore((s) => s.employees);
    const logs = useAttendanceStore((s) => s.logs);
    const leaveRequests = useLeaveStore((s) => s.requests);
    const overtimeRequests = useAttendanceStore((s) => s.overtimeRequests);
    const rh = useRoleHref();

    const activeEmployees = employees.filter((e) => e.status === "active").length;

    // Find the most recent date with SUBSTANTIAL attendance records (not just 1 stray log)
    // This handles the case where today might have 1 manual log but yesterday has full data
    const { reportingDate, recentLogs: dayLogs } = useMemo(() => {
        const dateCounts = new Map<string, number>();
        logs.forEach((l) => dateCounts.set(l.date, (dateCounts.get(l.date) || 0) + 1));
        const sortedDates = [...dateCounts.entries()]
            .sort(([a], [b]) => b.localeCompare(a)); // newest first

        // Pick the most recent date that has logs for at least 30% of active employees,
        // or if none qualifies, just pick the date with the most logs
        const threshold = Math.max(3, Math.floor(activeEmployees * 0.3));
        const best = sortedDates.find(([, count]) => count >= threshold);
        const chosenDate = best?.[0] ?? sortedDates[0]?.[0] ?? new Date().toISOString().split("T")[0];
        return {
            reportingDate: chosenDate,
            recentLogs: logs.filter((l) => l.date === chosenDate),
        };
    }, [logs, activeEmployees]);

    const presentCount = dayLogs.filter((l) => l.status === "present").length;
    const onLeaveCount = dayLogs.filter((l) => l.status === "on_leave").length;
    const absentCount = dayLogs.filter((l) => l.status === "absent").length;

    const pendingLeaves = leaveRequests.filter((r) => r.status === "pending").length;
    const pendingOT = overtimeRequests.filter((r) => r.status === "pending").length;

    const newThisMonth = useMemo(() => {
        return employees.filter((e) => {
            if (!e.joinDate) return false;
            try {
                const jd = parseISO(e.joinDate);
                return jd >= startOfMonth(new Date()) && jd <= endOfMonth(new Date());
            } catch { return false; }
        }).length;
    }, [employees]);

    const attendancePct = activeEmployees > 0 ? Math.round((presentCount / activeEmployees) * 100) : 0;

    const stats = [
        {
            label: "Active Employees",
            value: activeEmployees,
            change: newThisMonth > 0 ? `+${newThisMonth} this month` : "No new hires",
            changeType: newThisMonth > 0 ? "positive" as const : "neutral" as const,
            icon: Users,
            iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
            href: rh("/employees/manage"),
        },
        {
            label: "Present",
            value: presentCount,
            change: `${attendancePct}% attendance rate`,
            changeType: attendancePct >= 80 ? "positive" as const : attendancePct >= 60 ? "neutral" as const : "negative" as const,
            icon: UserCheck,
            iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            href: rh("/attendance"),
        },
        {
            label: "Absent",
            value: absentCount,
            change: `${activeEmployees > 0 ? Math.round((absentCount / activeEmployees) * 100) : 0}% of workforce`,
            changeType: absentCount > Math.round(activeEmployees * 0.15) ? "negative" as const : "neutral" as const,
            icon: UserX,
            iconBg: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
            href: rh("/attendance"),
        },
        {
            label: "On Leave",
            value: onLeaveCount,
            change: `${pendingLeaves} pending approval`,
            changeType: pendingLeaves > 0 ? "warning" as const : "neutral" as const,
            icon: CalendarOff,
            iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
            href: rh("/leave"),
        },
    ];

    return (
        <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
                Attendance data as of: <span className="font-medium text-foreground">{(() => { try { return format(parseISO(reportingDate), "MMMM d, yyyy"); } catch { return reportingDate; } })()}</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <Link key={stat.label} href={stat.href}>
                        <Card className="border border-border/50 hover:border-border hover:shadow-sm transition-all cursor-pointer group">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                                        <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                                        <div className="flex items-center gap-1 text-xs">
                                            {stat.changeType === "positive" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
                                            {stat.changeType === "negative" && <ArrowDownRight className="h-3 w-3 text-red-500" />}
                                            {stat.changeType === "warning" && <AlertCircle className="h-3 w-3 text-amber-500" />}
                                            <span className={
                                                stat.changeType === "positive" ? "text-emerald-600 dark:text-emerald-400" :
                                                stat.changeType === "negative" ? "text-red-600 dark:text-red-400" :
                                                stat.changeType === "warning" ? "text-amber-600 dark:text-amber-400" :
                                                "text-muted-foreground"
                                            }>
                                                {stat.change}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`p-2.5 rounded-xl ${stat.iconBg} group-hover:scale-110 transition-transform`}>
                                        <stat.icon className="h-5 w-5" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}

/* ─── 2. Attendance Trend (Area Chart) ──────────────────────── */

const CHART_COLORS = {
    present: "var(--color-chart-2)",
    absent: "var(--color-chart-1)",
    onLeave: "var(--color-chart-4)",
};

function AttendanceTrendChart() {
    const logs = useAttendanceStore((s) => s.logs);
    const rh = useRoleHref();

    const chartData = useMemo(() => {
        const last6Months = eachMonthOfInterval({
            start: subMonths(startOfMonth(new Date()), 5),
            end: startOfMonth(new Date()),
        });

        return last6Months.map((month) => {
            const monthStr = format(month, "yyyy-MM");
            const monthLogs = logs.filter((l) => l.date.startsWith(monthStr));
            const present = monthLogs.filter((l) => l.status === "present").length;
            const absent = monthLogs.filter((l) => l.status === "absent").length;
            const onLeave = monthLogs.filter((l) => l.status === "on_leave").length;

            return {
                month: format(month, "MMM"),
                Present: present,
                Absent: absent,
                "On Leave": onLeave,
            };
        });
    }, [logs]);

    return (
        <Card className="border border-border/50">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-semibold">Attendance Overview</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Last 6 months trend</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs gap-1" asChild>
                        <Link href={rh("/attendance")}>
                            View All <ChevronRight className="h-3 w-3" />
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pb-4">
                <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                            <defs>
                                <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={CHART_COLORS.present} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={CHART_COLORS.present} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="absentGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={CHART_COLORS.absent} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={CHART_COLORS.absent} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" tickLine={false} axisLine={false} />
                            <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickLine={false} axisLine={false} />
                            <RechartsTooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                }}
                                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                            />
                            <Area type="monotone" dataKey="Present" stroke={CHART_COLORS.present} fill="url(#presentGrad)" strokeWidth={2} />
                            <Area type="monotone" dataKey="Absent" stroke={CHART_COLORS.absent} fill="url(#absentGrad)" strokeWidth={2} />
                            <Area type="monotone" dataKey="On Leave" stroke={CHART_COLORS.onLeave} fill="none" strokeWidth={2} strokeDasharray="5 5" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.present }} />
                        Present
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.absent }} />
                        Absent
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.onLeave }} />
                        On Leave
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── 3. Department Distribution (Donut Chart) ──────────────── */

const DEPT_COLORS = [
    "var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)",
    "var(--color-chart-4)", "var(--color-chart-5)", "#8b5cf6", "#06b6d4",
    "#f43f5e", "#10b981", "#f59e0b",
];

function DepartmentDistributionChart() {
    const employees = useEmployeesStore((s) => s.employees);
    const rh = useRoleHref();

    const data = useMemo(() => {
        const active = employees.filter((e) => e.status === "active");
        const deptMap = new Map<string, number>();
        active.forEach((e) => {
            const dept = e.department || "Unassigned";
            deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
        });
        return Array.from(deptMap, ([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [employees]);

    const total = data.reduce((sum, d) => sum + d.value, 0);

    return (
        <Card className="border border-border/50">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-semibold">Employees by Department</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{total} total active</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs gap-1" asChild>
                        <Link href={rh("/employees/manage")}>
                            View <ChevronRight className="h-3 w-3" />
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pb-4">
                <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={10} minHeight={10}>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                                strokeWidth={0}
                            >
                                {data.map((_, i) => (
                                    <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                                ))}
                            </Pie>
                            <RechartsTooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                }}
                                formatter={(value, name) => [`${value ?? 0} employees`, name ?? ""]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-1">
                    {data.slice(0, 8).map((dept, i) => (
                        <div key={dept.name} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 truncate">
                                <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{ backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }}
                                />
                                <span className="truncate text-muted-foreground">{dept.name}</span>
                            </span>
                            <span className="font-medium ml-1">{dept.value}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── 4. Pending Actions Card ───────────────────────────────── */

function PendingActionsCard() {
    const leaveRequests = useLeaveStore((s) => s.requests);
    const overtimeRequests = useAttendanceStore((s) => s.overtimeRequests);
    const payrollAdjustments = usePayrollStore((s) => s.adjustments);
    const loans = useLoansStore((s) => s.loans);
    const rh = useRoleHref();

    const pendingLeaves = leaveRequests.filter((r) => r.status === "pending").length;
    const pendingOT = overtimeRequests.filter((r) => r.status === "pending").length;
    const pendingAdj = payrollAdjustments.filter((a) => a.status === "pending").length;
    const activeLoans = loans.filter((l) => l.status === "active").length;

    const actions = [
        { label: "Leave Requests", count: pendingLeaves, href: rh("/leave"), icon: CalendarOff, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10" },
        { label: "OT Requests", count: pendingOT, href: rh("/attendance"), icon: Clock, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
        { label: "Payroll Adjustments", count: pendingAdj, href: rh("/payroll"), icon: CreditCard, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
        { label: "Active Loans", count: activeLoans, href: rh("/loans"), icon: Banknote, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    ];

    const totalPending = pendingLeaves + pendingOT + pendingAdj;

    return (
        <Card className="border border-border/50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-semibold">Pending Actions</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {totalPending > 0 ? `${totalPending} items need attention` : "All caught up!"}
                        </p>
                    </div>
                    {totalPending > 0 && (
                        <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs">
                            {totalPending} pending
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-1">
                {actions.map((action) => (
                    <Link key={action.label} href={action.href}>
                        <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${action.bg}`}>
                                    <action.icon className={`h-4 w-4 ${action.color}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{action.label}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-lg font-bold ${action.count > 0 ? action.color : "text-muted-foreground"}`}>
                                    {action.count}
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                    </Link>
                ))}
            </CardContent>
        </Card>
    );
}

/* ─── 5. Payroll Summary Card ───────────────────────────────── */

function PayrollSummaryCard() {
    const payslips = usePayrollStore((s) => s.payslips);
    const runs = usePayrollStore((s) => s.runs);
    const rh = useRoleHref();

    const latestRun = runs.length > 0
        ? runs.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0]
        : null;

    const totalGross = payslips.reduce((sum, p) => sum + (p.grossPay || 0), 0);
    const totalNet = payslips.reduce((sum, p) => sum + (p.netPay || 0), 0);
    const totalDeductions = totalGross - totalNet;

    const statusCounts = {
        draft: payslips.filter((p) => p.status === "draft").length,
        published: payslips.filter((p) => p.status === "published").length,
        signed: payslips.filter((p) => p.status === "signed").length,
    };

    return (
        <Card className="border border-border/50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-semibold">Payroll Summary</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {latestRun ? `Latest: ${latestRun.periodLabel}` : "No runs yet"}
                        </p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs gap-1" asChild>
                        <Link href={rh("/payroll")}>
                            Details <ChevronRight className="h-3 w-3" />
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Total Gross</p>
                        <p className="text-base font-bold mt-0.5">{formatCurrency(totalGross)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                        <p className="text-xs text-muted-foreground">Total Net</p>
                        <p className="text-base font-bold mt-0.5">{formatCurrency(totalNet)}</p>
                    </div>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground mb-2">Payslip Status</p>
                    <div className="space-y-2">
                        {([
                            { label: "Draft", count: statusCounts.draft, color: "bg-zinc-400" },
                            { label: "Published", count: statusCounts.published, color: "bg-amber-500" },
                            { label: "Signed", count: statusCounts.signed, color: "bg-emerald-500" },
                        ] as const).map((item) => (
                            <div key={item.label} className="flex items-center gap-2 text-xs">
                                <span className={`h-2 w-2 rounded-full ${item.color}`} />
                                <span className="text-muted-foreground flex-1">{item.label}</span>
                                <span className="font-medium">{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── 6. Recent Hires Card ──────────────────────────────────── */

function RecentHiresCard() {
    const employees = useEmployeesStore((s) => s.employees);
    const rh = useRoleHref();

    const recentHires = useMemo(() => {
        return [...employees]
            .filter((e) => e.status === "active" && e.joinDate)
            .sort((a, b) => (b.joinDate || "").localeCompare(a.joinDate || ""))
            .slice(0, 5);
    }, [employees]);

    return (
        <Card className="border border-border/50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-semibold">Recent Hires</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Newest team members</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs gap-1" asChild>
                        <Link href={rh("/employees/manage")}>
                            View All <ChevronRight className="h-3 w-3" />
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-1">
                {recentHires.map((emp) => (
                    <Link key={emp.id} href={rh(`/employees/${emp.id}`)}>
                        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                            <Avatar className="h-8 w-8">
                                {emp.avatarUrl && <AvatarImage src={emp.avatarUrl} alt={emp.name} />}
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                                    {getInitials(emp.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{emp.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{emp.department}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-xs text-muted-foreground">{formatDate(emp.joinDate)}</p>
                            </div>
                        </div>
                    </Link>
                ))}
                {recentHires.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No recent hires</p>
                )}
            </CardContent>
        </Card>
    );
}

/* ─── 7. Upcoming Events Card ───────────────────────────────── */

function UpcomingEventsCard() {
    const events = useEventsStore((s) => s.events);
    const rh = useRoleHref();

    const upcoming = useMemo(() => {
        const today = startOfDay(new Date());
        return [...events]
            .filter((ev) => {
                try { return isAfter(parseISO(ev.date), today) || isToday(parseISO(ev.date)); }
                catch { return false; }
            })
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 5);
    }, [events]);

    const typeColors: Record<string, string> = {
        meeting: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        event: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
        training: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        deadline: "bg-red-500/10 text-red-600 dark:text-red-400",
        holiday: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    };

    return (
        <Card className="border border-border/50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-semibold">Upcoming Events</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{upcoming.length} upcoming</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs gap-1" asChild>
                        <Link href={rh("/events")}>
                            View All <ChevronRight className="h-3 w-3" />
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-1">
                {upcoming.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex flex-col items-center justify-center bg-muted rounded-lg px-3 py-1.5 min-w-[52px]">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase">
                                {(() => { try { return format(parseISO(ev.date), "MMM"); } catch { return ""; } })()}
                            </span>
                            <span className="text-lg font-bold leading-none">
                                {(() => { try { return format(parseISO(ev.date), "dd"); } catch { return ""; } })()}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{ev.title}</p>
                            <p className="text-xs text-muted-foreground">{ev.time}</p>
                        </div>
                        {ev.type && (
                            <Badge variant="secondary" className={`text-[10px] px-2 ${typeColors[ev.type] || "bg-muted text-muted-foreground"}`}>
                                {ev.type}
                            </Badge>
                        )}
                    </div>
                ))}
                {upcoming.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No upcoming events</p>
                )}
            </CardContent>
        </Card>
    );
}

/* ─── 8. Birthdays Card ─────────────────────────────────────── */

function BirthdaysCard() {
    const employees = useEmployeesStore((s) => s.employees);

    const birthdaysThisMonth = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        return employees
            .filter((e) => {
                if (!e.birthday || e.status !== "active") return false;
                try {
                    const bd = parseISO(e.birthday);
                    return (bd.getMonth() + 1) === currentMonth;
                } catch { return false; }
            })
            .sort((a, b) => {
                try {
                    const da = parseISO(a.birthday!).getDate();
                    const db = parseISO(b.birthday!).getDate();
                    return da - db;
                } catch { return 0; }
            })
            .slice(0, 6);
    }, [employees]);

    const today = new Date().getDate();
    const currentMonth = new Date().getMonth() + 1;

    return (
        <Card className="border border-border/50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-semibold">Birthdays This Month</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(), "MMMM yyyy")} · {birthdaysThisMonth.length} celebrations
                        </p>
                    </div>
                    <div className="p-2 rounded-xl bg-pink-500/10">
                        <Cake className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {birthdaysThisMonth.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {birthdaysThisMonth.map((emp) => {
                            let bdDay = 0;
                            try { bdDay = parseISO(emp.birthday!).getDate(); } catch { /* */ }
                            const isToday_ = bdDay === today;
                            return (
                                <div
                                    key={emp.id}
                                    className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                                        isToday_ ? "bg-pink-500/5 ring-1 ring-pink-500/20" : "hover:bg-muted/50"
                                    }`}
                                >
                                    <Avatar className="h-8 w-8">
                                        {emp.avatarUrl && <AvatarImage src={emp.avatarUrl} alt={emp.name} />}
                                        <AvatarFallback className="text-[10px] bg-pink-500/10 text-pink-600 dark:text-pink-400 font-medium">
                                            {getInitials(emp.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{emp.name}</p>
                                        <p className="text-xs text-muted-foreground">{emp.department}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs font-medium">
                                            {(() => { try { return format(parseISO(emp.birthday!), "MMM d"); } catch { return ""; } })()}
                                        </p>
                                        {isToday_ && (
                                            <Badge className="text-[9px] px-1.5 bg-pink-500 text-white mt-0.5">Today!</Badge>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">No birthdays this month</p>
                )}
            </CardContent>
        </Card>
    );
}

/* ─── 9. Recent Activity (Audit) ────────────────────────────── */

function RecentActivityCard() {
    const auditLogs = useAuditStore((s) => s.logs);
    const employees = useEmployeesStore((s) => s.employees);
    const leaveRequests = useLeaveStore((s) => s.requests);
    const attendanceLogs = useAttendanceStore((s) => s.logs);
    const payslips = usePayrollStore((s) => s.payslips);
    const loans = useLoansStore((s) => s.loans);
    const rh = useRoleHref();

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    // Build a unified activity feed from multiple data sources
    const activityItems = useMemo(() => {
        type ActivityItem = { id: string; icon: React.ElementType; color: string; actor: string; action: string; detail: string; timestamp: string };
        const items: ActivityItem[] = [];

        // 1. Audit logs (if any exist)
        auditLogs.slice(0, 10).forEach((log) => {
            items.push({
                id: log.id,
                icon: Activity,
                color: "text-blue-600 dark:text-blue-400",
                actor: getEmpName(log.performedBy),
                action: log.action.replace(/_/g, " "),
                detail: `${log.entityType}`,
                timestamp: log.timestamp,
            });
        });

        // 2. Leave requests (always has seed data)
        leaveRequests.slice(0, 8).forEach((lr) => {
            const statusIcon = lr.status === "approved" ? UserCheck : lr.status === "rejected" ? UserX : Clock;
            const statusColor = lr.status === "approved" ? "text-emerald-600 dark:text-emerald-400" : lr.status === "rejected" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400";
            items.push({
                id: lr.id,
                icon: statusIcon,
                color: statusColor,
                actor: getEmpName(lr.employeeId),
                action: `leave request ${lr.status}`,
                detail: `${lr.type} · ${lr.startDate} to ${lr.endDate}`,
                timestamp: lr.reviewedAt || lr.startDate,
            });
        });

        // 3. Recent attendance (latest day's flagged or late entries)
        const lateLogs = attendanceLogs
            .filter((l) => l.status === "present" && (l.lateMinutes ?? 0) > 0)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5);
        lateLogs.forEach((l) => {
            items.push({
                id: l.id,
                icon: AlertCircle,
                color: "text-amber-600 dark:text-amber-400",
                actor: getEmpName(l.employeeId),
                action: `arrived ${l.lateMinutes}min late`,
                detail: `Checked in at ${l.checkIn || "—"}`,
                timestamp: l.date,
            });
        });

        // 4. Payslips published
        payslips.filter((p) => p.status === "published").slice(0, 4).forEach((p) => {
            items.push({
                id: p.id,
                icon: FileText,
                color: "text-blue-600 dark:text-blue-400",
                actor: getEmpName(p.employeeId),
                action: "payslip published",
                detail: `${p.periodStart} — ${p.periodEnd}`,
                timestamp: p.publishedAt || p.issuedAt,
            });
        });

        // 5. Active loans
        loans.filter((l) => l.status === "active").forEach((l) => {
            items.push({
                id: l.id,
                icon: Banknote,
                color: "text-emerald-600 dark:text-emerald-400",
                actor: getEmpName(l.employeeId),
                action: `${l.type.replace(/_/g, " ")} approved`,
                detail: `₱${l.amount.toLocaleString()} · ₱${l.remainingBalance.toLocaleString()} remaining`,
                timestamp: l.createdAt,
            });
        });

        // Sort by timestamp descending and take top 10
        return items
            .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""))
            .slice(0, 10);
    }, [auditLogs, leaveRequests, attendanceLogs, payslips, loans, employees]);

    return (
        <Card className="border border-border/50">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">Latest system actions across all modules</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs gap-1" asChild>
                        <Link href={rh("/audit-log")}>
                            View All <ChevronRight className="h-3 w-3" />
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                    {activityItems.map((item) => {
                        const ActionIcon = item.icon;
                        return (
                            <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="mt-0.5">
                                    <ActionIcon className={`h-4 w-4 ${item.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm">
                                        <span className="font-medium">{item.actor}</span>
                                        <span className="text-muted-foreground"> {item.action}</span>
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-muted-foreground truncate">{item.detail}</span>
                                        {item.timestamp && (
                                            <span className="text-xs text-muted-foreground shrink-0">
                                                {(() => {
                                                    try {
                                                        const d = parseISO(item.timestamp);
                                                        return item.timestamp.includes("T")
                                                            ? format(d, "MMM d, h:mm a")
                                                            : format(d, "MMM d, yyyy");
                                                    } catch { return ""; }
                                                })()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {activityItems.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
                )}
            </CardContent>
        </Card>
    );
}
