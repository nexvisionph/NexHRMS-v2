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
import { Calendar, History, Percent, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuditStore } from "@/store/audit.store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoansFilterBar } from "@/app/[role]/loans/_components/loans-filter-bar";
import { LoansTablePagination, paginate } from "@/app/[role]/loans/_components/loans-table-pagination";
import { LoanStatusBadge } from "@/app/[role]/loans/_components/loan-status-badge";
import { formatCompanyLoanType, generateCompanyLoanSchedule } from "@/app/[role]/loans/_lib/government-loans";

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
    const [formMonthly, setFormMonthly] = useState("");
    const [formStartDate, setFormStartDate] = useState("");
    const [formRemarks, setFormRemarks] = useState("");

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
        if (!formAmount || !formMonthly || !formStartDate) {
            toast.error("Please fill all required fields");
            return;
        }
        createLoan({
            employeeId,
            type: "salary_loan",
            amount: Number(formAmount),
            monthlyDeduction: Number(formMonthly),
            status: "pending", // requests start as pending
            approvedBy: "pending_approval",
            remarks: formRemarks || undefined,
            startDeductionDate: formStartDate,
            deductionFrequency: "every_payroll",
        });
        useAuditStore.getState().log({ entityType: "loan", entityId: employeeId, action: "loan_created", performedBy: currentUser.id });
        toast.success("Company Loan request submitted successfully");
        setOpen(false);
        setFormAmount("");
        setFormMonthly("");
        setFormStartDate("");
        setFormRemarks("");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                    <LoanKpiCards activeLabel="Active Loans" activeCount={stats.totalActive} outstandingBalance={stats.totalOutstanding} settledCount={stats.totalSettled} />
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-1.5 self-start"><Plus className="h-4 w-4" /> Request Loan</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Request Company Loan</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-sm font-medium">Loan Amount *</label>
                                <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="mt-1" placeholder="e.g. 50000" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Desired Monthly Amortization *</label>
                                <Input type="number" value={formMonthly} onChange={(e) => setFormMonthly(e.target.value)} className="mt-1" placeholder="e.g. 5000" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Start Deduction Date *</label>
                                <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Remarks/Reason</label>
                                <Input value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} className="mt-1" placeholder="e.g. medical expenses" />
                            </div>
                            <Button onClick={handleSubmitRequest} className="w-full">Submit Loan Request</Button>
                        </div>
                    </DialogContent>
                </Dialog>
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
    const [formMonthly, setFormMonthly] = useState("");
    const [formStartDate, setFormStartDate] = useState("");
    const [formRemarks, setFormRemarks] = useState("");

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
        if (!formAmount || !formMonthly || !formStartDate) {
            toast.error("Please fill all required fields");
            return;
        }
        createLoan({
            employeeId,
            type: "cash_advance",
            amount: Number(formAmount),
            monthlyDeduction: Number(formMonthly),
            status: "pending", // requests start as pending
            approvedBy: "pending_approval",
            remarks: formRemarks || undefined,
            startDeductionDate: formStartDate,
            deductionFrequency: "every_payroll",
        });
        useAuditStore.getState().log({ entityType: "loan", entityId: employeeId, action: "loan_created", performedBy: currentUser.id });
        toast.success("Cash Advance request submitted successfully");
        setOpen(false);
        setFormAmount("");
        setFormMonthly("");
        setFormStartDate("");
        setFormRemarks("");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                    <LoanKpiCards activeLabel="Active Cash Advances" activeCount={stats.totalActive} outstandingBalance={stats.totalOutstanding} settledCount={stats.totalSettled} />
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-1.5 self-start"><Plus className="h-4 w-4" /> Request Cash Advance</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Request Cash Advance</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-sm font-medium">Cash Advance Amount *</label>
                                <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="mt-1" placeholder="e.g. 10000" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Desired Monthly Deduction *</label>
                                <Input type="number" value={formMonthly} onChange={(e) => setFormMonthly(e.target.value)} className="mt-1" placeholder="e.g. 2000" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Start Deduction Date *</label>
                                <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Remarks/Reason</label>
                                <Input value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} className="mt-1" placeholder="e.g. emergency cash" />
                            </div>
                            <Button onClick={handleSubmitRequest} className="w-full">Submit Cash Advance Request</Button>
                        </div>
                    </DialogContent>
                </Dialog>
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
    const { loans, createLoan, getAllDeductions } = useLoansStore();
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

    const handleSubmitRecord = () => {
        if (!formAmount || !formMonthly || !formBalance || !formReleaseDate || !formStartDate) {
            toast.error("Please fill all required fields");
            return;
        }

        createLoan({
            employeeId,
            type: "government_loan",
            amount: Number(formAmount),
            remainingBalance: Number(formBalance),
            monthlyDeduction: Number(formMonthly),
            status: "active", // government loans go directly to Submitted/Active
            approvedBy: "employee_submitted",
            remarks: formRemarks || undefined,
            agency: formAgency,
            loanType: formLoanType,
            referenceNumber: formReference || undefined,
            releaseDate: formReleaseDate,
            startDeductionDate: formStartDate,
            deductionFrequency: "every_payroll",
        });

        useAuditStore.getState().log({ entityType: "loan", entityId: employeeId, action: "loan_created", performedBy: currentUser.id });
        toast.success("Government Loan record submitted successfully");
        setOpen(false);
        setFormAmount("");
        setFormMonthly("");
        setFormBalance("");
        setFormReleaseDate("");
        setFormStartDate("");
        setFormReference("");
        setFormRemarks("");
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
                <div className="flex-1">
                    <LoanKpiCards activeLabel="Active Gov Loans" activeCount={stats.totalActive} outstandingBalance={stats.totalOutstanding} settledCount={stats.totalSettled} />
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-1.5 self-start"><Plus className="h-4 w-4" /> Submit Gov Loan Record</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Submit Government Loan Record</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Agency *</label>
                                    <Select value={formAgency} onValueChange={(v) => handleAgencyChange(v as any)}>
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
                            <Button onClick={handleSubmitRecord} className="w-full">Submit Government Loan</Button>
                        </div>
                    </DialogContent>
                </Dialog>
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
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No government loans recorded</TableCell></TableRow>
                                        ) : paginatedAccounts.map((loan) => (
                                            <TableRow key={loan.id}>
                                                <TableCell className="text-sm font-semibold text-blue-600 dark:text-blue-400">{loan.agency || "SSS"}</TableCell>
                                                <TableCell className="text-xs">{getLoanTypeLabel(loan.loanType)}</TableCell>
                                                <TableCell className="text-sm">₱{loan.amount.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{loan.monthlyDeduction.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm font-medium">₱{loan.remainingBalance.toLocaleString()}</TableCell>
                                                <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                                                <TableCell className="text-xs font-mono">{loan.referenceNumber || "-"}</TableCell>
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
