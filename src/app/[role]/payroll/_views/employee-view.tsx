"use client";

import { useState, useMemo } from "react";
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
import { CheckCircle, Eye, PenTool, Sparkles, Printer } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/ui/signature-pad";
import { PrintablePayslip } from "@/components/payroll/printable-payslip";
import { dispatchNotification } from "@/lib/notifications";

/* ═══════════════════════════════════════════════════════════════
   EMPLOYEE PAYROLL VIEW — "My Payslips"
   Shows only own published/paid/acknowledged payslips + signing
   ═══════════════════════════════════════════════════════════════ */

export default function EmployeePayrollView() {
    const { payslips, signPayslip, acknowledgePayslip } = usePayrollStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);

    const [viewSlip, setViewSlip] = useState<string | null>(null);
    const [printPayslipId, setPrintPayslipId] = useState<string | null>(null);

    const myEmployee = useMemo(
        () => employees.find((e) => e.profileId === currentUser.id || e.email === currentUser.email || e.name === currentUser.name),
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

    // ─── Summary stats ────────────────────────────────────────────
    const totalEarned = useMemo(() => myPayslips.reduce((s, p) => s + p.netPay, 0), [myPayslips]);
    const latestPayslip = myPayslips[0];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">My Payslips</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{myPayslips.length} payslip{myPayslips.length !== 1 ? "s" : ""}</p>
            </div>

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
                            ₱{totalEarned.toLocaleString()}
                        </p>
                    </CardContent>
                </Card>
                <Card className="border border-border/50">
                    <CardContent className="p-4">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Latest Net Pay</p>
                        <p className="text-2xl font-bold mt-1">
                            {latestPayslip ? `₱${latestPayslip.netPay.toLocaleString()}` : "—"}
                        </p>
                        {latestPayslip && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                {latestPayslip.periodStart} – {latestPayslip.periodEnd}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Payslips Table */}
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
                                    <TableHead className="text-xs">Sign</TableHead>
                                    <TableHead className="text-xs w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {myPayslips.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                                            No payslips available yet. Payslips will appear here once issued by payroll.
                                        </TableCell>
                                    </TableRow>
                                ) : myPayslips.map((ps) => (
                                    <TableRow key={ps.id}>
                                        <TableCell className="text-xs text-muted-foreground">{ps.periodStart} – {ps.periodEnd}</TableCell>
                                        <TableCell className="text-xs">₱{(ps.grossPay || 0).toLocaleString()}</TableCell>
                                        <TableCell className="text-xs text-red-500">
                                            −₱{((ps.sssDeduction || 0) + (ps.philhealthDeduction || 0) + (ps.pagibigDeduction || 0) + (ps.taxDeduction || 0) + (ps.otherDeductions || 0) + (ps.loanDeduction || 0)).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-sm font-medium">₱{ps.netPay.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={`text-[10px] ${
                                                ps.status === "acknowledged" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                                                ps.status === "paid" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400" :
                                                ps.status === "published" ? "bg-violet-500/15 text-violet-700 dark:text-violet-400" :
                                                ps.status === "confirmed" ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400" :
                                                ps.status === "issued" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                                                "bg-slate-500/15 text-slate-700 dark:text-slate-400"
                                            }`}>
                                                {ps.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {ps.signedAt ? (
                                                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title={`Signed ${new Date(ps.signedAt).toLocaleString()}`}>
                                                    <CheckCircle className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-medium">Signed</span>
                                                </span>
                                            ) : ["published", "paid"].includes(ps.status) ? (
                                                <Button variant="ghost" size="sm" className="h-7 gap-1 text-violet-600 px-2" onClick={() => setViewSlip(ps.id)}>
                                                    <PenTool className="h-3.5 w-3.5" />
                                                    <span className="text-[10px]">Sign</span>
                                                </Button>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewSlip(ps.id)}>
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Print payslip" onClick={() => setPrintPayslipId(ps.id)}>
                                                    <Printer className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Payslip Detail Dialog */}
            <Dialog open={!!viewSlip} onOpenChange={() => setViewSlip(null)}>
                <DialogContent className="max-w-md">
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
                                            viewedPayslip.status === "acknowledged" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                                            viewedPayslip.status === "paid" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400" :
                                            "bg-violet-500/15 text-violet-700 dark:text-violet-400"
                                        }`}>
                                            {viewedPayslip.status}
                                        </Badge>
                                    </div>

                                    {/* Earnings */}
                                    <div className="border-t border-border/50 pt-3 space-y-1.5">
                                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">Earnings</p>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Gross Pay</span>
                                            <span>₱{(viewedPayslip.grossPay || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Allowances</span>
                                            <span>+₱{(viewedPayslip.allowances || 0).toLocaleString()}</span>
                                        </div>
                                        {(viewedPayslip.holidayPay ?? 0) !== 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                    <Sparkles className="h-3 w-3" /> Holiday Pay (DOLE)
                                                </span>
                                                <span className={(viewedPayslip.holidayPay ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}>
                                                    {(viewedPayslip.holidayPay ?? 0) > 0 ? "+" : ""}₱{(viewedPayslip.holidayPay ?? 0).toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Deductions */}
                                    <div className="border-t border-border/50 pt-3 space-y-1.5">
                                        <p className="text-[10px] font-semibold uppercase text-red-500">Deductions</p>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">SSS</span>
                                            <span className="text-red-500">−₱{(viewedPayslip.sssDeduction || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">PhilHealth</span>
                                            <span className="text-red-500">−₱{(viewedPayslip.philhealthDeduction || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Pag-IBIG</span>
                                            <span className="text-red-500">−₱{(viewedPayslip.pagibigDeduction || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Withholding Tax</span>
                                            <span className="text-red-500">−₱{(viewedPayslip.taxDeduction || 0).toLocaleString()}</span>
                                        </div>
                                        {(viewedPayslip.otherDeductions || 0) > 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">Other</span>
                                                <span className="text-red-500">−₱{viewedPayslip.otherDeductions.toLocaleString()}</span>
                                            </div>
                                        )}
                                        {(viewedPayslip.loanDeduction || 0) > 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">Loan Repayment</span>
                                                <span className="text-red-500">−₱{viewedPayslip.loanDeduction.toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Net Pay */}
                                    <div className="border-t-2 border-border pt-3">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">Net Pay</span>
                                            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">₱{viewedPayslip.netPay.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Signature / Accept Section */}
                                    <div className="border-t border-border/50 pt-4">
                                        {viewedPayslip.signedAt ? (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-semibold uppercase text-emerald-600">Employee Acceptance</p>
                                                <div className="border border-border/50 rounded-md bg-white p-2">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={viewedPayslip.signatureDataUrl} alt="Signature" className="h-12 object-contain" />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3 text-emerald-500" />
                                                    Accepted on {new Date(viewedPayslip.signedAt).toLocaleString()}
                                                </p>
                                                {viewedPayslip.status === "paid" && !viewedPayslip.acknowledgedAt && (
                                                    <Button
                                                        size="sm" className="w-full gap-1.5 mt-2"
                                                        onClick={() => {
                                                            if (myEmployee) {
                                                                acknowledgePayslip(viewedPayslip.id, myEmployee.id);
                                                                toast.success("Receipt acknowledged — thank you!");
                                                            }
                                                        }}
                                                    >
                                                        <CheckCircle className="h-3.5 w-3.5" /> I Confirm Receipt
                                                    </Button>
                                                )}
                                                {viewedPayslip.acknowledgedAt && (
                                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
                                                        <CheckCircle className="h-3 w-3" />
                                                        Receipt acknowledged on {new Date(viewedPayslip.acknowledgedAt).toLocaleString()}
                                                    </p>
                                                )}
                                            </div>
                                        ) : ["published", "paid"].includes(viewedPayslip.status) ? (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-semibold uppercase text-muted-foreground">Sign to Acknowledge Payslip</p>
                                                <p className="text-xs text-muted-foreground mb-2">Draw your signature below to confirm you have reviewed this payslip.</p>
                                                <SignaturePad onSave={(data) => {
                                                    signPayslip(viewedPayslip.id, data);
                                                    dispatchNotification("payslip_signed", {
                                                        name: getEmpName(viewedPayslip.employeeId),
                                                        period: `${viewedPayslip.periodStart} — ${viewedPayslip.periodEnd}`,
                                                    }, viewedPayslip.employeeId);
                                                    toast.success("Payslip signed — thank you!");
                                                }} />
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-muted/30 rounded-md text-center">
                                                <p className="text-xs text-muted-foreground italic">Payslip must be published before you can sign.</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Meta */}
                                    <div className="border-t border-border/50 pt-2 space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Issued</span><span>{viewedPayslip.issuedAt}</span>
                                        </div>
                                        {viewedPayslip.publishedAt && (
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Published</span><span>{new Date(viewedPayslip.publishedAt).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                        {viewedPayslip.paidAt && (
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Paid</span><span>{new Date(viewedPayslip.paidAt).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                        {viewedPayslip.paymentMethod && (
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Method</span><span className="capitalize">{viewedPayslip.paymentMethod.replace("_", " ")}</span>
                                            </div>
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
                        open={!!printPayslipId}
                        onClose={() => setPrintPayslipId(null)}
                    />
                ) : null;
            })()}
        </div>
    );
}
