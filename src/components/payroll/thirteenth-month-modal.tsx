"use client";

import { useState, useMemo, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Gift,
    AlertTriangle,
    CheckCircle2,
    Users,
    Building2,
    FolderKanban,
    User,
    Search,
    Calendar,
    Banknote,
    TrendingUp,
    Loader2,
    Info,
    ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Employee, Department, Project } from "@/types";

interface ThirteenthMonthModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employees: Employee[];
    departments: Department[];
    projects: Project[];
    onGenerate: (
        selectedEmployees: { id: string; salary: number; joinDate: string }[],
        year: number
    ) => void;
}

type FilterMode = "all" | "department" | "project" | "individual";

interface EmployeePreview {
    id: string;
    name: string;
    department: string;
    salary: number;
    joinDate: string;
    monthsWorked: number;
    thirteenthAmount: number;
}

export function ThirteenthMonthModal({
    open,
    onOpenChange,
    employees,
    departments,
    projects,
    onGenerate,
}: ThirteenthMonthModalProps) {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [filterMode, setFilterMode] = useState<FilterMode>("all");
    const [selectedDepartment, setSelectedDepartment] = useState<string>("");
    const [selectedProject, setSelectedProject] = useState<string>("");
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
        new Set()
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);

    // Available years (current + 2 previous)
    const availableYears = useMemo(
        () => [currentYear, currentYear - 1, currentYear - 2],
        [currentYear]
    );

    // Calculate 13th month for each active employee
    const employeePreviews = useMemo((): EmployeePreview[] => {
        return employees
            .filter((e) => e.status === "active")
            .map((emp) => {
                let monthsWorked = 12;
                if (emp.joinDate) {
                    const joinDate = new Date(emp.joinDate);
                    const joinYear = joinDate.getFullYear();
                    if (joinYear === selectedYear) {
                        monthsWorked = 12 - joinDate.getMonth();
                    } else if (joinYear > selectedYear) {
                        monthsWorked = 0;
                    }
                }
                return {
                    id: emp.id,
                    name: emp.name,
                    department: emp.department,
                    salary: emp.salary,
                    joinDate: emp.joinDate,
                    monthsWorked,
                    thirteenthAmount: Math.round((emp.salary * monthsWorked) / 12),
                };
            })
            .filter((e) => e.thirteenthAmount > 0);
    }, [employees, selectedYear]);

    // Filter based on mode
    const filteredEmployees = useMemo(() => {
        let result = employeePreviews;

        if (filterMode === "department" && selectedDepartment) {
            result = result.filter((e) => e.department === selectedDepartment);
        } else if (filterMode === "project" && selectedProject) {
            const project = projects.find((p) => p.id === selectedProject);
            if (project) {
                const memberIds = new Set(project.assignedEmployeeIds || []);
                result = result.filter((e) => memberIds.has(e.id));
            }
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (e) =>
                    e.name.toLowerCase().includes(q) ||
                    e.department.toLowerCase().includes(q)
            );
        }

        return result;
    }, [
        employeePreviews,
        filterMode,
        selectedDepartment,
        selectedProject,
        projects,
        searchQuery,
    ]);

    // Selection logic
    const effectiveSelection = useMemo(() => {
        if (filterMode === "individual") {
            return selectedEmployeeIds;
        }
        return new Set(filteredEmployees.map((e) => e.id));
    }, [filterMode, filteredEmployees, selectedEmployeeIds]);

    const selectedEmployees = useMemo(
        () => filteredEmployees.filter((e) => effectiveSelection.has(e.id)),
        [filteredEmployees, effectiveSelection]
    );

    // Summary
    const summary = useMemo(() => {
        const total = selectedEmployees.reduce(
            (sum, e) => sum + e.thirteenthAmount,
            0
        );
        const avgAmount =
            selectedEmployees.length > 0 ? total / selectedEmployees.length : 0;
        const proRated = selectedEmployees.filter(
            (e) => e.monthsWorked < 12
        ).length;
        return {
            total,
            count: selectedEmployees.length,
            avgAmount: Math.round(avgAmount),
            proRated,
            taxExemptLimit: 90000,
        };
    }, [selectedEmployees]);

    // Handlers
    const toggleEmployee = useCallback((id: string) => {
        setSelectedEmployeeIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        setSelectedEmployeeIds((prev) =>
            prev.size === filteredEmployees.length
                ? new Set()
                : new Set(filteredEmployees.map((e) => e.id))
        );
    }, [filteredEmployees]);

    const handleFilterModeChange = useCallback((mode: FilterMode) => {
        setFilterMode(mode);
        setSelectedEmployeeIds(new Set());
        setSelectedDepartment("");
        setSelectedProject("");
        setSearchQuery("");
    }, []);

    const handleGenerate = useCallback(async () => {
        if (selectedEmployees.length === 0) return;
        setIsGenerating(true);
        try {
            await onGenerate(
                selectedEmployees.map((e) => ({
                    id: e.id,
                    salary: e.salary,
                    joinDate: e.joinDate,
                })),
                selectedYear
            );
            onOpenChange(false);
        } finally {
            setIsGenerating(false);
        }
    }, [selectedEmployees, selectedYear, onGenerate, onOpenChange]);

    const handleOpenChange = useCallback(
        (newOpen: boolean) => {
            if (!newOpen) {
                setFilterMode("all");
                setSelectedDepartment("");
                setSelectedProject("");
                setSelectedEmployeeIds(new Set());
                setSearchQuery("");
                setSelectedYear(currentYear);
            }
            onOpenChange(newOpen);
        },
        [onOpenChange, currentYear]
    );

    const activeDepartments = departments.filter((d) => d.isActive);
    const activeProjects = projects.filter((p) => p.status === "active");

    const filterOptions = [
        {
            value: "all",
            label: "All Active",
            icon: Users,
            count: employeePreviews.length,
        },
        { value: "department", label: "By Department", icon: Building2 },
        { value: "project", label: "By Project", icon: FolderKanban },
        { value: "individual", label: "Individual", icon: User },
    ] as const;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="!max-w-5xl w-full h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3 text-xl">
                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                                <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            13th Month Pay Generation
                        </DialogTitle>
                        <DialogDescription className="text-sm mt-1">
                            Generate 13th month payslips per Philippine Labor Code. Payslips
                            will be created as drafts for review before publishing.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Main Content - Scrollable */}
                <ScrollArea className="flex-1 min-h-0">
                    <div className="px-6 py-4 space-y-4">
                        {/* Toolbar: Year + Filter pills — single non-wrapping row */}
                        <div className="flex items-center gap-0 rounded-lg border bg-card overflow-hidden">
                            {/* Year Selector */}
                            <div className="flex items-center gap-2 px-3 py-2 border-r shrink-0">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <Label className="text-sm font-medium whitespace-nowrap">
                                    Fiscal Year:
                                </Label>
                                <Select
                                    value={selectedYear.toString()}
                                    onValueChange={(v) => setSelectedYear(parseInt(v))}
                                >
                                    <SelectTrigger className="w-20 h-7 border-0 shadow-none p-0 pl-1 focus:ring-0 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableYears.map((year) => (
                                            <SelectItem key={year} value={year.toString()}>
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Filter Mode Pills */}
                            <div className="flex items-center gap-1.5 px-3 py-2 flex-1 overflow-x-auto">
                                {filterOptions.map((opt) => {
                                    const Icon = opt.icon;
                                    const isActive = filterMode === opt.value;
                                    return (
                                        <Button
                                            key={opt.value}
                                            type="button"
                                            variant={isActive ? "default" : "outline"}
                                            size="sm"
                                            onClick={() =>
                                                handleFilterModeChange(opt.value as FilterMode)
                                            }
                                            className={cn(
                                                "gap-1.5 h-7 text-xs shrink-0",
                                                isActive
                                                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                                                    : "hover:bg-muted"
                                            )}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                            {opt.label}
                                            {"count" in opt && (
                                                <Badge
                                                    variant="secondary"
                                                    className={cn(
                                                        "ml-1 h-5 px-1.5 text-[10px]",
                                                        isActive && "bg-amber-700 text-white"
                                                    )}
                                                >
                                                    {opt.count}
                                                </Badge>
                                            )}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Secondary Filter Controls */}
                        {filterMode === "department" && (
                            <div className="flex items-center gap-3">
                                <Label className="text-sm text-muted-foreground whitespace-nowrap">
                                    Select Department:
                                </Label>
                                <Select
                                    value={selectedDepartment}
                                    onValueChange={setSelectedDepartment}
                                >
                                    <SelectTrigger className="w-64">
                                        <SelectValue placeholder="Choose a department..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {activeDepartments.map((dept) => (
                                            <SelectItem key={dept.id} value={dept.name}>
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {filterMode === "project" && (
                            <div className="flex items-center gap-3">
                                <Label className="text-sm text-muted-foreground whitespace-nowrap">
                                    Select Project:
                                </Label>
                                <Select
                                    value={selectedProject}
                                    onValueChange={setSelectedProject}
                                >
                                    <SelectTrigger className="w-64">
                                        <SelectValue placeholder="Choose a project..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {activeProjects.map((proj) => (
                                            <SelectItem key={proj.id} value={proj.id}>
                                                {proj.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {filterMode === "individual" && (
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1 max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name or department..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={toggleSelectAll}
                                >
                                    {selectedEmployeeIds.size === filteredEmployees.length
                                        ? "Deselect All"
                                        : "Select All"}
                                </Button>
                            </div>
                        )}

                        {/* Summary Cards */}
                        <div className="grid grid-cols-4 gap-3">
                            <div className="p-3 rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
                                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 mb-1">
                                    <Users className="h-3.5 w-3.5" />
                                    <span className="text-[11px] font-medium uppercase tracking-wide">
                                        Recipients
                                    </span>
                                </div>
                                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                    {summary.count}
                                </p>
                                {summary.proRated > 0 && (
                                    <p className="text-[10px] text-blue-600/70 mt-0.5">
                                        {summary.proRated} pro-rated
                                    </p>
                                )}
                            </div>

                            <div className="p-3 rounded-xl border bg-gradient-to-br from-green-50 to-emerald-100/50 dark:from-green-950/30 dark:to-emerald-900/20">
                                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 mb-1">
                                    <Banknote className="h-3.5 w-3.5" />
                                    <span className="text-[11px] font-medium uppercase tracking-wide">
                                        Total Payout
                                    </span>
                                </div>
                                <p className="text-lg font-bold text-green-700 dark:text-green-300 tabular-nums">
                                    {formatCurrency(summary.total)}
                                </p>
                            </div>

                            <div className="p-3 rounded-xl border bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20">
                                <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 mb-1">
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    <span className="text-[11px] font-medium uppercase tracking-wide">
                                        Average
                                    </span>
                                </div>
                                <p className="text-lg font-bold text-purple-700 dark:text-purple-300 tabular-nums">
                                    {formatCurrency(summary.avgAmount)}
                                </p>
                            </div>

                            <div className="p-3 rounded-xl border bg-gradient-to-br from-amber-50 to-orange-100/50 dark:from-amber-950/30 dark:to-orange-900/20">
                                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
                                    <Info className="h-3.5 w-3.5" />
                                    <span className="text-[11px] font-medium uppercase tracking-wide">
                                        Tax Exempt
                                    </span>
                                </div>
                                <p className="text-lg font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                                    {formatCurrency(summary.taxExemptLimit)}
                                </p>
                                <p className="text-[10px] text-amber-600/70 mt-0.5">
                                    per TRAIN Law
                                </p>
                            </div>
                        </div>

                        {/* Employee Table */}
                        <div className="rounded-xl border overflow-hidden bg-card">
                            <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <ChevronDown className="h-4 w-4" />
                                    Employee Preview
                                    <Badge variant="secondary" className="ml-2">
                                        {filteredEmployees.length} employees
                                    </Badge>
                                </h3>
                            </div>
                            <div className="max-h-[320px] overflow-auto">
                                <Table className="min-w-[700px] w-full">
                                    <TableHeader className="sticky top-0 bg-card z-10">
                                        <TableRow className="hover:bg-transparent">
                                            {filterMode === "individual" && (
                                                <TableHead className="w-12"></TableHead>
                                            )}
                                            <TableHead className="font-semibold">Employee</TableHead>
                                            <TableHead className="font-semibold">Department</TableHead>
                                            <TableHead className="text-right font-semibold">
                                                Monthly Salary
                                            </TableHead>
                                            <TableHead className="text-center font-semibold">
                                                Months
                                            </TableHead>
                                            <TableHead className="text-right font-semibold">
                                                13th Month
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredEmployees.length === 0 ? (
                                            <TableRow>
                                                <TableCell
                                                    colSpan={filterMode === "individual" ? 6 : 5}
                                                    className="h-32 text-center text-muted-foreground"
                                                >
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Users className="h-8 w-8 opacity-30" />
                                                        <span>No employees match the current filter</span>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredEmployees.map((emp) => {
                                                const isSelected = effectiveSelection.has(emp.id);
                                                const isProRated = emp.monthsWorked < 12;
                                                return (
                                                    <TableRow
                                                        key={emp.id}
                                                        className={cn(
                                                            "transition-colors",
                                                            filterMode === "individual" &&
                                                                "cursor-pointer hover:bg-muted/50",
                                                            !isSelected && "opacity-50"
                                                        )}
                                                        onClick={
                                                            filterMode === "individual"
                                                                ? () => toggleEmployee(emp.id)
                                                                : undefined
                                                        }
                                                    >
                                                        {filterMode === "individual" && (
                                                            <TableCell className="w-12">
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onCheckedChange={() =>
                                                                        toggleEmployee(emp.id)
                                                                    }
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </TableCell>
                                                        )}
                                                        <TableCell>
                                                            <span className="font-medium">{emp.name}</span>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">
                                                            {emp.department}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono text-sm">
                                                            {formatCurrency(emp.salary)}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge
                                                                variant={isProRated ? "outline" : "secondary"}
                                                                className={cn(
                                                                    "font-mono text-xs",
                                                                    isProRated &&
                                                                        "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400"
                                                                )}
                                                            >
                                                                {emp.monthsWorked}/12
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className="font-semibold font-mono text-green-600 dark:text-green-400">
                                                                {formatCurrency(emp.thirteenthAmount)}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="px-6 py-3 border-t bg-muted/30 shrink-0">
                    <div className="flex items-center justify-between gap-4">
                        {/* Warning */}
                        <div className="flex items-center gap-2 text-sm min-w-0">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                            <p className="text-muted-foreground truncate">
                                <span className="font-semibold text-foreground">
                                    {summary.count} payslip{summary.count !== 1 ? "s" : ""}
                                </span>{" "}
                                will be created as{" "}
                                <span className="font-medium text-foreground">Draft</span>.{" "}
                                Review and publish from the Payslips tab.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenChange(false)}
                                disabled={isGenerating}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleGenerate}
                                disabled={selectedEmployees.length === 0 || isGenerating}
                                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white min-w-[160px]"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        Generate 13th Month
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
