"use client";

import { useState, useMemo, useCallback } from "react";
import { usePayrollStore } from "@/store/payroll.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Download } from "lucide-react";
import { toast } from "sonner";
import { format, subMonths } from "date-fns";

export default function GovernmentReportsPage() {
    const payslips = usePayrollStore((s) => s.payslips);
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);

    const { hasPermission } = useRolesStore();
    const canView = hasPermission(currentUser.role, "reports:government");

    const last6Months = useMemo(() => {
        return Array.from({ length: 6 }, (_, i) => {
            const d = subMonths(new Date(), i);
            return format(d, "yyyy-MM");
        });
    }, []);

    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

    const getEmpName = useCallback(
        (id: string) => employees.find((e) => e.id === id)?.name || id,
        [employees]
    );

    // Use string prefix match to avoid timezone off-by-one (issuedAt is YYYY-MM-DD)
    const monthPayslips = useMemo(() => {
        return payslips.filter((p) => p.issuedAt.startsWith(selectedMonth));
    }, [payslips, selectedMonth]);

    // SSS Report: employee 4.5% + employer 9.5% of monthly salary credit
    const sssReport = useMemo(() => {
        return monthPayslips.map((p) => {
            const empShare = p.sssDeduction || 0;
            // Employer share = 9.5/4.5 × employee share (same MSC basis)
            const erShare = Math.round(empShare * (9.5 / 4.5));
            return {
                employeeId: p.employeeId,
                name: getEmpName(p.employeeId),
                grossPay: p.grossPay || 0,
                empShare,
                erShare,
                total: empShare + erShare,
            };
        });
    }, [monthPayslips, getEmpName]);

    // PhilHealth Report: employee 2.5% + employer 2.5% = equal shares
    const philhealthReport = useMemo(() => {
        return monthPayslips.map((p) => {
            const empShare = p.philhealthDeduction || 0;
            return {
                employeeId: p.employeeId,
                name: getEmpName(p.employeeId),
                grossPay: p.grossPay || 0,
                empShare,
                erShare: empShare,
                total: empShare * 2,
            };
        });
    }, [monthPayslips, getEmpName]);

    // Pag-IBIG Report: employee 2% + employer 2% = equal shares
    const pagibigReport = useMemo(() => {
        return monthPayslips.map((p) => {
            const empShare = p.pagibigDeduction || 0;
            return {
                employeeId: p.employeeId,
                name: getEmpName(p.employeeId),
                grossPay: p.grossPay || 0,
                empShare,
                erShare: empShare,
                total: empShare * 2,
            };
        });
    }, [monthPayslips, getEmpName]);

    // BIR/Tax Report
    const taxReport = useMemo(() => {
        return monthPayslips.map((p) => ({
            employeeId: p.employeeId,
            name: getEmpName(p.employeeId),
            grossIncome: p.grossPay || 0,
            withholdingTax: p.taxDeduction || 0,
        }));
    }, [monthPayslips, getEmpName]);

    const totals = useMemo(() => ({
        sss: sssReport.reduce((s, r) => s + r.total, 0),
        philhealth: philhealthReport.reduce((s, r) => s + r.total, 0),
        pagibig: pagibigReport.reduce((s, r) => s + r.total, 0),
        tax: taxReport.reduce((s, r) => s + r.withholdingTax, 0),
    }), [sssReport, philhealthReport, pagibigReport, taxReport]);

    const handleExport = (label: string) => {
        toast.info(`${label} CSV export coming soon!`);
    };

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <p className="text-sm text-muted-foreground">You don&apos;t have access to this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Government Reports</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">SSS · PhilHealth · Pag-IBIG · BIR compliance</p>
                    </div>
                </div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {last6Months.map((m) => (
                            <SelectItem key={m} value={m}>
                                {format(new Date(m + "-01"), "MMMM yyyy")}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border border-blue-500/20 bg-blue-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">SSS Total</p>
                        <p className="text-xl font-bold mt-1">₱{totals.sss.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{sssReport.length} payslips</p>
                    </CardContent>
                </Card>
                <Card className="border border-emerald-500/20 bg-emerald-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">PhilHealth Total</p>
                        <p className="text-xl font-bold mt-1">₱{totals.philhealth.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{philhealthReport.length} payslips</p>
                    </CardContent>
                </Card>
                <Card className="border border-amber-500/20 bg-amber-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Pag-IBIG Total</p>
                        <p className="text-xl font-bold mt-1">₱{totals.pagibig.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{pagibigReport.length} payslips</p>
                    </CardContent>
                </Card>
                <Card className="border border-red-500/20 bg-red-500/5">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">Withholding Tax</p>
                        <p className="text-xl font-bold mt-1">₱{totals.tax.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{taxReport.length} payslips</p>
                    </CardContent>
                </Card>
            </div>

            {monthPayslips.length === 0 ? (
                <Card className="border border-border/50">
                    <CardContent className="p-12 text-center">
                        <Shield className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                        <p className="text-sm text-muted-foreground">No payslips found for {format(new Date(selectedMonth + "-01"), "MMMM yyyy")}</p>
                    </CardContent>
                </Card>
            ) : (
                <Tabs defaultValue="sss">
                    <TabsList className="w-full justify-start">
                        <TabsTrigger value="sss">SSS</TabsTrigger>
                        <TabsTrigger value="philhealth">PhilHealth</TabsTrigger>
                        <TabsTrigger value="pagibig">Pag-IBIG</TabsTrigger>
                        <TabsTrigger value="tax">BIR / Tax</TabsTrigger>
                    </TabsList>

                    {/* SSS Tab */}
                    <TabsContent value="sss" className="mt-4">
                        <Card className="border border-border/50">
                            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                                <div>
                                    <p className="text-sm font-semibold">SSS Contributions</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(selectedMonth + "-01"), "MMMM yyyy")} · {sssReport.length} employees</p>
                                </div>
                                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleExport("SSS")}>
                                    <Download className="h-3.5 w-3.5" /> Export CSV
                                </Button>
                            </div>
                            <CardContent className="p-0">
                              <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Employee</TableHead>
                                            <TableHead className="text-xs">Gross Pay</TableHead>
                                            <TableHead className="text-xs">Employee Share</TableHead>
                                            <TableHead className="text-xs">Employer Share</TableHead>
                                            <TableHead className="text-xs font-semibold">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sssReport.map((r) => (
                                            <TableRow key={r.employeeId}>
                                                <TableCell className="text-sm font-medium">{r.name}</TableCell>
                                                <TableCell className="text-sm">₱{r.grossPay.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{r.empShare.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{r.erShare.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm font-semibold">₱{r.total.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-muted/30 font-semibold">
                                            <TableCell className="text-sm">TOTAL</TableCell>
                                            <TableCell className="text-sm">₱{sssReport.reduce((s, r) => s + r.grossPay, 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-sm">₱{sssReport.reduce((s, r) => s + r.empShare, 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-sm">₱{sssReport.reduce((s, r) => s + r.erShare, 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-sm text-blue-600 dark:text-blue-400">₱{totals.sss.toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                              </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* PhilHealth Tab */}
                    <TabsContent value="philhealth" className="mt-4">
                        <Card className="border border-border/50">
                            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                                <div>
                                    <p className="text-sm font-semibold">PhilHealth Contributions</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(selectedMonth + "-01"), "MMMM yyyy")} · {philhealthReport.length} employees</p>
                                </div>
                                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleExport("PhilHealth")}>
                                    <Download className="h-3.5 w-3.5" /> Export CSV
                                </Button>
                            </div>
                            <CardContent className="p-0">
                              <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Employee</TableHead>
                                            <TableHead className="text-xs">Gross Pay</TableHead>
                                            <TableHead className="text-xs">Employee Share</TableHead>
                                            <TableHead className="text-xs">Employer Share</TableHead>
                                            <TableHead className="text-xs font-semibold">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {philhealthReport.map((r) => (
                                            <TableRow key={r.employeeId}>
                                                <TableCell className="text-sm font-medium">{r.name}</TableCell>
                                                <TableCell className="text-sm">₱{r.grossPay.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{r.empShare.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{r.erShare.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm font-semibold">₱{r.total.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-muted/30 font-semibold">
                                            <TableCell className="text-sm">TOTAL</TableCell>
                                            <TableCell className="text-sm">₱{philhealthReport.reduce((s, r) => s + r.grossPay, 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-sm">₱{philhealthReport.reduce((s, r) => s + r.empShare, 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-sm">₱{philhealthReport.reduce((s, r) => s + r.erShare, 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-sm text-emerald-600 dark:text-emerald-400">₱{totals.philhealth.toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                              </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Pag-IBIG Tab */}
                    <TabsContent value="pagibig" className="mt-4">
                        <Card className="border border-border/50">
                            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                                <div>
                                    <p className="text-sm font-semibold">Pag-IBIG Contributions</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(selectedMonth + "-01"), "MMMM yyyy")} · {pagibigReport.length} employees</p>
                                </div>
                                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleExport("Pag-IBIG")}>
                                    <Download className="h-3.5 w-3.5" /> Export CSV
                                </Button>
                            </div>
                            <CardContent className="p-0">
                              <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Employee</TableHead>
                                            <TableHead className="text-xs">Gross Pay</TableHead>
                                            <TableHead className="text-xs">Employee Share</TableHead>
                                            <TableHead className="text-xs">Employer Share</TableHead>
                                            <TableHead className="text-xs font-semibold">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pagibigReport.map((r) => (
                                            <TableRow key={r.employeeId}>
                                                <TableCell className="text-sm font-medium">{r.name}</TableCell>
                                                <TableCell className="text-sm">₱{r.grossPay.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{r.empShare.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm">₱{r.erShare.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm font-semibold">₱{r.total.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-muted/30 font-semibold">
                                            <TableCell className="text-sm">TOTAL</TableCell>
                                            <TableCell className="text-sm">₱{pagibigReport.reduce((s, r) => s + r.grossPay, 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-sm">₱{pagibigReport.reduce((s, r) => s + r.empShare, 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-sm">₱{pagibigReport.reduce((s, r) => s + r.erShare, 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-sm text-amber-600 dark:text-amber-400">₱{totals.pagibig.toLocaleString()}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                              </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* BIR / Tax Tab */}
                    <TabsContent value="tax" className="mt-4">
                        <Card className="border border-border/50">
                            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                                <div>
                                    <p className="text-sm font-semibold">BIR Withholding Tax</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(selectedMonth + "-01"), "MMMM yyyy")} · {taxReport.length} employees</p>
                                </div>
                                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleExport("BIR Tax")}>
                                    <Download className="h-3.5 w-3.5" /> Export CSV
                                </Button>
                            </div>
                            <CardContent className="p-0">
                              <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Employee</TableHead>
                                            <TableHead className="text-xs">Gross Income</TableHead>
                                            <TableHead className="text-xs font-semibold">Withholding Tax</TableHead>
                                            <TableHead className="text-xs">Tax Rate</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {taxReport.map((r) => (
                                            <TableRow key={r.employeeId}>
                                                <TableCell className="text-sm font-medium">{r.name}</TableCell>
                                                <TableCell className="text-sm">₱{r.grossIncome.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm font-semibold text-red-600 dark:text-red-400">₱{r.withholdingTax.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    {r.grossIncome > 0 ? (
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {((r.withholdingTax / r.grossIncome) * 100).toFixed(1)}%
                                                        </Badge>
                                                    ) : "—"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        <TableRow className="bg-muted/30 font-semibold">
                                            <TableCell className="text-sm">TOTAL</TableCell>
                                            <TableCell className="text-sm">₱{taxReport.reduce((s, r) => s + r.grossIncome, 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-sm text-red-600 dark:text-red-400">₱{totals.tax.toLocaleString()}</TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                              </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
