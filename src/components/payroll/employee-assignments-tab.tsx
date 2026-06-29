"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Users, Layers } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { DeductionTemplate, EmployeeDeductionAssignment, Employee, Project } from "@/types";
import { formatCurrency } from "@/lib/format";

export function EmployeeAssignmentsTab({
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
    projects: Project[];
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

    // ─── Pagination state ────────────────────────────────────────
    const PAGE_SIZE = 10;
    const [currentPage, setCurrentPage] = useState(1);
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

    const totalPages = Math.max(1, Math.ceil(assignments.length / PAGE_SIZE));

    const [prevAssignmentsLength, setPrevAssignmentsLength] = useState(assignments.length);
    if (assignments.length !== prevAssignmentsLength) {
        setPrevAssignmentsLength(assignments.length);
        setCurrentPage(1);
    }

    const paginatedAssignments = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return assignments.slice(start, start + PAGE_SIZE);
    }, [assignments, currentPage]);

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
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                        <p className="text-sm font-semibold">Employee Deduction Assignments</p>
                        <p className="text-xs text-muted-foreground">{assignments.length} assignment{assignments.length !== 1 ? "s" : ""}</p>
                    </div>
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
                                ) : paginatedAssignments.map((a) => (
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
                    {/* Pagination Footer */}
                    {assignments.length > PAGE_SIZE && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                            <p className="text-xs text-muted-foreground">
                                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, assignments.length)} of {assignments.length} assignment{assignments.length !== 1 ? "s" : ""}
                            </p>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </Button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                                        acc.push(p);
                                        return acc;
                                    }, [])
                                    .map((p, i) =>
                                        p === "…" ? (
                                            <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-muted-foreground">…</span>
                                        ) : (
                                            <Button
                                                key={p}
                                                variant={currentPage === p ? "default" : "outline"}
                                                size="sm"
                                                className="h-7 w-7 p-0 text-xs"
                                                onClick={() => setCurrentPage(p as number)}
                                            >
                                                {p}
                                            </Button>
                                        )
                                    )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
