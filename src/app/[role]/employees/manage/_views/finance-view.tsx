"use client";

import { useState, useMemo } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Mail, MapPin, Phone, Cake, DollarSign, Pencil } from "lucide-react";
import { getInitials, formatCurrency } from "@/lib/format";
import { DEPARTMENTS } from "@/lib/constants";
import Link from "next/link";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { toast } from "sonner";
import { useAuditStore } from "@/store/audit.store";

/* ═══════════════════════════════════════════════════════════════
   FINANCE VIEW — Employee Directory with Salary Management
   View salaries, set salaries directly, approve HR proposals
   ═══════════════════════════════════════════════════════════════ */

export default function FinanceEmployeesView() {
    const { employees, updateEmployee, salaryRequests, approveSalaryChange, rejectSalaryChange } = useEmployeesStore();
    const currentUser = useAuthStore((s) => s.currentUser);
    const rh = useRoleHref();

    const [search, setSearch] = useState("");
    const [dept, setDept] = useState("all");
    const [status, setStatus] = useState("all");

    // Salary dialog
    const [salaryDialogEmpId, setSalaryDialogEmpId] = useState<string | null>(null);
    const [salaryInput, setSalaryInput] = useState("");

    const salaryDialogEmp = salaryDialogEmpId ? employees.find((e) => e.id === salaryDialogEmpId) : null;

    const filtered = useMemo(() => employees.filter((e) => {
        const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase());
        const matchDept = dept === "all" || e.department === dept;
        const matchStatus = status === "all" || e.status === status;
        return matchSearch && matchDept && matchStatus;
    }), [employees, search, dept, status]);

    const openSalaryDialog = (e: React.MouseEvent, empId: string, currentSalary: number) => {
        e.preventDefault(); e.stopPropagation();
        setSalaryDialogEmpId(empId); setSalaryInput(String(currentSalary));
    };

    const handleSalarySave = () => {
        if (!salaryDialogEmpId) return;
        const val = Number(salaryInput);
        if (!val || val <= 0) { toast.error("Please enter a valid monthly salary."); return; }
        updateEmployee(salaryDialogEmpId, { salary: val });
        useAuditStore.getState().log({ entityType: "employee", entityId: salaryDialogEmpId, action: "salary_approved", performedBy: currentUser.id, afterSnapshot: { salary: val } });
        toast.success(`Salary updated for ${salaryDialogEmp?.name ?? "employee"}`);
        setSalaryDialogEmpId(null); setSalaryInput("");
    };

    const pendingProposals = salaryRequests.filter((r) => r.status === "pending");

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Employee Directory &amp; Salary</h1>
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
                    <SelectContent><SelectItem value="all">All Departments</SelectItem>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-full sm:w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                </Select>
            </div>

            {/* Pending Salary Proposals */}
            {pendingProposals.length > 0 && (
                <Card className="border border-amber-500/30 bg-amber-500/5">
                    <CardContent className="p-4 space-y-3">
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Pending Salary Proposals</p>
                        {pendingProposals.map((req) => {
                            const emp = employees.find((e) => e.id === req.employeeId);
                            return (
                                <div key={req.id} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium">{emp?.name ?? req.employeeId}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatCurrency(req.oldSalary)} → <span className="font-semibold text-foreground">{formatCurrency(req.proposedSalary)}</span>
                                        </p>
                                        {req.reason && <p className="text-xs text-muted-foreground italic">{req.reason}</p>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => { approveSalaryChange(req.id, currentUser.id); useAuditStore.getState().log({ entityType: "employee", entityId: req.employeeId, action: "salary_approved", performedBy: currentUser.id }); toast.success(`Salary approved for ${emp?.name}`); }}>Approve</Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => { rejectSalaryChange(req.id, currentUser.id); useAuditStore.getState().log({ entityType: "employee", entityId: req.employeeId, action: "salary_rejected", performedBy: currentUser.id }); toast.info("Proposal rejected"); }}>Reject</Button>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((emp) => (
                    <div key={emp.id} className="relative">
                        <Link href={rh(`/employees/${emp.id}`)}>
                            <Card className="border border-border/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-3">
                                        <Avatar className="h-12 w-12"><AvatarFallback className="bg-primary/10 text-primary font-semibold">{getInitials(emp.name)}</AvatarFallback></Avatar>
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
                                        {emp.birthday && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Cake className="h-3.5 w-3.5 shrink-0" /><span>{new Date(emp.birthday).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>}
                                        <div className="flex items-center justify-between pt-1 border-t border-border/40 mt-2">
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <DollarSign className="h-3.5 w-3.5 shrink-0" />
                                                <span className="font-mono font-medium text-foreground">{formatCurrency(emp.salary)}<span className="text-muted-foreground font-normal">/mo</span></span>
                                            </div>
                                            <button onClick={(e) => openSalaryDialog(e, emp.id, emp.salary)} className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                                                <Pencil className="h-2.5 w-2.5" /> Set
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    </div>
                ))}
            </div>

            {/* Salary Dialog */}
            <Dialog open={!!salaryDialogEmpId} onOpenChange={(o) => { if (!o) { setSalaryDialogEmpId(null); setSalaryInput(""); } }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Set Monthly Salary</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-muted-foreground">Employee: <span className="font-medium text-foreground">{salaryDialogEmp?.name}</span></p>
                        <div>
                            <label className="text-sm font-medium">Monthly Salary (₱)</label>
                            <Input type="number" min={1} value={salaryInput} onChange={(e) => setSalaryInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSalarySave()} placeholder="e.g. 85000" className="mt-1" autoFocus />
                            {Number(salaryInput) > 0 && (
                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                    <p>Annual: <span className="font-mono font-medium">{formatCurrency(Number(salaryInput) * 12)}</span></p>
                                    <p>Daily rate: <span className="font-mono font-medium">{formatCurrency(Math.round(Number(salaryInput) * 12 / 365))}</span></p>
                                    <p>Semi-monthly: <span className="font-mono font-medium">{formatCurrency(Math.round(Number(salaryInput) / 2))}</span></p>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setSalaryDialogEmpId(null); setSalaryInput(""); }}>Cancel</Button>
                        <Button onClick={handleSalarySave}>Save Salary</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
