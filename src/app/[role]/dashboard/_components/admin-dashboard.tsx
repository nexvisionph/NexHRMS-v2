"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreHorizontal, FileText, CheckCircle, Clock } from "lucide-react";

// Explicit Mock Data
const performanceData = [
  { name: "Feb", value1: 30, value2: 45 },
  { name: "Mar", value1: 40, value2: 30 },
  { name: "Apr", value1: 55, value2: 35 },
  { name: "May", value1: 45, value2: 60 },
  { name: "Jun", value1: 50, value2: 45 }
];

const miniChartData = [
  { name: "Remaining", value: 93 },
  { name: "Completed", value: 7 }
];

const COLORS = ["#E5E7EB", "#65B2B2"];

const employees = [
  { id: 1, name: "Aurora Mclroy", role: "Backend", status: "Authorized", date: "15 Sep 2021", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80" },
  { id: 2, name: "Jason Holder", role: "Designer", status: "Authorized", date: "16 Sep 2021", avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=150&q=80" },
  { id: 3, name: "Monica Mclroy", role: "Frontend", status: "Authorized", date: "18 Sep 2021", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80" },
  { id: 4, name: "Susan Bates", role: "Backend", status: "Authorized", date: "20 Sep 2021", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80" },
  { id: 5, name: "Jason Holder", role: "Designer", status: "Authorized", date: "22 Sep 2021", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80" }
];

const widgets = [
  { id: 1, icon: FileText, title: "Development process...", time: "2 hours ago", color: "text-[#65B2B2]", bg: "bg-[#65B2B2]/10" },
  { id: 2, icon: CheckCircle, title: "Administrator task...", time: "5 hours ago", color: "text-rose-500", bg: "bg-rose-500/10" },
  { id: 3, icon: Clock, title: "Administrator access approval...", time: "1 day ago", color: "text-orange-500", bg: "bg-orange-500/10" },
  { id: 4, icon: FileText, title: "Administrator task...", time: "1 day ago", color: "text-amber-500", bg: "bg-amber-500/10" }
];

export function AdminDashboardView() {
  return (
    <div className="flex flex-col gap-6 p-2 md:p-6 max-w-7xl mx-auto w-full">      
      {/* 
        TOP ROW 
      */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Performance charts */}
        <Card className="col-span-1 md:col-span-5 border-none shadow-sm drop-shadow-sm rounded-[24px]">
          <CardHeader className="pb-2 pt-6 px-6">
            <CardTitle className="text-[17px] font-bold text-slate-800 dark:text-slate-100">Performance charts</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px] px-2 pb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: "#9ca3af", fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: "#9ca3af", fontWeight: 500 }} dx={-10} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                />
                <Bar dataKey="value1" fill="#65B2B2" radius={[6, 6, 6, 6]} barSize={14} />
                <Bar dataKey="value2" fill="#E2E8F0" radius={[6, 6, 6, 6]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Miniature charts */}
        <Card className="col-span-1 md:col-span-4 border-none shadow-sm drop-shadow-sm rounded-[24px] overflow-hidden flex flex-col">
          <CardHeader className="pb-0 pt-6 px-6">
            <CardTitle className="text-[17px] font-bold z-10 relative text-slate-800 dark:text-slate-100">Miniature charts</CardTitle>
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
                <span className="text-2xl font-bold text-slate-800 dark:text-white">7%</span>
              </div>
            </div>
            
            <div className="flex gap-4 text-xs font-semibold text-slate-400 mt-5 w-full justify-center">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#65B2B2]"></span> Summary</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#E5E7EB]"></span> Statistics</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span> Progress</div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Card */}
        <Card className="col-span-1 md:col-span-3 border-none shadow-sm drop-shadow-sm rounded-[24px] overflow-hidden relative min-h-[220px]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#65B2B2] to-[#458e8e] opacity-95" />
          <CardContent className="relative z-10 h-full flex flex-col items-center justify-center text-white text-center p-6 gap-5">
            <div className="flex -space-x-3 mb-2">
              {[
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80",
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
              ].map((src, i) => (
                <div key={i} className="w-12 h-12 rounded-full border-2 border-[#65B2B2] overflow-hidden shadow-sm">
                  <img src={src} alt="Avatar" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <p className="text-[15px] font-semibold leading-snug px-1">See what is available for members...</p>
            </div>
            <Button className="bg-[#111827] hover:bg-black text-white w-full rounded-2xl py-6 text-sm font-semibold mt-3 shadow-lg shadow-black/10 transition-colors">
              Start Now ›
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
            <CardTitle className="text-[17px] font-bold text-slate-800 dark:text-slate-100">Employee Directory</CardTitle>
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
                    <th className="px-6 py-3.5 font-semibold">Role</th>
                    <th className="px-6 py-3.5 font-semibold">Status</th>
                    <th className="px-6 py-3.5 font-semibold">End date</th>
                    <th className="px-6 py-3.5 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group">
                      <td className="px-6 py-3.5 flex items-center gap-3">
                        <Avatar className="h-[34px] w-[34px]">
                          <AvatarImage src={emp.avatar} />
                          <AvatarFallback className="bg-slate-100 text-slate-600 font-semibold">{emp.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{emp.name}</span>
                          <span className="text-[11px] font-medium text-slate-400 mt-0.5">NexHRMS Employee</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 font-semibold">{emp.role}</td>
                      <td className="px-6 py-3.5">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#65B2B2]/10 text-[#65B2B2] text-[11px] font-bold rounded-lg tracking-wide uppercase">
                          <CheckCircle className="w-3.5 h-3.5" />
                          {emp.status}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 dark:text-slate-400 font-semibold">{emp.date}</td>
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

        {/* Your widgets */}
        <Card className="col-span-1 md:col-span-4 lg:col-span-4 xl:col-span-3 border-none shadow-sm drop-shadow-sm rounded-[24px] flex flex-col">
          <CardHeader className="pb-5 pt-6 px-6">
            <CardTitle className="text-[17px] font-bold text-slate-800 dark:text-slate-100">Your widgets</CardTitle>
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
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
