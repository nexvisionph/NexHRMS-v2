"use client";

import { useState } from "react";
import type { Payslip, AdjustmentType } from "@/types";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface CreateAdjustmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employees: { id: string; name: string }[];
    payslips: Payslip[];
    currentUserId: string;
    onSubmit: (data: {
        payrollRunId: string;
        employeeId: string;
        adjustmentType: AdjustmentType;
        referencePayslipId: string;
        amount: number;
        reason: string;
        createdBy: string;
    }) => void;
}

export function CreateAdjustmentDialog({
    open, onOpenChange, employees, payslips, currentUserId, onSubmit,
}: CreateAdjustmentDialogProps) {
    const [employeeId, setEmployeeId] = useState("");
    const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("earnings");
    const [refPayslipId, setRefPayslipId] = useState("");
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");

    const empPayslips = employeeId
        ? payslips.filter((p) => p.employeeId === employeeId).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
        : [];

    const handleSubmit = () => {
        if (!employeeId || !refPayslipId || !amount || !reason.trim()) {
            toast.error("Please fill in all required fields");
            return;
        }
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount === 0) {
            toast.error("Amount must be a non-zero number");
            return;
        }
        const refSlip = payslips.find((p) => p.id === refPayslipId);
        const runId = refSlip?.payrollBatchId || `RUN-${refSlip?.issuedAt || "manual"}`;

        onSubmit({
            payrollRunId: runId,
            employeeId,
            adjustmentType,
            referencePayslipId: refPayslipId,
            amount: adjustmentType === "deduction" ? -Math.abs(numAmount) : Math.abs(numAmount),
            reason: reason.trim(),
            createdBy: currentUserId,
        });
        toast.success("Adjustment created");
        setEmployeeId("");
        setAdjustmentType("earnings");
        setRefPayslipId("");
        setAmount("");
        setReason("");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Create Payroll Adjustment
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="text-xs font-medium">Employee</label>
                        <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setRefPayslipId(""); }}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                            <SelectContent>
                                {employees.filter((e) => e.id).map((e) => (
                                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs font-medium">Reference Payslip</label>
                        <Select value={refPayslipId} onValueChange={setRefPayslipId} disabled={!employeeId}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder={employeeId ? "Select payslip" : "Select employee first"} /></SelectTrigger>
                            <SelectContent>
                                {empPayslips.filter((p) => p.id).map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.periodStart} – {p.periodEnd} ({formatCurrency(p.netPay)})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs font-medium">Adjustment Type</label>
                        <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as AdjustmentType)}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="earnings">Additional Earnings (+)</SelectItem>
                                <SelectItem value="deduction">Deduction (−)</SelectItem>
                                <SelectItem value="net_correction">Net Pay Correction</SelectItem>
                                <SelectItem value="statutory_correction">Statutory Correction</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="text-xs font-medium">Amount (₱)</label>
                        <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="mt-1"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {adjustmentType === "deduction" ? "Will be deducted from next payroll" : "Will be added to next payroll"}
                        </p>
                    </div>

                    <div>
                        <label className="text-xs font-medium">Reason</label>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Missed overtime hours from previous period"
                            className="mt-1 min-h-[60px]"
                        />
                    </div>

                    <Button onClick={handleSubmit} className="w-full gap-1.5">
                        <Plus className="h-4 w-4" /> Create Adjustment
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
