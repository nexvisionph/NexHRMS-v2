"use client";

import { useState, useCallback } from "react";
import type { LoanStatus } from "@/types";
import { useLoansStore } from "@/store/loans.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Download, CheckCircle, XCircle, History, Pencil, Trash2, FileText, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuditStore } from "@/store/audit.store";
import { dispatchNotification } from "@/lib/notifications";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmployeeCombobox } from "@/components/ui/employee-combobox";
import { LoansFilterBar } from "@/app/[role]/loans/_components/loans-filter-bar";
import { LoansTablePagination, paginate } from "@/app/[role]/loans/_components/loans-table-pagination";
import { LoanStatusBadge } from "@/app/[role]/loans/_components/loan-status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { approveLoan, rejectLoan } from "@/services/loans-actions.service";
import { loansStorage } from "@/services/db.service";
import { Label } from "@/components/ui/label";

export function GovernmentLoansTab() {
    const { loans, createLoan, settleLoan, getAllDeductions, updateLoan, cancelLoan } = useLoansStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);

    const [open, setOpen] = useState(false);
    const [formEmpId, setFormEmpId] = useState("");
    const [formAgency, setFormAgency] = useState<"SSS" | "Pag-IBIG">("SSS");
    const [formLoanType, setFormLoanType] = useState("salary_loan");
    const [formAmount, setFormAmount] = useState("");
    const [formMonthly, setFormMonthly] = useState("");
    const [formBalance, setFormBalance] = useState("");
    const [formReleaseDate, setFormReleaseDate] = useState("");
    const [formStartDate, setFormStartDate] = useState("");
    const [formReference, setFormReference] = useState("");
    const [formRemarks, setFormRemarks] = useState("");

    const [statusFilter, setStatusFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [accountsPage, setAccountsPage] = useState(1);
    const [accountsPageSize, setAccountsPageSize] = useState(10);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPageSize, setHistoryPageSize] = useState(10);

    const [editOpen, setEditOpen] = useState(false);
    const [editLoanId, setEditLoanId] = useState<string | null>(null);
    const [editMonthly, setEditMonthly] = useState("");
    const [editBalance, setEditBalance] = useState("");
    const [editReference, setEditReference] = useState("");
    const [editRemarks, setEditRemarks] = useState("");
    const [editStatus, setEditStatus] = useState<LoanStatus>("active");
    const [cancelId, setCancelId] = useState<string | null>(null);

    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectLoanId, setRejectLoanId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");
    const [viewDetailsLoan, setViewDetailsLoan] = useState<typeof loans[0] | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [editFile, setEditFile] = useState<File | null>(null);
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

    const handleApprove = async (loan: typeof loans[0]) => {
        const ok = await approveLoan(loan.id, "active", currentUser.id);
        if (ok) {
            toast.success("Government loan request verified and activated");
            useAuditStore.getState().log({
                entityType: "loan",
                entityId: loan.id,
                action: "loan_approved",
                performedBy: currentUser.id,
            });
            try {
                const emp = employees.find(e => e.id === loan.employeeId);
                if (emp) {
                    dispatchNotification("loan_unfrozen", { name: emp.name, type: `${loan.agency} Loan` }, emp.id, emp.email ?? undefined, emp.phone, undefined, { suppressToast: true });
                }
            } catch { /* best effort */ }
        } else {
            toast.error("Failed to approve loan");
        }
    };

    const submitRejection = async () => {
        if (!rejectLoanId || !rejectionReason.trim()) {
            toast.error("Please enter a rejection reason");
            return;
        }
        const ok = await rejectLoan(rejectLoanId, rejectionReason, currentUser.id);
        if (ok) {
            toast.success("Government loan request rejected");
            useAuditStore.getState().log({
                entityType: "loan",
                entityId: rejectLoanId,
                action: "loan_rejected",
                performedBy: currentUser.id,
                reason: `Reason: ${rejectionReason}`
            });
            setRejectOpen(false);
            setRejectLoanId(null);
            setRejectionReason("");
        } else {
            toast.error("Failed to reject loan");
        }
    };

    const handleExportSSSLCL = () => {
        const sssLoans = governmentLoans.filter((l) => l.agency === "SSS" && (l.status === "active" || l.status === "settled"));
        if (sssLoans.length === 0) {
            toast.error("No SSS loans available to export");
            return;
        }

        const csvContent = [
            ["Employee Name", "SS Number", "Loan Type", "Reference No.", "Monthly Amortization", "Remaining Balance", "Status"],
            ...sssLoans.map((l) => [
                getEmpName(l.employeeId),
                "N/A",
                getLoanTypeLabel(l.loanType),
                l.referenceNumber || "N/A",
                `₱${l.monthlyDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                `₱${l.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                l.status
            ])
        ]
            .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
            .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `SSS_Loan_Collection_List_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("SSS Loan Collection List exported successfully");
    };

    const handleExportPagIBIGSTL = () => {
        const pagibigLoans = governmentLoans.filter((l) => l.agency === "Pag-IBIG" && (l.status === "active" || l.status === "settled"));
        if (pagibigLoans.length === 0) {
            toast.error("No Pag-IBIG loans available to export");
            return;
        }

        const csvContent = [
            ["Employee Name", "Agency ID Number", "Loan Type", "Loan Account No.", "Loan Amount", "Monthly Amortization", "Outstanding Balance", "Status"],
            ...pagibigLoans.map((l) => [
                getEmpName(l.employeeId),
                "N/A",
                getLoanTypeLabel(l.loanType),
                l.referenceNumber || "N/A",
                `₱${l.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                `₱${l.monthlyDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                `₱${l.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                l.status
            ])
        ]
            .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
            .join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Pag-IBIG_STL_Remittance_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Pag-IBIG STL Remittance file exported successfully");
    };

    const getEmpName = useCallback((id: string) => employees.find((e) => e.id === id)?.name || id, [employees]);

    // Filter for only Government Loans (type = government_loan or type in sss/pagibig)
    const governmentLoans = loans.filter((l) => l.type === "government_loan" || l.type === "sss" || l.type === "pagibig");

    const filtered = governmentLoans.filter((l) => {
        const q = search.trim().toLowerCase();
        const matchesStatus = statusFilter === "all" || l.status === statusFilter;
        const matchesSearch = !q || getEmpName(l.employeeId).toLowerCase().includes(q) || (l.referenceNumber || "").toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
    });

    const stats = (() => {
        const active = governmentLoans.filter((l) => l.status === "active");
        return {
            totalActive: active.length,
            totalOutstanding: active.reduce((sum, l) => sum + l.remainingBalance, 0),
            totalMonthly: active.reduce((sum, l) => sum + l.monthlyDeduction, 0),
            totalSettled: governmentLoans.filter((l) => l.status === "settled").length,
        };
    })();

    const paginatedAccounts = paginate(filtered, accountsPage, accountsPageSize);

    const allDeductions = getAllDeductions().filter((d) => governmentLoans.some((l) => l.id === d.loanId));
    const filteredDeductions = allDeductions.filter((d) => {
        const q = search.trim().toLowerCase();
        return !q || getEmpName(d.employeeId).toLowerCase().includes(q);
    });
    const paginatedDeductions = paginate(filteredDeductions, historyPage, historyPageSize);

    // Handle Agency changes to set logical default loan types
    const handleAgencyChange = (agency: "SSS" | "Pag-IBIG") => {
        setFormAgency(agency);
        if (agency === "SSS") {
            setFormLoanType("salary_loan");
        } else {
            setFormLoanType("mpl");
        }
    };

    const handleCreate = async () => {
        if (!formEmpId || !formAmount || !formMonthly || !formBalance || !formReleaseDate || !formStartDate) {
            toast.error("Please fill all required fields");
            return;
        }

        let proofPath = "";
        if (selectedFile) {
            setUploading(true);
            try {
                const formData = new FormData();
                formData.append("file", selectedFile);
                formData.append("bucket", "loan-proofs");
                formData.append("folder", formEmpId);

                const res = await fetch("/api/upload", { method: "POST", body: formData });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: "Upload failed" }));
                    throw new Error(err.error || "Upload failed");
                }
                const uploadData = await res.json();
                proofPath = uploadData.path;
            } catch (err: any) {
                toast.error(err.message || "Failed to upload proof document");
                setUploading(false);
                return;
            }
        }
        setUploading(false);

        createLoan({
            employeeId: formEmpId,
            type: "government_loan",
            amount: Number(formAmount),
            remainingBalance: Number(formBalance),
            monthlyDeduction: Number(formMonthly),
            status: "active", // Created directly by Admin/HR is active
            approvedBy: currentUser.id,
            remarks: formRemarks || undefined,
            agency: formAgency,
            loanType: formLoanType,
            referenceNumber: formReference || undefined,
            releaseDate: formReleaseDate,
            startDeductionDate: formStartDate,
            deductionFrequency: "every_payroll", // default for government loans
            proofFilePath: proofPath || undefined,
        });

        useAuditStore.getState().log({ entityType: "loan", entityId: formEmpId, action: "loan_created", performedBy: currentUser.id });
        toast.success(`Government loan record submitted for ${getEmpName(formEmpId)}`);

        try {
            const emp = employees.find((e) => e.id === formEmpId);
            if (emp) {
                dispatchNotification("loan_created", {
                    name: emp.name,
                    type: `${formAgency} ${getLoanTypeLabel(formLoanType)}`,
                    amount: Number(formAmount).toLocaleString(),
                    monthlyDeduction: Number(formMonthly).toLocaleString(),
                }, emp.id, emp.email ?? undefined, emp.phone, undefined, { suppressToast: true });
            }
        } catch { /* best effort */ }

        setOpen(false);
        setFormEmpId("");
        setFormAmount("");
        setFormMonthly("");
        setFormBalance("");
        setFormReleaseDate("");
        setFormStartDate("");
        setFormReference("");
        setFormRemarks("");
        setSelectedFile(null);
    };

    const openEditLoan = (loan: typeof loans[0]) => {
        setEditLoanId(loan.id);
        setEditMonthly(String(loan.monthlyDeduction));
        setEditBalance(String(loan.remainingBalance));
        setEditReference(loan.referenceNumber || "");
        setEditRemarks(loan.remarks || "");
        setEditStatus(loan.status);
        setEditFile(null);
        setEditOpen(true);
    };

    const handleSaveLoan = async () => {
        if (!editLoanId || !editMonthly || !editBalance) { toast.error("Monthly amortization and outstanding balance are required"); return; }

        let proofPath = "";
        if (editFile) {
            setUploading(true);
            try {
                const loan = loans.find(l => l.id === editLoanId);
                const empId = loan?.employeeId || "unknown";

                const formData = new FormData();
                formData.append("file", editFile);
                formData.append("bucket", "loan-proofs");
                formData.append("folder", empId);

                const res = await fetch("/api/upload", { method: "POST", body: formData });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: "Upload failed" }));
                    throw new Error(err.error || "Upload failed");
                }
                const uploadData = await res.json();
                proofPath = uploadData.path;
            } catch (err: any) {
                toast.error(err.message || "Failed to upload new proof document");
                setUploading(false);
                return;
            }
        }
        setUploading(false);

        updateLoan(editLoanId, {
            monthlyDeduction: Number(editMonthly),
            remainingBalance: Number(editBalance),
            referenceNumber: editReference || undefined,
            remarks: editRemarks || undefined,
            status: editStatus,
            proofFilePath: proofPath || undefined,
        });
        toast.success("Government loan updated");
        setEditOpen(false);
        setEditLoanId(null);
        setEditFile(null);
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
                <p className="text-sm text-muted-foreground">{governmentLoans.length} government loans</p>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-1 bg-background text-xs font-semibold" onClick={handleExportSSSLCL}><Download className="h-4 w-4" />Export SSS LCL</Button>
                    <Button variant="outline" className="gap-1 bg-background text-xs font-semibold" onClick={handleExportPagIBIGSTL}><Download className="h-4 w-4" />Export Pag-IBIG STL</Button>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-1.5"><Plus className="h-4 w-4" /> Create Government Loan</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader><DialogTitle>Create Government Loan</DialogTitle></DialogHeader>
                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="text-sm font-medium">Employee <span className="text-destructive">*</span></label>
                                    <div className="mt-1">
                                        <EmployeeCombobox value={formEmpId} onValueChange={setFormEmpId} required placeholder="Select employee" className="w-full" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium">Agency <span className="text-destructive">*</span></label>
                                        <Select value={formAgency} onValueChange={(v) => handleAgencyChange(v as "SSS" | "Pag-IBIG")}>
                                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="SSS">SSS</SelectItem>
                                                <SelectItem value="Pag-IBIG">Pag-IBIG</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Loan Type <span className="text-destructive">*</span></label>
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
                                        <label className="text-sm font-medium">Loan Amount <span className="text-destructive">*</span></label>
                                        <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Monthly Amort.<span className="text-destructive">*</span></label>
                                        <Input type="number" value={formMonthly} onChange={(e) => setFormMonthly(e.target.value)} className="mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Outstanding Bal. <span className="text-destructive">*</span></label>
                                        <Input type="number" value={formBalance} onChange={(e) => setFormBalance(e.target.value)} className="mt-1" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium">Release Date <span className="text-destructive">*</span></label>
                                        <Input type="date" value={formReleaseDate} onChange={(e) => setFormReleaseDate(e.target.value)} className="mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">First Deduction Date <span className="text-destructive">*</span></label>
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
                                        <Input value={formRemarks} onChange={(e) => setFormRemarks(e.target.value)} className="mt-1" placeholder="e.g. calamity emergency" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Proof of Loan (JPG, PNG, PDF)</label>
                                    <Input
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.pdf"
                                        className="cursor-pointer text-xs mt-1"
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
                                <Button onClick={handleCreate} className="w-full" disabled={uploading}>
                                    {uploading ? "Uploading Proof..." : "Create Gov Loan Record"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Card className="border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Active Gov Loans</p>
                        <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">{stats.totalActive}</p>
                    </CardContent>
                </Card>
                <Card className="border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Outstanding Balance</p>
                        <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">₱{stats.totalOutstanding.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card className="border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/10">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Monthly Deductions</p>
                        <p className="text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">₱{stats.totalMonthly.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card className="border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Settled Loans</p>
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
                    <TabsTrigger value="accounts">Government Loan Accounts</TabsTrigger>
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
                                            <TableHead className="text-xs">Agency</TableHead>
                                            <TableHead className="text-xs">Loan Type</TableHead>
                                            <TableHead className="text-xs">Loan Amount</TableHead>
                                            <TableHead className="text-xs">Monthly Amortization</TableHead>
                                            <TableHead className="text-xs">Outstanding Balance</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs">Proof</TableHead>
                                            <TableHead className="text-xs w-20">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">No government loans found</TableCell></TableRow>
                                        ) : paginatedAccounts.map((loan) => (
                                            <TableRow key={loan.id}>
                                                <TableCell className="text-sm font-medium">{getEmpName(loan.employeeId)}</TableCell>
                                                <TableCell className="text-sm font-semibold text-blue-600 dark:text-blue-400">{loan.agency || "SSS"}</TableCell>
                                                <TableCell className="text-xs">{getLoanTypeLabel(loan.loanType)}</TableCell>
                                                <TableCell className="text-sm">₱{loan.amount.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{loan.monthlyDeduction.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm font-medium">₱{loan.remainingBalance.toLocaleString()}</TableCell>
                                                <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                                                <TableCell>
                                                    {loan.proofFilePath ? (
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10" onClick={() => handleViewProof(loan.proofFilePath!)} title="View Proof">
                                                            <FileText className="h-3.5 w-3.5" />
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10" onClick={() => setViewDetailsLoan(loan)} title="View Full Details">
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {loan.status === "pending" && (
                                                            <>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10" onClick={() => handleApprove(loan)} title="Verify & Activate">
                                                                    <CheckCircle className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => {
                                                                    setRejectLoanId(loan.id);
                                                                    setRejectOpen(true);
                                                                }} title="Reject Submission">
                                                                    <XCircle className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        {(loan.status === "active" || loan.status === "frozen" || loan.status === "inactive" || loan.status === "cancelled" || loan.status === "settled" || loan.status === "rejected") && (
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLoan(loan)} title="Edit record">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        {loan.status === "active" && (
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => {
                                                                settleLoan(loan.id);
                                                                useAuditStore.getState().log({ entityType: "loan", entityId: loan.id, action: "loan_settled", performedBy: currentUser.id });
                                                                toast.success("Loan marked as settled");
                                                            }} title="Settle fully">
                                                                <CheckCircle className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        {(loan.status === "settled" || loan.status === "cancelled" || loan.status === "rejected" || loan.status === "inactive") && (
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
                                            <TableHead className="text-xs">Loan ID</TableHead>
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

            <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditFile(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Edit Government Loan</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium">Monthly Amortization (₱)</label>
                            <Input type="number" value={editMonthly} onChange={(e) => setEditMonthly(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Outstanding Balance (₱)</label>
                            <Input type="number" value={editBalance} onChange={(e) => setEditBalance(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Reference Number</label>
                            <Input value={editReference} onChange={(e) => setEditReference(e.target.value)} className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Status</label>
                            <Select value={editStatus} onValueChange={(v) => setEditStatus(v as LoanStatus)}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="frozen">Frozen</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="settled">Settled</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Remarks</label>
                            <Input value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)} className="mt-1" placeholder="Optional notes" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Change Proof Document (Optional)</label>
                            <Input
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                className="cursor-pointer text-xs mt-1"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        const file = e.target.files[0];
                                        if (file.size > 10 * 1024 * 1024) {
                                            toast.error("File is too large. Maximum size is 10MB.");
                                            e.target.value = "";
                                            return;
                                        }
                                        setEditFile(file);
                                    }
                                }}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleSaveLoan} disabled={uploading}>
                                {uploading ? "Uploading..." : "Save Changes"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Government Loan Record?</AlertDialogTitle>
                        <AlertDialogDescription>This loan record will be permanently removed. Deduction history will also be lost.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (cancelId) { cancelLoan(cancelId); toast.success("Record removed"); setCancelId(null); } }}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reject Government Loan Record</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <Label className="text-sm font-medium">Rejection Reason *</Label>
                            <Input
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="mt-1"
                                placeholder="Explain why the record is being rejected..."
                                required
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => { setRejectOpen(false); setRejectLoanId(null); setRejectionReason(""); }}>Cancel</Button>
                            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={submitRejection}>Reject Request</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <Dialog open={!!viewDetailsLoan} onOpenChange={(o) => !o && setViewDetailsLoan(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Government Loan Details</DialogTitle>
                    </DialogHeader>
                    {viewDetailsLoan && (
                        <div className="space-y-4 pt-2 text-sm">
                            <div className="grid grid-cols-2 gap-y-2 border-b border-border/50 pb-3">
                                <div className="text-muted-foreground">Employee:</div>
                                <div className="font-semibold text-right">{getEmpName(viewDetailsLoan.employeeId)}</div>
                                <div className="text-muted-foreground">Agency:</div>
                                <div className="font-semibold text-right text-blue-600 dark:text-blue-400">{viewDetailsLoan.agency || "SSS"}</div>
                                <div className="text-muted-foreground">Loan Type:</div>
                                <div className="font-semibold text-right">{getLoanTypeLabel(viewDetailsLoan.loanType)}</div>
                                <div className="text-muted-foreground">Status:</div>
                                <div className="text-right flex justify-end"><LoanStatusBadge status={viewDetailsLoan.status} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-y-2 border-b border-border/50 pb-3">
                                <div className="text-muted-foreground">Loan Amount:</div>
                                <div className="font-semibold text-right">₱{viewDetailsLoan.amount.toLocaleString()}</div>
                                <div className="text-muted-foreground">Monthly Amortization:</div>
                                <div className="font-semibold text-right">₱{viewDetailsLoan.monthlyDeduction.toLocaleString()}</div>
                                <div className="text-muted-foreground">Outstanding Balance:</div>
                                <div className="font-semibold text-right">₱{viewDetailsLoan.remainingBalance.toLocaleString()}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-y-2 border-b border-border/50 pb-3">
                                <div className="text-muted-foreground">Release Date:</div>
                                <div className="font-semibold text-right">{viewDetailsLoan.releaseDate ? new Date(viewDetailsLoan.releaseDate).toLocaleDateString() : "—"}</div>
                                <div className="text-muted-foreground">First Deduction Date:</div>
                                <div className="font-semibold text-right">{viewDetailsLoan.startDeductionDate ? new Date(viewDetailsLoan.startDeductionDate).toLocaleDateString() : "—"}</div>
                                <div className="text-muted-foreground">Reference Number:</div>
                                <div className="font-semibold text-right font-mono">{viewDetailsLoan.referenceNumber || "—"}</div>
                            </div>
                            {viewDetailsLoan.proofFilePath && (
                                <div className="flex items-center justify-between border-b border-border/50 pb-3">
                                    <span className="text-muted-foreground">Uploaded Proof:</span>
                                    <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => handleViewProof(viewDetailsLoan.proofFilePath!)}>
                                        <FileText className="h-3.5 w-3.5" /> View Document
                                    </Button>
                                </div>
                            )}
                            {viewDetailsLoan.remarks && (
                                <div className="space-y-1">
                                    <div className="text-muted-foreground">Remarks:</div>
                                    <div className="p-2 rounded bg-muted/50 border border-border/30 text-xs italic">{viewDetailsLoan.remarks}</div>
                                </div>
                            )}
                            {viewDetailsLoan.status === "rejected" && viewDetailsLoan.rejectionReason && (
                                <div className="space-y-1 p-3 rounded-lg border border-red-500/20 bg-red-500/5 dark:bg-red-500/10">
                                    <div className="text-red-500 font-semibold text-xs">Rejection Details:</div>
                                    <div className="text-xs text-red-600 dark:text-red-400 mt-1">{viewDetailsLoan.rejectionReason}</div>
                                    {viewDetailsLoan.reviewedBy && (
                                        <div className="text-[10px] text-muted-foreground mt-2">
                                            Reviewed by {getEmpName(viewDetailsLoan.reviewedBy)}
                                            {viewDetailsLoan.reviewedAt && ` on ${new Date(viewDetailsLoan.reviewedAt).toLocaleDateString()}`}
                                        </div>
                                    )}
                                </div>
                            )}
                            <Button className="w-full mt-2" onClick={() => setViewDetailsLoan(null)}>Close</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
