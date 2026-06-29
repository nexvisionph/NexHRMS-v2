"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Edit, Calculator } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { DeductionTemplate, DeductionTemplateType, DeductionCalculationMode, Department, Project, Role } from "@/types";
import { formatCurrency } from "@/lib/format";

const AVAILABLE_ROLES: Role[] = ["admin", "hr", "finance", "employee", "supervisor", "payroll_admin", "auditor"];
const NONE_VALUE = "__none__";

export function DeductionTemplatesTab({
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

    // Filter state
    const [typeFilter, setTypeFilter] = useState<"all" | "deduction" | "allowance">("all");

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

    const filteredTemplates = useMemo(() =>
        typeFilter === "all" ? templates : templates.filter((t) => t.type === typeFilter),
        [templates, typeFilter]
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    <div>
                        <p className="text-sm font-semibold">Custom Deduction &amp; Allowance Templates</p>
                        <p className="text-xs text-muted-foreground">{filteredTemplates.length} of {templates.length} template{templates.length !== 1 ? "s" : ""}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                        <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="deduction">Deduction (−)</SelectItem>
                            <SelectItem value="allowance">Allowance (+)</SelectItem>
                        </SelectContent>
                    </Select>
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
                                <TableHead className="text-xs text-center">Actions</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {filteredTemplates.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                                        {isLoading ? "Loading..." : typeFilter === "all" ? "No templates yet. Create one to get started." : `No ${typeFilter} templates found.`}
                                    </TableCell></TableRow>
                                ) : filteredTemplates.map((t) => (
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
                                        <TableCell >
                                            <div className="flex items-center gap-1 text-center justify-center">
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
