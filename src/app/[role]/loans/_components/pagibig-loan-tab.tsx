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
import { PAGIBIG_LOAN_TYPE_LABELS, generateSchedule } from "@/app/[role]/loans/_lib/government-loans";

export function PagibigLoanTab() {
    const { pagibigLoans, createPagibigLoan, settlePagibigLoan, getPagibigDeductions } = useGovernmentLoansStore();
    const employees = useEmployeesStore((s) => s.employees);

    const [open, setOpen] = useState(false);
    const [formEmpId, setFormEmpId] = useState("");
    const [formLoanType, setFormLoanType] = useState<"mpl" | "calamity">("mpl");
    const [formReference, setFormReference] = useState("");
    const [formAmount, setFormAmount] = useState("");
    const [formMonthly, setFormMonthly] = useState("");
    const [formOutstanding, setFormOutstanding] = useState("");
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
        return pagibigLoans.filter((l) => {
            const matchesStatus = statusFilter === "all" || l.status === statusFilter;
            const matchesSearch = !q || getEmpName(l.employeeId).toLowerCase().includes(q) || l.referenceNumber.toLowerCase().includes(q);
            return matchesStatus && matchesSearch;
        });
    }, [pagibigLoans, statusFilter, search, employees]);

    const stats = useMemo(() => {
        const active = pagibigLoans.filter((l) => l.status === "active");
        return {
            totalActive: active.length,
            totalOutstanding: active.reduce((sum, l) => sum + l.outstandingBalance, 0),
            totalSettled: pagibigLoans.filter((l) => l.status === "settled").length,
        };
    }, [pagibigLoans]);

    const activeLoans = useMemo(() => pagibigLoans.filter((l) => l.status === "active"), [pagibigLoans]);
    const paginatedActiveLoans = useMemo(() => paginate(activeLoans, schedulePage, schedulePageSize), [activeLoans, schedulePage, schedulePageSize]);
    const paginatedAccounts = useMemo(() => paginate(filtered, accountsPage, accountsPageSize), [filtered, accountsPage, accountsPageSize]);

    const allDeductions = getPagibigDeductions();
    const filteredDeductions = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allDeductions.filter((d) => !q || getEmpName(d.employeeId).toLowerCase().includes(q));
    }, [allDeductions, search, employees]);
    const paginatedDeductions = useMemo(() => paginate(filteredDeductions, historyPage, historyPageSize), [filteredDeductions, historyPage, historyPageSize]);

    const handleCreate = () => {
        if (!formEmpId || !formReference || !formAmount || !formMonthly || !formOutstanding || !formStartDate || !formEndDate) {
            toast.error("Please fill all required fields");
            return;
        }
        createPagibigLoan({
            employeeId: formEmpId,
            loanType: formLoanType,
            referenceNumber: formReference,
            loanAmount: Number(formAmount),
            monthlyAmortization: Number(formMonthly),
            outstandingBalance: Number(formOutstanding),
            startDeductionDate: formStartDate,
            endDate: formEndDate,
            dateReleased: formStartDate,
        });
        toast.success(`Pag-IBIG loan created for ${getEmpName(formEmpId)}`);
        setOpen(false);
        setFormEmpId("");
        setFormReference("");
        setFormAmount("");
        setFormMonthly("");
        setFormOutstanding("");
        setFormStartDate("");
        setFormEndDate("");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">{pagibigLoans.length} Pag-IBIG loan(s)</p>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-1.5"><Plus className="h-4 w-4" /> Create Pag-IBIG Loan</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Create Pag-IBIG Loan</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-sm font-medium">Employee</label>
                                <div className="mt-1">
                                    <EmployeeCombobox value={formEmpId} onValueChange={setFormEmpId} required placeholder="Select employee" className="w-full" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Loan Type</label>
                                <Select value={formLoanType} onValueChange={(v) => setFormLoanType(v as "mpl" | "calamity")}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mpl">Multi-Purpose Loan (MPL)</SelectItem>
                                        <SelectItem value="calamity">Calamity Loan</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Loan Reference No.</label>
                                <Input value={formReference} onChange={(e) => setFormReference(e.target.value)} className="mt-1" placeholder="e.g. HDMF-2026-5512" />
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
                            <div>
                                <label className="text-sm font-medium">Outstanding Balance (₱)</label>
                                <Input type="number" value={formOutstanding} onChange={(e) => setFormOutstanding(e.target.value)} className="mt-1" />
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
                            <Button onClick={handleCreate} className="w-full">Create Pag-IBIG Loan</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <LoanKpiCards
                activeLabel="Active Pag-IBIG Loans"
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
                                            <TableHead className="text-xs">Loan Type</TableHead>
                                            <TableHead className="text-xs">Loan Amount</TableHead>
                                            <TableHead className="text-xs">Outstanding Balance</TableHead>
                                            <TableHead className="text-xs">Monthly Amortization</TableHead>
                                            <TableHead className="text-xs">Date Released</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs w-20">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No Pag-IBIG loans found</TableCell></TableRow>
                                        ) : paginatedAccounts.map((loan) => (
                                            <TableRow key={loan.id}>
                                                <TableCell className="text-sm font-medium">{getEmpName(loan.employeeId)}</TableCell>
                                                <TableCell className="text-xs">{PAGIBIG_LOAN_TYPE_LABELS[loan.loanType]}</TableCell>
                                                <TableCell className="text-sm">₱{loan.loanAmount.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm font-medium">₱{loan.outstandingBalance.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{loan.monthlyAmortization.toLocaleString()}</TableCell>
                                                <TableCell className="text-xs">{new Date(loan.dateReleased).toLocaleDateString()}</TableCell>
                                                <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit loan" onClick={() => toast.info("Edit Pag-IBIG loan — UI only")}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {loan.status === "active" && (
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Settle" onClick={() => { settlePagibigLoan(loan.id); toast.success("Pag-IBIG loan settled"); }}>
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
                        <Card className="border border-border/50"><CardContent className="py-8 text-center text-sm text-muted-foreground">No active Pag-IBIG loans with repayment schedules</CardContent></Card>
                    ) : (
                        <>
                            {paginatedActiveLoans.map((loan) => {
                                const totalDeducted = loan.loanAmount - loan.outstandingBalance;
                                const schedule = generateSchedule(loan.startDeductionDate, loan.endDate, loan.monthlyAmortization, totalDeducted);
                                return (
                                    <Card key={loan.id} className="border border-border/50">
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <p className="text-sm font-semibold">{getEmpName(loan.employeeId)} — {PAGIBIG_LOAN_TYPE_LABELS[loan.loanType]}</p>
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
