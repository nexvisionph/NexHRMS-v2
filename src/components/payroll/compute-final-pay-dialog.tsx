"use client";

import { useState, useMemo } from "react";
import type { Employee } from "@/types";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calculator, FileText } from "lucide-react";
import { toast } from "sonner";

interface ComputeFinalPayDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employees: Employee[];
    getLeaveBalance: (employeeId: string) => number;
    getLoanBalance: (employeeId: string) => number;
    existingIds: string[];
    onSubmit: (data: {
        employeeId: string;
        resignedAt: string;
        salary: number;
        unpaidOTHours: number;
        leaveDays: number;
        loanBalance: number;
    }) => void;
}

export function ComputeFinalPayDialog({
    open, onOpenChange, employees, getLeaveBalance, getLoanBalance, existingIds, onSubmit,
}: ComputeFinalPayDialogProps) {
    const [employeeId, setEmployeeId] = useState("");
    const [unpaidOTHours, setUnpaidOTHours] = useState("0");
    const [extraLeaveDays, setExtraLeaveDays] = useState("");

    const resignedEmployees = useMemo(
        () => employees.filter((e) => e.status === "resigned" && !existingIds.includes(e.id)),
        [employees, existingIds]
    );

    const selectedEmp = employees.find((e) => e.id === employeeId);

    const autoLeave = employeeId ? getLeaveBalance(employeeId) : 0;
    const autoLoan = employeeId ? getLoanBalance(employeeId) : 0;
    const leaveDays = parseFloat(extraLeaveDays) || autoLeave;
    const otHours = parseFloat(unpaidOTHours) || 0;

    // Preview computation
    const preview = useMemo(() => {
        if (!selectedEmp) return null;
        const resignDate = new Date(selectedEmp.resignedAt || new Date().toISOString());
        const daysInMonth = new Date(resignDate.getFullYear(), resignDate.getMonth() + 1, 0).getDate();
        const daysWorked = resignDate.getDate();
        const dailyRate = Math.round(selectedEmp.salary / daysInMonth);
        const proRated = Math.round(dailyRate * daysWorked);
        const hourlyRate = (selectedEmp.salary * 12) / 2080;
        const otPay = Math.round(otHours * hourlyRate * 1.25);
        const leavePay = Math.round(leaveDays * dailyRate);
        const gross = proRated + otPay + leavePay;
        const net = Math.max(0, gross - autoLoan);
        return { proRated, otPay, leavePay, gross, loan: autoLoan, net, dailyRate };
    }, [selectedEmp, otHours, leaveDays, autoLoan]);

    const handleSubmit = () => {
        if (!employeeId || !selectedEmp) {
            toast.error("Please select an employee");
            return;
        }
        onSubmit({
            employeeId,
            resignedAt: selectedEmp.resignedAt || new Date().toISOString().split("T")[0],
            salary: selectedEmp.salary,
            unpaidOTHours: otHours,
            leaveDays,
            loanBalance: autoLoan,
        });
        toast.success(`Final pay computed for ${selectedEmp.name}`);
        setEmployeeId("");
        setUnpaidOTHours("0");
        setExtraLeaveDays("");
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" /> Compute Final Pay
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="text-xs font-medium">Resigned Employee</label>
                        <Select value={employeeId} onValueChange={setEmployeeId}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select resigned employee" /></SelectTrigger>
                            <SelectContent>
                                {resignedEmployees.length === 0 ? (
                                    <SelectItem value="none" disabled>No resigned employees pending final pay</SelectItem>
                                ) : resignedEmployees.filter((e) => e.id).map((e) => (
                                    <SelectItem key={e.id} value={e.id}>
                                        {e.name} — Resigned {e.resignedAt ? new Date(e.resignedAt).toLocaleDateString() : "N/A"} ({formatCurrency(e.salary)}/mo)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedEmp && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium">Unpaid OT Hours</label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.5}
                                        value={unpaidOTHours}
                                        onChange={(e) => setUnpaidOTHours(e.target.value)}
                                        className="mt-1"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Paid at 1.25× hourly rate</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">Leave Cash-out Days</label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.5}
                                        value={extraLeaveDays || ""}
                                        onChange={(e) => setExtraLeaveDays(e.target.value)}
                                        placeholder={`${autoLeave} (auto from balance)`}
                                        className="mt-1"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Auto: {autoLeave} days remaining</p>
                                </div>
                            </div>

                            {/* Preview */}
                            {preview && (
                                <Card className="border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                                    <CardContent className="p-3 space-y-2">
                                        <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                                            <FileText className="h-3.5 w-3.5" /> Final Pay Preview
                                        </p>
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Pro-rated Salary</span>
                                                <span>{formatCurrency(preview.proRated)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Unpaid OT ({otHours}h × 1.25)</span>
                                                <span>{formatCurrency(preview.otPay)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Leave Cash-out ({leaveDays}d × {formatCurrency(preview.dailyRate)}/day)</span>
                                                <span>{formatCurrency(preview.leavePay)}</span>
                                            </div>
                                            <div className="flex justify-between font-medium border-t border-blue-200 dark:border-blue-800 pt-1">
                                                <span>Gross Final Pay</span>
                                                <span>{formatCurrency(preview.gross)}</span>
                                            </div>
                                            {preview.loan > 0 && (
                                                <div className="flex justify-between text-red-600 dark:text-red-400">
                                                    <span>Outstanding Loans</span>
                                                    <span>−{formatCurrency(preview.loan)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-bold text-sm border-t border-blue-200 dark:border-blue-800 pt-1">
                                                <span className="text-emerald-700 dark:text-emerald-400">Net Final Pay</span>
                                                <span className="text-emerald-700 dark:text-emerald-400">{formatCurrency(preview.net)}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    )}

                    <Button
                        onClick={handleSubmit}
                        className="w-full gap-1.5"
                        disabled={!employeeId || resignedEmployees.length === 0}
                    >
                        <Calculator className="h-4 w-4" /> Compute Final Pay
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
