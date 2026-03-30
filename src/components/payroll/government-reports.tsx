"use client";

import { useMemo, useCallback } from "react";
import type { Payslip } from "@/types";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface GovernmentReportsProps {
    payslips: Payslip[];
    getEmpName: (id: string) => string;
    selectedPeriod: string;
    onPeriodChange: (period: string) => void;
    availablePeriods: string[];
}

interface GovRow {
    employeeId: string;
    name: string;
    grossPay: number;
    sss: number;
    philhealth: number;
    pagibig: number;
    tax: number;
}

export function GovernmentReports({ payslips, getEmpName, selectedPeriod, onPeriodChange, availablePeriods }: GovernmentReportsProps) {

    const periodPayslips = useMemo(() =>
        payslips.filter((p) => {
            const month = p.periodStart.substring(0, 7);
            return month === selectedPeriod;
        }),
    [payslips, selectedPeriod]);

    // Aggregate per employee for the month
    const rows: GovRow[] = useMemo(() => {
        const map = new Map<string, GovRow>();
        periodPayslips.forEach((p) => {
            const existing = map.get(p.employeeId);
            if (existing) {
                existing.grossPay += p.grossPay;
                existing.sss += p.sssDeduction;
                existing.philhealth += p.philhealthDeduction;
                existing.pagibig += p.pagibigDeduction;
                existing.tax += p.taxDeduction;
            } else {
                map.set(p.employeeId, {
                    employeeId: p.employeeId,
                    name: getEmpName(p.employeeId),
                    grossPay: p.grossPay,
                    sss: p.sssDeduction,
                    philhealth: p.philhealthDeduction,
                    pagibig: p.pagibigDeduction,
                    tax: p.taxDeduction,
                });
            }
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [periodPayslips, getEmpName]);

    const totals = useMemo(() => ({
        gross: rows.reduce((s, r) => s + r.grossPay, 0),
        sss: rows.reduce((s, r) => s + r.sss, 0),
        ph: rows.reduce((s, r) => s + r.philhealth, 0),
        pi: rows.reduce((s, r) => s + r.pagibig, 0),
        tax: rows.reduce((s, r) => s + r.tax, 0),
    }), [rows]);

    const exportCSV = useCallback((type: "sss" | "philhealth" | "pagibig" | "bir") => {
        let header: string;
        let csvRows: string[];
        const period = selectedPeriod;

        switch (type) {
            case "sss":
                header = "Employee ID,Employee Name,Monthly Gross,Employee Share (4.5%),Employer Share (9.5%),Total";
                csvRows = rows.map((r) => {
                    const ee = r.sss;
                    const er = Math.round(ee * (9.5 / 4.5));
                    return [r.employeeId, `"${r.name}"`, r.grossPay.toFixed(2), ee.toFixed(2), er.toFixed(2), (ee + er).toFixed(2)].join(",");
                });
                break;
            case "philhealth":
                header = "Employee ID,Employee Name,Monthly Gross,Employee Share (2.5%),Employer Share (2.5%),Total (5%)";
                csvRows = rows.map((r) => {
                    const ee = r.philhealth;
                    return [r.employeeId, `"${r.name}"`, r.grossPay.toFixed(2), ee.toFixed(2), ee.toFixed(2), (ee * 2).toFixed(2)].join(",");
                });
                break;
            case "pagibig":
                header = "Employee ID,Employee Name,Monthly Gross,Employee Share,Employer Share (2%),Total";
                csvRows = rows.map((r) => {
                    const ee = r.pagibig;
                    const er = Math.min(100, Math.round(r.grossPay * 0.02));
                    return [r.employeeId, `"${r.name}"`, r.grossPay.toFixed(2), ee.toFixed(2), er.toFixed(2), (ee + er).toFixed(2)].join(",");
                });
                break;
            case "bir":
                header = "Employee ID,Employee Name,Taxable Income,Withholding Tax";
                csvRows = rows.map((r) => {
                    const taxable = r.grossPay - r.sss - r.philhealth - r.pagibig;
                    return [r.employeeId, `"${r.name}"`, taxable.toFixed(2), r.tax.toFixed(2)].join(",");
                });
                break;
        }

        const csv = [header, ...csvRows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}-report-${period}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${type.toUpperCase()} report exported`);
    }, [rows, selectedPeriod]);

    const renderGovTable = (type: "sss" | "philhealth" | "pagibig" | "bir") => (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px]">{rows.length} employees</Badge>
                <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => exportCSV(type)}>
                    <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-xs">Employee</TableHead>
                            <TableHead className="text-xs text-right">Monthly Gross</TableHead>
                            {type === "sss" && <>
                                <TableHead className="text-xs text-right">EE Share (4.5%)</TableHead>
                                <TableHead className="text-xs text-right">ER Share (9.5%)</TableHead>
                                <TableHead className="text-xs text-right">Total</TableHead>
                            </>}
                            {type === "philhealth" && <>
                                <TableHead className="text-xs text-right">EE Share (2.5%)</TableHead>
                                <TableHead className="text-xs text-right">ER Share (2.5%)</TableHead>
                                <TableHead className="text-xs text-right">Total (5%)</TableHead>
                            </>}
                            {type === "pagibig" && <>
                                <TableHead className="text-xs text-right">EE Share</TableHead>
                                <TableHead className="text-xs text-right">ER Share (2%)</TableHead>
                                <TableHead className="text-xs text-right">Total</TableHead>
                            </>}
                            {type === "bir" && <>
                                <TableHead className="text-xs text-right">Taxable Income</TableHead>
                                <TableHead className="text-xs text-right">Withholding Tax</TableHead>
                            </>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={type === "bir" ? 4 : 5} className="text-center text-sm text-muted-foreground py-8">
                                    No payslip data for this period
                                </TableCell>
                            </TableRow>
                        ) : (
                            <>
                                {rows.map((r) => {
                                    if (type === "sss") {
                                        const er = Math.round(r.sss * (9.5 / 4.5));
                                        return (
                                            <TableRow key={r.employeeId}>
                                                <TableCell className="text-sm">{r.name}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{formatCurrency(r.grossPay)}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{formatCurrency(r.sss)}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{formatCurrency(er)}</TableCell>
                                                <TableCell className="text-xs text-right font-mono font-medium">{formatCurrency(r.sss + er)}</TableCell>
                                            </TableRow>
                                        );
                                    }
                                    if (type === "philhealth") {
                                        return (
                                            <TableRow key={r.employeeId}>
                                                <TableCell className="text-sm">{r.name}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{formatCurrency(r.grossPay)}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{formatCurrency(r.philhealth)}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{formatCurrency(r.philhealth)}</TableCell>
                                                <TableCell className="text-xs text-right font-mono font-medium">{formatCurrency(r.philhealth * 2)}</TableCell>
                                            </TableRow>
                                        );
                                    }
                                    if (type === "pagibig") {
                                        const er = Math.min(100, Math.round(r.grossPay * 0.02));
                                        return (
                                            <TableRow key={r.employeeId}>
                                                <TableCell className="text-sm">{r.name}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{formatCurrency(r.grossPay)}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{formatCurrency(r.pagibig)}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{formatCurrency(er)}</TableCell>
                                                <TableCell className="text-xs text-right font-mono font-medium">{formatCurrency(r.pagibig + er)}</TableCell>
                                            </TableRow>
                                        );
                                    }
                                    // bir
                                    const taxable = r.grossPay - r.sss - r.philhealth - r.pagibig;
                                    return (
                                        <TableRow key={r.employeeId}>
                                            <TableCell className="text-sm">{r.name}</TableCell>
                                            <TableCell className="text-xs text-right font-mono">{formatCurrency(r.grossPay)}</TableCell>
                                            <TableCell className="text-xs text-right font-mono">{formatCurrency(taxable)}</TableCell>
                                            <TableCell className="text-xs text-right font-mono font-medium">{formatCurrency(r.tax)}</TableCell>
                                        </TableRow>
                                    );
                                })}
                                {/* Totals row */}
                                <TableRow className="font-semibold bg-muted/30">
                                    <TableCell className="text-xs">TOTALS</TableCell>
                                    <TableCell className="text-xs text-right font-mono">{formatCurrency(totals.gross)}</TableCell>
                                    {type === "sss" && <>
                                        <TableCell className="text-xs text-right font-mono">{formatCurrency(totals.sss)}</TableCell>
                                        <TableCell className="text-xs text-right font-mono">{formatCurrency(Math.round(totals.sss * (9.5 / 4.5)))}</TableCell>
                                        <TableCell className="text-xs text-right font-mono">{formatCurrency(totals.sss + Math.round(totals.sss * (9.5 / 4.5)))}</TableCell>
                                    </>}
                                    {type === "philhealth" && <>
                                        <TableCell className="text-xs text-right font-mono">{formatCurrency(totals.ph)}</TableCell>
                                        <TableCell className="text-xs text-right font-mono">{formatCurrency(totals.ph)}</TableCell>
                                        <TableCell className="text-xs text-right font-mono">{formatCurrency(totals.ph * 2)}</TableCell>
                                    </>}
                                    {type === "pagibig" && <>
                                        <TableCell className="text-xs text-right font-mono">{formatCurrency(totals.pi)}</TableCell>
                                        <TableCell className="text-xs text-right font-mono">{formatCurrency(rows.reduce((s, r) => s + Math.min(100, Math.round(r.grossPay * 0.02)), 0))}</TableCell>
                                        <TableCell className="text-xs text-right font-mono">{formatCurrency(totals.pi + rows.reduce((s, r) => s + Math.min(100, Math.round(r.grossPay * 0.02)), 0))}</TableCell>
                                    </>}
                                    {type === "bir" && <>
                                        <TableCell className="text-xs text-right font-mono">{formatCurrency(totals.gross - totals.sss - totals.ph - totals.pi)}</TableCell>
                                        <TableCell className="text-xs text-right font-mono">{formatCurrency(totals.tax)}</TableCell>
                                    </>}
                                </TableRow>
                            </>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div>
                        <p className="text-sm font-semibold">Government Remittance Reports</p>
                        <p className="text-xs text-muted-foreground">Philippine SSS, PhilHealth, Pag-IBIG & BIR reports</p>
                    </div>
                </div>
                <Select value={selectedPeriod} onValueChange={onPeriodChange}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                        {availablePeriods.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="border border-border/50">
                    <CardContent className="p-3">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">SSS Total</p>
                        <p className="text-lg font-bold mt-1">{formatCurrency(totals.sss + Math.round(totals.sss * (9.5 / 4.5)))}</p>
                        <p className="text-[10px] text-muted-foreground">EE: {formatCurrency(totals.sss)} + ER: {formatCurrency(Math.round(totals.sss * (9.5 / 4.5)))}</p>
                    </CardContent>
                </Card>
                <Card className="border border-border/50">
                    <CardContent className="p-3">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">PhilHealth Total</p>
                        <p className="text-lg font-bold mt-1">{formatCurrency(totals.ph * 2)}</p>
                        <p className="text-[10px] text-muted-foreground">EE: {formatCurrency(totals.ph)} + ER: {formatCurrency(totals.ph)}</p>
                    </CardContent>
                </Card>
                <Card className="border border-border/50">
                    <CardContent className="p-3">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Pag-IBIG Total</p>
                        <p className="text-lg font-bold mt-1">{formatCurrency(totals.pi + rows.reduce((s, r) => s + Math.min(100, Math.round(r.grossPay * 0.02)), 0))}</p>
                        <p className="text-[10px] text-muted-foreground">EE: {formatCurrency(totals.pi)} + ER: {formatCurrency(rows.reduce((s, r) => s + Math.min(100, Math.round(r.grossPay * 0.02)), 0))}</p>
                    </CardContent>
                </Card>
                <Card className="border border-border/50">
                    <CardContent className="p-3">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">BIR Withholding</p>
                        <p className="text-lg font-bold mt-1">{formatCurrency(totals.tax)}</p>
                        <p className="text-[10px] text-muted-foreground">From {rows.length} employees</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="sss">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="sss" className="text-xs">
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> SSS
                    </TabsTrigger>
                    <TabsTrigger value="philhealth" className="text-xs">PhilHealth</TabsTrigger>
                    <TabsTrigger value="pagibig" className="text-xs">Pag-IBIG</TabsTrigger>
                    <TabsTrigger value="bir" className="text-xs">BIR (Tax)</TabsTrigger>
                </TabsList>
                <TabsContent value="sss" className="mt-3">{renderGovTable("sss")}</TabsContent>
                <TabsContent value="philhealth" className="mt-3">{renderGovTable("philhealth")}</TabsContent>
                <TabsContent value="pagibig" className="mt-3">{renderGovTable("pagibig")}</TabsContent>
                <TabsContent value="bir" className="mt-3">{renderGovTable("bir")}</TabsContent>
            </Tabs>
        </div>
    );
}
