"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useLoansStore } from "@/store/loans.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Snowflake, CheckCircle, XCircle, Play, History, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuditStore } from "@/store/audit.store";
import { dispatchNotification } from "@/lib/notifications";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmployeeCombobox } from "@/components/ui/employee-combobox";
import { LoansFilterBar } from "@/app/[role]/loans/_components/loans-filter-bar";
import { LoansTablePagination, paginate } from "@/app/[role]/loans/_components/loans-table-pagination";
import { LoanStatusBadge } from "@/app/[role]/loans/_components/loan-status-badge";
import { approveLoan, rejectLoan } from "@/services/loans-actions.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CashAdvancesTab() {
    const { loans, createLoan, deductFromLoan, settleLoan, freezeLoan, unfreezeLoan, getAllDeductions, updateLoan, cancelLoan } = useLoansStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const params = useParams();

    const [open, setOpen] = useState(false);
    const [formEmpId, setFormEmpId] = useState("");
    const [formAmount, setFormAmount] = useState("");
    const [formMonthly, setFormMonthly] = useState("");
    const [formRemarks, setFormRemarks] = useState("");
    const [formCapPercent, setFormCapPercent] = useState("30");
    const [formFrequency, setFormFrequency] = useState<"every_payroll" | "first_payroll" | "last_payroll">("every_payroll");
    const [formStartDate, setFormStartDate] = useState("");

    const [statusFilter, setStatusFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [accountsPage, setAccountsPage] = useState(1);
    const [accountsPageSize, setAccountsPageSize] = useState(10);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(10);

    const [editOpen, setEditOpen] = useState(false);
    const [editLoanId, setEditLoanId] = useState<string | null>(null);
    const [editMonthly, setEditMonthly] = useState("");
    const [editCap, setEditCap] = useState("");
    const [editRemarks, setEditRemarks] = useState("");
    const [editFrequency, setEditFrequency] = useState<"every_payroll" | "first_payroll" | "last_payroll">("every_payroll");
    const [editStartDate, setEditStartDate] = useState("");
    const [cancelId, setCancelId] = useState<string | null>(null);

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    // Filter for only Cash Advances (type = cash_advance)
    const cashAdvances = useMemo(() => loans.filter((l) => l.type === "cash_advance"), [loans]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return cashAdvances.filter((l) => {
            const matchesStatus = statusFilter === "all" || l.status === statusFilter;
            const matchesSearch = !q || getEmpName(l.employeeId).toLowerCase().includes(q);
            return matchesStatus && matchesSearch;
        });
    }, [cashAdvances, statusFilter, search, employees]);

    const stats = useMemo(() => {
        const active = cashAdvances.filter((l) => l.status === "active");
        const pending = cashAdvances.filter((l) => l.status === "pending");
        return {
            totalActive: active.length,
            totalOutstanding: active.reduce((sum, l) => sum + l.remainingBalance, 0),
            totalPending: pending.length,
            totalSettled: cashAdvances.filter((l) => l.status === "settled").length,
        };
    }, [cashAdvances]);

    const paginatedAccounts = useMemo(() => paginate(filtered, accountsPage, accountsPageSize), [filtered, accountsPage, accountsPageSize]);

    const allDeductions = getAllDeductions().filter((d) => cashAdvances.some((l) => l.id === d.loanId));
    const filteredDeductions = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allDeductions.filter((d) => !q || getEmpName(d.employeeId).toLowerCase().includes(q));
    }, [allDeductions, search, employees]);
    const paginatedDeductions = useMemo(() => paginate(filteredDeductions, historyPage, historyPageSize), [filteredDeductions, historyPage, historyPageSize]);

    const openEditLoan = (loan: typeof loans[0]) => {
        setEditLoanId(loan.id);
        setEditMonthly(String(loan.monthlyDeduction));
        setEditCap(String(loan.deductionCapPercent || 30));
        setEditRemarks(loan.remarks || "");
        setEditFrequency(loan.deductionFrequency || "every_payroll");
        setEditStartDate(loan.startDeductionDate || "");
        setEditOpen(true);
    };

    const handleSaveLoan = () => {
        if (!editLoanId || !editMonthly) { toast.error("Monthly deduction is required"); return; }
        updateLoan(editLoanId, {
            monthlyDeduction: Number(editMonthly),
            deductionCapPercent: Number(editCap) || 30,
            remarks: editRemarks || undefined,
            deductionFrequency: editFrequency,
            startDeductionDate: editStartDate || undefined,
        });
        toast.success("Cash advance terms updated");
        setEditOpen(false);
        setEditLoanId(null);
    };

    const handleCreate = () => {
        if (!formEmpId || !formAmount || !formMonthly || !formStartDate) { toast.error("Please fill all required fields"); return; }
        
        createLoan({
            employeeId: formEmpId,
            type: "cash_advance",
            amount: Number(formAmount),
            monthlyDeduction: Number(formMonthly),
            deductionCapPercent: Number(formCapPercent) || 30,
            status: "active", // Created directly by Admin/HR is active
            approvedBy: currentUser.id,
            remarks: formRemarks || undefined,
            deductionFrequency: formFrequency,
            startDeductionDate: formStartDate,
            releaseDate: new Date().toISOString().split("T")[0],
        });

        useAuditStore.getState().log({ entityType: "loan", entityId: formEmpId, action: "loan_created", performedBy: currentUser.id });
        toast.success(`Cash Advance created for ${getEmpName(formEmpId)}`);

        try {
            const emp = employees.find((e) => e.id === formEmpId);
            if (emp) {
                dispatchNotification("loan_created", {
                    name: emp.name,
                    type: "Cash Advance",
                    amount: Number(formAmount).toLocaleString(),
                    monthlyDeduction: Number(formMonthly).toLocaleString(),
                }, emp.id, emp.email ?? undefined, emp.phone, undefined, { suppressToast: true });
            }
        } catch { /* best effort */ }

        setOpen(false);
        setFormEmpId("");
        setFormAmount("");
        setFormMonthly("");
        setFormRemarks("");
        setFormStartDate("");
        setFormFrequency("every_payroll");
    };

    const handleApprove = async (id: string) => {
        const ok = await approveLoan(id);
        if (ok) {
            toast.success("Cash advance request approved");
            const loan = cashAdvances.find(l => l.id === id);
            if (loan) {
                const emp = employees.find(e => e.id === loan.employeeId);
                if (emp) {
                    dispatchNotification("loan_unfrozen", { name: emp.name, type: "Cash Advance" }, emp.id, emp.email ?? undefined, emp.phone, undefined, { suppressToast: true });
                }
            }
        } else {
            toast.error("Failed to approve request");
        }
    };

    const handleReject = async (id: string) => {
        const ok = await rejectLoan(id);
        if (ok) {
            toast.success("Cash advance request rejected");
        } else {
            toast.error("Failed to reject request");
        }
    };

    const getFrequencyLabel = (freq?: string) => {
        if (freq === "first_payroll") return "First Payroll of Month";
        if (freq === "last_payroll") return "Last Payroll of Month";
        return "Every Payroll";
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">{cashAdvances.length} total cash advances</p>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"><Plus className="h-4 w-4" /> Create Cash Advance</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Create Cash Advance</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-sm font-medium">Employee *</label>
                                <div className="mt-1">
                                    <EmployeeCombobox value={formEmpId} onValueChange={setFormEmpId} required placeholder="Select employee" className="w-full" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Cash Advance Amount *</label>
                                    <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="mt-1" placeholder="e.g. 10000" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Monthly Deduction *</label>
                                    <Input type="number" value={formMonthly} onChange={(e) => setFormMonthly(e.target.value)} className="mt-1" placeholder="e.g. 2000" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Start Deduction Date *</label>
                                    <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Deduction Frequency *</label>
                                    <Select value={formFrequency} onValueChange={(v) => setFormFrequency(v as any)}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="every_payroll">Every Payroll (Split equally)</SelectItem>
                                            <SelectItem value="first_payroll">First Payroll of Month (15th)</SelectItem>
                                            <SelectItem value="last_payroll">Last Payroll of Month (30th)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Deduction Cap (% of Net Pay)</label>
                                    <Input type="number" min="1" max="100" value={formCapPercent} onChange={(e) => setFormCapPercent(e.target.value)} className="mt-1" placeholder="30" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Remarks</label>
                                    <Input value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} className="mt-1" placeholder="e.g. emergency cash" />
                                </div>
                            </div>
                            {formAmount && formMonthly && Number(formMonthly) > 0 && (
                                <p className="text-xs text-muted-foreground">≈ {Math.ceil(Number(formAmount) / Number(formMonthly))} monthly deductions</p>
                            )}
                            <Button onClick={handleCreate} className="w-full">Create Cash Advance</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Card className="border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Active Advances</p>
                        <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">{stats.totalActive}</p>
                    </CardContent>
                </Card>
                <Card className="border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Outstanding Balance</p>
                        <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">₱{stats.totalOutstanding.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card className="border border-violet-500/20 bg-violet-500/5 dark:bg-violet-500/10">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Pending Approval</p>
                        <p className="text-2xl font-bold mt-1 text-violet-600 dark:text-violet-400">{stats.totalPending}</p>
                    </CardContent>
                </Card>
                <Card className="border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Settled Advances</p>
                        <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{stats.totalSettled}</p>
                    </CardContent>
                </Card>
            </div>

            <LoansFilterBar
                search={search}
                onSearchChange={(v) => { setSearch(v); setAccountsPage(1); setHistoryPage(1); }}
                statusFilter={statusFilter}
                onStatusChange={(v) => { setStatusFilter(v); setAccountsPage(1); }}
            />

            <Tabs defaultValue="accounts">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="accounts">Cash Advance Accounts</TabsTrigger>
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
                                            <TableHead className="text-xs">Amount</TableHead>
                                            <TableHead className="text-xs">Monthly Deduction</TableHead>
                                            <TableHead className="text-xs">Outstanding Balance</TableHead>
                                            <TableHead className="text-xs">Frequency</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs">Release Date</TableHead>
                                            <TableHead className="text-xs w-28">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No records found</TableCell></TableRow>
                                        ) : paginatedAccounts.map((loan) => (
                                            <TableRow key={loan.id}>
                                                <TableCell className="text-sm font-medium">{getEmpName(loan.employeeId)}</TableCell>
                                                <TableCell className="text-sm">₱{loan.amount.toLocaleString()}</TableCell>
                                                <TableCell className="text-xs">₱{loan.monthlyDeduction.toLocaleString()}/mo</TableCell>
                                                <TableCell className="text-sm font-medium">₱{loan.remainingBalance.toLocaleString()}</TableCell>
                                                <TableCell className="text-xs">{getFrequencyLabel(loan.deductionFrequency)}</TableCell>
                                                <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                                                <TableCell className="text-xs">{loan.releaseDate ? new Date(loan.releaseDate).toLocaleDateString() : "-"}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        {loan.status === "pending" && (
                                                            <>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => handleApprove(loan.id)} title="Approve Request">
                                                                    <CheckCircle className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => handleReject(loan.id)} title="Reject Request">
                                                                    <XCircle className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        {(loan.status === "active" || loan.status === "frozen") && (
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLoan(loan)} title="Edit terms">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        {loan.status === "active" && (
                                                            <>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => { deductFromLoan(loan.id, loan.monthlyDeduction); toast.success(`₱${loan.monthlyDeduction.toLocaleString()} deducted`); }} title="Deduct">
                                                                    <MinusCircleIcon className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => {
                                                                    settleLoan(loan.id);
                                                                    useAuditStore.getState().log({ entityType: "loan", entityId: loan.id, action: "loan_settled", performedBy: currentUser.id });
                                                                    toast.success("Cash advance settled");
                                                                }} title="Settle fully">
                                                                    <CheckCircle className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" onClick={() => {
                                                                    freezeLoan(loan.id);
                                                                    useAuditStore.getState().log({ entityType: "loan", entityId: loan.id, action: "loan_frozen", performedBy: currentUser.id });
                                                                    toast.success("Cash advance frozen");
                                                                }} title="Freeze">
                                                                    <Snowflake className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        {loan.status === "frozen" && (
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => {
                                                                unfreezeLoan(loan.id);
                                                                useAuditStore.getState().log({ entityType: "loan", entityId: loan.id, action: "loan_unfrozen", performedBy: currentUser.id });
                                                                toast.success("Cash advance unfrozen");
                                                            }} title="Unfreeze">
                                                                <Play className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        {(loan.status === "settled" || loan.status === "rejected" || loan.status === "cancelled") && (
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => setCancelId(loan.id)} title="Remove record">
                                                                <Trash2 className="h-3.5 w-3.5" />
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

                <TabsContent value="history" className="mt-4 space-y-3">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Payroll Date</TableHead>
                                            <TableHead className="text-xs">Employee</TableHead>
                                            <TableHead className="text-xs">Cash Advance ID</TableHead>
                                            <TableHead className="text-xs">Deduction Amount</TableHead>
                                            <TableHead className="text-xs">Remaining Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredDeductions.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No deduction history yet</TableCell></TableRow>
                                        ) : paginatedDeductions.map((d) => (
                                            <TableRow key={d.id}>
                                                <TableCell className="text-sm">{new Date(d.deductedAt).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-sm font-medium">{getEmpName(d.employeeId)}</TableCell>
                                                <TableCell><code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{d.loanId}</code></TableCell>
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

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Edit Cash Advance Terms</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium">Monthly Deduction (₱)</label>
                            <Input type="number" value={editMonthly} onChange={(e) => setEditMonthly(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Deduction Cap (% of Net Pay)</label>
                            <Input type="number" min="1" max="100" value={editCap} onChange={(e) => setEditCap(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Deduction Frequency</label>
                            <Select value={editFrequency} onValueChange={(v) => setEditFrequency(v as any)}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="every_payroll">Every Payroll</SelectItem>
                                    <SelectItem value="first_payroll">First Payroll of Month</SelectItem>
                                    <SelectItem value="last_payroll">Last Payroll of Month</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Start Deduction Date</label>
                            <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Remarks</label>
                            <Input value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)} className="mt-1" placeholder="Optional notes" />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleSaveLoan}>Save Changes</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Cash Advance Record?</AlertDialogTitle>
                        <AlertDialogDescription>This settled cash advance record will be permanently removed. Deduction history will also be lost.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (cancelId) { cancelLoan(cancelId); toast.success("Record removed"); setCancelId(null); } }}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// Icon wrapper for MinusCircle (original Lucide icon)
function MinusCircleIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
    );
}
