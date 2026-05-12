"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { usePayrollStore } from "@/store/payroll.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { useLoansStore } from "@/store/loans.store";
import { useLeaveStore } from "@/store/leave.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useDeductionsStore } from "@/store/deductions.store";
import { useTimesheetStore } from "@/store/timesheet.store";
import { buildPayslipDeductions, computeDailyRate, computeHourlyRate } from "@/lib/payroll-deductions";
import { categorizePay } from "@/lib/bir-tax-categories";
import { PH_HOLIDAY_MULTIPLIERS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Plus, CheckCircle, Eye, Lock, LockOpen, Gift, Download, CalendarDays, RotateCcw, Send, CreditCard, FileText, Sparkles, Shield, PenTool, Search, Settings, Building2, Printer, Clock, Percent, Trash2, AlertCircle, Info, Save, Pencil, X, Loader2, FileSignature, Calculator, Edit, Users, Bell, XCircle, Upload, Flag } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { computeAllPHDeductions } from "@/lib/ph-deductions";
import { PayslipTable } from "@/components/payroll/payslip-table";
import { PayScheduleSettings } from "@/components/payroll/pay-schedule-settings";
import { GovernmentReports } from "@/components/payroll/government-reports";
import { PrintablePayslip } from "@/components/payroll/printable-payslip";
import { PayrollReadinessChecklist } from "@/components/payroll/payroll-readiness-checklist";
import { format, endOfMonth, subMonths, getYear, getMonth, parseISO, differenceInCalendarDays, getDaysInMonth } from "date-fns";
import { Textarea } from "@/components/ui/textarea";
import { dispatchNotification, notifyPayslipOnHold } from "@/lib/notifications";
import { useAuditStore } from "@/store/audit.store";
import { payrollDb } from "@/services/db.service";
import type { DeductionType, DeductionOverrideMode, DeductionTemplate, DeductionTemplateType, DeductionCalculationMode, Department, Project } from "@/types";
import { PH_EXEMPTION_REASONS } from "@/types";
import { useDepartmentsStore } from "@/store/departments.store";
import { useProjectsStore } from "@/store/projects.store";
import { ThirteenthMonthModal } from "@/components/payroll/thirteenth-month-modal";
import { ExportBackupDialog } from "@/components/export-backup-dialog";
import { ImportDataDialog } from "@/components/import-data-dialog";
import PayrollPaymentWizard, { type WizardStep, usePayrollProgress } from "@/features/payroll-payment/payroll-payment-wizard";
import Link from "next/link";
import { useParams } from "next/navigation";

/* ═══════════════════════════════════════════════════════════════
   ADMIN / FINANCE / PAYROLL_ADMIN VIEW — Full Payroll Management
   mode controls minor feature differences:
     admin        → all features
     finance      → all payroll features (same as admin for payroll)
     payroll_admin → all payroll features
   ═══════════════════════════════════════════════════════════════ */
interface AdminPayrollViewProps {
    mode?: "admin" | "finance" | "payroll_admin";
}

