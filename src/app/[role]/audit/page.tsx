"use client";

import { useState, useMemo } from "react";
import { useAuditStore } from "@/store/audit.store";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileSearch, Eye, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuditLogEntry } from "@/types";

const ACTION_COLORS: Record<string, string> = {
    salary_proposal: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    salary_approval: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    leave_approval: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    leave_rejection: "bg-red-500/15 text-red-700 dark:text-red-400",
    overtime_approval: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    overtime_rejection: "bg-red-500/15 text-red-700 dark:text-red-400",
    payroll_lock: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    payroll_publish: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    payment_record: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    adjustment_create: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
    adjustment_approve: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    loan_freeze: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    loan_unfreeze: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    loan_create: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
    employee_resign: "bg-red-500/15 text-red-700 dark:text-red-400",
    employee_activate: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    employee_deactivate: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    timesheet_approve: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    timesheet_reject: "bg-red-500/15 text-red-700 dark:text-red-400",
    attendance_exception_resolve: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
    final_pay_compute: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    payslip_sign: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

export default function AuditPage() {
    const { logs } = useAuditStore();
    const currentUser = useAuthStore((s) => s.currentUser);

    const { hasPermission } = useRolesStore();
    const canView = hasPermission(currentUser.role, "audit:view");

    const [actionFilter, setActionFilter] = useState("all");
    const [entityFilter, setEntityFilter] = useState("");
    const [performerFilter, setPerformerFilter] = useState("");
    const [viewLog, setViewLog] = useState<AuditLogEntry | null>(null);

    const filtered = useMemo(() => {
        let result = logs;
        if (actionFilter !== "all") result = result.filter((l) => l.action === actionFilter);
        if (entityFilter) result = result.filter((l) => l.entityId.toLowerCase().includes(entityFilter.toLowerCase()) || l.entityType.toLowerCase().includes(entityFilter.toLowerCase()));
        if (performerFilter) result = result.filter((l) => l.performedBy.toLowerCase().includes(performerFilter.toLowerCase()));
        return result.slice(0, 200);
    }, [logs, actionFilter, entityFilter, performerFilter]);

    const uniqueActions = useMemo(() => {
        const set = new Set(logs.map((l) => l.action).filter(Boolean));
        return Array.from(set).sort();
    }, [logs]);

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Shield className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Only Admin and Auditor roles can view audit logs.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {logs.length} total entries — immutable record of all system actions
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border border-blue-500/20 bg-blue-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Total Entries</p>
                        <p className="text-2xl font-bold mt-1">{logs.length}</p>
                    </CardContent>
                </Card>
                <Card className="border border-emerald-500/20 bg-emerald-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Unique Actions</p>
                        <p className="text-2xl font-bold mt-1">{uniqueActions.length}</p>
                    </CardContent>
                </Card>
                <Card className="border border-violet-500/20 bg-violet-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Today&apos;s Entries</p>
                        <p className="text-2xl font-bold mt-1">
                            {logs.filter((l) => l.timestamp.startsWith(new Date().toISOString().split("T")[0])).length}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <Card className="border border-border/50">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Filter by action" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Actions</SelectItem>
                                {uniqueActions.map((a) => (
                                    <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="Filter by entity..."
                            value={entityFilter}
                            onChange={(e) => setEntityFilter(e.target.value)}
                            className="w-full sm:w-[200px]"
                        />
                        <Input
                            placeholder="Filter by performer..."
                            value={performerFilter}
                            onChange={(e) => setPerformerFilter(e.target.value)}
                            className="w-full sm:w-[200px]"
                        />
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
                                <TableHead className="text-xs">Timestamp</TableHead>
                                <TableHead className="text-xs">Action</TableHead>
                                <TableHead className="text-xs">Entity</TableHead>
                                <TableHead className="text-xs">Performed By</TableHead>
                                <TableHead className="text-xs">Reason</TableHead>
                                <TableHead className="text-xs w-16"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No audit log entries</TableCell></TableRow>
                            ) : filtered.map((entry) => (
                                <TableRow key={entry.id}>
                                    <TableCell className="text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {new Date(entry.timestamp).toLocaleString()}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={`text-[10px] ${ACTION_COLORS[entry.action] || "bg-slate-500/15 text-slate-700 dark:text-slate-400"}`}>
                                            {entry.action.replace(/_/g, " ")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        <span className="text-muted-foreground">{entry.entityType}</span>
                                        <code className="ml-1 text-[10px] bg-muted px-1 py-0.5 rounded">{entry.entityId}</code>
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">{entry.performedBy}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{entry.reason || "—"}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewLog(entry)} title="View snapshots">
                                            <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                  </div>
                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={!!viewLog} onOpenChange={() => setViewLog(null)}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSearch className="h-5 w-5" /> Audit Entry Detail</DialogTitle></DialogHeader>
                    {viewLog && (
                        <div className="space-y-4 pt-2">
                            <Card className="border border-border/50">
                                <CardContent className="p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <p className="text-muted-foreground">Action</p>
                                            <Badge variant="secondary" className={`text-[10px] mt-1 ${ACTION_COLORS[viewLog.action] || ""}`}>
                                                {viewLog.action.replace(/_/g, " ")}
                                            </Badge>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Timestamp</p>
                                            <p className="font-mono">{new Date(viewLog.timestamp).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Entity Type</p>
                                            <p className="font-medium">{viewLog.entityType}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Entity ID</p>
                                            <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{viewLog.entityId}</code>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Performed By</p>
                                            <p className="font-medium">{viewLog.performedBy}</p>
                                        </div>
                                        {viewLog.reason && (
                                            <div>
                                                <p className="text-muted-foreground">Reason</p>
                                                <p>{viewLog.reason}</p>
                                            </div>
                                        )}
                                    </div>

                                    {viewLog.beforeSnapshot && (
                                        <div className="border-t border-border/50 pt-3">
                                            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">Before Snapshot</p>
                                            <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto max-h-32">
                                                {JSON.stringify(viewLog.beforeSnapshot, null, 2)}
                                            </pre>
                                        </div>
                                    )}

                                    {viewLog.afterSnapshot && (
                                        <div className="border-t border-border/50 pt-3">
                                            <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">After Snapshot</p>
                                            <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto max-h-32">
                                                {JSON.stringify(viewLog.afterSnapshot, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
