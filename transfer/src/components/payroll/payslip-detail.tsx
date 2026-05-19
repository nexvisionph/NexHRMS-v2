"use client";

import { useState } from "react";
import type { Payslip } from "@/types";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SignaturePad } from "@/components/ui/signature-pad";
import { FileText, PenTool, CheckCircle, Image as ImageIcon } from "lucide-react";
import { useAppearanceStore } from "@/store/appearance.store";

const paymentMethodLabels: Record<string, string> = {
    bank_transfer: "Bank Transfer",
    gcash: "GCash",
    cash: "Cash",
    check: "Check",
};

const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    published: { label: "Published", color: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
    signed: { label: "Signed", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    paid: { label: "Paid", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
    payment_hold: { label: "Published", color: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
};

interface PayslipDetailProps {
    payslip: Payslip;
    employeeName: string;
    department?: string;
    jobTitle?: string;
    onSign?: (signatureDataUrl: string) => void;
    onAcknowledge?: () => void;
    open: boolean;
    onClose: () => void;
}

export function PayslipDetail({ payslip, employeeName, department, jobTitle, onSign, onAcknowledge, open, onClose }: PayslipDetailProps) {
    const [showSignature, setShowSignature] = useState(false);
    const sc = statusConfig[payslip.status] ?? { label: payslip.status, color: "bg-muted text-muted-foreground" };
    const logoUrl = useAppearanceStore((s) => s.logoUrl);
    const companyName = useAppearanceStore((s) => s.companyName);

    const handleSign = (dataUrl: string) => {
        onSign?.(dataUrl);
        setShowSignature(false);
    };

    const canSign = (payslip.status === "published" || payslip.status === "payment_hold") && !payslip.signedAt;
    const canAcknowledge = payslip.status === "signed" && !!payslip.signedAt && !payslip.acknowledgedAt;
    const visibleNotes = payslip.notes
        ?.split("\n")
        .filter((line) => !line.startsWith("Payment hold:"))
        .join("\n")
        .trim();

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Payslip Detail
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Company branding */}
                    <div className="flex flex-col items-center gap-1 pb-3 border-b">
                        {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoUrl} alt={companyName} className="max-h-14 max-w-44 object-contain" />
                        ) : (
                            <p className="font-bold text-sm text-center">{companyName}</p>
                        )}
                        {!logoUrl && <p className="text-xs text-muted-foreground">{companyName}</p>}
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Payslip — Confidential</p>
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold">{employeeName}</p>
                            {(department || jobTitle) && (
                                <p className="text-xs text-muted-foreground">
                                    {[jobTitle, department].filter(Boolean).join(" · ")}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                {payslip.periodStart} &ndash; {payslip.periodEnd}
                            </p>
                        </div>
                        <Badge variant="secondary" className={sc.color}>{sc.label}</Badge>
                    </div>

                    <Separator />

                    {/* Breakdown */}
                    <div className="space-y-2 text-sm">
                        <Row label="Basic Pay" value={formatCurrency(payslip.grossPay)} />
                        <Row label="Allowances / OT / Benefits" value={formatCurrency(payslip.allowances)} />
                        {payslip.holidayPay ? <Row label="Holiday Pay" value={formatCurrency(payslip.holidayPay)} /> : null}
                        <Separator />
                        <Row label="SSS" value={`-${formatCurrency(payslip.sssDeduction)}`} negative />
                        <Row label="PhilHealth" value={`-${formatCurrency(payslip.philhealthDeduction)}`} negative />
                        <Row label="Pag-IBIG" value={`-${formatCurrency(payslip.pagibigDeduction)}`} negative />
                        <Row label="Tax (BIR)" value={`-${formatCurrency(payslip.taxDeduction)}`} negative />
                        {!!(payslip.loanDeduction) && <Row label="Loan Deduction" value={`-${formatCurrency(payslip.loanDeduction)}`} negative />}
                        {!!(payslip.otherDeductions) && <Row label="Other Deductions" value={`-${formatCurrency(payslip.otherDeductions)}`} negative />}
                        {!!(payslip.customDeductions) && <Row label="Custom Deductions" value={`-${formatCurrency(payslip.customDeductions)}`} negative />}
                        {!!(payslip.lateDeduction) && <Row label="Late Penalty" value={`-${formatCurrency(payslip.lateDeduction)}`} negative />}
                        {!!(payslip.absentDeduction) && <Row label="Absent Deduction" value={`-${formatCurrency(payslip.absentDeduction)}`} negative />}
                        {!!(payslip.undertimeDeduction) && <Row label="Undertime Deduction" value={`-${formatCurrency(payslip.undertimeDeduction)}`} negative />}
                        <Separator />
                        <div className="flex justify-between font-semibold text-base">
                            <span>Net Pay</span>
                            <span className="text-emerald-600">{formatCurrency(payslip.netPay)}</span>
                        </div>
                    </div>

                    {/* Attendance Summary */}
                    {(payslip.attendanceDaysPresent !== undefined || payslip.attendanceDaysAbsent !== undefined || payslip.attendanceLateMinutes !== undefined || payslip.dailyRate) && (
                        <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attendance Summary</p>
                            {payslip.attendanceDaysPresent !== undefined && (
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Days Present</span><span className="font-medium text-emerald-600">{payslip.attendanceDaysPresent}</span></div>
                            )}
                            {!!(payslip.attendanceDaysAbsent) && (
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Days Absent</span><span className="font-medium text-red-600">{payslip.attendanceDaysAbsent}</span></div>
                            )}
                            {!!(payslip.attendanceLateMinutes) && (
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Late</span><span className="font-medium text-amber-600">{payslip.attendanceLateMinutes} min</span></div>
                            )}
                            {!!(payslip.attendanceUndertimeHours) && (
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Undertime</span><span className="font-medium text-amber-600">{payslip.attendanceUndertimeHours.toFixed(1)} hrs</span></div>
                            )}
                            {(payslip.dailyRate || payslip.hourlyRate) && (
                                <>
                                    <Separator className="my-1" />
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rate Computation</p>
                                    {payslip.dailyRate ? (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Daily Rate</span><span className="font-medium">{formatCurrency(payslip.dailyRate)}</span></div>
                                    ) : null}
                                    {payslip.hourlyRate ? (
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Hourly Rate</span><span className="font-medium">{formatCurrency(payslip.hourlyRate)}</span></div>
                                    ) : null}
                                    {payslip.dailyRate && payslip.attendanceDaysPresent !== undefined ? (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Computed Basic</span>
                                            <span className="font-medium">{formatCurrency(payslip.dailyRate)} × {payslip.attendanceDaysPresent} days</span>
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
                    )}

                    {visibleNotes && (
                        <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">{visibleNotes}</p>
                    )}

                    {/* Signature status */}
                    <div className="border-t pt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Signature</p>
                        {payslip.signedAt ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    <span className="text-sm">Signed on {new Date(payslip.signedAt).toLocaleDateString()}</span>
                                </div>
                                {payslip.signatureDataUrl && (
                                    <div className="border rounded-lg p-2 bg-white">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={payslip.signatureDataUrl} alt="Signature" className="max-h-20 mx-auto" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">Not yet signed</p>
                        )}
                    </div>

                    {/* Payment confirmation */}
                    {payslip.paidAt && (
                        <div className="border-t pt-3 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment</p>
                            <p className="text-sm">Confirmed: {new Date(payslip.paidAt).toLocaleDateString()}</p>
                            {payslip.paymentMethod && (
                                <p className="text-xs text-muted-foreground">
                                    Method: {paymentMethodLabels[payslip.paymentMethod] || payslip.paymentMethod}
                                </p>
                            )}
                            {payslip.bankReferenceId && (
                                <p className="text-xs text-muted-foreground">
                                    {payslip.paymentMethod === "gcash" ? "GCash ID" : 
                                     payslip.paymentMethod === "check" ? "Check No" : "Ref"}: {payslip.bankReferenceId}
                                </p>
                            )}
                            {payslip.paymentMethod === "cash" && payslip.cashAmount && (
                                <p className="text-xs text-muted-foreground">
                                    Amount: {formatCurrency(payslip.cashAmount)}
                                </p>
                            )}
                            {payslip.paidConfirmedBy && (
                                <p className="text-xs text-muted-foreground">By: {payslip.paidConfirmedBy}</p>
                            )}
                            {payslip.paymentProofUrl && (
                                <div className="mt-2">
                                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                                        <ImageIcon className="h-3 w-3" /> Proof of Payment
                                    </p>
                                    <div className="border rounded-lg overflow-hidden">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img 
                                            src={payslip.paymentProofUrl} 
                                            alt="Payment proof" 
                                            className="w-full max-h-48 object-contain bg-muted/30 cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => window.open(payslip.paymentProofUrl, "_blank")}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground/60 mt-1">Click image to view full size</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Acknowledgement */}
                    {payslip.acknowledgedAt && (
                        <div className="border-t pt-3 space-y-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receipt Acknowledged</p>
                            <p className="text-sm">{new Date(payslip.acknowledgedAt).toLocaleDateString()}</p>
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-2">
                        {canSign && (
                            <Button onClick={() => setShowSignature(true)} className="gap-1.5" size="sm">
                                <PenTool className="h-4 w-4" /> Sign Payslip
                            </Button>
                        )}
                        {canAcknowledge && (
                            <Button onClick={onAcknowledge} variant="outline" className="gap-1.5" size="sm">
                                <CheckCircle className="h-4 w-4" /> I Confirm Receipt
                            </Button>
                        )}
                    </div>
                </div>

                {/* Signature Pad Dialog */}
                {showSignature && (
                    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
                        <Card className="w-full max-w-md">
                            <CardContent className="p-6 space-y-4">
                                <p className="text-sm font-semibold">Sign Your Payslip</p>
                                <p className="text-xs text-muted-foreground">
                                    By signing, you acknowledge receipt of payslip for {payslip.periodStart} &ndash; {payslip.periodEnd} with net pay {formatCurrency(payslip.netPay)}.
                                </p>
                                <SignaturePad
                                    onSave={handleSign}
                                    onCancel={() => setShowSignature(false)}
                                />
                            </CardContent>
                        </Card>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
    return (
        <div className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className={negative ? "text-red-600 dark:text-red-400" : ""}>{value}</span>
        </div>
    );
}
