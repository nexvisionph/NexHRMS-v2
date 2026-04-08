"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useLoansStore } from "@/store/loans.store";
import { useLeaveStore } from "@/store/leave.store";
import { useProjectsStore } from "@/store/projects.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useJobTitlesStore } from "@/store/job-titles.store";
import { useDepartmentsStore } from "@/store/departments.store";
import {
    createUserAccount,
    adminResetPassword,
    adminDeleteAccount,
    listUserAccounts,
} from "@/services/auth.service";
import type { DemoUserLike } from "@/services/auth.service";
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
    Sheet, SheetContent, SheetTitle, SheetTrigger,
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
import { Search, SlidersHorizontal, Eye, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2, UserMinus, Pencil, Mail, MapPin, Phone, Cake, DollarSign, RefreshCw, KeyRound, ShieldCheck, Briefcase, User, FolderKanban, Users, Tag, Crown, Building2 } from "lucide-react";
import { getInitials, formatCurrency, formatDate, validatePhone } from "@/lib/format";
import Link from "next/link";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { toast } from "sonner";
import { useAuditStore } from "@/store/audit.store";
import { Switch } from "@/components/ui/switch";
import type { Employee, WorkType, PayFrequency, Role, JobTitle, Department } from "@/types";

const USE_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

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
    const demoAccounts = useAuthStore((s) => s.accounts);
    const demoAdminSetPassword = useAuthStore((s) => s.adminSetPassword);
    const demoDeleteAccount = useAuthStore((s) => s.deleteAccount);
    const { computeFinalPay, paySchedule } = usePayrollStore();
    const { getActiveByEmployee } = useLoansStore();
    const { getEmployeeBalances } = useLeaveStore();
    const { projects, assignEmployee: assignToProject, removeEmployee: removeFromProject, getProjectForEmployee } = useProjectsStore();
    const { shiftTemplates, assignShift, unassignShift } = useAttendanceStore();
    const { jobTitles, addJobTitle, updateJobTitle, deleteJobTitle, toggleActive: toggleJobTitleActive } = useJobTitlesStore();
    const { departments, addDepartment, updateDepartment, deleteDepartment, toggleActive: toggleDeptActive } = useDepartmentsStore();
    const { hasPermission } = useRolesStore();
    const rh = useRoleHref();
    const canManage = hasPermission(currentUser.role, "employees:edit");
    const canSetSalary = hasPermission(currentUser.role, "employees:view_salary");
    const canDirectSet = hasPermission(currentUser.role, "employees:approve_salary");
    const isHR = canSetSalary && !canDirectSet;
    const canManageRoles = hasPermission(currentUser.role, "settings:roles");

    // ─── User Accounts (production: real DB, demo: Zustand store) ───
    const [realAccounts, setRealAccounts] = useState<DemoUserLike[]>([]);
    const [accountsLoading, setAccountsLoading] = useState(!USE_DEMO_MODE);
    const [actionLoading, setActionLoading] = useState(false);

    const refreshAccounts = useCallback(async () => {
        if (USE_DEMO_MODE) return;
        const result = await listUserAccounts();
        if (result.ok) setRealAccounts(result.accounts);
        setAccountsLoading(false);
    }, []);

    useEffect(() => {
        if (USE_DEMO_MODE) return;
        let cancelled = false;
        listUserAccounts().then((result) => {
            if (cancelled) return;
            if (result.ok) setRealAccounts(result.accounts);
            setAccountsLoading(false);
        });
        return () => { cancelled = true; };
    }, []);

    const accounts = USE_DEMO_MODE ? demoAccounts : realAccounts;

    // ─── Accounts Tab State ───
    const [acctSearch, setAcctSearch] = useState("");
    const [acctRoleFilter, setAcctRoleFilter] = useState("all");
    const [resetPwUserId, setResetPwUserId] = useState<string | null>(null);
    const [resetPwValue, setResetPwValue] = useState("");

    // ─── Job Titles Tab State ───
    const [jtSearch, setJtSearch] = useState("");
    const [jtDeptFilter, setJtDeptFilter] = useState("all");
    const [jtStatusFilter, setJtStatusFilter] = useState<"all" | "active" | "inactive">("all");
    const [jtAddOpen, setJtAddOpen] = useState(false);
    const [jtEditOpen, setJtEditOpen] = useState(false);
    const [editingJt, setEditingJt] = useState<JobTitle | null>(null);
    // Add form
    const [jtNewName, setJtNewName] = useState("");
    const [jtNewDesc, setJtNewDesc] = useState("");
    const [jtNewDept, setJtNewDept] = useState("");
    const [jtNewIsLead, setJtNewIsLead] = useState(false);
    const [jtNewColor, setJtNewColor] = useState("#6366f1");
    // Edit form
    const [jtEditName, setJtEditName] = useState("");
    const [jtEditDesc, setJtEditDesc] = useState("");
    const [jtEditDept, setJtEditDept] = useState("");
    const [jtEditIsLead, setJtEditIsLead] = useState(false);
    const [jtEditColor, setJtEditColor] = useState("#6366f1");

    const filteredJobTitles = useMemo(() => {
        return jobTitles.filter((jt) => {
            const matchSearch = !jtSearch || jt.name.toLowerCase().includes(jtSearch.toLowerCase()) || (jt.description?.toLowerCase().includes(jtSearch.toLowerCase()));
            const matchDept = jtDeptFilter === "all" || jt.department === jtDeptFilter;
            const matchStatus = jtStatusFilter === "all" || (jtStatusFilter === "active" ? jt.isActive : !jt.isActive);
            return matchSearch && matchDept && matchStatus;
        });
    }, [jobTitles, jtSearch, jtDeptFilter, jtStatusFilter]);

    const handleAddJobTitle = () => {
        if (!jtNewName.trim()) { toast.error("Job title name is required."); return; }
        const existing = jobTitles.find((jt) => jt.name.toLowerCase() === jtNewName.trim().toLowerCase());
        if (existing) { toast.error("A job title with this name already exists."); return; }
        addJobTitle({
            name: jtNewName.trim(),
            description: jtNewDesc.trim() || undefined,
            department: jtNewDept || undefined,
            isActive: true,
            isLead: jtNewIsLead,
            color: jtNewColor,
            createdBy: currentUser.id,
        });
        toast.success(`Job title "${jtNewName.trim()}" created!`);
        setJtAddOpen(false);
        setJtNewName(""); setJtNewDesc(""); setJtNewDept(""); setJtNewIsLead(false); setJtNewColor("#6366f1");
    };

    const openEditJt = (jt: JobTitle) => {
        setEditingJt(jt);
        setJtEditName(jt.name);
        setJtEditDesc(jt.description || "");
        setJtEditDept(jt.department || "");
        setJtEditIsLead(jt.isLead);
        setJtEditColor(jt.color);
        setJtEditOpen(true);
    };

    const handleSaveEditJt = () => {
        if (!editingJt) return;
        if (!jtEditName.trim()) { toast.error("Job title name is required."); return; }
        const existing = jobTitles.find((jt) => jt.id !== editingJt.id && jt.name.toLowerCase() === jtEditName.trim().toLowerCase());
        if (existing) { toast.error("A job title with this name already exists."); return; }
        updateJobTitle(editingJt.id, {
            name: jtEditName.trim(),
            description: jtEditDesc.trim() || undefined,
            department: jtEditDept || undefined,
            isLead: jtEditIsLead,
            color: jtEditColor,
        });
        toast.success(`Job title "${jtEditName.trim()}" updated!`);
        setJtEditOpen(false);
        setEditingJt(null);
    };

    const handleDeleteJt = (jt: JobTitle) => {
        deleteJobTitle(jt.id);
        toast.success(`Job title "${jt.name}" deleted.`);
    };

    // ─── Departments Tab State ───
    const [deptSearch, setDeptSearch] = useState("");
    const [deptStatusFilter, setDeptStatusFilter] = useState<"all" | "active" | "inactive">("all");
    const [deptAddOpen, setDeptAddOpen] = useState(false);
    const [deptEditOpen, setDeptEditOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    // Add form
    const [deptNewName, setDeptNewName] = useState("");
    const [deptNewDesc, setDeptNewDesc] = useState("");
    const [deptNewHead, setDeptNewHead] = useState<string>("none");
    const [deptNewColor, setDeptNewColor] = useState("#6366f1");
    // Edit form
    const [deptEditName, setDeptEditName] = useState("");
    const [deptEditDesc, setDeptEditDesc] = useState("");
    const [deptEditHead, setDeptEditHead] = useState<string>("none");
    const [deptEditColor, setDeptEditColor] = useState("#6366f1");

    const filteredDepartments = useMemo(() => {
        return departments.filter((d) => {
            const matchSearch = !deptSearch || d.name.toLowerCase().includes(deptSearch.toLowerCase()) || (d.description?.toLowerCase().includes(deptSearch.toLowerCase()));
            const matchStatus = deptStatusFilter === "all" || (deptStatusFilter === "active" ? d.isActive : !d.isActive);
            return matchSearch && matchStatus;
        });
    }, [departments, deptSearch, deptStatusFilter]);

    const handleAddDepartment = () => {
        if (!deptNewName.trim()) { toast.error("Department name is required."); return; }
        const existing = departments.find((d) => d.name.toLowerCase() === deptNewName.trim().toLowerCase());
        if (existing) { toast.error("A department with this name already exists."); return; }
        addDepartment({
            name: deptNewName.trim(),
            description: deptNewDesc.trim() || undefined,
            headId: deptNewHead !== "none" ? deptNewHead : undefined,
            color: deptNewColor,
            isActive: true,
            createdBy: currentUser.id,
        });
        toast.success(`Department "${deptNewName.trim()}" created!`);
        setDeptAddOpen(false);
        setDeptNewName(""); setDeptNewDesc(""); setDeptNewHead("none"); setDeptNewColor("#6366f1");
    };

    const openEditDept = (d: Department) => {
        setEditingDept(d);
        setDeptEditName(d.name);
        setDeptEditDesc(d.description || "");
        setDeptEditHead(d.headId || "none");
        setDeptEditColor(d.color);
        setDeptEditOpen(true);
    };

    const handleSaveEditDept = () => {
        if (!editingDept) return;
        if (!deptEditName.trim()) { toast.error("Department name is required."); return; }
        const existing = departments.find((d) => d.id !== editingDept.id && d.name.toLowerCase() === deptEditName.trim().toLowerCase());
        if (existing) { toast.error("A department with this name already exists."); return; }
        updateDepartment(editingDept.id, {
            name: deptEditName.trim(),
            description: deptEditDesc.trim() || undefined,
            headId: deptEditHead !== "none" ? deptEditHead : undefined,
            color: deptEditColor,
        });
        toast.success(`Department "${deptEditName.trim()}" updated!`);
        setDeptEditOpen(false);
        setEditingDept(null);
    };

    const handleDeleteDept = (d: Department) => {
        deleteDepartment(d.id);
        toast.success(`Department "${d.name}" deleted.`);
    };

    // Helper to get department head name
    const getDeptHeadName = (headId?: string) => {
        if (!headId) return null;
        const emp = employees.find((e) => e.id === headId);
        return emp?.name;
    };

    const handleResetPassword = async () => {
        if (!resetPwUserId || resetPwValue.length < 6) { toast.error("Password must be at least 6 characters."); return; }
        setActionLoading(true);
        if (USE_DEMO_MODE) {
            demoAdminSetPassword(resetPwUserId, resetPwValue);
        } else {
            const result = await adminResetPassword(resetPwUserId, resetPwValue);
            if (!result.ok) { setActionLoading(false); toast.error(result.error); return; }
            await refreshAccounts();
        }
        setActionLoading(false);
        toast.success("Password reset. User will be prompted to change it on next login.");
        setResetPwUserId(null); setResetPwValue("");
    };

    const handleDeleteAccount = async (acc: DemoUserLike) => {
        setActionLoading(true);
        if (USE_DEMO_MODE) {
            demoDeleteAccount(acc.id);
        } else {
            const result = await adminDeleteAccount(acc.id);
            if (!result.ok) { setActionLoading(false); toast.error(result.error); return; }
            await refreshAccounts();
        }
        setActionLoading(false);
        toast.success(`Account for ${acc.name} deleted.`);
    };

    const filteredAccounts = useMemo(() => {
        return accounts.filter((acc) => {
            const matchSearch = !acctSearch || acc.name.toLowerCase().includes(acctSearch.toLowerCase()) || acc.email.toLowerCase().includes(acctSearch.toLowerCase());
            const matchRole = acctRoleFilter === "all" || acc.role === acctRoleFilter;
            return matchSearch && matchRole;
        });
    }, [accounts, acctSearch, acctRoleFilter]);

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
    const [newJobTitle, setNewJobTitle] = useState("");
    const [newDept, setNewDept] = useState("");
    const [newWorkType, setNewWorkType] = useState<WorkType>("WFO");
    const [newSalary, setNewSalary] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newPayFreq, setNewPayFreq] = useState<string>("company");
    const [newSystemRole, setNewSystemRole] = useState<Role>("employee");
    const [newPassword, setNewPassword] = useState("");
    const [newMustChange, setNewMustChange] = useState(true);
    const [newWorkDays, setNewWorkDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    const [newProjectId, setNewProjectId] = useState<string>("none");
    const [newBirthday, setNewBirthday] = useState("");
    const [newTeamLeader, setNewTeamLeader] = useState<string>("none");
    const [newShiftId, setNewShiftId] = useState<string>("none");
    const [newEmergencyContact, setNewEmergencyContact] = useState("");
    const [newAddress, setNewAddress] = useState("");

    const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const toggleWorkDay = (day: string) =>
        setNewWorkDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
    const toggleEditWorkDay = (day: string) =>
        setEditWorkDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);

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
    const [editJobTitle, setEditJobTitle] = useState("");
    const [editDept, setEditDept] = useState("");
    const [editWorkType, setEditWorkType] = useState<WorkType>("WFO");
    const [editSalary, setEditSalary] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editProductivity, setEditProductivity] = useState("80");
    const [editWorkDays, setEditWorkDays] = useState<string[]>(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    const [editProjectId, setEditProjectId] = useState<string>("");
    const [editPayFreq, setEditPayFreq] = useState<string>("company");
    const [editBirthday, setEditBirthday] = useState("");
    const [editTeamLeader, setEditTeamLeader] = useState<string>("none");
    const [editShiftId, setEditShiftId] = useState<string>("none");
    const [editEmergencyContact, setEditEmergencyContact] = useState("");
    const [editAddress, setEditAddress] = useState("");

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

    const [addingEmployee, setAddingEmployee] = useState(false);

    const handleAddEmployee = async () => {
        if (!canManage) { toast.error("You don't have permission to add employees"); return; }
        if (!newName || !newEmail || !newJobTitle || !newDept) { toast.error("Please fill all required fields"); return; }
        if (!newPassword || newPassword.length < 8) { toast.error("Password is required and must be at least 8 characters"); return; }
        if (employees.some((e) => e.email.toLowerCase() === newEmail.toLowerCase())) { toast.error("An employee with this email already exists"); return; }
        
        // Validate phone number format if provided
        if (newPhone) {
            const phoneResult = validatePhone(newPhone);
            if (!phoneResult.valid) {
                toast.error(phoneResult.warning || "Invalid phone number format");
                return;
            }
        }
        
        setAddingEmployee(true);
        const id = `EMP-${nanoid(6).toUpperCase()}`;
        
        // Use validated/formatted phone number
        const formattedPhone = newPhone ? validatePhone(newPhone).formatted : undefined;
        
        const addResult = addEmployee({
            id, name: newName, email: newEmail, role: newSystemRole, jobTitle: newJobTitle, department: newDept, workType: newWorkType,
            salary: Number(newSalary) || 0, joinDate: new Date().toISOString().split("T")[0], productivity: 0,
            status: "active", location: "", phone: formattedPhone,
            workDays: newWorkDays.length ? newWorkDays : undefined,
            birthday: newBirthday || undefined,
            teamLeader: newTeamLeader !== "none" ? newTeamLeader : undefined,
            shiftId: newShiftId !== "none" ? newShiftId : undefined,
            emergencyContact: newEmergencyContact || undefined,
            address: newAddress || undefined,
            ...(newPayFreq !== "company" ? { payFrequency: newPayFreq as PayFrequency } : {}),
        });
        
        if (!addResult.ok) {
            toast.error(addResult.error || "Failed to add employee");
            setAddingEmployee(false);
            return;
        }
        
        if (newPassword) {
            if (USE_DEMO_MODE) {
                const result = createAccount({ name: newName, email: newEmail, role: newSystemRole, password: newPassword, mustChangePassword: newMustChange, profileComplete: true }, currentUser.email);
                if (!result.ok) toast.warning(`Employee added but account creation failed: ${result.error}`);
                else {
                    if (result.userId) updateEmployee(id, { profileId: result.userId });
                    toast.success(`${newName} added with a login account.`);
                }
            } else {
                const result = await createUserAccount({
                    name: newName,
                    email: newEmail,
                    role: newSystemRole,
                    password: newPassword,
                    department: newDept,
                    mustChangePassword: newMustChange,
                    phone: formattedPhone,
                    birthday: newBirthday || undefined,
                    address: newAddress || undefined,
                    emergencyContact: newEmergencyContact || undefined,
                });
                if (!result.ok) toast.warning(`Employee added but account creation failed: ${result.error}`);
                else {
                    if (result.userId) updateEmployee(id, { profileId: result.userId });
                    toast.success(`${newName} added with a login account.`);
                    refreshAccounts();
                }
            }
        } else toast.success(`${newName} added successfully!`);
        if (newProjectId && newProjectId !== "none") assignToProject(newProjectId, id);
        // Sync shift assignment to attendance store
        if (newShiftId && newShiftId !== "none") assignShift(id, newShiftId);
        setNewName(""); setNewEmail(""); setNewJobTitle(""); setNewDept(""); setNewWorkType("WFO"); setNewSalary(""); setNewPhone(""); setNewPayFreq("company"); setNewSystemRole("employee"); setNewPassword(""); setNewMustChange(true); setNewWorkDays(["Mon", "Tue", "Wed", "Thu", "Fri"]); setNewProjectId("none"); setNewBirthday(""); setNewTeamLeader("none"); setNewShiftId("none"); setNewEmergencyContact(""); setNewAddress("");
        setAddOpen(false);
        setAddingEmployee(false);
    };

    const handleOpenEdit = (emp: Employee) => {
        setEditingEmp(emp); setEditName(emp.name); setEditEmail(emp.email); setEditRole(emp.role); setEditJobTitle(emp.jobTitle || ""); setEditDept(emp.department);
        setEditWorkType(emp.workType); setEditSalary(String(emp.salary)); setEditPhone(emp.phone || "");
        setEditProductivity(String(emp.productivity)); setEditPayFreq(emp.payFrequency || "company");
        setEditWorkDays(emp.workDays || ["Mon", "Tue", "Wed", "Thu", "Fri"]);
        setEditBirthday(emp.birthday || ""); setEditTeamLeader(emp.teamLeader || "none"); setEditShiftId(emp.shiftId || "none");
        setEditEmergencyContact(emp.emergencyContact || ""); setEditAddress(emp.address || "");
        const currentProject = getProjectForEmployee(emp.id);
        setEditProjectId(currentProject?.id || ""); setEditOpen(true);
    };

    const handleSaveEdit = () => {
        if (!canManage || !editingEmp) { toast.error("You don't have permission to edit employees"); return; }
        if (!editName || !editEmail || !editDept) { toast.error("Please fill all required fields"); return; }
        if (employees.some((e) => e.id !== editingEmp.id && e.email.toLowerCase() === editEmail.toLowerCase())) { toast.error("An employee with this email already exists"); return; }
        
        // Validate phone if provided
        let formattedPhone: string | undefined;
        if (editPhone) {
            const phoneResult = validatePhone(editPhone);
            if (!phoneResult.valid) {
                toast.error(phoneResult.warning || "Invalid phone format. Use +63 9XX XXX XXXX for PH mobile.");
                return;
            }
            formattedPhone = phoneResult.formatted;
        }
        
        updateEmployee(editingEmp.id, {
            name: editName, email: editEmail, role: editRole, jobTitle: editJobTitle, department: editDept, workType: editWorkType,
            salary: Number(editSalary) || 0, phone: formattedPhone,
            productivity: Number(editProductivity) || 80, payFrequency: editPayFreq !== "company" ? editPayFreq as PayFrequency : undefined,
            birthday: editBirthday || undefined,
            teamLeader: editTeamLeader !== "none" ? editTeamLeader : undefined,
            shiftId: editShiftId !== "none" ? editShiftId : undefined,
            workDays: editWorkDays.length ? editWorkDays : undefined,
            emergencyContact: editEmergencyContact || undefined,
            address: editAddress || undefined,
        });
        // Sync shift assignment to attendance store
        if (editShiftId !== "none") assignShift(editingEmp.id, editShiftId);
        else unassignShift(editingEmp.id);
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
                    {canManageRoles && <TabsTrigger value="accounts">User Accounts</TabsTrigger>}
                    {canManageRoles && <TabsTrigger value="job-titles">Job Titles</TabsTrigger>}
                    {canManageRoles && <TabsTrigger value="departments">Departments</TabsTrigger>}
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
                                                <div><label className="text-xs font-medium text-muted-foreground">Emergency Contact</label><Input value={newEmergencyContact} onChange={(e) => setNewEmergencyContact(e.target.value)} placeholder="Name / Phone" className="mt-1 h-8 text-sm" /></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><label className="text-xs font-medium text-muted-foreground">Birthday</label><Input type="date" value={newBirthday} onChange={(e) => setNewBirthday(e.target.value)} className="mt-1 h-8 text-sm" /></div>
                                                <div><label className="text-xs font-medium text-muted-foreground">Address</label><Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Home address" className="mt-1 h-8 text-sm" /></div>
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
                                                    <Select value={newJobTitle} onValueChange={(val) => { setNewJobTitle(val); const jt = jobTitles.find((j) => j.name === val); if (jt?.department) setNewDept(jt.department); }}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select job title" /></SelectTrigger><SelectContent>{jobTitles.filter((jt) => jt.isActive).map((jt) => <SelectItem key={jt.id} value={jt.name}>{jt.name}</SelectItem>)}</SelectContent></Select>
                                                </div>
                                                <div><label className="text-xs font-medium text-muted-foreground">Department <span className="text-destructive">*</span></label>
                                                    <Select value={newDept} onValueChange={setNewDept}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select dept" /></SelectTrigger><SelectContent>{departments.filter((d) => d.isActive).map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent></Select>
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
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><label className="text-xs font-medium text-muted-foreground">Team Leader</label>
                                                    <Select value={newTeamLeader} onValueChange={setNewTeamLeader}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select leader" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{[...new Map(employees.filter((e) => e.status === "active" && e.id && e.role !== "admin").map((e) => [e.id, e])).values()].map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
                                                </div>
                                                <div><label className="text-xs font-medium text-muted-foreground">Shift Schedule</label>
                                                    <Select value={newShiftId} onValueChange={setNewShiftId}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select shift" /></SelectTrigger><SelectContent><SelectItem value="none">Default</SelectItem>{shiftTemplates.filter((s) => s.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</SelectItem>)}</SelectContent></Select>
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
                                            <span className="ml-auto text-[10px] font-semibold text-red-500">* required</span>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            {newPassword && newPassword.length >= 8 ? (
                                                <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                                                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" /><span>Account will be created — employee can log in immediately after being added.</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-800 dark:text-red-300">
                                                    <KeyRound className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>Password is <strong>required</strong> (minimum 8 characters). Set a password or generate one below.</span>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><label className="text-xs font-medium text-muted-foreground">System Role</label>
                                                    <Select value={newSystemRole} onValueChange={(v) => setNewSystemRole(v as Role)}><SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="employee">Employee</SelectItem><SelectItem value="supervisor">Supervisor</SelectItem><SelectItem value="hr">HR</SelectItem><SelectItem value="finance">Finance</SelectItem><SelectItem value="payroll_admin">Payroll Admin</SelectItem><SelectItem value="auditor">Auditor</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select>
                                                </div>
                                                <div><label className="text-xs font-medium text-muted-foreground">Initial Password <span className="text-red-500">*</span></label>
                                                    <div className="flex gap-1.5 mt-1">
                                                        <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" className={`h-8 text-sm font-mono ${!newPassword || newPassword.length < 8 ? "border-red-300 focus-visible:ring-red-500" : ""}`} />
                                                        <button type="button" onClick={generatePassword} title="Generate random password" className="shrink-0 rounded-md border h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><RefreshCw className="h-3.5 w-3.5" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`flex items-center justify-between rounded-md border px-3 py-2 transition-colors ${newPassword && newPassword.length >= 8 ? "bg-background" : "bg-muted/30 opacity-50"}`}>
                                                <div><p className="text-xs font-medium">Require password change on first login</p><p className="text-[11px] text-muted-foreground">Prompts employee to set their own password</p></div>
                                                <Switch checked={newMustChange} onCheckedChange={setNewMustChange} disabled={!newPassword || newPassword.length < 8} />
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
                                                    {projects.filter((p) => p.status !== "completed" && p.id).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
                                    <Button onClick={handleAddEmployee} disabled={addingEmployee || !newPassword || newPassword.length < 8} className="gap-1.5 h-8 text-sm"><Plus className="h-3.5 w-3.5" /> {addingEmployee ? "Adding…" : "Add Employee"}</Button>
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
                                    <div><label className="text-sm font-medium">Job Title</label>
                                        <Select value={editJobTitle} onValueChange={setEditJobTitle}><SelectTrigger className="mt-1"><SelectValue placeholder="Select job title" /></SelectTrigger><SelectContent>{jobTitles.filter((jt) => jt.isActive).map((jt) => <SelectItem key={jt.id} value={jt.name}>{jt.name}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div><label className="text-sm font-medium">Department *</label>
                                        <Select value={editDept} onValueChange={setEditDept}><SelectTrigger className="mt-1"><SelectValue placeholder="Select dept" /></SelectTrigger><SelectContent>{departments.filter((d) => d.isActive).map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-sm font-medium">System Role</label>
                                        <Select value={editRole} onValueChange={setEditRole}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="employee">Employee</SelectItem><SelectItem value="supervisor">Supervisor</SelectItem><SelectItem value="hr">HR</SelectItem><SelectItem value="finance">Finance</SelectItem><SelectItem value="payroll_admin">Payroll Admin</SelectItem><SelectItem value="auditor">Auditor</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select>
                                    </div>
                                    <div className="flex items-end"><p className="text-xs text-muted-foreground pb-2">Controls what pages and features this employee can access.</p></div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div><label className="text-sm font-medium">Work Type</label>
                                        <Select value={editWorkType} onValueChange={(v) => setEditWorkType(v as WorkType)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WFO">Work From Office</SelectItem><SelectItem value="WFH">Work From Home</SelectItem><SelectItem value="HYBRID">Hybrid</SelectItem><SelectItem value="ONSITE">Full Onsite</SelectItem></SelectContent></Select>
                                    </div>
                                    <div><label className="text-sm font-medium">Monthly Salary (₱)</label><Input type="number" value={editSalary} onChange={(e) => setEditSalary(e.target.value)} className="mt-1" /></div>
                                    <div><label className="text-sm font-medium">Pay Frequency</label>
                                        <Select value={editPayFreq} onValueChange={setEditPayFreq}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="company">Company Default ({paySchedule.defaultFrequency.replace("_", "-")})</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="semi_monthly">Semi-Monthly</SelectItem><SelectItem value="bi_weekly">Bi-Weekly</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent></Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-sm font-medium">Phone</label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="mt-1" /></div>
                                    <div><label className="text-sm font-medium">Emergency Contact</label><Input value={editEmergencyContact} onChange={(e) => setEditEmergencyContact(e.target.value)} placeholder="Name / Phone" className="mt-1" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-sm font-medium">Productivity (%)</label><Input type="number" min="0" max="100" value={editProductivity} onChange={(e) => setEditProductivity(e.target.value)} className="mt-1" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-sm font-medium">Team Leader</label>
                                        <Select value={editTeamLeader} onValueChange={setEditTeamLeader}><SelectTrigger className="mt-1"><SelectValue placeholder="Select leader" /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{[...new Map(employees.filter((e) => e.status === "active" && e.id !== editingEmp?.id && e.id && e.role !== "admin").map((e) => [e.id, e])).values()].map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
                                    </div>
                                    <div><label className="text-sm font-medium">Shift Schedule</label>
                                        <Select value={editShiftId} onValueChange={setEditShiftId}><SelectTrigger className="mt-1"><SelectValue placeholder="Select shift" /></SelectTrigger><SelectContent><SelectItem value="none">Default</SelectItem>{shiftTemplates.filter((s) => s.id).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</SelectItem>)}</SelectContent></Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-sm font-medium">Address</label><Input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Home address" className="mt-1" /></div>
                                    <div><label className="text-sm font-medium">Birthday</label><Input type="date" value={editBirthday} onChange={(e) => setEditBirthday(e.target.value)} className="mt-1" /></div>
                                </div>
                                {/* Work Days */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium">Work Days</label>
                                        <div className="flex items-center gap-1">
                                            {[{ label: "Mon–Fri", days: ["Mon","Tue","Wed","Thu","Fri"] }, { label: "Mon–Sat", days: ["Mon","Tue","Wed","Thu","Fri","Sat"] }, { label: "All 7", days: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] }].map(({ label, days }) => (
                                                <button key={label} type="button" onClick={() => setEditWorkDays(days)} className="px-2 py-0.5 text-[10px] font-medium rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">{label}</button>
                                            ))}
                                            <button type="button" onClick={() => setEditWorkDays([])} className="px-2 py-0.5 text-[10px] font-medium rounded border border-dashed border-muted-foreground/30 text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors">Clear</button>
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {WEEK_DAYS.map((day) => (
                                            <button key={day} type="button" onClick={() => toggleEditWorkDay(day)} className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-all ${editWorkDays.includes(day) ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"}`}>{day}</button>
                                        ))}
                                    </div>
                                    {editWorkDays.length > 0 && <p className="text-[11px] text-muted-foreground mt-1.5">{editWorkDays.length} day{editWorkDays.length !== 1 ? "s" : ""} selected &mdash; {editWorkDays.join(", ")}</p>}
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Assigned Project</label>
                                    <Select value={editProjectId || "none"} onValueChange={setEditProjectId}><SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger><SelectContent><SelectItem value="none">No Project</SelectItem>{projects.filter(p => p.status !== "completed" && p.id).map((p) => <SelectItem key={p.id} value={p.id}>{p.name} {p.assignedEmployeeIds.includes(editingEmp?.id || "") ? "✓" : ""}</SelectItem>)}</SelectContent></Select>
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
                                    <SheetTrigger asChild>
                                        <Button variant="outline" size="sm" className="gap-1.5 relative">
                                            <SlidersHorizontal className="h-4 w-4" />
                                            Advanced
                                            {(() => {
                                                const count = [
                                                    departmentFilter !== "all",
                                                    salaryRange[0] > 0 || salaryRange[1] < 200000,
                                                    Object.values(visibleCols).some((v) => !v),
                                                ].filter(Boolean).length;
                                                return count > 0 ? (
                                                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                                                        {count}
                                                    </span>
                                                ) : null;
                                            })()}
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent className="w-[320px] sm:w-[360px] flex flex-col gap-0 p-0">
                                        {/* Header */}
                                        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                                            <div>
                                                <SheetTitle className="text-base font-semibold">Advanced Filters</SheetTitle>
                                                <p className="text-xs text-muted-foreground mt-0.5">Narrow down the employee list</p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                                                onClick={() => {
                                                    setDepartmentFilter("all");
                                                    setSalaryRange([0, 200000]);
                                                    setVisibleCols({ id: true, name: true, status: true, role: true, department: false, project: true, teamLeader: true, productivity: true, joinDate: true, salary: true, workType: true });
                                                }}
                                            >
                                                Reset all
                                            </Button>
                                        </div>

                                        {/* Scrollable body */}
                                        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

                                            {/* Department */}
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Department</p>
                                                <Select value={departmentFilter} onValueChange={(v) => { setDepartmentFilter(v); setPage(1); }}>
                                                    <SelectTrigger className="h-9 text-sm">
                                                        <SelectValue placeholder="All Departments" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Departments</SelectItem>
                                                        {departments.filter((d) => d.isActive).map((d) => (
                                                            <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="h-px bg-border" />

                                            {/* Salary Range */}
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly Salary</p>
                                                    {(salaryRange[0] > 0 || salaryRange[1] < 200000) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSalaryRange([0, 200000])}
                                                            className="text-[10px] text-primary hover:underline"
                                                        >
                                                            Clear
                                                        </button>
                                                    )}
                                                </div>
                                                <Slider
                                                    min={0} max={200000} step={5000}
                                                    value={salaryRange}
                                                    onValueChange={setSalaryRange}
                                                    className="mb-3"
                                                />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                                                        <p className="text-[10px] text-muted-foreground mb-0.5">Min</p>
                                                        <p className="text-sm font-medium">{formatCurrency(salaryRange[0])}</p>
                                                    </div>
                                                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
                                                        <p className="text-[10px] text-muted-foreground mb-0.5">Max</p>
                                                        <p className="text-sm font-medium">{formatCurrency(salaryRange[1])}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-px bg-border" />

                                            {/* Visible Columns */}
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visible Columns</p>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {Object.values(visibleCols).filter(Boolean).length}/{Object.keys(visibleCols).length}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                                    {Object.keys(visibleCols).map((col) => (
                                                        <label
                                                            key={col}
                                                            className="flex items-center gap-2 text-sm cursor-pointer group select-none"
                                                        >
                                                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${visibleCols[col] ? "bg-primary border-primary" : "border-border bg-background group-hover:border-primary/50"}`}
                                                                onClick={() => setVisibleCols({ ...visibleCols, [col]: !visibleCols[col] })}
                                                            >
                                                                {visibleCols[col] && (
                                                                    <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                                                                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                                                    </svg>
                                                                )}
                                                            </span>
                                                            <span className={`text-sm ${visibleCols[col] ? "text-foreground" : "text-muted-foreground"}`}>
                                                                {col.charAt(0).toUpperCase() + col.slice(1).replace(/([A-Z])/g, " $1")}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div className="px-5 py-4 border-t border-border">
                                            <p className="text-xs text-muted-foreground text-center">
                                                {filtered.length} employee{filtered.length !== 1 ? "s" : ""} match current filters
                                            </p>
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Mobile Card View */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                        {paginated.map((emp) => {
                            const assignedProject = getProjectForEmployee(emp.id);
                            return (
                                <Card key={emp.id} className="border border-border/50">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarFallback className="text-xs bg-muted">{getInitials(emp.name)}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate">{emp.name}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                                                </div>
                                            </div>
                                            <Badge variant="secondary" className={`shrink-0 text-[10px] ${emp.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : emp.status === "resigned" ? "bg-orange-500/15 text-orange-700 dark:text-orange-400" : "bg-red-500/15 text-red-700 dark:text-red-400"}`}>
                                                {emp.status}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                            <div><span className="text-muted-foreground">Role:</span> <span className="font-medium">{emp.role}</span></div>
                                            <div><span className="text-muted-foreground">Dept:</span> <span className="font-medium">{emp.department}</span></div>
                                            <div><span className="text-muted-foreground">Type:</span> <Badge variant="outline" className="text-[10px] ml-1">{emp.workType}</Badge></div>
                                            <div><span className="text-muted-foreground">Salary:</span> <span className="font-medium">{formatCurrency(emp.salary)}</span></div>
                                            {assignedProject && <div className="col-span-2"><span className="text-muted-foreground">Project:</span> <Badge variant="outline" className="text-[10px] ml-1 bg-blue-500/10 text-blue-700 dark:text-blue-400">{assignedProject.name}</Badge></div>}
                                        </div>
                                        <div className="mt-3 pt-3 border-t flex items-center justify-between gap-2">
                                            <Link href={rh(`/employees/${emp.id}`)} className="flex-1">
                                                <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5">
                                                    <Eye className="h-3.5 w-3.5" /> View
                                                </Button>
                                            </Link>
                                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={!canManage} onClick={() => handleOpenEdit(emp)}>
                                                <Pencil className="h-3.5 w-3.5" /> Edit
                                            </Button>
                                            <Button variant={emp.status === "active" ? "destructive" : "default"} size="sm" className="h-8 text-xs" disabled={!canManage} onClick={() => { if (!canManage) return; toggleStatus(emp.id); toast.success(`${emp.name} ${emp.status === "active" ? "deactivated" : "activated"}`); }}>
                                                {emp.status === "active" ? "Deactivate" : "Activate"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Desktop Table */}
                    <Card className="border border-border/50 hidden md:block">
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
                                                            {canManage && emp.id !== currentUser.id && (
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-500/10" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader><AlertDialogTitle>Delete Employee</AlertDialogTitle><AlertDialogDescription>Are you sure you want to permanently remove <strong>{emp.name}</strong>{emp.status === "active" ? " (currently active)" : ""}? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { removeEmployee(emp.id); useAuditStore.getState().log({ entityType: "employee", entityId: emp.id, action: "employee_deleted", performedBy: currentUser.id }); toast.success(`${emp.name} removed`); }}>Delete</AlertDialogAction>
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
                        <Select value={dirDept} onValueChange={setDirDept}><SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem>{departments.filter((d) => d.isActive).map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent></Select>
                        <Select value={dirStatus} onValueChange={setDirStatus}><SelectTrigger className="w-full sm:w-[130px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
                        {dirFiltered.map((emp) => (
                            <div key={emp.id} className="relative h-full">
                                <Link href={rh(`/employees/${emp.id}`)} className="block h-full">
                                    <Card className="border border-border/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group h-full flex flex-col">
                                        <CardContent className="p-5 flex flex-col flex-1">
                                            {/* Header */}
                                            <div className="flex items-start gap-3">
                                                <Avatar className="h-12 w-12 shrink-0"><AvatarFallback className="bg-primary/10 text-primary font-semibold">{getInitials(emp.name)}</AvatarFallback></Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{emp.name}</h3>
                                                        <Badge variant="secondary" className={`text-[9px] shrink-0 ${emp.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-700 dark:text-red-400"}`}>{emp.status}</Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{emp.role}</p>
                                                </div>
                                            </div>
                                            {/* Fixed-height info rows — always rendered for uniform card size */}
                                            <div className="mt-4 flex-1 flex flex-col gap-2">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{emp.email}</span></div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5 shrink-0" /><span className="text-muted-foreground/60">{emp.phone || "—"}</span></div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="text-muted-foreground/60">{emp.location || "—"}</span></div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Cake className="h-3.5 w-3.5 shrink-0" /><span className="text-muted-foreground/60">{emp.birthday ? new Date(emp.birthday).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</span></div>
                                            </div>
                                            {/* Salary footer — always at bottom */}
                                            {canSetSalary && (
                                                <div className="flex items-center justify-between pt-3 border-t border-border/40 mt-3">
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <DollarSign className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                        <span className="font-mono font-medium text-foreground">{formatCurrency(emp.salary)}<span className="text-muted-foreground font-normal">/mo</span></span>
                                                    </div>
                                                    <button onClick={(e) => openSalaryDialog(e, emp.id, emp.salary)} className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                                                        <Pencil className="h-2.5 w-2.5" /> {isHR ? "Propose" : "Set"}
                                                    </button>
                                                </div>
                                            )}
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

                {/* ─── User Accounts Tab ─── */}
                {canManageRoles && (
                <TabsContent value="accounts" className="mt-4 space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <p className="text-sm text-muted-foreground">{accounts.length} registered account{accounts.length !== 1 ? "s" : ""}</p>
                        </div>
                    </div>

                    {/* Filters */}
                    <Card className="border border-border/50">
                        <CardContent className="p-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search by name or email..." className="pl-9" value={acctSearch} onChange={(e) => setAcctSearch(e.target.value)} />
                                </div>
                                <Select value={acctRoleFilter} onValueChange={setAcctRoleFilter}>
                                    <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="All Roles" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Roles</SelectItem>
                                        {(["admin","hr","finance","employee","supervisor","payroll_admin","auditor"] as Role[]).map((r) => (
                                            <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {!USE_DEMO_MODE && (
                                    <Button variant="outline" size="sm" className="gap-1.5" onClick={refreshAccounts} disabled={accountsLoading}>
                                        <RefreshCw className={`h-3.5 w-3.5 ${accountsLoading ? "animate-spin" : ""}`} /> Refresh
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Accounts Table */}
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            {accountsLoading ? (
                                <div className="flex items-center justify-center py-16 text-muted-foreground">
                                    <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading accounts...
                                </div>
                            ) : filteredAccounts.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                    <Users className="h-10 w-10 mb-3 opacity-30" />
                                    <p className="text-sm font-medium">No accounts found</p>
                                    <p className="text-xs mt-1">Add an employee with a password to create their login account.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs">User</TableHead>
                                                <TableHead className="text-xs">Role</TableHead>
                                                <TableHead className="text-xs">Status</TableHead>
                                                {!USE_DEMO_MODE && <TableHead className="text-xs">Created</TableHead>}
                                                <TableHead className="text-xs w-32 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredAccounts.map((acc) => {
                                                const roleColors: Record<string, string> = {
                                                    admin: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
                                                    hr: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
                                                    finance: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
                                                    supervisor: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
                                                    payroll_admin: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800",
                                                    auditor: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
                                                    employee: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
                                                };
                                                return (
                                                    <TableRow key={acc.id} className="group">
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-9 w-9">
                                                                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{getInitials(acc.name)}</AvatarFallback>
                                                                </Avatar>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium truncate">{acc.name}</p>
                                                                    <p className="text-xs text-muted-foreground truncate">{acc.email}</p>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={`text-[10px] capitalize ${roleColors[acc.role] || ""}`}>
                                                                {acc.role.replace("_", " ")}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {acc.mustChangePassword && (
                                                                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                                                                        <KeyRound className="h-2.5 w-2.5 mr-0.5" /> pw reset
                                                                    </Badge>
                                                                )}
                                                                {!acc.mustChangePassword && (
                                                                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 dark:text-emerald-400 dark:border-emerald-700">
                                                                        <ShieldCheck className="h-2.5 w-2.5 mr-0.5" /> active
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        {!USE_DEMO_MODE && (
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {acc.createdAt ? formatDate(acc.createdAt.split("T")[0]) : "—"}
                                                            </TableCell>
                                                        )}
                                                        <TableCell>
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Reset password"
                                                                    onClick={() => { setResetPwUserId(acc.id); setResetPwValue(""); }}>
                                                                    <KeyRound className="h-3.5 w-3.5" />
                                                                </Button>
                                                                {acc.id !== currentUser.id && (
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Delete account">
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader>
                                                                                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                                                                                <AlertDialogDescription>
                                                                                    Are you sure you want to permanently delete the account for <strong>{acc.name}</strong> ({acc.email})?
                                                                                    This will remove their login access and linked employee record.
                                                                                </AlertDialogDescription>
                                                                            </AlertDialogHeader>
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                                    onClick={() => handleDeleteAccount(acc)} disabled={actionLoading}>
                                                                                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                                                                                </AlertDialogAction>
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
                            )}
                        </CardContent>
                    </Card>

                    {/* Info Card */}
                    <Card className="border border-blue-500/20 bg-blue-500/5">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">How account creation works</p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        To create a login account for an employee, use the <strong>&quot;Add Employee&quot;</strong> button in the Employee Management tab.
                                        Fill in the <strong>Login Account</strong> section with a system role and password.
                                        The employee will then appear here with their account details.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                )}

                {/* ─── Job Titles Tab ─── */}
                {canManageRoles && (
                <TabsContent value="job-titles" className="mt-4 space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <p className="text-sm text-muted-foreground">{filteredJobTitles.length} job title{filteredJobTitles.length !== 1 ? "s" : ""} found</p>
                        </div>
                        <Dialog open={jtAddOpen} onOpenChange={setJtAddOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-1.5"><Plus className="h-4 w-4" /> Add Job Title</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                                <DialogHeader><DialogTitle>Add New Job Title</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div><label className="text-sm font-medium">Name <span className="text-destructive">*</span></label><Input value={jtNewName} onChange={(e) => setJtNewName(e.target.value)} placeholder="e.g. Senior Developer" className="mt-1" /></div>
                                    <div><label className="text-sm font-medium">Description</label><Input value={jtNewDesc} onChange={(e) => setJtNewDesc(e.target.value)} placeholder="Brief description of the role" className="mt-1" /></div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-sm font-medium">Department</label>
                                            <Select value={jtNewDept} onValueChange={setJtNewDept}><SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{departments.filter((d) => d.isActive).map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent></Select>
                                        </div>
                                        <div><label className="text-sm font-medium">Color</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Input type="color" value={jtNewColor} onChange={(e) => setJtNewColor(e.target.value)} className="w-12 h-9 p-1 cursor-pointer" />
                                                <Input value={jtNewColor} onChange={(e) => setJtNewColor(e.target.value)} className="flex-1 font-mono text-xs" placeholder="#6366f1" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg border p-3">
                                        <div>
                                            <p className="text-sm font-medium">Leadership Role</p>
                                            <p className="text-xs text-muted-foreground">Mark if this is a lead/manager position</p>
                                        </div>
                                        <Switch checked={jtNewIsLead} onCheckedChange={setJtNewIsLead} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setJtAddOpen(false)}>Cancel</Button>
                                    <Button onClick={handleAddJobTitle}>Create Job Title</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Filters */}
                    <Card className="border border-border/50">
                        <CardContent className="p-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search by name or description..." className="pl-9" value={jtSearch} onChange={(e) => setJtSearch(e.target.value)} />
                                </div>
                                <Select value={jtDeptFilter} onValueChange={setJtDeptFilter}>
                                    <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Departments</SelectItem>
                                        {departments.filter((d) => d.isActive).map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={jtStatusFilter} onValueChange={(v) => setJtStatusFilter(v as "all" | "active" | "inactive")}>
                                    <SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Job Titles Table */}
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            {filteredJobTitles.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                    <Tag className="h-10 w-10 mb-3 opacity-30" />
                                    <p className="text-sm font-medium">No job titles found</p>
                                    <p className="text-xs mt-1">Create your first job title to get started.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs w-10"></TableHead>
                                                <TableHead className="text-xs">Name</TableHead>
                                                <TableHead className="text-xs">Department</TableHead>
                                                <TableHead className="text-xs">Type</TableHead>
                                                <TableHead className="text-xs">Status</TableHead>
                                                <TableHead className="text-xs w-32 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredJobTitles.map((jt) => (
                                                <TableRow key={jt.id} className="group">
                                                    <TableCell>
                                                        <div className="w-4 h-4 rounded" style={{ backgroundColor: jt.color }} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium truncate flex items-center gap-1.5">
                                                                {jt.name}
                                                                {jt.isLead && <span title="Leadership role"><Crown className="h-3.5 w-3.5 text-amber-500" /></span>}
                                                            </p>
                                                            {jt.description && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{jt.description}</p>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {jt.department ? (
                                                            <Badge variant="outline" className="text-[10px]">{jt.department}</Badge>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={jt.isLead ? "default" : "secondary"} className="text-[10px]">
                                                            {jt.isLead ? "Lead" : "Individual"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={jt.isActive ? "default" : "outline"} className={`text-[10px] ${jt.isActive ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "text-muted-foreground"}`}>
                                                            {jt.isActive ? "Active" : "Inactive"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Edit" onClick={() => openEditJt(jt)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className={`h-7 w-7 ${jt.isActive ? "text-muted-foreground hover:text-amber-600" : "text-amber-600 hover:text-emerald-600"}`} title={jt.isActive ? "Deactivate" : "Activate"} onClick={() => toggleJobTitleActive(jt.id)}>
                                                                {jt.isActive ? <UserMinus className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Delete">
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Delete Job Title</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Are you sure you want to delete <strong>{jt.name}</strong>?
                                                                            This action cannot be undone. Employees with this job title will not be affected.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteJt(jt)}>
                                                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Info Card */}
                    <Card className="border border-violet-500/20 bg-violet-500/5">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <Tag className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-violet-700 dark:text-violet-400">About Job Titles</p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        Job titles define employee positions within your organization. They are separate from <strong>System Roles</strong> (admin, hr, employee, etc.) which control access permissions.
                                        Mark leadership positions with the &quot;Lead&quot; badge to distinguish managers and supervisors.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                )}

                {/* ─── Departments Tab ─── */}
                {canManageRoles && (
                <TabsContent value="departments" className="mt-4 space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <p className="text-sm text-muted-foreground">{filteredDepartments.length} department{filteredDepartments.length !== 1 ? "s" : ""} found</p>
                        </div>
                        <Dialog open={deptAddOpen} onOpenChange={setDeptAddOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-1.5"><Plus className="h-4 w-4" /> Add Department</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                                <DialogHeader><DialogTitle>Add New Department</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div><label className="text-sm font-medium">Name <span className="text-destructive">*</span></label><Input value={deptNewName} onChange={(e) => setDeptNewName(e.target.value)} placeholder="e.g. Engineering" className="mt-1" /></div>
                                    <div><label className="text-sm font-medium">Description</label><Input value={deptNewDesc} onChange={(e) => setDeptNewDesc(e.target.value)} placeholder="Brief description of the department" className="mt-1" /></div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-sm font-medium">Department Head</label>
                                            <Select value={deptNewHead} onValueChange={setDeptNewHead}><SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{employees.filter((e) => e.status === "active").map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
                                        </div>
                                        <div><label className="text-sm font-medium">Color</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Input type="color" value={deptNewColor} onChange={(e) => setDeptNewColor(e.target.value)} className="w-12 h-9 p-1 cursor-pointer" />
                                                <Input value={deptNewColor} onChange={(e) => setDeptNewColor(e.target.value)} className="flex-1 font-mono text-xs" placeholder="#6366f1" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDeptAddOpen(false)}>Cancel</Button>
                                    <Button onClick={handleAddDepartment}>Create Department</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Filters */}
                    <Card className="border border-border/50">
                        <CardContent className="p-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Search by name or description..." className="pl-9" value={deptSearch} onChange={(e) => setDeptSearch(e.target.value)} />
                                </div>
                                <Select value={deptStatusFilter} onValueChange={(v) => setDeptStatusFilter(v as "all" | "active" | "inactive")}>
                                    <SelectTrigger className="w-full sm:w-[130px]"><SelectValue placeholder="All Status" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Departments Table */}
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            {filteredDepartments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                    <Building2 className="h-10 w-10 mb-3 opacity-30" />
                                    <p className="text-sm font-medium">No departments found</p>
                                    <p className="text-xs mt-1">Create your first department to get started.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs w-10"></TableHead>
                                                <TableHead className="text-xs">Name</TableHead>
                                                <TableHead className="text-xs">Head</TableHead>
                                                <TableHead className="text-xs">Employees</TableHead>
                                                <TableHead className="text-xs">Status</TableHead>
                                                <TableHead className="text-xs w-32 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredDepartments.map((d) => {
                                                const empCount = employees.filter((e) => e.department === d.name && e.status === "active").length;
                                                const headName = getDeptHeadName(d.headId);
                                                return (
                                                    <TableRow key={d.id} className="group">
                                                        <TableCell>
                                                            <div className="w-4 h-4 rounded" style={{ backgroundColor: d.color }} />
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium truncate">{d.name}</p>
                                                                {d.description && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{d.description}</p>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {headName ? (
                                                                <div className="flex items-center gap-2">
                                                                    <Avatar className="h-6 w-6">
                                                                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(headName)}</AvatarFallback>
                                                                    </Avatar>
                                                                    <span className="text-sm truncate">{headName}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">—</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary" className="text-[10px]">{empCount} active</Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={d.isActive ? "default" : "outline"} className={`text-[10px] ${d.isActive ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "text-muted-foreground"}`}>
                                                                {d.isActive ? "Active" : "Inactive"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Edit" onClick={() => openEditDept(d)}>
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className={`h-7 w-7 ${d.isActive ? "text-muted-foreground hover:text-amber-600" : "text-amber-600 hover:text-emerald-600"}`} title={d.isActive ? "Deactivate" : "Activate"} onClick={() => toggleDeptActive(d.id)}>
                                                                    {d.isActive ? <UserMinus className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                                                                </Button>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Delete">
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Delete Department</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                Are you sure you want to delete <strong>{d.name}</strong>?
                                                                                This action cannot be undone. Employees in this department will not be affected.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteDept(d)}>
                                                                                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                                                                            </AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Info Card */}
                    <Card className="border border-cyan-500/20 bg-cyan-500/5">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                    <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">About Departments</p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        Departments organize employees into functional teams. Assign a <strong>Department Head</strong> to designate leadership.
                                        Deactivated departments won&apos;t appear in dropdowns but existing employee assignments remain intact.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                )}
            </Tabs>

            {/* Edit Job Title Dialog */}
            <Dialog open={jtEditOpen} onOpenChange={(o) => { if (!o) { setJtEditOpen(false); setEditingJt(null); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Edit Job Title</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div><label className="text-sm font-medium">Name <span className="text-destructive">*</span></label><Input value={jtEditName} onChange={(e) => setJtEditName(e.target.value)} placeholder="e.g. Senior Developer" className="mt-1" /></div>
                        <div><label className="text-sm font-medium">Description</label><Input value={jtEditDesc} onChange={(e) => setJtEditDesc(e.target.value)} placeholder="Brief description of the role" className="mt-1" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium">Department</label>
                                <Select value={jtEditDept || "none"} onValueChange={(v) => setJtEditDept(v === "none" ? "" : v)}><SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{departments.filter((d) => d.isActive).map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <div><label className="text-sm font-medium">Color</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Input type="color" value={jtEditColor} onChange={(e) => setJtEditColor(e.target.value)} className="w-12 h-9 p-1 cursor-pointer" />
                                    <Input value={jtEditColor} onChange={(e) => setJtEditColor(e.target.value)} className="flex-1 font-mono text-xs" placeholder="#6366f1" />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <p className="text-sm font-medium">Leadership Role</p>
                                <p className="text-xs text-muted-foreground">Mark if this is a lead/manager position</p>
                            </div>
                            <Switch checked={jtEditIsLead} onCheckedChange={setJtEditIsLead} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setJtEditOpen(false); setEditingJt(null); }}>Cancel</Button>
                        <Button onClick={handleSaveEditJt}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Department Dialog */}
            <Dialog open={deptEditOpen} onOpenChange={(o) => { if (!o) { setDeptEditOpen(false); setEditingDept(null); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Edit Department</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div><label className="text-sm font-medium">Name <span className="text-destructive">*</span></label><Input value={deptEditName} onChange={(e) => setDeptEditName(e.target.value)} placeholder="e.g. Engineering" className="mt-1" /></div>
                        <div><label className="text-sm font-medium">Description</label><Input value={deptEditDesc} onChange={(e) => setDeptEditDesc(e.target.value)} placeholder="Brief description of the department" className="mt-1" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium">Department Head</label>
                                <Select value={deptEditHead} onValueChange={setDeptEditHead}><SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem>{employees.filter((e) => e.status === "active").map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <div><label className="text-sm font-medium">Color</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Input type="color" value={deptEditColor} onChange={(e) => setDeptEditColor(e.target.value)} className="w-12 h-9 p-1 cursor-pointer" />
                                    <Input value={deptEditColor} onChange={(e) => setDeptEditColor(e.target.value)} className="flex-1 font-mono text-xs" placeholder="#6366f1" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setDeptEditOpen(false); setEditingDept(null); }}>Cancel</Button>
                        <Button onClick={handleSaveEditDept}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

            {/* Reset Password Dialog */}
            <Dialog open={!!resetPwUserId} onOpenChange={(o) => { if (!o) { setResetPwUserId(null); setResetPwValue(""); } }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-1">
                        <p className="text-sm text-muted-foreground">Set a new temporary password for <strong>{accounts.find((a) => a.id === resetPwUserId)?.name}</strong>. They will be prompted to change it on next login.</p>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">New Password *</label>
                            <Input type="password" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)} placeholder="Minimum 6 characters" />
                        </div>
                        <div className="flex gap-2 pt-1">
                            <Button variant="outline" className="flex-1" onClick={() => { setResetPwUserId(null); setResetPwValue(""); }}>Cancel</Button>
                            <Button className="flex-1" onClick={handleResetPassword} disabled={actionLoading}>
                                <KeyRound className="w-4 h-4 mr-1.5" /> Reset
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
