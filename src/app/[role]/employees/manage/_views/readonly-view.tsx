"use client";

import { useState, useMemo } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useProjectsStore } from "@/store/projects.store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Mail, MapPin, Phone } from "lucide-react";
import { getInitials } from "@/lib/format";
import { useDepartmentsStore } from "@/store/departments.store";
import Link from "next/link";
import { useRoleHref } from "@/lib/hooks/use-role-href";

/* ═══════════════════════════════════════════════════════════════
   READONLY VIEW — Employee Directory (Supervisor / Auditor)
   Browse-only card grid, no salary, no CRUD
   ═══════════════════════════════════════════════════════════════ */

export default function ReadonlyEmployeesView() {
    const employees = useEmployeesStore((s) => s.employees);
    const { getProjectForEmployee } = useProjectsStore();
    const rh = useRoleHref();
    const departments = useDepartmentsStore((s) => s.departments);
    const [search, setSearch] = useState("");
    const [dept, setDept] = useState("all");
    const [status, setStatus] = useState("all");

    const filtered = useMemo(() => employees.filter((e) => {
        const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase());
        const matchDept = dept === "all" || e.department === dept;
        const matchStatus = status === "all" || e.status === status;
        return matchSearch && matchDept && matchStatus;
    }), [employees, search, dept, status]);

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Employee Directory</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} employees</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search employees..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={dept} onValueChange={setDept}>
                    <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.filter((d) => d.isActive).map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-full sm:w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((emp) => {
                    const project = getProjectForEmployee(emp.id);
                    return (
                        <Link key={emp.id} href={rh(`/employees/${emp.id}`)}>
                            <Card className="border border-border/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-3">
                                        <Avatar className="h-12 w-12">
                                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">{getInitials(emp.name)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{emp.name}</h3>
                                                <Badge variant="secondary" className={`text-[9px] shrink-0 ${emp.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-700 dark:text-red-400"}`}>{emp.status}</Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">{emp.role}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{emp.email}</span></div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /><span>{emp.location}</span></div>
                                        {emp.phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5 shrink-0" /><span>{emp.phone}</span></div>}
                                        {project && (
                                            <div className="pt-1 border-t border-border/40 mt-2">
                                                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">{project.name}</Badge>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">No employees match your search criteria</p>
                </div>
            )}
        </div>
    );
}
