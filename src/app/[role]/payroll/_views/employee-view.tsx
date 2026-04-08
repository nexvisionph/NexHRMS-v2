"use client";

import { useState, useMemo, useCallback } from "react";
import { usePayrollStore } from "@/store/payroll.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Eye, PenTool, Sparkles, Printer, AlertCircle, FileSignature, Clock, ShieldCheck, Info } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/ui/signature-pad";
import { PrintablePayslip } from "@/components/payroll/printable-payslip";
import { dispatchNotification } from "@/lib/notifications";
import { formatCurrency } from "@/lib/format";
import { keysToCamel } from "@/lib/db-utils";

/* ═══════════════════════════════════════════════════════════════
   EMPLOYEE PAYROLL VIEW — "My Payslips"
   Full e-sign & acknowledge flow with status tracking
   ═══════════════════════════════════════════════════════════════ */

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock; step: number }> = {
    issued:       { label: "Issued",       color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", icon: CheckCircle,   step: 1 },
    confirmed:    { label: "Confirmed",    color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",          icon: CheckCircle,   step: 2 },
    published:    { label: "Published",    color: "bg-violet-500/15 text-violet-700 dark:text-violet-400",    icon: FileSignature, step: 3 },
    paid:         { label: "Paid",         color: "bg-blue-500/15 text-blue-700 dark:text-blue-400",          icon: ShieldCheck,   step: 4 },
    acknowledged: { label: "Acknowledged", color: "bg-teal-500/15 text-teal-700 dark:text-teal-400",          icon: CheckCircle,   step: 5 },
};

export default function EmployeePayrollView() {
    const { payslips, updatePayslipFromServer, signatureConfig } = usePayrollStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);

    const [viewSlip, setViewSlip] = useState<string | null>(null);
    const [signSlip, setSignSlip] = useState<string | null>(null);
    const [printPayslipId, setPrintPayslipId] = useState<string | null>(null);
    const [signingInProgress, setSigningInProgress] = useState(false);
    const [acknowledging, setAcknowledging] = useState(false);

    const myEmployee = useMemo(
        () => employees.find((e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name),
        [employees, currentUser.email, currentUser.name],
    );

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    const myPayslips = useMemo(() => {
        if (!myEmployee) return [];
        return payslips
            .filter((p) => p.employeeId === myEmployee.id)
            .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    }, [payslips, myEmployee]);

    const viewedPayslip = viewSlip ? payslips.find((p) => p.id === viewSlip) : null;
    const signingPayslip = signSlip ? payslips.find((p) => p.id === signSlip) : null;

    // ─── Computed stats ───────────────────────────────────────────
    const totalEarned = useMemo(() => myPayslips.reduce((s, p) => s + p.netPay, 0), [myPayslips]);
    const latestPayslip = myPayslips[0];
    // Employees can sign once payslip is issued (any status that isn't "acknowledged" and not yet signed)
    const pendingSign = useMemo(() => myPayslips.filter((p) => ["issued", "confirmed", "published", "paid"].includes(p.status) && !p.signedAt), [myPayslips]);
    const pendingAck = useMemo(() => myPayslips.filter((p) => p.status === "paid" && !!p.signedAt && !p.acknowledgedAt), [myPayslips]);

    // ─── E-Sign handler (calls API first, then updates store with server data) ───
    const handleSign = useCallback(async (payslipId: string, signatureDataUrl: string) => {
        if (!myEmployee) return;
        setSigningInProgress(true);
        try {
            // Call API first (uses admin client, bypasses RLS)
            const res = await fetch("/api/payroll/sign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payslipId, employeeId: myEmployee.id, signatureDataUrl }),
            });
            const data = await res.json();
            if (!res.ok) {
                console.error("[payroll/sign] API error:", data.message);
                toast.error(data.message || "Failed to sign payslip");
                return;
            }
            // Update local store with server response (timestamps match DB, avoids write-through conflicts)
            if (data.payslip) {
                const camelPayslip = keysToCamel(data.payslip) as { id: string };
                updatePayslipFromServer(camelPayslip);
            }
            dispatchNotification("payslip_signed", {
                name: myEmployee.name,
                period: (() => { const ps = payslips.find(p => p.id === payslipId); return ps ? `${ps.periodStart} — ${ps.periodEnd}` : ""; })(),
            }, myEmployee.id);
            toast.success("Payslip signed successfully!");
            setSignSlip(null);
        } catch (err) {
            console.error("[payroll/sign]", err);
            toast.error("Failed to sign payslip. Please try again.");
        } finally {
            setSigningInProgress(false);
        }
    }, [myEmployee, updatePayslipFromServer, payslips]);

    // ─── Acknowledge handler ─────────────────────────────────────
    const handleAcknowledge = useCallback(async (payslipId: string) => {
        if (!myEmployee) return;
        setAcknowledging(true);
        try {
            // Call API first (uses admin client, bypasses RLS)
            const res = await fetch("/api/payroll/acknowledge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payslipId, employeeId: myEmployee.id }),
            });
            const data = await res.json();
            if (!res.ok) {
                console.error("[payroll/acknowledge] API error:", data.message);
                toast.error(data.message || "Failed to acknowledge");
                return;
            }
            // Update local store with server response (timestamps match DB)
            if (data.payslip) {
                const camelPayslip = keysToCamel(data.payslip) as { id: string };
                updatePayslipFromServer(camelPayslip);
            }
            toast.success("Payment receipt acknowledged — thank you!");
        } catch (err) {
            console.error("[payroll/acknowledge]", err);
            toast.error("Failed to acknowledge. Please try again.");
        } finally {
            setAcknowledging(false);
        }
    }, [myEmployee, updatePayslipFromServer]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">My Payslips</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{myPayslips.length} payslip{myPayslips.length !== 1 ? "s" : ""}</p>
            </div>

            {/* Pending Actions Banner */}
            {(pendingSign.length > 0 || pendingAck.length > 0) && (
                <Card className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Action Required</p>
                                {pendingSign.length > 0 && (
                                    <p className="text-xs text-amber-700 dark:text-amber-400">
                                        {pendingSign.length} payslip{pendingSign.length > 1 ? "s" : ""} awaiting your e-signature
                                    </p>
                                )}
                                {pendingAck.length > 0 && (
                                    <p className="text-xs text-amber-700 dark:text-amber-400">
                                        {pendingAck.length} payment{pendingAck.length > 1 ? "s" : ""} awaiting your acknowledgement
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border border-border/50">
                    <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Payslips</p>
                        <p className="text-2xl font-bold mt-1">{myPayslips.length}</p>
                    </CardContent>
                </Card>
                <Card className="border border-border/50">
                    <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Earned</p>
                        <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(totalEarned)}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border border-border/50">
                    <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Latest Net Pay</p>
                        <p className="text-2xl font-bold mt-1">
                            {latestPayslip ? formatCurrency(latestPayslip.netPay) : "—"}
                        </p>
                        {latestPayslip && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                {latestPayslip.periodStart} – {latestPayslip.periodEnd}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue={pendingSign.length > 0 || pendingAck.length > 0 ? "pending" : "all"}>
                <TabsList>
                    {(pendingSign.length > 0 || pendingAck.length > 0) && (
                        <TabsTrigger value="pending" className="gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Needs Action
                            <Badge variant="destructive" className="ml-1 h-4 px-1 text-[9px]">{pendingSign.length + pendingAck.length}</Badge>
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="all">All Payslips</TabsTrigger>
                </TabsList>

                {/* Pending Actions Tab */}
                {(pendingSign.length > 0 || pendingAck.length > 0) && (
                    <TabsContent value="pending" className="mt-4 space-y-4">
                        {pendingSign.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-sm font-medium flex items-center gap-2">
                                    <PenTool className="h-4 w-4 text-violet-500" />
                                    Awaiting Your E-Signature ({pendingSign.length})
                                </p>
                                {pendingSign.map((ps) => (
                                    <Card key={ps.id} className="border border-violet-200 dark:border-violet-800">
                                        <CardContent className="p-4 flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{ps.periodStart} – {ps.periodEnd}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Net Pay: <span className="font-semibold text-foreground">{formatCurrency(ps.netPay)}</span>
                                                </p>
                                            </div>
                                            <Badge variant="secondary" className={statusConfig[ps.status]?.color || ""}>
                                                {statusConfig[ps.status]?.label || ps.status}
                                            </Badge>
                                            <Button
                                                size="sm"
                                                className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                                                onClick={() => setSignSlip(ps.id)}
                                            >
                                                <PenTool className="h-3.5 w-3.5" />
                                                E-Sign
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                        {pendingAck.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-sm font-medium flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-blue-500" />
                                    Awaiting Payment Acknowledgement ({pendingAck.length})
                                </p>
                                {pendingAck.map((ps) => (
                                    <Card key={ps.id} className="border border-blue-200 dark:border-blue-800">
                                        <CardContent className="p-4 flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{ps.periodStart} – {ps.periodEnd}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    Net Pay: <span className="font-semibold text-foreground">{formatCurrency(ps.netPay)}</span>
                                                    {ps.paymentMethod && <span className="ml-2 capitalize">via {ps.paymentMethod.replace("_", " ")}</span>}
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="gap-1.5"
                                                disabled={acknowledging}
                                                onClick={() => handleAcknowledge(ps.id)}
                                            >
                                                <CheckCircle className="h-3.5 w-3.5" />
                                                {acknowledging ? "Processing..." : "I Confirm Receipt"}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                )}

                {/* All Payslips Tab */}
                <TabsContent value="all" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Period</TableHead>
                                            <TableHead className="text-xs">Gross</TableHead>
                                            <TableHead className="text-xs">Deductions</TableHead>
                                            <TableHead className="text-xs">Net Pay</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs">E-Signature</TableHead>
                                            <TableHead className="text-xs w-24">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myPayslips.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                                                    No payslips available yet. Payslips will appear here once issued by payroll.
                                                </TableCell>
                                            </TableRow>
                                        ) : myPayslips.map((ps) => {
                                            const sc = statusConfig[ps.status] || statusConfig.issued;
                                            const totalDed = (ps.sssDeduction || 0) + (ps.philhealthDeduction || 0) + (ps.pagibigDeduction || 0) + (ps.taxDeduction || 0) + (ps.otherDeductions || 0) + (ps.loanDeduction || 0);
                                            const canSign = ["issued", "confirmed", "published", "paid"].includes(ps.status) && !ps.signedAt;
                                            const canAck = ps.status === "paid" && !!ps.signedAt && !ps.acknowledgedAt;
                                            return (
                                                <TableRow key={ps.id}>
                                                    <TableCell className="text-xs text-muted-foreground">{ps.periodStart} – {ps.periodEnd}</TableCell>
                                                    <TableCell className="text-xs">{formatCurrency(ps.grossPay || 0)}</TableCell>
                                                    <TableCell className="text-xs text-red-500">−{formatCurrency(totalDed)}</TableCell>
                                                    <TableCell className="text-sm font-medium">{formatCurrency(ps.netPay)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={`text-[10px] ${sc.color}`}>
                                                            {sc.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {ps.acknowledgedAt ? (
                                                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title={`Acknowledged ${new Date(ps.acknowledgedAt).toLocaleString()}`}>
                                                                <ShieldCheck className="h-3.5 w-3.5" />
                                                                <span className="text-[10px] font-medium">Done</span>
                                                            </span>
                                                        ) : ps.signedAt ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title={`Signed ${new Date(ps.signedAt).toLocaleString()}`}>
                                                                    <CheckCircle className="h-3.5 w-3.5" />
                                                                    <span className="text-[10px] font-medium">Signed</span>
                                                                </span>
                                                                {canAck && (
                                                                    <Button
                                                                        variant="ghost" size="sm"
                                                                        className="h-6 gap-1 text-blue-600 dark:text-blue-400 px-1.5"
                                                                        disabled={acknowledging}
                                                                        onClick={() => handleAcknowledge(ps.id)}
                                                                    >
                                                                        <ShieldCheck className="h-3 w-3" />
                                                                        <span className="text-[9px]">Acknowledge</span>
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ) : canSign ? (
                                                            <Button
                                                                variant="ghost" size="sm"
                                                                className="h-7 gap-1.5 text-violet-600 dark:text-violet-400 px-2 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                                                                onClick={() => setSignSlip(ps.id)}
                                                            >
                                                                <PenTool className="h-3.5 w-3.5" />
                                                                <span className="text-xs font-medium">E-Sign</span>
                                                            </Button>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1" title="Payslip must be published before you can sign">
                                                                <Info className="h-3 w-3" /> Pending
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewSlip(ps.id)} title="View details">
                                                                <Eye className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Print payslip" onClick={() => setPrintPayslipId(ps.id)}>
                                                                <Printer className="h-3.5 w-3.5" />
                                                            </Button>
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
                </TabsContent>
            </Tabs>

            {/* ═══ E-Sign Dialog ═══ */}
            <Dialog open={!!signSlip} onOpenChange={() => setSignSlip(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileSignature className="h-5 w-5 text-violet-500" />
                            E-Sign Payslip
                        </DialogTitle>
                    </DialogHeader>
                    {signingPayslip && (
                        <div className="space-y-4 pt-1">
                            {/* Payslip summary */}
                            <Card className="border border-border/50 bg-muted/30">
                                <CardContent className="p-3 space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium">Period</span>
                                        <span className="text-sm">{signingPayslip.periodStart} – {signingPayslip.periodEnd}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium">Net Pay</span>
                                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(signingPayslip.netPay)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-muted-foreground">Gross: {formatCurrency(signingPayslip.grossPay || 0)}</span>
                                        <span className="text-xs text-red-500">Deductions: −{formatCurrency(
                                            (signingPayslip.sssDeduction || 0) + (signingPayslip.philhealthDeduction || 0) +
                                            (signingPayslip.pagibigDeduction || 0) + (signingPayslip.taxDeduction || 0) +
                                            (signingPayslip.otherDeductions || 0) + (signingPayslip.loanDeduction || 0)
                                        )}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Legal text */}
                            <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-lg p-3">
                                <p className="text-xs text-violet-800 dark:text-violet-300 leading-relaxed">
                                    By signing below, I acknowledge that I have reviewed this payslip and confirm that all
                                    details including gross pay, deductions, and net pay are correct to the best of my knowledge.
                                </p>
                            </div>

                            {/* Signature Pad */}
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Draw Your Signature</p>
                                <SignaturePad
                                    onSave={(dataUrl) => handleSign(signingPayslip.id, dataUrl)}
                                    onCancel={() => setSignSlip(null)}
                                />
                                {signingInProgress && (
                                    <p className="text-xs text-muted-foreground mt-2 text-center animate-pulse">Saving signature...</p>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ═══ Payslip Detail Dialog ═══ */}
            <Dialog open={!!viewSlip} onOpenChange={() => setViewSlip(null)}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center justify-between">
                            <span>Payslip Detail</span>
                            {viewedPayslip && (
                                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { setPrintPayslipId(viewedPayslip.id); setViewSlip(null); }}>
                                    <Printer className="h-3.5 w-3.5" /> Print / Download
                                </Button>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    {viewedPayslip && (
                        <div className="space-y-4 pt-2">
                            <Card className="border border-border/50">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{getEmpName(viewedPayslip.employeeId)}</p>
                                            <p className="text-xs text-muted-foreground">{viewedPayslip.periodStart} – {viewedPayslip.periodEnd}</p>
                                            {viewedPayslip.payFrequency && (
                                                <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                                                    {viewedPayslip.payFrequency.replace("_", "-")} payroll
                                                </p>
                                            )}
                                        </div>
                                        <Badge variant="secondary" className={`text-[10px] ${
                                            statusConfig[viewedPayslip.status]?.color || ""
                                        }`}>
                                            {statusConfig[viewedPayslip.status]?.label || viewedPayslip.status}
                                        </Badge>
                                    </div>

                                    {/* Status Progress */}
                                    <div className="flex items-center gap-1 py-2">
                                        {["issued", "confirmed", "published", "paid", "acknowledged"].map((step, i) => {
                                            const currentStep = statusConfig[viewedPayslip.status]?.step || 1;
                                            const stepNum = i + 1;
                                            const isActive = stepNum <= currentStep;
                                            return (
                                                <div key={step} className="flex items-center gap-1 flex-1">
                                                    <div className={`h-1.5 flex-1 rounded-full ${isActive ? "bg-emerald-500" : "bg-muted"}`} />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Earnings */}
                                    <div className="border-t border-border/50 pt-3 space-y-1.5">
                                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">Earnings</p>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Gross Pay</span>
                                            <span>{formatCurrency(viewedPayslip.grossPay || 0)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Allowances</span>
                                            <span>+{formatCurrency(viewedPayslip.allowances || 0)}</span>
                                        </div>
                                        {(viewedPayslip.holidayPay ?? 0) !== 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                    <Sparkles className="h-3 w-3" /> Holiday Pay (DOLE)
                                                </span>
                                                <span className={(viewedPayslip.holidayPay ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}>
                                                    {(viewedPayslip.holidayPay ?? 0) > 0 ? "+" : ""}{formatCurrency(viewedPayslip.holidayPay ?? 0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Deductions */}
                                    <div className="border-t border-border/50 pt-3 space-y-1.5">
                                        <p className="text-[10px] font-semibold uppercase text-red-500">Deductions</p>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">SSS</span><span className="text-red-500">−{formatCurrency(viewedPayslip.sssDeduction || 0)}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">PhilHealth</span><span className="text-red-500">−{formatCurrency(viewedPayslip.philhealthDeduction || 0)}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Pag-IBIG</span><span className="text-red-500">−{formatCurrency(viewedPayslip.pagibigDeduction || 0)}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Withholding Tax</span><span className="text-red-500">−{formatCurrency(viewedPayslip.taxDeduction || 0)}</span></div>
                                        {(viewedPayslip.otherDeductions || 0) > 0 && (
                                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Other</span><span className="text-red-500">−{formatCurrency(viewedPayslip.otherDeductions)}</span></div>
                                        )}
                                        {(viewedPayslip.loanDeduction || 0) > 0 && (
                                            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Loan Repayment</span><span className="text-red-500">−{formatCurrency(viewedPayslip.loanDeduction)}</span></div>
                                        )}
                                    </div>

                                    {/* Net Pay */}
                                    <div className="border-t-2 border-border pt-3">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Net Pay</span>
                                            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(viewedPayslip.netPay)}</span>
                                        </div>
                                    </div>

                                    {/* Signature / Accept Section */}
                                    <div className="border-t border-border/50 pt-4 space-y-3">
                                        {viewedPayslip.signedAt ? (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-semibold uppercase text-emerald-600">Employee E-Signature</p>
                                                <div className="border border-border/50 rounded-md bg-white p-2">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={viewedPayslip.signatureDataUrl} alt="Signature" className="h-12 object-contain" />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                                                    Signed on {new Date(viewedPayslip.signedAt).toLocaleString()}
                                                </p>
                                                {viewedPayslip.status === "paid" && !viewedPayslip.acknowledgedAt && (
                                                    <Button
                                                        size="sm" className="w-full gap-1.5 mt-2"
                                                        disabled={acknowledging}
                                                        onClick={() => handleAcknowledge(viewedPayslip.id)}
                                                    >
                                                        <ShieldCheck className="h-3.5 w-3.5" /> {acknowledging ? "Processing..." : "I Confirm Receipt of Payment"}
                                                    </Button>
                                                )}
                                                {viewedPayslip.acknowledgedAt && (
                                                    <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-2">
                                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                            <ShieldCheck className="h-3 w-3" />
                                                            Receipt acknowledged on {new Date(viewedPayslip.acknowledgedAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : ["published", "paid"].includes(viewedPayslip.status) ? (
                                            <div className="space-y-2">
                                                <Button
                                                    className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                                                    onClick={() => { setViewSlip(null); setSignSlip(viewedPayslip.id); }}
                                                >
                                                    <PenTool className="h-4 w-4" />
                                                    E-Sign This Payslip
                                                </Button>
                                                <p className="text-[10px] text-muted-foreground text-center">
                                                    Sign to acknowledge you have reviewed and accepted this payslip
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-muted/30 rounded-md text-center">
                                                <p className="text-xs text-muted-foreground italic">Payslip must be published before you can e-sign.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Meta */}
                                    <div className="border-t border-border/50 pt-2 space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground"><span>Issued</span><span>{viewedPayslip.issuedAt}</span></div>
                                        {viewedPayslip.confirmedAt && (
                                            <div className="flex justify-between text-xs text-muted-foreground"><span>Confirmed</span><span>{new Date(viewedPayslip.confirmedAt).toLocaleDateString()}</span></div>
                                        )}
                                        {viewedPayslip.publishedAt && (
                                            <div className="flex justify-between text-xs text-muted-foreground"><span>Published</span><span>{new Date(viewedPayslip.publishedAt).toLocaleDateString()}</span></div>
                                        )}
                                        {viewedPayslip.paidAt && (
                                            <div className="flex justify-between text-xs text-muted-foreground"><span>Paid</span><span>{new Date(viewedPayslip.paidAt).toLocaleDateString()}</span></div>
                                        )}
                                        {viewedPayslip.paymentMethod && (
                                            <div className="flex justify-between text-xs text-muted-foreground"><span>Method</span><span className="capitalize">{viewedPayslip.paymentMethod.replace("_", " ")}</span></div>
                                        )}
                                        {viewedPayslip.bankReferenceId && (
                                            <div className="flex justify-between text-xs text-muted-foreground"><span>Ref</span><span className="font-mono">{viewedPayslip.bankReferenceId}</span></div>
                                        )}
                                        {viewedPayslip.notes && (
                                            <div className="pt-1"><p className="text-xs text-muted-foreground">Notes: {viewedPayslip.notes}</p></div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Printable Payslip Dialog */}
            {(() => {
                const printPS = printPayslipId ? payslips.find((p) => p.id === printPayslipId) : null;
                return printPS ? (
                    <PrintablePayslip
                        payslip={printPS}
                        employeeName={myEmployee?.name || printPS.employeeId}
                        department={myEmployee?.department || ""}
                        authorizedSignature={signatureConfig}
                        open={!!printPayslipId}
                        onClose={() => setPrintPayslipId(null)}
                    />
                ) : null;
            })()}
        </div>
    );
}
