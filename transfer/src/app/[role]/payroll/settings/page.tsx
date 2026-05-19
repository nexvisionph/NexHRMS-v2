"use client";

import { useEffect, useState, useMemo } from "react";
import { useDeductionsStore } from "@/store/deductions.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useProjectsStore } from "@/store/projects.store";
import { useDepartmentsStore } from "@/store/departments.store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { PayScheduleSettings } from "@/components/payroll/pay-schedule-settings";
import { Plus, Trash2, Edit, Settings, Users, Calculator, CalendarDays, ArrowLeft, Layers } from "lucide-react";
import { toast } from "sonner";
import type { DeductionTemplateType, DeductionCalculationMode, DeductionTemplate, EmployeeDeductionAssignment, Employee, Role, Department, Project } from "@/types";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";
import { useParams } from "next/navigation";

// Available roles from database CHECK constraint
const AVAILABLE_ROLES: Role[] = ["admin", "hr", "finance", "employee", "supervisor", "payroll_admin", "auditor"];

/* ═══════════════════════════════════════════════════════════════
   PAYROLL SETTINGS PAGE
   Tabs: Pay Schedule | Custom Deductions | Employee Assignments
   ═══════════════════════════════════════════════════════════════ */

export default function PayrollSettingsPage() {
    const params = useParams();
    const role = params.role as string;

    const { templates, assignments, isLoading, error, fetchTemplates, addTemplate, updateTemplate, deleteTemplate, fetchAssignments, assignToEmployee, unassignFromEmployee, bulkAssignToEmployees } = useDeductionsStore();
    const { paySchedule, updatePaySchedule } = usePayrollStore();
    const employees = useEmployeesStore((s) => s.employees);
    const projects = useProjectsStore((s) => s.projects);
    const departments = useDepartmentsStore((s) => s.departments);

    useEffect(() => { fetchTemplates(); fetchAssignments(); }, [fetchTemplates, fetchAssignments]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link href={`/${role}/payroll`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Settings className="h-6 w-6" /> Payroll Settings
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Configure pay schedule, custom deductions &amp; employee assignments</p>
                </div>
            </div>

            {error && (
                <Card className="border border-red-300 bg-red-50 dark:bg-red-950/20">
                    <CardContent className="p-3 text-sm text-red-700 dark:text-red-300">{error}</CardContent>
                </Card>
            )}

            <Tabs defaultValue="deductions">
                <TabsList>
                    <TabsTrigger value="deductions" className="gap-1.5"><Calculator className="h-3.5 w-3.5" /> Custom Deductions</TabsTrigger>
                    <TabsTrigger value="assignments" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Employee Assignments</TabsTrigger>
                    <TabsTrigger value="schedule" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Pay Schedule</TabsTrigger>
                </TabsList>

                {/* ─── Custom Deductions Tab ─────────────────────────── */}
                <TabsContent value="deductions" className="mt-4">
                    <DeductionTemplatesTab
                        templates={templates}
                        departments={departments}
                        projects={projects}
                        isLoading={isLoading}
                        onAdd={addTemplate}
                        onUpdate={updateTemplate}
                        onDelete={deleteTemplate}
                    />
                </TabsContent>

                {/* ─── Employee Assignments Tab ──────────────────────── */}
                <TabsContent value="assignments" className="mt-4">
                    <EmployeeAssignmentsTab
                        templates={templates}
                        assignments={assignments}
                        employees={employees}
                        projects={projects}
                        isLoading={isLoading}
                        onAssign={assignToEmployee}
                        onUnassign={unassignFromEmployee}
                        onBulkAssign={bulkAssignToEmployees}
                    />
                </TabsContent>

                {/* ─── Pay Schedule Tab ──────────────────────────────── */}
                <TabsContent value="schedule" className="mt-4">
                    <PayScheduleSettings schedule={paySchedule} onUpdate={updatePaySchedule} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   DEDUCTION TEMPLATES CRUD TAB
   ═══════════════════════════════════════════════════════════════ */

// Special value for "None" selection in dropdowns
const NONE_VALUE = "__none__";

function DeductionTemplatesTab({
    templates,
    departments,
    projects,
    isLoading,
    onAdd,
    onUpdate,
    onDelete,
}: {
    templates: DeductionTemplate[];
    departments: Department[];
    projects: Project[];
    isLoading: boolean;
    onAdd: (data: Omit<DeductionTemplate, "id" | "createdAt" | "updatedAt" | "isActive"> & { isActive?: boolean }) => Promise<void>;
    onUpdate: (id: string, data: Partial<DeductionTemplate>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [type, setType] = useState<DeductionTemplateType>("deduction");
    const [calcMode, setCalcMode] = useState<DeductionCalculationMode>("fixed");
    const [value, setValue] = useState("");
    const [appliesToAll, setAppliesToAll] = useState(false);
    const [condDepartment, setCondDepartment] = useState("");
    const [condRole, setCondRole] = useState("");
    const [condProject, setCondProject] = useState("");
    const [condMinSalary, setCondMinSalary] = useState("");
    const [condMaxSalary, setCondMaxSalary] = useState("");

    // Filter only active items for dropdowns
    const activeDepartments = useMemo(() => departments.filter(d => d.isActive), [departments]);
    const activeProjects = useMemo(() => projects.filter(p => p.status === "active"), [projects]);

    const resetForm = () => {
        setName(""); setType("deduction"); setCalcMode("fixed"); setValue("");
        setAppliesToAll(false); setCondDepartment(""); setCondRole(""); setCondProject(""); setCondMinSalary(""); setCondMaxSalary("");
        setEditingId(null);
        setSubmitting(false);
    };

    const openCreate = () => { resetForm(); setDialogOpen(true); };

    const openEdit = (t: DeductionTemplate) => {
        setEditingId(t.id);
        setName(t.name);
        setType(t.type);
        setCalcMode(t.calculationMode);
        setValue(String(t.value));
        setAppliesToAll(t.appliesToAll ?? false);
        setCondDepartment(t.conditions?.department || "");
        setCondRole(t.conditions?.role || "");
        setCondProject(t.conditions?.project || "");
        setCondMinSalary(t.conditions?.minSalary !== undefined ? String(t.conditions.minSalary) : "");
        setCondMaxSalary(t.conditions?.maxSalary !== undefined ? String(t.conditions.maxSalary) : "");
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        // Validation
        if (!name.trim()) { 
            toast.error("Template name is required"); 
            return; 
        }
        if (!value) { 
            toast.error("Value is required"); 
            return; 
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) { 
            toast.error("Value must be a non-negative number"); 
            return; 
        }
        if (calcMode === "percentage" && numValue > 100) {
            toast.error("Percentage cannot exceed 100%");
            return;
        }

        // Validate salary range
        if (condMinSalary && condMaxSalary) {
            const min = parseFloat(condMinSalary);
            const max = parseFloat(condMaxSalary);
            if (!isNaN(min) && !isNaN(max) && min > max) {
                toast.error("Min salary cannot be greater than max salary");
                return;
            }
        }

        // Build conditions object (only include non-empty values)
        const conditions: Record<string, string | number> = {};
        if (condDepartment && condDepartment !== NONE_VALUE) conditions.department = condDepartment;
        if (condRole && condRole !== NONE_VALUE) conditions.role = condRole;
        if (condProject && condProject !== NONE_VALUE) conditions.project = condProject;
        if (condMinSalary) {
            const min = parseFloat(condMinSalary);
            if (!isNaN(min) && min > 0) conditions.minSalary = min;
        }
        if (condMaxSalary) {
            const max = parseFloat(condMaxSalary);
            if (!isNaN(max) && max > 0) conditions.maxSalary = max;
        }

        const data = {
            name: name.trim(),
            type,
            calculationMode: calcMode,
            value: numValue,
            conditions: Object.keys(conditions).length > 0 ? conditions : undefined,
            appliesToAll,
        };

        setSubmitting(true);
        try {
            if (editingId) {
                await onUpdate(editingId, data);
                toast.success("Template updated successfully");
            } else {
                await onAdd(data);
                toast.success("Template created successfully");
            }
            setDialogOpen(false);
            resetForm();
        } catch (err) {
            const message = err instanceof Error ? err.message : "An error occurred";
            toast.error(editingId ? `Failed to update template: ${message}` : `Failed to create template: ${message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const calcModeLabel: Record<DeductionCalculationMode, string> = {
        fixed: "Fixed Amount",
        percentage: "% of Salary",
        daily: "Per Day",
        hourly: "Per Hour",
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium">Custom Deduction &amp; Allowance Templates</p>
                    <p className="text-xs text-muted-foreground">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5" onClick={openCreate}>
                            <Plus className="h-3.5 w-3.5" /> Add Template
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Edit Template" : "Create Deduction/Allowance Template"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-sm font-medium">Name</label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Uniform Deduction" className="mt-1" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Type</label>
                                    <Select value={type} onValueChange={(v) => setType(v as DeductionTemplateType)}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="deduction">Deduction (−)</SelectItem>
                                            <SelectItem value="allowance">Allowance (+)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Calculation Mode</label>
                                    <Select value={calcMode} onValueChange={(v) => setCalcMode(v as DeductionCalculationMode)}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                                            <SelectItem value="percentage">Percentage of Salary</SelectItem>
                                            <SelectItem value="daily">Per Day</SelectItem>
                                            <SelectItem value="hourly">Per Hour</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">
                                    Value {calcMode === "percentage" ? "(%)" : calcMode === "fixed" ? "(₱)" : calcMode === "daily" ? "(₱/day)" : "(₱/hr)"}
                                </label>
                                <Input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1" placeholder="0" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox checked={appliesToAll} onCheckedChange={(v) => setAppliesToAll(!!v)} id="appliesAll" />
                                <label htmlFor="appliesAll" className="text-sm">Applies to all employees by default</label>
                            </div>

                            {/* Conditions */}
                            <div className="border rounded-lg p-3 space-y-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Conditions (optional)</p>
                                <p className="text-[10px] text-muted-foreground -mt-2">Select one value per condition, or leave as &quot;None&quot; to skip</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-muted-foreground">Department</label>
                                        <Select value={condDepartment || NONE_VALUE} onValueChange={(v) => setCondDepartment(v === NONE_VALUE ? "" : v)}>
                                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE_VALUE}>None</SelectItem>
                                                {activeDepartments.map((d) => (
                                                    <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Role</label>
                                        <Select value={condRole || NONE_VALUE} onValueChange={(v) => setCondRole(v === NONE_VALUE ? "" : v)}>
                                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE_VALUE}>None</SelectItem>
                                                {AVAILABLE_ROLES.map((r) => (
                                                    <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Project</label>
                                        <Select value={condProject || NONE_VALUE} onValueChange={(v) => setCondProject(v === NONE_VALUE ? "" : v)}>
                                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE_VALUE}>None</SelectItem>
                                                {activeProjects.map((p) => (
                                                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Min Salary (₱)</label>
                                        <Input type="number" min="0" value={condMinSalary} onChange={(e) => setCondMinSalary(e.target.value)} className="mt-1 h-8 text-xs" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Max Salary (₱)</label>
                                        <Input type="number" min="0" value={condMaxSalary} onChange={(e) => setCondMaxSalary(e.target.value)} className="mt-1 h-8 text-xs" placeholder="0" />
                                    </div>
                                </div>
                            </div>

                            <Button onClick={handleSubmit} className="w-full" disabled={isLoading || submitting}>
                                {submitting ? "Saving..." : editingId ? "Update Template" : "Create Template"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Templates Table */}
            <Card className="border border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader><TableRow>
                                <TableHead className="text-xs">Name</TableHead>
                                <TableHead className="text-xs">Type</TableHead>
                                <TableHead className="text-xs">Mode</TableHead>
                                <TableHead className="text-xs">Value</TableHead>
                                <TableHead className="text-xs">Conditions</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs w-20"></TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {templates.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                                        {isLoading ? "Loading..." : "No templates yet. Create one to get started."}
                                    </TableCell></TableRow>
                                ) : templates.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="text-sm font-medium">{t.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={`text-[10px] ${t.type === "deduction" ? "bg-red-500/15 text-red-700 dark:text-red-400" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"}`}>
                                                {t.type === "deduction" ? "−" : "+"} {t.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs">{calcModeLabel[t.calculationMode]}</TableCell>
                                        <TableCell className="text-sm font-mono">
                                            {t.calculationMode === "percentage" ? `${t.value}%` : formatCurrency(t.value)}
                                        </TableCell>
                                        <TableCell className="text-[10px] text-muted-foreground">
                                            {t.conditions ? Object.entries(t.conditions).map(([k, v]) => `${k}: ${v}`).join(", ") : t.appliesToAll ? "All employees" : "Manual assign"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={`text-[10px] ${t.isActive ? "bg-emerald-500/15 text-emerald-700" : "bg-slate-500/15 text-slate-500"}`}>
                                                {t.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Edit className="h-3.5 w-3.5" /></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Delete &ldquo;{t.name}&rdquo;?</AlertDialogTitle>
                                                            <AlertDialogDescription>If employees are assigned this template, it will be marked inactive instead of deleted.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => onDelete(t.id)}>Delete</AlertDialogAction>
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
                </CardContent>
            </Card>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   EMPLOYEE ASSIGNMENTS TAB
   ═══════════════════════════════════════════════════════════════ */

function EmployeeAssignmentsTab({
    templates,
    assignments,
    employees,
    projects,
    isLoading,
    onAssign,
    onUnassign,
    onBulkAssign,
}: {
    templates: DeductionTemplate[];
    assignments: EmployeeDeductionAssignment[];
    employees: Employee[];
    projects: import("@/types").Project[];
    isLoading: boolean;
    onAssign: (data: { employeeId: string; templateId: string; overrideValue?: number; effectiveFrom?: string }) => Promise<void>;
    onUnassign: (id: string) => Promise<void>;
    onBulkAssign: (data: { employeeIds: string[]; templateId: string; overrideValue?: number; effectiveFrom?: string }) => Promise<{ assigned: number; skipped: number }>;
}) {
    // ─── Individual assign state ─────────────────────────────────
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState("");
    const [overrideValue, setOverrideValue] = useState("");
    const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);

    // ─── Bulk assign state ───────────────────────────────────────
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    const [bulkTemplate, setBulkTemplate] = useState("");
    const [bulkScope, setBulkScope] = useState<"department" | "project" | "all_active">("department");
    const [bulkDepartment, setBulkDepartment] = useState("");
    const [bulkProject, setBulkProject] = useState("");
    const [bulkOverride, setBulkOverride] = useState("");
    const [bulkEffectiveFrom, setBulkEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
    const [bulkProcessing, setBulkProcessing] = useState(false);

    const activeTemplates = useMemo(() => templates.filter((t) => t.isActive), [templates]);
    const activeEmployees = useMemo(() => employees.filter((e) => e.status === "active"), [employees]);

    // Unique departments from active employees
    const departments = useMemo(() =>
        [...new Set(activeEmployees.map((e) => e.department).filter(Boolean))].sort(),
        [activeEmployees]
    );
    // Active projects with at least 1 assigned employee
    const activeProjects = useMemo(() =>
        projects.filter((p) => p.status !== "completed" && p.assignedEmployeeIds.length > 0),
        [projects]
    );

    // Preview: how many employees will be affected by bulk
    const bulkPreviewEmployees = useMemo(() => {
        let pool: Employee[] = [];
        if (bulkScope === "all_active") {
            pool = activeEmployees;
        } else if (bulkScope === "department" && bulkDepartment) {
            pool = activeEmployees.filter((e) => e.department === bulkDepartment);
        } else if (bulkScope === "project" && bulkProject) {
            const proj = projects.find((p) => p.id === bulkProject);
            const ids = new Set(proj?.assignedEmployeeIds ?? []);
            pool = activeEmployees.filter((e) => ids.has(e.id));
        }
        // Exclude deduction-exempt employees
        return pool.filter((e) => !e.deductionExempt);
    }, [bulkScope, bulkDepartment, bulkProject, activeEmployees, projects]);

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;
    const getTemplateName = (id: string) => templates.find((t) => t.id === id)?.name || id;

    const handleAssign = async () => {
        if (!selectedEmployee || !selectedTemplate) {
            toast.error("Select an employee and template");
            return;
        }
        await onAssign({
            employeeId: selectedEmployee,
            templateId: selectedTemplate,
            overrideValue: overrideValue ? parseFloat(overrideValue) : undefined,
            effectiveFrom,
        });
        toast.success("Assignment created");
        setDialogOpen(false);
        setSelectedEmployee(""); setSelectedTemplate(""); setOverrideValue("");
    };

    const handleBulkAssign = async () => {
        if (!bulkTemplate) { toast.error("Select a template"); return; }
        if (bulkPreviewEmployees.length === 0) { toast.error("No eligible employees for this scope"); return; }
        setBulkProcessing(true);
        const result = await onBulkAssign({
            templateId: bulkTemplate,
            employeeIds: bulkPreviewEmployees.map((e) => e.id),
            overrideValue: bulkOverride ? parseFloat(bulkOverride) : undefined,
            effectiveFrom: bulkEffectiveFrom,
        });
        setBulkProcessing(false);
        if (result.assigned > 0 || result.skipped >= 0) {
            toast.success(`Assigned to ${result.assigned} employee${result.assigned !== 1 ? "s" : ""}${result.skipped > 0 ? ` (${result.skipped} skipped — already assigned or exempt)` : ""}`);
            setBulkDialogOpen(false);
            setBulkTemplate(""); setBulkDepartment(""); setBulkProject(""); setBulkOverride("");
        }
    };

    return (
        <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium">Employee Deduction Assignments</p>
                    <p className="text-xs text-muted-foreground">{assignments.length} assignment{assignments.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex gap-2">
                    {/* ─── Bulk Assign Dialog ─── */}
                    <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5 text-violet-600 border-violet-200 dark:border-violet-800">
                                <Layers className="h-3.5 w-3.5" /> Bulk Assign
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Bulk Assign Deduction Template</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="text-sm font-medium">Template</label>
                                    <Select value={bulkTemplate} onValueChange={setBulkTemplate}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select template" /></SelectTrigger>
                                        <SelectContent>
                                            {activeTemplates.map((t) => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    {t.type === "deduction" ? "−" : "+"} {t.name} ({t.calculationMode === "percentage" ? `${t.value}%` : formatCurrency(t.value)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="text-sm font-medium">Assign To</label>
                                    <Select value={bulkScope} onValueChange={(v) => setBulkScope(v as typeof bulkScope)}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="department">All employees in a Department</SelectItem>
                                            <SelectItem value="project">All employees in a Project</SelectItem>
                                            <SelectItem value="all_active">All Active Employees</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {bulkScope === "department" && (
                                    <div>
                                        <label className="text-sm font-medium">Department</label>
                                        <Select value={bulkDepartment} onValueChange={setBulkDepartment}>
                                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                                            <SelectContent>
                                                {departments.map((d) => (
                                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {bulkScope === "project" && (
                                    <div>
                                        <label className="text-sm font-medium">Project</label>
                                        <Select value={bulkProject} onValueChange={setBulkProject}>
                                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                                            <SelectContent>
                                                {activeProjects.map((p) => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.assignedEmployeeIds.length} members)</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm font-medium">Override Value (optional)</label>
                                    <Input type="number" min="0" step="0.01" value={bulkOverride}
                                        onChange={(e) => setBulkOverride(e.target.value)}
                                        className="mt-1" placeholder="Leave blank to use template default" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Effective From</label>
                                    <Input type="date" value={bulkEffectiveFrom} onChange={(e) => setBulkEffectiveFrom(e.target.value)} className="mt-1" />
                                </div>

                                {bulkPreviewEmployees.length > 0 && (
                                    <div className="bg-violet-50 dark:bg-violet-950/20 rounded-md p-2.5 text-xs text-violet-700 dark:text-violet-300">
                                        <strong>{bulkPreviewEmployees.length} eligible employee{bulkPreviewEmployees.length !== 1 ? "s" : ""}</strong> will receive this deduction.
                                        {" "}Deduction-exempt employees are automatically excluded.
                                    </div>
                                )}

                                <Button onClick={handleBulkAssign} className="w-full" disabled={isLoading || bulkProcessing || bulkPreviewEmployees.length === 0}>
                                    {bulkProcessing ? "Assigning..." : `Assign to ${bulkPreviewEmployees.length} Employee${bulkPreviewEmployees.length !== 1 ? "s" : ""}`}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* ─── Individual Assign Dialog ─── */}
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Assign</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Assign Deduction to Employee</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="text-sm font-medium">Employee</label>
                                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                                        <SelectContent>
                                            {activeEmployees.filter((e) => !e.deductionExempt).map((e) => (
                                                <SelectItem key={e.id} value={e.id}>{e.name} — {e.department}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[10px] text-muted-foreground mt-1">Deduction-exempt employees are hidden</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Template</label>
                                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select template" /></SelectTrigger>
                                        <SelectContent>
                                            {activeTemplates.map((t) => (
                                                <SelectItem key={t.id} value={t.id}>{t.name} ({t.type} — {t.calculationMode})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Override Value (optional)</label>
                                    <Input type="number" min="0" step="0.01" value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)} className="mt-1" placeholder="Leave blank to use template default" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Effective From</label>
                                    <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="mt-1" />
                                </div>
                                <Button onClick={handleAssign} className="w-full" disabled={isLoading}>
                                    Assign
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Assignments Table */}
            <Card className="border border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader><TableRow>
                                <TableHead className="text-xs">Employee</TableHead>
                                <TableHead className="text-xs">Template</TableHead>
                                <TableHead className="text-xs">Override Value</TableHead>
                                <TableHead className="text-xs">Effective From</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs w-16"></TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {assignments.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                                        {isLoading ? "Loading..." : "No assignments yet"}
                                    </TableCell></TableRow>
                                ) : assignments.map((a) => (
                                    <TableRow key={a.id}>
                                        <TableCell className="text-sm font-medium">{getEmpName(a.employeeId)}</TableCell>
                                        <TableCell className="text-sm">{getTemplateName(a.templateId)}</TableCell>
                                        <TableCell className="text-sm font-mono">
                                            {a.overrideValue !== undefined && a.overrideValue !== null ? formatCurrency(a.overrideValue) : "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{a.effectiveFrom}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={`text-[10px] ${a.isActive ? "bg-emerald-500/15 text-emerald-700" : "bg-slate-500/15 text-slate-500"}`}>
                                                {a.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Remove assignment?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will remove the deduction for {getEmpName(a.employeeId)}.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => onUnassign(a.id)}>Remove</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
