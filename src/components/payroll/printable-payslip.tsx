"use client";

import { useRef } from "react";
import type { Payslip, PayrollSignatureConfig } from "@/types";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Printer, Download, CheckCircle } from "lucide-react";

interface PrintablePayslipProps {
    payslip: Payslip;
    employeeName: string;
    department: string;
    companyName?: string;
    authorizedSignature?: PayrollSignatureConfig;
    open: boolean;
    onClose: () => void;
}

export function PrintablePayslip({
    payslip, employeeName, department, companyName = "Soren Data Solutions Inc.", authorizedSignature, open, onClose,
}: PrintablePayslipProps) {
    const printRef = useRef<HTMLDivElement>(null);

    const totalDeductions = (payslip.sssDeduction || 0) + (payslip.philhealthDeduction || 0) +
        (payslip.pagibigDeduction || 0) + (payslip.taxDeduction || 0) +
        (payslip.otherDeductions || 0) + (payslip.loanDeduction || 0);

    const totalEarnings = (payslip.grossPay || 0) + (payslip.allowances || 0) + (payslip.holidayPay || 0);

    const handlePrint = () => {
        if (!printRef.current) return;
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payslip - ${employeeName} - ${payslip.periodStart} to ${payslip.periodEnd}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1a1a1a; font-size: 12px; }
                    .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
                    .header h1 { font-size: 18px; font-weight: 700; }
                    .header p { font-size: 10px; color: #666; margin-top: 2px; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
                    .info-grid .label { font-size: 10px; color: #666; text-transform: uppercase; }
                    .info-grid .value { font-size: 12px; font-weight: 600; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                    th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #e5e5e5; }
                    th { font-size: 10px; text-transform: uppercase; color: #666; font-weight: 600; }
                    td { font-size: 12px; }
                    .text-right { text-align: right; }
                    .font-bold { font-weight: 700; }
                    .text-red { color: #dc2626; }
                    .text-green { color: #16a34a; }
                    .net-pay { border-top: 2px solid #1a1a1a; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: 700; }
                    .net-pay .amount { color: #16a34a; font-size: 20px; }
                    .signature-section { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
                    .sig-line { border-top: 1px solid #666; padding-top: 4px; text-align: center; font-size: 10px; color: #666; margin-top: 48px; }
                    .sig-image { max-height: 48px; margin: 8px auto 0; display: block; }
                    .footer { margin-top: 24px; text-align: center; border-top: 1px solid #e5e5e5; padding-top: 8px; font-size: 9px; color: #999; }
                    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; background: #e5e5e5; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                ${printRef.current.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Printer className="h-4 w-4" /> Printable Payslip
                    </DialogTitle>
                </DialogHeader>

                <div className="flex gap-2 justify-end -mt-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePrint}>
                        <Printer className="h-3.5 w-3.5" /> Print
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePrint}>
                        <Download className="h-3.5 w-3.5" /> Save as PDF
                    </Button>
                </div>

                {/* Printable content */}
                <div ref={printRef} className="border rounded-lg p-6 bg-white text-black text-xs">
                    {/* Company Header */}
                    <div className="header" style={{ textAlign: "center", borderBottom: "2px solid #1a1a1a", paddingBottom: "12px", marginBottom: "16px" }}>
                        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>{companyName}</h1>
                        <p style={{ fontSize: "10px", color: "#666", marginTop: "2px" }}>PAYSLIP — CONFIDENTIAL</p>
                    </div>

                    {/* Employee Info Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                        <div>
                            <p style={{ fontSize: "10px", color: "#666", textTransform: "uppercase" }}>Employee Name</p>
                            <p style={{ fontSize: "12px", fontWeight: 600 }}>{employeeName}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: "10px", color: "#666", textTransform: "uppercase" }}>Department</p>
                            <p style={{ fontSize: "12px", fontWeight: 600 }}>{department}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: "10px", color: "#666", textTransform: "uppercase" }}>Pay Period</p>
                            <p style={{ fontSize: "12px", fontWeight: 600 }}>{payslip.periodStart} — {payslip.periodEnd}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: "10px", color: "#666", textTransform: "uppercase" }}>Issued Date</p>
                            <p style={{ fontSize: "12px", fontWeight: 600 }}>{payslip.issuedAt}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: "10px", color: "#666", textTransform: "uppercase" }}>Pay Frequency</p>
                            <p style={{ fontSize: "12px", fontWeight: 600 }}>{(payslip.payFrequency || "semi_monthly").replace("_", "-")}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: "10px", color: "#666", textTransform: "uppercase" }}>Status</p>
                            <p style={{ fontSize: "12px", fontWeight: 600 }}>{payslip.status.toUpperCase()}</p>
                        </div>
                    </div>

                    {/* Earnings Table */}
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px" }}>
                        <thead>
                            <tr style={{ borderBottom: "2px solid #e5e5e5" }}>
                                <th style={{ padding: "6px 8px", textAlign: "left", fontSize: "10px", textTransform: "uppercase", color: "#666", fontWeight: 600 }}>Earnings</th>
                                <th style={{ padding: "6px 8px", textAlign: "right", fontSize: "10px", textTransform: "uppercase", color: "#666", fontWeight: 600 }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                <td style={{ padding: "6px 8px" }}>Basic Pay (Gross)</td>
                                <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatCurrency(payslip.grossPay)}</td>
                            </tr>
                            <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                <td style={{ padding: "6px 8px" }}>Allowances</td>
                                <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatCurrency(payslip.allowances)}</td>
                            </tr>
                            {(payslip.holidayPay ?? 0) !== 0 && (
                                <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                    <td style={{ padding: "6px 8px" }}>Holiday Pay (DOLE)</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatCurrency(payslip.holidayPay ?? 0)}</td>
                                </tr>
                            )}
                            <tr style={{ borderBottom: "2px solid #1a1a1a", fontWeight: 700 }}>
                                <td style={{ padding: "6px 8px" }}>Total Earnings</td>
                                <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatCurrency(totalEarnings)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Deductions Table */}
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px" }}>
                        <thead>
                            <tr style={{ borderBottom: "2px solid #e5e5e5" }}>
                                <th style={{ padding: "6px 8px", textAlign: "left", fontSize: "10px", textTransform: "uppercase", color: "#dc2626", fontWeight: 600 }}>Deductions</th>
                                <th style={{ padding: "6px 8px", textAlign: "right", fontSize: "10px", textTransform: "uppercase", color: "#dc2626", fontWeight: 600 }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                <td style={{ padding: "6px 8px" }}>SSS Contribution</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", color: "#dc2626" }}>{formatCurrency(payslip.sssDeduction)}</td>
                            </tr>
                            <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                <td style={{ padding: "6px 8px" }}>PhilHealth</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", color: "#dc2626" }}>{formatCurrency(payslip.philhealthDeduction)}</td>
                            </tr>
                            <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                <td style={{ padding: "6px 8px" }}>Pag-IBIG (HDMF)</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", color: "#dc2626" }}>{formatCurrency(payslip.pagibigDeduction)}</td>
                            </tr>
                            <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                <td style={{ padding: "6px 8px" }}>Withholding Tax (BIR)</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", color: "#dc2626" }}>{formatCurrency(payslip.taxDeduction)}</td>
                            </tr>
                            {(payslip.otherDeductions || 0) > 0 && (
                                <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                    <td style={{ padding: "6px 8px" }}>Other Deductions</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#dc2626" }}>{formatCurrency(payslip.otherDeductions)}</td>
                                </tr>
                            )}
                            {(payslip.loanDeduction || 0) > 0 && (
                                <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                    <td style={{ padding: "6px 8px" }}>Loan Repayment</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#dc2626" }}>{formatCurrency(payslip.loanDeduction)}</td>
                                </tr>
                            )}
                            <tr style={{ borderBottom: "2px solid #1a1a1a", fontWeight: 700 }}>
                                <td style={{ padding: "6px 8px" }}>Total Deductions</td>
                                <td style={{ padding: "6px 8px", textAlign: "right", color: "#dc2626" }}>{formatCurrency(totalDeductions)}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Net Pay */}
                    <div style={{ borderTop: "3px solid #1a1a1a", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 700 }}>NET PAY</span>
                        <span style={{ fontSize: "22px", fontWeight: 700, color: "#16a34a" }}>{formatCurrency(payslip.netPay)}</span>
                    </div>

                    {payslip.notes && (
                        <div style={{ marginBottom: "16px", padding: "8px", background: "#f5f5f5", borderRadius: "4px", fontSize: "11px", color: "#666" }}>
                            <strong>Notes:</strong> {payslip.notes}
                        </div>
                    )}

                    {/* Signature Section */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", marginTop: "32px" }}>
                        <div>
                            {payslip.signatureDataUrl ? (
                                <div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={payslip.signatureDataUrl} alt="Employee signature" style={{ maxHeight: "48px", display: "block", margin: "0 auto 8px" }} />
                                    <div style={{ borderTop: "1px solid #666", paddingTop: "4px", textAlign: "center", fontSize: "10px", color: "#666" }}>
                                        Employee Signature
                                        <br />
                                        {payslip.signedAt && <span>Signed: {new Date(payslip.signedAt).toLocaleDateString()}</span>}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ borderTop: "1px solid #666", paddingTop: "4px", textAlign: "center", fontSize: "10px", color: "#666", marginTop: "48px" }}>
                                    Employee Signature
                                </div>
                            )}
                        </div>
                        <div>
                            {authorizedSignature?.mode === "auto" && authorizedSignature?.signatureDataUrl ? (
                                <div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={authorizedSignature.signatureDataUrl} alt="Authorized signature" style={{ maxHeight: "48px", display: "block", margin: "0 auto 8px" }} />
                                    <div style={{ borderTop: "1px solid #666", paddingTop: "4px", textAlign: "center", fontSize: "10px", color: "#666" }}>
                                        Authorized Representative
                                        {authorizedSignature.signatoryName && <><br />{authorizedSignature.signatoryName}</>}
                                        {authorizedSignature.signatoryTitle && <><br /><span style={{ fontSize: "9px", color: "#999" }}>{authorizedSignature.signatoryTitle}</span></>}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ borderTop: "1px solid #666", paddingTop: "4px", textAlign: "center", fontSize: "10px", color: "#666", marginTop: "48px" }}>
                                    Authorized Representative
                                    {authorizedSignature?.signatoryName && <><br />{authorizedSignature.signatoryName}</>}
                                    {authorizedSignature?.signatoryTitle && <><br /><span style={{ fontSize: "9px", color: "#999" }}>{authorizedSignature.signatoryTitle}</span></>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Payment info */}
                    {payslip.paidAt && (
                        <div style={{ marginTop: "16px", fontSize: "10px", color: "#666", textAlign: "center" }}>
                            Payment confirmed on {new Date(payslip.paidAt).toLocaleDateString()}
                            {payslip.paymentMethod && ` via ${payslip.paymentMethod.replace("_", " ")}`}
                            {payslip.bankReferenceId && ` (Ref: ${payslip.bankReferenceId})`}
                        </div>
                    )}

                    {/* Acknowledgment */}
                    {payslip.acknowledgedAt && (
                        <div style={{ marginTop: "8px", fontSize: "10px", color: "#16a34a", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                            <CheckCircle style={{ width: "12px", height: "12px" }} />
                            Receipt acknowledged on {new Date(payslip.acknowledgedAt).toLocaleDateString()}
                        </div>
                    )}

                    {/* Footer */}
                    <div style={{ marginTop: "24px", borderTop: "1px solid #e5e5e5", paddingTop: "8px", textAlign: "center", fontSize: "9px", color: "#999" }}>
                        This is a system-generated payslip from {companyName}. Payslip ID: {payslip.id}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
