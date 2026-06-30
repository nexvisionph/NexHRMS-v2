"use client";

import { useState, useMemo } from "react";
import { useLoansStore } from "@/store/loans.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, History, Percent, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuditStore } from "@/store/audit.store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoansFilterBar } from "@/app/[role]/loans/_components/loans-filter-bar";
import { LoansTablePagination, paginate } from "@/app/[role]/loans/_components/loans-table-pagination";
import { LoanStatusBadge } from "@/app/[role]/loans/_components/loan-status-badge";
import { formatCompanyLoanType, generateCompanyLoanSchedule } from "@/app/[role]/loans/_lib/government-loans";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { loansStorage } from "@/services/db.service";
import { FileText, Eye } from "lucide-react";
import type { Loan } from "@/types";


function useMyEmployeeId() {
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    return employees.find(
        (e) =>
            e.profileId === currentUser.id ||
            e.email?.toLowerCase() === currentUser.email?.toLowerCase() ||
            e.name === currentUser.name,
    )?.id;
}

// ─── 1. COMPANY LOANS SECTION ───
function EmployeeCompanyLoansSection({ employeeId }: { employeeId: string }) {
    const { loans, createLoan, getAllDeductions, getSchedule } = useLoansStore();
    const currentUser = useAuthStore((s) => s.currentUser);

    const [statusFilter, setStatusFilter] = useState("all");
    const [accountsPage, setAccountsPage] = useState(1);
    const [accountsPageSize, setAccountsPageSize] = useState(10);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(10);
    const [schedulePage, setSchedulePage] = useState(1);
    const [schedulePageSize, setSchedulePageSize] = useState(10);

    const [open, setOpen] = useState(false);
    const [formAmount, setFormAmount] = useState("");
    const [formTermMonths, setFormTermMonths] = useState("12");
    const [formCategory, setFormCategory] = useState("SALARY_LOAN");
    const [formCategoryNote, setFormCategoryNote] = useState("");
    const [formStartDate, setFormStartDate] = useState("");
    const [formRemarks, setFormRemarks] = useState("");
    const [authorized, setAuthorized] = useState(false);

    const calculatedMonthly = useMemo(() => {
        const principal = Number(formAmount);
        const term = Number(formTermMonths);
        if (isNaN(principal) || principal <= 0 || isNaN(term) || term <= 0) return 0;
        return principal / term;
    }, [formAmount, formTermMonths]);

    const calculatedPerCutoff = useMemo(() => {
        return calculatedMonthly / 2;
    }, [calculatedMonthly]);

    const calculatedEndMonth = useMemo(() => {
        if (!formStartDate) return "-";
        const start = new Date(formStartDate);
        if (isNaN(start.getTime())) return "-";
        const term = Number(formTermMonths) || 12;
        start.setMonth(start.getMonth() + term);
        return start.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    }, [formStartDate, formTermMonths]);

    const myLoans = useMemo(() => loans.filter((l) => l.employeeId === employeeId && l.type === "salary_loan"), [loans, employeeId]);
    const filtered = useMemo(() => myLoans.filter((l) => statusFilter === "all" || l.status === statusFilter), [myLoans, statusFilter]);
    const paginatedAccounts = useMemo(() => paginate(filtered, accountsPage, accountsPageSize), [filtered, accountsPage, accountsPageSize]);

    const stats = useMemo(() => {
        const active = myLoans.filter((l) => l.status === "active");
        return {
            totalActive: active.length,
            totalOutstanding: active.reduce((sum, l) => sum + l.remainingBalance, 0),
            totalSettled: myLoans.filter((l) => l.status === "settled").length,
        };
    }, [myLoans]);

    const myDeductions = useMemo(() => getAllDeductions().filter((d) => myLoans.some((l) => l.id === d.loanId)), [getAllDeductions, myLoans]);
    const paginatedDeductions = useMemo(() => paginate(myDeductions, historyPage, historyPageSize), [myDeductions, historyPage, historyPageSize]);

    const activeLoans = useMemo(() => myLoans.filter((l) => l.status === "active"), [myLoans]);
    const paginatedActiveLoans = useMemo(() => paginate(activeLoans, schedulePage, schedulePageSize), [activeLoans, schedulePage, schedulePageSize]);

    const handleSubmitRequest = () => {
        if (!formAmount || !formTermMonths || !formStartDate || (formCategory === "OTHER" && !formCategoryNote)) {
            toast.error("Please fill all required fields");
            return;
        }
        if (!authorized) {
            toast.error("Please check the authorization box");
            return;
        }
        const principal = Number(formAmount);
        const term = Number(formTermMonths);
        const monthly = principal / term;

        createLoan({
            employeeId,
            type: "salary_loan",
            amount: principal,
            remainingBalance: principal,
            monthlyDeduction: monthly,
            status: "pending", // requests start as pending
            approvedBy: "pending_approval",
            remarks: `[Category: ${formCategory}]${formCategory === "OTHER" ? ` (${formCategoryNote})` : ""} [Term: ${term} months] ${formRemarks}`.trim(),
            startDeductionDate: formStartDate,
            deductionFrequency: "every_payroll",
        });
        useAuditStore.getState().log({ entityType: "loan", entityId: employeeId, action: "loan_created", performedBy: currentUser.id });
        toast.success("Company Loan request submitted successfully");
        setOpen(false);
        setFormAmount("");
        setFormTermMonths("12");
        setFormCategory("SALARY_LOAN");
        setFormCategoryNote("");
        setFormStartDate("");
        setFormRemarks("");
        setAuthorized(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setAuthorized(false); }}>
                    <div className="flex justify-end w-full">
                        <DialogTrigger asChild>
                            <Button className="gap-1.5"><Plus className="h-4 w-4" />Submit Request</Button>
                        </DialogTrigger>
                    </div>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Request Company Loan</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Loan Category *</label>
                                    <Select value={formCategory} onValueChange={setFormCategory}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="SALARY_LOAN">Salary Loan</SelectItem>
                                            <SelectItem value="EMERGENCY">Emergency Loan</SelectItem>
                                            <SelectItem value="EQUIPMENT">Equipment Loan</SelectItem>
                                            <SelectItem value="EDUCATIONAL">Educational Loan</SelectItem>
                                            <SelectItem value="OTHER">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Loan Term (Months) *</label>
                                    <Input type="number" min="1" max="36" value={formTermMonths} onChange={(e) => setFormTermMonths(e.target.value)} className="mt-1" />
                                </div>
                            </div>
                            {formCategory === "OTHER" && (
                                <div>
                                    <label className="text-sm font-medium">Specify Category *</label>
                                    <Input value={formCategoryNote} onChange={(e) => setFormCategoryNote(e.target.value)} className="mt-1" placeholder="e.g. Laptop Loan" />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Loan Amount *</label>
                                    <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="mt-1" placeholder="e.g. 50000" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Start Deduction Date *</label>
                                    <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="mt-1" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Remarks/Reason</label>
                                <Input value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} className="mt-1" placeholder="e.g. medical expenses" />
                            </div>

                            {/* Deduction Summary Preview Panel */}
                            {Number(formAmount) > 0 && (
                                <div className="p-3.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/10 space-y-2">
                                    <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Deduction Preview (Semi-Monthly)</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                        <div>Est. Per-Cutoff Deduction:</div>
                                        <div className="font-semibold text-foreground text-right">₱{calculatedPerCutoff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        <div>Est. Monthly Amortization:</div>
                                        <div className="font-semibold text-foreground text-right">₱{calculatedMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        <div>Calculated End Month:</div>
                                        <div className="font-semibold text-foreground text-right">{calculatedEndMonth}</div>
                                        <div>Total Repayable (0% Interest):</div>
                                        <div className="font-semibold text-foreground text-right text-indigo-600 dark:text-indigo-400">₱{Number(formAmount || 0).toLocaleString()}</div>
                                    </div>
                                </div>
                            )}

                            {/* Authorization Checkbox */}
                            <div className="flex items-start gap-2 pt-1">
                                <Checkbox id="auth-company-loan" checked={authorized} onCheckedChange={(checked) => setAuthorized(!!checked)} />
                                <Label htmlFor="auth-company-loan" className="text-[11px] text-muted-foreground leading-normal cursor-pointer select-none">
                                    I authorize SorenHRMS to deduct these amounts from my salary and to settle any remaining balance from my final separation pay if I leave the company before full repayment.
                                </Label>
                            </div>

                            <Button onClick={handleSubmitRequest} className="w-full">Submit Loan Request</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="flex-1">
                <LoanKpiCards activeLabel="Active Loans" activeCount={stats.totalActive} outstandingBalance={stats.totalOutstanding} settledCount={stats.totalSettled} />
            </div>

            <LoansFilterBar showSearch={false} statusFilter={statusFilter} onStatusChange={(v) => { setStatusFilter(v); setAccountsPage(1); }} />

            <Tabs defaultValue="accounts">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="accounts">My Loans</TabsTrigger>
                    <TabsTrigger value="schedule" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Repayment Schedule</TabsTrigger>
                    <TabsTrigger value="history" className="gap-1.5">
                        <History className="h-3.5 w-3.5" /> Deduction History
                        {myDeductions.length > 0 && <span className="ml-1 bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 rounded-full">{myDeductions.length}</span>}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="accounts" className="mt-4 space-y-3">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Type</TableHead>
                                            <TableHead className="text-xs">Amount</TableHead>
                                            <TableHead className="text-xs">Monthly Amortization</TableHead>
                                            <TableHead className="text-xs">Outstanding Balance</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs">Start Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">You have no loans</TableCell></TableRow>
                                        ) : paginatedAccounts.map((loan) => (
                                            <TableRow key={loan.id}>
                                                <TableCell className="text-xs capitalize">{formatCompanyLoanType(loan.type)}</TableCell>
                                                <TableCell className="text-sm">₱{loan.amount.toLocaleString()}</TableCell>
                                                <TableCell className="text-xs">₱{loan.monthlyDeduction.toLocaleString()}/mo</TableCell>
                                                <TableCell className="text-sm font-medium">₱{loan.remainingBalance.toLocaleString()}</TableCell>
                                                <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                                                <TableCell className="text-xs">{loan.startDeductionDate ? new Date(loan.startDeductionDate).toLocaleDateString() : "-"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <LoansTablePagination page={accountsPage} pageSize={accountsPageSize} totalItems={filtered.length} onPageChange={setAccountsPage} onPageSizeChange={setAccountsPageSize} />
                </TabsContent>

                <TabsContent value="schedule" className="mt-4 space-y-3">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Loan</TableHead>
                                            <TableHead className="text-xs">Payroll Period</TableHead>
                                            <TableHead className="text-xs">Scheduled Amount</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeLoans.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No active schedules</TableCell></TableRow>
                                        ) : paginatedActiveLoans.flatMap((loan) => {
                                            const interestPct = Number(loan.remarks?.match(/Interest:\s*(\d+)%/)?.[1] || 0);
                                            const totalRepayable = loan.amount + (loan.amount * (interestPct / 100));
                                            const totalDeducted = totalRepayable - loan.remainingBalance;
                                            const schedule = generateCompanyLoanSchedule(
                                                totalRepayable,
                                                loan.monthlyDeduction,
                                                loan.startDeductionDate || loan.createdAt,
                                                loan.deductionFrequency || "every_payroll",
                                                totalDeducted
                                            );
                                            return schedule.map((inst, i) => (
                                                <TableRow key={`${loan.id}-${i}`}>
                                                    <TableCell className="text-xs capitalize">{formatCompanyLoanType(loan.type)}</TableCell>
                                                    <TableCell className="text-xs">{inst.payrollPeriod}</TableCell>
                                                    <TableCell className="text-sm font-medium">₱{inst.amount.toLocaleString()}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={inst.status === "paid" ? "default" : "secondary"} className={`text-[10px] ${inst.status === "paid" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""}`}>
                                                            {inst.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ));
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <LoansTablePagination page={schedulePage} pageSize={schedulePageSize} totalItems={activeLoans.length} onPageChange={setSchedulePage} onPageSizeChange={setSchedulePageSize} />
                </TabsContent>

                <TabsContent value="history" className="mt-4 space-y-3">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Payroll Date</TableHead>
                                            <TableHead className="text-xs">Loan</TableHead>
                                            <TableHead className="text-xs">Deduction Amount</TableHead>
                                            <TableHead className="text-xs">Remaining Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myDeductions.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No deductions yet</TableCell></TableRow>
                                        ) : paginatedDeductions.sort((a, b) => b.deductedAt.localeCompare(a.deductedAt)).map((d) => {
                                            const loan = myLoans.find((l) => l.id === d.loanId);
                                            return (
                                                <TableRow key={d.id}>
                                                    <TableCell className="text-xs">{new Date(d.deductedAt).toLocaleDateString()}</TableCell>
                                                    <TableCell className="text-xs capitalize">{loan ? formatCompanyLoanType(loan.type) : d.loanId}</TableCell>
                                                    <TableCell className="text-sm text-red-600 dark:text-red-400">−₱{d.amount.toLocaleString()}</TableCell>
                                                    <TableCell className="text-sm">₱{d.remainingAfter.toLocaleString()}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <LoansTablePagination page={historyPage} pageSize={historyPageSize} totalItems={myDeductions.length} onPageChange={setHistoryPage} onPageSizeChange={setHistoryPageSize} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ─── 2. CASH ADVANCES SECTION ───
function EmployeeCashAdvancesSection({ employeeId }: { employeeId: string }) {
    const { loans, createLoan, getAllDeductions } = useLoansStore();
    const currentUser = useAuthStore((s) => s.currentUser);

    const [statusFilter, setStatusFilter] = useState("all");
    const [accountsPage, setAccountsPage] = useState(1);
    const [accountsPageSize, setAccountsPageSize] = useState(10);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(10);

    const [open, setOpen] = useState(false);
    const [formAmount, setFormAmount] = useState("");
    const [formScheme, setFormScheme] = useState<"FULL_NEXT_CUT" | "INSTALLMENT">("FULL_NEXT_CUT");
    const [formMonths, setFormMonths] = useState("1");
    const [formStartDate, setFormStartDate] = useState("");
    const [formRemarks, setFormRemarks] = useState("");
    const [authorized, setAuthorized] = useState(false);

    const calculatedPerCutoff = useMemo(() => {
        const principal = Number(formAmount);
        if (isNaN(principal) || principal <= 0) return 0;
        if (formScheme === "FULL_NEXT_CUT") {
            return principal;
        } else {
            const months = Number(formMonths) || 1;
            return principal / months;
        }
    }, [formAmount, formScheme, formMonths]);

    const calculatedEndMonth = useMemo(() => {
        if (!formStartDate) return "-";
        const start = new Date(formStartDate);
        if (isNaN(start.getTime())) return "-";
        const months = formScheme === "FULL_NEXT_CUT" ? 1 : (Number(formMonths) || 1);
        start.setMonth(start.getMonth() + months);
        return start.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    }, [formStartDate, formScheme, formMonths]);

    const myAdvances = useMemo(() => loans.filter((l) => l.employeeId === employeeId && l.type === "cash_advance"), [loans, employeeId]);
    const filtered = useMemo(() => myAdvances.filter((l) => statusFilter === "all" || l.status === statusFilter), [myAdvances, statusFilter]);
    const paginatedAccounts = useMemo(() => paginate(filtered, accountsPage, accountsPageSize), [filtered, accountsPage, accountsPageSize]);

    const stats = useMemo(() => {
        const active = myAdvances.filter((l) => l.status === "active");
        return {
            totalActive: active.length,
            totalOutstanding: active.reduce((sum, l) => sum + l.remainingBalance, 0),
            totalSettled: myAdvances.filter((l) => l.status === "settled").length,
        };
    }, [myAdvances]);

    const myDeductions = useMemo(() => getAllDeductions().filter((d) => myAdvances.some((l) => l.id === d.loanId)), [getAllDeductions, myAdvances]);
    const paginatedDeductions = useMemo(() => paginate(myDeductions, historyPage, historyPageSize), [myDeductions, historyPage, historyPageSize]);

    const handleSubmitRequest = () => {
        if (!formAmount || !formStartDate || (formScheme === "INSTALLMENT" && !formMonths)) {
            toast.error("Please fill all required fields");
            return;
        }
        if (!authorized) {
            toast.error("Please check the authorization box");
            return;
        }
        const amountVal = Number(formAmount);
        const monthsVal = formScheme === "FULL_NEXT_CUT" ? 1 : Number(formMonths);
        const monthly = amountVal / monthsVal;

        createLoan({
            employeeId,
            type: "cash_advance",
            amount: amountVal,
            remainingBalance: amountVal,
            monthlyDeduction: monthly,
            status: "pending", // requests start as pending
            approvedBy: "pending_approval",
            remarks: `[Scheme: ${formScheme}]${formScheme === "INSTALLMENT" ? ` [Installment: ${formMonths} mo]` : ""} ${formRemarks}`.trim(),
            startDeductionDate: formStartDate,
            deductionFrequency: "every_payroll",
        });
        useAuditStore.getState().log({ entityType: "loan", entityId: employeeId, action: "loan_created", performedBy: currentUser.id });
        toast.success("Cash Advance request submitted successfully");
        setOpen(false);
        setFormAmount("");
        setFormScheme("FULL_NEXT_CUT");
        setFormMonths("1");
        setFormStartDate("");
        setFormRemarks("");
        setAuthorized(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setAuthorized(false); }}>
                    <div className="flex justify-end w-full">
                        <DialogTrigger asChild>
                            <Button className="gap-1.5 self-start"><Plus className="h-4 w-4" />Submit Request</Button>
                        </DialogTrigger>
                    </div>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Request Cash Advance</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Repayment Scheme *</label>
                                    <Select value={formScheme} onValueChange={(v) => setFormScheme(v as "FULL_NEXT_CUT" | "INSTALLMENT")}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FULL_NEXT_CUT">Full Next Cutoff</SelectItem>
                                            <SelectItem value="INSTALLMENT">Installment Spread</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Start Deduction Date *</label>
                                    <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="mt-1" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Advance Amount *</label>
                                    <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="mt-1" placeholder="e.g. 10000" />
                                </div>
                                {formScheme === "INSTALLMENT" && (
                                    <div>
                                        <label className="text-sm font-medium">Term (Months: 1-6) *</label>
                                        <Input type="number" min="1" max="6" value={formMonths} onChange={(e) => setFormMonths(e.target.value)} className="mt-1" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="text-sm font-medium">Remarks/Reason</label>
                                <Input value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} className="mt-1" placeholder="e.g. emergency cash" />
                            </div>

                            {/* Deduction Summary Preview Panel */}
                            {Number(formAmount) > 0 && (
                                <div className="p-3.5 rounded-lg border border-purple-500/20 bg-purple-500/5 dark:bg-purple-500/10 space-y-2">
                                    <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">Deduction Preview</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                        <div>Deduction Scheme:</div>
                                        <div className="font-semibold text-foreground text-right">{formScheme === "FULL_NEXT_CUT" ? "Full next cutoff" : `Installment (${formMonths} mo)`}</div>
                                        <div>Est. Deduction Per Cutoff:</div>
                                        <div className="font-semibold text-foreground text-right">₱{calculatedPerCutoff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        <div>Calculated End Month:</div>
                                        <div className="font-semibold text-foreground text-right">{calculatedEndMonth}</div>
                                        <div>Total Deduction:</div>
                                        <div className="font-semibold text-foreground text-right text-purple-600 dark:text-purple-400">₱{Number(formAmount || 0).toLocaleString()}</div>
                                    </div>
                                </div>
                            )}

                            {/* Authorization Checkbox */}
                            <div className="flex items-start gap-2 pt-1">
                                <Checkbox id="auth-cash-advance" checked={authorized} onCheckedChange={(checked) => setAuthorized(!!checked)} />
                                <Label htmlFor="auth-cash-advance" className="text-[11px] text-muted-foreground leading-normal cursor-pointer select-none">
                                    I authorize SorenHRMS to deduct these amounts from my salary and to settle any remaining balance from my final separation pay if I leave the company before full repayment.
                                </Label>
                            </div>

                            <Button onClick={handleSubmitRequest} className="w-full">Submit Cash Advance Request</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="flex-1">
                <LoanKpiCards activeLabel="Active Cash Advances" activeCount={stats.totalActive} outstandingBalance={stats.totalOutstanding} settledCount={stats.totalSettled} />
            </div>

            <LoansFilterBar showSearch={false} statusFilter={statusFilter} onStatusChange={(v) => { setStatusFilter(v); setAccountsPage(1); }} />

            <Tabs defaultValue="accounts">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="accounts">My Cash Advances</TabsTrigger>
                    <TabsTrigger value="history" className="gap-1.5">
                        <History className="h-3.5 w-3.5" /> Deduction History
                        {myDeductions.length > 0 && <span className="ml-1 bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 rounded-full">{myDeductions.length}</span>}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="accounts" className="mt-4 space-y-3">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Amount</TableHead>
                                            <TableHead className="text-xs">Monthly Deduction</TableHead>
                                            <TableHead className="text-xs">Outstanding Balance</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs">Release Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">You have no cash advances</TableCell></TableRow>
                                        ) : paginatedAccounts.map((loan) => (
                                            <TableRow key={loan.id}>
                                                <TableCell className="text-sm">₱{loan.amount.toLocaleString()}</TableCell>
                                                <TableCell className="text-xs">₱{loan.monthlyDeduction.toLocaleString()}/mo</TableCell>
                                                <TableCell className="text-sm font-medium">₱{loan.remainingBalance.toLocaleString()}</TableCell>
                                                <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                                                <TableCell className="text-xs">{loan.releaseDate ? new Date(loan.releaseDate).toLocaleDateString() : "-"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <LoansTablePagination page={accountsPage} pageSize={accountsPageSize} totalItems={filtered.length} onPageChange={setAccountsPage} onPageSizeChange={setAccountsPageSize} />
                </TabsContent>

                <TabsContent value="history" className="mt-4 space-y-3">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Payroll Date</TableHead>
                                            <TableHead className="text-xs">Deduction Amount</TableHead>
                                            <TableHead className="text-xs">Remaining Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myDeductions.length === 0 ? (
                                            <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">No deductions yet</TableCell></TableRow>
                                        ) : paginatedDeductions.sort((a, b) => b.deductedAt.localeCompare(a.deductedAt)).map((d) => (
                                            <TableRow key={d.id}>
                                                <TableCell className="text-xs">{new Date(d.deductedAt).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-sm text-red-600 dark:text-red-400">−₱{d.amount.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{d.remainingAfter.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <LoansTablePagination page={historyPage} pageSize={historyPageSize} totalItems={myDeductions.length} onPageChange={setHistoryPage} onPageSizeChange={setHistoryPageSize} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ─── 3. GOVERNMENT LOANS SECTION ───
function EmployeeGovernmentLoansSection({ employeeId }: { employeeId: string }) {
    const { loans, createLoan, updateLoan, getAllDeductions } = useLoansStore();
    const currentUser = useAuthStore((s) => s.currentUser);

    const [statusFilter, setStatusFilter] = useState("all");
    const [accountsPage, setAccountsPage] = useState(1);
    const [accountsPageSize, setAccountsPageSize] = useState(10);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(10);

    const [open, setOpen] = useState(false);
    const [formAgency, setFormAgency] = useState<"SSS" | "Pag-IBIG">("SSS");
    const [formLoanType, setFormLoanType] = useState("salary_loan");
    const [formAmount, setFormAmount] = useState("");
    const [formMonthly, setFormMonthly] = useState("");
    const [formBalance, setFormBalance] = useState("");
    const [formReleaseDate, setFormReleaseDate] = useState("");
    const [formStartDate, setFormStartDate] = useState("");
    const [formReference, setFormReference] = useState("");
    const [formRemarks, setFormRemarks] = useState("");
    const [authorized, setAuthorized] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const handleViewProof = async (path: string) => {
        if (!path) return;
        if (path.includes("mock-proof")) {
            toast.info(`Demo Mode: Mock document path: ${path}`);
            return;
        }
        try {
            const url = await loansStorage.getSignedUrl(path);
            if (url) {
                window.open(url, "_blank");
            } else {
                toast.error("Failed to generate signed URL");
            }
        } catch {
            toast.error("Error retrieving proof document");
        }
    };

    const [resubmitLoanId, setResubmitLoanId] = useState<string | null>(null);

    const handleStartResubmit = (loan: Loan) => {
        setResubmitLoanId(loan.id);
        setFormAgency(loan.agency as "SSS" | "Pag-IBIG" ?? "SSS");
        setFormLoanType(loan.loanType ?? "salary_loan");
        setFormAmount(String(loan.amount));
        setFormMonthly(String(loan.monthlyDeduction));
        setFormBalance(String(loan.remainingBalance));
        setFormReleaseDate(loan.releaseDate ? loan.releaseDate.split("T")[0] : "");
        setFormStartDate(loan.startDeductionDate ? loan.startDeductionDate.split("T")[0] : "");
        setFormReference(loan.referenceNumber ?? "");
        setFormRemarks(loan.remarks ?? "");
        setSelectedFile(null);
        setAuthorized(false);
        setOpen(true);
    };

    const calculatedPerCutoff = useMemo(() => {
        const m = Number(formMonthly);
        return isNaN(m) || m <= 0 ? 0 : m / 2;
    }, [formMonthly]);

    const calculatedMonths = useMemo(() => {
        const amt = Number(formAmount);
        const m = Number(formMonthly);
        if (isNaN(amt) || amt <= 0 || isNaN(m) || m <= 0) return 24; // Default to 24 standard
        return Math.ceil(amt / m);
    }, [formAmount, formMonthly]);

    const calculatedEndMonth = useMemo(() => {
        if (!formStartDate) return "-";
        const start = new Date(formStartDate);
        if (isNaN(start.getTime())) return "-";
        start.setMonth(start.getMonth() + calculatedMonths);
        return start.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    }, [formStartDate, calculatedMonths]);

    const calculatedTotalEstimate = useMemo(() => {
        const m = Number(formMonthly);
        if (isNaN(m) || m <= 0) return 0;
        return m * calculatedMonths;
    }, [formMonthly, calculatedMonths]);

    const myLoans = useMemo(() => loans.filter((l) => l.employeeId === employeeId && (l.type === "government_loan" || l.type === "sss" || l.type === "pagibig")), [loans, employeeId]);
    const filtered = useMemo(() => myLoans.filter((l) => statusFilter === "all" || l.status === statusFilter), [myLoans, statusFilter]);
    const paginatedAccounts = useMemo(() => paginate(filtered, accountsPage, accountsPageSize), [filtered, accountsPage, accountsPageSize]);

    const stats = useMemo(() => {
        const active = myLoans.filter((l) => l.status === "active");
        return {
            totalActive: active.length,
            totalOutstanding: active.reduce((sum, l) => sum + l.remainingBalance, 0),
            totalSettled: myLoans.filter((l) => l.status === "settled").length,
        };
    }, [myLoans]);

    const myDeductions = useMemo(() => getAllDeductions().filter((d) => myLoans.some((l) => l.id === d.loanId)), [getAllDeductions, myLoans]);
    const paginatedDeductions = useMemo(() => paginate(myDeductions, historyPage, historyPageSize), [myDeductions, historyPage, historyPageSize]);

    const handleAgencyChange = (agency: "SSS" | "Pag-IBIG") => {
        setFormAgency(agency);
        if (agency === "SSS") {
            setFormLoanType("salary_loan");
        } else {
            setFormLoanType("mpl");
        }
    };

    const handleSubmitRecord = async () => {
        if (!formAmount || !formMonthly || !formBalance || !formReleaseDate || !formStartDate) {
            toast.error("Please fill all required fields");
            return;
        }
        if (!selectedFile) {
            toast.error("Please attach a proof file");
            return;
        }
        if (!authorized) {
            toast.error("Please check the authorization box");
            return;
        }

        setUploading(true);
        let proofPath = "";
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("bucket", "loan-proofs");
            formData.append("folder", employeeId);

            const res = await fetch("/api/upload", { method: "POST", body: formData });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: "Upload failed" }));
                throw new Error(err.error || "Upload failed");
            }
            const uploadData = await res.json();
            proofPath = uploadData.path;
        } catch (err: any) {
            if (process.env.NEXT_PUBLIC_DEMO_MODE === "true" || (typeof window !== "undefined" && window.location.hostname === "localhost")) {
                console.warn("Upload failed, using mock path for testing:", err.message);
                proofPath = `${employeeId}/mock-proof-${Date.now()}-${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
            } else {
                toast.error(`File upload failed: ${err.message}`);
                setUploading(false);
                return;
            }
        }
        setUploading(false);

        if (resubmitLoanId) {
            updateLoan(resubmitLoanId, {
                agency: formAgency,
                loanType: formLoanType,
                amount: Number(formAmount),
                remainingBalance: Number(formBalance),
                monthlyDeduction: Number(formMonthly),
                status: "pending",
                proofFilePath: proofPath,
                remarks: formRemarks || undefined,
                referenceNumber: formReference || undefined,
                releaseDate: formReleaseDate,
                startDeductionDate: formStartDate,
                reviewedBy: undefined,
                reviewedAt: undefined,
                rejectionReason: undefined,
            });

            useAuditStore.getState().log({ entityType: "loan", entityId: resubmitLoanId, action: "loan_updated", performedBy: currentUser.id });
            toast.success("Government Loan request resubmitted successfully. Status is Pending Verification.");
        } else {
            createLoan({
                employeeId,
                type: "government_loan",
                amount: Number(formAmount),
                remainingBalance: Number(formBalance),
                monthlyDeduction: Number(formMonthly),
                status: "pending", // government loans default to pending verification
                approvedBy: "employee_submitted",
                remarks: formRemarks || undefined,
                agency: formAgency,
                loanType: formLoanType,
                referenceNumber: formReference || undefined,
                releaseDate: formReleaseDate,
                startDeductionDate: formStartDate,
                deductionFrequency: "every_payroll",
                proofFilePath: proofPath,
            });

            useAuditStore.getState().log({ entityType: "loan", entityId: employeeId, action: "loan_created", performedBy: currentUser.id });
            toast.success("Government Loan record submitted successfully. Status is Pending Verification.");
        }

        setOpen(false);
        setFormAmount("");
        setFormMonthly("");
        setFormBalance("");
        setFormReleaseDate("");
        setFormStartDate("");
        setFormReference("");
        setFormRemarks("");
        setSelectedFile(null);
        setAuthorized(false);
        setResubmitLoanId(null);
    };

    const getLoanTypeLabel = (type?: string) => {
        if (type === "salary_loan") return "Salary Loan";
        if (type === "calamity_loan" || type === "calamity") return "Calamity Loan";
        if (type === "mpl") return "Multi-Purpose Loan (MPL)";
        return type || "Government Loan";
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setAuthorized(false); setResubmitLoanId(null); } }}>
                    <div className="flex justify-end w-full">
                        <DialogTrigger asChild>
                            <Button className="gap-1.5 self-start"><Plus className="h-4 w-4" /> Submit Request</Button>
                        </DialogTrigger>
                    </div>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>{resubmitLoanId ? "Appeal / Resubmit Government Loan" : "Submit Government Loan Record"}</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Agency *</label>
                                    <Select value={formAgency} onValueChange={(v) => handleAgencyChange(v as "SSS" | "Pag-IBIG")}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="SSS">SSS</SelectItem>
                                            <SelectItem value="Pag-IBIG">Pag-IBIG</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Loan Type *</label>
                                    <Select value={formLoanType} onValueChange={setFormLoanType}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {formAgency === "SSS" ? (
                                                <>
                                                    <SelectItem value="salary_loan">SSS Salary Loan</SelectItem>
                                                    <SelectItem value="calamity_loan">SSS Calamity Loan</SelectItem>
                                                </>
                                            ) : (
                                                <>
                                                    <SelectItem value="mpl">Pag-IBIG Multi-Purpose Loan</SelectItem>
                                                    <SelectItem value="calamity">Pag-IBIG Calamity Loan</SelectItem>
                                                </>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-sm font-medium">Loan Amount *</label>
                                    <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Monthly Amort. *</label>
                                    <Input type="number" value={formMonthly} onChange={(e) => setFormMonthly(e.target.value)} className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Outstanding Bal. *</label>
                                    <Input type="number" value={formBalance} onChange={(e) => setFormBalance(e.target.value)} className="mt-1" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Release Date *</label>
                                    <Input type="date" value={formReleaseDate} onChange={(e) => setFormReleaseDate(e.target.value)} className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">First Deduction Date *</label>
                                    <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="mt-1" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Reference Number</label>
                                    <Input value={formReference} onChange={(e) => setFormReference(e.target.value)} className="mt-1" placeholder="e.g. SSS-2026-041" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Remarks</label>
                                    <Input value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} className="mt-1" placeholder="Optional remarks" />
                                </div>
                            </div>

                            {/* Deduction Summary Preview Panel */}
                            {Number(formAmount) > 0 && (
                                <div className="p-3.5 rounded-lg border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10 space-y-2">
                                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Deduction Preview (Semi-Monthly Split)</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                        <div>Est. Per-Cutoff Deduction:</div>
                                        <div className="font-semibold text-foreground text-right">₱{calculatedPerCutoff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                        <div>Calculated End Month:</div>
                                        <div className="font-semibold text-foreground text-right">{calculatedEndMonth}</div>
                                        <div>Total Deduction Estimate:</div>
                                        <div className="font-semibold text-foreground text-right text-blue-600 dark:text-blue-400">₱{calculatedTotalEstimate.toLocaleString()}</div>
                                    </div>
                                </div>
                            )}

                            {/* Proof File Upload */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-foreground">Proof of Loan (JPG, PNG, PDF) *</label>
                                <Input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    className="cursor-pointer text-xs"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            const file = e.target.files[0];
                                            if (file.size > 10 * 1024 * 1024) {
                                                toast.error("File is too large. Maximum size is 10MB.");
                                                e.target.value = "";
                                                return;
                                            }
                                            setSelectedFile(file);
                                        }
                                    }}
                                />
                            </div>

                            {/* Authorization Checkbox */}
                            <div className="flex items-start gap-2 pt-1">
                                <Checkbox id="auth-gov-loan" checked={authorized} onCheckedChange={(checked) => setAuthorized(!!checked)} />
                                <Label htmlFor="auth-gov-loan" className="text-[11px] text-muted-foreground leading-normal cursor-pointer select-none">
                                    I authorize SorenHRMS to deduct these amounts from my salary and to settle any remaining balance from my final separation pay if I leave the company before full repayment.
                                </Label>
                            </div>

                            <Button onClick={handleSubmitRecord} className="w-full" disabled={uploading}>
                                {uploading ? "Uploading Proof..." : resubmitLoanId ? "Resubmit Government Loan" : "Submit Government Loan"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="flex-1">
                <LoanKpiCards activeLabel="Active Gov Loans" activeCount={stats.totalActive} outstandingBalance={stats.totalOutstanding} settledCount={stats.totalSettled} />
            </div>

            <LoansFilterBar showSearch={false} statusFilter={statusFilter} onStatusChange={(v) => { setStatusFilter(v); setAccountsPage(1); }} />

            <Tabs defaultValue="accounts">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="accounts">Government Loan Accounts</TabsTrigger>
                    <TabsTrigger value="history" className="gap-1.5">
                        <History className="h-3.5 w-3.5" /> Deduction History
                        {myDeductions.length > 0 && <span className="ml-1 bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 rounded-full">{myDeductions.length}</span>}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="accounts" className="mt-4 space-y-3">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Agency</TableHead>
                                            <TableHead className="text-xs">Loan Type</TableHead>
                                            <TableHead className="text-xs">Loan Amount</TableHead>
                                            <TableHead className="text-xs">Monthly Amortization</TableHead>
                                            <TableHead className="text-xs">Outstanding Balance</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs">Reference No.</TableHead>
                                            <TableHead className="text-xs">Proof</TableHead>
                                            <TableHead className="text-xs">Remarks/Rejection</TableHead>
                                            <TableHead className="text-xs w-16">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">No government loans recorded</TableCell></TableRow>
                                        ) : paginatedAccounts.map((loan) => (
                                            <TableRow key={loan.id}>
                                                <TableCell className="text-sm font-semibold text-blue-600 dark:text-blue-400">{loan.agency || "SSS"}</TableCell>
                                                <TableCell className="text-xs">{getLoanTypeLabel(loan.loanType)}</TableCell>
                                                <TableCell className="text-sm">₱{loan.amount.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{loan.monthlyDeduction.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm font-medium">₱{loan.remainingBalance.toLocaleString()}</TableCell>
                                                <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                                                <TableCell className="text-xs font-mono">{loan.referenceNumber || "-"}</TableCell>
                                                <TableCell>
                                                    {loan.proofFilePath ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                                                            onClick={() => handleViewProof(loan.proofFilePath!)}
                                                            title="View Uploaded Proof"
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-xs max-w-[150px] truncate">
                                                    {loan.status === "rejected" ? (
                                                        <span className="text-red-500 font-medium" title={loan.rejectionReason || "No reason specified"}>
                                                            {loan.rejectionReason || "Rejected"}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">{loan.remarks || "—"}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {loan.status === "rejected" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                                                            onClick={() => handleStartResubmit(loan)}
                                                            title="Appeal / Resubmit with corrected details"
                                                        >
                                                            <RefreshCw className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <LoansTablePagination page={accountsPage} pageSize={accountsPageSize} totalItems={filtered.length} onPageChange={setAccountsPage} onPageSizeChange={setAccountsPageSize} />
                </TabsContent>

                <TabsContent value="history" className="mt-4 space-y-3">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Payroll Date</TableHead>
                                            <TableHead className="text-xs">Deduction Amount</TableHead>
                                            <TableHead className="text-xs">Remaining Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myDeductions.length === 0 ? (
                                            <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">No deductions yet</TableCell></TableRow>
                                        ) : paginatedDeductions.sort((a, b) => b.deductedAt.localeCompare(a.deductedAt)).map((d) => (
                                            <TableRow key={d.id}>
                                                <TableCell className="text-xs">{new Date(d.deductedAt).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-sm text-red-600 dark:text-red-400">−₱{d.amount.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{d.remainingAfter.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <LoansTablePagination page={historyPage} pageSize={historyPageSize} totalItems={myDeductions.length} onPageChange={setHistoryPage} onPageSizeChange={setHistoryPageSize} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default function EmployeeLoansView() {
    const myEmployeeId = useMyEmployeeId();

    if (!myEmployeeId) {
        return (
            <div className="space-y-6">
                <div><h1 className="text-2xl font-bold tracking-tight">My Loans</h1></div>
                <Card><CardContent className="p-8 text-center text-muted-foreground">No employee record linked to your account.</CardContent></Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">My Loans</h1>
                <p className="text-sm text-muted-foreground mt-0.5">View and request company loans, cash advances, SSS, and Pag-IBIG loans</p>
            </div>

            <Tabs defaultValue="company-loans">
                <TabsList className="w-full justify-start h-auto flex-wrap gap-1">
                    <TabsTrigger value="company-loans">Company Loans</TabsTrigger>
                    <TabsTrigger value="cash-advances">Cash Advances</TabsTrigger>
                    <TabsTrigger value="government-loans">Government Loans</TabsTrigger>
                </TabsList>

                <TabsContent value="company-loans" className="mt-6">
                    <EmployeeCompanyLoansSection employeeId={myEmployeeId} />
                </TabsContent>

                <TabsContent value="cash-advances" className="mt-6">
                    <EmployeeCashAdvancesSection employeeId={myEmployeeId} />
                </TabsContent>

                <TabsContent value="government-loans" className="mt-6">
                    <EmployeeGovernmentLoansSection employeeId={myEmployeeId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Reusable KPI cards wrapper for clean look
interface LoanKpiCardsProps {
    activeLabel: string;
    activeCount: number;
    outstandingBalance: number;
    settledCount: number;
}

function LoanKpiCards({ activeLabel, activeCount, outstandingBalance, settledCount }: LoanKpiCardsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10">
                <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">{activeLabel}</p>
                    <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">{activeCount}</p>
                </CardContent>
            </Card>
            <Card className="border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10">
                <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">Total Outstanding Balance</p>
                    <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">₱{outstandingBalance.toLocaleString()}</p>
                </CardContent>
            </Card>
            <Card className="border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10">
                <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground font-medium">Settled</p>
                    <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{settledCount}</p>
                </CardContent>
            </Card>
        </div>
    );
}