export default function AdminPayrollView({ mode = "admin" }: AdminPayrollViewProps) {
    const params = useParams();
    const role = params.role as string;
    const { payslips, runs, adjustments, finalPayComputations, issuePayslip, confirmPayslip, publishPayslip, recordPayment, confirmPaidByFinance, holdPayment, releasePaymentHold, rejectHoldSignature, lockRun, unlockRun, publishRun, endRun, markRunPaid, approveAdjustment, applyAdjustment, createAdjustment, computeFinalPay, generate13thMonth, exportBankFile, createDraftRun, validateRun, resetToSeed, paySchedule, updatePaySchedule, signatureConfig, updateSignatureConfig, deductionOverrides, setDeductionOverride, removeDeductionOverride, clearEmployeeOverrides, getDeductionOverride, getEmployeeOverrides, globalDefaults, updateGlobalDefault, getGlobalDefault, updatePayslipFromServer, isPayslipRunLocked } = usePayrollStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const { getActiveByEmployee, recordDeduction } = useLoansStore();
    const { getEmployeeBalances } = useLeaveStore();
    const holidays = useAttendanceStore((s) => s.holidays);
    const attendanceLogs = useAttendanceStore((s) => s.logs);
    const ruleSets = useTimesheetStore((s) => s.ruleSets);
    const { hasPermission } = useRolesStore();
    const { templates: deductionTemplates, computeDeductionsForEmployee } = useDeductionsStore();

    const canIssue = hasPermission(currentUser.role, "payroll:generate");
    const canLock = hasPermission(currentUser.role, "payroll:lock");
    const canReset = mode === "admin";

    const handleReset = async () => {
        // Nuclear reset: wipe ALL payroll data from Supabase (not filtered by IDs).
        // This ensures nothing survives regardless of store ↔ DB drift.
        await payrollDb.resetAllPayrollData();

        // Clear store → employee payslip views also immediately show empty state
        resetToSeed();
        toast.success("Payroll data reset");
    };

    const suggestedWizardStep = usePayrollProgress();
    const [wizardStep, setWizardStep] = useState<WizardStep>(suggestedWizardStep);
    // Auto-follow suggested step unless user manually navigated
    useEffect(() => { setWizardStep(suggestedWizardStep); }, [suggestedWizardStep]);

    const [open, setOpen] = useState(false);
    const [snapshotRunDate, setSnapshotRunDate] = useState<string | null>(null);
    const [checklistPassedMap, setChecklistPassedMap] = useState<Record<string, boolean>>({});
    const [viewSlip, setViewSlip] = useState<string | null>(null);
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [formAllowances, setFormAllowances] = useState("0");
    const [formOtherDeductions, setFormOtherDeductions] = useState("0");
    const [formOTHours, setFormOTHours] = useState("0");
    const [formNightDiffHours, setFormNightDiffHours] = useState("0");
    const [formNotes, setFormNotes] = useState("");
    const [formIssuedAt, setFormIssuedAt] = useState(format(new Date(), "yyyy-MM-dd"));
    const [grossOverrides, setGrossOverrides] = useState<Record<string, string>>({});
    const [expandedOverrideEmpId, setExpandedOverrideEmpId] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
    const [cutoff, setCutoff] = useState<"first" | "second">(() =>
        new Date().getDate() > paySchedule.semiMonthlyFirstCutoff ? "second" : "first"
    );

    // ─── Period-end override (for partial-period proration) ───────
    // Helper: compute the canonical full-period boundaries for a given month/cutoff
    const computeNaturalBoundaries = useCallback((month: string, cut: "first" | "second", freq: string, cutDay: number) => {
        const base = new Date(month + "-01");
        const yr = getYear(base);
        const mo = getMonth(base);
        if (freq === "semi_monthly") {
            if (cut === "first") {
                return { start: `${month}-01`, end: `${month}-${String(cutDay).padStart(2, "0")}` };
            } else {
                const eom = endOfMonth(new Date(yr, mo, 1));
                return { start: `${month}-${String(cutDay + 1).padStart(2, "0")}`, end: format(eom, "yyyy-MM-dd") };
            }
        }
        if (freq === "bi_weekly" || freq === "weekly") {
            return { start: `${month}-01`, end: format(endOfMonth(new Date(yr, mo, 1)), "yyyy-MM-dd") };
        }
        // monthly
        return { start: `${month}-01`, end: format(endOfMonth(new Date(yr, mo, 1)), "yyyy-MM-dd") };
    }, []);

    const naturalBounds = useMemo(
        () => computeNaturalBoundaries(selectedMonth, cutoff, paySchedule.defaultFrequency, paySchedule.semiMonthlyFirstCutoff),
        [selectedMonth, cutoff, paySchedule.defaultFrequency, paySchedule.semiMonthlyFirstCutoff, computeNaturalBoundaries]
    );

    // Smart default: min(today, naturalEnd), clamped to [naturalStart, naturalEnd]
    const computeSmartPeriodEnd = useCallback((bounds: { start: string; end: string }) => {
        const today = format(new Date(), "yyyy-MM-dd");
        if (today < bounds.start) return bounds.start;
        if (today > bounds.end) return bounds.end;
        return today;
    }, []);

    const [formPeriodEnd, setFormPeriodEnd] = useState(() => computeSmartPeriodEnd(computeNaturalBoundaries(
        format(new Date(), "yyyy-MM"),
        new Date().getDate() > paySchedule.semiMonthlyFirstCutoff ? "second" : "first",
        paySchedule.defaultFrequency,
        paySchedule.semiMonthlyFirstCutoff
    )));

    // Reset period end whenever the selected month or cutoff changes
    useEffect(() => {
        setFormPeriodEnd(computeSmartPeriodEnd(naturalBounds));
    }, [naturalBounds, computeSmartPeriodEnd]);

    // ─── Search, filter, pagination ──────────────────────────────
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [page, setPage] = useState(1);
    const [publishPage, setPublishPage] = useState(1);
    const [signPage, setSignPage] = useState(1);
    const [runsPage, setRunsPage] = useState(1);
    const pageSize = 50;

    // ─── Dialog states ───────────────────────────────────────────
    const [printPayslipId, setPrintPayslipId] = useState<string | null>(null);
    const [govPeriod, setGovPeriod] = useState(format(new Date(), "yyyy-MM"));

    // ─── Re-issue & Hold states ────────────────────────────────────
    const [reissueConfirmId, setReissueConfirmId] = useState<string | null>(null);
    const [holdModalOpen, setHoldModalOpen] = useState(false);
    const [holdNotes, setHoldNotes] = useState<Record<string, string>>({});
    const [holdSearchTerm, setHoldSearchTerm] = useState("");
    const [holdPage, setHoldPage] = useState(1);
    // ─── On-hold approve payment dialog ──────────────────────────
    const [holdApprovePsId, setHoldApprovePsId] = useState<string | null>(null);
    const [holdPayMethod, setHoldPayMethod] = useState<"bank_transfer" | "gcash" | "cash" | "check">("bank_transfer");
    const [holdPayRef, setHoldPayRef] = useState("");
    const [holdCashAmount, setHoldCashAmount] = useState<number | undefined>(undefined);
    const [holdProofFile, setHoldProofFile] = useState<File | null>(null);
    const [holdProofPreview, setHoldProofPreview] = useState<string | null>(null);
    const [holdIsUploading, setHoldIsUploading] = useState(false);
    const resetHoldPaymentDialog = () => { setHoldApprovePsId(null); setHoldPayRef(""); setHoldCashAmount(undefined); setHoldProofFile(null); setHoldProofPreview(null); setHoldPayMethod("bank_transfer"); };

    // ─── Signature config draft state ────────────────────────────
    const [sigEditing, setSigEditing] = useState(false);
    const [sigSaving, setSigSaving] = useState(false);
    const [sigDraft, setSigDraft] = useState({
        mode: signatureConfig.mode,
        signatoryName: signatureConfig.signatoryName,
        signatoryTitle: signatureConfig.signatoryTitle,
        signatureDataUrl: signatureConfig.signatureDataUrl,
    });

    const handleSigSave = async () => {
        setSigSaving(true);
        updateSignatureConfig(sigDraft);
        await payrollDb.upsertSignatureConfig({ ...sigDraft });
        setSigSaving(false);
        setSigEditing(false);
        toast.success("Authorized signature saved");
    };

    const handleSigEdit = () => {
        setSigDraft({
            mode: signatureConfig.mode,
            signatoryName: signatureConfig.signatoryName,
            signatoryTitle: signatureConfig.signatoryTitle,
            signatureDataUrl: signatureConfig.signatureDataUrl,
        });
        setSigEditing(true);
    };

    const handleSigCancel = () => {
        setSigDraft({
            mode: signatureConfig.mode,
            signatoryName: signatureConfig.signatoryName,
            signatoryTitle: signatureConfig.signatoryTitle,
            signatureDataUrl: signatureConfig.signatureDataUrl,
        });
        setSigEditing(false);
    };

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    // ─── Cutoff date range (end is user-overridable via formPeriodEnd) ──────
    const cutoffDates = useMemo(() => {
        const start = naturalBounds.start;
        const end = formPeriodEnd;
        const startDate = parseISO(start);
        const endDate = parseISO(end);
        const label = `${format(startDate, "MMM d")} – ${format(endDate, "MMM d, yyyy")}`;
        return { start, end, label };
    }, [naturalBounds.start, formPeriodEnd]);

    // Proration metrics (calendar-day basis, per PH DOLE common practice)
    const prorationInfo = useMemo(() => {
        const nominalDays = differenceInCalendarDays(parseISO(naturalBounds.end), parseISO(naturalBounds.start)) + 1;
        const actualDays  = differenceInCalendarDays(parseISO(cutoffDates.end), parseISO(cutoffDates.start)) + 1;
        const factor = Math.min(1, actualDays / nominalDays);
        const isPartial = actualDays < nominalDays;
        const pct = Math.round(factor * 1000) / 10; // one decimal
        return { nominalDays, actualDays, factor, isPartial, pct };
    }, [naturalBounds, cutoffDates]);

    const last6Months = useMemo(() => Array.from({ length: 6 }, (_, i) => format(subMonths(new Date(), i), "yyyy-MM")), []);
    const last12Months = useMemo(() => Array.from({ length: 12 }, (_, i) => format(subMonths(new Date(), i), "yyyy-MM")), []);
    const activeEmployees = useMemo(() => employees.filter((e) => e.status === "active"), [employees]);
    const [empSearchTerm, setEmpSearchTerm] = useState("");
    const filteredActiveEmployees = useMemo(() => {
        if (!empSearchTerm.trim()) return activeEmployees;
        const q = empSearchTerm.toLowerCase();
        return activeEmployees.filter((e) => e.name.toLowerCase().includes(q) || e.department.toLowerCase().includes(q) || e.role.toLowerCase().includes(q));
    }, [activeEmployees, empSearchTerm]);

    const activeRun = useMemo(() => runs
        .filter((r) => r.status !== "completed")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0], [runs]);
    const hasActiveRun = Boolean(activeRun);
    const activeRunPayslipIds = useMemo(() => new Set(activeRun?.payslipIds ?? []), [activeRun]);
    const activeRunPayslips = useMemo(
        () => activeRun ? payslips.filter((p) => activeRunPayslipIds.has(p.id)) : [],
        [payslips, activeRunPayslipIds, activeRun]
    );

    useEffect(() => {
        setPage(1);
        setPublishPage(1);
        setSignPage(1);
    }, [activeRun?.id]);


    // ─── Filtered & paginated payslips ───────────────────────────
    const filteredPayslips = useMemo(() => {
        if (!activeRun) return [];
        let filtered = activeRunPayslips;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            filtered = filtered.filter((ps) =>
                getEmpName(ps.employeeId).toLowerCase().includes(q) ||
                ps.periodStart.includes(q) || ps.periodEnd.includes(q) || ps.id.toLowerCase().includes(q)
            );
        }
        if (statusFilter !== "all") {
            filtered = filtered.filter((ps) => statusFilter === "published" ? ps.status === "published" || ps.status === "payment_hold" : ps.status === statusFilter);
        }
        return filtered.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    }, [activeRun, activeRunPayslips, searchTerm, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredPayslips.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginatedPayslips = useMemo(() => filteredPayslips.slice((safePage - 1) * pageSize, safePage * pageSize), [filteredPayslips, pageSize, safePage]);

    const publishTotalPages = Math.max(1, Math.ceil(filteredPayslips.length / pageSize));
    const publishSafePage = Math.min(publishPage, publishTotalPages);
    const paginatedPublishPayslips = useMemo(
        () => filteredPayslips.slice((publishSafePage - 1) * pageSize, publishSafePage * pageSize),
        [filteredPayslips, pageSize, publishSafePage]
    );

    const signPayslips = useMemo(
        () => filteredPayslips.filter((p) => p.status === "published" || p.status === "payment_hold" || p.status === "signed"),
        [filteredPayslips]
    );
    const signTotalPages = Math.max(1, Math.ceil(signPayslips.length / pageSize));
    const signSafePage = Math.min(signPage, signTotalPages);
    const paginatedSignPayslips = useMemo(
        () => signPayslips.slice((signSafePage - 1) * pageSize, signSafePage * pageSize),
        [signPayslips, pageSize, signSafePage]
    );

    // Smart cutoff detection: periodStart uniquely identifies the cutoff — a payslip with the same
    // periodStart and payFrequency means this employee already received pay for this cutoff,
    // regardless of whether the period end differed (e.g. partial-period proration).
    const eligibleFilteredEmployees = useMemo(() => filteredActiveEmployees.filter((e) => {
        const empFreq = e.payFrequency || paySchedule.defaultFrequency;
        return !payslips.some((p) => p.employeeId === e.id && p.periodStart === cutoffDates.start && (p.payFrequency === empFreq || !p.payFrequency));
    }), [filteredActiveEmployees, payslips, cutoffDates, paySchedule.defaultFrequency]);
    const allSelected = eligibleFilteredEmployees.length > 0 && eligibleFilteredEmployees.every((e) => selectedEmployeeIds.includes(e.id));
    const toggleSelectAll = () => {
        if (allSelected) {
            const eligibleIds = new Set(eligibleFilteredEmployees.map((e) => e.id));
            setSelectedEmployeeIds((prev) => prev.filter((id) => !eligibleIds.has(id)));
        } else {
            const newIds = new Set([...selectedEmployeeIds, ...eligibleFilteredEmployees.map((e) => e.id)]);
            setSelectedEmployeeIds(Array.from(newIds));
        }
    };

    const getLeaveBalance = (empId: string): number => {
        const year = new Date().getFullYear();
        const bals = getEmployeeBalances(empId, year);
        return bals.reduce((sum, b) => sum + b.remaining, 0);
    };

    const getLoanBalance = (empId: string): number => {
        const loans = getActiveByEmployee(empId);
        return loans.reduce((sum, l) => sum + l.remainingBalance, 0);
    };
    const toggleEmployee = (empId: string) => { setSelectedEmployeeIds((prev) => prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]); };

    // Compute whether gov deductions will apply for the currently selected cutoff
    const govDeductionsSkipped = useMemo(() => {
        if (paySchedule.defaultFrequency !== "semi_monthly") return false;
        if (paySchedule.deductGovFrom === "both") return false;
        return paySchedule.deductGovFrom !== cutoff;
    }, [paySchedule.defaultFrequency, paySchedule.deductGovFrom, cutoff]);

    // ─── Issue handler ────────────────────────────────────────────
    const handleIssue = () => {
        const periodKey = `${cutoffDates.start}/${cutoffDates.end}`;
        const cutoffLocked = isRunLocked(periodKey);
        if (cutoffLocked) { toast.error("This cutoff period is locked. Unlock the payroll run first to issue new payslips."); return; }

        // Period guard: block if another cutoff in the same month has an active (non-completed) run
        if (paySchedule.defaultFrequency === "semi_monthly") {
            const sameMonthRuns = runs.filter((r) => {
                if (r.status === "completed") return false;
                const runMonth = r.periodLabel.substring(0, 7);
                return runMonth === selectedMonth;
            });
            const conflictingRun = sameMonthRuns.find((r) => r.periodLabel !== periodKey);
            if (conflictingRun) {
                toast.error(`Cannot issue for ${cutoff === "first" ? "1st" : "2nd"} cutoff — the other cutoff run (${conflictingRun.periodLabel}) is still active. Complete it first.`);
                return;
            }
        }
        if (selectedEmployeeIds.length === 0 || !cutoffDates.start || !cutoffDates.end) { toast.error("Please select at least one employee and set cutoff dates"); return; }
        if (cutoffDates.start > cutoffDates.end) { toast.error("Cutoff start date must be before end date"); return; }
        const allowancesVal = Number(formAllowances) || 0;
        const otherDedVal = Number(formOtherDeductions) || 0;
        const otHoursVal = Number(formOTHours) || 0;
        const nightDiffVal = Number(formNightDiffHours) || 0;
        if (allowancesVal < 0) { toast.error("Allowances cannot be negative"); return; }
        if (otherDedVal < 0) { toast.error("Other deductions cannot be negative"); return; }
        if (otHoursVal < 0) { toast.error("OT hours cannot be negative"); return; }
        if (nightDiffVal < 0) { toast.error("Night differential hours cannot be negative"); return; }

        try {
            let successCount = 0;
            let totalLoanDeductions = 0;
            let skippedDuplicates = 0;
            let zeroNetPayCount = 0;

            selectedEmployeeIds.forEach((empId) => {
                const emp = employees.find((e) => e.id === empId);
                if (!emp) return;

                const freq = emp.payFrequency || paySchedule.defaultFrequency;

                // Smart cutoff duplicate guard: same periodStart + payFrequency = same cutoff,
                // even if the end date differs due to partial-period proration
                const existingPayslip = payslips.find(
                    (p) => p.employeeId === empId && p.periodStart === cutoffDates.start && (p.payFrequency === freq || !p.payFrequency)
                );
                if (existingPayslip) { skippedDuplicates++; return; }

                // ─── Proration: compute per-employee factor based on freq ──────────
                // For semi-monthly / bi-weekly / weekly we prorate relative to the
                // nominal period days.  For monthly we prorate against days-in-month.
                const { factor: prorFactor, isPartial: isProrPartial, actualDays: prorActual, nominalDays: prorNominal } = prorationInfo;
                let fullPeriodGross: number;
                if (freq === "semi_monthly") fullPeriodGross = Math.round(emp.salary / 2);
                else if (freq === "bi_weekly") fullPeriodGross = Math.round((emp.salary * 12) / 26);
                else if (freq === "weekly") fullPeriodGross = Math.round((emp.salary * 12) / 52);
                else {
                    // monthly: prorate against calendar days in month
                    const daysInMo = getDaysInMonth(parseISO(naturalBounds.start));
                    fullPeriodGross = emp.salary;
                    const monthFactor = Math.min(1, prorActual / daysInMo);
                    fullPeriodGross = Math.round(emp.salary * monthFactor);
                }
                const grossPay = freq === "monthly"
                    ? fullPeriodGross // already factored above
                    : Math.round(fullPeriodGross * prorFactor);

                // ─── Admin per-employee gross override ────────────────────────────
                const overrideStr = grossOverrides[empId];
                const effectiveGrossPay = (overrideStr && Number(overrideStr) > 0)
                    ? Math.round(Number(overrideStr))
                    : grossPay;

                const phDeductions = computeAllPHDeductions(emp.salary);
                let govMultiplier = 1;
                if (freq === "semi_monthly") {
                    if (paySchedule.deductGovFrom === "both") govMultiplier = 0.5;
                    else if (paySchedule.deductGovFrom === "first" && cutoff !== "first") govMultiplier = 0;
                    else if (paySchedule.deductGovFrom === "second" && cutoff !== "second") govMultiplier = 0;
                }

                const empLoans = getActiveByEmployee(empId);
                const rawLoanDeduction = empLoans.reduce((sum, l) => sum + Math.min(l.monthlyDeduction, l.remainingBalance), 0);
                // Enforce 30% deduction cap per DB schema (loans.deduction_cap_percent DEFAULT 30)
                const empLoanDeduction = Math.min(rawLoanDeduction, Math.round(effectiveGrossPay * 0.30));
                totalLoanDeductions += empLoanDeduction;

                const allowances = allowancesVal;
                const otherDed = otherDedVal;
                const otHours = otHoursVal;
                const nightDiffHours = nightDiffVal;

                // Apply deduction overrides for each government contribution (Philippine Standard)
                // Priority: per-employee override > global default > auto (standard PH calc)
                const computeDeduction = (type: DeductionType, autoValue: number, basis: number = grossPay): number => {
                    const override = getDeductionOverride(empId, type);
                    const globalDef = getGlobalDefault(type);

                    // If the global default has this type disabled, return 0 (admin toggled it off)
                    if (globalDef && !globalDef.enabled) return 0;

                    // Use per-employee override if set, otherwise fall back to global default
                    const effective = override ?? (globalDef && globalDef.mode !== "auto" ? { mode: globalDef.mode, percentage: globalDef.percentage, fixedAmount: globalDef.fixedAmount } : null);

                    if (!effective || effective.mode === "auto") {
                        return Math.round(autoValue * govMultiplier);
                    }
                    if (effective.mode === "exempt") {
                        return 0;
                    }
                    if (effective.mode === "percentage" && effective.percentage !== undefined) {
                        return Math.round(basis * (effective.percentage / 100) * govMultiplier);
                    }
                    if (effective.mode === "fixed" && effective.fixedAmount !== undefined) {
                        return Math.round(effective.fixedAmount * govMultiplier);
                    }
                    return Math.round(autoValue * govMultiplier);
                };

                const sss = emp.deductionExempt ? 0 : computeDeduction("sss", phDeductions.sss);
                const ph = emp.deductionExempt ? 0 : computeDeduction("philhealth", phDeductions.philHealth);
                const pi = emp.deductionExempt ? 0 : computeDeduction("pagibig", phDeductions.pagIBIG);

                // BIR tax is calculated on taxable income (gross minus gov contributions)
                const taxableIncome = Math.max(0, effectiveGrossPay - sss - ph - pi);
                const birOverride = getDeductionOverride(empId, "bir");
                const birGlobal = getGlobalDefault("bir");
                let tax: number;
                if (emp.deductionExempt || (birGlobal && !birGlobal.enabled)) {
                    tax = 0;
                } else {
                    const birEffective = birOverride ?? (birGlobal && birGlobal.mode !== "auto" ? { mode: birGlobal.mode, percentage: birGlobal.percentage, fixedAmount: birGlobal.fixedAmount } : null);
                    if (!birEffective || birEffective.mode === "auto") {
                        tax = Math.round(phDeductions.withholdingTax * govMultiplier);
                    } else if (birEffective.mode === "exempt") {
                        tax = 0;
                    } else if (birEffective.mode === "percentage" && birEffective.percentage !== undefined) {
                        tax = Math.round(taxableIncome * (birEffective.percentage / 100));
                    } else if (birEffective.mode === "fixed" && birEffective.fixedAmount !== undefined) {
                        tax = Math.round(birEffective.fixedAmount * govMultiplier);
                    } else {
                        tax = Math.round(phDeductions.withholdingTax * govMultiplier);
                    }
                }

                const totalGovDed = sss + ph + pi + tax;

                const dailyRate = Math.round(emp.salary / 22);

                // ─── Custom deduction templates ───────────────────────────────────
                // Skipped entirely if employee is deduction-exempt (contract-based, etc.)
                const workDaysPerPeriod = emp.workDays?.length
                    ? Math.round(emp.workDays.length * (22 / 5))
                    : 22;
                const customItems = emp.deductionExempt
                    ? []
                    : computeDeductionsForEmployee(empId, emp.salary, workDaysPerPeriod);
                const customDedTotal = customItems
                    .filter((item) => deductionTemplates.find((t) => t.id === item.templateId)?.type === "deduction")
                    .reduce((sum, item) => sum + item.amount, 0);
                const customAllowanceTotal = customItems
                    .filter((item) => deductionTemplates.find((t) => t.id === item.templateId)?.type === "allowance")
                    .reduce((sum, item) => sum + item.amount, 0);

                const hourlyRate = Math.round(dailyRate / 8);
                const otPay = Math.round(otHours * hourlyRate * 1.25); // PH Labor Code: OT at 125%
                const nightDiffPay = Math.round(nightDiffHours * hourlyRate * 0.10); // PH: +10% for 10PM-6AM
                const periodHolidays = holidays.filter((h) => h.date >= cutoffDates.start && h.date <= cutoffDates.end);
                let holidayPaySupp = 0;
                periodHolidays.forEach((hol) => {
                    const log = attendanceLogs.find((l) => l.employeeId === empId && l.date === hol.date);
                    const worked = log?.status === "present";
                    if (hol.type === "regular") { if (worked) holidayPaySupp += dailyRate; }
                    else { if (worked) holidayPaySupp += Math.round(dailyRate * (PH_HOLIDAY_MULTIPLIERS.special_holiday.worked - 1)); else holidayPaySupp -= dailyRate; }
                });

                // ─── Auto-deductions from attendance (migration 055) ──────────
                // Aggregates attendance logs in the cutoff period and applies the
                // late/absent/undertime deductions gated by paySchedule toggles.
                // OT pay continues to come from the form input (manual override),
                // but its itemized snapshot is stored on the payslip below.
                const periodLogs = attendanceLogs.filter(
                    (l) => l.employeeId === empId && l.date >= cutoffDates.start && l.date <= cutoffDates.end
                );
                const lateMinutesAgg = periodLogs.reduce((sum, l) => sum + (l.lateMinutes || 0), 0);
                const absentDaysAgg = periodLogs.filter((l) => l.status === "absent").length;
                const presentDaysAgg = periodLogs.filter((l) => l.status === "present").length;
                const activeRuleSet = ruleSets[0]; // RS-DEFAULT
                const stdHours = activeRuleSet?.standardHoursPerDay ?? 8;
                const presentLogs = periodLogs.filter((l) => l.status === "present");
                const expectedHoursTotal = presentLogs.length * stdHours;
                const actualHoursTotal = presentLogs.reduce((sum, l) => sum + (l.hours || 0), 0);
                const undertimeHoursAgg = Math.max(0, expectedHoursTotal - actualHoursTotal);
                const libDailyRate = computeDailyRate(emp.salary, paySchedule.workDaysPerMonth);
                const libHourlyRate = computeHourlyRate(libDailyRate, stdHours);
                const autoBreakdown = buildPayslipDeductions({
                    autoDeductLate: paySchedule.autoDeductLate,
                    autoDeductAbsent: paySchedule.autoDeductAbsent,
                    autoDeductUndertime: paySchedule.autoDeductUndertime,
                    autoAddOvertime: false, // OT comes from form here, not auto
                    dailyRate: libDailyRate,
                    hourlyRate: libHourlyRate,
                    lateMinutes: lateMinutesAgg,
                    absentDays: absentDaysAgg,
                    shiftHours: expectedHoursTotal,
                    actualHours: actualHoursTotal,
                    overtimeEntries: [],
                    multipliers: {
                        otMultiplierRegular: activeRuleSet?.otMultiplierRegular ?? 1.25,
                        otMultiplierRestDay: activeRuleSet?.otMultiplierRestDay ?? 1.30,
                        otMultiplierSpecialHoliday: activeRuleSet?.otMultiplierSpecialHoliday ?? 1.30,
                        otMultiplierRegularHoliday: activeRuleSet?.otMultiplierRegularHoliday ?? 2.00,
                        otMultiplierNightDiff: activeRuleSet?.otMultiplierNightDiff ?? 1.10,
                    },
                });
                const autoDedTotal = autoBreakdown.totalDeductions;

                const rawNetPay = effectiveGrossPay + allowances + holidayPaySupp + otPay + nightDiffPay + customAllowanceTotal - totalGovDed - otherDed - empLoanDeduction - customDedTotal - autoDedTotal;
                const netPay = Math.max(0, rawNetPay);
                if (rawNetPay <= 0) zeroNetPayCount++;

                // BIR — categorize earnings into taxable / non-taxable buckets for Alphalist + Form 2316
                const taxCategories = categorizePay({
                    employee: { id: emp.id, isMWE: emp.isMWE, mweDailyRate: emp.mweDailyRate, salary: emp.salary },
                    basicPay: effectiveGrossPay,
                    overtimePay: otPay,
                    holidayPay: holidayPaySupp,
                    nightDiff: nightDiffPay,
                    taxableAllowances: 0,
                    nonTaxableAllowances: allowances + customAllowanceTotal,
                    sss, philHealth: ph, pagIBIG: pi,
                    withholdingTax: tax,
                });

                issuePayslip({
                    employeeId: empId, periodStart: cutoffDates.start, periodEnd: cutoffDates.end, payFrequency: freq,
                    grossPay: effectiveGrossPay,
                    allowances: allowances + otPay + nightDiffPay,
                    sssDeduction: sss, philhealthDeduction: ph, pagibigDeduction: pi, taxDeduction: tax,
                    otherDeductions: otherDed, loanDeduction: empLoanDeduction,
                    customDeductions: customDedTotal,
                    holidayPay: holidayPaySupp !== 0 ? holidayPaySupp : undefined, netPay,
                    // BIR tax categorization (migration 056)
                    taxCategories,
                    taxableCompensation: taxCategories.taxableTotal,
                    nonTaxableCompensation: taxCategories.nonTaxableTotal,
                    // Itemized auto-deduction snapshots (migration 055)
                    lateDeduction: autoBreakdown.lateDeduction,
                    absentDeduction: autoBreakdown.absentDeduction,
                    undertimeDeduction: autoBreakdown.undertimeDeduction,
                    overtimePay: otPay,
                    dailyRate: libDailyRate,
                    hourlyRate: libHourlyRate,
                    // Attendance snapshot for receipt display
                    attendanceDaysPresent: presentDaysAgg,
                    attendanceDaysAbsent: absentDaysAgg,
                    attendanceLateMinutes: lateMinutesAgg,
                    attendanceUndertimeHours: undertimeHoursAgg,
                    // Gross override flag
                    grossOverrideApplied: overrideStr && Number(overrideStr) > 0 ? true : undefined,
                    notes: formNotes || [
                        isProrPartial ? `Prorated: ${prorActual}/${prorNominal} days (${Math.round(prorFactor * 1000) / 10}%)` : "",
                        overrideStr && Number(overrideStr) > 0 ? `Gross overridden to ₱${Number(overrideStr).toLocaleString()}` : "",
                        otHours > 0 ? `OT: ${otHours}hrs (\u20B1${otPay})` : "",
                        nightDiffHours > 0 ? `ND: ${nightDiffHours}hrs (\u20B1${nightDiffPay})` : "",
                    ].filter(Boolean).join(" · ") || undefined, issuedAt: formIssuedAt,
                });

                const actualPayslipId = usePayrollStore.getState().payslips.filter((p) => p.employeeId === empId).sort((a, b) => b.id.localeCompare(a.id))[0]?.id ?? `PS-fallback-${Date.now()}`;
                empLoans.forEach((loan) => { const amt = Math.min(loan.monthlyDeduction, loan.remainingBalance); if (amt > 0) recordDeduction(loan.id, actualPayslipId, amt); });
                successCount++;
            });

            const loanMsg = totalLoanDeductions > 0 ? ` (incl. ${formatCurrency(totalLoanDeductions)} total loan deductions)` : "";
            if (skippedDuplicates > 0) toast.warning(`${skippedDuplicates} employee${skippedDuplicates > 1 ? "s" : ""} already had payslips for this period — skipped.`);
            if (zeroNetPayCount > 0) toast.warning(`${zeroNetPayCount} employee${zeroNetPayCount > 1 ? "s" : ""} issued with ₱0 net pay — review deductions before locking.`);
            if (successCount > 0) toast.success(`Issued ${successCount} payslip${successCount > 1 ? "s" : ""}${loanMsg}`);
            else if (skippedDuplicates > 0) toast.info("No new payslips issued — all selected employees already have payslips for this period.");
            setOpen(false); setSelectedEmployeeIds([]); setFormAllowances("0"); setFormOtherDeductions("0"); setFormOTHours("0"); setFormNightDiffHours("0"); setFormNotes(""); setFormIssuedAt(format(new Date(), "yyyy-MM-dd")); setFormPeriodEnd(computeSmartPeriodEnd(naturalBounds)); setEmpSearchTerm(""); setGrossOverrides({}); setExpandedOverrideEmpId(null);
        } catch (err) {
            toast.error(`Payslip issuance failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
    };

    // ─── 13th Month Modal State ─────────────────────────────────
    const [thirteenthMonthOpen, setThirteenthMonthOpen] = useState(false);
    const { departments } = useDepartmentsStore();
    const { projects } = useProjectsStore();

    const handle13thMonthGenerate = useCallback((selectedEmployees: { id: string; salary: number; joinDate: string }[], year: number) => {
        generate13thMonth(selectedEmployees, year);
        toast.success(`Generated 13th Month Pay ${year} for ${selectedEmployees.length} employee${selectedEmployees.length > 1 ? "s" : ""}`);
    }, [generate13thMonth]);

    const payrollRuns = useMemo(() => {
        return runs.map((r) => {
            const runPayslips = payslips.filter((p) => (r.payslipIds || []).includes(p.id));
            return {
                date: r.periodLabel,
                runId: r.id,
                count: runPayslips.length,
                totalNet: runPayslips.reduce((sum, p) => sum + p.netPay, 0),
                totalGross: runPayslips.reduce((sum, p) => sum + (p.grossPay || 0), 0),
                published: runPayslips.filter((p) => p.status === "published" || p.status === "payment_hold" || p.status === "signed").length,
                draftCount: runPayslips.filter((p) => p.status === "draft").length,
                signedCount: runPayslips.filter((p) => p.status === "signed" || p.status === "paid").length,
                payableCount: runPayslips.filter((p) => p.status === "signed").length,
                resolvedCount: runPayslips.filter((p) => p.status === "paid" || p.status === "payment_hold" || (p.status === "published" && !p.signedAt)).length,
                allPaymentResolved: runPayslips.length > 0 && runPayslips.every((p) => p.status === "paid" || p.status === "payment_hold" || (p.status === "published" && !p.signedAt)),
            };
        }).sort((a, b) => b.date.localeCompare(a.date));
    }, [runs, payslips]);

    const runsTotalPages = Math.max(1, Math.ceil(payrollRuns.length / pageSize));
    const runsSafePage = Math.min(runsPage, runsTotalPages);
    const paginatedRuns = useMemo(
        () => payrollRuns.slice((runsSafePage - 1) * pageSize, runsSafePage * pageSize),
        [payrollRuns, pageSize, runsSafePage]
    );

    const isRunLocked = (runDate: string) => runs.find((r) => r.periodLabel === runDate)?.locked ?? false;
    const isCutoffPeriodLocked = useMemo(() => {
        if (!cutoffDates.start || !cutoffDates.end) return false;
        const periodKey = `${cutoffDates.start}/${cutoffDates.end}`;
        return runs.some((r) => r.locked && r.status !== "completed" && r.periodLabel === periodKey);
    }, [runs, cutoffDates]);
    const viewedPayslip = viewSlip ? payslips.find((p) => p.id === viewSlip) : null;

    const viewTitle = mode === "admin" ? "Payroll Management" : mode === "finance" ? "Payroll & Finance" : "Payroll Administration";

    // ─── Batch action state ──────────────────────────────────────
    const [batchProcessing, setBatchProcessing] = useState(false);
    const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

    // ─── Draft payslips with zero government deductions (warn before publish) ───
    const draftZeroDeductionCount = useMemo(() =>
        filteredPayslips.filter((p) =>
            p.status === "draft" &&
            (p.sssDeduction || 0) + (p.philhealthDeduction || 0) + (p.pagibigDeduction || 0) + (p.taxDeduction || 0) === 0
        ).length
        , [filteredPayslips]);

    // ─── Status summary counts ───────────────────────────────────
    const statusCounts = useMemo(() => {
        const counts = { draft: 0, published: 0, signed: 0, paid: 0, onHold: 0, publishedUnsigned: 0 };
        activeRunPayslips.forEach((p) => {
            if (p.status === "draft") counts.draft++;
            if (p.status === "published") counts.published++;
            if (p.status === "signed") counts.signed++;
            if (p.status === "paid") counts.paid++;
            if (p.status === "payment_hold") counts.onHold++;
            if (p.status === "published" && !p.signedAt) counts.publishedUnsigned++;
        });
        return counts;
    }, [activeRunPayslips]);

    // ─── Batch handlers ──────────────────────────────────────────
    // Use store-first pattern (matching single-action buttons).
    // The write-through subscriber in sync.service.ts persists to Supabase.
    const handleBatchPublish = useCallback(() => {
        const draftSlips = filteredPayslips.filter((p) => p.status === "draft" && isPayslipRunLocked(p.id));
        if (draftSlips.length === 0) { toast.error("No draft payslips in a locked payroll run to publish"); return; }
        setBatchProcessing(true);
        try {
            draftSlips.forEach((ps) => {
                publishPayslip(ps.id);
                useAuditStore.getState().log({ entityType: "payslip", entityId: ps.id, action: "payroll_published", performedBy: currentUser.id });
                dispatchNotification("payslip_published", { name: getEmpName(ps.employeeId), period: `${ps.periodStart} — ${ps.periodEnd}`, amount: formatCurrency(ps.netPay) }, ps.employeeId);
            });
            toast.success(`Published ${draftSlips.length} payslip${draftSlips.length > 1 ? "s" : ""}`);
        } catch (err) {
            toast.error(`Failed to publish payslips: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setBatchProcessing(false);
        }
    }, [filteredPayslips, publishPayslip, currentUser.id, isPayslipRunLocked]);

    const handleBatchRecordPayment = useCallback(() => {
        const signedSlips = filteredPayslips.filter((p) => p.status === "signed");
        if (signedSlips.length === 0) { toast.error("No signed payslips to record payment for"); return; }
        setBatchProcessing(true);
        try {
            signedSlips.forEach((ps) => {
                recordPayment(ps.id, "bank_transfer", `BATCH-REF-${Date.now()}-${ps.id}`);
                useAuditStore.getState().log({ entityType: "payslip", entityId: ps.id, action: "payment_recorded", performedBy: currentUser.id });
                dispatchNotification("payment_confirmed", { name: getEmpName(ps.employeeId), period: `${ps.periodStart} — ${ps.periodEnd}`, amount: formatCurrency(ps.netPay) }, ps.employeeId);
            });
            toast.success(`Recorded payment for ${signedSlips.length} payslip${signedSlips.length > 1 ? "s" : ""}`);
        } catch (err) {
            toast.error(`Failed to record payments: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setBatchProcessing(false);
        }
    }, [filteredPayslips, recordPayment, currentUser.id]);

    /** Recompute government + custom deductions on draft payslips using current Tax Settings. */
    const handleBatchRecomputeDeductions = useCallback(() => {
        // Only recompute payslips that haven't been published yet (draft only)
        const eligible = filteredPayslips.filter((p) => p.status === "draft");
        if (eligible.length === 0) { toast.error("No draft payslips to recompute"); return; }
        setBatchProcessing(true);
        try {
            let updated = 0;
            eligible.forEach((ps) => {
                const emp = employees.find((e) => e.id === ps.employeeId);
                if (!emp) return;
                const phDeductions = computeAllPHDeductions(emp.salary);

                // Re-use the same override/global default priority chain as handleIssue
                const computeDeduction = (type: DeductionType, autoValue: number, basis: number = ps.grossPay): number => {
                    const override = getDeductionOverride(ps.employeeId, type);
                    const globalDef = getGlobalDefault(type);
                    if (globalDef && !globalDef.enabled) return 0;
                    const effective = override ?? (globalDef && globalDef.mode !== "auto" ? { mode: globalDef.mode, percentage: globalDef.percentage, fixedAmount: globalDef.fixedAmount } : null);
                    if (!effective || effective.mode === "auto") return Math.round(autoValue);
                    if (effective.mode === "exempt") return 0;
                    if (effective.mode === "percentage" && effective.percentage !== undefined) return Math.round(basis * (effective.percentage / 100));
                    if (effective.mode === "fixed" && effective.fixedAmount !== undefined) return Math.round(effective.fixedAmount);
                    return Math.round(autoValue);
                };

                // Deduction-exempt employees (contract-based, etc.) get zero gov deductions
                const sss = emp.deductionExempt ? 0 : computeDeduction("sss", phDeductions.sss);
                const ph = emp.deductionExempt ? 0 : computeDeduction("philhealth", phDeductions.philHealth);
                const pi = emp.deductionExempt ? 0 : computeDeduction("pagibig", phDeductions.pagIBIG);
                const taxableIncome = Math.max(0, ps.grossPay - sss - ph - pi);
                const birOverride = getDeductionOverride(ps.employeeId, "bir");
                const birGlobal = getGlobalDefault("bir");
                let tax: number;
                if (emp.deductionExempt || (birGlobal && !birGlobal.enabled)) {
                    tax = 0;
                } else {
                    const birEffective = birOverride ?? (birGlobal && birGlobal.mode !== "auto" ? { mode: birGlobal.mode, percentage: birGlobal.percentage, fixedAmount: birGlobal.fixedAmount } : null);
                    if (!birEffective || birEffective.mode === "auto") tax = Math.round(phDeductions.withholdingTax);
                    else if (birEffective.mode === "exempt") tax = 0;
                    else if (birEffective.mode === "percentage" && birEffective.percentage !== undefined) tax = Math.round(taxableIncome * (birEffective.percentage / 100));
                    else if (birEffective.mode === "fixed" && birEffective.fixedAmount !== undefined) tax = Math.round(birEffective.fixedAmount);
                    else tax = Math.round(phDeductions.withholdingTax);
                }

                const totalGovDed = sss + ph + pi + tax;
                const oldGovDed = ps.sssDeduction + ps.philhealthDeduction + ps.pagibigDeduction + ps.taxDeduction;

                // Re-apply custom deduction templates
                const workDaysPerPeriod = emp.workDays?.length ? Math.round(emp.workDays.length * (22 / 5)) : 22;
                const customItems = emp.deductionExempt
                    ? []
                    : computeDeductionsForEmployee(ps.employeeId, emp.salary, workDaysPerPeriod);
                const newCustomDed = customItems
                    .filter((item) => deductionTemplates.find((t) => t.id === item.templateId)?.type === "deduction")
                    .reduce((sum, item) => sum + item.amount, 0);
                const newCustomAllowance = customItems
                    .filter((item) => deductionTemplates.find((t) => t.id === item.templateId)?.type === "allowance")
                    .reduce((sum, item) => sum + item.amount, 0);
                const oldCustomDed = ps.customDeductions ?? 0;

                // netPay diff: old total deductions - new total deductions + new allowances - old allowances
                const netPayDiff = (oldGovDed - totalGovDed) + (oldCustomDed - newCustomDed) + newCustomAllowance;
                const newNetPay = Math.max(0, ps.netPay + netPayDiff);

                updatePayslipFromServer({
                    id: ps.id,
                    sssDeduction: sss,
                    philhealthDeduction: ph,
                    pagibigDeduction: pi,
                    taxDeduction: tax,
                    customDeductions: newCustomDed,
                    netPay: newNetPay,
                });
                updated++;
            });
            toast.success(`Recomputed deductions for ${updated} payslip${updated > 1 ? "s" : ""}`);
        } catch (err) {
            toast.error(`Failed to recompute deductions: ${err instanceof Error ? err.message : "Unknown error"}`);
        } finally {
            setBatchProcessing(false);
        }
    }, [filteredPayslips, employees, getDeductionOverride, getGlobalDefault, updatePayslipFromServer, computeDeductionsForEmployee, deductionTemplates]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col min-w-[200px]">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{viewTitle}</h1>
                    <p className="text-sm text-muted-foreground mt-1">{activeRunPayslips.length} payslips</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 justify-start md:justify-end">
                    {canReset && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground"><RotateCcw className="h-4 w-4" /> <span className="hidden sm:inline">Reset</span></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Reset Payroll Data?</AlertDialogTitle>
                                    <AlertDialogDescription>This will clear all payroll data and restore it to the initial demo state.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    {canIssue && (<>
                        <Link href={`/${role}/payroll/settings`}>
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Payroll Settings</span>
                            </Button>
                        </Link>
                        {/* DEMO: hidden — uncomment to re-enable
                        <Link href={`/${role}/payroll/bir-compliance`}>
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <Shield className="h-4 w-4" /> <span className="hidden sm:inline">BIR Compliance</span>
                            </Button>
                        </Link>
                        */}
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setThirteenthMonthOpen(true)}>
                            <Gift className="h-4 w-4" /> <span className="hidden sm:inline">13th Month</span>
                        </Button>
                        <ExportBackupDialog module="payroll" />
                        <ImportDataDialog module="payroll" onImportComplete={() => toast.success("Payroll data imported — refresh to see changes")} />
                        <Dialog open={open} onOpenChange={(isOpen) => {
                            if (isOpen && isCutoffPeriodLocked) {
                                toast.error("This cutoff period is locked. Unlock the payroll run first to issue new payslips.");
                                return;
                            }
                            setOpen(isOpen);
                        }}>
                            <DialogTrigger asChild>
                                <Button className="gap-1.5">
                                    {isCutoffPeriodLocked ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Run Payroll
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="!max-w-6xl w-[95vw] flex flex-col max-h-[90vh]">
                                <DialogHeader className="shrink-0">
                                    <DialogTitle>Run Payroll — Bulk</DialogTitle>
                                    <p className="text-sm text-muted-foreground mt-1">Configure pay period, select employees, and generate payslips.</p>
                                </DialogHeader>
                                <div className="grid grid-cols-2 gap-6 pt-1 overflow-y-auto pr-1">
                                    {/* ── Left Column: Config ── */}
                                    <div className="space-y-4">
                                        {/* Pay Period */}
                                        <div>
                                            <label className="text-sm font-medium">Pay Period</label>
                                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {last6Months.map((m) => <SelectItem key={m} value={m}>{format(new Date(m + "-01"), "MMMM yyyy")}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            {paySchedule.defaultFrequency === "semi_monthly" && (
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    <Button type="button" size="sm" variant={cutoff === "first" ? "default" : "outline"} className="gap-1.5 justify-start" onClick={() => setCutoff("first")}>
                                                        <CalendarDays className="h-3.5 w-3.5" /> 1st – {paySchedule.semiMonthlyFirstCutoff}th
                                                    </Button>
                                                    <Button type="button" size="sm" variant={cutoff === "second" ? "default" : "outline"} className="gap-1.5 justify-start" onClick={() => setCutoff("second")}>
                                                        <CalendarDays className="h-3.5 w-3.5" /> {paySchedule.semiMonthlyFirstCutoff + 1}th – EOM
                                                    </Button>
                                                </div>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-1.5 font-mono bg-muted px-2 py-1 rounded">{cutoffDates.label}</p>
                                        </div>
                                        {/* Actual Period End (partial-period override) */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-sm font-medium">Actual Period End</label>
                                                {prorationInfo.isPartial && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-semibold px-2 py-0.5">
                                                        <CalendarDays className="h-3 w-3" />
                                                        {prorationInfo.actualDays}/{prorationInfo.nominalDays} days · {prorationInfo.pct}% gross
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-1.5">
                                                <Input
                                                    type="date"
                                                    min={naturalBounds.start}
                                                    max={naturalBounds.end}
                                                    value={formPeriodEnd}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        if (v >= naturalBounds.start && v <= naturalBounds.end) setFormPeriodEnd(v);
                                                    }}
                                                    className="flex-1"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="shrink-0 text-xs px-2.5"
                                                    onClick={() => setFormPeriodEnd(computeSmartPeriodEnd(naturalBounds))}
                                                    title="Reset to today"
                                                >
                                                    Today
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="shrink-0 text-xs px-2.5 text-muted-foreground"
                                                    onClick={() => setFormPeriodEnd(naturalBounds.end)}
                                                    title="Full period"
                                                >
                                                    Full
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {prorationInfo.isPartial
                                                    ? `Gross will be prorated to ${prorationInfo.pct}% of the full period amount.`
                                                    : "Full period — no proration applied."}
                                            </p>
                                        </div>
                                        {/* Issue Date */}
                                        <div><label className="text-sm font-medium">Issue Date</label><Input type="date" value={formIssuedAt} onChange={(e) => setFormIssuedAt(e.target.value)} className="mt-1" /></div>
                                        {/* Allowances & Deductions */}
                                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">Applied to ALL selected</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><label className="text-xs text-muted-foreground">Extra Allowances (+)</label><Input type="number" min={0} value={formAllowances} onChange={(e) => setFormAllowances(e.target.value)} className="mt-1 h-8 text-xs" placeholder="0" /></div>
                                                <div><label className="text-xs text-muted-foreground">Other Deductions (−)</label><Input type="number" min={0} value={formOtherDeductions} onChange={(e) => setFormOtherDeductions(e.target.value)} className="mt-1 h-8 text-xs" placeholder="0" /></div>
                                            </div>
                                        </div>
                                        {/* OT & Night Diff */}
                                        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Overtime & Night Differential</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><label className="text-xs text-muted-foreground">OT Hours (125%)</label><Input type="number" min={0} step="0.5" value={formOTHours} onChange={(e) => setFormOTHours(e.target.value)} className="mt-1 h-8 text-xs" placeholder="0" /></div>
                                                <div><label className="text-xs text-muted-foreground">Night Diff (+10%)</label><Input type="number" min={0} step="0.5" value={formNightDiffHours} onChange={(e) => setFormNightDiffHours(e.target.value)} className="mt-1 h-8 text-xs" placeholder="0" /></div>
                                            </div>
                                        </div>
                                        {/* Gov't Deduction Quick Controls */}
                                        <div className="border border-border/60 rounded-lg p-3 bg-muted/30">
                                            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                                                <Percent className="h-3.5 w-3.5" /> Gov&apos;t Deduction Controls
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {(["sss", "philhealth", "pagibig", "bir"] as DeductionType[]).map((type) => {
                                                    const gd = getGlobalDefault(type);
                                                    const labels: Record<DeductionType, string> = { sss: "SSS", philhealth: "PhilHealth", pagibig: "Pag-IBIG", bir: "BIR Tax" };
                                                    const modeLabel = !gd?.enabled ? "Disabled" : gd?.mode === "exempt" ? "Exempt (₱0)" : gd?.mode === "percentage" ? `${gd.percentage ?? 0}%` : gd?.mode === "fixed" ? `₱${gd.fixedAmount ?? 0}` : "Auto PH";
                                                    const modeColor = !gd?.enabled || gd?.mode === "exempt" ? "text-red-500" : "text-emerald-600";
                                                    return (
                                                        <div key={type} className="flex items-center justify-between bg-background border border-border/50 rounded px-2 py-1.5">
                                                            <div>
                                                                <span className="text-xs font-medium">{labels[type]}</span>
                                                                <p className={`text-[9px] leading-tight ${modeColor}`}>{modeLabel}</p>
                                                            </div>
                                                            <button type="button" onClick={() => updateGlobalDefault({ deductionType: type, enabled: !gd?.enabled, mode: gd?.mode ?? "auto" })} className={`relative w-8 h-4 rounded-full transition-colors ${gd?.enabled && gd?.mode !== "exempt" ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                                                                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-200 ${gd?.enabled && gd?.mode !== "exempt" ? "left-4" : "left-0.5"}`} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-1.5">Synced with Tax Settings tab</p>
                                        </div>
                                        {/* Notes */}
                                        <div><label className="text-xs text-muted-foreground">Notes (optional)</label><Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="e.g. bonus included" className="mt-1 h-8 text-xs" /></div>
                                        {selectedEmployeeIds.length > 0 && (
                                            <Card className="border border-emerald-500/30 bg-emerald-500/5">
                                                <CardContent className="p-3">
                                                    <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                                                        <strong>Auto-computed per employee:</strong><br />
                                                        • Gross from salary &middot; Gov&apos;t deductions &middot; Loans<br />
                                                        • Holiday pay (DOLE) &middot; OT 125% &middot; Night Diff +10%
                                                        {holidays.filter(h => h.date >= cutoffDates.start && h.date <= cutoffDates.end).length > 0 && (
                                                            <span className="block mt-1 font-semibold text-amber-700 dark:text-amber-400">
                                                                {holidays.filter(h => h.date >= cutoffDates.start && h.date <= cutoffDates.end).length} holiday(s) in this period
                                                            </span>
                                                        )}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        )}
                                        {govDeductionsSkipped && selectedEmployeeIds.length > 0 && (
                                            <Card className="border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20">
                                                <CardContent className="p-3 flex gap-2">
                                                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                                    <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                                                        <strong>Gov deductions ₱0 for this cutoff.</strong> Deductions apply on <strong>{paySchedule.deductGovFrom === "first" ? "1st" : "2nd"} cutoff</strong> only.
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        )}
                                        <Button onClick={handleIssue} className="w-full" disabled={selectedEmployeeIds.length === 0}>
                                            Issue {selectedEmployeeIds.length} Payslip{selectedEmployeeIds.length !== 1 ? "s" : ""}
                                        </Button>
                                    </div>
                                    {/* ── Right Column: Employees ── */}
                                    <div className="flex flex-col min-h-0">
                                        {/* Employee Selection */}
                                        <div className="flex flex-col flex-1 min-h-0">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium">Select Employees ({selectedEmployeeIds.length} selected)</label>
                                                <Button type="button" variant="outline" size="sm" onClick={toggleSelectAll} className="h-8 text-xs">{allSelected ? "Deselect All" : "Select All"}</Button>
                                            </div>
                                            <div className="relative mb-2">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                <Input placeholder="Search employees..." value={empSearchTerm} onChange={(e) => setEmpSearchTerm(e.target.value)} className="pl-8 h-8 text-xs" />
                                            </div>
                                            <Card className="border border-border/50 flex-1 overflow-y-auto">
                                                <CardContent className="p-2 space-y-1">
                                                    {filteredActiveEmployees.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground text-center py-4">{empSearchTerm ? "No employees match search" : "No active employees"}</p>
                                                    ) : filteredActiveEmployees.map((emp) => {
                                                        const empFreq = emp.payFrequency || paySchedule.defaultFrequency;
                                                        const alreadyIssuedSlip = cutoffDates.start ? payslips.find(
                                                            (p) => p.employeeId === emp.id && p.periodStart === cutoffDates.start && (p.payFrequency === empFreq || !p.payFrequency)
                                                        ) : undefined;
                                                        const alreadyIssued = !!alreadyIssuedSlip;
                                                        const overrideActive = !!(grossOverrides[emp.id] && Number(grossOverrides[emp.id]) > 0);
                                                        const isExpanded = expandedOverrideEmpId === emp.id;
                                                        return (
                                                            <div key={emp.id} className={`rounded-lg border transition-colors ${alreadyIssued ? "opacity-50 cursor-not-allowed bg-muted/30 border-transparent" : overrideActive ? "border-amber-400/60 bg-amber-50/40 dark:bg-amber-950/20" : "border-transparent hover:bg-muted/50 hover:border-border/50"}`}>
                                                                <div onClick={() => !alreadyIssued && toggleEmployee(emp.id)} className={`flex items-center gap-3 p-2 ${alreadyIssued ? "cursor-not-allowed" : "cursor-pointer"}`}>
                                                                    <Checkbox checked={selectedEmployeeIds.includes(emp.id)} onCheckedChange={() => !alreadyIssued && toggleEmployee(emp.id)} disabled={alreadyIssued} />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium">{emp.name}{alreadyIssuedSlip && <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-normal">✓ Issued ({alreadyIssuedSlip.status})</span>}{overrideActive && <span className="ml-2 text-xs text-amber-700 dark:text-amber-400 font-semibold">⚡ Gross override</span>}</p>
                                                                        <p className="text-xs text-muted-foreground">{emp.role} • {emp.department} • {formatCurrency(emp.salary)}/mo</p>
                                                                    </div>
                                                                    <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded whitespace-nowrap">
                                                                        {overrideActive ? formatCurrency(Number(grossOverrides[emp.id])) : (() => {
                                                                            const f = emp.payFrequency || paySchedule.defaultFrequency;
                                                                            if (f === "semi_monthly") return `≈${formatCurrency(Math.round(emp.salary / 2))}/cutoff`;
                                                                            if (f === "bi_weekly") return `≈${formatCurrency(Math.round((emp.salary * 12) / 26))}/period`;
                                                                            if (f === "weekly") return `≈${formatCurrency(Math.round((emp.salary * 12) / 52))}/wk`;
                                                                            return `${formatCurrency(emp.salary)}/mo`;
                                                                        })()}
                                                                    </span>
                                                                    {!alreadyIssued && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); setExpandedOverrideEmpId(isExpanded ? null : emp.id); }}
                                                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                                            title="Override gross pay"
                                                                        >
                                                                            <Pencil className="h-3 w-3" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {isExpanded && !alreadyIssued && (
                                                                    <div className="px-3 pb-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                        <label className="text-xs text-muted-foreground whitespace-nowrap">Override gross ₱</label>
                                                                        <Input
                                                                            type="number"
                                                                            min={1}
                                                                            value={grossOverrides[emp.id] ?? ""}
                                                                            onChange={(e) => setGrossOverrides((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                                                                            placeholder="e.g. 15000"
                                                                            className="h-7 text-xs flex-1"
                                                                        />
                                                                        {overrideActive && (
                                                                            <button type="button" onClick={() => { setGrossOverrides((prev) => { const n = { ...prev }; delete n[emp.id]; return n; }); setExpandedOverrideEmpId(null); }} className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap">Clear</button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </>)}
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="payroll">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="payroll" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Payroll</TabsTrigger>
                    {canIssue && <TabsTrigger value="deductions" className="gap-1.5"><Calculator className="h-3.5 w-3.5" /> Deduction/Allowance</TabsTrigger>}
                    {canIssue && <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> Pay Schedule</TabsTrigger>}
                    {canIssue && <TabsTrigger value="tax-settings" className="gap-1.5"><Percent className="h-3.5 w-3.5" /> Tax Settings</TabsTrigger>}
                    {canIssue && <TabsTrigger value="gov-reports" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Gov Reports</TabsTrigger>}
                </TabsList>

                {/* ═══ Unified Payroll Tab — 2-column layout ═══ */}
                <TabsContent value="payroll" className="mt-4">
                    <div className="flex gap-6">
                        {/* ── Left: Step Content ── */}
                        <div className="flex-1 min-w-0 space-y-4">

                            {/* ═══ STEP: Run Payroll — Payslips ═══ */}
                            {(wizardStep === "issue" || wizardStep === "lock") && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> Payslips</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {([
                                            { key: "draft", label: "Draft", color: "text-amber-600 dark:text-amber-400" },
                                            { key: "published", label: "Published", color: "text-violet-600 dark:text-violet-400" },
                                            { key: "signed", label: "Signed", color: "text-emerald-600 dark:text-emerald-400" },
                                        ] as const).map(({ key, label, color }) => (
                                            <Card key={key} className="border border-border/50">
                                                <CardContent className="p-3 text-center">
                                                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">{label}</p>
                                                    <p className={`text-xl font-bold mt-0.5 ${color}`}>{statusCounts[key]}</p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>

                                    {/* Batch Actions */}
                                    {canIssue && (
                                        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 border border-border/50 rounded-lg">
                                            <span className="text-xs font-medium text-muted-foreground mr-2">Batch Actions:</span>
                                            <AlertDialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-violet-600 border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                                                        disabled={batchProcessing || filteredPayslips.filter((p) => p.status === "draft" && isPayslipRunLocked(p.id)).length === 0}
                                                    >
                                                        <Send className="h-3.5 w-3.5" />
                                                        Publish All Draft ({filteredPayslips.filter((p) => p.status === "draft" && isPayslipRunLocked(p.id)).length})
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Publish {statusCounts.draft} Draft Payslip{statusCounts.draft !== 1 ? "s" : ""}?</AlertDialogTitle>
                                                        <AlertDialogDescription asChild>
                                                            <div className="space-y-3 text-sm">
                                                                {draftZeroDeductionCount > 0 ? (
                                                                    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-amber-800 dark:text-amber-300">
                                                                        <p className="font-semibold mb-1">⚠ Deductions not yet applied</p>
                                                                        <p><strong>{draftZeroDeductionCount}</strong> of the {statusCounts.draft} draft payslip{statusCounts.draft !== 1 ? "s" : ""} still have <strong>₱0 government deductions</strong> (SSS, PhilHealth, Pag-IBIG, BIR Tax).</p>
                                                                        <p className="mt-1.5">Use <strong>Apply Deductions</strong> first to compute and attach deductions before publishing, or proceed to publish as-is.</p>
                                                                    </div>
                                                                ) : (
                                                                    <p>This will publish all <strong>{statusCounts.draft}</strong> draft payslip{statusCounts.draft !== 1 ? "s" : ""} and notify employees. This action cannot be undone.</p>
                                                                )}
                                                                <p className="text-muted-foreground text-xs">Employees will be able to view their payslips after publishing.</p>
                                                            </div>
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        {draftZeroDeductionCount > 0 && (
                                                            <Button variant="outline" size="sm" onClick={() => { setPublishConfirmOpen(false); handleBatchRecomputeDeductions(); }}>
                                                                Apply Deductions First
                                                            </Button>
                                                        )}
                                                        <AlertDialogAction onClick={handleBatchPublish}>
                                                            {draftZeroDeductionCount > 0 ? "Publish Anyway" : "Publish All"}
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                            <Button
                                                variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                                disabled={batchProcessing || statusCounts.draft === 0}
                                                onClick={handleBatchRecomputeDeductions}
                                            >
                                                <Sparkles className="h-3.5 w-3.5" />
                                                Apply Deductions ({statusCounts.draft})
                                            </Button>
                                            {batchProcessing && <span className="text-xs text-muted-foreground animate-pulse ml-2">Processing...</span>}
                                        </div>
                                    )}

                                    {/* Search & Filter Bar */}
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input placeholder="Search employee, period, or ID..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); setPublishPage(1); setSignPage(1); }} className="pl-9 h-9" />
                                        </div>
                                        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); setPublishPage(1); setSignPage(1); }}>
                                            <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Statuses</SelectItem>
                                                <SelectItem value="draft">Draft</SelectItem>
                                                <SelectItem value="published">Published</SelectItem>
                                                <SelectItem value="signed">Signed</SelectItem>
                                                <SelectItem value="paid">Paid</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground self-center whitespace-nowrap">{filteredPayslips.length} result{filteredPayslips.length !== 1 ? "s" : ""}</p>
                                    </div>
                                    <Card className="border border-border/50">
                                        <CardContent className="p-0">
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader><TableRow>
                                                        <TableHead className="text-xs">Employee</TableHead><TableHead className="text-xs">Period</TableHead>
                                                        <TableHead className="text-xs">Gross</TableHead><TableHead className="text-xs">Deductions</TableHead>
                                                        <TableHead className="text-xs">Net Pay</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Employee Action</TableHead><TableHead className="text-xs w-28"></TableHead>
                                                    </TableRow></TableHeader>
                                                    <TableBody>
                                                        {paginatedPayslips.length === 0 ? (
                                                            <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">{searchTerm || statusFilter !== "all" ? "No matching payslips" : "No payslips"}</TableCell></TableRow>
                                                        ) : paginatedPayslips.map((ps) => (
                                                            <TableRow key={ps.id}>
                                                                <TableCell className="text-sm font-medium">{getEmpName(ps.employeeId)}</TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">{ps.periodStart} – {ps.periodEnd}</TableCell>
                                                                <TableCell className="text-xs">₱{(ps.grossPay || 0).toLocaleString()}</TableCell>
                                                                <TableCell className="text-xs text-red-500">−₱{((ps.sssDeduction || 0) + (ps.philhealthDeduction || 0) + (ps.pagibigDeduction || 0) + (ps.taxDeduction || 0) + (ps.otherDeductions || 0) + (ps.loanDeduction || 0)).toLocaleString()}</TableCell>
                                                                <TableCell className="text-sm font-medium">₱{ps.netPay.toLocaleString()}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="secondary" className={`text-[10px] ${ps.status === "signed" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                                                                        ps.status === "payment_hold" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                                                                        ps.status === "published" ? "bg-violet-500/15 text-violet-700 dark:text-violet-400" :
                                                                            ps.status === "draft" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                                                                                "bg-slate-500/15 text-slate-700 dark:text-slate-400"
                                                                        }`}>{ps.status === "payment_hold" ? "On Hold" : ps.status}</Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {ps.status === "signed" ? (
                                                                        <button onClick={() => setViewSlip(ps.id)} className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline" title={`Signed ${ps.signedAt ? new Date(ps.signedAt).toLocaleString() : ""}`}>
                                                                            <PenTool className="h-3.5 w-3.5" />
                                                                            <span className="text-[10px] font-medium">View Sig</span>
                                                                        </button>
                                                                    ) : ps.status === "payment_hold" ? (
                                                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold" title="Payslip is on hold — pending compliance">
                                                                            <AlertCircle className="h-3 w-3" /> On Hold
                                                                        </span>
                                                                    ) : ps.status === "published" ? (
                                                                        <span className="text-[10px] text-red-600 dark:text-red-400 flex items-center gap-1 font-semibold" title="Employee must sign payslip (PH DOLE requirement)">
                                                                            <FileSignature className="h-3 w-3" /> Awaiting Signature
                                                                        </span>
                                                                    ) : ps.status === "draft" && isPayslipRunLocked(ps.id) ? (
                                                                        <span className="text-[10px] text-violet-600 dark:text-violet-400 flex items-center gap-1">
                                                                            <Send className="h-3 w-3" /> Ready to Publish
                                                                        </span>
                                                                    ) : ps.status === "draft" ? (
                                                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1" title="Payroll run must be locked before publishing">
                                                                            <Lock className="h-3 w-3" /> Run not locked
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-muted-foreground">—</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center gap-1">
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewSlip(ps.id)}><Eye className="h-3.5 w-3.5" /></Button>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Print" onClick={() => setPrintPayslipId(ps.id)}><Printer className="h-3.5 w-3.5" /></Button>
                                                                        {canIssue && ps.status === "draft" && (() => {
                                                                            const psRunLocked = isPayslipRunLocked(ps.id);
                                                                            return (
                                                                                <Button variant="ghost" size="icon" className={`h-7 w-7 ${psRunLocked ? "text-violet-600" : "text-muted-foreground/40 cursor-not-allowed"}`} title={psRunLocked ? "Publish" : "Lock the payroll run first"} disabled={!psRunLocked} onClick={() => {
                                                                                    if (!psRunLocked) return;
                                                                                    publishPayslip(ps.id);
                                                                                    useAuditStore.getState().log({ entityType: "payslip", entityId: ps.id, action: "payroll_published", performedBy: currentUser.id });
                                                                                    dispatchNotification("payslip_published", { name: getEmpName(ps.employeeId), period: `${ps.periodStart} — ${ps.periodEnd}`, amount: formatCurrency(ps.netPay) }, ps.employeeId);
                                                                                    toast.success("Published");
                                                                                }}>{psRunLocked ? <Send className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}</Button>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground">Page {safePage} of {totalPages}</p>
                                            <div className="flex gap-1">
                                                <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} className="h-8 text-xs">Previous</Button>
                                                <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} className="h-8 text-xs">Next</Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* ═══ STEP: Publish ═══ */}
                            {wizardStep === "publish" && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold flex items-center gap-2"><Send className="h-4 w-4 text-muted-foreground" /> Publish Payslips</h3>
                                    <p className="text-xs text-muted-foreground">Publish draft payslips in locked runs to make them visible to employees for signing.</p>
                                    {/* Status cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {([
                                            { key: "draft", label: "Draft", color: "text-amber-600 dark:text-amber-400" },
                                            { key: "published", label: "Published", color: "text-violet-600 dark:text-violet-400" },
                                            { key: "signed", label: "Signed", color: "text-emerald-600 dark:text-emerald-400" },
                                            { key: "paid", label: "Paid", color: "text-blue-600 dark:text-blue-400" },
                                        ] as const).map(({ key, label, color }) => (
                                            <Card key={key} className="border border-border/50">
                                                <CardContent className="p-3 text-center">
                                                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">{label}</p>
                                                    <p className={`text-xl font-bold mt-0.5 ${color}`}>{statusCounts[key] ?? 0}</p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                    {/* Batch Publish */}
                                    {canIssue && (
                                        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 border border-border/50 rounded-lg">
                                            <AlertDialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="outline" size="sm" className="h-8 text-xs gap-1.5 text-violet-600 border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                                                        disabled={batchProcessing || filteredPayslips.filter((p) => p.status === "draft" && isPayslipRunLocked(p.id)).length === 0}
                                                    >
                                                        <Send className="h-3.5 w-3.5" />
                                                        Publish All Draft ({filteredPayslips.filter((p) => p.status === "draft" && isPayslipRunLocked(p.id)).length})
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Publish {statusCounts.draft} Draft Payslip{statusCounts.draft !== 1 ? "s" : ""}?</AlertDialogTitle>
                                                        <AlertDialogDescription asChild>
                                                            <div className="space-y-2 text-sm">
                                                                <p>This will publish all draft payslips in locked runs and notify employees.</p>
                                                                <p className="text-muted-foreground text-xs">Employees will be able to view their payslips after publishing.</p>
                                                            </div>
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleBatchPublish}>Publish All</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    )}
                                    {/* Employee payslip list */}
                                    <Card className="border border-border/50">
                                        <CardContent className="p-0">
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader><TableRow>
                                                        <TableHead className="text-xs">Employee</TableHead>
                                                        <TableHead className="text-xs">Period</TableHead>
                                                        <TableHead className="text-xs">Net Pay</TableHead>
                                                        <TableHead className="text-xs">Status</TableHead>
                                                        <TableHead className="text-xs w-24"></TableHead>
                                                    </TableRow></TableHeader>
                                                    <TableBody>
                                                        {filteredPayslips.length === 0 ? (
                                                            <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No payslips issued yet</TableCell></TableRow>
                                                        ) : paginatedPublishPayslips.map((ps) => (
                                                            <TableRow key={ps.id}>
                                                                <TableCell className="text-sm font-medium">{getEmpName(ps.employeeId)}</TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">{ps.periodStart} – {ps.periodEnd}</TableCell>
                                                                <TableCell className="text-sm font-medium">₱{ps.netPay.toLocaleString()}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="secondary" className={`text-[10px] ${ps.status === "payment_hold" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : ps.status === "published" ? "bg-violet-500/15 text-violet-700 dark:text-violet-400" : ps.status === "draft" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : ps.status === "signed" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-blue-500/15 text-blue-700 dark:text-blue-400"}`}>{ps.status === "payment_hold" ? "On Hold" : ps.status}</Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {canIssue && ps.status === "draft" && isPayslipRunLocked(ps.id) ? (
                                                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-violet-600 gap-1" onClick={() => {
                                                                            publishPayslip(ps.id);
                                                                            useAuditStore.getState().log({ entityType: "payslip", entityId: ps.id, action: "payroll_published", performedBy: currentUser.id });
                                                                            dispatchNotification("payslip_published", { name: getEmpName(ps.employeeId), period: `${ps.periodStart} — ${ps.periodEnd}`, amount: formatCurrency(ps.netPay) }, ps.employeeId);
                                                                            toast.success("Published");
                                                                        }}><Send className="h-3 w-3" /> Publish</Button>
                                                                    ) : ps.status === "published" ? (
                                                                        <span className="text-[10px] text-violet-500 font-medium">✓ Published</span>
                                                                    ) : ps.status === "signed" || ps.status === "paid" || ps.status === "payment_hold" ? (
                                                                        <span className="text-[10px] text-emerald-500 font-medium">✓ {ps.status}</span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-muted-foreground">Run not locked</span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    {publishTotalPages > 1 && (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground">Page {publishSafePage} of {publishTotalPages}</p>
                                            <div className="flex gap-1">
                                                <Button variant="outline" size="sm" disabled={publishSafePage <= 1} onClick={() => setPublishPage((p) => p - 1)} className="h-8 text-xs">Previous</Button>
                                                <Button variant="outline" size="sm" disabled={publishSafePage >= publishTotalPages} onClick={() => setPublishPage((p) => p + 1)} className="h-8 text-xs">Next</Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ═══ STEP: E-Sign ═══ */}
                            {wizardStep === "sign" && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold flex items-center gap-2"><PenTool className="h-4 w-4 text-muted-foreground" /> Employee E-Sign</h3>
                                    <p className="text-xs text-muted-foreground">Waiting for employees to review and electronically sign their published payslips.</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Card className="border border-border/50">
                                            <CardContent className="p-3 text-center">
                                                <p className="text-[10px] uppercase font-semibold text-muted-foreground">Awaiting Signature</p>
                                                <p className="text-xl font-bold mt-0.5 text-violet-600 dark:text-violet-400">{statusCounts.publishedUnsigned ?? 0}</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="border border-border/50">
                                            <CardContent className="p-3 text-center">
                                                <p className="text-[10px] uppercase font-semibold text-muted-foreground">Signed</p>
                                                <p className="text-xl font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">{statusCounts.signed ?? 0}</p>
                                            </CardContent>
                                        </Card>
                                    </div>
                                    {/* Employee signing list */}
                                    <Card className="border border-border/50">
                                        <CardContent className="p-0">
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader><TableRow>
                                                        <TableHead className="text-xs">Employee</TableHead>
                                                        <TableHead className="text-xs">Period</TableHead>
                                                        <TableHead className="text-xs">Net Pay</TableHead>
                                                        <TableHead className="text-xs">Signing Status</TableHead>
                                                    </TableRow></TableHeader>
                                                    <TableBody>
                                                        {signPayslips.length === 0 ? (
                                                            <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No payslips awaiting signature</TableCell></TableRow>
                                                        ) : paginatedSignPayslips.map((ps) => (
                                                            <TableRow key={ps.id}>
                                                                <TableCell className="text-sm font-medium">{getEmpName(ps.employeeId)}</TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">{ps.periodStart} – {ps.periodEnd}</TableCell>
                                                                <TableCell className="text-sm font-medium">₱{ps.netPay.toLocaleString()}</TableCell>
                                                                <TableCell>
                                                                    {ps.status === "signed" ? (
                                                                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                                                            <PenTool className="h-3 w-3" />
                                                                            <span className="text-[10px] font-semibold">Signed</span>
                                                                            {ps.signedAt && <span className="text-[9px] text-muted-foreground ml-1">{new Date(ps.signedAt).toLocaleDateString()}</span>}
                                                                        </span>
                                                                    ) : ps.status === "payment_hold" ? (
                                                                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                                                            <AlertCircle className="h-3 w-3" />
                                                                            <span className="text-[10px] font-semibold">On Hold</span>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                                                                            <FileSignature className="h-3 w-3 animate-pulse" />
                                                                            <span className="text-[10px] font-semibold">Awaiting Signature</span>
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    {signTotalPages > 1 && (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-muted-foreground">Page {signSafePage} of {signTotalPages}</p>
                                            <div className="flex gap-1">
                                                <Button variant="outline" size="sm" disabled={signSafePage <= 1} onClick={() => setSignPage((p) => p - 1)} className="h-8 text-xs">Previous</Button>
                                                <Button variant="outline" size="sm" disabled={signSafePage >= signTotalPages} onClick={() => setSignPage((p) => p + 1)} className="h-8 text-xs">Next</Button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="rounded-lg bg-muted/30 border border-border/50 p-3">
                                        <p className="text-xs text-muted-foreground text-center">
                                            Employees sign payslips from their portal. Once all are signed, proceed to <strong>Record Payment</strong>.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ═══ STEP: Record Payment ═══ */}
                            {wizardStep === "pay" && canIssue && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground" /> Record Payment</h3>
                                    <p className="text-xs text-muted-foreground">Pay signed employees. Hold only unsigned employees so they do not block the rest of the run.</p>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <Card className="border border-border/50">
                                            <CardContent className="p-3 text-center">
                                                <p className="text-[10px] uppercase font-semibold text-muted-foreground">Awaiting Signature</p>
                                                <p className="text-xl font-bold mt-0.5 text-violet-600 dark:text-violet-400">{statusCounts.publishedUnsigned ?? 0}</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="border border-border/50">
                                            <CardContent className="p-3 text-center">
                                                <p className="text-[10px] uppercase font-semibold text-muted-foreground">Signed</p>
                                                <p className="text-xl font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">{statusCounts.signed ?? 0}</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="border border-border/50">
                                            <CardContent className="p-3 text-center">
                                                <p className="text-[10px] uppercase font-semibold text-muted-foreground">Paid</p>
                                                <p className="text-xl font-bold mt-0.5 text-blue-600 dark:text-blue-400">{statusCounts.paid ?? 0}</p>
                                            </CardContent>
                                        </Card>
                                        <Card className="border border-border/50">
                                            <CardContent className="p-3 text-center">
                                                <p className="text-[10px] uppercase font-semibold text-muted-foreground">On Hold</p>
                                                <p className="text-xl font-bold mt-0.5 text-amber-600 dark:text-amber-400">{statusCounts.onHold ?? 0}</p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <PayslipTable
                                        payslips={activeRunPayslips}
                                        runs={runs}
                                        getEmpName={getEmpName}
                                        isAdmin={canIssue}
                                        onMarkPaid={(id, method, reference, cashAmount, paymentProofUrl) => {
                                            confirmPaidByFinance(id, currentUser.name, method, reference, cashAmount, paymentProofUrl);
                                            const ps = payslips.find(p => p.id === id);
                                            if (ps) dispatchNotification("payment_confirmed", { name: getEmpName(ps.employeeId), period: `${ps.periodStart} — ${ps.periodEnd}`, method }, ps.employeeId);
                                            toast.success("Payment confirmed");
                                        }}
                                        onReissue={(id) => setReissueConfirmId(id)}
                                    />

                                </div>
                            )}

                            {/* ═══ Approve & Pay dialog for on-hold payslips (triggered from sidebar on-hold modal) ═══ */}
                            {(() => {
                                const holdApprovePs = holdApprovePsId ? payslips.find((p) => p.id === holdApprovePsId) : null;
                                return (
                                    <Dialog open={!!holdApprovePsId} onOpenChange={() => resetHoldPaymentDialog()}>
                                        <DialogContent className="sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <CreditCard className="h-4 w-4" />
                                                    Approve & Record Payment
                                                </DialogTitle>
                                            </DialogHeader>
                                            {holdApprovePs && (
                                                <div className="space-y-1 mb-2">
                                                    <p className="text-sm font-semibold">{getEmpName(holdApprovePs.employeeId)}</p>
                                                    <p className="text-xs text-muted-foreground">{holdApprovePs.periodStart} – {holdApprovePs.periodEnd} • Net: ₱{holdApprovePs.netPay.toLocaleString()}</p>
                                                </div>
                                            )}
                                            <div className="space-y-4">
                                                <div>
                                                    <Label className="text-xs font-medium text-muted-foreground">Payment Method</Label>
                                                    <Select value={holdPayMethod} onValueChange={(v) => setHoldPayMethod(v as typeof holdPayMethod)}>
                                                        <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                                            <SelectItem value="gcash">GCash</SelectItem>
                                                            <SelectItem value="cash">Cash</SelectItem>
                                                            <SelectItem value="check">Check</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {holdPayMethod === "bank_transfer" && (
                                                    <div>
                                                        <Label className="text-xs font-medium text-muted-foreground">Bank Reference Number</Label>
                                                        <Input value={holdPayRef} onChange={(e) => setHoldPayRef(e.target.value)} placeholder="e.g. BPI-202401150001" className="mt-1 h-9" />
                                                    </div>
                                                )}
                                                {holdPayMethod === "gcash" && (
                                                    <div>
                                                        <Label className="text-xs font-medium text-muted-foreground">GCash Reference ID</Label>
                                                        <Input value={holdPayRef} onChange={(e) => setHoldPayRef(e.target.value)} placeholder="e.g. 1234567890123" className="mt-1 h-9" />
                                                    </div>
                                                )}
                                                {holdPayMethod === "check" && (
                                                    <div>
                                                        <Label className="text-xs font-medium text-muted-foreground">Check Number</Label>
                                                        <Input value={holdPayRef} onChange={(e) => setHoldPayRef(e.target.value)} placeholder="e.g. CHK-00012345" className="mt-1 h-9" />
                                                    </div>
                                                )}
                                                {holdPayMethod === "cash" && (
                                                    <div>
                                                        <Label className="text-xs font-medium text-muted-foreground">
                                                            Cash Amount <span className="text-muted-foreground/60">(defaults to net pay: {formatCurrency(holdApprovePs?.netPay ?? 0)})</span>
                                                        </Label>
                                                        <Input type="number" value={holdCashAmount ?? ""} onChange={(e) => setHoldCashAmount(e.target.value ? Number(e.target.value) : undefined)} placeholder={`${holdApprovePs?.netPay ?? 0}`} className="mt-1 h-9" />
                                                    </div>
                                                )}
                                                <div>
                                                    <Label className="text-xs font-medium text-muted-foreground">
                                                        Proof of Payment <span className="text-muted-foreground/60">(optional)</span>
                                                    </Label>
                                                    <div className="mt-1">
                                                        {holdProofPreview ? (
                                                            <div className="relative border rounded-md overflow-hidden">
                                                                <img src={holdProofPreview} alt="Payment proof preview" className="w-full h-32 object-cover" />
                                                                <Button variant="destructive" size="sm" className="absolute top-2 right-2 h-7 text-xs" onClick={() => { setHoldProofFile(null); setHoldProofPreview(null); }}>
                                                                    Remove
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                                                                <div className="flex flex-col items-center justify-center pt-2 pb-3">
                                                                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                                                                    <p className="text-xs text-muted-foreground">Click to upload image</p>
                                                                    <p className="text-[11px] text-muted-foreground/70">JPG, PNG, GIF, or WebP up to 5MB</p>
                                                                </div>
                                                                <input type="file" className="hidden" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (!file) return;
                                                                    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) { toast.error("Unsupported image type."); e.target.value = ""; return; }
                                                                    if (file.size > 5 * 1024 * 1024) { toast.error("Image too large. Max 5MB."); e.target.value = ""; return; }
                                                                    setHoldProofFile(file);
                                                                    const reader = new FileReader();
                                                                    reader.onloadend = () => setHoldProofPreview(reader.result as string);
                                                                    reader.readAsDataURL(file);
                                                                }} />
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 justify-end pt-2">
                                                    <Button variant="outline" size="sm" onClick={() => resetHoldPaymentDialog()} disabled={holdIsUploading}>Cancel</Button>
                                                    <Button size="sm" className="gap-1.5" disabled={holdIsUploading} onClick={async () => {
                                                        if (!holdApprovePsId) return;
                                                        if (holdPayMethod !== "cash" && !holdPayRef.trim()) {
                                                            toast.error(holdPayMethod === "bank_transfer" ? "Enter bank reference" : holdPayMethod === "gcash" ? "Enter GCash reference" : "Enter check number");
                                                            return;
                                                        }
                                                        let proofUrl: string | undefined;
                                                        if (holdProofFile) {
                                                            setHoldIsUploading(true);
                                                            try {
                                                                const formData = new FormData();
                                                                formData.append("file", holdProofFile);
                                                                formData.append("bucket", "payment-proofs");
                                                                formData.append("folder", holdApprovePsId);
                                                                const response = await fetch("/api/upload", { method: "POST", body: formData });
                                                                if (response.ok) { const data = await response.json(); proofUrl = data.url; }
                                                                else { toast.error("Failed to upload proof"); setHoldIsUploading(false); return; }
                                                            } catch { toast.error("Failed to upload proof"); setHoldIsUploading(false); return; }
                                                            setHoldIsUploading(false);
                                                        }
                                                        const finalCash = holdPayMethod === "cash" ? (holdCashAmount ?? holdApprovePs?.netPay) : undefined;
                                                        confirmPaidByFinance(holdApprovePsId, currentUser.name, holdPayMethod, holdPayRef, finalCash, proofUrl);
                                                        const ps = payslips.find((p) => p.id === holdApprovePsId);
                                                        if (ps) dispatchNotification("payment_confirmed", { name: getEmpName(ps.employeeId), period: `${ps.periodStart} — ${ps.periodEnd}`, method: holdPayMethod }, ps.employeeId);
                                                        toast.success("Payment approved & recorded");
                                                        resetHoldPaymentDialog();
                                                    }}>
                                                        {holdIsUploading ? <>Uploading...</> : <><CheckCircle className="h-4 w-4" /> Confirm</>}
                                                    </Button>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                );
                            })()}

                            {/* Re-Issue Confirmation Dialog */}
                            <AlertDialog open={!!reissueConfirmId} onOpenChange={(open) => { if (!open) setReissueConfirmId(null); }}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Re-Issue Payslip?</AlertDialogTitle>
                                        <AlertDialogDescription asChild>
                                            <div className="space-y-2 text-sm">
                                                {(() => {
                                                    const ps = payslips.find((p) => p.id === reissueConfirmId);
                                                    if (!ps) return <p>Payslip not found.</p>;
                                                    return (
                                                        <>
                                                            <p>Re-issue this payslip to <strong>{getEmpName(ps.employeeId)}</strong>?</p>
                                                            <p className="text-xs text-muted-foreground">The payslip will be moved from hold back to published status, making it visible for the employee to sign again.</p>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => {
                                            if (!reissueConfirmId) return;
                                            const ps = payslips.find((p) => p.id === reissueConfirmId);
                                            releasePaymentHold(reissueConfirmId);
                                            if (ps) dispatchNotification("payslip_published", { name: getEmpName(ps.employeeId), period: `${ps.periodStart} — ${ps.periodEnd}`, amount: formatCurrency(ps.netPay) }, ps.employeeId);
                                            toast.success("Payslip re-issued");
                                            setReissueConfirmId(null);
                                        }}>Re-Issue</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* ═══ Payroll Runs — always visible so locked runs can be unlocked later ═══ */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold flex items-center gap-2"><Lock className="h-4 w-4 text-muted-foreground" /> Payroll Runs</h3>
                                <Card className="border border-border/50">
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader><TableRow>
                                                    <TableHead className="text-xs">Period</TableHead><TableHead className="text-xs">Payslips</TableHead>
                                                    <TableHead className="text-xs">Total Gross</TableHead><TableHead className="text-xs">Total Net</TableHead>
                                                    <TableHead className="text-xs">Status</TableHead>
                                                    {canIssue && <TableHead className="text-xs w-40">Actions</TableHead>}
                                                </TableRow></TableHeader>
                                                <TableBody>
                                                    {payrollRuns.length === 0 ? (
                                                        <TableRow><TableCell colSpan={canIssue ? 6 : 5} className="text-center text-sm text-muted-foreground py-8">No payroll runs</TableCell></TableRow>
                                                    ) : paginatedRuns.map((run) => {
                                                        const locked = isRunLocked(run.date);
                                                        const runObj = runs.find((r) => r.periodLabel === run.date);
                                                        const runStatus = runObj?.status ?? "draft";
                                                        // Format period label for display: "2026-05-01/2026-05-15" → "May 01 – May 15"
                                                        const [pStart, pEnd] = run.date.split("/");
                                                        const periodDisplay = pStart && pEnd
                                                            ? `${pStart} – ${pEnd}`
                                                            : run.date;
                                                        return (
                                                            <TableRow key={run.date}>
                                                                <TableCell className="text-sm">{periodDisplay}</TableCell>
                                                                <TableCell className="text-sm">
                                                                    {run.count}
                                                                    {run.draftCount > 0 && <span className="text-amber-500 text-[10px] ml-1">({run.draftCount} draft)</span>}
                                                                </TableCell>
                                                                <TableCell className="text-sm">₱{run.totalGross.toLocaleString()}</TableCell>
                                                                <TableCell className="text-sm font-medium">₱{run.totalNet.toLocaleString()}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="secondary" className={`text-[10px] ${runStatus === "completed" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                                                                        runStatus === "ended" ? "bg-orange-500/15 text-orange-700 dark:text-orange-400" :
                                                                        runStatus === "locked" ? "bg-red-500/15 text-red-700 dark:text-red-400" :
                                                                            runStatus === "published" ? "bg-violet-500/15 text-violet-700 dark:text-violet-400" :
                                                                                runStatus === "draft" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                                                                                    "bg-slate-500/15 text-slate-700 dark:text-slate-400"
                                                                        }`}>{locked && <Lock className="h-3 w-3 mr-1 inline" />}{runStatus}</Badge>
                                                                </TableCell>
                                                                {canIssue && (
                                                                    <TableCell>
                                                                        <div className="flex items-center gap-1">
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" title="Export bank file" onClick={() => exportBankFile(run.date, employees.map((e) => ({ id: e.id, name: e.name, salary: e.salary })))}><Download className="h-3.5 w-3.5" /></Button>
                                                                            {runObj && !locked && (
                                                                                <AlertDialog>
                                                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Lock"><Lock className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                                                                    <AlertDialogContent className="max-w-lg">
                                                                                        <AlertDialogHeader>
                                                                                            <AlertDialogTitle>Lock Payroll Run?</AlertDialogTitle>
                                                                                            <AlertDialogDescription>This will lock <strong>{periodDisplay}</strong>. Once locked, draft payslips can be published and employees can begin signing.</AlertDialogDescription>
                                                                                        </AlertDialogHeader>
                                                                                        {/* ── Readiness Checklist Gate ── */}
                                                                                        {runObj && (
                                                                                            <PayrollReadinessChecklist
                                                                                                runId={runObj.id}
                                                                                                periodLabel={runObj.periodLabel}
                                                                                                payslipIds={runObj.payslipIds ?? []}
                                                                                                onAllChecksPassed={(passed) => setChecklistPassedMap((prev) => ({ ...prev, [runObj.id]: passed }))}
                                                                                            />
                                                                                        )}
                                                                                        <AlertDialogFooter>
                                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                            <AlertDialogAction
                                                                                                disabled={!checklistPassedMap[runObj?.id ?? ""]}
                                                                                                className={!checklistPassedMap[runObj?.id ?? ""] ? "opacity-50 cursor-not-allowed" : ""}
                                                                                                onClick={() => {
                                                                                                    lockRun(run.date, currentUser.id);
                                                                                                    useAuditStore.getState().log({ entityType: "payroll_run", entityId: run.date, action: "payroll_locked", performedBy: currentUser.id });
                                                                                                    toast.success("Payroll run locked");
                                                                                                }}
                                                                                            >
                                                                                                Lock
                                                                                            </AlertDialogAction>
                                                                                        </AlertDialogFooter>
                                                                                    </AlertDialogContent>
                                                                                </AlertDialog>
                                                                            )}
                                                                            {locked && canLock && runStatus !== "completed" && (
                                                                                <AlertDialog>
                                                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500" title="Unlock for correction"><LockOpen className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                                                                    <AlertDialogContent>
                                                                                        <AlertDialogHeader>
                                                                                            <AlertDialogTitle>Unlock Payroll Run?</AlertDialogTitle>
                                                                                            <AlertDialogDescription>This will unlock <strong>{periodDisplay}</strong> for corrections. Published payslips remain published — only the run lock is removed. You must re-lock to finalize the period again.</AlertDialogDescription>
                                                                                        </AlertDialogHeader>
                                                                                        <AlertDialogFooter>
                                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                            <AlertDialogAction onClick={() => { unlockRun(run.date, currentUser.id); useAuditStore.getState().log({ entityType: "payroll_run", entityId: run.date, action: "payroll_locked", performedBy: currentUser.id }); toast.success("Run unlocked for corrections"); }}>Unlock</AlertDialogAction>
                                                                                        </AlertDialogFooter>
                                                                                    </AlertDialogContent>
                                                                                </AlertDialog>
                                                                            )}
                                                                            {locked && <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" title="Policy snapshot" onClick={() => setSnapshotRunDate(run.date)}><Shield className="h-3.5 w-3.5" /></Button>}
                                                                            {/* End Cycle — auto-hold unsigned, enters evaluation phase */}
                                                                            {locked && (runStatus === "locked" || runStatus === "published") && (() => {
                                                                                const rPs = payslips.filter((p) => (runObj?.payslipIds ?? []).includes(p.id));
                                                                                const signedUnpaid = rPs.filter((p) => p.status === "signed").length;
                                                                                const draftCount = rPs.filter((p) => p.status === "draft").length;
                                                                                const zeroDeductionCount = rPs.filter((p) =>
                                                                                    p.status === "draft" &&
                                                                                    (p.sssDeduction || 0) + (p.philhealthDeduction || 0) + (p.pagibigDeduction || 0) + (p.taxDeduction || 0) === 0
                                                                                ).length;
                                                                                const unsCount = rPs.filter((p) => p.status === "published" && !p.signedAt).length;
                                                                                const canEnd = signedUnpaid === 0 && draftCount === 0;
                                                                                const endTitle = canEnd
                                                                                    ? "End Cycle"
                                                                                    : signedUnpaid > 0
                                                                                        ? `${signedUnpaid} signed payslip${signedUnpaid !== 1 ? "s" : ""} not yet paid`
                                                                                        : `${draftCount} unpublished payslip${draftCount !== 1 ? "s" : ""}`;
                                                                                return (
                                                                                <AlertDialog>
                                                                                    <AlertDialogTrigger asChild>
                                                                                        <Button variant="ghost" size="icon" className={`h-7 w-7 ${canEnd ? "text-orange-500" : "text-muted-foreground/40 cursor-not-allowed"}`} title={endTitle} disabled={!canEnd}><Flag className="h-3.5 w-3.5" /></Button>
                                                                                    </AlertDialogTrigger>
                                                                                    <AlertDialogContent>
                                                                                        <AlertDialogHeader>
                                                                                            <AlertDialogTitle>End Payroll Cycle?</AlertDialogTitle>
                                                                                            <AlertDialogDescription asChild>
                                                                                                <div className="space-y-2 text-sm">
                                                                                                    <p>This will end the cycle for <strong>{periodDisplay}</strong>.</p>
                                                                                                    {draftCount > 0 && (
                                                                                                        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-amber-800 dark:text-amber-300">
                                                                                                            <p className="font-semibold mb-1">⚠ Draft payslips still exist</p>
                                                                                                            {zeroDeductionCount > 0 ? (
                                                                                                                <p><strong>{zeroDeductionCount}</strong> of the {draftCount} draft payslip{draftCount !== 1 ? "s" : ""} still have <strong>₱0 government deductions</strong> (SSS, PhilHealth, Pag-IBIG, BIR Tax).</p>
                                                                                                            ) : (
                                                                                                                <p><strong>{draftCount}</strong> draft payslip{draftCount !== 1 ? "s" : ""} are not yet published. Consider publishing before ending the cycle.</p>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {unsCount > 0 && (
                                                                                                        <p className="text-amber-600 dark:text-amber-400">
                                                                                                            ⚠ {unsCount} unsigned employee{unsCount !== 1 ? "s" : ""} will be automatically placed on hold.
                                                                                                        </p>
                                                                                                    )}
                                                                                                    <p className="text-xs text-muted-foreground">After ending, on-hold employees can still sign and be approved. The run can then be marked as complete.</p>
                                                                                                </div>
                                                                                            </AlertDialogDescription>
                                                                                        </AlertDialogHeader>
                                                                                        <AlertDialogFooter>
                                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                            <AlertDialogAction onClick={() => {
                                                                                                payslips
                                                                                                    .filter((p) => (runObj?.payslipIds ?? []).includes(p.id) && p.status === "published" && !p.signedAt)
                                                                                                    .forEach((p) => {
                                                                                                        holdPayment(p.id);
                                                                                                        dispatchNotification("payslip_on_hold", { name: getEmpName(p.employeeId), period: `${p.periodStart} - ${p.periodEnd}`, reason: "Late compliance to payroll submission. Please coordinate with the payroll team to resolve this issue." }, p.employeeId);
                                                                                                    });
                                                                                                endRun(run.date);
                                                                                                useAuditStore.getState().log({ entityType: "payroll_run", entityId: run.date, action: "payroll_ended", performedBy: currentUser.id });
                                                                                                toast.success("Payroll cycle ended");
                                                                                            }}>End Cycle</AlertDialogAction>
                                                                                        </AlertDialogFooter>
                                                                                    </AlertDialogContent>
                                                                                </AlertDialog>
                                                                                );
                                                                            })()}
                                                                            {/* Mark as Complete — final step, unlocks Run Payroll */}
                                                                            {locked && (runStatus === "ended") && (
                                                                                <AlertDialog>
                                                                                    <AlertDialogTrigger asChild>
                                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Mark as Complete"><CheckCircle className="h-3.5 w-3.5" /></Button>
                                                                                    </AlertDialogTrigger>
                                                                                    <AlertDialogContent>
                                                                                        <AlertDialogHeader>
                                                                                            <AlertDialogTitle>Complete Payroll Run?</AlertDialogTitle>
                                                                                            <AlertDialogDescription asChild>
                                                                                                <div className="space-y-2 text-sm">
                                                                                                    <p>This will finalize <strong>{periodDisplay}</strong> and mark it as complete.</p>
                                                                                                    {(() => {
                                                                                                        const rPs = payslips.filter((p) => (runObj?.payslipIds ?? []).includes(p.id));
                                                                                                        const holdCount = rPs.filter((p) => p.status === "payment_hold").length;
                                                                                                        return holdCount > 0 ? (
                                                                                                            <p className="text-amber-600 dark:text-amber-400">
                                                                                                                ⚠ {holdCount} employee{holdCount !== 1 ? "s" : ""} still on hold. They can be processed in the next payroll cycle.
                                                                                                            </p>
                                                                                                        ) : null;
                                                                                                    })()}
                                                                                                    <p className="text-xs text-muted-foreground">After completion, the &quot;Run Payroll&quot; button will unlock for the next cutoff period.</p>
                                                                                                </div>
                                                                                            </AlertDialogDescription>
                                                                                        </AlertDialogHeader>
                                                                                        <AlertDialogFooter>
                                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                            <AlertDialogAction onClick={() => {
                                                                                                markRunPaid(run.date);
                                                                                                useAuditStore.getState().log({ entityType: "payroll_run", entityId: run.date, action: "payroll_completed", performedBy: currentUser.id });
                                                                                                toast.success("Payroll run completed — Run Payroll unlocked");
                                                                                            }}>Complete Run</AlertDialogAction>
                                                                                        </AlertDialogFooter>
                                                                                    </AlertDialogContent>
                                                                                </AlertDialog>
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                )}
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                                {runsTotalPages > 1 && (
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">Page {runsSafePage} of {runsTotalPages}</p>
                                        <div className="flex gap-1">
                                            <Button variant="outline" size="sm" disabled={runsSafePage <= 1} onClick={() => setRunsPage((p) => p - 1)} className="h-8 text-xs">Previous</Button>
                                            <Button variant="outline" size="sm" disabled={runsSafePage >= runsTotalPages} onClick={() => setRunsPage((p) => p + 1)} className="h-8 text-xs">Next</Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* ── Right: Workflow Wizard Sidebar ── */}
                        <div className="pt-8 hidden lg:block w-64 shrink-0">
                            <div className="sticky top-4 space-y-3">
                                <Card className="border border-border/50">
                                    <CardContent className="py-3.5 px-3">
                                        <PayrollPaymentWizard activeStep={wizardStep} onStepClick={setWizardStep} />
                                    </CardContent>
                                </Card>
                                {/* Held Payslips — Compact Trigger Card + Modal */}
                                {(wizardStep !== "pay" || !activeRun) && (() => {
                                    const heldPs = payslips.filter((p) => p.status === "payment_hold");
                                    if (heldPs.length === 0) return null;
                                    const heldTotal = heldPs.reduce((s, p) => s + p.netPay, 0);
                                    return (
                                        <>
                                            <Card
                                                className="border border-amber-200 dark:border-amber-800/50 cursor-pointer hover:shadow-md transition-all"
                                                onClick={() => setHoldModalOpen(true)}
                                            >
                                                <CardContent className="py-2.5 px-3">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" /> On Hold ({heldPs.length})
                                                        </p>
                                                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">₱{heldTotal.toLocaleString()}</span>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            {/* On-Hold Management Modal */}
                                            <Dialog open={holdModalOpen} onOpenChange={(open) => {
                                                setHoldModalOpen(open);
                                                if (!open) {
                                                    setHoldSearchTerm("");
                                                    setHoldPage(1);
                                                }
                                            }}>
                                                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                                                    <DialogHeader>
                                                        <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                                            <AlertCircle className="h-5 w-5" /> On-Hold Payslips ({heldPs.length})
                                                        </DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
                                                            <span className="text-sm text-muted-foreground">Total held amount</span>
                                                            <span className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">₱{heldTotal.toLocaleString()}</span>
                                                        </div>
                                                        <div className="relative">
                                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                            <Input
                                                                placeholder="Search on-hold employee, ID, or period..."
                                                                value={holdSearchTerm}
                                                                onChange={(e) => { setHoldSearchTerm(e.target.value); setHoldPage(1); }}
                                                                className="pl-9 h-9"
                                                            />
                                                        </div>
                                                        {(() => {
                                                            const filteredHeld = holdSearchTerm.trim()
                                                                ? heldPs.filter((ps) => {
                                                                    const q = holdSearchTerm.toLowerCase();
                                                                    return getEmpName(ps.employeeId).toLowerCase().includes(q) ||
                                                                        ps.id.toLowerCase().includes(q) ||
                                                                        ps.periodStart.includes(q) ||
                                                                        ps.periodEnd.includes(q);
                                                                })
                                                                : heldPs;
                                                            const holdTotalPages = Math.max(1, Math.ceil(filteredHeld.length / pageSize));
                                                            const holdSafePage = Math.min(holdPage, holdTotalPages);
                                                            const paginatedHeld = filteredHeld.slice((holdSafePage - 1) * pageSize, holdSafePage * pageSize);
                                                            const unsignedHeld = paginatedHeld.filter((ps) => !ps.signedAt);
                                                            const signedHeld = paginatedHeld.filter((ps) => !!ps.signedAt);

                                                            return (
                                                                <>
                                                                    {filteredHeld.length === 0 ? (
                                                                        <p className="text-sm text-muted-foreground text-center py-6">No on-hold payslips match your search.</p>
                                                                    ) : (
                                                                        <div className="space-y-4">
                                                                            {unsignedHeld.length > 0 && (
                                                                                <div className="space-y-2">
                                                                                    <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Unsigned</p>
                                                                                    {unsignedHeld.map((ps) => {
                                                                                        const empName = getEmpName(ps.employeeId);
                                                                                        const noteKey = ps.id;
                                                                                        const currentNote = holdNotes[noteKey] ?? ps.holdNote ?? "Late compliance to payroll submission. Please coordinate with the payroll team to resolve this issue.";
                                                                                        return (
                                                                                            <div key={ps.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                                                                                                <div className="flex items-center justify-between">
                                                                                                    <div>
                                                                                                        <p className="text-sm font-semibold">{empName}</p>
                                                                                                        <p className="text-xs text-muted-foreground">{ps.periodStart} – {ps.periodEnd}</p>
                                                                                                    </div>
                                                                                                    <span className="text-sm font-bold tabular-nums">₱{ps.netPay.toLocaleString()}</span>
                                                                                                </div>
                                                                                                {ps.heldAt && <p className="text-[10px] text-muted-foreground">Held on {new Date(ps.heldAt).toLocaleDateString()}</p>}
                                                                                                <Textarea
                                                                                                    value={currentNote}
                                                                                                    onChange={(e) => setHoldNotes((prev) => ({ ...prev, [noteKey]: e.target.value }))}
                                                                                                    placeholder="Reason for hold..."
                                                                                                    className="text-xs min-h-[60px] resize-none"
                                                                                                />
                                                                                                <div className="flex items-center gap-2 justify-end">
                                                                                                    <Button
                                                                                                        variant="outline" size="sm" className="h-7 text-xs gap-1.5"
                                                                                                        onClick={() => {
                                                                                                            const note = holdNotes[noteKey] ?? currentNote;
                                                                                                            usePayrollStore.getState().updatePayslipFromServer({ id: ps.id, holdNote: note });
                                                                                                            toast.success(`Note saved for ${empName}`);
                                                                                                        }}
                                                                                                    >
                                                                                                        <Save className="h-3 w-3" /> Save Note
                                                                                                    </Button>
                                                                                                    <Button
                                                                                                        variant="outline"
                                                                                                        size="sm"
                                                                                                        className={`h-7 text-xs gap-1.5 ${hasActiveRun ? "text-emerald-600 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" : "text-muted-foreground/40 border-border/40 cursor-not-allowed"}`}
                                                                                                        title={hasActiveRun ? "Re-Issue" : "Start a payroll run to re-issue"}
                                                                                                        disabled={!hasActiveRun}
                                                                                                        onClick={() => {
                                                                                                            setHoldModalOpen(false);
                                                                                                            setReissueConfirmId(ps.id);
                                                                                                        }}
                                                                                                    >
                                                                                                        <RotateCcw className="h-3 w-3" /> Re-Issue
                                                                                                    </Button>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}

                                                                            {signedHeld.length > 0 && (
                                                                                <div className="space-y-2">
                                                                                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Signed</p>
                                                                                    {signedHeld.map((ps) => {
                                                                                        const empName = getEmpName(ps.employeeId);
                                                                                        return (
                                                                                            <div key={ps.id} className="rounded-lg border border-border/60 p-3 space-y-2">
                                                                                                <div className="flex items-center justify-between">
                                                                                                    <div>
                                                                                                        <p className="text-sm font-semibold">{empName}</p>
                                                                                                        <p className="text-xs text-muted-foreground">{ps.periodStart} – {ps.periodEnd}</p>
                                                                                                    </div>
                                                                                                    <div className="flex items-center gap-2">
                                                                                                        <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                                                                                            <CheckCircle className="h-3 w-3 mr-1" /> Signed
                                                                                                        </Badge>
                                                                                                        <span className="text-sm font-bold tabular-nums">₱{ps.netPay.toLocaleString()}</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                                {ps.heldAt && <p className="text-[10px] text-muted-foreground">Held on {new Date(ps.heldAt).toLocaleDateString()}</p>}
                                                                                                {ps.signedAt && <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Signed on {new Date(ps.signedAt).toLocaleDateString()}</p>}
                                                                                                {ps.holdNote && <p className="text-[11px] text-muted-foreground">Hold note: {ps.holdNote}</p>}
                                                                                                <div className="flex items-center gap-2 justify-end pt-1">
                                                                                                    <Button
                                                                                                        variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-red-600 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                                                                        onClick={() => {
                                                                                                            rejectHoldSignature(ps.id);
                                                                                                            toast.success(`Signature rejected for ${empName}. Employee must re-sign.`);
                                                                                                        }}
                                                                                                    >
                                                                                                        <XCircle className="h-3 w-3" /> Disapprove
                                                                                                    </Button>
                                                                                                    <Button
                                                                                                        size="sm" className="h-7 text-xs gap-1.5"
                                                                                                        onClick={() => {
                                                                                                            setHoldModalOpen(false);
                                                                                                            setHoldApprovePsId(ps.id);
                                                                                                        }}
                                                                                                    >
                                                                                                        <CheckCircle className="h-3 w-3" /> Approve & Pay
                                                                                                    </Button>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {holdTotalPages > 1 && (
                                                                        <div className="flex items-center justify-between">
                                                                            <p className="text-xs text-muted-foreground">Page {holdSafePage} of {holdTotalPages}</p>
                                                                            <div className="flex gap-1">
                                                                                <Button variant="outline" size="sm" disabled={holdSafePage <= 1} onClick={() => setHoldPage((p) => p - 1)} className="h-8 text-xs">Previous</Button>
                                                                                <Button variant="outline" size="sm" disabled={holdSafePage >= holdTotalPages} onClick={() => setHoldPage((p) => p + 1)} className="h-8 text-xs">Next</Button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Custom Deductions & Allowance Templates Tab */}
                {canIssue && (
                    <TabsContent value="deductions" className="mt-4">
                        <DeductionTemplatesSection />
                    </TabsContent>
                )}

                {/* Pay Schedule Settings Tab */}
                {canIssue && (
                    <TabsContent value="settings" className="mt-4">
                        <PayScheduleSettings schedule={paySchedule} onUpdate={updatePaySchedule} />
                    </TabsContent>
                )}

                {/* Tax & Signature Settings Tab */}
                {canIssue && (
                    <TabsContent value="tax-settings" className="mt-4 space-y-6">
                        {/* Authorized Signature Section */}
                        <Card className="border border-border/50">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <PenTool className="h-5 w-5 text-violet-500" />
                                        <h3 className="text-lg font-semibold">Authorized Signature</h3>
                                    </div>
                                    {!sigEditing ? (
                                        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSigEdit}>
                                            <Pencil className="h-3.5 w-3.5" /> Edit
                                        </Button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSigCancel} disabled={sigSaving}>
                                                <X className="h-3.5 w-3.5" /> Cancel
                                            </Button>
                                            <Button size="sm" className="gap-1.5" onClick={handleSigSave} disabled={sigSaving}>
                                                {sigSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                                                {sigSaving ? "Saving…" : "Save"}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Configure the authorized representative signature that appears on all printed payslips.
                                </p>

                                {/* Read-only summary when not editing */}
                                {!sigEditing && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Signature Mode</p>
                                                <p className="text-sm mt-0.5">{signatureConfig.mode === "auto" ? "Auto — Use saved signature" : "Manual — Blank (physical signature)"}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Signatory Name</p>
                                                <p className="text-sm mt-0.5">{signatureConfig.signatoryName || <span className="text-muted-foreground italic">Not set</span>}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Signatory Title</p>
                                                <p className="text-sm mt-0.5">{signatureConfig.signatoryTitle || <span className="text-muted-foreground italic">Not set</span>}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Signature Image</p>
                                            {signatureConfig.signatureDataUrl ? (
                                                <div className="border rounded-lg p-4 bg-white inline-block">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={signatureConfig.signatureDataUrl} alt="Authorized signature" className="h-16 object-contain" />
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground italic">No image uploaded</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Edit form */}
                                {sigEditing && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div>
                                                <Label className="text-sm font-medium">Signature Mode</Label>
                                                <Select value={sigDraft.mode} onValueChange={(v) => setSigDraft((d) => ({ ...d, mode: v as "auto" | "manual" }))}>
                                                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="auto">Auto — Use saved signature</SelectItem>
                                                        <SelectItem value="manual">Manual — Blank (physical signature)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {sigDraft.mode === "auto" ? "Saved signature will automatically appear on all payslips" : "Leave blank for physical signature"}
                                                </p>
                                            </div>
                                            <div>
                                                <Label className="text-sm font-medium">Signatory Name</Label>
                                                <Input
                                                    value={sigDraft.signatoryName}
                                                    onChange={(e) => setSigDraft((d) => ({ ...d, signatoryName: e.target.value }))}
                                                    placeholder="e.g. Juan Dela Cruz"
                                                    className="mt-1.5"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-sm font-medium">Signatory Title</Label>
                                                <Input
                                                    value={sigDraft.signatoryTitle}
                                                    onChange={(e) => setSigDraft((d) => ({ ...d, signatoryTitle: e.target.value }))}
                                                    placeholder="e.g. Finance Manager"
                                                    className="mt-1.5"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="text-sm font-medium">Signature Image</Label>
                                            {sigDraft.signatureDataUrl ? (
                                                <div className="border rounded-lg p-4 bg-white">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={sigDraft.signatureDataUrl} alt="Authorized signature" className="h-16 object-contain mx-auto" />
                                                    <div className="flex justify-center gap-2 mt-3">
                                                        <Button variant="outline" size="sm" onClick={() => setSigDraft((d) => ({ ...d, signatureDataUrl: undefined }))}>
                                                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                                                    <p className="text-sm text-muted-foreground mb-3">No signature image</p>
                                                    <input
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp"
                                                        className="hidden"
                                                        id="sig-upload"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            const reader = new FileReader();
                                                            reader.onload = (ev) => setSigDraft((d) => ({ ...d, signatureDataUrl: ev.target?.result as string }));
                                                            reader.readAsDataURL(file);
                                                        }}
                                                    />
                                                    <Button variant="outline" size="sm" onClick={() => document.getElementById("sig-upload")?.click()}>
                                                        Upload Signature Image
                                                    </Button>
                                                    <p className="text-xs text-muted-foreground mt-2">PNG, JPG or WebP. Recommended: transparent background.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Government Deduction Overrides Section — Philippine Standard */}
                        <Card className="border border-border/50">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-5 w-5 text-green-600" />
                                        <h3 className="text-lg font-semibold">Government Contribution Overrides</h3>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">
                                        {deductionOverrides.length} override{deductionOverrides.length !== 1 ? "s" : ""}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Configure custom SSS, PhilHealth, Pag-IBIG, and BIR withholding tax calculations per employee.
                                    Use for minimum wage earners, senior citizens, PWDs, or special arrangements.
                                </p>

                                {/* Deductions Legend */}
                                <div className="flex flex-wrap gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-blue-500" />
                                        <span className="text-xs">SSS</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-green-500" />
                                        <span className="text-xs">PhilHealth</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-orange-500" />
                                        <span className="text-xs">Pag-IBIG</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-purple-500" />
                                        <span className="text-xs">BIR Tax</span>
                                    </div>
                                    <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                                        <Info className="h-3.5 w-3.5" />
                                        Auto = Standard PH calculation
                                    </div>
                                </div>

                                {/* ─── Global Defaults (Company-Wide) ─── */}
                                <div className="p-4 bg-gradient-to-r from-blue-50/70 via-green-50/70 to-purple-50/70 dark:from-blue-950/20 dark:via-green-950/20 dark:to-purple-950/20 border rounded-lg mb-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Shield className="h-4 w-4 text-blue-600" />
                                        <h4 className="text-sm font-semibold">Global Defaults (Company-Wide)</h4>
                                        <span className="text-[10px] text-muted-foreground">— Applied when no per-employee override is set</span>
                                    </div>
                                    {/* Standard PH Reference Info per deduction type */}
                                    {(() => {
                                        const META: Record<DeductionType, {
                                            law: string;
                                            rate: string;
                                            formula: string;
                                            min: string;
                                            max: string;
                                            brackets?: { label: string; rate: string }[];
                                            color: string;
                                            border: string;
                                            badge: string;
                                        }> = {
                                            sss: {
                                                law: "RA 11199 — SSS Act of 2018",
                                                rate: "4.5% Employee Share",
                                                formula: "4.5% of Monthly Salary Credit (MSC)",
                                                min: "₱180/mo (MSC ₱4,000)",
                                                max: "₱1,575/mo (MSC ₱35,000)",
                                                color: "border-blue-300 bg-blue-50/50 dark:bg-blue-950/30",
                                                border: "border-blue-200",
                                                badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                                            },
                                            philhealth: {
                                                law: "RA 11223 — UHC Act",
                                                rate: "2.5% Employee Share (5% total)",
                                                formula: "2.5% of basic monthly salary",
                                                min: "₱250/mo (salary ≤ ₱10,000)",
                                                max: "₱2,500/mo (salary ≥ ₱100,000)",
                                                color: "border-green-300 bg-green-50/50 dark:bg-green-950/30",
                                                border: "border-green-200",
                                                badge: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                                            },
                                            pagibig: {
                                                law: "RA 9679 — HDMF Law",
                                                rate: "2% Employee Share (capped)",
                                                formula: "2% of salary, max ₱100/month",
                                                min: "₱1/mo (salary ≤ ₱1,500 → 1%)",
                                                max: "₱100/mo (salary > ₱1,500)",
                                                color: "border-orange-300 bg-orange-50/50 dark:bg-orange-950/30",
                                                border: "border-orange-200",
                                                badge: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
                                            },
                                            bir: {
                                                law: "RA 10963 — TRAIN Law (2023+)",
                                                rate: "0% – 35% Progressive",
                                                formula: "Based on monthly taxable income",
                                                min: "₱0 (taxable income ≤ ₱20,833/mo)",
                                                max: "35% above ₱666,667/mo",
                                                brackets: [
                                                    { label: "≤ ₱20,833", rate: "Exempt" },
                                                    { label: "₱20,834–₱33,333", rate: "15%" },
                                                    { label: "₱33,334–₱66,667", rate: "20%" },
                                                    { label: "₱66,668–₱166,667", rate: "25%" },
                                                    { label: "₱166,668–₱666,667", rate: "30%" },
                                                    { label: "> ₱666,667", rate: "35%" },
                                                ],
                                                color: "border-purple-300 bg-purple-50/50 dark:bg-purple-950/30",
                                                border: "border-purple-200",
                                                badge: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
                                            },
                                        };
                                        const labelMap: Record<DeductionType, string> = {
                                            sss: "SSS", philhealth: "PhilHealth", pagibig: "Pag-IBIG", bir: "BIR Tax",
                                        };
                                        return (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                {(["sss", "philhealth", "pagibig", "bir"] as DeductionType[]).map((type) => {
                                                    const gd = getGlobalDefault(type);
                                                    const meta = META[type];
                                                    return (
                                                        <div key={type} className={`border rounded-lg p-3 ${meta.color}`}>
                                                            {/* Header: label + toggle */}
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div>
                                                                    <span className="text-xs font-bold">{labelMap[type]}</span>
                                                                    <p className="text-[9px] text-muted-foreground leading-tight">{meta.law}</p>
                                                                </div>
                                                                <label className="flex items-center gap-1 cursor-pointer shrink-0">
                                                                    <span className={`text-[9px] font-semibold ${gd?.enabled ? "text-green-600" : "text-red-500"}`}>{gd?.enabled ? "ON" : "OFF"}</span>
                                                                    <button
                                                                        onClick={() => updateGlobalDefault({ deductionType: type, enabled: !gd?.enabled, mode: gd?.mode ?? "auto" })}
                                                                        className={`relative w-9 h-5 rounded-full transition-colors ${gd?.enabled ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}`}
                                                                    >
                                                                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${gd?.enabled ? "left-4" : "left-0.5"}`} />
                                                                    </button>
                                                                </label>
                                                            </div>

                                                            {gd?.enabled && (
                                                                <div className="space-y-2">
                                                                    {/* Mode selector */}
                                                                    <Select
                                                                        value={gd?.mode ?? "auto"}
                                                                        onValueChange={(v: DeductionOverrideMode) => updateGlobalDefault({ deductionType: type, enabled: true, mode: v, percentage: v === "percentage" ? (gd?.percentage ?? 0) : undefined, fixedAmount: v === "fixed" ? (gd?.fixedAmount ?? 0) : undefined })}
                                                                    >
                                                                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="auto">Auto (Standard PH)</SelectItem>
                                                                            <SelectItem value="exempt">Exempt (₱0)</SelectItem>
                                                                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                                                                            <SelectItem value="fixed">Fixed Amount (₱)</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>

                                                                    {/* Custom inputs */}
                                                                    {gd?.mode === "percentage" && (
                                                                        <div className="flex items-center gap-1">
                                                                            <Input type="number" min={0} max={100} step={0.5} value={gd?.percentage ?? 0}
                                                                                onChange={(e) => updateGlobalDefault({ ...gd, percentage: parseFloat(e.target.value) || 0 })}
                                                                                className="h-6 text-[10px] w-16 px-1" />
                                                                            <span className="text-[10px] text-muted-foreground">% of gross</span>
                                                                        </div>
                                                                    )}
                                                                    {gd?.mode === "fixed" && (
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-[10px] text-muted-foreground">₱</span>
                                                                            <Input type="number" min={0} step={50} value={gd?.fixedAmount ?? 0}
                                                                                onChange={(e) => updateGlobalDefault({ ...gd, fixedAmount: parseFloat(e.target.value) || 0 })}
                                                                                className="h-6 text-[10px] w-20 px-1" />
                                                                            <span className="text-[10px] text-muted-foreground">/period</span>
                                                                        </div>
                                                                    )}

                                                                    {/* Standard PH reference — shown in auto mode */}
                                                                    {(!gd?.mode || gd.mode === "auto") && (
                                                                        <div className={`rounded p-2 border ${meta.border} bg-white/60 dark:bg-black/10 space-y-1`}>
                                                                            <div className="flex items-center gap-1 mb-1">
                                                                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${meta.badge}`}>{meta.rate}</span>
                                                                            </div>
                                                                            <p className="text-[9px] text-muted-foreground">{meta.formula}</p>
                                                                            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1">
                                                                                <div>
                                                                                    <p className="text-[8px] text-muted-foreground uppercase tracking-wide">Min</p>
                                                                                    <p className="text-[9px] font-medium">{meta.min}</p>
                                                                                </div>
                                                                                <div>
                                                                                    <p className="text-[8px] text-muted-foreground uppercase tracking-wide">Max</p>
                                                                                    <p className="text-[9px] font-medium">{meta.max}</p>
                                                                                </div>
                                                                            </div>
                                                                            {/* BIR Tax Brackets */}
                                                                            {meta.brackets && (
                                                                                <div className="mt-1.5 pt-1.5 border-t border-purple-200 dark:border-purple-800">
                                                                                    <p className="text-[8px] uppercase tracking-wide text-muted-foreground mb-1">Monthly Tax Brackets</p>
                                                                                    <div className="space-y-0.5">
                                                                                        {meta.brackets.map((b) => (
                                                                                            <div key={b.label} className="flex justify-between">
                                                                                                <span className="text-[8px] text-muted-foreground">{b.label}</span>
                                                                                                <span className={`text-[8px] font-semibold ${b.rate === "Exempt" ? "text-green-600" : "text-purple-700 dark:text-purple-300"}`}>{b.rate}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {gd?.mode === "exempt" && (
                                                                        <div className={`rounded p-2 border border-green-200 bg-green-50/60 dark:bg-green-950/20`}>
                                                                            <p className="text-[9px] text-green-700 dark:text-green-400 font-medium">All employees — ₱0 deduction</p>
                                                                            <p className="text-[9px] text-muted-foreground mt-0.5">Common for: MWE, senior citizens, PWDs, special payroll arrangements</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {!gd?.enabled && (
                                                                <div className="rounded p-2 border border-red-200 bg-red-50/60 dark:bg-red-950/20">
                                                                    <p className="text-[9px] text-red-600 dark:text-red-400 font-semibold">Disabled — ₱0 company-wide</p>
                                                                    <p className="text-[9px] text-muted-foreground mt-0.5">Toggle ON to re-enable standard deductions</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs w-[200px]">Employee</TableHead>
                                                <TableHead className="text-xs text-center w-[140px]">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <div className="w-2 h-2 rounded bg-blue-500" />
                                                        SSS
                                                    </div>
                                                </TableHead>
                                                <TableHead className="text-xs text-center w-[140px]">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <div className="w-2 h-2 rounded bg-green-500" />
                                                        PhilHealth
                                                    </div>
                                                </TableHead>
                                                <TableHead className="text-xs text-center w-[140px]">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <div className="w-2 h-2 rounded bg-orange-500" />
                                                        Pag-IBIG
                                                    </div>
                                                </TableHead>
                                                <TableHead className="text-xs text-center w-[140px]">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <div className="w-2 h-2 rounded bg-purple-500" />
                                                        BIR Tax
                                                    </div>
                                                </TableHead>
                                                <TableHead className="text-xs w-[60px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {employees.filter((e) => e.status === "active").map((emp) => {
                                                const empOverrides = getEmployeeOverrides(emp.id);
                                                const hasAnyOverride = empOverrides.length > 0;
                                                const phDed = computeAllPHDeductions(emp.salary);

                                                const renderDeductionCell = (type: DeductionType, autoValue: number, colorClass: string) => {
                                                    const override = getDeductionOverride(emp.id, type);
                                                    const mode = override?.mode ?? "auto";

                                                    return (
                                                        <TableCell className="p-1">
                                                            <div className="space-y-1">
                                                                <Select
                                                                    value={mode}
                                                                    onValueChange={(v: DeductionOverrideMode) => {
                                                                        if (v === "auto") {
                                                                            removeDeductionOverride(emp.id, type);
                                                                        } else {
                                                                            setDeductionOverride({
                                                                                employeeId: emp.id,
                                                                                deductionType: type,
                                                                                mode: v,
                                                                                percentage: v === "percentage" ? 0 : undefined,
                                                                                fixedAmount: v === "fixed" ? 0 : undefined,
                                                                                notes: override?.notes,
                                                                            });
                                                                        }
                                                                    }}
                                                                >
                                                                    <SelectTrigger className={`h-7 text-[10px] ${mode !== "auto" ? colorClass + " font-medium" : ""}`}>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="auto">Auto</SelectItem>
                                                                        <SelectItem value="exempt">Exempt</SelectItem>
                                                                        <SelectItem value="percentage">%</SelectItem>
                                                                        <SelectItem value="fixed">₱</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                {mode === "auto" && (
                                                                    <p className="text-[9px] text-muted-foreground text-center">{formatCurrency(autoValue)}</p>
                                                                )}
                                                                {mode === "exempt" && (
                                                                    <p className="text-[9px] text-green-600 font-medium text-center">₱0</p>
                                                                )}
                                                                {mode === "percentage" && (
                                                                    <div className="flex items-center gap-0.5">
                                                                        <Input
                                                                            type="number"
                                                                            min={0}
                                                                            max={100}
                                                                            step={0.5}
                                                                            value={override?.percentage ?? 0}
                                                                            onChange={(e) => setDeductionOverride({
                                                                                ...override!,
                                                                                percentage: parseFloat(e.target.value) || 0,
                                                                            })}
                                                                            className="h-6 text-[10px] w-14 px-1"
                                                                        />
                                                                        <span className="text-[9px] text-muted-foreground">%</span>
                                                                    </div>
                                                                )}
                                                                {mode === "fixed" && (
                                                                    <div className="flex items-center gap-0.5">
                                                                        <span className="text-[9px] text-muted-foreground">₱</span>
                                                                        <Input
                                                                            type="number"
                                                                            min={0}
                                                                            step={50}
                                                                            value={override?.fixedAmount ?? 0}
                                                                            onChange={(e) => setDeductionOverride({
                                                                                ...override!,
                                                                                fixedAmount: parseFloat(e.target.value) || 0,
                                                                            })}
                                                                            className="h-6 text-[10px] w-16 px-1"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    );
                                                };

                                                return (
                                                    <TableRow key={emp.id} className={hasAnyOverride ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                                                        <TableCell className="py-2">
                                                            <div>
                                                                <p className="text-sm font-medium">{emp.name}</p>
                                                                <p className="text-[10px] text-muted-foreground">{emp.department} • {formatCurrency(emp.salary)}/mo</p>
                                                            </div>
                                                        </TableCell>
                                                        {renderDeductionCell("sss", phDed.sss, "bg-blue-100 dark:bg-blue-950")}
                                                        {renderDeductionCell("philhealth", phDed.philHealth, "bg-green-100 dark:bg-green-950")}
                                                        {renderDeductionCell("pagibig", phDed.pagIBIG, "bg-orange-100 dark:bg-orange-950")}
                                                        {renderDeductionCell("bir", phDed.withholdingTax, "bg-purple-100 dark:bg-purple-950")}
                                                        <TableCell className="p-1">
                                                            {hasAnyOverride && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-6 w-6 text-red-500"
                                                                    onClick={() => clearEmployeeOverrides(emp.id)}
                                                                    title="Clear all overrides"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Quick Override Presets */}
                                <div className="mt-4 p-3 bg-muted/30 border rounded-lg">
                                    <p className="text-xs font-medium mb-2">Quick Presets (Philippine HR Standard)</p>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-green-100" onClick={() => {
                                            const mwe = employees.filter(e => e.status === "active" && e.salary <= 35235); // 2026 NCR MWE threshold
                                            mwe.forEach(emp => {
                                                setDeductionOverride({ employeeId: emp.id, deductionType: "bir", mode: "exempt", notes: "Minimum wage earner" });
                                            });
                                            toast.success(`Applied BIR exempt to ${mwe.length} minimum wage earners`);
                                        }}>
                                            MWE: Exempt BIR
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-blue-100" onClick={() => {
                                            employees.filter(e => e.status === "active").forEach(emp => {
                                                ["sss", "philhealth", "pagibig", "bir"].forEach(type => {
                                                    removeDeductionOverride(emp.id, type as DeductionType);
                                                });
                                            });
                                            toast.success("Reset all employees to auto");
                                        }}>
                                            Reset All to Auto
                                        </Badge>
                                    </div>
                                </div>

                                {/* Info Box */}
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <div className="flex gap-2">
                                        <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                                            <p><strong>Auto:</strong> Uses standard Philippine calculation (SSS table, PhilHealth 5%, Pag-IBIG ₱100, BIR TRAIN Law)</p>
                                            <p><strong>Exempt:</strong> Sets contribution to ₱0 (e.g., MWE for BIR, senior citizens)</p>
                                            <p><strong>Percentage:</strong> Custom % of gross salary (e.g., voluntary higher Pag-IBIG)</p>
                                            <p><strong>Fixed:</strong> Exact ₱ amount per pay period (e.g., fixed withholding agreement)</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* Government Reports Tab */}
                {canIssue && (
                    <TabsContent value="gov-reports" className="mt-4">
                        <GovernmentReports
                            payslips={payslips}
                            getEmpName={getEmpName}
                            selectedPeriod={govPeriod}
                            onPeriodChange={setGovPeriod}
                            availablePeriods={last12Months}
                        />
                    </TabsContent>
                )}
            </Tabs>

            {/* Printable Payslip Dialog */}
            {(() => {
                const printPS = printPayslipId ? payslips.find((p) => p.id === printPayslipId) : null;
                const printEmp = printPS ? employees.find((e) => e.id === printPS.employeeId) : null;
                return printPS ? (
                    <PrintablePayslip
                        payslip={printPS}
                        employeeName={printEmp?.name || printPS.employeeId}
                        department={printEmp?.department || ""}
                        authorizedSignature={signatureConfig}
                        open={!!printPayslipId}
                        onClose={() => setPrintPayslipId(null)}
                    />
                ) : null;
            })()}

            {/* Policy Snapshot Dialog */}
            {(() => {
                const snapRun = snapshotRunDate ? runs.find((r) => r.periodLabel === snapshotRunDate) : null;
                const snap = snapRun?.policySnapshot;
                return (
                    <Dialog open={!!snapshotRunDate} onOpenChange={() => setSnapshotRunDate(null)}>
                        <DialogContent className="max-w-sm">
                            <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-blue-500" /> Policy Snapshot</DialogTitle></DialogHeader>
                            {snap ? (
                                <div className="space-y-3 pt-2">
                                    <p className="text-xs text-muted-foreground">Captured at lock time for <strong>{snapshotRunDate}</strong>.</p>
                                    <div className="rounded-md border border-border/50 divide-y divide-border/50 text-xs font-mono">
                                        {([["Tax Table", snap.taxTableVersion], ["SSS Schedule", snap.sssVersion], ["PhilHealth", snap.philhealthVersion], ["Pag-IBIG", snap.pagibigVersion], ["Holiday List", snap.holidayListVersion], ["Formula", snap.formulaVersion], ["Rule Set", snap.ruleSetVersion], ["Locked By", snap.lockedBy]] as [string, string][]).map(([k, v]) => (
                                            <div key={k} className="flex justify-between px-3 py-1.5"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>
                                        ))}
                                    </div>
                                </div>
                            ) : <p className="text-sm text-muted-foreground pt-2">No snapshot recorded.</p>}
                        </DialogContent>
                    </Dialog>
                );
            })()}

            {/* Payslip Detail Dialog */}
            <Dialog open={!!viewSlip} onOpenChange={() => setViewSlip(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Payslip Detail</DialogTitle></DialogHeader>
                    {viewedPayslip && (
                        <div className="space-y-4 pt-2">
                            <Card className="border border-border/50">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">{getEmpName(viewedPayslip.employeeId)}</p>
                                            <p className="text-xs text-muted-foreground">{viewedPayslip.periodStart} – {viewedPayslip.periodEnd}</p>
                                            {viewedPayslip.payFrequency && <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{viewedPayslip.payFrequency.replace("_", "-")} payroll</p>}
                                        </div>
                                        <Badge variant="secondary" className={`text-[10px] ${viewedPayslip.status === "signed" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                                            viewedPayslip.status === "published" || viewedPayslip.status === "payment_hold" ? "bg-violet-500/15 text-violet-700 dark:text-violet-400" :
                                                viewedPayslip.status === "draft" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" :
                                                    "bg-slate-500/15 text-slate-700 dark:text-slate-400"
                                            }`}>{viewedPayslip.status === "payment_hold" ? "published" : viewedPayslip.status}</Badge>
                                    </div>
                                    {/* Earnings */}
                                    <div className="border-t border-border/50 pt-3 space-y-1.5">
                                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">Earnings</p>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Gross Pay</span><span>₱{(viewedPayslip.grossPay || 0).toLocaleString()}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Allowances</span><span>+₱{(viewedPayslip.allowances || 0).toLocaleString()}</span></div>
                                        {(viewedPayslip.holidayPay ?? 0) !== 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><Sparkles className="h-3 w-3" /> Holiday Pay</span>
                                                <span className={(viewedPayslip.holidayPay ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}>{(viewedPayslip.holidayPay ?? 0) > 0 ? "+" : ""}₱{(viewedPayslip.holidayPay ?? 0).toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                    {/* Deductions */}
                                    <div className="border-t border-border/50 pt-3 space-y-1.5">
                                        <p className="text-[10px] font-semibold uppercase text-red-500">Deductions</p>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">SSS</span><span className="text-red-500">−₱{(viewedPayslip.sssDeduction || 0).toLocaleString()}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">PhilHealth</span><span className="text-red-500">−₱{(viewedPayslip.philhealthDeduction || 0).toLocaleString()}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Pag-IBIG</span><span className="text-red-500">−₱{(viewedPayslip.pagibigDeduction || 0).toLocaleString()}</span></div>
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Tax</span><span className="text-red-500">−₱{(viewedPayslip.taxDeduction || 0).toLocaleString()}</span></div>
                                        {(viewedPayslip.otherDeductions || 0) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Other</span><span className="text-red-500">−₱{viewedPayslip.otherDeductions.toLocaleString()}</span></div>}
                                        {(viewedPayslip.loanDeduction || 0) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Loan</span><span className="text-red-500">−₱{viewedPayslip.loanDeduction.toLocaleString()}</span></div>}
                                    </div>
                                    {/* Net */}
                                    <div className="border-t-2 border-border pt-3">
                                        <div className="flex justify-between items-center"><span className="font-medium">Net Pay</span><span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">₱{viewedPayslip.netPay.toLocaleString()}</span></div>
                                    </div>
                                    {/* Signature */}
                                    {viewedPayslip.signedAt && (
                                        <div className="border-t border-border/50 pt-3 space-y-2">
                                            <p className="text-[10px] font-semibold uppercase text-emerald-600">Employee Acceptance</p>
                                            <div className="border border-border/50 rounded-md bg-white p-2">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={viewedPayslip.signatureDataUrl} alt="Signature" className="h-12 object-contain" />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-500" />Accepted {new Date(viewedPayslip.signedAt).toLocaleString()}</p>
                                        </div>
                                    )}
                                    {!viewedPayslip.signedAt && (
                                        <div className="border-t border-border/50 pt-3">
                                            <div className="p-3 bg-muted/30 rounded-md text-center"><p className="text-xs text-muted-foreground italic">Waiting for employee acknowledgement</p></div>
                                        </div>
                                    )}
                                    {/* Meta */}
                                    <div className="border-t border-border/50 pt-2 space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground"><span>Issued</span><span>{viewedPayslip.issuedAt}</span></div>
                                        {viewedPayslip.confirmedAt && <div className="flex justify-between text-xs text-muted-foreground"><span>Confirmed</span><span>{new Date(viewedPayslip.confirmedAt).toLocaleDateString()}</span></div>}
                                        {viewedPayslip.publishedAt && <div className="flex justify-between text-xs text-muted-foreground"><span>Published</span><span>{new Date(viewedPayslip.publishedAt).toLocaleDateString()}</span></div>}
                                        {viewedPayslip.paidAt && <div className="flex justify-between text-xs text-muted-foreground"><span>Paid</span><span>{new Date(viewedPayslip.paidAt).toLocaleDateString()}</span></div>}
                                        {viewedPayslip.paymentMethod && <div className="flex justify-between text-xs text-muted-foreground"><span>Method</span><span className="capitalize">{viewedPayslip.paymentMethod.replace("_", " ")}</span></div>}
                                        {viewedPayslip.bankReferenceId && <div className="flex justify-between text-xs text-muted-foreground"><span>Ref</span><span className="font-mono">{viewedPayslip.bankReferenceId}</span></div>}
                                        {viewedPayslip.paidConfirmedBy && <div className="flex justify-between text-xs text-muted-foreground"><span>Confirmed By</span><span>{viewedPayslip.paidConfirmedBy}</span></div>}
                                        {viewedPayslip.acknowledgedAt && <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400"><span>Acknowledged</span><span>{new Date(viewedPayslip.acknowledgedAt).toLocaleString()}</span></div>}
                                        {viewedPayslip.adjustmentRef && <div className="flex justify-between text-xs text-muted-foreground"><span>Adjustment</span><span className="font-mono">{viewedPayslip.adjustmentRef}</span></div>}
                                        {viewedPayslip.notes && <div className="pt-1"><p className="text-xs text-muted-foreground">Notes: {viewedPayslip.notes}</p></div>}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* 13th Month Modal */}
            <ThirteenthMonthModal
                open={thirteenthMonthOpen}
                onOpenChange={setThirteenthMonthOpen}
                employees={employees}
                departments={departments}
                projects={projects}
                onGenerate={handle13thMonthGenerate}
            />
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   DEDUCTION TEMPLATES SECTION COMPONENT
   Manages custom deduction/allowance templates in-line
   ═══════════════════════════════════════════════════════════════ */

// Available roles from database CHECK constraint
const AVAILABLE_ROLES = ["admin", "hr", "finance", "employee", "supervisor", "payroll_admin", "auditor"] as const;

// Special value for "None" selection in dropdowns
const NONE_VALUE = "__none__";

function DeductionTemplatesSection() {
    const { templates, assignments, isLoading, error, fetchTemplates, fetchAssignments, addTemplate, updateTemplate, deleteTemplate, assignToEmployee, unassignFromEmployee, bulkAssignToEmployees } = useDeductionsStore();
    const employees = useEmployeesStore((s) => s.employees);
    const departments = useDepartmentsStore((s) => s.departments);
    const projects = useProjectsStore((s) => s.projects);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Assign dialog state
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [assigningTemplateId, setAssigningTemplateId] = useState<string | null>(null);
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [assignSearch, setAssignSearch] = useState("");
    const [assignLoading, setAssignLoading] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [type, setType] = useState<DeductionTemplateType>("deduction");
    const [calcMode, setCalcMode] = useState<DeductionCalculationMode>("fixed");
    const [value, setValue] = useState("");
    const [appliesToAll, setAppliesToAll] = useState(false);
    const [condDepartment, setCondDepartment] = useState("");
    const [condRole, setCondRole] = useState("");
    const [condProject, setCondProject] = useState("");
    const [condMinSalary, setCondMinSalary] = useState("");
    const [condMaxSalary, setCondMaxSalary] = useState("");

    // Filter only active items for dropdowns
    const activeDepartments = useMemo(() => departments.filter(d => d.isActive), [departments]);
    const activeProjects = useMemo(() => projects.filter(p => p.status === "active"), [projects]);
    const activeEmployees = useMemo(() => employees.filter(e => e.status === "active"), [employees]);

    useEffect(() => { fetchTemplates(); fetchAssignments(); }, [fetchTemplates, fetchAssignments]);

    // Get assignments count for a template
    const getAssignmentCount = useCallback((templateId: string) => {
        return assignments.filter(a => a.templateId === templateId && a.isActive).length;
    }, [assignments]);

    // Get assigned employee IDs for a template
    const getAssignedEmployeeIds = useCallback((templateId: string) => {
        return assignments.filter(a => a.templateId === templateId && a.isActive).map(a => a.employeeId);
    }, [assignments]);

    const resetForm = () => {
        setName(""); setType("deduction"); setCalcMode("fixed"); setValue("");
        setAppliesToAll(false); setCondDepartment(""); setCondRole(""); setCondProject(""); setCondMinSalary(""); setCondMaxSalary("");
        setEditingId(null);
        setSubmitting(false);
    };

    const openCreate = () => { resetForm(); setDialogOpen(true); };

    const openEdit = (t: DeductionTemplate) => {
        setEditingId(t.id);
        setName(t.name);
        setType(t.type);
        setCalcMode(t.calculationMode);
        setValue(String(t.value));
        setAppliesToAll(t.appliesToAll ?? false);
        setCondDepartment(t.conditions?.department?.toString() || "");
        setCondRole(t.conditions?.role?.toString() || "");
        setCondProject(t.conditions?.project?.toString() || "");
        setCondMinSalary(t.conditions?.minSalary !== undefined ? String(t.conditions.minSalary) : "");
        setCondMaxSalary(t.conditions?.maxSalary !== undefined ? String(t.conditions.maxSalary) : "");
        setDialogOpen(true);
    };

    const openAssignDialog = (templateId: string) => {
        setAssigningTemplateId(templateId);
        setSelectedEmployees(getAssignedEmployeeIds(templateId));
        setAssignSearch("");
        setAssignDialogOpen(true);
    };

    const handleAssignSubmit = async () => {
        if (!assigningTemplateId) return;
        setAssignLoading(true);
        try {
            const currentAssigned = getAssignedEmployeeIds(assigningTemplateId);
            const toAdd = selectedEmployees.filter(id => !currentAssigned.includes(id));
            const toRemove = currentAssigned.filter(id => !selectedEmployees.includes(id));

            // Remove unselected
            for (const empId of toRemove) {
                const assignment = assignments.find(a => a.templateId === assigningTemplateId && a.employeeId === empId && a.isActive);
                if (assignment) await unassignFromEmployee(assignment.id);
            }

            // Add newly selected
            if (toAdd.length > 0) {
                await bulkAssignToEmployees({ employeeIds: toAdd, templateId: assigningTemplateId });
            }

            toast.success(`Updated ${selectedEmployees.length} employee assignment${selectedEmployees.length !== 1 ? "s" : ""}`);
            setAssignDialogOpen(false);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to update assignments");
        } finally {
            setAssignLoading(false);
        }
    };

    const filteredAssignEmployees = useMemo(() => {
        if (!assignSearch) return activeEmployees;
        const q = assignSearch.toLowerCase();
        return activeEmployees.filter(e => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.department?.toLowerCase().includes(q));
    }, [activeEmployees, assignSearch]);

    const toggleEmployeeSelection = (empId: string) => {
        setSelectedEmployees(prev => prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]);
    };

    const handleSubmit = async () => {
        if (!name.trim()) { toast.error("Template name is required"); return; }
        if (!value) { toast.error("Value is required"); return; }
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) { toast.error("Value must be a non-negative number"); return; }
        if (calcMode === "percentage" && numValue > 100) { toast.error("Percentage cannot exceed 100%"); return; }

        if (condMinSalary && condMaxSalary) {
            const min = parseFloat(condMinSalary);
            const max = parseFloat(condMaxSalary);
            if (!isNaN(min) && !isNaN(max) && min > max) { toast.error("Min salary cannot be greater than max salary"); return; }
        }

        const conditions: Record<string, string | number> = {};
        if (condDepartment && condDepartment !== NONE_VALUE) conditions.department = condDepartment;
        if (condRole && condRole !== NONE_VALUE) conditions.role = condRole;
        if (condProject && condProject !== NONE_VALUE) conditions.project = condProject;
        if (condMinSalary) { const min = parseFloat(condMinSalary); if (!isNaN(min) && min > 0) conditions.minSalary = min; }
        if (condMaxSalary) { const max = parseFloat(condMaxSalary); if (!isNaN(max) && max > 0) conditions.maxSalary = max; }

        const data = { name: name.trim(), type, calculationMode: calcMode, value: numValue, conditions: Object.keys(conditions).length > 0 ? conditions : undefined, appliesToAll };

        setSubmitting(true);
        try {
            if (editingId) { await updateTemplate(editingId, data); toast.success("Template updated"); }
            else { await addTemplate(data); toast.success("Template created"); }
            setDialogOpen(false);
            resetForm();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "An error occurred");
        } finally { setSubmitting(false); }
    };

    const calcModeLabel: Record<DeductionCalculationMode, string> = { fixed: "Fixed Amount", percentage: "% of Salary", daily: "Per Day", hourly: "Per Hour" };
    const assigningTemplate = assigningTemplateId ? templates.find(t => t.id === assigningTemplateId) : null;

    return (
        <div className="space-y-4">
            {error && <Card className="border border-red-300 bg-red-50 dark:bg-red-950/20"><CardContent className="p-3 text-sm text-red-700 dark:text-red-300">{error}</CardContent></Card>}

            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium">Custom Deduction &amp; Allowance Templates</p>
                    <p className="text-xs text-muted-foreground">{templates.length} template{templates.length !== 1 ? "s" : ""} — applied during payslip issuance</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Add Template</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader><DialogTitle>{editingId ? "Edit Template" : "Create Deduction/Allowance Template"}</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-sm font-medium">Name</label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Uniform Deduction" className="mt-1" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Type</label>
                                    <Select value={type} onValueChange={(v) => setType(v as DeductionTemplateType)}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="deduction">Deduction (−)</SelectItem>
                                            <SelectItem value="allowance">Allowance (+)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Calculation Mode</label>
                                    <Select value={calcMode} onValueChange={(v) => setCalcMode(v as DeductionCalculationMode)}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                                            <SelectItem value="percentage">Percentage of Salary</SelectItem>
                                            <SelectItem value="daily">Per Day</SelectItem>
                                            <SelectItem value="hourly">Per Hour</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">
                                    Value {calcMode === "percentage" ? "(%)" : calcMode === "fixed" ? "(₱)" : calcMode === "daily" ? "(₱/day)" : "(₱/hr)"}
                                </label>
                                <Input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1" placeholder="0" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox checked={appliesToAll} onCheckedChange={(v) => setAppliesToAll(!!v)} id="appliesAll" />
                                <label htmlFor="appliesAll" className="text-sm">Applies to all employees by default</label>
                            </div>
                            <div className="border rounded-lg p-3 space-y-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Conditions (optional)</p>
                                <p className="text-[10px] text-muted-foreground -mt-2">Select one value per condition, or leave as &quot;None&quot;</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-muted-foreground">Department</label>
                                        <Select value={condDepartment || NONE_VALUE} onValueChange={(v) => setCondDepartment(v === NONE_VALUE ? "" : v)}>
                                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE_VALUE}>None</SelectItem>
                                                {activeDepartments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Role</label>
                                        <Select value={condRole || NONE_VALUE} onValueChange={(v) => setCondRole(v === NONE_VALUE ? "" : v)}>
                                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE_VALUE}>None</SelectItem>
                                                {AVAILABLE_ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Project</label>
                                        <Select value={condProject || NONE_VALUE} onValueChange={(v) => setCondProject(v === NONE_VALUE ? "" : v)}>
                                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE_VALUE}>None</SelectItem>
                                                {activeProjects.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Min Salary (₱)</label>
                                        <Input type="number" min="0" value={condMinSalary} onChange={(e) => setCondMinSalary(e.target.value)} className="mt-1 h-8 text-xs" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Max Salary (₱)</label>
                                        <Input type="number" min="0" value={condMaxSalary} onChange={(e) => setCondMaxSalary(e.target.value)} className="mt-1 h-8 text-xs" placeholder="0" />
                                    </div>
                                </div>
                            </div>
                            <Button onClick={handleSubmit} className="w-full" disabled={isLoading || submitting}>
                                {submitting ? "Saving..." : editingId ? "Update Template" : "Create Template"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader><TableRow>
                                <TableHead className="text-xs">Name</TableHead>
                                <TableHead className="text-xs">Type</TableHead>
                                <TableHead className="text-xs">Mode</TableHead>
                                <TableHead className="text-xs">Value</TableHead>
                                <TableHead className="text-xs">Assigned</TableHead>
                                <TableHead className="text-xs">Conditions</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs w-28"></TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {templates.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                                        {isLoading ? "Loading..." : "No templates yet. Create one to get started."}
                                    </TableCell></TableRow>
                                ) : templates.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="text-sm font-medium">{t.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={`text-[10px] ${t.type === "deduction" ? "bg-red-500/15 text-red-700 dark:text-red-400" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"}`}>
                                                {t.type === "deduction" ? "−" : "+"} {t.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs">{calcModeLabel[t.calculationMode]}</TableCell>
                                        <TableCell className="text-sm font-mono">{t.calculationMode === "percentage" ? `${t.value}%` : formatCurrency(t.value)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-muted" onClick={() => openAssignDialog(t.id)}>
                                                {t.appliesToAll ? "All" : `${getAssignmentCount(t.id)} emp`}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-[10px] text-muted-foreground max-w-[120px] truncate">
                                            {t.conditions ? Object.entries(t.conditions).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={`text-[10px] ${t.isActive ? "bg-emerald-500/15 text-emerald-700" : "bg-slate-500/15 text-slate-500"}`}>
                                                {t.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAssignDialog(t.id)} title="Assign Employees"><Users className="h-3.5 w-3.5" /></Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)} title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"><Trash2 className="h-3.5 w-3.5" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Delete &ldquo;{t.name}&rdquo;?</AlertDialogTitle>
                                                            <AlertDialogDescription>If employees are assigned this template, it will be marked inactive instead of deleted.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => { deleteTemplate(t.id); toast.success("Template deleted"); }} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Assign Employees Dialog */}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Assign Employees to &ldquo;{assigningTemplate?.name}&rdquo;</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search employees..." value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} className="pl-9" />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{selectedEmployees.length} selected</span>
                            <div className="flex gap-2">
                                <button type="button" className="text-primary hover:underline" onClick={() => setSelectedEmployees(activeEmployees.map(e => e.id))}>Select All</button>
                                <button type="button" className="text-muted-foreground hover:underline" onClick={() => setSelectedEmployees([])}>Clear</button>
                            </div>
                        </div>
                        <div className="border rounded-lg max-h-[300px] overflow-y-auto divide-y">
                            {filteredAssignEmployees.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">No employees found</p>
                            ) : filteredAssignEmployees.map((emp) => (
                                <label key={emp.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                                    <Checkbox checked={selectedEmployees.includes(emp.id)} onCheckedChange={() => toggleEmployeeSelection(emp.id)} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{emp.name}</p>
                                        <p className="text-[10px] text-muted-foreground">{emp.department} &bull; {emp.role}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <Button onClick={handleAssignSubmit} className="w-full" disabled={assignLoading}>
                            {assignLoading ? "Saving..." : `Save Assignments (${selectedEmployees.length})`}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
