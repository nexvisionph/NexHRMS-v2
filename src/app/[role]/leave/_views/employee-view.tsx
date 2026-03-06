"use client";

import { useState, useMemo } from "react";
import { useLeaveStore } from "@/store/leave.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Palmtree, Stethoscope, AlertTriangle, FileQuestion, Baby, Heart, Users } from "lucide-react";
import { toast } from "sonner";
import type { LeaveType } from "@/types";

/* ═══════════════════════════════════════════════════════════════
   EMPLOYEE VIEW — My Leave Dashboard
   Personal balances, submit requests, view own request history
   ═══════════════════════════════════════════════════════════════ */

const LEAVE_ALLOC_FALLBACK: Record<LeaveType, number> = { VL: 15, SL: 10, EL: 5, OTHER: 5, ML: 105, PL: 7, SPL: 7 };
const LEAVE_LABELS: Record<LeaveType, string> = { VL: "Vacation", SL: "Sick", EL: "Emergency", OTHER: "Other", ML: "Maternity", PL: "Paternity", SPL: "Solo Parent" };
const LEAVE_ICONS: Record<LeaveType, React.ReactNode> = {
    VL: <Palmtree className="h-4 w-4" />,
    SL: <Stethoscope className="h-4 w-4" />,
    EL: <AlertTriangle className="h-4 w-4" />,
    OTHER: <FileQuestion className="h-4 w-4" />,
    ML: <Baby className="h-4 w-4" />,
    PL: <Heart className="h-4 w-4" />,
    SPL: <Users className="h-4 w-4" />,
};

function daysBetween(a: string, b: string) {
    const d1 = new Date(a); const d2 = new Date(b);
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1);
}

const leaveStatusColors: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export default function EmployeeLeaveView() {
    const { requests, policies, addRequest } = useLeaveStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const [open, setOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState("all");

    // Form state
    const [formType, setFormType] = useState<LeaveType>("VL");
    const [formStart, setFormStart] = useState("");
    const [formEnd, setFormEnd] = useState("");
    const [formReason, setFormReason] = useState("");

    const myEmpId = employees.find((e) => e.email === currentUser.email || e.name === currentUser.name)?.id;

    // Personal leave balances
    const balances = useMemo(() => {
        const result: Record<LeaveType, { alloc: number; used: number; remaining: number }> = {} as never;
        for (const type of ["VL", "SL", "EL", "OTHER", "ML", "PL", "SPL"] as LeaveType[]) {
            const policyEntitlement = policies.find((p) => p.leaveType === type)?.annualEntitlement ?? LEAVE_ALLOC_FALLBACK[type];
            const approved = requests.filter(
                (r) => r.status === "approved" && r.type === type && r.employeeId === myEmpId
            );
            const usedDays = approved.reduce((sum, r) => sum + daysBetween(r.startDate, r.endDate), 0);
            result[type] = { alloc: policyEntitlement, used: usedDays, remaining: Math.max(0, policyEntitlement - usedDays) };
        }
        return result;
    }, [requests, myEmpId, policies]);

    // My requests only
    const filteredRequests = requests.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (myEmpId && r.employeeId !== myEmpId) return false;
        return true;
    });

    const handleSubmit = () => {
        if (!formStart || !formEnd || formReason.length < 5) {
            toast.error("Please fill all fields. Reason must be at least 5 characters.");
            return;
        }
        if (formEnd < formStart) { toast.error("End date cannot be before start date"); return; }
        const empId = myEmpId || "EMP001";
        addRequest({ employeeId: empId, type: formType, startDate: formStart, endDate: formEnd, reason: formReason });
        toast.success("Leave request submitted!");
        setOpen(false);
        setFormStart(""); setFormEnd(""); setFormReason("");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">My Leave</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{filteredRequests.length} requests</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-1.5"><Plus className="h-4 w-4" /> New Request</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Submit Leave Request</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <Select value={formType} onValueChange={(v) => setFormType(v as LeaveType)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="VL">Vacation Leave</SelectItem>
                                    <SelectItem value="SL">Sick Leave</SelectItem>
                                    <SelectItem value="EL">Emergency Leave</SelectItem>
                                    <SelectItem value="OTHER">Other</SelectItem>
                                    <SelectItem value="ML">Maternity Leave (RA 11210)</SelectItem>
                                    <SelectItem value="PL">Paternity Leave (RA 8187)</SelectItem>
                                    <SelectItem value="SPL">Solo Parent Leave (RA 8972)</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Start Date</label>
                                    <Input type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">End Date</label>
                                    <Input type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="mt-1" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Reason</label>
                                <Textarea placeholder="Describe your reason..." value={formReason} onChange={(e) => setFormReason(e.target.value)} className="mt-1" rows={3} />
                            </div>
                            <Button onClick={handleSubmit} className="w-full">Submit Request</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Personal Leave Balance Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {(["VL", "SL", "EL", "OTHER", "ML", "PL", "SPL"] as LeaveType[]).map((type) => {
                    const b = balances[type];
                    const pct = b.alloc > 0 ? Math.round((b.used / b.alloc) * 100) : 0;
                    return (
                        <Card key={type} className="border border-border/50">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                        {LEAVE_ICONS[type]}
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">{LEAVE_LABELS[type]}</p>
                                        <p className="text-lg font-bold">{b.remaining}</p>
                                    </div>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">{b.used} used / {b.alloc} total</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Filter + Table */}
            <div className="flex items-center gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Filter" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card className="border border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">Type</TableHead>
                                    <TableHead className="text-xs">From</TableHead>
                                    <TableHead className="text-xs">To</TableHead>
                                    <TableHead className="text-xs">Days</TableHead>
                                    <TableHead className="text-xs">Reason</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequests.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No leave requests yet</TableCell></TableRow>
                                ) : filteredRequests.map((req) => (
                                    <TableRow key={req.id}>
                                        <TableCell><Badge variant="outline" className="text-[10px]">{req.type}</Badge></TableCell>
                                        <TableCell className="text-sm">{req.startDate}</TableCell>
                                        <TableCell className="text-sm">{req.endDate}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{daysBetween(req.startDate, req.endDate)}</TableCell>
                                        <TableCell className="text-sm max-w-[200px] truncate">{req.reason}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={`text-[10px] ${leaveStatusColors[req.status]}`}>
                                                {req.status}
                                            </Badge>
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
