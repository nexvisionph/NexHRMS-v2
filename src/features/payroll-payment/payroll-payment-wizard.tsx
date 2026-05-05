"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, Banknote, FileText, Filter, Loader2, Play, RefreshCcw, Search, Send, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";
import { PayrollDataTable } from "./components/PayrollDataTable";
import { PayrollPaymentStepper } from "./components/PayrollPaymentStepper";
import { PayrollSummaryCards } from "./components/PayrollSummaryCards";
import { usePayrollPaymentWizard } from "./hooks/usePayrollPaymentWizard";
import type { AttendancePayrollRecord, PayrollComponentValue, PayrollEmployee, PayrollReportType, PayrollResult } from "./types/payrollPayment.types";

function ConfirmAction({
    children,
    title,
    description,
    actionLabel,
    variant = "default",
    disabled,
    onConfirm,
}: {
    children: ReactNode;
    title: string;
    description: string;
    actionLabel: string;
    variant?: "default" | "destructive";
    disabled?: boolean;
    onConfirm: () => void;
}) {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant={variant} onClick={onConfirm}>{actionLabel}</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function StepActions({
    onPrevious,
    onNext,
    nextLabel = "Next Step",
    nextDisabled,
}: {
    onPrevious?: () => void;
    onNext?: () => void;
    nextLabel?: string;
    nextDisabled?: boolean;
}) {
    return (
        <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={onPrevious} disabled={!onPrevious}>Previous Step</Button>
            {onNext && <Button type="button" onClick={onNext} disabled={nextDisabled}>{nextLabel}</Button>}
        </div>
    );
}

function PayrollScheduleStep({ wizard }: { wizard: ReturnType<typeof usePayrollPaymentWizard> }) {
    const schedule = wizard.schedule;
    const dateFields: { key: keyof typeof schedule; label: string }[] = [
        { key: "payDate", label: "Pay date" },
        { key: "taxReportDate", label: "Tax report date" },
        { key: "cutoffDate", label: "Cut-off date" },
        { key: "salaryStartDate", label: "Salary start date" },
        { key: "salaryEndDate", label: "Salary end date" },
        { key: "attendanceStartDate", label: "Attendance start date" },
        { key: "attendanceEndDate", label: "Attendance end date" },
        { key: "claimStartDate", label: "Claim start date" },
        { key: "claimEndDate", label: "Claim end date" },
    ];
    const filters: { key: keyof typeof schedule.filters; label: string }[] = [
        { key: "jobPosition", label: "Job position" },
        { key: "workLocation", label: "Work location" },
        { key: "status", label: "Status" },
        { key: "jobGrade", label: "Job grade" },
        { key: "costCenter", label: "Cost center" },
        { key: "employmentStatus", label: "Employment status" },
        { key: "religion", label: "Religion" },
        { key: "jobStatus", label: "Job status" },
    ];
    const checks: { key: keyof typeof schedule; label: string }[] = [
        { key: "endOfMonth", label: "End of the month" },
        { key: "finalizedTaxInPeriod", label: "Finalized tax in this period" },
        { key: "calculateClaimsData", label: "Calculate claims data" },
        { key: "calculateBenefitsTransaction", label: "Calculate benefits transaction" },
        { key: "calculateTax", label: "Calculate tax" },
    ];

    return (
        <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                <Card className="border border-border/50">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Payroll Schedule</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <Label>Payment type</Label>
                                <Select value={schedule.paymentType} onValueChange={(value) => wizard.updateSchedule({ paymentType: value })}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Monthly Payroll">Monthly Payroll</SelectItem>
                                        <SelectItem value="Semi-monthly Payroll">Semi-monthly Payroll</SelectItem>
                                        <SelectItem value="Off-cycle Payroll">Off-cycle Payroll</SelectItem>
                                        <SelectItem value="Final Pay">Final Pay</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {dateFields.map((field) => (
                                <div key={field.key}>
                                    <Label>{field.label}</Label>
                                    <Input type="date" className="mt-1" value={String(schedule[field.key] || "")} onChange={(event) => wizard.updateSchedule({ [field.key]: event.target.value })} />
                                </div>
                            ))}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {checks.map((check) => (
                                <label key={check.key} className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2 text-sm">
                                    <Checkbox checked={Boolean(schedule[check.key])} onCheckedChange={(value) => wizard.updateSchedule({ [check.key]: Boolean(value) })} />
                                    {check.label}
                                </label>
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-border/50">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Employee Filter</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {filters.map((filter) => (
                            <div key={filter.key}>
                                <Label>{filter.label}</Label>
                                <Select value={schedule.filters[filter.key]} onValueChange={(value) => wizard.updateScheduleFilter(filter.key, value)}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="regular">Regular</SelectItem>
                                        <SelectItem value="main">Main Office</SelectItem>
                                        <SelectItem value="remote">Remote</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                        <Button variant="outline" className="w-full gap-2"><Users className="h-4 w-4" /> Select component</Button>
                    </CardContent>
                </Card>
            </div>
            <StepActions onNext={wizard.goNext} />
        </div>
    );
}

function HeadCountStep({ wizard }: { wizard: ReturnType<typeof usePayrollPaymentWizard> }) {
    const [search, setSearch] = useState("");
    const rows = useMemo(() => wizard.payrollEmployees.filter((employee) => `${employee.employeeName} ${employee.employeeNumber} ${employee.jobPosition}`.toLowerCase().includes(search.toLowerCase())), [search, wizard.payrollEmployees]);
    return (
        <div className="space-y-4">
            <PayrollSummaryCards items={[
                { label: "Total to Process", value: wizard.payrollEmployees.length },
                { label: "Processed Previous Period", value: wizard.payrollEmployees.filter((e) => e.lastProcess === "Previous Month").length, tone: "success" },
                { label: "New in This Period", value: wizard.payrollEmployees.filter((e) => e.lastProcess === "New Hire").length, tone: "warning" },
                { label: "Unprocessed", value: 0 },
                { label: "Paythrough", value: "Bank" },
            ]} />
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="relative md:w-80">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee" className="pl-9" />
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" /> Filter</Button>
                    <Button variant="outline">Select Employee</Button>
                    <Button className="gap-2"><UserPlus className="h-4 w-4" /> Add New Employee</Button>
                </div>
            </div>
            <PayrollDataTable<PayrollEmployee>
                rows={rows}
                getRowKey={(row) => row.id}
                emptyText="No employees match the current search."
                columns={[
                    { key: "employeeName", label: "Employee name", render: (row) => <span className="font-medium">{row.employeeName}</span> },
                    { key: "employeeNumber", label: "Employee number" },
                    { key: "jobPosition", label: "Job position" },
                    { key: "jobGrade", label: "Job grade" },
                    { key: "status", label: "Status", render: (row) => <Badge variant="secondary">{row.status}</Badge> },
                    { key: "joinDate", label: "Join date" },
                    { key: "lastProcess", label: "Last process" },
                    { key: "paythrough", label: "Paythrough" },
                    { key: "costCenter", label: "Cost center" },
                    { key: "workLocation", label: "Work location" },
                    { key: "employmentStatus", label: "Employment status" },
                    { key: "religion", label: "Religion" },
                ]}
            />
            <StepActions onPrevious={wizard.goPrevious} onNext={wizard.goNext} />
        </div>
    );
}

function AttendanceDataStep({ wizard }: { wizard: ReturnType<typeof usePayrollPaymentWizard> }) {
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    const rows = useMemo(() => wizard.attendanceRecords.filter((record) => `${record.employeeName} ${record.employeeNumber}`.toLowerCase().includes(search.toLowerCase())), [search, wizard.attendanceRecords]);
    const attendanceColumns = [
        { key: "select", label: "", render: (row: AttendancePayrollRecord) => <Checkbox checked={selected.includes(row.id)} onCheckedChange={() => setSelected((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} /> },
        { key: "employeeName", label: "Employee name", render: (row: AttendancePayrollRecord) => <span className="font-medium">{row.employeeName}</span> },
        { key: "employeeNumber", label: "Employee number" },
        { key: "abo", label: "ABO" },
        { key: "abs", label: "ABS" },
        { key: "abs2", label: "ABS2" },
        { key: "abs3", label: "ABS3" },
        { key: "absm", label: "ABSM" },
        { key: "absPh", label: "ABS_PH" },
        { key: "acd", label: "ACD" },
        { key: "acdb", label: "ACDB" },
        { key: "actTardiness", label: "ACTTARDINESS" },
        { key: "actUndertime", label: "ACTUNDERTIME" },
        { key: "ad", label: "AD" },
        { key: "anl", label: "ANL" },
        { key: "aphoff", label: "APHOFF" },
    ];
    return (
        <div className="space-y-4">
            <Tabs defaultValue="attendance">
                <TabsList className="flex h-auto w-full flex-wrap justify-start">
                    <TabsTrigger value="attendance">Employee Attendance List</TabsTrigger>
                    <TabsTrigger value="leave">Employee Leave List</TabsTrigger>
                    <TabsTrigger value="overtime">Employee Overtime List</TabsTrigger>
                    <TabsTrigger value="pending">Employee Pending Request</TabsTrigger>
                </TabsList>
                <TabsContent value="attendance" className="mt-4 space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="relative md:w-80">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search attendance" className="pl-9" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="gap-2" disabled={selected.length === 0} onClick={() => toast.success("Selected attendance records re-processed")}><RefreshCcw className="h-4 w-4" /> Re-process selected</Button>
                            <Button variant="outline" onClick={() => toast.success("All attendance interfaces re-processed")}>Re-process interface for all employees</Button>
                        </div>
                    </div>
                    <PayrollDataTable<AttendancePayrollRecord> rows={rows} getRowKey={(row) => row.id} emptyText="No attendance records found." minWidth="min-w-[1320px]" columns={attendanceColumns} />
                </TabsContent>
                {["leave", "overtime", "pending"].map((tab) => (
                    <TabsContent key={tab} value={tab} className="mt-4">
                        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No records found for this payroll period.</CardContent></Card>
                    </TabsContent>
                ))}
            </Tabs>
            <StepActions onPrevious={wizard.goPrevious} onNext={wizard.goNext} />
        </div>
    );
}

function EmployeePayrollDataStep({ wizard }: { wizard: ReturnType<typeof usePayrollPaymentWizard> }) {
    const editable = (row: PayrollComponentValue, key: keyof PayrollComponentValue) => (
        <Input
            type="number"
            className="h-8 w-28"
            value={Number(row[key])}
            onChange={(event) => wizard.updateComponentValue(row.id, key, Number(event.target.value) || 0)}
        />
    );

    return (
        <div className="space-y-4">
            <PayrollSummaryCards items={[
                { label: "All Employee", value: wizard.componentValues.length },
                { label: "Employee without Salary", value: wizard.componentValues.filter((item) => item.salaryAmount <= 0).length, tone: "danger" },
                { label: "Employee without Tax Location", value: 0 },
                { label: "Employee without Bank Info", value: 0 },
                { label: "Employee without Tax Type", value: 0 },
            ]} />
            <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
                <CardContent className="flex gap-2 p-3 text-sm text-amber-800 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    Currency converter is using mock PHP rates for this draft run. Connect the payroll rate service before production use.
                </CardContent>
            </Card>
            <Tabs defaultValue="component">
                <TabsList className="flex h-auto w-full flex-wrap justify-start">
                    <TabsTrigger value="component">Component Value</TabsTrigger>
                    <TabsTrigger value="info">Payroll Info</TabsTrigger>
                    <TabsTrigger value="effective">Component Effective Date</TabsTrigger>
                </TabsList>
                <TabsContent value="component" className="mt-4 space-y-3">
                    <Button variant="outline" size="sm" onClick={() => toast.success("Formula ignore flags reset")}>Reset Ignore Formula</Button>
                    <PayrollDataTable<PayrollComponentValue>
                        rows={wizard.componentValues}
                        getRowKey={(row) => row.id}
                        emptyText="No payroll component values found."
                        minWidth="min-w-[1420px]"
                        columns={[
                            { key: "no", label: "No.", render: (_row, index) => index + 1 },
                            { key: "employeeName", label: "Employee" },
                            { key: "salaryCurrency", label: "Salary currency" },
                            { key: "salaryAmount", label: "Salary amount", render: (row) => editable(row, "salaryAmount") },
                            { key: "thirteenthMonthCurrency", label: "13th month pay currency" },
                            { key: "thirteenthMonthAmount", label: "13th month pay amount", render: (row) => editable(row, "thirteenthMonthAmount") },
                            { key: "allowancesCurrency", label: "Allowances currency" },
                            { key: "allowancesAmount", label: "Allowances amount", render: (row) => editable(row, "allowancesAmount") },
                            { key: "mealAllowance", label: "Meal allowance", render: (row) => editable(row, "mealAllowance") },
                            { key: "basicAdjustment", label: "Basic adjustment", render: (row) => editable(row, "basicAdjustment") },
                            { key: "deminimis", label: "Deminimis", render: (row) => editable(row, "deminimis") },
                            { key: "onCall", label: "On Call", render: (row) => editable(row, "onCall") },
                            { key: "otAdjustment", label: "OT Adjustment", render: (row) => editable(row, "otAdjustment") },
                        ]}
                    />
                </TabsContent>
                {["info", "effective"].map((tab) => (
                    <TabsContent key={tab} value={tab} className="mt-4">
                        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Payroll data is ready for backend detail fields.</CardContent></Card>
                    </TabsContent>
                ))}
            </Tabs>
            <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-between">
                <Button variant="outline" onClick={wizard.goPrevious}>Previous Step</Button>
                <ConfirmAction title="Start payroll process?" description="This will calculate payroll results for all employees in the current run." actionLabel="Start Process" onConfirm={wizard.startProcess}>
                    <Button className="gap-2"><Play className="h-4 w-4" /> Start Process</Button>
                </ConfirmAction>
            </div>
        </div>
    );
}

function PayrollProcessingAndResultStep({ wizard }: { wizard: ReturnType<typeof usePayrollPaymentWizard> }) {
    const [selected, setSelected] = useState<string[]>([]);
    const resultColumns = [
        { key: "select", label: "", render: (row: PayrollResult) => <Checkbox checked={selected.includes(row.id)} onCheckedChange={() => setSelected((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} /> },
        { key: "employeeName", label: "Employee name", render: (row: PayrollResult) => <span className="font-medium">{row.employeeName}</span> },
        { key: "employeeNumber", label: "Employee number" },
        { key: "salary", label: "Salary", render: (row: PayrollResult) => formatCurrency(row.salary) },
        { key: "thirteenthMonthPay", label: "13th Month Pay", render: (row: PayrollResult) => formatCurrency(row.thirteenthMonthPay) },
        { key: "allowances", label: "Allowances", render: (row: PayrollResult) => formatCurrency(row.allowances) },
        { key: "meal", label: "Meal", render: (row: PayrollResult) => formatCurrency(row.meal) },
        { key: "basicAdjustment", label: "Basic Adjustment", render: (row: PayrollResult) => formatCurrency(row.basicAdjustment) },
        { key: "onCall", label: "On Call", render: (row: PayrollResult) => formatCurrency(row.onCall) },
        { key: "otAdjustment", label: "OT Adjustment", render: (row: PayrollResult) => formatCurrency(row.otAdjustment) },
        { key: "grossPay", label: "Gross", render: (row: PayrollResult) => formatCurrency(row.grossPay) },
        { key: "netPay", label: "Net Pay", render: (row: PayrollResult) => <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(row.netPay)}</span> },
    ];

    if (wizard.isProcessing || wizard.results.length === 0) {
        return (
            <div className="space-y-4">
                <Card className="border border-border/50">
                    <CardContent className="space-y-5 p-6">
                        <div>
                            <p className="text-sm text-muted-foreground">Payroll period</p>
                            <h3 className="text-lg font-semibold">{wizard.payrollRun.title}</h3>
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${wizard.progress}%` }} />
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>{wizard.processingLabel}</span>
                                <span className="font-medium">{wizard.progress}%</span>
                            </div>
                        </div>
                        <div className="grid gap-2 text-sm sm:grid-cols-3">
                            {["Processing Formula", "Processing Payroll", "Processing Distribution"].map((label) => (
                                <div key={label} className="rounded-md border border-border/50 p-3">{label}</div>
                            ))}
                        </div>
                        <ConfirmAction title="Cancel payroll process?" description="Current processing progress will be stopped and no result rows will be created." actionLabel="Cancel Process" variant="destructive" onConfirm={wizard.cancelProcess}>
                            <Button variant="outline" className="gap-2" disabled={!wizard.isProcessing}><Loader2 className={`h-4 w-4 ${wizard.isProcessing ? "animate-spin" : ""}`} /> Cancel Process</Button>
                        </ConfirmAction>
                    </CardContent>
                </Card>
                <StepActions onPrevious={wizard.goPrevious} />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                <ConfirmAction title="Delete selected result rows?" description="Selected payroll result rows will be removed from this draft run." actionLabel="Delete Selected" variant="destructive" disabled={selected.length === 0} onConfirm={() => { wizard.deleteResults(selected); setSelected([]); }}>
                    <Button variant="outline" className="gap-2" disabled={selected.length === 0}><Trash2 className="h-4 w-4" /> Delete Selected</Button>
                </ConfirmAction>
                <Button variant="outline" className="gap-2" disabled={selected.length === 0} onClick={() => wizard.reprocessSelected(selected)}><RefreshCcw className="h-4 w-4" /> Re-process Selected</Button>
                <Button variant="outline" onClick={() => wizard.reprocessSelected()}>Reprocess For All Employees</Button>
            </div>
            <PayrollDataTable<PayrollResult> rows={wizard.results} getRowKey={(row) => row.id} emptyText="No payroll results yet." minWidth="min-w-[1320px]" columns={resultColumns} />
            <StepActions onPrevious={wizard.goPrevious} onNext={wizard.goNext} />
        </div>
    );
}

function PayrollReportStep({ wizard }: { wizard: ReturnType<typeof usePayrollPaymentWizard> }) {
    const reportCards: Record<PayrollReportType, string> = {
        "payroll-summary": "Payroll totals, net pay, deductions, and employee coverage for the processed run.",
        "payroll-variance": "Period-over-period changes in salary, allowance, deductions, and net pay.",
        "payroll-report": "Detailed payroll register by employee and payroll component.",
        "bank-report": "Banking information needed for salary transfer.",
        "statutory-report": "Government contribution and withholding summaries.",
    };

    return (
        <div className="space-y-4">
            <Tabs value={wizard.reportType} onValueChange={(value) => wizard.setReportType(value as PayrollReportType)}>
                <TabsList className="flex h-auto w-full flex-wrap justify-start">
                    <TabsTrigger value="payroll-summary">Payroll Summary</TabsTrigger>
                    <TabsTrigger value="payroll-variance">Payroll Variance</TabsTrigger>
                    <TabsTrigger value="payroll-report">Payroll Report</TabsTrigger>
                    <TabsTrigger value="bank-report">Bank Report</TabsTrigger>
                    <TabsTrigger value="statutory-report">Statutory Report</TabsTrigger>
                </TabsList>
                {Object.entries(reportCards).map(([key, description]) => (
                    <TabsContent key={key} value={key} className="mt-4">
                        {key === "bank-report" ? (
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card className="border border-border/50">
                                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Banknote className="h-4 w-4" /> Bank Transfer</CardTitle></CardHeader>
                                    <CardContent className="text-sm text-muted-foreground">Banking information needed for payroll transfer such as employee account number, bank name, account holder name, and transfer amount.</CardContent>
                                </Card>
                                <Card className="border border-border/50">
                                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Bank File</CardTitle></CardHeader>
                                    <CardContent className="text-sm text-muted-foreground">Salary transfer information via bank file.</CardContent>
                                </Card>
                            </div>
                        ) : (
                            <Card className="border border-border/50"><CardContent className="p-6 text-sm text-muted-foreground">{description}</CardContent></Card>
                        )}
                    </TabsContent>
                ))}
            </Tabs>
            <div className="flex flex-col-reverse gap-2 border-t border-border/50 pt-4 sm:flex-row sm:justify-between">
                <Button variant="outline" onClick={wizard.goPrevious}>Previous Step</Button>
                <ConfirmAction title="Publish payslips?" description="Payslips for this processed payroll run will be made available to employees." actionLabel="Publish Payslip" onConfirm={() => toast.success("Payslips published")}>
                    <Button className="gap-2"><Send className="h-4 w-4" /> Publish Payslip</Button>
                </ConfirmAction>
            </div>
        </div>
    );
}

export default function PayrollPaymentWizard() {
    const wizard = usePayrollPaymentWizard();

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-xl font-semibold">Payroll Payment Workflow</h2>
                <p className="text-sm text-muted-foreground">Configure, validate, process, and publish payroll through a guided payment run.</p>
            </div>
            {wizard.error && (
                <Card className="border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
                    <CardContent className="flex gap-2 p-3 text-sm text-red-700 dark:text-red-300">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        {wizard.error}
                    </CardContent>
                </Card>
            )}
            <div className="flex flex-col gap-4 lg:flex-row">
                <PayrollPaymentStepper steps={wizard.steps} activeStep={wizard.activeStep} completedSteps={wizard.completedSteps} onStepClick={wizard.goToStep} />
                <main className="min-w-0 flex-1">
                    {wizard.activeStep === "schedule" && <PayrollScheduleStep wizard={wizard} />}
                    {wizard.activeStep === "head-count" && <HeadCountStep wizard={wizard} />}
                    {wizard.activeStep === "attendance" && <AttendanceDataStep wizard={wizard} />}
                    {wizard.activeStep === "payroll-data" && <EmployeePayrollDataStep wizard={wizard} />}
                    {wizard.activeStep === "process-result" && <PayrollProcessingAndResultStep wizard={wizard} />}
                    {wizard.activeStep === "report" && <PayrollReportStep wizard={wizard} />}
                </main>
            </div>
        </div>
    );
}
