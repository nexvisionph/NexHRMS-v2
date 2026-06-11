"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useDisciplinaryStore } from "@/store/disciplinary.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Gavel, Plus, Search, Eye, Pencil, Trash2,
    AlertTriangle, FileText, ShieldAlert, Clock, CheckCircle2, Hourglass, TrendingUp, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import type { DisciplinaryCase, DisciplinaryCaseStatus } from "@/types";

const STATUS_LABELS: Record<DisciplinaryCaseStatus, string> = {
    open: "Open",
    nte_issued: "NTE Issued",
    nte_acknowledged: "NTE Acknowledged",
    explanation_submitted: "Explanation Submitted",
    no_response: "No Response",
    under_review: "Under Review",
    nod_issued: "NOD Issued",
    nod_acknowledged: "NOD Acknowledged",
    sanction_active: "Sanction Active",
    closed: "Closed",
};

const STATUS_TONE: Record<DisciplinaryCaseStatus, string> = {
    open: "bg-slate-100 text-slate-700",
    nte_issued: "bg-blue-100 text-blue-700",
    nte_acknowledged: "bg-cyan-100 text-cyan-700",
    explanation_submitted: "bg-purple-100 text-purple-700",
    no_response: "bg-orange-100 text-orange-700",
    under_review: "bg-amber-100 text-amber-800",
    nod_issued: "bg-red-100 text-red-700",
    nod_acknowledged: "bg-rose-100 text-rose-700",
    sanction_active: "bg-red-200 text-red-900",
    closed: "bg-emerald-100 text-emerald-800",
};

