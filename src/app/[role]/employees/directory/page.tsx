"use client";

import { useState, useMemo } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, Mail, MapPin, Phone, Cake, DollarSign, Pencil } from "lucide-react";
import { getInitials, formatCurrency } from "@/lib/format";
import { useDepartmentsStore } from "@/store/departments.store";
import Link from "next/link";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { toast } from "sonner";
import { useAuditStore } from "@/store/audit.store";

export default function DirectoryPage() {
    const employees = useEmployeesStore((s) => s.employees);
    const updateEmployee = useEmployeesStore((s) => s.updateEmployee);
    const proposeSalaryChange = useEmployeesStore((s) => s.proposeSalaryChange);
    const salaryRequests = useEmployeesStore((s) => s.salaryRequests);
    const approveSalaryChange = useEmployeesStore((s) => s.approveSalaryChange);
    const rejectSalaryChange = useEmployeesStore((s) => s.rejectSalaryChange);
    const currentUser = useAuthStore((s) => s.currentUser);
    const { hasPermission } = useRolesStore();
    const rh = useRoleHref();
    const departments = useDepartmentsStore((s) => s.departments);
    const canSetSalary = hasPermission(currentUser.role, "employees:view_salary");
    const canDirectSet = hasPermission(currentUser.role, "employees:approve_salary");
    const isHR = canSetSalary && !canDirectSet; // can view/propose but not directly approve

    const [search, setSearch] = useState("");
    const [dept, setDept] = useState("all");
    const [status, setStatus] = useState("all");

    // Salary edit dialog state
    const [salaryDialogEmpId, setSalaryDialogEmpId] = useState<string | null>(null);
    const [salaryInput, setSalaryInput] = useState("");
    const [salaryReason, setSalaryReason] = useState("");

    const filtered = useMemo(() => {
        return employees.filter((e) => {
            const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase());
            const matchDept = dept === "all" || e.department === dept;
            const matchStatus = status === "all" || e.status === status;
            return matchSearch && matchDept && matchStatus;
        });
    }, [employees, search, dept, status]);

    const salaryDialogEmp = salaryDialogEmpId ? employees.find((e) => e.id === salaryDialogEmpId) : null;

    const openSalaryDialog = (e: React.MouseEvent, empId: string, currentSalary: number) => {
        e.preventDefault();
        e.stopPropagation();
        setSalaryDialogEmpId(empId);
        setSalaryInput(String(currentSalary));
    };

    const handleSalarySave = () => {
        if (!salaryDialogEmpId) return;
        const val = Number(salaryInput);
        if (!val || val <= 0) {
            toast.error("Please enter a valid monthly salary.");
            return;
        }
        if (isHR) {
            // HR proposes — needs approval from admin/finance
            proposeSalaryChange({
                employeeId: salaryDialogEmpId,
                proposedBy: currentUser.id,
                proposedSalary: val,
                effectiveDate: new Date().toISOString().slice(0, 10),
                reason: salaryReason || "Salary adjustment",
            });
            toast.success(`Salary change proposed for ${salaryDialogEmp?.name ?? "employee"} — pending approval`);
        } else {
            // Admin/Finance can directly set
            updateEmployee(salaryDialogEmpId, { salary: val });
            useAuditStore.getState().log({ entityType: "employee", entityId: salaryDialogEmpId, action: "salary_approved", performedBy: currentUser.id, afterSnapshot: { salary: val } });
            toast.success(`Salary updated for ${salaryDialogEmp?.name ?? "employee"}`);
        }
        setSalaryDialogEmpId(null);
        setSalaryInput("");
        setSalaryReason("");
    };

    const canViewEmployees = hasPermission(currentUser.role, "page:employees");
    if (!canViewEmployees) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <Search className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">You don&apos;t have access to the employee directory.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
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

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((emp) => (
                    <div key={emp.id} className="relative">
                        <Link href={rh(`/employees/${emp.id}`)}>
                            <Card className="border border-border/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-3">
                                        <Avatar className="h-12 w-12">
                                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                                {getInitials(emp.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{emp.name}</h3>
                                                <Badge variant="secondary" className={`text-[9px] shrink-0 ${emp.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-700 dark:text-red-400"}`}>
                                                    {emp.status}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5">{emp.role}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Mail className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">{emp.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                                            <span>{emp.location}</span>
                                        </div>
                                        {emp.phone && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                                <span>{emp.phone}</span>
                                            </div>
                                        )}
                                        {emp.birthday && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Cake className="h-3.5 w-3.5 shrink-0" />
                                                <span>{new Date(emp.birthday).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                            </div>
                                        )}
                                        {/* Salary row — always visible if canSetSalary */}
                                        {canSetSalary && (
                                            <div className="flex items-center justify-between pt-1 border-t border-border/40 mt-2">
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <DollarSign className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="font-mono font-medium text-foreground">{formatCurrency(emp.salary)}<span className="text-muted-foreground font-normal">/mo</span></span>
                                                </div>
                                                <button
                                                    onClick={(e) => openSalaryDialog(e, emp.id, emp.salary)}
                                                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                                                >
                                                    <Pencil className="h-2.5 w-2.5" /> {isHR ? "Propose" : "Set"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    </div>
                ))}
            </div>

            {/* Pending Salary Change Requests — visible to Admin/Finance */}
            {canDirectSet && salaryRequests.filter((r) => r.status === "pending").length > 0 && (
                <Card className="border border-amber-500/30 bg-amber-500/5">
                    <CardContent className="p-4 space-y-3">
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Pending Salary Proposals</p>
                        {salaryRequests.filter((r) => r.status === "pending").map((req) => {
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
                                        <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => { approveSalaryChange(req.id, currentUser.id); useAuditStore.getState().log({ entityType: "employee", entityId: req.employeeId, action: "salary_approved", performedBy: currentUser.id }); toast.success(`Salary change approved for ${emp?.name}`); }}>
                                            Approve
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => { rejectSalaryChange(req.id, currentUser.id); useAuditStore.getState().log({ entityType: "employee", entityId: req.employeeId, action: "salary_rejected", performedBy: currentUser.id }); toast.info(`Salary proposal rejected`); }}>
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Set / Propose Salary Dialog */}
            <Dialog open={!!salaryDialogEmpId} onOpenChange={(o) => { if (!o) { setSalaryDialogEmpId(null); setSalaryInput(""); setSalaryReason(""); } }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{isHR ? "Propose Salary Change" : "Set Monthly Salary"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-muted-foreground">
                            Employee: <span className="font-medium text-foreground">{salaryDialogEmp?.name}</span>
                        </p>
                        <div>
                            <label className="text-sm font-medium">{isHR ? "Proposed" : ""} Monthly Salary (₱)</label>
                            <Input
                                type="number"
                                min={1}
                                value={salaryInput}
                                onChange={(e) => setSalaryInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSalarySave()}
                                placeholder="e.g. 85000"
                                className="mt-1"
                                autoFocus
                            />
                            {Number(salaryInput) > 0 && (
                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                    <p>Annual: <span className="font-mono font-medium">{formatCurrency(Number(salaryInput) * 12)}</span></p>
                                    <p>Semi-monthly: <span className="font-mono font-medium">{formatCurrency(Math.round(Number(salaryInput) / 2))}</span></p>
                                </div>
                            )}
                        </div>
                        {isHR && (
                            <div>
                                <label className="text-sm font-medium">Reason</label>
                                <Input
                                    value={salaryReason}
                                    onChange={(e) => setSalaryReason(e.target.value)}
                                    placeholder="e.g. Annual performance review"
                                    className="mt-1"
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setSalaryDialogEmpId(null); setSalaryInput(""); setSalaryReason(""); }}>Cancel</Button>
                        <Button onClick={handleSalarySave}>{isHR ? "Submit Proposal" : "Save Salary"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
