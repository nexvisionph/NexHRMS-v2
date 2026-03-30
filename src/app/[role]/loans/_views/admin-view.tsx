"use client";

import { useState, useMemo } from "react";
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
import { Plus, Snowflake, CheckCircle, MinusCircle, Play, History, Calendar, Percent, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuditStore } from "@/store/audit.store";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function AdminLoansView() {
    const { loans, createLoan, deductFromLoan, settleLoan, freezeLoan, unfreezeLoan, getAllDeductions, getSchedule, updateLoan, cancelLoan } = useLoansStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);

    const [open, setOpen] = useState(false);
    const [formEmpId, setFormEmpId] = useState("");
    const [formType, setFormType] = useState("cash_advance");
    const [formAmount, setFormAmount] = useState("");
    const [formMonthly, setFormMonthly] = useState("");
    const [formRemarks, setFormRemarks] = useState("");
    const [formCapPercent, setFormCapPercent] = useState("30");
    const [statusFilter, setStatusFilter] = useState("all");

    const [editOpen, setEditOpen] = useState(false);
    const [editLoanId, setEditLoanId] = useState<string | null>(null);
    const [editMonthly, setEditMonthly] = useState("");
    const [editCap, setEditCap] = useState("");
    const [editRemarks, setEditRemarks] = useState("");
    const [cancelId, setCancelId] = useState<string | null>(null);

    const openEditLoan = (loan: typeof loans[0]) => {
        setEditLoanId(loan.id);
        setEditMonthly(String(loan.monthlyDeduction));
        setEditCap(String(loan.deductionCapPercent || 30));
        setEditRemarks(loan.remarks || "");
        setEditOpen(true);
    };

    const handleSaveLoan = () => {
        if (!editLoanId || !editMonthly) { toast.error("Monthly deduction is required"); return; }
        updateLoan(editLoanId, { monthlyDeduction: Number(editMonthly), deductionCapPercent: Number(editCap) || 30, remarks: editRemarks || undefined });
        toast.success("Loan terms updated");
        setEditOpen(false); setEditLoanId(null);
    };

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    const filtered = useMemo(() => loans.filter((l) => statusFilter === "all" || l.status === statusFilter), [loans, statusFilter]);

    const stats = useMemo(() => {
        const active = loans.filter((l) => l.status === "active");
        return { totalActive: active.length, totalOutstanding: active.reduce((sum, l) => sum + l.remainingBalance, 0), totalSettled: loans.filter((l) => l.status === "settled").length };
    }, [loans]);

    const handleCreate = () => {
        if (!formEmpId || !formAmount || !formMonthly) { toast.error("Please fill all required fields"); return; }
        createLoan({ employeeId: formEmpId, type: formType, amount: Number(formAmount), monthlyDeduction: Number(formMonthly), deductionCapPercent: Number(formCapPercent) || 30, status: "active", approvedBy: currentUser.id, remarks: formRemarks || undefined });
        useAuditStore.getState().log({ entityType: "loan", entityId: formEmpId, action: "loan_created", performedBy: currentUser.id });
        toast.success(`Loan created for ${getEmpName(formEmpId)}`);
        setOpen(false); setFormEmpId(""); setFormAmount(""); setFormMonthly(""); setFormRemarks("");
    };

    const allDeductions = getAllDeductions();

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Loans & Cash Advances</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{loans.length} total loans</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild><Button className="gap-1.5"><Plus className="h-4 w-4" /> Create Loan</Button></DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Create Loan / Cash Advance</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div><label className="text-sm font-medium">Employee</label>
                                <Select value={formEmpId} onValueChange={setFormEmpId}><SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger><SelectContent>{employees.filter((e) => e.status === "active" && e.id).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                            <div><label className="text-sm font-medium">Loan Type</label>
                                <Select value={formType} onValueChange={setFormType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash_advance">Cash Advance</SelectItem><SelectItem value="salary_loan">Salary Loan</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-sm font-medium">Total Amount (₱)</label><Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="mt-1" placeholder="e.g. 50000" /></div>
                                <div><label className="text-sm font-medium">Monthly Deduction (₱)</label><Input type="number" value={formMonthly} onChange={(e) => setFormMonthly(e.target.value)} className="mt-1" placeholder="e.g. 5000" /></div>
                            </div>
                            {formAmount && formMonthly && Number(formMonthly) > 0 && <p className="text-xs text-muted-foreground">≈ {Math.ceil(Number(formAmount) / Number(formMonthly))} monthly installments</p>}
                            <div><label className="text-sm font-medium">Remarks (optional)</label><Input value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} className="mt-1" placeholder="e.g. emergency funds" /></div>
                            <div><label className="text-sm font-medium">Deduction Cap (% of Net Pay)</label><Input type="number" min="1" max="100" value={formCapPercent} onChange={(e) => setFormCapPercent(e.target.value)} className="mt-1" placeholder="30" /><p className="text-[10px] text-muted-foreground mt-0.5">Maximum % of net pay that can be deducted (default 30%)</p></div>
                            <Button onClick={handleCreate} className="w-full">Create Loan</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border border-blue-500/20 bg-blue-500/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-medium">Active Loans</p><p className="text-2xl font-bold mt-1">{stats.totalActive}</p></CardContent></Card>
                <Card className="border border-amber-500/20 bg-amber-500/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-medium">Outstanding Balance</p><p className="text-2xl font-bold mt-1">₱{stats.totalOutstanding.toLocaleString()}</p></CardContent></Card>
                <Card className="border border-emerald-500/20 bg-emerald-500/5"><CardContent className="p-4"><p className="text-xs text-muted-foreground font-medium">Settled</p><p className="text-2xl font-bold mt-1">{stats.totalSettled}</p></CardContent></Card>
            </div>

            <div className="flex items-center gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="settled">Settled</SelectItem><SelectItem value="frozen">Frozen</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select>
            </div>

            <Tabs defaultValue="loans">
                <TabsList className="w-full overflow-x-auto justify-start">
                    <TabsTrigger value="loans">Loan Accounts</TabsTrigger>
                    <TabsTrigger value="schedule" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Repayment Schedule</TabsTrigger>
                    <TabsTrigger value="history" className="gap-1.5"><History className="h-3.5 w-3.5" /> Deduction History{allDeductions.length > 0 && <span className="ml-1 bg-primary/15 text-primary text-[10px] px-1.5 py-0.5 rounded-full">{allDeductions.length}</span>}</TabsTrigger>
                </TabsList>

                <TabsContent value="loans" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-xs">Employee</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Balance</TableHead><TableHead className="text-xs">Progress</TableHead><TableHead className="text-xs">Monthly</TableHead><TableHead className="text-xs">Cap</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs w-28">Actions</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">No loans found</TableCell></TableRow>
                                        ) : filtered.map((loan) => {
                                            const paidPct = loan.amount > 0 ? Math.round(((loan.amount - loan.remainingBalance) / loan.amount) * 100) : 100;
                                            const statusColor = loan.status === "active" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400" : loan.status === "settled" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : loan.status === "cancelled" ? "bg-red-500/15 text-red-700 dark:text-red-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400";
                                            return (
                                                <TableRow key={loan.id}>
                                                    <TableCell className="text-sm font-medium">{getEmpName(loan.employeeId)}</TableCell>
                                                    <TableCell className="text-xs capitalize">{loan.type.replace("_", " ")}</TableCell>
                                                    <TableCell className="text-sm">₱{loan.amount.toLocaleString()}</TableCell>
                                                    <TableCell className="text-sm font-medium">₱{loan.remainingBalance.toLocaleString()}</TableCell>
                                                    <TableCell className="w-32"><div className="flex items-center gap-2"><Progress value={paidPct} className="h-2 flex-1" /><span className="text-[10px] text-muted-foreground w-8">{paidPct}%</span></div></TableCell>
                                                    <TableCell className="text-xs">₱{loan.monthlyDeduction.toLocaleString()}/mo</TableCell>
                                                    <TableCell><Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-700 dark:text-violet-400"><Percent className="h-2.5 w-2.5 mr-0.5" />{loan.deductionCapPercent || 30}%</Badge></TableCell>
                                                    <TableCell><Badge variant="secondary" className={`text-[10px] ${statusColor}`}>{loan.status}</Badge></TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            {(loan.status === "active" || loan.status === "frozen") && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLoan(loan)} title="Edit terms"><Pencil className="h-3.5 w-3.5" /></Button>}
                                                            {loan.status === "active" && (<>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => { deductFromLoan(loan.id, loan.monthlyDeduction); toast.success(`₱${loan.monthlyDeduction.toLocaleString()} deducted`); }} title="Deduct monthly"><MinusCircle className="h-3.5 w-3.5" /></Button>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => { settleLoan(loan.id); useAuditStore.getState().log({ entityType: "loan", entityId: loan.id, action: "loan_settled", performedBy: currentUser.id }); toast.success("Loan settled"); }} title="Settle fully"><CheckCircle className="h-3.5 w-3.5" /></Button>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" onClick={() => { freezeLoan(loan.id); useAuditStore.getState().log({ entityType: "loan", entityId: loan.id, action: "loan_frozen", performedBy: currentUser.id }); toast.success("Loan frozen"); }} title="Freeze"><Snowflake className="h-3.5 w-3.5" /></Button>
                                                            </>)}
                                                            {loan.status === "frozen" && <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" onClick={() => { unfreezeLoan(loan.id); useAuditStore.getState().log({ entityType: "loan", entityId: loan.id, action: "loan_unfrozen", performedBy: currentUser.id }); toast.success("Loan unfrozen"); }} title="Unfreeze"><Play className="h-3.5 w-3.5" /></Button>}
                                                            {loan.status === "settled" && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => setCancelId(loan.id)} title="Remove record"><Trash2 className="h-3.5 w-3.5" /></Button>}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="schedule" className="mt-4">
                    <div className="space-y-4">
                        {loans.filter((l) => l.status === "active").length === 0 ? (
                            <Card className="border border-border/50"><CardContent className="py-8 text-center text-sm text-muted-foreground">No active loans with repayment schedules</CardContent></Card>
                        ) : loans.filter((l) => l.status === "active").map((loan) => {
                            const schedule = getSchedule(loan.id);
                            return (
                                <Card key={loan.id} className="border border-border/50">
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div><p className="text-sm font-semibold">{getEmpName(loan.employeeId)} — {loan.type.replace("_", " ")}</p><p className="text-xs text-muted-foreground">Principal: ₱{loan.amount.toLocaleString()} · Monthly: ₱{loan.monthlyDeduction.toLocaleString()} · Cap: {loan.deductionCapPercent || 30}%</p></div>
                                            <Badge variant="outline" className="text-[10px]">{schedule.length} installments</Badge>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader><TableRow><TableHead className="text-xs">#</TableHead><TableHead className="text-xs">Due Date</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {schedule.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-4">No schedule generated</TableCell></TableRow> : schedule.map((inst, idx) => (
                                                        <TableRow key={idx}><TableCell className="text-sm">{idx + 1}</TableCell><TableCell className="text-sm">{new Date(inst.dueDate).toLocaleDateString()}</TableCell><TableCell className="text-sm font-medium">₱{inst.amount.toLocaleString()}</TableCell>
                                                            <TableCell><Badge variant={inst.paid ? "default" : "secondary"} className={`text-[10px] ${inst.paid ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : ""}`}>{inst.paid ? "paid" : inst.skippedReason ? `skipped (${inst.skippedReason})` : "pending"}</Badge></TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow><TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Employee</TableHead><TableHead className="text-xs">Loan ID</TableHead><TableHead className="text-xs">Payslip</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Balance After</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {allDeductions.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No deduction history yet</TableCell></TableRow> : allDeductions.map((d) => (
                                            <TableRow key={d.id}><TableCell className="text-sm">{new Date(d.deductedAt).toLocaleDateString()}</TableCell><TableCell className="text-sm font-medium">{getEmpName(d.employeeId)}</TableCell><TableCell><code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{d.loanId}</code></TableCell><TableCell><code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{d.payslipId}</code></TableCell><TableCell className="text-sm font-medium text-red-600 dark:text-red-400">−₱{d.amount.toLocaleString()}</TableCell><TableCell className="text-sm">₱{d.remainingAfter.toLocaleString()}</TableCell></TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Edit Loan Terms</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div><label className="text-sm font-medium">Monthly Deduction (₱)</label><Input type="number" value={editMonthly} onChange={(e) => setEditMonthly(e.target.value)} className="mt-1" /></div>
                        <div><label className="text-sm font-medium">Deduction Cap (% of Net Pay)</label><Input type="number" min="1" max="100" value={editCap} onChange={(e) => setEditCap(e.target.value)} className="mt-1" /></div>
                        <div><label className="text-sm font-medium">Remarks</label><Input value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)} className="mt-1" placeholder="Optional notes" /></div>
                        <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button><Button className="flex-1" onClick={handleSaveLoan}>Save Changes</Button></div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Remove Loan Record?</AlertDialogTitle><AlertDialogDescription>This settled loan record will be permanently removed. Deduction history will also be lost.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (cancelId) { cancelLoan(cancelId); toast.success("Loan record removed"); setCancelId(null); } }}>Remove</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
