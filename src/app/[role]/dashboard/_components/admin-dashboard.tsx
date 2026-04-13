"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, FileText, CheckCircle, Clock, Users, CalendarDays, AlertCircle, DollarSign } from "lucide-react";
import { useEmployeesStore } from "@/store/employees.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useLeaveStore } from "@/store/leave.store";
import { usePayrollStore } from "@/store/payroll.store";

const COLORS = ["#E5E7EB", "#65B2B2"];

// Avatar placeholders for employees without profile images
const AVATAR_PLACEHOLDERS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80",
];

function getAvatarForEmployee(index: number): string {
  return AVATAR_PLACEHOLDERS[index % AVATAR_PLACEHOLDERS.length];
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AdminDashboardView() {
  // Real data from stores
  const employees = useEmployeesStore((s) => s.employees);
  const logs = useAttendanceStore((s) => s.logs);
  const leaveRequests = useLeaveStore((s) => s.requests);
  const payslips = usePayrollStore((s) => s.payslips);

  // Compute real metrics
  const metrics = useMemo(() => {
    const activeEmployees = employees.filter((e) => e.status === "active");
    const inactiveEmployees = employees.filter((e) => e.status === "inactive");
    const resignedEmployees = employees.filter((e) => e.status === "resigned");

    // Today's attendance
    const today = new Date().toISOString().split("T")[0];
    const todayLogs = logs.filter((l) => l.date === today);
    const presentToday = todayLogs.filter((l) => l.status === "present").length;
    const absentToday = todayLogs.filter((l) => l.status === "absent").length;
    const onLeaveToday = todayLogs.filter((l) => l.status === "on_leave").length;

    // Leave stats
    const pendingLeaves = leaveRequests.filter((l) => l.status === "pending");
    const approvedLeaves = leaveRequests.filter((l) => l.status === "approved");

    // Payroll stats
    const publishedPayslips = payslips.filter((p) => p.status === "published");
    const signedPayslips = payslips.filter((p) => p.status === "signed");

    // Department distribution
    const departments: Record<string, number> = {};
    activeEmployees.forEach((e) => {
      const dept = e.department || "Unassigned";
      departments[dept] = (departments[dept] || 0) + 1;
    });

    // Calculate attendance rate over last 5 months
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const attendanceByMonth: { name: string; present: number; absent: number }[] = [];
    
    for (let i = 4; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
      const monthLogs = logs.filter((l) => l.date.startsWith(monthKey));
      const present = monthLogs.filter((l) => l.status === "present").length;
      const absent = monthLogs.filter((l) => l.status === "absent" || l.status === "on_leave").length;
      attendanceByMonth.push({
        name: monthNames[targetDate.getMonth()],
        present,
        absent,
      });
    }

    // Leave utilization percentage
    const totalLeaveCredits = activeEmployees.length * 15; // Assume 15 days per employee
    const usedLeave = approvedLeaves.reduce((sum, l) => {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      return sum + Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
    }, 0);
    const leaveUtilization = totalLeaveCredits > 0 ? Math.round((usedLeave / totalLeaveCredits) * 100) : 0;

    return {
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
      inactiveEmployees: inactiveEmployees.length,
      resignedEmployees: resignedEmployees.length,
      presentToday,
      absentToday,
      onLeaveToday,
      pendingLeaves: pendingLeaves.length,
      approvedLeaves: approvedLeaves.length,
      publishedPayslips: publishedPayslips.length,
      signedPayslips: signedPayslips.length,
      departments,
      attendanceByMonth,
      leaveUtilization: Math.min(leaveUtilization, 100),
    };
  }, [employees, logs, leaveRequests, payslips]);

  // Performance chart data
  const performanceData = metrics.attendanceByMonth.map((m) => ({
    name: m.name,
    value1: m.present,
    value2: m.absent,
  }));

  // Leave utilization pie chart
  const miniChartData = [
    { name: "Remaining", value: 100 - metrics.leaveUtilization },
    { name: "Used", value: metrics.leaveUtilization },
  ];

  // Get recent employees (up to 5) for directory
  const recentEmployees = useMemo(() => {
    return employees
      .filter((e) => e.status === "active")
      .sort((a, b) => new Date(b.joinDate || "").getTime() - new Date(a.joinDate || "").getTime())
      .slice(0, 5)
      .map((emp, idx) => ({
        id: emp.id,
        name: emp.name,
        role: emp.role || emp.department || "Employee",
        status: emp.status,
        department: emp.department || "General",
        joinDate: emp.joinDate ? new Date(emp.joinDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "N/A",
        avatar: getAvatarForEmployee(idx),
      }));
  }, [employees]);

  // Generate widgets from real activity
  const widgets = useMemo(() => {
    const items: { id: number; icon: typeof FileText; title: string; time: string; color: string; bg: string }[] = [];

    // Pending leave requests
    const pendingLeaves = leaveRequests.filter((l) => l.status === "pending").slice(0, 2);
    pendingLeaves.forEach((leave, i) => {
      const emp = employees.find((e) => e.id === leave.employeeId);
      items.push({
        id: items.length + 1,
        icon: CalendarDays,
        title: `${emp?.name || "Employee"} requested ${leave.type} leave`,
        time: formatRelativeTime(leave.startDate),
        color: "text-orange-500",
        bg: "bg-orange-500/10",
      });
    });

    // Recent new employees
    const recentHires = employees
      .filter((e) => e.joinDate && new Date(e.joinDate) > new Date(Date.now() - 30 * 86400000))
      .slice(0, 1);
    recentHires.forEach((emp) => {
      items.push({
        id: items.length + 1,
        icon: Users,
        title: `${emp.name} joined the team`,
        time: formatRelativeTime(emp.joinDate || new Date().toISOString()),
        color: "text-[#65B2B2]",
        bg: "bg-[#65B2B2]/10",
      });
    });

    // Payslip activity
    const recentPayslips = payslips
      .filter((p) => p.status === "published")
      .slice(0, 1);
    recentPayslips.forEach((ps) => {
      items.push({
        id: items.length + 1,
        icon: DollarSign,
        title: `Payroll published (${new Date(ps.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(ps.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})`,  
        time: formatRelativeTime(ps.issuedAt || new Date().toISOString()),
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
      });
    });

    // Fill remaining slots with system metrics
    if (items.length < 4) {
      items.push({
        id: items.length + 1,
        icon: CheckCircle,
        title: `${metrics.activeEmployees} active employees`,
        time: "Current",
        color: "text-[#65B2B2]",
        bg: "bg-[#65B2B2]/10",
      });
    }

    if (items.length < 4) {
      items.push({
        id: items.length + 1,
        icon: AlertCircle,
        title: metrics.pendingLeaves > 0 ? `${metrics.pendingLeaves} leave requests pending` : "No pending approvals",
        time: "Today",
        color: metrics.pendingLeaves > 0 ? "text-amber-500" : "text-slate-400",
        bg: metrics.pendingLeaves > 0 ? "bg-amber-500/10" : "bg-slate-100",
      });
    }

    return items.slice(0, 4);
  }, [leaveRequests, employees, payslips, metrics]);

  return (
    <div className="flex flex-col gap-6 p-2 md:p-6 max-w-7xl mx-auto w-full">      
      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm rounded-2xl">
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
        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{metrics.presentToday || metrics.activeEmployees}</p>
              <p className="text-xs text-slate-500 font-medium">Present Today</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{metrics.pendingLeaves}</p>
              <p className="text-xs text-slate-500 font-medium">Pending Leaves</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{metrics.publishedPayslips}</p>
              <p className="text-xs text-slate-500 font-medium">Payslips Published</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 
        TOP ROW 
      */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Attendance Overview (Performance charts) */}
        <Card className="col-span-1 md:col-span-5 border-none shadow-sm drop-shadow-sm rounded-[24px]">
          <CardHeader className="pb-2 pt-6 px-6">
            <CardTitle className="text-[17px] font-bold text-slate-800 dark:text-slate-100">Attendance Overview</CardTitle>
            <p className="text-xs text-slate-400 mt-1">Present vs Absent/Leave (Last 5 months)</p>
          </CardHeader>
          <CardContent className="h-[240px] px-2 pb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: "#9ca3af", fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: "#9ca3af", fontWeight: 500 }} dx={-10} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  formatter={(value, name) => [value, name === "value1" ? "Present" : "Absent/Leave"]}
                />
                <Bar dataKey="value1" name="Present" fill="#65B2B2" radius={[6, 6, 6, 6]} barSize={14} />
                <Bar dataKey="value2" name="Absent" fill="#E2E8F0" radius={[6, 6, 6, 6]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leave Utilization (Miniature charts) */}
        <Card className="col-span-1 md:col-span-4 border-none shadow-sm drop-shadow-sm rounded-[24px] overflow-hidden flex flex-col">
          <CardHeader className="pb-0 pt-6 px-6">
            <CardTitle className="text-[17px] font-bold z-10 relative text-slate-800 dark:text-slate-100">Leave Utilization</CardTitle>
            <p className="text-xs text-slate-400 mt-1">Company-wide leave balance</p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center p-0 relative pb-6 px-6">
            <div className="h-[150px] w-full flex items-center justify-center relative mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={miniChartData}
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
                    {miniChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-800 dark:text-white">{metrics.leaveUtilization}%</span>
              </div>
            </div>
            
            <div className="flex gap-4 text-xs font-semibold text-slate-400 mt-5 w-full justify-center">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#65B2B2]"></span> Used ({metrics.leaveUtilization}%)</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB]"></span> Available</div>
            </div>
          </CardContent>
        </Card>

        {/* Team CTA Card */}
        <Card className="col-span-1 md:col-span-3 border-none shadow-sm drop-shadow-sm rounded-[24px] overflow-hidden relative min-h-[220px]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#65B2B2] to-[#458e8e] opacity-95" />
          <CardContent className="relative z-10 h-full flex flex-col items-center justify-center text-white text-center p-6 gap-5">
            <div className="flex -space-x-3 mb-2">
              {recentEmployees.slice(0, 3).map((emp, i) => (
                <div key={emp.id} className="w-12 h-12 rounded-full border-2 border-white/30 overflow-hidden shadow-sm">
                  <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <p className="text-[15px] font-semibold leading-snug px-1">{metrics.totalEmployees} team members across {Object.keys(metrics.departments).length} departments</p>
            </div>
            <Button className="bg-[#111827] hover:bg-black text-white w-full rounded-2xl py-6 text-sm font-semibold mt-3 shadow-lg shadow-black/10 transition-colors">
              View All Employees ›
            </Button>
          </CardContent>
        </Card>

      </div>

      {/* 
        BOTTOM ROW 
      */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Employee Directory */}
        <Card className="col-span-1 md:col-span-8 lg:col-span-8 xl:col-span-9 border-none shadow-sm drop-shadow-sm rounded-[24px]">
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
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 rounded-[12px] pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#65B2B2]/50 transition-shadow" 
                />
                <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
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
                    <th className="px-6 py-3.5 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {recentEmployees.map((emp) => (
                    <tr key={emp.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group">
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
                      <td className="px-6 py-3.5 text-right text-slate-300 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
                        <MoreHorizontal className="w-5 h-5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Activity Feed (Your widgets) */}
        <Card className="col-span-1 md:col-span-4 lg:col-span-4 xl:col-span-3 border-none shadow-sm drop-shadow-sm rounded-[24px] flex flex-col">
          <CardHeader className="pb-5 pt-6 px-6">
            <CardTitle className="text-[17px] font-bold text-slate-800 dark:text-slate-100">Activity Feed</CardTitle>
            <p className="text-xs text-slate-400 mt-1">Recent system activity</p>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col px-6 pb-6 gap-6">
            <div className="space-y-6 flex-1">
              {widgets.map((w) => (
                <div key={w.id} className="flex gap-4">
                  <div className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${w.bg} ${w.color}`}>
                    <w.icon className="w-[18px] h-[18px] stroke-[2.5px]" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 leading-tight">{w.title}</span>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1">{w.time}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-4">
              <Button variant="outline" className="w-full rounded-2xl border-[#65B2B2] text-[#65B2B2] hover:bg-[#65B2B2] hover:text-white text-[13px] font-bold shadow-sm transition-all duration-300 py-5">
                View All Activity
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
