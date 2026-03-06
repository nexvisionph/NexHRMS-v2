"use client";

import { useState, useMemo } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useLoansStore } from "@/store/loans.store";
import { useLeaveStore } from "@/store/leave.store";
import { useProjectsStore } from "@/store/projects.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Slider } from "@/components/ui/slider";
import { nanoid } from "nanoid";
import { Search, SlidersHorizontal, Eye, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2, UserMinus, Pencil, Mail, MapPin, Phone, Cake, DollarSign, RefreshCw, KeyRound, ShieldCheck, Briefcase, User, FolderKanban } from "lucide-react";
import { getInitials, formatCurrency, formatDate } from "@/lib/format";
import { DEPARTMENTS, ROLES, LOCATIONS } from "@/lib/constants";
import Link from "next/link";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { toast } from "sonner";
import { useAuditStore } from "@/store/audit.store";
import { Switch } from "@/components/ui/switch";
import type { Employee, WorkType, PayFrequency, Role } from "@/types";

/* ═══════════════════════════════════════════════════════════════
   ADMIN / HR VIEW — Full Employee Management
   Two tabs: Management (CRUD table) + Directory & Salary
   Admin=direct salary set, HR=propose salary changes
   ═══════════════════════════════════════════════════════════════ */

type SortKey = keyof Employee;
type SortDir = "asc" | "desc";
const PAGE_SIZES = [10, 20, 50];

