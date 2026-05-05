"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useEmployeesStore } from "@/store/employees.store";
import {
    buildAttendanceRecords,
    buildComponentValues,
    buildPayrollEmployees,
    buildPayrollResults,
    defaultPayrollSchedule,
} from "../data/payrollMockData";
import type {
    PayrollComponentValue,
    PayrollReportType,
    PayrollResult,
    PayrollRun,
    PayrollSchedule,
    PayrollStepId,
} from "../types/payrollPayment.types";

const STORAGE_KEY = "nexhrms-payroll-payment-wizard";
const steps: { id: PayrollStepId; label: string }[] = [
    { id: "schedule", label: "Payroll Schedule" },
    { id: "head-count", label: "Head Count" },
    { id: "attendance", label: "Attendance Data" },
    { id: "payroll-data", label: "Employee Payroll Data" },
    { id: "process-result", label: "Process & Result" },
    { id: "report", label: "Report" },
];

type PersistedWizard = {
    activeStep: PayrollStepId;
    completedSteps: PayrollStepId[];
    schedule: PayrollSchedule;
    reportType: PayrollReportType;
};

export function usePayrollPaymentWizard() {
    const employees = useEmployeesStore((state) => state.employees);
    const payrollEmployees = useMemo(() => buildPayrollEmployees(employees), [employees]);
    const attendanceRecords = useMemo(() => buildAttendanceRecords(payrollEmployees), [payrollEmployees]);
    const initialComponents = useMemo(() => buildComponentValues(payrollEmployees), [payrollEmployees]);

    const [activeStep, setActiveStep] = useState<PayrollStepId>("schedule");
    const [completedSteps, setCompletedSteps] = useState<PayrollStepId[]>([]);
    const [schedule, setSchedule] = useState<PayrollSchedule>(defaultPayrollSchedule);
    const [componentValues, setComponentValues] = useState<PayrollComponentValue[]>(initialComponents);
    const [results, setResults] = useState<PayrollResult[]>([]);
    const [reportType, setReportType] = useState<PayrollReportType>("payroll-summary");
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [processingLabel, setProcessingLabel] = useState("Processing Formula");
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const persisted = JSON.parse(raw) as PersistedWizard;
            setActiveStep(persisted.activeStep || "schedule");
            setCompletedSteps(persisted.completedSteps || []);
            setSchedule(persisted.schedule || defaultPayrollSchedule);
            setReportType(persisted.reportType || "payroll-summary");
        } catch {
            window.localStorage.removeItem(STORAGE_KEY);
            setError("Saved payroll workflow state could not be restored.");
        }
    }, []);

    useEffect(() => {
        if (componentValues.length === 0 && initialComponents.length > 0) {
            setComponentValues(initialComponents);
        }
    }, [componentValues.length, initialComponents]);

    useEffect(() => {
        try {
            const payload: PersistedWizard = { activeStep, completedSteps, schedule, reportType };
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
            window.localStorage.removeItem(STORAGE_KEY);
            setError("Payroll workflow progress could not be saved because browser storage is full.");
        }
    }, [activeStep, completedSteps, schedule, reportType]);

    const activeIndex = steps.findIndex((step) => step.id === activeStep);

    const payrollRun: PayrollRun = useMemo(() => ({
        id: "RUN-DRAFT",
        title: `${schedule.paymentType || "Payroll"}: ${schedule.salaryStartDate || "Start"} to ${schedule.salaryEndDate || "End"}`,
        schedule,
        employees: payrollEmployees,
        attendanceRecords,
        componentValues,
        results,
        status: isProcessing ? "processing" : results.length > 0 ? "processed" : "draft",
        progress,
        reportType,
    }), [attendanceRecords, componentValues, isProcessing, payrollEmployees, progress, reportType, results, schedule]);

    const markComplete = useCallback((stepId: PayrollStepId) => {
        setCompletedSteps((current) => current.includes(stepId) ? current : [...current, stepId]);
    }, []);

    const validateStep = useCallback((stepId: PayrollStepId) => {
        setError(null);
        if (stepId === "schedule") {
            const required = [
                schedule.paymentType,
                schedule.payDate,
                schedule.taxReportDate,
                schedule.cutoffDate,
                schedule.salaryStartDate,
                schedule.salaryEndDate,
                schedule.attendanceStartDate,
                schedule.attendanceEndDate,
            ];
            if (required.some((value) => !value)) return "Complete the payroll schedule dates before continuing.";
            if (schedule.salaryStartDate > schedule.salaryEndDate) return "Salary start date must be before salary end date.";
            if (schedule.attendanceStartDate > schedule.attendanceEndDate) return "Attendance start date must be before attendance end date.";
        }
        if (stepId === "head-count" && payrollEmployees.length === 0) return "No employees are available for this payroll run.";
        if (stepId === "attendance" && attendanceRecords.length === 0) return "No attendance records are available.";
        if (stepId === "payroll-data" && componentValues.length === 0) return "No payroll component values are available.";
        if (stepId === "process-result" && results.length === 0) return "Run payroll processing before opening reports.";
        return null;
    }, [attendanceRecords.length, componentValues.length, payrollEmployees.length, results.length, schedule]);

    const goToStep = useCallback((stepId: PayrollStepId) => {
        const nextIndex = steps.findIndex((step) => step.id === stepId);
        if (nextIndex <= activeIndex || completedSteps.includes(steps[nextIndex - 1]?.id)) {
            setActiveStep(stepId);
        }
    }, [activeIndex, completedSteps]);

    const goNext = useCallback(() => {
        const validation = validateStep(activeStep);
        if (validation) {
            setError(validation);
            toast.error(validation);
            return false;
        }
        markComplete(activeStep);
        const next = steps[activeIndex + 1];
        if (next) setActiveStep(next.id);
        return true;
    }, [activeIndex, activeStep, markComplete, validateStep]);

    const goPrevious = useCallback(() => {
        const previous = steps[activeIndex - 1];
        if (previous) setActiveStep(previous.id);
    }, [activeIndex]);

    const updateSchedule = useCallback((patch: Partial<PayrollSchedule>) => {
        setSchedule((current) => ({ ...current, ...patch }));
    }, []);

    const updateScheduleFilter = useCallback((key: keyof PayrollSchedule["filters"], value: string) => {
        setSchedule((current) => ({ ...current, filters: { ...current.filters, [key]: value } }));
    }, []);

    const updateComponentValue = useCallback((id: string, key: keyof PayrollComponentValue, value: string | number) => {
        setComponentValues((current) =>
            current.map((item) => item.id === id ? { ...item, [key]: typeof value === "number" ? value : value } : item)
        );
    }, []);

    const startProcess = useCallback(() => {
        const validation = validateStep("payroll-data");
        if (validation) {
            setError(validation);
            toast.error(validation);
            return;
        }
        setActiveStep("process-result");
        markComplete("payroll-data");
        setIsProcessing(true);
        setProgress(0);
        setResults([]);
        setProcessingLabel("Processing Formula");
        intervalRef.current = setInterval(() => {
            setProgress((current) => {
                const next = Math.min(100, current + 10);
                if (next >= 66) setProcessingLabel("Processing Distribution");
                else if (next >= 34) setProcessingLabel("Processing Payroll");
                if (next === 100) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setIsProcessing(false);
                    setResults(buildPayrollResults(componentValues, payrollEmployees));
                    markComplete("process-result");
                    toast.success("Payroll processing completed");
                }
                return next;
            });
        }, 350);
    }, [componentValues, markComplete, payrollEmployees, validateStep]);

    const cancelProcess = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsProcessing(false);
        setProgress(0);
        setProcessingLabel("Processing cancelled");
        toast.success("Payroll process cancelled");
    }, []);

    const deleteResults = useCallback((ids: string[]) => {
        setResults((current) => current.filter((item) => !ids.includes(item.id)));
        toast.success(`${ids.length} payroll result${ids.length === 1 ? "" : "s"} deleted`);
    }, []);

    const reprocessSelected = useCallback((ids?: string[]) => {
        const recalculated = buildPayrollResults(componentValues, payrollEmployees);
        setResults((current) => {
            if (!ids?.length) return recalculated;
            const replacements = new Map(recalculated.map((item) => [item.id, item]));
            return current.map((item) => ids.includes(item.id) ? replacements.get(item.id) || item : item);
        });
        toast.success(ids?.length ? "Selected employees re-processed" : "All employees re-processed");
    }, [componentValues, payrollEmployees]);

    return {
        steps,
        activeStep,
        activeIndex,
        completedSteps,
        schedule,
        payrollEmployees,
        attendanceRecords,
        componentValues,
        results,
        payrollRun,
        reportType,
        isProcessing,
        progress,
        processingLabel,
        error,
        setReportType,
        setError,
        goToStep,
        goNext,
        goPrevious,
        markComplete,
        updateSchedule,
        updateScheduleFilter,
        updateComponentValue,
        startProcess,
        cancelProcess,
        deleteResults,
        reprocessSelected,
    };
}
