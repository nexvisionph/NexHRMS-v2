"use client";

import { useState, useMemo } from "react";
import { useLoansStore } from "@/store/loans.store";
import { useGovernmentLoansStore } from "@/store/government-loans.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, History, Percent } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoanKpiCards } from "@/app/[role]/loans/_components/loan-kpi-cards";
import { LoansFilterBar } from "@/app/[role]/loans/_components/loans-filter-bar";
import { LoansTablePagination, paginate } from "@/app/[role]/loans/_components/loans-table-pagination";
import { LoanStatusBadge } from "@/app/[role]/loans/_components/loan-status-badge";
import {
    formatCompanyLoanType,
    SSS_LOAN_TYPE_LABELS,
    PAGIBIG_LOAN_TYPE_LABELS,
    generateSchedule,
} from "@/app/[role]/loans/_lib/government-loans";

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

function EmployeeCashAdvanceSection({ employeeId }: { employeeId: string }) {
    const { loans, getAllDeductions, getSchedule } = useLoansStore();
    const [statusFilter, setStatusFilter] = useState("all");
    const [accountsPage, setAccountsPage] = useState(1);
    const [accountsPageSize, setAccountsPageSize] = useState(10);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(10);
    const [schedulePage, setSchedulePage] = useState(1);
    const [schedulePageSize, setSchedulePageSize] = useState(10);

    const myLoans = useMemo(() => loans.filter((l) => l.employeeId === employeeId), [loans, employeeId]);
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

    return (
        <div className="space-y-6">
            <LoanKpiCards activeLabel="Active Loans" activeCount={stats.totalActive} outstandingBalance={stats.totalOutstanding} settledCount={stats.totalSettled} />

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
                                            <TableHead className="text-xs">Balance</TableHead>
                                            <TableHead className="text-xs">Progress</TableHead>
                                            <TableHead className="text-xs">Monthly</TableHead>
                                            <TableHead className="text-xs">Cap</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">You have no loans</TableCell></TableRow>
                                        ) : paginatedAccounts.map((loan) => {
                                            const paidPct = loan.amount > 0 ? Math.round(((loan.amount - loan.remainingBalance) / loan.amount) * 100) : 100;
                                            return (
                                                <TableRow key={loan.id}>
                                                    <TableCell className="text-xs capitalize">{formatCompanyLoanType(loan.type)}</TableCell>
                                                    <TableCell className="text-sm">₱{loan.amount.toLocaleString()}</TableCell>
                                                    <TableCell className="text-sm font-medium">₱{loan.remainingBalance.toLocaleString()}</TableCell>
                                                    <TableCell className="w-32">
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={paidPct} className="h-2 flex-1" />
                                                            <span className="text-[10px] text-muted-foreground w-8">{paidPct}%</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs">₱{loan.monthlyDeduction.toLocaleString()}/mo</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-700 dark:text-violet-400">
                                                            <Percent className="h-2.5 w-2.5 mr-0.5" />{loan.deductionCapPercent || 30}%
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                                                </TableRow>
                                            );
                                        })}
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
                                            <TableHead className="text-xs">#</TableHead>
                                            <TableHead className="text-xs">Due Date</TableHead>
                                            <TableHead className="text-xs">Amount</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeLoans.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No active schedules</TableCell></TableRow>
                                        ) : paginatedActiveLoans.flatMap((loan) =>
                                            getSchedule(loan.id).map((inst, i) => (
                                                <TableRow key={`${loan.id}-${i}`}>
                                                    <TableCell className="text-xs capitalize">{formatCompanyLoanType(loan.type)}</TableCell>
                                                    <TableCell className="text-xs">{i + 1}</TableCell>
                                                    <TableCell className="text-xs">{inst.dueDate}</TableCell>
                                                    <TableCell className="text-sm">₱{inst.amount.toLocaleString()}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={`text-[10px] ${inst.paid ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>
                                                            {inst.paid ? "Paid" : inst.skippedReason || "Pending"}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            )),
                                        )}
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
                                            <TableHead className="text-xs">Date</TableHead>
                                            <TableHead className="text-xs">Loan</TableHead>
                                            <TableHead className="text-xs">Amount</TableHead>
                                            <TableHead className="text-xs">Running Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myDeductions.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No deductions yet</TableCell></TableRow>
                                        ) : paginatedDeductions.sort((a, b) => b.deductedAt.localeCompare(a.deductedAt)).map((d) => {
                                            const loan = myLoans.find((l) => l.id === d.loanId);
                                            return (
                                                <TableRow key={d.id}>
                                                    <TableCell className="text-xs">{d.deductedAt}</TableCell>
                                                    <TableCell className="text-xs capitalize">{loan ? formatCompanyLoanType(loan.type) : d.loanId}</TableCell>
                                                    <TableCell className="text-sm">₱{d.amount.toLocaleString()}</TableCell>
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

function EmployeeSSSSection({ employeeId }: { employeeId: string }) {
    const { sssLoans, getSSSDeductions } = useGovernmentLoansStore();
    const [statusFilter, setStatusFilter] = useState("all");
    const [accountsPage, setAccountsPage] = useState(1);
    const [accountsPageSize, setAccountsPageSize] = useState(10);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(10);
    const [schedulePage, setSchedulePage] = useState(1);
    const [schedulePageSize, setSchedulePageSize] = useState(10);

    const myLoans = useMemo(() => sssLoans.filter((l) => l.employeeId === employeeId), [sssLoans, employeeId]);
    const filtered = useMemo(() => myLoans.filter((l) => statusFilter === "all" || l.status === statusFilter), [myLoans, statusFilter]);
    const paginatedAccounts = useMemo(() => paginate(filtered, accountsPage, accountsPageSize), [filtered, accountsPage, accountsPageSize]);

    const stats = useMemo(() => {
        const active = myLoans.filter((l) => l.status === "active");
        return {
            totalActive: active.length,
            totalOutstanding: active.reduce((sum, l) => sum + (l.loanAmount - l.totalDeducted), 0),
            totalSettled: myLoans.filter((l) => l.status === "settled").length,
        };
    }, [myLoans]);

    const myDeductions = useMemo(() => getSSSDeductions().filter((d) => d.employeeId === employeeId), [getSSSDeductions, employeeId]);
    const paginatedDeductions = useMemo(() => paginate(myDeductions, historyPage, historyPageSize), [myDeductions, historyPage, historyPageSize]);
    const activeLoans = useMemo(() => myLoans.filter((l) => l.status === "active"), [myLoans]);
    const paginatedActiveLoans = useMemo(() => paginate(activeLoans, schedulePage, schedulePageSize), [activeLoans, schedulePage, schedulePageSize]);

    return (
        <div className="space-y-6">
            <LoanKpiCards activeLabel="Active SSS Loans" activeCount={stats.totalActive} outstandingBalance={stats.totalOutstanding} settledCount={stats.totalSettled} />

            <LoansFilterBar showSearch={false} statusFilter={statusFilter} onStatusChange={(v) => { setStatusFilter(v); setAccountsPage(1); }} />

            <Tabs defaultValue="accounts">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="accounts">Loan Accounts</TabsTrigger>
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
                                            <TableHead className="text-xs">SSS Number</TableHead>
                                            <TableHead className="text-xs">Loan Type</TableHead>
                                            <TableHead className="text-xs">Reference No.</TableHead>
                                            <TableHead className="text-xs">Monthly Deduction</TableHead>
                                            <TableHead className="text-xs">Payroll Period</TableHead>
                                            <TableHead className="text-xs">Total Deducted</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No SSS loans</TableCell></TableRow>
                                        ) : paginatedAccounts.map((loan) => (
                                            <TableRow key={loan.id}>
                                                <TableCell className="text-xs font-mono">{loan.sssNumber}</TableCell>
                                                <TableCell className="text-xs">{SSS_LOAN_TYPE_LABELS[loan.loanType]}</TableCell>
                                                <TableCell className="text-xs font-mono">{loan.referenceNumber}</TableCell>
                                                <TableCell className="text-sm">₱{loan.monthlyAmortization.toLocaleString()}</TableCell>
                                                <TableCell className="text-xs">{loan.payrollPeriod}</TableCell>
                                                <TableCell className="text-sm">₱{loan.totalDeducted.toLocaleString()}</TableCell>
                                                <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <LoansTablePagination page={accountsPage} pageSize={accountsPageSize} totalItems={filtered.length} onPageChange={setAccountsPage} onPageSizeChange={setAccountsPageSize} />
                </TabsContent>

                <TabsContent value="schedule" className="mt-4 space-y-4">
                    {activeLoans.length === 0 ? (
                        <Card className="border border-border/50"><CardContent className="py-8 text-center text-sm text-muted-foreground">No active SSS repayment schedules</CardContent></Card>
                    ) : (
                        <>
                            {paginatedActiveLoans.map((loan) => {
                                const schedule = generateSchedule(loan.startDeductionDate, loan.endDate, loan.monthlyAmortization, loan.totalDeducted);
                                return (
                                    <Card key={loan.id} className="border border-border/50">
                                        <CardContent className="p-4">
                                            <p className="text-sm font-semibold mb-3">{SSS_LOAN_TYPE_LABELS[loan.loanType]} — {loan.referenceNumber}</p>
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="text-xs">#</TableHead>
                                                            <TableHead className="text-xs">Due Date</TableHead>
                                                            <TableHead className="text-xs">Amount</TableHead>
                                                            <TableHead className="text-xs">Status</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {schedule.map((inst) => (
                                                            <TableRow key={inst.installmentNumber}>
                                                                <TableCell className="text-sm">{inst.installmentNumber}</TableCell>
                                                                <TableCell className="text-sm">{new Date(inst.dueDate).toLocaleDateString()}</TableCell>
                                                                <TableCell className="text-sm">₱{inst.amount.toLocaleString()}</TableCell>
                                                                <TableCell><Badge variant="secondary" className={`text-[10px] ${inst.paid ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>{inst.paid ? "Paid" : "Pending"}</Badge></TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                            <LoansTablePagination page={schedulePage} pageSize={schedulePageSize} totalItems={activeLoans.length} onPageChange={setSchedulePage} onPageSizeChange={setSchedulePageSize} />
                        </>
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-4 space-y-3">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Date</TableHead>
                                            <TableHead className="text-xs">Loan ID</TableHead>
                                            <TableHead className="text-xs">Amount</TableHead>
                                            <TableHead className="text-xs">Balance After</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myDeductions.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No deductions yet</TableCell></TableRow>
                                        ) : paginatedDeductions.map((d) => (
                                            <TableRow key={d.id}>
                                                <TableCell className="text-xs">{d.deductedAt}</TableCell>
                                                <TableCell><code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{d.loanId}</code></TableCell>
                                                <TableCell className="text-sm">₱{d.amount.toLocaleString()}</TableCell>
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

function EmployeePagibigSection({ employeeId }: { employeeId: string }) {
    const { pagibigLoans, getPagibigDeductions } = useGovernmentLoansStore();
    const [statusFilter, setStatusFilter] = useState("all");
    const [accountsPage, setAccountsPage] = useState(1);
    const [accountsPageSize, setAccountsPageSize] = useState(10);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(10);
    const [schedulePage, setSchedulePage] = useState(1);
    const [schedulePageSize, setSchedulePageSize] = useState(10);

    const myLoans = useMemo(() => pagibigLoans.filter((l) => l.employeeId === employeeId), [pagibigLoans, employeeId]);
    const filtered = useMemo(() => myLoans.filter((l) => statusFilter === "all" || l.status === statusFilter), [myLoans, statusFilter]);
    const paginatedAccounts = useMemo(() => paginate(filtered, accountsPage, accountsPageSize), [filtered, accountsPage, accountsPageSize]);

    const stats = useMemo(() => {
        const active = myLoans.filter((l) => l.status === "active");
        return {
            totalActive: active.length,
            totalOutstanding: active.reduce((sum, l) => sum + l.outstandingBalance, 0),
            totalSettled: myLoans.filter((l) => l.status === "settled").length,
        };
    }, [myLoans]);

    const myDeductions = useMemo(() => getPagibigDeductions().filter((d) => d.employeeId === employeeId), [getPagibigDeductions, employeeId]);
    const paginatedDeductions = useMemo(() => paginate(myDeductions, historyPage, historyPageSize), [myDeductions, historyPage, historyPageSize]);
    const activeLoans = useMemo(() => myLoans.filter((l) => l.status === "active"), [myLoans]);
    const paginatedActiveLoans = useMemo(() => paginate(activeLoans, schedulePage, schedulePageSize), [activeLoans, schedulePage, schedulePageSize]);

    return (
        <div className="space-y-6">
            <LoanKpiCards activeLabel="Active Pag-IBIG Loans" activeCount={stats.totalActive} outstandingBalance={stats.totalOutstanding} settledCount={stats.totalSettled} />

            <LoansFilterBar showSearch={false} statusFilter={statusFilter} onStatusChange={(v) => { setStatusFilter(v); setAccountsPage(1); }} />

            <Tabs defaultValue="accounts">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="accounts">Loan Accounts</TabsTrigger>
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
                                            <TableHead className="text-xs">Loan Type</TableHead>
                                            <TableHead className="text-xs">Loan Amount</TableHead>
                                            <TableHead className="text-xs">Outstanding Balance</TableHead>
                                            <TableHead className="text-xs">Monthly Amortization</TableHead>
                                            <TableHead className="text-xs">Date Released</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No Pag-IBIG loans</TableCell></TableRow>
                                        ) : paginatedAccounts.map((loan) => (
                                            <TableRow key={loan.id}>
                                                <TableCell className="text-xs">{PAGIBIG_LOAN_TYPE_LABELS[loan.loanType]}</TableCell>
                                                <TableCell className="text-sm">₱{loan.loanAmount.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm font-medium">₱{loan.outstandingBalance.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{loan.monthlyAmortization.toLocaleString()}</TableCell>
                                                <TableCell className="text-xs">{new Date(loan.dateReleased).toLocaleDateString()}</TableCell>
                                                <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <LoansTablePagination page={accountsPage} pageSize={accountsPageSize} totalItems={filtered.length} onPageChange={setAccountsPage} onPageSizeChange={setAccountsPageSize} />
                </TabsContent>

                <TabsContent value="schedule" className="mt-4 space-y-4">
                    {activeLoans.length === 0 ? (
                        <Card className="border border-border/50"><CardContent className="py-8 text-center text-sm text-muted-foreground">No active Pag-IBIG repayment schedules</CardContent></Card>
                    ) : (
                        <>
                            {paginatedActiveLoans.map((loan) => {
                                const totalDeducted = loan.loanAmount - loan.outstandingBalance;
                                const schedule = generateSchedule(loan.startDeductionDate, loan.endDate, loan.monthlyAmortization, totalDeducted);
                                return (
                                    <Card key={loan.id} className="border border-border/50">
                                        <CardContent className="p-4">
                                            <p className="text-sm font-semibold mb-3">{PAGIBIG_LOAN_TYPE_LABELS[loan.loanType]} — {loan.referenceNumber}</p>
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="text-xs">#</TableHead>
                                                            <TableHead className="text-xs">Due Date</TableHead>
                                                            <TableHead className="text-xs">Amount</TableHead>
                                                            <TableHead className="text-xs">Status</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {schedule.map((inst) => (
                                                            <TableRow key={inst.installmentNumber}>
                                                                <TableCell className="text-sm">{inst.installmentNumber}</TableCell>
                                                                <TableCell className="text-sm">{new Date(inst.dueDate).toLocaleDateString()}</TableCell>
                                                                <TableCell className="text-sm">₱{inst.amount.toLocaleString()}</TableCell>
                                                                <TableCell><Badge variant="secondary" className={`text-[10px] ${inst.paid ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>{inst.paid ? "Paid" : "Pending"}</Badge></TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                            <LoansTablePagination page={schedulePage} pageSize={schedulePageSize} totalItems={activeLoans.length} onPageChange={setSchedulePage} onPageSizeChange={setSchedulePageSize} />
                        </>
                    )}
                </TabsContent>

                <TabsContent value="history" className="mt-4 space-y-3">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Date</TableHead>
                                            <TableHead className="text-xs">Loan ID</TableHead>
                                            <TableHead className="text-xs">Amount</TableHead>
                                            <TableHead className="text-xs">Balance After</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myDeductions.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No deductions yet</TableCell></TableRow>
                                        ) : paginatedDeductions.map((d) => (
                                            <TableRow key={d.id}>
                                                <TableCell className="text-xs">{d.deductedAt}</TableCell>
                                                <TableCell><code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{d.loanId}</code></TableCell>
                                                <TableCell className="text-sm">₱{d.amount.toLocaleString()}</TableCell>
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
                <p className="text-sm text-muted-foreground mt-0.5">View your company loans, SSS, and Pag-IBIG loan accounts</p>
            </div>

            <Tabs defaultValue="cash-advance">
                <TabsList className="w-full justify-start h-auto flex-wrap gap-1">
                    <TabsTrigger value="cash-advance">Cash Advances / Company Loan</TabsTrigger>
                    <TabsTrigger value="sss">SSS Loan</TabsTrigger>
                    <TabsTrigger value="pagibig">Pag-IBIG Loan</TabsTrigger>
                </TabsList>

                <TabsContent value="cash-advance" className="mt-6">
                    <EmployeeCashAdvanceSection employeeId={myEmployeeId} />
                </TabsContent>

                <TabsContent value="sss" className="mt-6">
                    <EmployeeSSSSection employeeId={myEmployeeId} />
                </TabsContent>

                <TabsContent value="pagibig" className="mt-6">
                    <EmployeePagibigSection employeeId={myEmployeeId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
