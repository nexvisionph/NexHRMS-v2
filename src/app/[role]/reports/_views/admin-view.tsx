"use client";

import { useState, useMemo, useCallback } from "react";
import { usePayrollStore } from "@/store/payroll.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useLoansStore } from "@/store/loans.store";
import { useProjectsStore } from "@/store/projects.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Shield, Download, Search, ChevronLeft, ChevronRight, XCircle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";

export default function AdminReportsView() {
    const payslips = usePayrollStore((s) => s.payslips);
    const logs = useAttendanceStore((s) => s.logs);
    const employees = useEmployeesStore((s) => s.employees);
    const loans = useLoansStore((s) => s.loans);
    const projects = useProjectsStore((s) => s.projects);

    const getEmpName = useCallback((id: string) => employees.find((e) => e.id === id)?.name || id, [employees]);

    const payrollRegister = useMemo(() => [...payslips].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)), [payslips]);

    const govtSummary = useMemo(() => {
        const totals = { sss: 0, philhealth: 0, pagibig: 0, tax: 0 };
        payslips.forEach((p) => { totals.sss += (p.sssDeduction || 0); totals.philhealth += (p.philhealthDeduction || 0); totals.pagibig += (p.pagibigDeduction || 0); totals.tax += (p.taxDeduction || 0); });
        return totals;
    }, [payslips]);

    const absenceReport = useMemo(() => {
        const absences: Record<string, number> = {};
        logs.forEach((l) => { if (l.status === "absent") absences[l.employeeId] = (absences[l.employeeId] || 0) + 1; });
        return Object.entries(absences).map(([empId, count]) => ({ empId, name: getEmpName(empId), count })).sort((a, b) => b.count - a.count);
    }, [logs, getEmpName]);

    const lateReport = useMemo(() => {
        const lates: Record<string, { count: number; totalMinutes: number }> = {};
        logs.forEach((l) => { if (l.lateMinutes && l.lateMinutes > 0) { if (!lates[l.employeeId]) lates[l.employeeId] = { count: 0, totalMinutes: 0 }; lates[l.employeeId].count++; lates[l.employeeId].totalMinutes += l.lateMinutes; } });
        return Object.entries(lates).map(([empId, data]) => ({ empId, name: getEmpName(empId), ...data })).sort((a, b) => b.totalMinutes - a.totalMinutes);
    }, [logs, getEmpName]);

    const [tab, setTab] = useState("payroll_register");

    const PAGE_SIZES = [10, 20, 50];

    // ─── Payroll Register: search + pagination ─────────────────
    const [prSearch, setPrSearch] = useState("");
    const [prPage, setPrPage] = useState(1);
    const [prPageSize, setPrPageSize] = useState(10);

    // ─── Absence: search + severity filter + pagination ────────
    const [absSearch, setAbsSearch] = useState("");
    const [absSeverity, setAbsSeverity] = useState("all");
    const [absPage, setAbsPage] = useState(1);
    const [absPageSize, setAbsPageSize] = useState(10);

    // ─── Late: search + pagination ────────────────────────────
    const [lateSearch, setLateSearch] = useState("");
    const [latePage, setLatePage] = useState(1);
    const [latePageSize, setLatePageSize] = useState(10);

    // ─── 13th Month: search + pagination ─────────────────────
    const [thSearch, setThSearch] = useState("");
    const [thPage, setThPage] = useState(1);
    const [thPageSize, setThPageSize] = useState(10);

    // ─── Project Manpower: search + pagination ────────────────
    const [manpowerSearch, setManpowerSearch] = useState("");
    const [manpowerPage, setManpowerPage] = useState(1);
    const [manpowerPageSize, setManpowerPageSize] = useState(10);

    // ─── Loan Balances Report ──────────────────────────────────
    const loanBalances = useMemo(() => {
        return loans
            .filter((l) => l.status === "active")
            .map((l) => ({ ...l, empName: getEmpName(l.employeeId) }))
            .sort((a, b) => b.remainingBalance - a.remainingBalance);
    }, [loans, getEmpName]);

    // ─── 13th Month Accrual Report ────────────────────────────
    const thirteenthMonthData = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth(); // 0-indexed
        return employees
            .filter((e) => e.status === "active")
            .map((e) => {
                const joinDate = new Date(e.joinDate || `${currentYear}-01-01`);
                const joinYear = joinDate.getFullYear();
                const joinMonth = joinDate.getMonth();
                const monthsWorked = joinYear < currentYear
                    ? 12
                    : Math.min(12, Math.max(1, currentMonth - joinMonth + 1));
                const monthlyBasic = e.salary;
                const accrued = (monthlyBasic * monthsWorked) / 12;
                return { id: e.id, name: e.name, department: e.department, monthlyBasic, monthsWorked, accrued };
            })
            .sort((a, b) => b.accrued - a.accrued);
    }, [employees]);
    const totalAccrued13th = useMemo(() => thirteenthMonthData.reduce((s, r) => s + r.accrued, 0), [thirteenthMonthData]);

    // ─── Manpower Report ──────────────────────────────────────
    const [manpowerDate, setManpowerDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const manpowerReport = useMemo(() => {
        const dayLogs = logs.filter((l) => l.date === manpowerDate);
        return projects.map((p) => {
            const assigned = p.assignedEmployeeIds.length;
            const present = p.assignedEmployeeIds.filter((eid) => dayLogs.find((l) => l.employeeId === eid)?.status === "present").length;
            const onLeave = p.assignedEmployeeIds.filter((eid) => dayLogs.find((l) => l.employeeId === eid)?.status === "on_leave").length;
            const absent = Math.max(0, assigned - present - onLeave);
            return { ...p, assigned, present, onLeave, absent };
        });
    }, [projects, logs, manpowerDate]);

    // ─── Filtered/paginated payroll register ──────────────────
    const filteredPayrollRegister = useMemo(() => {
        if (!prSearch.trim()) return payrollRegister;
        const q = prSearch.toLowerCase();
        return payrollRegister.filter((ps) => getEmpName(ps.employeeId).toLowerCase().includes(q));
    }, [payrollRegister, prSearch, getEmpName]);

    // ─── Filtered absence report ───────────────────────────────
    const filteredAbsenceReport = useMemo(() => {
        return absenceReport.filter((row) => {
            const matchSearch = !absSearch || row.name.toLowerCase().includes(absSearch.toLowerCase());
            const severity = row.count >= 5 ? "high" : row.count >= 3 ? "moderate" : "low";
            const matchSeverity = absSeverity === "all" || severity === absSeverity;
            return matchSearch && matchSeverity;
        });
    }, [absenceReport, absSearch, absSeverity]);

    // ─── Filtered late report ─────────────────────────────────
    const filteredLateReport = useMemo(() => {
        if (!lateSearch.trim()) return lateReport;
        const q = lateSearch.toLowerCase();
        return lateReport.filter((row) => row.name.toLowerCase().includes(q));
    }, [lateReport, lateSearch]);

    // ─── Filtered 13th month data ─────────────────────────────
    const filteredThirteenthMonthData = useMemo(() => {
        if (!thSearch.trim()) return thirteenthMonthData;
        const q = thSearch.toLowerCase();
        return thirteenthMonthData.filter((r) => r.name.toLowerCase().includes(q) || (r.department || "").toLowerCase().includes(q));
    }, [thirteenthMonthData, thSearch]);
    const filteredTotalAccrued13th = useMemo(() => filteredThirteenthMonthData.reduce((s, r) => s + r.accrued, 0), [filteredThirteenthMonthData]);

    // ─── Filtered manpower report ─────────────────────────────
    const filteredManpowerReport = useMemo(() => {
        if (!manpowerSearch.trim()) return manpowerReport;
        const q = manpowerSearch.toLowerCase();
        return manpowerReport.filter((p) => p.name.toLowerCase().includes(q));
    }, [manpowerReport, manpowerSearch]);

    // ─── Pagination derived values ────────────────────────────
    const prTotalPages = Math.max(1, Math.ceil(filteredPayrollRegister.length / prPageSize));
    const prSafePage = Math.min(prPage, prTotalPages);
    const paginatedPayrollRegister = filteredPayrollRegister.slice((prSafePage - 1) * prPageSize, prSafePage * prPageSize);

    const absTotalPages = Math.max(1, Math.ceil(filteredAbsenceReport.length / absPageSize));
    const absSafePage = Math.min(absPage, absTotalPages);
    const paginatedAbsenceReport = filteredAbsenceReport.slice((absSafePage - 1) * absPageSize, absSafePage * absPageSize);

    const lateTotalPages = Math.max(1, Math.ceil(filteredLateReport.length / latePageSize));
    const lateSafePage = Math.min(latePage, lateTotalPages);
    const paginatedLateReport = filteredLateReport.slice((lateSafePage - 1) * latePageSize, lateSafePage * latePageSize);

    const thTotalPages = Math.max(1, Math.ceil(filteredThirteenthMonthData.length / thPageSize));
    const thSafePage = Math.min(thPage, thTotalPages);
    const paginatedThirteenthMonthData = filteredThirteenthMonthData.slice((thSafePage - 1) * thPageSize, thSafePage * thPageSize);

    const manpowerTotalPages = Math.max(1, Math.ceil(filteredManpowerReport.length / manpowerPageSize));
    const manpowerSafePage = Math.min(manpowerPage, manpowerTotalPages);
    const paginatedManpowerReport = filteredManpowerReport.slice((manpowerSafePage - 1) * manpowerPageSize, manpowerSafePage * manpowerPageSize);

    const last6Months = useMemo(() => Array.from({ length: 6 }, (_, i) => { const d = subMonths(new Date(), i); return format(d, "yyyy-MM"); }), []);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
    const monthPayslips = useMemo(() => payslips.filter((p) => p.issuedAt.startsWith(selectedMonth)), [payslips, selectedMonth]);

    const sssReport = useMemo(() => monthPayslips.map((p) => { const empShare = p.sssDeduction || 0; const erShare = Math.round(empShare * (9.5 / 4.5)); return { payslipId: p.id, employeeId: p.employeeId, name: getEmpName(p.employeeId), grossPay: p.grossPay || 0, empShare, erShare, total: empShare + erShare }; }), [monthPayslips, getEmpName]);
    const philhealthReport = useMemo(() => monthPayslips.map((p) => { const empShare = p.philhealthDeduction || 0; return { payslipId: p.id, employeeId: p.employeeId, name: getEmpName(p.employeeId), grossPay: p.grossPay || 0, empShare, erShare: empShare, total: empShare * 2 }; }), [monthPayslips, getEmpName]);
    const pagibigReport = useMemo(() => monthPayslips.map((p) => { const empShare = p.pagibigDeduction || 0; return { payslipId: p.id, employeeId: p.employeeId, name: getEmpName(p.employeeId), grossPay: p.grossPay || 0, empShare, erShare: empShare, total: empShare * 2 }; }), [monthPayslips, getEmpName]);
    const taxReport = useMemo(() => monthPayslips.map((p) => ({ payslipId: p.id, employeeId: p.employeeId, name: getEmpName(p.employeeId), grossIncome: p.grossPay || 0, withholdingTax: p.taxDeduction || 0 })), [monthPayslips, getEmpName]);

    const govTotals = useMemo(() => ({ sss: sssReport.reduce((s, r) => s + r.total, 0), philhealth: philhealthReport.reduce((s, r) => s + r.total, 0), pagibig: pagibigReport.reduce((s, r) => s + r.total, 0), tax: taxReport.reduce((s, r) => s + r.withholdingTax, 0) }), [sssReport, philhealthReport, pagibigReport, taxReport]);

    const exportCSV = (rows: string[][], filename: string) => {
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
    };

    const handleExport = (label: string) => {
        const month = selectedMonth;
        if (label === "SSS") { exportCSV([["Employee", "Monthly Salary", "Employee Share", "Employer Share", "Total"], ...sssReport.map((r) => [r.name, r.grossPay, r.empShare, r.erShare, r.total].map(String)), ["TOTAL", sssReport.reduce((s, r) => s + r.grossPay, 0), sssReport.reduce((s, r) => s + r.empShare, 0), sssReport.reduce((s, r) => s + r.erShare, 0), govTotals.sss].map(String)], `sss-${month}.csv`); toast.success("SSS report downloaded"); }
        else if (label === "PhilHealth") { exportCSV([["Employee", "Monthly Salary", "Employee Share", "Employer Share", "Total"], ...philhealthReport.map((r) => [r.name, r.grossPay, r.empShare, r.erShare, r.total].map(String)), ["TOTAL", philhealthReport.reduce((s, r) => s + r.grossPay, 0), philhealthReport.reduce((s, r) => s + r.empShare, 0), philhealthReport.reduce((s, r) => s + r.erShare, 0), govTotals.philhealth].map(String)], `philhealth-${month}.csv`); toast.success("PhilHealth report downloaded"); }
        else if (label === "Pag-IBIG") { exportCSV([["Employee", "Monthly Salary", "Employee Share", "Employer Share", "Total"], ...pagibigReport.map((r) => [r.name, r.grossPay, r.empShare, r.erShare, r.total].map(String)), ["TOTAL", pagibigReport.reduce((s, r) => s + r.grossPay, 0), pagibigReport.reduce((s, r) => s + r.empShare, 0), pagibigReport.reduce((s, r) => s + r.erShare, 0), govTotals.pagibig].map(String)], `pagibig-${month}.csv`); toast.success("Pag-IBIG report downloaded"); }
        else if (label === "BIR Tax") { exportCSV([["Employee", "Gross Income", "Withholding Tax", "Effective Rate"], ...taxReport.map((r) => [r.name, r.grossIncome, r.withholdingTax, r.grossIncome > 0 ? ((r.withholdingTax / r.grossIncome) * 100).toFixed(2) + "%" : "0%"].map(String)), ["TOTAL", taxReport.reduce((s, r) => s + r.grossIncome, 0), taxReport.reduce((s, r) => s + r.withholdingTax, 0), ""].map(String)], `bir-tax-${month}.csv`); toast.success("BIR/Tax report downloaded"); }
    };

    return (
        <div className="space-y-6">
            <div><h1 className="text-2xl font-bold tracking-tight">Reports</h1><p className="text-sm text-muted-foreground mt-0.5">Generated from live store data</p></div>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="flex flex-wrap gap-1 h-auto">
                    <TabsTrigger value="payroll_register" className="text-xs">Payroll Register</TabsTrigger>
                    <TabsTrigger value="govt" className="text-xs">Gov&apos;t Deductions</TabsTrigger>
                    <TabsTrigger value="absence" className="text-xs">Absence</TabsTrigger>
                    <TabsTrigger value="late" className="text-xs">Late</TabsTrigger>
                    <TabsTrigger value="gov_compliance" className="text-xs">Gov&apos;t Compliance</TabsTrigger>
                    <TabsTrigger value="loan_balances" className="text-xs">Loan Balances</TabsTrigger>
                    <TabsTrigger value="thirteenth_month" className="text-xs">13th Month</TabsTrigger>
                    <TabsTrigger value="manpower" className="text-xs">Manpower</TabsTrigger>
                </TabsList>

                <TabsContent value="payroll_register" className="mt-4 space-y-3">
                    {/* Search + Page size controls */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search employee..." className="pl-9" value={prSearch} onChange={(e) => { setPrSearch(e.target.value); setPrPage(1); }} />
                        </div>

                    </div>
                    <Card className="border border-border/50"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>
                        <TableHead className="text-xs">Employee</TableHead><TableHead className="text-xs">Period</TableHead><TableHead className="text-xs">Gross</TableHead><TableHead className="text-xs">SSS</TableHead><TableHead className="text-xs">PH</TableHead><TableHead className="text-xs">PI</TableHead><TableHead className="text-xs">Tax</TableHead><TableHead className="text-xs">Net</TableHead>
                    </TableRow></TableHeader><TableBody>
                        {paginatedPayrollRegister.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">{prSearch ? "No matching payroll records" : "No payroll data"}</TableCell></TableRow> : paginatedPayrollRegister.map((ps) => (
                            <TableRow key={ps.id}><TableCell className="text-sm">{getEmpName(ps.employeeId)}</TableCell><TableCell className="text-xs text-muted-foreground">{ps.periodStart} – {ps.periodEnd}</TableCell><TableCell className="text-xs">₱{(ps.grossPay || 0).toLocaleString()}</TableCell><TableCell className="text-xs text-red-500">₱{(ps.sssDeduction || 0).toLocaleString()}</TableCell><TableCell className="text-xs text-red-500">₱{(ps.philhealthDeduction || 0).toLocaleString()}</TableCell><TableCell className="text-xs text-red-500">₱{(ps.pagibigDeduction || 0).toLocaleString()}</TableCell><TableCell className="text-xs text-red-500">₱{(ps.taxDeduction || 0).toLocaleString()}</TableCell><TableCell className="text-sm font-medium">₱{ps.netPay.toLocaleString()}</TableCell></TableRow>
                        ))}
                    </TableBody></Table></div></CardContent></Card>
                    {/* Pagination */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Rows per page:</span>
                            <Select value={String(prPageSize)} onValueChange={(v) => { setPrPageSize(Number(v)); setPrPage(1); }}>
                                <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Page {prSafePage} of {prTotalPages}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={prSafePage <= 1} onClick={() => setPrPage(prSafePage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={prSafePage >= prTotalPages} onClick={() => setPrPage(prSafePage + 1)}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="govt" className="mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="border border-blue-500/20 bg-blue-500/5"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground font-medium">SSS Total</p><p className="text-2xl font-bold mt-1">₱{govtSummary.sss.toLocaleString()}</p></CardContent></Card>
                        <Card className="border border-green-500/20 bg-green-500/5"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground font-medium">PhilHealth Total</p><p className="text-2xl font-bold mt-1">₱{govtSummary.philhealth.toLocaleString()}</p></CardContent></Card>
                        <Card className="border border-amber-500/20 bg-amber-500/5"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground font-medium">Pag-IBIG Total</p><p className="text-2xl font-bold mt-1">₱{govtSummary.pagibig.toLocaleString()}</p></CardContent></Card>
                        <Card className="border border-red-500/20 bg-red-500/5"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground font-medium">Tax Total</p><p className="text-2xl font-bold mt-1">₱{govtSummary.tax.toLocaleString()}</p></CardContent></Card>
                    </div>
                    <Card className="border border-border/50 mt-4"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Grand Total Deductions</p><p className="text-3xl font-bold text-red-500 mt-1">₱{(govtSummary.sss + govtSummary.philhealth + govtSummary.pagibig + govtSummary.tax).toLocaleString()}</p></CardContent></Card>
                </TabsContent>

                <TabsContent value="absence" className="mt-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search employee..." className="pl-9" value={absSearch} onChange={(e) => { setAbsSearch(e.target.value); setAbsPage(1); }} />
                        </div>
                        <Select value={absSeverity} onValueChange={(v) => { setAbsSeverity(v); setAbsPage(1); }}>
                            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="All Severity" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Severity</SelectItem>
                                <SelectItem value="high">High (5+)</SelectItem>
                                <SelectItem value="moderate">Moderate (3–4)</SelectItem>
                                <SelectItem value="low">Low (1–2)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Card className="border border-border/50"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-xs">#</TableHead><TableHead className="text-xs">Employee</TableHead><TableHead className="text-xs">Absent Days</TableHead><TableHead className="text-xs">Severity</TableHead></TableRow></TableHeader><TableBody>
                        {paginatedAbsenceReport.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">{absSearch || absSeverity !== "all" ? "No matching records" : "No absence data"}</TableCell></TableRow> : paginatedAbsenceReport.map((row, i) => (
                            <TableRow key={row.empId}><TableCell className="text-xs text-muted-foreground">{(absSafePage - 1) * absPageSize + i + 1}</TableCell><TableCell className="text-sm font-medium">{row.name}</TableCell><TableCell className="text-sm">{row.count}</TableCell>
                                <TableCell><Badge variant="secondary" className={`text-[10px] ${row.count >= 5 ? "bg-red-500/15 text-red-700 dark:text-red-400" : row.count >= 3 ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"}`}>{row.count >= 5 ? "High" : row.count >= 3 ? "Moderate" : "Low"}</Badge></TableCell>
                            </TableRow>
                        ))}
                    </TableBody></Table></div></CardContent></Card>
                    {/* Pagination */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Rows per page:</span>
                            <Select value={String(absPageSize)} onValueChange={(v) => { setAbsPageSize(Number(v)); setAbsPage(1); }}>
                                <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Page {absSafePage} of {absTotalPages}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={absSafePage <= 1} onClick={() => setAbsPage(absSafePage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={absSafePage >= absTotalPages} onClick={() => setAbsPage(absSafePage + 1)}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="late" className="mt-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search employee..." className="pl-9" value={lateSearch} onChange={(e) => { setLateSearch(e.target.value); setLatePage(1); }} />
                        </div>
                    </div>
                    <Card className="border border-border/50"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-xs">#</TableHead><TableHead className="text-xs">Employee</TableHead><TableHead className="text-xs">Late Count</TableHead><TableHead className="text-xs">Total Late (min)</TableHead></TableRow></TableHeader><TableBody>
                        {paginatedLateReport.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">{lateSearch ? "No matching records" : "No late data recorded"}</TableCell></TableRow> : paginatedLateReport.map((row, i) => (
                            <TableRow key={row.empId}><TableCell className="text-xs text-muted-foreground">{(lateSafePage - 1) * latePageSize + i + 1}</TableCell><TableCell className="text-sm font-medium">{row.name}</TableCell><TableCell className="text-sm">{row.count}</TableCell><TableCell className="text-sm font-medium">{row.totalMinutes} min</TableCell></TableRow>
                        ))}
                    </TableBody></Table></div></CardContent></Card>
                    {/* Pagination */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Rows per page:</span>
                            <Select value={String(latePageSize)} onValueChange={(v) => { setLatePageSize(Number(v)); setLatePage(1); }}>
                                <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Page {lateSafePage} of {lateTotalPages}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={lateSafePage <= 1} onClick={() => setLatePage(lateSafePage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={lateSafePage >= lateTotalPages} onClick={() => setLatePage(lateSafePage + 1)}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="gov_compliance" className="mt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-blue-500" /><p className="text-sm font-semibold">Monthly Government Compliance Report</p></div>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{last6Months.map((m) => <SelectItem key={m} value={m}>{format(new Date(m + "-01"), "MMMM yyyy")}</SelectItem>)}</SelectContent></Select>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <Card className="border border-blue-500/20 bg-blue-500/5"><CardContent className="p-3"><p className="text-xs text-muted-foreground">SSS Total</p><p className="text-lg font-bold mt-0.5">₱{govTotals.sss.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">{sssReport.length} employees</p></CardContent></Card>
                        <Card className="border border-emerald-500/20 bg-emerald-500/5"><CardContent className="p-3"><p className="text-xs text-muted-foreground">PhilHealth Total</p><p className="text-lg font-bold mt-0.5">₱{govTotals.philhealth.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">{philhealthReport.length} employees</p></CardContent></Card>
                        <Card className="border border-amber-500/20 bg-amber-500/5"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Pag-IBIG Total</p><p className="text-lg font-bold mt-0.5">₱{govTotals.pagibig.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">{pagibigReport.length} employees</p></CardContent></Card>
                        <Card className="border border-red-500/20 bg-red-500/5"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Withholding Tax</p><p className="text-lg font-bold mt-0.5">₱{govTotals.tax.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">{taxReport.length} employees</p></CardContent></Card>
                    </div>

                    {monthPayslips.length === 0 ? (
                        <Card className="border border-border/50"><CardContent className="p-12 text-center"><Shield className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" /><p className="text-sm text-muted-foreground">No payslips for {format(new Date(selectedMonth + "-01"), "MMMM yyyy")}</p></CardContent></Card>
                    ) : (
                        <Tabs defaultValue="sss">
                            <TabsList className="w-full justify-start"><TabsTrigger value="sss">SSS</TabsTrigger><TabsTrigger value="philhealth">PhilHealth</TabsTrigger><TabsTrigger value="pagibig">Pag-IBIG</TabsTrigger><TabsTrigger value="tax">BIR / Tax</TabsTrigger></TabsList>

                            <TabsContent value="sss" className="mt-3">
                                <Card className="border border-border/50"><div className="flex items-center justify-between px-4 pt-3 pb-2"><p className="text-sm font-semibold">SSS Contributions · {sssReport.length} employees</p><Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => handleExport("SSS")}><Download className="h-3 w-3" /> CSV</Button></div><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-xs">Employee</TableHead><TableHead className="text-xs">Gross Pay</TableHead><TableHead className="text-xs">Emp. Share</TableHead><TableHead className="text-xs">Er. Share</TableHead><TableHead className="text-xs font-semibold">Total</TableHead></TableRow></TableHeader><TableBody>
                                    {sssReport.map((r) => <TableRow key={r.payslipId}><TableCell className="text-sm font-medium">{r.name}</TableCell><TableCell className="text-sm">₱{r.grossPay.toLocaleString()}</TableCell><TableCell className="text-sm">₱{r.empShare.toLocaleString()}</TableCell><TableCell className="text-sm">₱{r.erShare.toLocaleString()}</TableCell><TableCell className="text-sm font-semibold">₱{r.total.toLocaleString()}</TableCell></TableRow>)}
                                    <TableRow className="bg-muted/30 font-semibold"><TableCell>TOTAL</TableCell><TableCell>₱{sssReport.reduce((s,r)=>s+r.grossPay,0).toLocaleString()}</TableCell><TableCell>₱{sssReport.reduce((s,r)=>s+r.empShare,0).toLocaleString()}</TableCell><TableCell>₱{sssReport.reduce((s,r)=>s+r.erShare,0).toLocaleString()}</TableCell><TableCell className="text-blue-600 dark:text-blue-400">₱{govTotals.sss.toLocaleString()}</TableCell></TableRow>
                                </TableBody></Table></div></CardContent></Card>
                            </TabsContent>

                            <TabsContent value="philhealth" className="mt-3">
                                <Card className="border border-border/50"><div className="flex items-center justify-between px-4 pt-3 pb-2"><p className="text-sm font-semibold">PhilHealth Contributions · {philhealthReport.length} employees</p><Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => handleExport("PhilHealth")}><Download className="h-3 w-3" /> CSV</Button></div><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-xs">Employee</TableHead><TableHead className="text-xs">Gross Pay</TableHead><TableHead className="text-xs">Emp. Share</TableHead><TableHead className="text-xs">Er. Share</TableHead><TableHead className="text-xs font-semibold">Total</TableHead></TableRow></TableHeader><TableBody>
                                    {philhealthReport.map((r) => <TableRow key={r.payslipId}><TableCell className="text-sm font-medium">{r.name}</TableCell><TableCell className="text-sm">₱{r.grossPay.toLocaleString()}</TableCell><TableCell className="text-sm">₱{r.empShare.toLocaleString()}</TableCell><TableCell className="text-sm">₱{r.erShare.toLocaleString()}</TableCell><TableCell className="text-sm font-semibold">₱{r.total.toLocaleString()}</TableCell></TableRow>)}
                                    <TableRow className="bg-muted/30 font-semibold"><TableCell>TOTAL</TableCell><TableCell>₱{philhealthReport.reduce((s,r)=>s+r.grossPay,0).toLocaleString()}</TableCell><TableCell>₱{philhealthReport.reduce((s,r)=>s+r.empShare,0).toLocaleString()}</TableCell><TableCell>₱{philhealthReport.reduce((s,r)=>s+r.erShare,0).toLocaleString()}</TableCell><TableCell className="text-emerald-600 dark:text-emerald-400">₱{govTotals.philhealth.toLocaleString()}</TableCell></TableRow>
                                </TableBody></Table></div></CardContent></Card>
                            </TabsContent>

                            <TabsContent value="pagibig" className="mt-3">
                                <Card className="border border-border/50"><div className="flex items-center justify-between px-4 pt-3 pb-2"><p className="text-sm font-semibold">Pag-IBIG Contributions · {pagibigReport.length} employees</p><Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => handleExport("Pag-IBIG")}><Download className="h-3 w-3" /> CSV</Button></div><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-xs">Employee</TableHead><TableHead className="text-xs">Gross Pay</TableHead><TableHead className="text-xs">Emp. Share</TableHead><TableHead className="text-xs">Er. Share</TableHead><TableHead className="text-xs font-semibold">Total</TableHead></TableRow></TableHeader><TableBody>
                                    {pagibigReport.map((r) => <TableRow key={r.payslipId}><TableCell className="text-sm font-medium">{r.name}</TableCell><TableCell className="text-sm">₱{r.grossPay.toLocaleString()}</TableCell><TableCell className="text-sm">₱{r.empShare.toLocaleString()}</TableCell><TableCell className="text-sm">₱{r.erShare.toLocaleString()}</TableCell><TableCell className="text-sm font-semibold">₱{r.total.toLocaleString()}</TableCell></TableRow>)}
                                    <TableRow className="bg-muted/30 font-semibold"><TableCell>TOTAL</TableCell><TableCell>₱{pagibigReport.reduce((s,r)=>s+r.grossPay,0).toLocaleString()}</TableCell><TableCell>₱{pagibigReport.reduce((s,r)=>s+r.empShare,0).toLocaleString()}</TableCell><TableCell>₱{pagibigReport.reduce((s,r)=>s+r.erShare,0).toLocaleString()}</TableCell><TableCell className="text-amber-600 dark:text-amber-400">₱{govTotals.pagibig.toLocaleString()}</TableCell></TableRow>
                                </TableBody></Table></div></CardContent></Card>
                            </TabsContent>

                            <TabsContent value="tax" className="mt-3">
                                <Card className="border border-border/50"><div className="flex items-center justify-between px-4 pt-3 pb-2"><p className="text-sm font-semibold">BIR Withholding Tax · {taxReport.length} employees</p><Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => handleExport("BIR Tax")}><Download className="h-3 w-3" /> CSV</Button></div><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="text-xs">Employee</TableHead><TableHead className="text-xs">Gross Income</TableHead><TableHead className="text-xs font-semibold">Withholding Tax</TableHead><TableHead className="text-xs">Rate</TableHead></TableRow></TableHeader><TableBody>
                                    {taxReport.map((r) => <TableRow key={r.payslipId}><TableCell className="text-sm font-medium">{r.name}</TableCell><TableCell className="text-sm">₱{r.grossIncome.toLocaleString()}</TableCell><TableCell className="text-sm font-semibold text-red-600 dark:text-red-400">₱{r.withholdingTax.toLocaleString()}</TableCell><TableCell>{r.grossIncome > 0 ? <Badge variant="secondary" className="text-[10px]">{((r.withholdingTax/r.grossIncome)*100).toFixed(1)}%</Badge> : "—"}</TableCell></TableRow>)}
                                    <TableRow className="bg-muted/30 font-semibold"><TableCell>TOTAL</TableCell><TableCell>₱{taxReport.reduce((s,r)=>s+r.grossIncome,0).toLocaleString()}</TableCell><TableCell className="text-red-600 dark:text-red-400">₱{govTotals.tax.toLocaleString()}</TableCell><TableCell></TableCell></TableRow>
                                </TableBody></Table></div></CardContent></Card>
                            </TabsContent>
                        </Tabs>
                    )}
                </TabsContent>

                {/* Loan Balances Tab */}
                <TabsContent value="loan_balances" className="mt-4">
                    <div className="flex items-center justify-between mb-4">
                        <div><p className="text-sm font-semibold">Loan Balances</p><p className="text-xs text-muted-foreground">Active loans and remaining balances</p></div>
                        {loanBalances.length > 0 && <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => { exportCSV([["Employee", "Type", "Original Amount", "Remaining Balance", "Monthly Deduction", "Status"], ...loanBalances.map((l) => [l.empName, l.type.replace("_", " "), l.amount, l.remainingBalance, l.monthlyDeduction, l.status].map(String)), ["TOTAL", "", "", loanBalances.reduce((s, l) => s + l.remainingBalance, 0), loanBalances.reduce((s, l) => s + l.monthlyDeduction, 0), ""].map(String)], "loan-balances.csv"); toast.success("Loan balances report downloaded"); }}><Download className="h-3 w-3" /> CSV</Button>}
                    </div>
                    <Card className="border border-border/50"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>
                        <TableHead className="text-xs">Employee</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Original Amount</TableHead><TableHead className="text-xs">Remaining Balance</TableHead><TableHead className="text-xs">Monthly Deduction</TableHead><TableHead className="text-xs">Status</TableHead>
                    </TableRow></TableHeader><TableBody>
                        {loanBalances.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No active loans</TableCell></TableRow>
                        ) : loanBalances.map((l) => (
                            <TableRow key={l.id}>
                                <TableCell className="text-sm font-medium">{l.empName}</TableCell>
                                <TableCell><Badge variant="outline" className="text-[10px] capitalize">{l.type.replace("_", " ")}</Badge></TableCell>
                                <TableCell className="text-sm">₱{l.amount.toLocaleString()}</TableCell>
                                <TableCell className="text-sm font-medium text-amber-600 dark:text-amber-400">₱{l.remainingBalance.toLocaleString()}</TableCell>
                                <TableCell className="text-sm">₱{l.monthlyDeduction.toLocaleString()}</TableCell>
                                <TableCell><Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{l.status}</Badge></TableCell>
                            </TableRow>
                        ))}
                        {loanBalances.length > 0 && (
                            <TableRow className="bg-muted/30 font-semibold">
                                <TableCell colSpan={3}>TOTAL</TableCell>
                                <TableCell className="text-amber-600 dark:text-amber-400">₱{loanBalances.reduce((s, l) => s + l.remainingBalance, 0).toLocaleString()}</TableCell>
                                <TableCell>₱{loanBalances.reduce((s, l) => s + l.monthlyDeduction, 0).toLocaleString()}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        )}
                    </TableBody></Table></div></CardContent></Card>
                </TabsContent>

                {/* 13th Month Accrual Tab */}
                <TabsContent value="thirteenth_month" className="mt-4 space-y-4">
                    {/* KPI Card — Total Accrued */}
                    <Card className="border border-emerald-500/30 bg-emerald-500/5">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="rounded-full bg-emerald-500/15 p-3 shrink-0">
                                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-black-600 dark:text-black-400 font-medium">Total Accrued 13th Month Pay</p>
                                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    ₱{(thSearch ? filteredTotalAccrued13th : totalAccrued13th).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{filteredThirteenthMonthData.length} active employee{filteredThirteenthMonthData.length !== 1 ? "s" : ""} · Current year accrual (RA 6686)</p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div><p className="text-sm font-semibold">13th Month Pay Accrual</p><p className="text-xs text-muted-foreground">Based on current year months worked (RA 6686)</p></div>
                        <div className="flex items-center gap-2">
                            <div className="relative w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search employee..." className="pl-9" value={thSearch} onChange={(e) => { setThSearch(e.target.value); setThPage(1); }} />
                            </div>
                            <Button size="sm" variant="outline" className="gap-1.5 h-7 shrink-0" onClick={() => { exportCSV([["Employee", "Department", "Monthly Basic", "Months Worked", "Accrued 13th Month"], ...thirteenthMonthData.map((r) => [r.name, r.department, r.monthlyBasic, r.monthsWorked, r.accrued.toFixed(2)].map(String)), ["TOTAL", "", "", "", totalAccrued13th.toFixed(2)]], "thirteenth-month.csv"); toast.success("13th Month report downloaded"); }}><Download className="h-3 w-3" /> CSV</Button>
                        </div>
                    </div>
                    <Card className="border border-border/50"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>
                        <TableHead className="text-xs">Employee</TableHead><TableHead className="text-xs">Department</TableHead><TableHead className="text-xs">Monthly Basic</TableHead><TableHead className="text-xs">Months Worked</TableHead><TableHead className="text-xs font-semibold">Accrued 13th Month</TableHead>
                    </TableRow></TableHeader><TableBody>
                        {paginatedThirteenthMonthData.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">{thSearch ? "No matching employees" : "No active employees"}</TableCell></TableRow>
                        ) : paginatedThirteenthMonthData.map((r) => (
                            <TableRow key={r.id}>
                                <TableCell className="text-sm font-medium">{r.name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{r.department}</TableCell>
                                <TableCell className="text-sm">₱{r.monthlyBasic.toLocaleString()}</TableCell>
                                <TableCell className="text-sm">{r.monthsWorked}</TableCell>
                                <TableCell className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">₱{r.accrued.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody></Table></div></CardContent></Card>
                    {/* Pagination */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Rows per page:</span>
                            <Select value={String(thPageSize)} onValueChange={(v) => { setThPageSize(Number(v)); setThPage(1); }}>
                                <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Page {thSafePage} of {thTotalPages}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={thSafePage <= 1} onClick={() => setThPage(thSafePage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={thSafePage >= thTotalPages} onClick={() => setThPage(thSafePage + 1)}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </TabsContent>

                {/* Manpower Tab */}
                <TabsContent value="manpower" className="mt-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div><p className="text-sm font-semibold">Project Manpower</p><p className="text-xs text-muted-foreground">Attendance per project for selected date</p></div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative min-w-[180px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Search project..." className="pl-9" value={manpowerSearch} onChange={(e) => { setManpowerSearch(e.target.value); setManpowerPage(1); }} />
                            </div>
                            <Input type="date" value={manpowerDate} onChange={(e) => setManpowerDate(e.target.value)} className="w-[180px]" />
                            {manpowerReport.length > 0 && <Button size="sm" variant="outline" className="gap-1.5 h-7" onClick={() => { exportCSV([["Project", "Assigned", "Present", "On Leave", "Absent", "Coverage %"], ...manpowerReport.map((p) => [p.name, p.assigned, p.present, p.onLeave, p.absent, p.assigned > 0 ? Math.round((p.present / p.assigned) * 100) : 0].map(String))], `manpower-${manpowerDate}.csv`); toast.success("Manpower report downloaded"); }}><Download className="h-3 w-3" /> CSV</Button>}
                        </div>
                    </div>
                    <Card className="border border-border/50"><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow>
                        <TableHead className="text-xs">Project</TableHead><TableHead className="text-xs">Assigned</TableHead><TableHead className="text-xs">Present</TableHead><TableHead className="text-xs">On Leave</TableHead><TableHead className="text-xs">Absent</TableHead><TableHead className="text-xs">Coverage</TableHead>
                    </TableRow></TableHeader><TableBody>
                        {paginatedManpowerReport.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">{manpowerSearch ? "No matching projects" : "No projects found"}</TableCell></TableRow>
                        ) : paginatedManpowerReport.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell className="text-sm font-medium">{p.name}</TableCell>
                                <TableCell className="text-sm">{p.assigned}</TableCell>
                                <TableCell className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{p.present}</TableCell>
                                <TableCell className="text-sm text-blue-600 dark:text-blue-400">{p.onLeave}</TableCell>
                                <TableCell className="text-sm text-red-500">{p.absent}</TableCell>
                                <TableCell>{p.assigned > 0 ? <Badge variant="secondary" className={`text-[10px] ${(p.present / p.assigned) >= 0.8 ? "bg-emerald-500/15 text-emerald-700" : (p.present / p.assigned) >= 0.5 ? "bg-amber-500/15 text-amber-700" : "bg-red-500/15 text-red-700"}`}>{Math.round((p.present / p.assigned) * 100)}%</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody></Table></div></CardContent></Card>
                    {/* Pagination */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Rows per page:</span>
                            <Select value={String(manpowerPageSize)} onValueChange={(v) => { setManpowerPageSize(Number(v)); setManpowerPage(1); }}>
                                <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Page {manpowerSafePage} of {manpowerTotalPages}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={manpowerSafePage <= 1} onClick={() => setManpowerPage(manpowerSafePage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={manpowerSafePage >= manpowerTotalPages} onClick={() => setManpowerPage(manpowerSafePage + 1)}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}