"use client";

import { useState, useMemo } from "react";
import { useLeaveStore } from "@/store/leave.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useAttendanceStore } from "@/store/attendance.store";
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
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Check, X, Palmtree, Stethoscope, AlertTriangle, FileQuestion, FileText, Pencil, Trash2, Baby, Heart, Users } from "lucide-react";
import { toast } from "sonner";
import { dispatchNotification } from "@/lib/notifications";
import { useAuditStore } from "@/store/audit.store";
import type { LeaveType } from "@/types";

/* ═══════════════════════════════════════════════════════════════
   ADMIN/HR/SUPERVISOR VIEW — Leave Management
   Org-wide stats, all requests, approve/reject, policy management
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

export default function AdminLeaveView() {
    const { requests, policies, addRequest, updateStatus, updatePolicy, deletePolicy } = useLeaveStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const [open, setOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState("all");

    // Policy edit/delete state
    const [polDialogOpen, setPolDialogOpen] = useState(false);
    const [polEditing, setPolEditing] = useState<typeof policies[0] | null>(null);
    const [polName, setPolName] = useState("");
    const [polEntitlement, setPolEntitlement] = useState("");
    const [polMaxBalance, setPolMaxBalance] = useState("");
    const [polCarryForward, setPolCarryForward] = useState(false);
    const [polMaxCarry, setPolMaxCarry] = useState("");
    const [polNegative, setPolNegative] = useState(false);
    const [polAttachment, setPolAttachment] = useState(false);
    const [polExpiry, setPolExpiry] = useState("");
    const [polDeleteId, setPolDeleteId] = useState<string | null>(null);

    const openEditPolicy = (p: typeof policies[0]) => {
        setPolEditing(p);
        setPolName(p.name);
        setPolEntitlement(String(p.annualEntitlement));
        setPolMaxBalance(String(p.maxBalance));
        setPolCarryForward(p.carryForwardAllowed);
        setPolMaxCarry(String(p.maxCarryForward));
        setPolNegative(p.negativeLeaveAllowed);
        setPolAttachment(p.attachmentRequired);
        setPolExpiry(String(p.expiryMonths));
        setPolDialogOpen(true);
    };

    const handleSavePolicy = () => {
        if (!polName.trim() || !polEntitlement) { toast.error("Name and entitlement are required"); return; }
        if (polEditing) {
            updatePolicy(polEditing.id, {
                name: polName.trim(),
                annualEntitlement: Number(polEntitlement),
                maxBalance: Number(polMaxBalance) || Number(polEntitlement),
                carryForwardAllowed: polCarryForward,
                maxCarryForward: Number(polMaxCarry) || 0,
                negativeLeaveAllowed: polNegative,
                attachmentRequired: polAttachment,
                expiryMonths: Number(polExpiry) || 12,
            });
            toast.success(`"${polName}" policy updated`);
        }
        setPolDialogOpen(false);
        setPolEditing(null);
    };

    // Form state
    const [formType, setFormType] = useState<LeaveType>("VL");
    const [formStart, setFormStart] = useState("");
    const [formEnd, setFormEnd] = useState("");
    const [formReason, setFormReason] = useState("");
    const [formEmpId, setFormEmpId] = useState("");

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    // Org-wide leave balances
    const balances = useMemo(() => {
        const result: Record<LeaveType, { alloc: number; used: number; remaining: number }> = {} as never;
        for (const type of ["VL", "SL", "EL", "OTHER", "ML", "PL", "SPL"] as LeaveType[]) {
            const policyEntitlement = policies.find((p) => p.leaveType === type)?.annualEntitlement ?? LEAVE_ALLOC_FALLBACK[type];
            const approved = requests.filter((r) => r.status === "approved" && r.type === type);
            const usedDays = approved.reduce((sum, r) => sum + daysBetween(r.startDate, r.endDate), 0);
            const alloc = policyEntitlement * employees.filter((e) => e.status === "active").length;
            result[type] = { alloc, used: usedDays, remaining: Math.max(0, alloc - usedDays) };
        }
        return result;
    }, [requests, employees, policies]);

    // All requests
    const filteredRequests = requests.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        return true;
    });

    const handleSubmit = () => {
        if (!formEmpId) { toast.error("Please select an employee"); return; }
        if (!formStart || !formEnd || formReason.length < 5) {
            toast.error("Please fill all fields. Reason must be at least 5 characters.");
            return;
        }
        if (formEnd < formStart) { toast.error("End date cannot be before start date"); return; }
        addRequest({ employeeId: formEmpId, type: formType, startDate: formStart, endDate: formEnd, reason: formReason });
        toast.success("Leave request submitted!");
        setOpen(false);
        setFormStart(""); setFormEnd(""); setFormReason(""); setFormEmpId("");
    };

    const handleApprove = (id: string, employeeId: string, startDate: string, endDate: string) => {
        updateStatus(id, "approved", currentUser.id);
        // Sync leave→attendance: mark days as on_leave
        const start = new Date(startDate);
        const end = new Date(endDate);
        const logs = useAttendanceStore.getState().logs;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split("T")[0];
            const existing = logs.find((l) => l.employeeId === employeeId && l.date === dateStr);
            if (!existing) {
                useAttendanceStore.setState((s) => ({
                    logs: [...s.logs, { id: `ATT-${dateStr}-${employeeId}`, employeeId, date: dateStr, status: "on_leave" as const }],
                }));
            } else if (existing.status !== "on_leave") {
                useAttendanceStore.setState((s) => ({
                    logs: s.logs.map((l) => l.id === existing.id ? { ...l, status: "on_leave" as const } : l),
                }));
            }
        }
        dispatchNotification("leave_approved", { name: getEmpName(employeeId), startDate, endDate }, employeeId);
        useAuditStore.getState().log({ entityType: "leave", entityId: id, action: "leave_approved", performedBy: currentUser.id });
        toast.success("Leave approved & attendance updated");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{filteredRequests.length} requests</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-1.5"><Plus className="h-4 w-4" /> New Request</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Submit Leave Request</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <Select value={formEmpId} onValueChange={setFormEmpId}>
                                <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                                <SelectContent>
                                    {employees.filter((e) => e.status === "active").map((e) => (
                                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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

            {/* Org-wide Balance Cards */}
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
                                        <p className="text-lg font-bold">{b.used}</p>
                                    </div>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">{b.used} days used org-wide</p>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Tabs: Requests + Policies */}
            <Tabs defaultValue="requests">
                <TabsList>
                    <TabsTrigger value="requests">Leave Requests</TabsTrigger>
                    <TabsTrigger value="policies" className="gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> Policies
                        <span className="ml-1 bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 rounded-full">{policies.length}</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="requests" className="mt-4 space-y-4">
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
                                            <TableHead className="text-xs">Employee</TableHead>
                                            <TableHead className="text-xs">Type</TableHead>
                                            <TableHead className="text-xs">From</TableHead>
                                            <TableHead className="text-xs">To</TableHead>
                                            <TableHead className="text-xs">Days</TableHead>
                                            <TableHead className="text-xs">Reason</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs w-24">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRequests.length === 0 ? (
                                            <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No leave requests</TableCell></TableRow>
                                        ) : filteredRequests.map((req) => (
                                            <TableRow key={req.id}>
                                                <TableCell className="text-sm font-medium">{getEmpName(req.employeeId)}</TableCell>
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
                                                <TableCell>
                                                    {req.status === "pending" && (
                                                        <div className="flex items-center gap-1">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10" onClick={() => handleApprove(req.id, req.employeeId, req.startDate, req.endDate)}>
                                                                <Check className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-500/10" onClick={() => { updateStatus(req.id, "rejected", currentUser.id); dispatchNotification("leave_rejected", { name: getEmpName(req.employeeId) }, req.employeeId); useAuditStore.getState().log({ entityType: "leave", entityId: req.id, action: "leave_rejected", performedBy: currentUser.id }); toast.success("Leave rejected"); }}>
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="policies" className="mt-4 space-y-4">
                    <p className="text-sm text-muted-foreground">PH-compliant leave policies with accrual, carry-forward, and balance management.</p>
                    <div className="grid gap-4">
                        {policies.map((policy) => (
                            <Card key={policy.id} className="border border-border/50">
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            {LEAVE_ICONS[policy.leaveType as LeaveType] || <FileQuestion className="h-4 w-4" />}
                                            <div>
                                                <p className="font-medium text-sm">{policy.name}</p>
                                                <p className="text-xs text-muted-foreground">{policy.leaveType}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[10px]">{policy.accrualFrequency}</Badge>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPolicy(policy)} title="Edit policy">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => setPolDeleteId(policy.id)} title="Delete policy">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                        <div>
                                            <p className="text-muted-foreground">Days/Year</p>
                                            <p className="font-medium">{policy.annualEntitlement}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Max Balance</p>
                                            <p className="font-medium">{policy.maxBalance}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Carry Forward</p>
                                            <Badge variant="outline" className={`text-[10px] ${policy.carryForwardAllowed ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700"}`}>
                                                {policy.carryForwardAllowed ? "Yes" : "No"}
                                            </Badge>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Negative Leave</p>
                                            <Badge variant="outline" className={`text-[10px] ${policy.negativeLeaveAllowed ? "bg-amber-500/10 text-amber-700" : "bg-slate-500/10 text-slate-700"}`}>
                                                {policy.negativeLeaveAllowed ? "Allowed" : "No"}
                                            </Badge>
                                        </div>
                                        {policy.attachmentRequired && (
                                            <div>
                                                <p className="text-muted-foreground">Attachment</p>
                                                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700">Required</Badge>
                                            </div>
                                        )}
                                        {policy.expiryMonths > 0 && (
                                            <div>
                                                <p className="text-muted-foreground">Expiry</p>
                                                <p className="font-medium">{policy.expiryMonths} months</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Edit Policy Dialog */}
            <Dialog open={polDialogOpen} onOpenChange={setPolDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Edit Leave Policy</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium">Policy Name</label>
                            <Input value={polName} onChange={(e) => setPolName(e.target.value)} className="mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground">Days/Year</label>
                                <Input type="number" min="0" value={polEntitlement} onChange={(e) => setPolEntitlement(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Max Balance</label>
                                <Input type="number" min="0" value={polMaxBalance} onChange={(e) => setPolMaxBalance(e.target.value)} className="mt-1" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground">Expiry (months)</label>
                                <Input type="number" min="0" value={polExpiry} onChange={(e) => setPolExpiry(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Max Carry Forward (days)</label>
                                <Input type="number" min="0" value={polMaxCarry} onChange={(e) => setPolMaxCarry(e.target.value)} className="mt-1" disabled={!polCarryForward} />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            {[{ label: "Allow Carry Forward", val: polCarryForward, set: setPolCarryForward }, { label: "Allow Negative Leave", val: polNegative, set: setPolNegative }, { label: "Require Attachment", val: polAttachment, set: setPolAttachment }].map(({ label, val, set }) => (
                                <label key={label} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="rounded" />
                                    <span className="text-sm">{label}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                            <Button variant="outline" className="flex-1" onClick={() => setPolDialogOpen(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleSavePolicy}>Save Changes</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Policy Confirmation */}
            <AlertDialog open={!!polDeleteId} onOpenChange={(o) => !o && setPolDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Leave Policy?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove &ldquo;{policies.find((p) => p.id === polDeleteId)?.name}&rdquo;. Existing leave balances using this type will not be affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (polDeleteId) { deletePolicy(polDeleteId); toast.success("Policy deleted"); setPolDeleteId(null); } }}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