function SortIndicator({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />;
}

export default function AdminEmployeesView() {
    const { employees, searchQuery, setSearchQuery, statusFilter, setStatusFilter, workTypeFilter, setWorkTypeFilter, departmentFilter, setDepartmentFilter, toggleStatus, addEmployee, updateEmployee, removeEmployee, resignEmployee, proposeSalaryChange, salaryRequests, approveSalaryChange, rejectSalaryChange } = useEmployeesStore();
    const { currentUser, createAccount } = useAuthStore();
    const { computeFinalPay, paySchedule } = usePayrollStore();
    const { getActiveByEmployee } = useLoansStore();
    const { getEmployeeBalances } = useLeaveStore();
    const { projects, assignEmployee: assignToProject, removeEmployee: removeFromProject, getProjectForEmployee } = useProjectsStore();
    const { hasPermission } = useRolesStore();
    const rh = useRoleHref();
    const canManage = hasPermission(currentUser.role, "employees:edit");
    const canSetSalary = hasPermission(currentUser.role, "employees:view_salary");
    const canDirectSet = hasPermission(currentUser.role, "employees:approve_salary");
    const isHR = canSetSalary && !canDirectSet;

    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [sortDir, setSortDir] = useState<SortDir>("asc");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [salaryRange, setSalaryRange] = useState([0, 200000]);
    const [visibleCols, setVisibleCols] = useState<Record<string, boolean>>({
        id: true, name: true, status: true, role: true, department: false, project: true, teamLeader: true, productivity: true, joinDate: true, salary: true, workType: true,
    });

    // Add Employee Dialog
    const [addOpen, setAddOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newRole, setNewRole] = useState("");
    const [newDept, setNewDept] = useState("");
    const [newWorkType, setNewWorkType] = useState<WorkType>("WFO");
    const [newSalary, setNewSalary] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newLocation, setNewLocation] = useState("");
    const [newPayFreq, setNewPayFreq] = useState<string>("company");
    const [newSystemRole, setNewSystemRole] = useState<Role>("employee");
    const [newPassword, setNewPassword] = useState("");
    const [newMustChange, setNewMustChange] = useState(true);
    const [newWorkDays, setNewWorkDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    const [newProjectId, setNewProjectId] = useState<string>("none");

    const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const toggleWorkDay = (day: string) =>
        setNewWorkDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);

    const generatePassword = () => {
        const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
        const pw = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        setNewPassword(pw);
        setNewMustChange(true);
    };

    // Edit Employee Dialog
    const [editOpen, setEditOpen] = useState(false);
    const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editRole, setEditRole] = useState("");
    const [editDept, setEditDept] = useState("");
    const [editWorkType, setEditWorkType] = useState<WorkType>("WFO");
    const [editSalary, setEditSalary] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editLocation, setEditLocation] = useState("");
    const [editProductivity, setEditProductivity] = useState("80");
    const [editProjectId, setEditProjectId] = useState<string>("");
    const [editPayFreq, setEditPayFreq] = useState<string>("company");

    // Salary governance (Directory tab)
    const [salaryDialogEmpId, setSalaryDialogEmpId] = useState<string | null>(null);
    const [salaryInput, setSalaryInput] = useState("");
    const [salaryReason, setSalaryReason] = useState("");
    const [dirSearch, setDirSearch] = useState("");
    const [dirDept, setDirDept] = useState("all");
    const [dirStatus, setDirStatus] = useState("all");

    const salaryDialogEmp = salaryDialogEmpId ? employees.find((e) => e.id === salaryDialogEmpId) : null;

    const dirFiltered = useMemo(() => employees.filter((e) => {
        const matchSearch = !dirSearch || e.name.toLowerCase().includes(dirSearch.toLowerCase()) || e.email.toLowerCase().includes(dirSearch.toLowerCase());
        const matchDept = dirDept === "all" || e.department === dirDept;
        const matchStatus = dirStatus === "all" || e.status === dirStatus;
        return matchSearch && matchDept && matchStatus;
    }), [employees, dirSearch, dirDept, dirStatus]);

    const openSalaryDialog = (e: React.MouseEvent, empId: string, currentSalary: number) => {
        e.preventDefault(); e.stopPropagation();
        setSalaryDialogEmpId(empId); setSalaryInput(String(currentSalary));
    };

    const handleSalarySave = () => {
        if (!salaryDialogEmpId) return;
        const val = Number(salaryInput);
        if (!val || val <= 0) { toast.error("Please enter a valid monthly salary."); return; }
        if (isHR) {
            proposeSalaryChange({ employeeId: salaryDialogEmpId, proposedBy: currentUser.id, proposedSalary: val, effectiveDate: new Date().toISOString().slice(0, 10), reason: salaryReason || "Salary adjustment" });
            useAuditStore.getState().log({ entityType: "employee", entityId: salaryDialogEmpId, action: "salary_proposed", performedBy: currentUser.id, afterSnapshot: { salary: val } });
            toast.success(`Salary change proposed for ${salaryDialogEmp?.name ?? "employee"} — pending approval`);
        } else {
            updateEmployee(salaryDialogEmpId, { salary: val });
            useAuditStore.getState().log({ entityType: "employee", entityId: salaryDialogEmpId, action: "salary_approved", performedBy: currentUser.id, afterSnapshot: { salary: val } });
            toast.success(`Salary updated for ${salaryDialogEmp?.name ?? "employee"}`);
        }
        setSalaryDialogEmpId(null); setSalaryInput(""); setSalaryReason("");
    };

    const filtered = useMemo(() => {
        const result = employees.filter((e) => {
            const matchSearch = !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.email.toLowerCase().includes(searchQuery.toLowerCase()) || e.id.toLowerCase().includes(searchQuery.toLowerCase());
            const matchStatus = statusFilter === "all" || e.status === statusFilter;
            const matchWork = workTypeFilter === "all" || e.workType === workTypeFilter;
            const matchDept = departmentFilter === "all" || e.department === departmentFilter;
            const matchSalary = e.salary >= salaryRange[0] && e.salary <= salaryRange[1];
            return matchSearch && matchStatus && matchWork && matchDept && matchSalary;
        });
        result.sort((a, b) => {
            const aVal = a[sortKey]; const bVal = b[sortKey];
            if (aVal == null || bVal == null) return 0;
            const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
            return sortDir === "asc" ? cmp : -cmp;
        });
        return result;
    }, [employees, searchQuery, statusFilter, workTypeFilter, departmentFilter, salaryRange, sortKey, sortDir]);

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    const si = (col: SortKey) => <SortIndicator col={col} sortKey={sortKey} sortDir={sortDir} />;

    const handleAddEmployee = () => {
        if (!canManage) { toast.error("You don't have permission to add employees"); return; }
        if (!newName || !newEmail || !newRole || !newDept) { toast.error("Please fill all required fields"); return; }
        const id = `EMP-${nanoid(6).toUpperCase()}`;
        addEmployee({
            id, name: newName, email: newEmail, role: newRole, department: newDept, workType: newWorkType,
            salary: Number(newSalary) || 0, joinDate: new Date().toISOString().split("T")[0], productivity: 80,
            status: "active", location: newLocation || "New York", phone: newPhone || undefined,
            workDays: newWorkDays.length ? newWorkDays : undefined,
            ...(newPayFreq !== "company" ? { payFrequency: newPayFreq as PayFrequency } : {}),
        });
        if (newPassword) {
            const result = createAccount({ name: newName, email: newEmail, role: newSystemRole, password: newPassword, mustChangePassword: newMustChange, profileComplete: true }, currentUser.email);
            if (!result.ok) toast.warning(`Employee added but account creation failed: ${result.error}`);
            else toast.success(`${newName} added with a login account.`);
        } else toast.success(`${newName} added successfully!`);
        if (newProjectId && newProjectId !== "none") assignToProject(newProjectId, id);
        setNewName(""); setNewEmail(""); setNewRole(""); setNewDept(""); setNewWorkType("WFO"); setNewSalary(""); setNewPhone(""); setNewLocation(""); setNewPayFreq("company"); setNewSystemRole("employee"); setNewPassword(""); setNewMustChange(true); setNewWorkDays(["Mon", "Tue", "Wed", "Thu", "Fri"]); setNewProjectId("none");
        setAddOpen(false);
    };

    const handleOpenEdit = (emp: Employee) => {
        setEditingEmp(emp); setEditName(emp.name); setEditEmail(emp.email); setEditRole(emp.role); setEditDept(emp.department);
        setEditWorkType(emp.workType); setEditSalary(String(emp.salary)); setEditPhone(emp.phone || ""); setEditLocation(emp.location);
        setEditProductivity(String(emp.productivity)); setEditPayFreq(emp.payFrequency || "company");
        const currentProject = getProjectForEmployee(emp.id);
        setEditProjectId(currentProject?.id || ""); setEditOpen(true);
    };

    const handleSaveEdit = () => {
        if (!canManage || !editingEmp) { toast.error("You don't have permission to edit employees"); return; }
        if (!editName || !editEmail || !editRole || !editDept) { toast.error("Please fill all required fields"); return; }
        updateEmployee(editingEmp.id, {
            name: editName, email: editEmail, role: editRole, department: editDept, workType: editWorkType,
            salary: Number(editSalary) || 0, phone: editPhone || undefined, location: editLocation,
            productivity: Number(editProductivity) || 80, payFrequency: editPayFreq !== "company" ? editPayFreq as PayFrequency : undefined,
        });
        const currentProject = getProjectForEmployee(editingEmp.id);
        if (currentProject && currentProject.id !== editProjectId) removeFromProject(currentProject.id, editingEmp.id);
        if (editProjectId && editProjectId !== "none" && (!currentProject || currentProject.id !== editProjectId)) assignToProject(editProjectId, editingEmp.id);
        else if (editProjectId === "none" && currentProject) removeFromProject(currentProject.id, editingEmp.id);
        toast.success(`${editName} updated successfully!`);
        useAuditStore.getState().log({ entityType: "employee", entityId: editingEmp.id, action: "adjustment_applied", performedBy: currentUser.id, reason: "Profile updated" });
        setEditOpen(false); setEditingEmp(null);
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{employees.length} total employees</p>
            </div>

            <Tabs defaultValue="management">
                <TabsList>
                    <TabsTrigger value="management">Employee Management</TabsTrigger>
                    <TabsTrigger value="directory">Directory &amp; Salary</TabsTrigger>
                </TabsList>

                {/* ─── Management Tab ─── */}
                <TabsContent value="management" className="mt-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-muted-foreground">{filtered.length} employees found</p>
                        <Dialog open={addOpen} onOpenChange={setAddOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-1.5" disabled={!canManage}><Plus className="h-4 w-4" /> Add Employee</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
                                <div className="px-6 pt-5 pb-4 border-b">
                                    <DialogTitle className="text-base font-semibold">Add New Employee</DialogTitle>
                                    <p className="text-xs text-muted-foreground mt-0.5">Fill in the details below. Fields marked <span className="text-destructive">*</span> are required.</p>
                                </div>
                                <div className="overflow-y-auto max-h-[calc(85vh-160px)] px-6 py-4 space-y-4">
                                    {/* Personal Information */}
                                    <div className="rounded-lg border bg-card">
                                        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/40 rounded-t-lg">
                                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personal Information</span>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><label className="text-xs font-medium text-muted-foreground">Full Name <span className="text-destructive">*</span></label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Juan dela Cruz" className="mt-1 h-8 text-sm" /></div>
                                                <div><label className="text-xs font-medium text-muted-foreground">Email Address <span className="text-destructive">*</span></label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="juan@company.com" className="mt-1 h-8 text-sm" /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><label className="text-xs font-medium text-muted-foreground">Phone</label><Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+63 912 345 6789" className="mt-1 h-8 text-sm" /></div>
                                                <div><label className="text-xs font-medium text-muted-foreground">Office Location</label>
                                                    <Select value={newLocation} onValueChange={setNewLocation}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select office" /></SelectTrigger><SelectContent>{LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Job Details */}
                                    <div className="rounded-lg border bg-card">
                                        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/40 rounded-t-lg">
                                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job Details</span>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><label className="text-xs font-medium text-muted-foreground">Job Title <span className="text-destructive">*</span></label>
                                                    <Select value={newRole} onValueChange={setNewRole}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select role" /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
                                                </div>
                                                <div><label className="text-xs font-medium text-muted-foreground">Department <span className="text-destructive">*</span></label>
                                                    <Select value={newDept} onValueChange={setNewDept}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select dept" /></SelectTrigger><SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><label className="text-xs font-medium text-muted-foreground">Work Arrangement</label>
                                                    <Select value={newWorkType} onValueChange={(v) => setNewWorkType(v as WorkType)}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WFO">Work From Office</SelectItem><SelectItem value="WFH">Work From Home</SelectItem><SelectItem value="HYBRID">Hybrid</SelectItem><SelectItem value="ONSITE">Full Onsite</SelectItem></SelectContent></Select>
                                                </div>
                                                <div><label className="text-xs font-medium text-muted-foreground">Monthly Salary (₱)</label><Input type="number" value={newSalary} onChange={(e) => setNewSalary(e.target.value)} placeholder="e.g. 25000" className="mt-1 h-8 text-sm" /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><label className="text-xs font-medium text-muted-foreground">Pay Frequency</label>
                                                    <Select value={newPayFreq} onValueChange={setNewPayFreq}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="company">Company Default</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="semi_monthly">Semi-Monthly</SelectItem><SelectItem value="bi_weekly">Bi-Weekly</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent></Select>
                                                </div>
                                            </div>
                                            {/* Work Days */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-medium text-muted-foreground">Work Days <span className="text-muted-foreground/60 font-normal">(optional)</span></label>
                                                    <div className="flex items-center gap-1">
                                                        {[{ label: "Mon–Fri", days: ["Mon","Tue","Wed","Thu","Fri"] }, { label: "Mon–Sat", days: ["Mon","Tue","Wed","Thu","Fri","Sat"] }, { label: "All 7", days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] }, { label: "Weekends", days: ["Sat","Sun"] }].map(({ label, days }) => (
                                                            <button key={label} type="button" onClick={() => setNewWorkDays(days)} className="px-2 py-0.5 text-[10px] font-medium rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">{label}</button>
                                                        ))}
                                                        <button type="button" onClick={() => setNewWorkDays([])} className="px-2 py-0.5 text-[10px] font-medium rounded border border-dashed border-muted-foreground/30 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors">Clear</button>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    {WEEK_DAYS.map((day) => (
                                                        <button key={day} type="button" onClick={() => toggleWorkDay(day)} className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-all ${newWorkDays.includes(day) ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}>{day}</button>
                                                    ))}
                                                </div>
                                                {newWorkDays.length > 0 && <p className="text-[11px] text-muted-foreground mt-1.5">{newWorkDays.length} day{newWorkDays.length !== 1 ? "s" : ""} selected &mdash; {newWorkDays.join(", ")}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Login Account */}
                                    <div className="rounded-lg border bg-card">
                                        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/40 rounded-t-lg">
                                            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Login Account</span>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            {newPassword ? (
                                                <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" /><span>Account will be created — employee can log in immediately after being added.</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                                                    <KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>No password set — this employee <strong>won&apos;t be able to log in</strong>. Set a password or generate one below.</span>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><label className="text-xs font-medium text-muted-foreground">System Role</label>
                                                    <Select value={newSystemRole} onValueChange={(v) => setNewSystemRole(v as Role)}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="employee">Employee</SelectItem><SelectItem value="supervisor">Supervisor</SelectItem><SelectItem value="hr">HR</SelectItem><SelectItem value="finance">Finance</SelectItem><SelectItem value="payroll_admin">Payroll Admin</SelectItem><SelectItem value="auditor">Auditor</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select>
                                                </div>
                                                <div><label className="text-xs font-medium text-muted-foreground">Initial Password</label>
                                                    <div className="flex gap-1.5 mt-1">
                                                        <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Set a password…" className="h-8 text-sm font-mono" />
                                                        <button type="button" onClick={generatePassword} title="Generate random password" className="shrink-0 rounded-md border h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><RefreshCw className="h-3.5 w-3.5" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`flex items-center justify-between rounded-md border px-3 py-2 transition-colors ${newPassword ? "bg-background" : "bg-muted/30 opacity-50"}`}>
                                                <div><p className="text-xs font-medium">Require password change on first login</p><p className="text-[11px] text-muted-foreground">Prompts employee to set their own password</p></div>
                                                <Switch checked={newMustChange} onCheckedChange={setNewMustChange} disabled={!newPassword} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Project Assignment */}
                                    <div className="rounded-lg border bg-card">
                                        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/40 rounded-t-lg">
                                            <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project Assignment</span>
                                            <span className="ml-auto text-[10px] font-normal text-muted-foreground/60">optional</span>
                                        </div>
                                        <div className="p-4">
                                            <label className="text-xs font-medium text-muted-foreground">Assign to Project</label>
                                            <Select value={newProjectId} onValueChange={setNewProjectId}>
                                                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="No project — assign later" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">No project</SelectItem>
                                                    {projects.filter((p) => p.status !== "completed").map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            {newProjectId && newProjectId !== "none" && (() => {
                                                const proj = projects.find((p) => p.id === newProjectId);
                                                return proj ? <p className="text-[11px] text-muted-foreground mt-1.5">{proj.assignedEmployeeIds?.length ?? 0} member{(proj.assignedEmployeeIds?.length ?? 0) !== 1 ? "s" : ""} currently on this project</p> : null;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/20">
                                    <Button variant="outline" onClick={() => setAddOpen(false)} className="h-8 text-sm">Cancel</Button>
                                    <Button onClick={handleAddEmployee} className="gap-1.5 h-8 text-sm"><Plus className="h-3.5 w-3.5" /> Add Employee</Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Edit Employee Dialog */}
                    <Dialog open={editOpen} onOpenChange={setEditOpen}>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader><DialogTitle>Edit Employee — {editingEmp?.id}</DialogTitle></DialogHeader>
                            <div className="space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-sm font-medium">Full Name *</label><Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" /></div>
                                    <div><label className="text-sm font-medium">Email *</label><Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="mt-1" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-sm font-medium">Role *</label>
                                        <Select value={editRole} onValueChange={setEditRole}><SelectTrigger className="mt-1"><SelectValue placeholder="Select role" /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div><label className="text-sm font-medium">Department *</label>
                                        <Select value={editDept} onValueChange={setEditDept}><SelectTrigger className="mt-1"><SelectValue placeholder="Select dept" /></SelectTrigger><SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div><label className="text-sm font-medium">Work Type</label>
                                        <Select value={editWorkType} onValueChange={(v) => setEditWorkType(v as WorkType)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WFO">WFO</SelectItem><SelectItem value="WFH">WFH</SelectItem><SelectItem value="HYBRID">Hybrid</SelectItem></SelectContent></Select>
                                    </div>
                                    <div><label className="text-sm font-medium">Monthly Salary (₱)</label><Input type="number" value={editSalary} onChange={(e) => setEditSalary(e.target.value)} className="mt-1" /></div>
                                    <div><label className="text-sm font-medium">Pay Frequency</label>
                                        <Select value={editPayFreq} onValueChange={setEditPayFreq}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="company">Company Default ({paySchedule.defaultFrequency.replace("_", "-")})</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="semi_monthly">Semi-Monthly</SelectItem><SelectItem value="bi_weekly">Bi-Weekly</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent></Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-sm font-medium">Location</label>
                                        <Select value={editLocation} onValueChange={setEditLocation}><SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div><label className="text-sm font-medium">Phone</label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="mt-1" /></div>
                                    <div><label className="text-sm font-medium">Productivity (%)</label><Input type="number" min="0" max="100" value={editProductivity} onChange={(e) => setEditProductivity(e.target.value)} className="mt-1" /></div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Assigned Project</label>
                                    <Select value={editProjectId || "none"} onValueChange={setEditProjectId}><SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger><SelectContent><SelectItem value="none">No Project</SelectItem>{projects.filter(p => p.status !== "completed").map((p) => <SelectItem key={p.id} value={p.id}>{p.name} {p.assignedEmployeeIds.includes(editingEmp?.id || "") ? "✓" : ""}</SelectItem>)}</SelectContent></Select>
                                    <p className="text-xs text-muted-foreground mt-1">Assigned project defines geofence for attendance check-in</p>
                                </div>
                                <Button onClick={handleSaveEdit} className="w-full">Save Changes</Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Filters */}
                    <Card className="border border-border/50">
                        <CardContent className="p-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search by name, email, or ID..." className="pl-9" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
                                </div>
                                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as "all" | "active" | "inactive"); setPage(1); }}>
                                    <SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="resigned">Resigned</SelectItem></SelectContent>
                                </Select>
                                <Select value={workTypeFilter} onValueChange={(v) => { setWorkTypeFilter(v as "all" | "WFH" | "WFO" | "HYBRID"); setPage(1); }}>
                                    <SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="Work Type" /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Types</SelectItem><SelectItem value="WFH">WFH</SelectItem><SelectItem value="WFO">WFO</SelectItem><SelectItem value="HYBRID">Hybrid</SelectItem></SelectContent>
                                </Select>
                                <Sheet>
                                    <SheetTrigger asChild><Button variant="outline" size="sm" className="gap-1.5"><SlidersHorizontal className="h-4 w-4" /> Advanced</Button></SheetTrigger>
                                    <SheetContent className="w-[340px]">
                                        <SheetHeader><SheetTitle>Advanced Filters</SheetTitle></SheetHeader>
                                        <div className="space-y-6 mt-6">
                                            <div><label className="text-sm font-medium">Department</label>
                                                <Select value={departmentFilter} onValueChange={setDepartmentFilter}><SelectTrigger className="mt-1.5"><SelectValue placeholder="All" /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
                                            </div>
                                            <div><label className="text-sm font-medium">Monthly Salary Range</label>
                                                <div className="mt-3 px-1">
                                                    <Slider min={0} max={200000} step={5000} value={salaryRange} onValueChange={setSalaryRange} />
                                                    <div className="flex justify-between text-xs text-muted-foreground mt-2"><span>{formatCurrency(salaryRange[0])}</span><span>{formatCurrency(salaryRange[1])}</span></div>
                                                </div>
                                            </div>
                                            <div><label className="text-sm font-medium">Visible Columns</label>
                                                <div className="mt-2 space-y-2">
                                                    {Object.keys(visibleCols).map((col) => (
                                                        <label key={col} className="flex items-center gap-2 text-sm">
                                                            <input type="checkbox" checked={visibleCols[col]} onChange={() => setVisibleCols({ ...visibleCols, [col]: !visibleCols[col] })} className="rounded" />
                                                            {col.charAt(0).toUpperCase() + col.slice(1).replace(/([A-Z])/g, " $1")}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Table */}
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {visibleCols.id && <TableHead className="cursor-pointer text-xs" onClick={() => handleSort("id")}>ID{si("id")}</TableHead>}
                                            {visibleCols.name && <TableHead className="cursor-pointer text-xs" onClick={() => handleSort("name")}>Name{si("name")}</TableHead>}
                                            {visibleCols.status && <TableHead className="text-xs">Status</TableHead>}
                                            {visibleCols.role && <TableHead className="cursor-pointer text-xs" onClick={() => handleSort("role")}>Role{si("role")}</TableHead>}
                                            {visibleCols.department && <TableHead className="text-xs">Department</TableHead>}
                                            {visibleCols.project && <TableHead className="text-xs">Project</TableHead>}
                                            {visibleCols.teamLeader && <TableHead className="text-xs">Team Leader</TableHead>}
                                            {visibleCols.productivity && <TableHead className="cursor-pointer text-xs" onClick={() => handleSort("productivity")}>Productivity{si("productivity")}</TableHead>}
                                            {visibleCols.joinDate && <TableHead className="cursor-pointer text-xs" onClick={() => handleSort("joinDate")}>Join Date{si("joinDate")}</TableHead>}
                                            {visibleCols.salary && <TableHead className="cursor-pointer text-xs" onClick={() => handleSort("salary")}>Salary (Monthly){si("salary")}</TableHead>}
                                            {visibleCols.workType && <TableHead className="text-xs">Work Type</TableHead>}
                                            <TableHead className="text-xs w-28"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginated.map((emp) => {
                                            const assignedProject = getProjectForEmployee(emp.id);
                                            return (
                                                <TableRow key={emp.id} className="group">
                                                    {visibleCols.id && <TableCell className="text-xs text-muted-foreground">{emp.id}</TableCell>}
                                                    {visibleCols.name && <TableCell><div className="flex items-center gap-2"><Avatar className="h-8 w-8"><AvatarFallback className="text-[10px] bg-muted">{getInitials(emp.name)}</AvatarFallback></Avatar><div><p className="text-sm font-medium">{emp.name}</p><p className="text-xs text-muted-foreground">{emp.email}</p></div></div></TableCell>}
                                                    {visibleCols.status && <TableCell><Badge variant="secondary" className={emp.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : emp.status === "resigned" ? "bg-orange-500/15 text-orange-700 dark:text-orange-400" : "bg-red-500/15 text-red-700 dark:text-red-400"}>{emp.status}</Badge></TableCell>}
                                                    {visibleCols.role && <TableCell className="text-xs">{emp.role}</TableCell>}
                                                    {visibleCols.department && <TableCell className="text-xs">{emp.department}</TableCell>}
                                                    {visibleCols.project && <TableCell className="text-xs">{assignedProject ? <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">{assignedProject.name}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>}
                                                    {visibleCols.teamLeader && <TableCell className="text-xs text-muted-foreground">{emp.teamLeader ? employees.find((e) => e.id === emp.teamLeader)?.name || "—" : "—"}</TableCell>}
                                                    {visibleCols.productivity && <TableCell><div className="flex items-center gap-2"><div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${emp.productivity}%` }} /></div><span className="text-xs text-muted-foreground">{emp.productivity}%</span></div></TableCell>}
                                                    {visibleCols.joinDate && <TableCell className="text-xs text-muted-foreground">{formatDate(emp.joinDate)}</TableCell>}
                                                    {visibleCols.salary && <TableCell className="text-xs font-medium">{formatCurrency(emp.salary)}<span className="text-muted-foreground">/mo</span></TableCell>}
                                                    {visibleCols.workType && <TableCell><Badge variant="outline" className="text-[10px]">{emp.workType}</Badge></TableCell>}
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <Link href={rh(`/employees/${emp.id}`)}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button></Link>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canManage} onClick={() => handleOpenEdit(emp)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                                                            <Button variant="ghost" size="sm" className="h-7 text-[10px]" disabled={!canManage} onClick={() => { if (!canManage) return; toggleStatus(emp.id); useAuditStore.getState().log({ entityType: "employee", entityId: emp.id, action: emp.status === "active" ? "employee_resigned" : "adjustment_applied", performedBy: currentUser.id, reason: emp.status === "active" ? "Deactivated" : "Activated" }); toast.success(`${emp.name} ${emp.status === "active" ? "deactivated" : "activated"}`); }}>
                                                                {emp.status === "active" ? "Deactivate" : emp.status === "inactive" ? "Activate" : emp.status}
                                                            </Button>
                                                            {canManage && emp.status === "active" && (
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-orange-500 hover:text-orange-700 hover:bg-orange-500/10" title="Resign"><UserMinus className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader><AlertDialogTitle>Resign Employee</AlertDialogTitle><AlertDialogDescription>This will mark <strong>{emp.name}</strong> as resigned and compute their final pay including pro-rated salary, leave conversion, and loan offset.</AlertDialogDescription></AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            <AlertDialogAction className="bg-orange-600 hover:bg-orange-700" onClick={() => {
                                                                                resignEmployee(emp.id);
                                                                                const loanBalance = getActiveByEmployee(emp.id).reduce((sum, l) => sum + l.remainingBalance, 0);
                                                                                const balances = getEmployeeBalances(emp.id, new Date().getFullYear());
                                                                                const leaveDays = balances.reduce((sum, b) => sum + b.remaining, 0);
                                                                                computeFinalPay({ employeeId: emp.id, resignedAt: new Date().toISOString(), salary: emp.salary, unpaidOTHours: 0, leaveDays, loanBalance });
                                                                                useAuditStore.getState().log({ entityType: "employee", entityId: emp.id, action: "employee_resigned", performedBy: currentUser.id, afterSnapshot: { finalPay: true } });
                                                                                toast.success(`${emp.name} resigned — final pay computed`);
                                                                            }}>Resign & Compute Final Pay</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            )}
                                                            {canManage && emp.status === "inactive" && (
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader><AlertDialogTitle>Delete Employee</AlertDialogTitle><AlertDialogDescription>Are you sure you want to permanently remove <strong>{emp.name}</strong>? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { removeEmployee(emp.id); toast.success(`${emp.name} removed`); }}>Delete</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Pagination */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Rows per page:</span>
                            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}><SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger><SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Page {page} of {totalPages || 1}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </TabsContent>

                {/* ─── Directory & Salary Tab ─── */}
                <TabsContent value="directory" className="mt-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search employees..." className="pl-9" value={dirSearch} onChange={(e) => setDirSearch(e.target.value)} />
                        </div>
                        <Select value={dirDept} onValueChange={setDirDept}><SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
                        <Select value={dirStatus} onValueChange={setDirStatus}><SelectTrigger className="w-full sm:w-[130px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {dirFiltered.map((emp) => (
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
                                                {canSetSalary && (
                                                    <div className="flex items-center justify-between pt-1 border-t border-border/40 mt-2">
                                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <DollarSign className="h-3.5 w-3.5 shrink-0" />
                                                            <span className="font-mono font-medium text-foreground">{formatCurrency(emp.salary)}<span className="text-muted-foreground font-normal">/mo</span></span>
                                                        </div>
                                                        <button onClick={(e) => openSalaryDialog(e, emp.id, emp.salary)} className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
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

                    {/* Pending Salary Proposals */}
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
                                                <p className="text-xs text-muted-foreground">{formatCurrency(req.oldSalary)} → <span className="font-semibold text-foreground">{formatCurrency(req.proposedSalary)}</span></p>
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
                </TabsContent>
            </Tabs>

            {/* Salary Dialog */}
            <Dialog open={!!salaryDialogEmpId} onOpenChange={(o) => { if (!o) { setSalaryDialogEmpId(null); setSalaryInput(""); setSalaryReason(""); } }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>{isHR ? "Propose Salary Change" : "Set Monthly Salary"}</DialogTitle></DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-muted-foreground">Employee: <span className="font-medium text-foreground">{salaryDialogEmp?.name}</span></p>
                        <div>
                            <label className="text-sm font-medium">{isHR ? "Proposed" : ""} Monthly Salary (₱)</label>
                            <Input type="number" min={1} value={salaryInput} onChange={(e) => setSalaryInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSalarySave()} placeholder="e.g. 85000" className="mt-1" autoFocus />
                            {Number(salaryInput) > 0 && (
                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                    <p>Annual: <span className="font-mono font-medium">{formatCurrency(Number(salaryInput) * 12)}</span></p>
                                    <p>Daily rate: <span className="font-mono font-medium">{formatCurrency(Math.round(Number(salaryInput) * 12 / 365))}</span></p>
                                    <p>Semi-monthly: <span className="font-mono font-medium">{formatCurrency(Math.round(Number(salaryInput) / 2))}</span></p>
                                </div>
                            )}
                        </div>
                        {isHR && <div><label className="text-sm font-medium">Reason</label><Input value={salaryReason} onChange={(e) => setSalaryReason(e.target.value)} placeholder="e.g. Annual performance review" className="mt-1" /></div>}
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
