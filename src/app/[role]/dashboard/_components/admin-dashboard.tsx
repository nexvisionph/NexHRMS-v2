"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CheckCircle, Clock, Users, CalendarDays,
  AlertCircle, DollarSign, ArrowRight, Eye
} from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useLeaveStore } from "@/store/leave.store";
import { usePayrollStore } from "@/store/payroll.store";

const COLORS = ["#E5E7EB", "#65B2B2"];

const AVATAR_PLACEHOLDERS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80",
];

function getAvatar(index: number): string {
  return AVATAR_PLACEHOLDERS[index % AVATAR_PLACEHOLDERS.length];
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AdminDashboardView() {
  const router = useRouter();
  const role = useAuthStore((s) => s.currentUser.role);
  const currentUserName = useAuthStore((s) => s.currentUser.name);
  const employees = useEmployeesStore((s) => s.employees);
  const logs = useAttendanceStore((s) => s.logs);
  const leaveRequests = useLeaveStore((s) => s.requests);
  const payslips = usePayrollStore((s) => s.payslips);

  const [empSearch, setEmpSearch] = useState("");

  const rolePrefix = `/${role}`;
  const nav = (path: string) => router.push(`${rolePrefix}${path}`);

  // ── Computed Metrics ──
  const metrics = useMemo(() => {
    const active = employees.filter((e) => e.status === "active");
    const today = new Date().toISOString().split("T")[0];
    const todayLogs = logs.filter((l) => l.date === today);
    const presentToday = todayLogs.filter((l) => l.status === "present").length;
    const absentToday = todayLogs.filter((l) => l.status === "absent").length;
    const onLeaveToday = todayLogs.filter((l) => l.status === "on_leave").length;

    const pendingLeaves = leaveRequests.filter((l) => l.status === "pending").length;
    const approvedLeaves = leaveRequests.filter((l) => l.status === "approved");
    const publishedPayslips = payslips.filter((p) => p.status === "published").length;
    const draftPayslips = payslips.filter((p) => p.status === "draft").length;

    const departments: Record<string, number> = {};
    active.forEach((e) => {
      const dept = e.department || "Unassigned";
      departments[dept] = (departments[dept] || 0) + 1;
    });

    // 5-month attendance trend
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const attendanceByMonth: { name: string; present: number; absent: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mLogs = logs.filter((l) => l.date.startsWith(key));
      attendanceByMonth.push({
        name: monthNames[d.getMonth()],
        present: mLogs.filter((l) => l.status === "present").length,
        absent: mLogs.filter((l) => l.status === "absent" || l.status === "on_leave").length,
      });
    }

    // Leave utilization: 15 credits per active employee per year
    const totalCredits = active.length * 15;
    const usedDays = approvedLeaves.reduce((sum, l) => {
      const s = new Date(l.startDate);
      const e = new Date(l.endDate);
      return sum + Math.max(Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1, 1);
    }, 0);
    const leaveUtil = totalCredits > 0 ? Math.min(Math.round((usedDays / totalCredits) * 100), 100) : 0;

    // Total payroll cost this month
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthPayslips = payslips.filter(
      (p) => p.periodStart?.startsWith(currentMonth) || p.periodEnd?.startsWith(currentMonth)
    );
    const totalPayroll = monthPayslips.reduce((sum, p) => sum + (p.netPay || 0), 0);

    return {
      totalEmployees: employees.length,
      activeEmployees: active.length,
      presentToday,
      absentToday,
      onLeaveToday,
      pendingLeaves,
      publishedPayslips,
      draftPayslips,
      departments,
      deptCount: Object.keys(departments).length,
      attendanceByMonth,
      leaveUtil,
      totalPayroll,
    };
  }, [employees, logs, leaveRequests, payslips]);

  // ── Chart data ──
  const barData = metrics.attendanceByMonth.map((m) => ({
    name: m.name,
    present: m.present,
    absent: m.absent,
  }));
  const hasBarData = barData.some((d) => d.present > 0 || d.absent > 0);

  const pieData = [
    { name: "Available", value: 100 - metrics.leaveUtil },
    { name: "Used", value: metrics.leaveUtil },
  ];

  // ── Recent employees (filtered by search) ──
  const recentEmployees = useMemo(() => {
    const q = empSearch.toLowerCase();
    return employees
      .filter((e) => e.status === "active")
      .filter((e) => !q || e.name.toLowerCase().includes(q) || (e.department || "").toLowerCase().includes(q))
      .sort((a, b) => new Date(b.joinDate || "").getTime() - new Date(a.joinDate || "").getTime())
      .slice(0, 5)
      .map((emp, idx) => ({
        id: emp.id,
        name: emp.name,
        role: emp.role || emp.department || "Employee",
        department: emp.department || "General",
        status: emp.status,
        joinDate: emp.joinDate
          ? new Date(emp.joinDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
          : "N/A",
        avatar: getAvatar(idx),
      }));
  }, [employees, empSearch]);

  // ── Activity feed ──
  const activityItems = useMemo(() => {
    type ActivityItem = { id: string; icon: React.ElementType; title: string; time: string; color: string; bg: string; href: string };
    const items: ActivityItem[] = [];

    // Pending leave requests
    leaveRequests
      .filter((l) => l.status === "pending")
      .slice(0, 2)
      .forEach((leave) => {
        const emp = employees.find((e) => e.id === leave.employeeId);
        items.push({
          id: `leave-${leave.id}`,
          icon: CalendarDays,
          title: `${emp?.name || "Employee"} requested ${leave.type.replace("_", " ")} leave`,
          time: formatRelative(leave.startDate),
          color: "text-orange-500",
          bg: "bg-orange-500/10",
          href: "/leave",
        });
      });

    // Recent hires (joined in last 60 days)
    employees
      .filter((e) => e.joinDate && new Date(e.joinDate) > new Date(Date.now() - 60 * 86400000))
      .sort((a, b) => new Date(b.joinDate!).getTime() - new Date(a.joinDate!).getTime())
      .slice(0, 1)
      .forEach((emp) => {
        items.push({
          id: `hire-${emp.id}`,
          icon: Users,
          title: `${emp.name} joined the team`,
          time: formatRelative(emp.joinDate!),
          color: "text-[#65B2B2]",
          bg: "bg-[#65B2B2]/10",
          href: "/employees/manage",
        });
      });

    // Published payslips
    payslips
      .filter((p) => p.status === "published")
      .sort((a, b) => new Date(b.issuedAt || "").getTime() - new Date(a.issuedAt || "").getTime())
      .slice(0, 1)
      .forEach((ps) => {
        const periodLabel = ps.periodStart && ps.periodEnd
          ? `${new Date(ps.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(ps.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : "current period";
        items.push({
          id: `payslip-${ps.id}`,
          icon: DollarSign,
          title: `Payroll published (${periodLabel})`,
          time: formatRelative(ps.issuedAt || new Date().toISOString()),
          color: "text-emerald-500",
          bg: "bg-emerald-500/10",
          href: "/payroll",
        });
      });

    if (items.length < 4) {
      items.push({
        id: "metric-active",
        icon: CheckCircle,
        title: `${metrics.activeEmployees} active employees on roster`,
        time: "Current",
        color: "text-[#65B2B2]",
        bg: "bg-[#65B2B2]/10",
        href: "/employees/manage",
      });
    }

    if (items.length < 4) {
      items.push({
        id: "metric-leaves",
        icon: AlertCircle,
        title: metrics.pendingLeaves > 0 ? `${metrics.pendingLeaves} leave requests pending approval` : "All leave requests processed",
        time: "Today",
        color: metrics.pendingLeaves > 0 ? "text-amber-500" : "text-slate-400",
        bg: metrics.pendingLeaves > 0 ? "bg-amber-500/10" : "bg-slate-100",
        href: "/leave",
      });
    }

    return items.slice(0, 4);
  }, [leaveRequests, employees, payslips, metrics]);

  const fmtCurrency = (n: number) =>
    n > 0 ? `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "₱0";

  return (
    <div className="flex flex-col gap-6 p-2 md:p-6 max-w-7xl mx-auto w-full">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">
          Welcome back, {currentUserName.split(" ")[0]}!
        </h1>
        <p className="text-sm text-slate-500 mt-1">Here&apos;s your HR overview for today.</p>
      </div>

      {/* ── Quick Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="border-none shadow-sm rounded-2xl cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => nav("/employees/manage")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#65B2B2]/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#65B2B2]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{metrics.activeEmployees}</p>
              <p className="text-xs text-slate-500 font-medium">Active Employees</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="border-none shadow-sm rounded-2xl cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => nav("/attendance")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{metrics.presentToday}</p>
              <p className="text-xs text-slate-500 font-medium">Present Today</p>
            </div>
            {metrics.absentToday > 0 && (
              <span className="ml-auto text-[10px] font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5">{metrics.absentToday} absent</span>
            )}
          </CardContent>
        </Card>

        <Card
          className="border-none shadow-sm rounded-2xl cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => nav("/leave")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{metrics.pendingLeaves}</p>
              <p className="text-xs text-slate-500 font-medium">Pending Leaves</p>
            </div>
            {metrics.pendingLeaves > 0 && (
              <span className="ml-auto w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
            )}
          </CardContent>
        </Card>

        <Card
          className="border-none shadow-sm rounded-2xl cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => nav("/payroll")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{metrics.publishedPayslips}</p>
              <p className="text-xs text-slate-500 font-medium">Payslips Published</p>
            </div>
            {metrics.draftPayslips > 0 && (
              <span className="ml-auto text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{metrics.draftPayslips} draft</span>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Attendance Overview */}
        <Card
          className="col-span-1 md:col-span-5 border-none shadow-sm rounded-[24px] cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => nav("/attendance")}
        >
          <CardHeader className="pb-2 pt-6 px-6 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-[17px] font-bold text-slate-800 dark:text-slate-100">Attendance Overview</CardTitle>
              <p className="text-xs text-slate-400 mt-1">Present vs Absent/Leave (Last 5 months)</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300" />
          </CardHeader>
          <CardContent className="h-[240px] px-2 pb-6">
            {hasBarData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: "#9ca3af", fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: "#9ca3af", fontWeight: 500 }} dx={-10} />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    formatter={(value, name) => [value, name === "present" ? "Present" : "Absent/Leave"]}
                  />
                  <Bar dataKey="present" name="Present" fill="#65B2B2" radius={[6, 6, 6, 6]} barSize={14} />
                  <Bar dataKey="absent" name="Absent" fill="#E2E8F0" radius={[6, 6, 6, 6]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <Clock className="w-10 h-10 text-slate-300" />
                <p className="text-sm font-medium">No attendance data yet</p>
                <p className="text-xs">Attendance logs will appear here once employees clock in.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave Utilization */}
        <Card
          className="col-span-1 md:col-span-4 border-none shadow-sm rounded-[24px] overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => nav("/leave")}
        >
          <CardHeader className="pb-0 pt-6 px-6 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-[17px] font-bold text-slate-800 dark:text-slate-100">Leave Utilization</CardTitle>
              <p className="text-xs text-slate-400 mt-1">Company-wide leave balance</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-0 relative pb-6 px-6">
            <div className="h-[150px] w-full flex items-center justify-center relative mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={68}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={8}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-800 dark:text-white">{metrics.leaveUtil}%</span>
              </div>
            </div>
            <div className="flex gap-4 text-xs font-semibold text-slate-400 mt-5 w-full justify-center">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#65B2B2]" /> Used ({metrics.leaveUtil}%)</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB]" /> Available</div>
            </div>
          </CardContent>
        </Card>

        {/* Team CTA Card */}
        <Card className="col-span-1 md:col-span-3 border-none shadow-sm rounded-[24px] overflow-hidden relative min-h-[220px]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#65B2B2] to-[#458e8e] opacity-95" />
          <CardContent className="relative z-10 h-full flex flex-col items-center justify-center text-white text-center p-6 gap-4">
            <div className="flex -space-x-3">
              {recentEmployees.slice(0, 3).map((emp) => (
                <div key={emp.id} className="w-12 h-12 rounded-full border-2 border-white/30 overflow-hidden shadow-sm">
                  <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                </div>
              ))}
              {recentEmployees.length === 0 && (
                <div className="w-12 h-12 rounded-full border-2 border-white/30 bg-white/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <p className="text-[15px] font-semibold leading-snug px-1">
                {metrics.totalEmployees} team member{metrics.totalEmployees !== 1 ? "s" : ""} across {metrics.deptCount} department{metrics.deptCount !== 1 ? "s" : ""}
              </p>
              {metrics.totalPayroll > 0 && (
                <p className="text-xs text-white/70 font-medium">Monthly payroll: {fmtCurrency(metrics.totalPayroll)}</p>
              )}
            </div>
            <Button
              onClick={() => nav("/employees/manage")}
              className="bg-[#111827] hover:bg-black text-white w-full rounded-2xl py-6 text-sm font-semibold mt-2 shadow-lg shadow-black/10 transition-colors"
            >
              View All Employees ›
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Employee Directory */}
        <Card className="col-span-1 md:col-span-8 lg:col-span-8 xl:col-span-9 border-none shadow-sm rounded-[24px]">
          <CardHeader className="flex flex-row items-center justify-between pb-4 pt-6 px-6 border-b border-slate-100 dark:border-slate-800/50">
            <div>
              <CardTitle className="text-[17px] font-bold text-slate-800 dark:text-slate-100">Recent Employees</CardTitle>
              <p className="text-xs text-slate-400 mt-1">Latest team members</p>
            </div>
            <div className="flex items-center gap-2 w-1/3 min-w-[200px]">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Search..."
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-[12px] pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#65B2B2]/50 transition-shadow"
                />
                <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 font-semibold text-slate-400 text-left bg-slate-50/30 dark:bg-slate-900/30">
                    <th className="px-6 py-3.5 font-semibold">Name</th>
                    <th className="px-6 py-3.5 font-semibold">Department</th>
                    <th className="px-6 py-3.5 font-semibold">Status</th>
                    <th className="px-6 py-3.5 font-semibold">Join Date</th>
                    <th className="px-6 py-3.5 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEmployees.length > 0 ? (
                    recentEmployees.map((emp) => (
                      <tr
                        key={emp.id}
                        className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group cursor-pointer"
                        onClick={() => nav("/employees/manage")}
                      >
                        <td className="px-6 py-3.5 flex items-center gap-3">
                          <Avatar className="h-[34px] w-[34px]">
                            <AvatarImage src={emp.avatar} />
                            <AvatarFallback className="bg-slate-100 text-slate-600 font-semibold">{emp.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{emp.name}</span>
                            <span className="text-[11px] font-medium text-slate-400 mt-0.5">{emp.role}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 font-semibold">{emp.department}</td>
                        <td className="px-6 py-3.5">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg tracking-wide uppercase ${
                            emp.status === "active"
                              ? "bg-[#65B2B2]/10 text-[#65B2B2]"
                              : emp.status === "inactive"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-slate-100 text-slate-500"
                          }`}>
                            <CheckCircle className="w-3.5 h-3.5" />
                            {emp.status}
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 font-semibold">{emp.joinDate}</td>
                        <td className="px-6 py-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[#65B2B2] hover:text-[#65B2B2] hover:bg-[#65B2B2]/10"
                            onClick={(e) => { e.stopPropagation(); nav("/employees/manage"); }}
                          >
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-medium">No employees found</p>
                        <p className="text-xs mt-1">{empSearch ? "Try a different search term." : "Add employees to get started."}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {recentEmployees.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800/50">
                <Button
                  variant="ghost"
                  className="text-[#65B2B2] hover:text-[#65B2B2] hover:bg-[#65B2B2]/10 text-xs font-semibold"
                  onClick={() => nav("/employees/manage")}
                >
                  View all {metrics.activeEmployees} employees <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="col-span-1 md:col-span-4 lg:col-span-4 xl:col-span-3 border-none shadow-sm rounded-[24px] flex flex-col">
          <CardHeader className="pb-5 pt-6 px-6">
            <CardTitle className="text-[17px] font-bold text-slate-800 dark:text-slate-100">Activity Feed</CardTitle>
            <p className="text-xs text-slate-400 mt-1">Recent system activity</p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col px-6 pb-6 gap-6">
            <div className="space-y-5 flex-1">
              {activityItems.map((w) => (
                <div
                  key={w.id}
                  className="flex gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 rounded-xl p-2 -mx-2 transition-colors"
                  onClick={() => nav(w.href)}
                >
                  <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${w.bg} ${w.color}`}>
                    <w.icon className="w-[18px] h-[18px] stroke-[2.5px]" />
                  </div>
                  <div className="flex flex-col justify-center min-w-0">
                    <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 leading-tight truncate">{w.title}</span>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1">{w.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-4">
              <Button
                variant="outline"
                className="w-full rounded-2xl border-[#65B2B2] text-[#65B2B2] hover:bg-[#65B2B2] hover:text-white text-[13px] font-bold shadow-sm transition-all duration-300 py-5"
                onClick={() => nav("/notifications")}
              >
                View All Activity
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
