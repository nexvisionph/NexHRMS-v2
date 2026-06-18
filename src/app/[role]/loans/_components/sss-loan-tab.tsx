"use client";

import { useState, useMemo } from "react";
import { useGovernmentLoansStore } from "@/store/government-loans.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, History, Calendar, CheckCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeCombobox } from "@/components/ui/employee-combobox";
import { LoanKpiCards } from "@/app/[role]/loans/_components/loan-kpi-cards";
import { LoansFilterBar } from "@/app/[role]/loans/_components/loans-filter-bar";
import { LoansTablePagination, paginate } from "@/app/[role]/loans/_components/loans-table-pagination";
import { LoanStatusBadge } from "@/app/[role]/loans/_components/loan-status-badge";
import { SSS_LOAN_TYPE_LABELS, generateSchedule } from "@/app/[role]/loans/_lib/government-loans";

export function SSSLoanTab() {
    const { sssLoans, createSSSLoan, settleSSSLoan, getSSSDeductions } = useGovernmentLoansStore();
    const employees = useEmployeesStore((s) => s.employees);

    const [open, setOpen] = useState(false);
    const [formEmpId, setFormEmpId] = useState("");
    const [formSssNumber, setFormSssNumber] = useState("");
    const [formLoanType, setFormLoanType] = useState<"calamity" | "salary">("salary");
    const [formReference, setFormReference] = useState("");
    const [formAmount, setFormAmount] = useState("");
    const [formMonthly, setFormMonthly] = useState("");
    const [formStartDate, setFormStartDate] = useState("");
    const [formEndDate, setFormEndDate] = useState("");

    const [statusFilter, setStatusFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [accountsPage, setAccountsPage] = useState(1);
    const [accountsPageSize, setAccountsPageSize] = useState(10);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(10);
    const [schedulePage, setSchedulePage] = useState(1);
    const [schedulePageSize, setSchedulePageSize] = useState(10);

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return sssLoans.filter((l) => {
            const matchesStatus = statusFilter === "all" || l.status === statusFilter;
            const matchesSearch = !q || getEmpName(l.employeeId).toLowerCase().includes(q) || l.sssNumber.toLowerCase().includes(q) || l.referenceNumber.toLowerCase().includes(q);
            return matchesStatus && matchesSearch;
        });
    }, [sssLoans, statusFilter, search, employees]);

    const stats = useMemo(() => {
        const active = sssLoans.filter((l) => l.status === "active");
        return {
            totalActive: active.length,
            totalOutstanding: active.reduce((sum, l) => sum + (l.loanAmount - l.totalDeducted), 0),
            totalSettled: sssLoans.filter((l) => l.status === "settled").length,
        };
    }, [sssLoans]);

    const activeLoans = useMemo(() => sssLoans.filter((l) => l.status === "active"), [sssLoans]);
    const paginatedActiveLoans = useMemo(() => paginate(activeLoans, schedulePage, schedulePageSize), [activeLoans, schedulePage, schedulePageSize]);
    const paginatedAccounts = useMemo(() => paginate(filtered, accountsPage, accountsPageSize), [filtered, accountsPage, accountsPageSize]);

    const allDeductions = getSSSDeductions();
    const filteredDeductions = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allDeductions.filter((d) => !q || getEmpName(d.employeeId).toLowerCase().includes(q));
    }, [allDeductions, search, employees]);
    const paginatedDeductions = useMemo(() => paginate(filteredDeductions, historyPage, historyPageSize), [filteredDeductions, historyPage, historyPageSize]);

    const handleCreate = () => {
        if (!formEmpId || !formSssNumber || !formReference || !formAmount || !formMonthly || !formStartDate || !formEndDate) {
            toast.error("Please fill all required fields");
            return;
        }
        createSSSLoan({
            employeeId: formEmpId,
            sssNumber: formSssNumber,
            loanType: formLoanType,
            referenceNumber: formReference,
            loanAmount: Number(formAmount),
            monthlyAmortization: Number(formMonthly),
            startDeductionDate: formStartDate,
            endDate: formEndDate,
        });
        toast.success(`SSS loan created for ${getEmpName(formEmpId)}`);
        setOpen(false);
        setFormEmpId("");
        setFormSssNumber("");
        setFormReference("");
        setFormAmount("");
        setFormMonthly("");
        setFormStartDate("");
        setFormEndDate("");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">{sssLoans.length} SSS loan(s)</p>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-1.5"><Plus className="h-4 w-4" /> Create SSS Loan</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Create SSS Loan</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-sm font-medium">Employee</label>
                                <div className="mt-1">
                                    <EmployeeCombobox value={formEmpId} onValueChange={setFormEmpId} required placeholder="Select employee" className="w-full" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">SSS Number</label>
                                <Input value={formSssNumber} onChange={(e) => setFormSssNumber(e.target.value)} className="mt-1" placeholder="e.g. 34-1234567-8" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Loan Type</label>
                                <Select value={formLoanType} onValueChange={(v) => setFormLoanType(v as "calamity" | "salary")}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="calamity">SSS Calamity Loan</SelectItem>
                                        <SelectItem value="salary">SSS Salary Loan</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Loan Reference Number</label>
                                <Input value={formReference} onChange={(e) => setFormReference(e.target.value)} className="mt-1" placeholder="e.g. SSS-2026-00142" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Loan Amount (₱)</label>
                                    <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Monthly Amortization (₱)</label>
                                    <Input type="number" value={formMonthly} onChange={(e) => setFormMonthly(e.target.value)} className="mt-1" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Start Deduction Date</label>
                                    <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">End Date</label>
                                    <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} className="mt-1" />
                                </div>
                            </div>
                            <Button onClick={handleCreate} className="w-full">Create SSS Loan</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <LoanKpiCards
                activeLabel="Active SSS Loans"
                activeCount={stats.totalActive}
                outstandingBalance={stats.totalOutstanding}
                settledCount={stats.totalSettled}
            />

            <LoansFilterBar
                search={search}
                onSearchChange={(v) => { setSearch(v); setAccountsPage(1); setHistoryPage(1); }}
                statusFilter={statusFilter}
                onStatusChange={(v) => { setStatusFilter(v); setAccountsPage(1); }}
            />

            <Tabs defaultValue="accounts">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="accounts">Loan Accounts</TabsTrigger>
                    <TabsTrigger value="schedule" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Repayment Schedule</TabsTrigger>
                    <TabsTrigger value="history" className="gap-1.5">
                        <History className="h-3.5 w-3.5" /> Deduction History
                        {allDeductions.length > 0 && <span className="ml-1 bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 rounded-full">{allDeductions.length}</span>}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="accounts" className="mt-4 space-y-3">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Employee</TableHead>
                                            <TableHead className="text-xs">SSS Number</TableHead>
                                            <TableHead className="text-xs">Loan Type</TableHead>
                                            <TableHead className="text-xs">Loan Reference Number</TableHead>
                                            <TableHead className="text-xs">Monthly Deduction</TableHead>
                                            <TableHead className="text-xs">Payroll Period</TableHead>
                                            <TableHead className="text-xs">Total Deducted</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs w-20">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">No SSS loans found</TableCell></TableRow>
                                        ) : paginatedAccounts.map((loan) => (
                                            <TableRow key={loan.id}>
                                                <TableCell className="text-sm font-medium">{getEmpName(loan.employeeId)}</TableCell>
                                                <TableCell className="text-xs font-mono">{loan.sssNumber}</TableCell>
                                                <TableCell className="text-xs">{SSS_LOAN_TYPE_LABELS[loan.loanType]}</TableCell>
                                                <TableCell className="text-xs font-mono">{loan.referenceNumber}</TableCell>
                                                <TableCell className="text-sm">₱{loan.monthlyAmortization.toLocaleString()}</TableCell>
                                                <TableCell className="text-xs">{loan.payrollPeriod}</TableCell>
                                                <TableCell className="text-sm">₱{loan.totalDeducted.toLocaleString()}</TableCell>
                                                <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit loan" onClick={() => toast.info("Edit SSS loan — UI only")}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {loan.status === "active" && (
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Settle" onClick={() => { settleSSSLoan(loan.id); toast.success("SSS loan settled"); }}>
                                                                <CheckCircle className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
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

                <TabsContent value="schedule" className="mt-4 space-y-4">
                    {activeLoans.length === 0 ? (
                        <Card className="border border-border/50"><CardContent className="py-8 text-center text-sm text-muted-foreground">No active SSS loans with repayment schedules</CardContent></Card>
                    ) : (
                        <>
                            {paginatedActiveLoans.map((loan) => {
                                const schedule = generateSchedule(loan.startDeductionDate, loan.endDate, loan.monthlyAmortization, loan.totalDeducted);
                                return (
                                    <Card key={loan.id} className="border border-border/50">
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <p className="text-sm font-semibold">{getEmpName(loan.employeeId)} — {SSS_LOAN_TYPE_LABELS[loan.loanType]}</p>
                                                    <p className="text-xs text-muted-foreground">Ref: {loan.referenceNumber} · Monthly: ₱{loan.monthlyAmortization.toLocaleString()}</p>
                                                </div>
                                                <Badge variant="outline" className="text-[10px]">{schedule.length} installments</Badge>
                                            </div>
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
                                                                <TableCell className="text-sm font-medium">₱{inst.amount.toLocaleString()}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant={inst.paid ? "default" : "secondary"} className={`text-[10px] ${inst.paid ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""}`}>
                                                                        {inst.paid ? "paid" : "pending"}
                                                                    </Badge>
                                                                </TableCell>
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
                                            <TableHead className="text-xs">Employee</TableHead>
                                            <TableHead className="text-xs">Loan ID</TableHead>
                                            <TableHead className="text-xs">Payslip</TableHead>
                                            <TableHead className="text-xs">Amount</TableHead>
                                            <TableHead className="text-xs">Balance After</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredDeductions.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No deduction history yet</TableCell></TableRow>
                                        ) : paginatedDeductions.map((d) => (
                                            <TableRow key={d.id}>
                                                <TableCell className="text-sm">{new Date(d.deductedAt).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-sm font-medium">{getEmpName(d.employeeId)}</TableCell>
                                                <TableCell><code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{d.loanId}</code></TableCell>
                                                <TableCell><code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{d.payslipId || "—"}</code></TableCell>
                                                <TableCell className="text-sm font-medium text-red-600 dark:text-red-400">−₱{d.amount.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{d.remainingAfter.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <LoansTablePagination page={historyPage} pageSize={historyPageSize} totalItems={filteredDeductions.length} onPageChange={setHistoryPage} onPageSizeChange={setHistoryPageSize} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
