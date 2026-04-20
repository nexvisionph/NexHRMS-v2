"use client";

import { useState, useMemo } from "react";
import type { Payslip } from "@/types";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Eye, CheckCircle, CreditCard, Search, FileText, Upload, Image } from "lucide-react";
import { PayslipDetail } from "./payslip-detail";
import { PayslipSignatureViewer } from "./payslip-signature-viewer";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
    published: { label: "Published", color: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
    signed: { label: "Signed", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
};

type PaymentMethod = "bank_transfer" | "gcash" | "cash" | "check";

interface PayslipTableProps {
    payslips: Payslip[];
    getEmpName: (id: string) => string;
    onMarkPaid?: (id: string, method: PaymentMethod, reference: string, cashAmount?: number, paymentProofUrl?: string) => void;
    isAdmin?: boolean;
}

export function PayslipTable({ payslips, getEmpName, onMarkPaid, isAdmin }: PayslipTableProps) {
    const [statusFilter, setStatusFilter] = useState("all");
    const [signedFilter, setSignedFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [detailId, setDetailId] = useState<string | null>(null);
    const [sigViewId, setSigViewId] = useState<string | null>(null);
    const [markPaidId, setMarkPaidId] = useState<string | null>(null);
    const [payMethod, setPayMethod] = useState<"bank_transfer" | "gcash" | "cash" | "check">("bank_transfer");
    const [payRef, setPayRef] = useState("");
    const [cashAmount, setCashAmount] = useState<number | undefined>(undefined);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const filtered = useMemo(() => {
        return payslips.filter((p) => {
            const matchStatus = statusFilter === "all" || p.status === statusFilter;
            const matchSigned =
                signedFilter === "all" ||
                (signedFilter === "signed" && !!p.signedAt) ||
                (signedFilter === "unsigned" && !p.signedAt);
            const matchSearch =
                !searchTerm ||
                getEmpName(p.employeeId).toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.id.toLowerCase().includes(searchTerm.toLowerCase());
            return matchStatus && matchSigned && matchSearch;
        });
    }, [payslips, statusFilter, signedFilter, searchTerm, getEmpName]);

    const detailPayslip = payslips.find((p) => p.id === detailId);
    const sigViewPayslip = payslips.find((p) => p.id === sigViewId);
    const markPaidPayslip = payslips.find((p) => p.id === markPaidId);

    // Handle file selection for proof of payment
    const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setProofFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setProofPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const resetPaymentDialog = () => {
        setMarkPaidId(null);
        setPayRef("");
        setCashAmount(undefined);
        setProofFile(null);
        setProofPreview(null);
        setPayMethod("bank_transfer");
    };

    const handleConfirmPaid = async () => {
        if (!markPaidId) return;

        // Validation based on payment method
        if (payMethod === "cash") {
            // Cash: amount is optional (defaults to net pay)
        } else {
            // Bank/GCash/Check require reference
            if (!payRef.trim()) {
                toast.error(payMethod === "bank_transfer" ? "Please enter a bank reference number" : 
                           payMethod === "gcash" ? "Please enter a GCash reference ID" : 
                           "Please enter a check number");
                return;
            }
        }

        let proofUrl: string | undefined;

        // Upload proof image if provided
        if (proofFile) {
            setIsUploading(true);
            try {
                const formData = new FormData();
                formData.append("file", proofFile);
                formData.append("bucket", "payment-proofs");
                formData.append("folder", markPaidId);

                const response = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });

                if (response.ok) {
                    const data = await response.json();
                    proofUrl = data.url;
                } else {
                    toast.error("Failed to upload proof of payment");
                    setIsUploading(false);
                    return;
                }
            } catch {
                toast.error("Failed to upload proof of payment");
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        const finalCashAmount = payMethod === "cash" ? (cashAmount ?? markPaidPayslip?.netPay) : undefined;
        onMarkPaid?.(markPaidId, payMethod, payRef, finalCashAmount, proofUrl);
        resetPaymentDialog();
        toast.success("Payment confirmed");
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search employee..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-[180px] h-8 text-xs"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={signedFilter} onValueChange={setSignedFilter}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue placeholder="Signed" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="signed">Signed</SelectItem>
                        <SelectItem value="unsigned">Unsigned</SelectItem>
                    </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground ml-auto">{filtered.length} payslips</span>
            </div>

            {/* Table */}
            <Card className="border border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">Employee</TableHead>
                                    <TableHead className="text-xs">Period</TableHead>
                                    <TableHead className="text-xs text-right">Net Pay</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs">Signed?</TableHead>
                                    <TableHead className="text-xs">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12">
                                            <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                                            <p className="text-sm text-muted-foreground">No payslips found</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((ps) => {
                                        const sc = statusConfig[ps.status] ?? statusConfig.issued;
                                        return (
                                            <TableRow key={ps.id}>
                                                <TableCell className="text-sm font-medium">{getEmpName(ps.employeeId)}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {ps.periodStart} \u2013 {ps.periodEnd}
                                                </TableCell>
                                                <TableCell className="text-sm text-right font-mono">
                                                    {formatCurrency(ps.netPay)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={`text-[10px] ${sc.color}`}>
                                                        {sc.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {ps.signedAt ? (
                                                        <button
                                                            onClick={() => setSigViewId(ps.id)}
                                                            className="flex items-center gap-1 text-emerald-600 hover:underline text-xs"
                                                        >
                                                            <CheckCircle className="h-3 w-3" />
                                                            {new Date(ps.signedAt).toLocaleDateString()}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">Pending</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0"
                                                            onClick={() => setDetailId(ps.id)}
                                                            title="View Details"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {isAdmin && ps.status === "published" && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-emerald-600"
                                                                onClick={() => setMarkPaidId(ps.id)}
                                                                title="Mark as Paid"
                                                            >
                                                                <CreditCard className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
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

            {/* Detail dialog */}
            {detailPayslip && (
                <PayslipDetail
                    payslip={detailPayslip}
                    employeeName={getEmpName(detailPayslip.employeeId)}
                    open={!!detailId}
                    onClose={() => setDetailId(null)}
                />
            )}

            {/* Signature viewer */}
            {sigViewPayslip && (
                <PayslipSignatureViewer
                    open={!!sigViewId}
                    onClose={() => setSigViewId(null)}
                    employeeName={getEmpName(sigViewPayslip.employeeId)}
                    period={`${sigViewPayslip.periodStart} \u2013 ${sigViewPayslip.periodEnd}`}
                    netPay={formatCurrency(sigViewPayslip.netPay)}
                    signatureDataUrl={sigViewPayslip.signatureDataUrl}
                    signedAt={sigViewPayslip.signedAt}
                    status={sigViewPayslip.status}
                />
            )}

            {/* Mark as Paid dialog */}
            <Dialog open={!!markPaidId} onOpenChange={() => resetPaymentDialog()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Confirm Payment
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Payment Method */}
                        <div>
                            <Label className="text-xs font-medium text-muted-foreground">Payment Method</Label>
                            <Select value={payMethod} onValueChange={(v) => setPayMethod(v as typeof payMethod)}>
                                <SelectTrigger className="mt-1 h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                    <SelectItem value="gcash">GCash</SelectItem>
                                    <SelectItem value="cash">Cash</SelectItem>
                                    <SelectItem value="check">Check</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Dynamic fields based on payment method */}
                        {payMethod === "bank_transfer" && (
                            <div>
                                <Label className="text-xs font-medium text-muted-foreground">Bank Reference Number</Label>
                                <Input
                                    value={payRef}
                                    onChange={(e) => setPayRef(e.target.value)}
                                    placeholder="e.g. BPI-202401150001"
                                    className="mt-1 h-9"
                                />
                            </div>
                        )}

                        {payMethod === "gcash" && (
                            <div>
                                <Label className="text-xs font-medium text-muted-foreground">GCash Reference ID</Label>
                                <Input
                                    value={payRef}
                                    onChange={(e) => setPayRef(e.target.value)}
                                    placeholder="e.g. 1234567890123"
                                    className="mt-1 h-9"
                                />
                            </div>
                        )}

                        {payMethod === "check" && (
                            <div>
                                <Label className="text-xs font-medium text-muted-foreground">Check Number</Label>
                                <Input
                                    value={payRef}
                                    onChange={(e) => setPayRef(e.target.value)}
                                    placeholder="e.g. CHK-00012345"
                                    className="mt-1 h-9"
                                />
                            </div>
                        )}

                        {payMethod === "cash" && (
                            <div>
                                <Label className="text-xs font-medium text-muted-foreground">
                                    Cash Amount <span className="text-muted-foreground/60">(defaults to net pay: {formatCurrency(markPaidPayslip?.netPay ?? 0)})</span>
                                </Label>
                                <Input
                                    type="number"
                                    value={cashAmount ?? ""}
                                    onChange={(e) => setCashAmount(e.target.value ? Number(e.target.value) : undefined)}
                                    placeholder={`${markPaidPayslip?.netPay ?? 0}`}
                                    className="mt-1 h-9"
                                />
                            </div>
                        )}

                        {/* Proof of Payment (optional) */}
                        <div>
                            <Label className="text-xs font-medium text-muted-foreground">
                                Proof of Payment <span className="text-muted-foreground/60">(optional)</span>
                            </Label>
                            <div className="mt-1">
                                {proofPreview ? (
                                    <div className="relative border rounded-md overflow-hidden">
                                        <img 
                                            src={proofPreview} 
                                            alt="Payment proof preview" 
                                            className="w-full h-32 object-cover"
                                        />
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="absolute top-2 right-2 h-7 text-xs"
                                            onClick={() => {
                                                setProofFile(null);
                                                setProofPreview(null);
                                            }}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                                        <div className="flex flex-col items-center justify-center pt-2 pb-3">
                                            <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                                            <p className="text-xs text-muted-foreground">Click to upload image</p>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleProofFileChange}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="outline" size="sm" onClick={() => resetPaymentDialog()} disabled={isUploading}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleConfirmPaid} className="gap-1.5" disabled={isUploading}>
                                {isUploading ? (
                                    <>Uploading...</>
                                ) : (
                                    <><CheckCircle className="h-4 w-4" /> Confirm</>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