export default function DisciplinaryAdminView() {
    const cases = useDisciplinaryStore((s) => s.cases);
    const createCase = useDisciplinaryStore((s) => s.createCase);
    const updateCase = useDisciplinaryStore((s) => s.updateCase);
    const deleteCase = useDisciplinaryStore((s) => s.deleteCase);
    const getDashboardStats = useDisciplinaryStore((s) => s.getDashboardStats);
    const stats = useMemo(() => getDashboardStats(), [cases, getDashboardStats]);
    const { employees } = useEmployeesStore();
    const currentUser = useAuthStore((s) => s.currentUser);
    const rh = useRoleHref();

    // ── Search / filter ────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | DisciplinaryCaseStatus>("all");

    // ── Create form ────────────────────────────────────────────
    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState({
        employeeId: "",
        violationType: "",
        policyReference: "",
        incidentDate: new Date().toISOString().slice(0, 10),
        incidentLocation: "",
        description: "",
    });
    const [employeeSearch, setEmployeeSearch] = useState("");
    const [showEmpDropdown, setShowEmpDropdown] = useState(false);

    // ── Edit state ─────────────────────────────────────────────
    const [editOpen, setEditOpen] = useState(false);
    const [editingCase, setEditingCase] = useState<DisciplinaryCase | null>(null);
    const [editForm, setEditForm] = useState({
        violationType: "",
        policyReference: "",
        incidentDate: "",
        incidentLocation: "",
        description: "",
        status: "open" as DisciplinaryCaseStatus,
    });

    // ── Delete state ───────────────────────────────────────────
    const [deleteTarget, setDeleteTarget] = useState<DisciplinaryCase | null>(null);

    // ── Derived ────────────────────────────────────────────────
    const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

    const filteredEmpOptions = useMemo(() => {
        const q = employeeSearch.trim().toLowerCase();
        return employees
            .filter((e) => e.status === "active")
            .filter((e) => !q || e.name.toLowerCase().includes(q) || (e.department ?? "").toLowerCase().includes(q))
            .slice(0, 10);
    }, [employees, employeeSearch]);

    const rows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return cases
            .filter((c) => statusFilter === "all" || c.status === statusFilter)
            .filter((c) => {
                if (!q) return true;
                const emp = empMap.get(c.employeeId);
                return (
                    c.caseNumber.toLowerCase().includes(q) ||
                    c.violationType.toLowerCase().includes(q) ||
                    (emp?.name.toLowerCase().includes(q) ?? false)
                );
            })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }, [cases, search, statusFilter, empMap]);

    // ── Handlers ───────────────────────────────────────────────
    const handleCreate = () => {
        if (!form.employeeId) { toast.error("Select an employee"); return; }
        if (!form.violationType.trim()) { toast.error("Violation type is required"); return; }
        if (!form.description.trim()) { toast.error("Description is required"); return; }
        const c = createCase({
            employeeId: form.employeeId,
            violationType: form.violationType.trim(),
            policyReference: form.policyReference.trim() || undefined,
            incidentDate: form.incidentDate,
            incidentLocation: form.incidentLocation.trim() || undefined,
            description: form.description.trim(),
            evidenceUrls: [],
            createdBy: currentUser.id,
        });
        toast.success(`Case ${c.caseNumber} created`);
        setCreateOpen(false);
        setForm({
            employeeId: "",
            violationType: "",
            policyReference: "",
            incidentDate: new Date().toISOString().slice(0, 10),
            incidentLocation: "",
            description: "",
        });
        setEmployeeSearch("");
    };

    const handleOpenEdit = (c: DisciplinaryCase) => {
        setEditingCase(c);
        setEditForm({
            violationType: c.violationType,
            policyReference: c.policyReference ?? "",
            incidentDate: c.incidentDate,
            incidentLocation: c.incidentLocation ?? "",
            description: c.description,
            status: c.status,
        });
        setEditOpen(true);
    };

    const handleSaveEdit = () => {
        if (!editingCase) return;
        if (!editForm.violationType.trim()) { toast.error("Violation type is required"); return; }
        if (!editForm.description.trim()) { toast.error("Description is required"); return; }
        updateCase(editingCase.id, {
            violationType: editForm.violationType.trim(),
            policyReference: editForm.policyReference.trim() || undefined,
            incidentDate: editForm.incidentDate,
            incidentLocation: editForm.incidentLocation.trim() || undefined,
            description: editForm.description.trim(),
            status: editForm.status,
        }, currentUser.id);
        toast.success(`Case ${editingCase.caseNumber} updated`);
        setEditOpen(false);
        setEditingCase(null);
    };

    const handleDelete = () => {
        if (!deleteTarget) return;
        deleteCase(deleteTarget.id, currentUser.id);
        toast.success(`Case ${deleteTarget.caseNumber} deleted`);
        setDeleteTarget(null);
    };

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Gavel className="h-6 w-6 text-primary" /> Disciplinary
                    </h1>
                    <p className="text-sm text-muted-foreground">NTE → NOD case management</p>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> New Case
                </Button>
            </div>

            {/* Summary card */}
            <Card className="border">
                <CardContent className="p-0">
                    <div className="flex items-center gap-3 border-b px-5 py-3.5">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">Case Overview</span>
                        <span className="ml-auto text-xs text-muted-foreground">{stats.total} case{stats.total !== 1 ? "s" : ""} total</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 divide-x-0 sm:divide-x">
                        <SummaryTile label="Open" value={stats.open} icon={AlertTriangle} accent={stats.open > 0 ? "amber" : "muted"} />
                        <SummaryTile label="Awaiting NTE Response" value={stats.awaitingExplanation} icon={Hourglass} accent={stats.awaitingExplanation > 0 ? "orange" : "muted"} />
                        <SummaryTile label="Under Review" value={stats.forReview} icon={Clock} accent={stats.forReview > 0 ? "blue" : "muted"} />
                        <SummaryTile label="NOD Pending" value={stats.nodPending} icon={FileText} accent={stats.nodPending > 0 ? "orange" : "muted"} />
                        <SummaryTile label="Sanction Active" value={stats.suspensionsActive} icon={ShieldAlert} accent={stats.suspensionsActive > 0 ? "red" : "muted"} />
                        <SummaryTile label="Closed" value={stats.closed} icon={CheckCircle2} accent="emerald" isLast />
                    </div>
                </CardContent>
            </Card>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by case #, violation, or employee…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {(Object.keys(STATUS_LABELS) as DisciplinaryCaseStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <Card>
                <CardHeader><CardTitle className="text-base">Cases</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Case #</TableHead>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Violation</TableHead>
                                    <TableHead>Incident</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-center">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            No cases match your filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((c) => {
                                        const emp = empMap.get(c.employeeId);
                                        return (
                                            <TableRow key={c.id} className="group">
                                                <TableCell className="font-mono text-sm font-medium">{c.caseNumber}</TableCell>
                                                <TableCell>{emp?.name ?? c.employeeId}</TableCell>
                                                <TableCell className="text-sm">{c.violationType}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{new Date(c.incidentDate).toLocaleDateString()}</TableCell>
                                                <TableCell>
                                                    <Badge className={`${STATUS_TONE[c.status]} hover:${STATUS_TONE[c.status]} border-0`}>
                                                        {STATUS_LABELS[c.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Link href={rh(`/disciplinary/${c.id}`)}>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" title="View">
                                                                <Eye className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </Link>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => handleOpenEdit(c)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-500/10" title="Delete" onClick={() => setDeleteTarget(c)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* ── Create Case Dialog ─────────────────────────────── */}
            <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) { setEmployeeSearch(""); setShowEmpDropdown(false); } }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>New Disciplinary Case</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Employee</Label>
                            <div className="mt-1 relative">
                                <div className="flex items-center gap-2 px-3 min-h-[38px] rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring">
                                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    {form.employeeId && !showEmpDropdown ? (
                                        <div className="flex flex-1 items-center justify-between">
                                            <span className="text-sm truncate">
                                                {empMap.get(form.employeeId)?.name ?? form.employeeId}
                                                {empMap.get(form.employeeId)?.department && (
                                                    <span className="text-muted-foreground ml-1 text-xs">— {empMap.get(form.employeeId)?.department}</span>
                                                )}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => { setForm((f) => ({ ...f, employeeId: "" })); setEmployeeSearch(""); }}
                                                className="ml-2 rounded-full hover:bg-destructive/20 p-0.5 shrink-0"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <Input
                                            placeholder="Search employee…"
                                            value={employeeSearch}
                                            onChange={(e) => { setEmployeeSearch(e.target.value); setShowEmpDropdown(true); }}
                                            onFocus={() => setShowEmpDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowEmpDropdown(false), 200)}
                                            className="border-0 shadow-none p-0 h-6 flex-1 focus-visible:ring-0"
                                        />
                                    )}
                                </div>
                                {showEmpDropdown && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-md max-h-[200px] overflow-y-auto">
                                        {filteredEmpOptions.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-3">No employees found</p>
                                        ) : (
                                            filteredEmpOptions.map((e) => (
                                                <button
                                                    key={e.id}
                                                    type="button"
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                                                    onMouseDown={(ev) => ev.preventDefault()}
                                                    onClick={() => {
                                                        setForm((f) => ({ ...f, employeeId: e.id }));
                                                        setEmployeeSearch("");
                                                        setShowEmpDropdown(false);
                                                    }}
                                                >
                                                    <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="font-medium truncate">{e.name}</p>
                                                        {e.department && <p className="text-[10px] text-muted-foreground">{e.department}</p>}
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Violation Type</Label>
                                <Input value={form.violationType} placeholder="e.g. Tardiness, Insubordination"
                                    onChange={(e) => setForm((f) => ({ ...f, violationType: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Policy Reference (optional)</Label>
                                <Input value={form.policyReference} placeholder="e.g. Code of Conduct §4.2"
                                    onChange={(e) => setForm((f) => ({ ...f, policyReference: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Incident Date</Label>
                                <Input type="date" value={form.incidentDate}
                                    max={new Date().toISOString().slice(0, 10)}
                                    onChange={(e) => setForm((f) => ({ ...f, incidentDate: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Location (optional)</Label>
                                <Input value={form.incidentLocation}
                                    onChange={(e) => setForm((f) => ({ ...f, incidentLocation: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-sm font-medium">Description</Label>
                            <Textarea rows={6} value={form.description}
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                placeholder="Detailed description of the incident…"
                                className="resize-none max-h-[9rem] overflow-y-auto" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate}>Create Case</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Edit Case Dialog ───────────────────────────────── */}
            <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditingCase(null); }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Edit Case - {" "}
                            <span className="font-mono text-sm text-muted-foreground">{editingCase?.caseNumber}</span>
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Violation Type</Label>
                                <Input value={editForm.violationType} placeholder="e.g. Tardiness, Insubordination"
                                    onChange={(e) => setEditForm((f) => ({ ...f, violationType: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Policy Reference (optional)</Label>
                                <Input value={editForm.policyReference} placeholder="e.g. Code of Conduct §4.2"
                                    onChange={(e) => setEditForm((f) => ({ ...f, policyReference: e.target.value }))} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Incident Date</Label>
                                <Input type="date" value={editForm.incidentDate}
                                    max={new Date().toISOString().slice(0, 10)}
                                    onChange={(e) => setEditForm((f) => ({ ...f, incidentDate: e.target.value }))} />
                            </div>
                            <div>
                                <Label>Location (optional)</Label>
                                <Input value={editForm.incidentLocation}
                                    onChange={(e) => setEditForm((f) => ({ ...f, incidentLocation: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <Label>Status</Label>
                            <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as DisciplinaryCaseStatus }))}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(STATUS_LABELS) as DisciplinaryCaseStatus[]).map((s) => (
                                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-sm font-medium">Description</Label>
                            <Textarea rows={6} value={editForm.description}
                                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                                placeholder="Detailed description of the incident…"
                                className="resize-none max-h-[9rem] overflow-y-auto" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveEdit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirmation ────────────────────────────── */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Case</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to permanently delete case{" "}
                            <strong>{deleteTarget?.caseNumber}</strong>? This will also remove all associated NTE and NOD records and cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ── Summary tile ───────────────────────────────────────────────────────────────

type SummaryAccent = "amber" | "orange" | "red" | "blue" | "emerald" | "muted";
const ACCENT_STYLES: Record<SummaryAccent, { value: string; icon: string; dot: string }> = {
    amber:   { value: "text-amber-600",   icon: "text-amber-500",   dot: "bg-amber-500" },
    orange:  { value: "text-orange-600",  icon: "text-orange-500",  dot: "bg-orange-500" },
    red:     { value: "text-red-600",     icon: "text-red-500",     dot: "bg-red-500" },
    blue:    { value: "text-blue-600",    icon: "text-blue-500",    dot: "bg-blue-500" },
    emerald: { value: "text-emerald-600", icon: "text-emerald-500", dot: "bg-emerald-500" },
    muted:   { value: "text-muted-foreground", icon: "text-muted-foreground/60", dot: "bg-muted-foreground/40" },
};

function SummaryTile({
    label, value, icon: Icon, accent, isLast = false,
}: {
    label: string; value: number; icon: typeof FileText;
    accent: SummaryAccent; isLast?: boolean;
}) {
    const s = ACCENT_STYLES[accent];
    return (
        <div className={`flex flex-col gap-3 px-5 py-4 ${isLast ? "" : "border-b sm:border-b-0 sm:border-r last:border-0"}`.trim()}>
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
                <Icon className={`h-4 w-4 shrink-0 ${s.icon}`} />
            </div>
            <div className="flex items-end gap-2">
                <span className={`text-3xl font-bold tabular-nums leading-none ${s.value}`}>{value}</span>
                {value > 0 && <span className={`mb-0.5 h-1.5 w-1.5 rounded-full ${s.dot}`} />}
            </div>
        </div>
    );
}