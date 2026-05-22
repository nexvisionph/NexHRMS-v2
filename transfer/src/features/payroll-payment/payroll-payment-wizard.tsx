"use client";

import { useMemo } from "react";
import { usePayrollStore } from "@/store/payroll.store";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle, Lock, Send, PenTool, CreditCard, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════
   PAYROLL WORKFLOW WIZARD — Vertical sidebar step tracker
   Issue → Lock → Publish → Sign → Record Payment
   ═══════════════════════════════════════════════════════════════ */

export type WizardStep = "issue" | "lock" | "publish" | "sign" | "pay";

export const WIZARD_STEPS: { key: WizardStep; label: string; icon: typeof Lock; description: string }[] = [
    { key: "issue",   label: "Issue Payslips",     icon: FileText,    description: "Generate payslips for the cutoff period" },
    { key: "lock",    label: "Lock Run",           icon: Lock,        description: "Freeze calculations and lock the run" },
    { key: "publish", label: "Publish",            icon: Send,        description: "Make payslips visible to employees" },
    { key: "sign",    label: "E-Sign",             icon: PenTool,     description: "Employees review and e-sign" },
    { key: "pay",     label: "Record Payment",     icon: CreditCard,  description: "Mark payslips as paid" },
];

interface PayrollPaymentWizardProps {
    activeStep: WizardStep;
    onStepClick: (step: WizardStep) => void;
}

/** Compute the furthest completed step based on run/payslip data */
export function usePayrollProgress() {
    const { payslips, runs } = usePayrollStore();

    return useMemo(() => {
        const activeRun = runs
            .filter((r) => r.status !== "completed")
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

        if (!activeRun) return "issue" as WizardStep;

        const runPs = payslips.filter((p) => activeRun.payslipIds?.includes(p.id));
        if (runPs.length === 0) return "issue" as WizardStep;

        if (!activeRun.locked && activeRun.status === "draft") return "lock" as WizardStep;

        const hasDrafts = runPs.some((p) => p.status === "draft");
        if (activeRun.locked && hasDrafts) return "publish" as WizardStep;

        const hasPaymentReady = runPs.some((p) => p.status === "signed" || p.status === "payment_hold" || p.status === "paid");
        if (!hasPaymentReady) return "sign" as WizardStep;

        return "pay" as WizardStep;
    }, [payslips, runs]);
}

/** Get summary counts for the active run */
export function useActiveRunSummary() {
    const { payslips, runs } = usePayrollStore();

    return useMemo(() => {
        const activeRun = runs
            .filter((r) => r.status !== "completed")
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

        if (!activeRun) return null;

        const runPs = payslips.filter((p) => activeRun.payslipIds?.includes(p.id));
        return {
            run: activeRun,
            total: runPs.length,
            draft: runPs.filter((p) => p.status === "draft").length,
            published: runPs.filter((p) => p.status === "published").length,
            onHold: runPs.filter((p) => p.status === "payment_hold").length,
            signed: runPs.filter((p) => p.status === "signed").length,
            paid: runPs.filter((p) => p.status === "paid").length,
            totalNet: runPs.reduce((sum, p) => sum + p.netPay, 0),
        };
    }, [payslips, runs]);
}

export default function PayrollPaymentWizard({ activeStep, onStepClick }: PayrollPaymentWizardProps) {
    const suggestedStep = usePayrollProgress();
    const summary = useActiveRunSummary();
    const suggestedIdx = WIZARD_STEPS.findIndex((s) => s.key === suggestedStep);
    const activeIdx = WIZARD_STEPS.findIndex((s) => s.key === activeStep);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="pb-3 border-b border-border/40">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">Payroll Workflow</p>
                {summary && (
                    <p className="text-xs text-muted-foreground mt-1 font-medium">{summary.run.periodLabel}</p>
                )}
            </div>

            {/* Steps */}
            <div className="relative">
                {/* Full connector rail */}
                <div className="absolute left-[17px] top-[18px] bottom-[18px] w-[2px] bg-border/60 rounded-full" />
                {/* Progress fill */}
                {suggestedIdx > 0 && (
                    <div
                        className="absolute left-[17px] top-[18px] w-[2px] bg-gradient-to-b from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ height: `${(suggestedIdx / (WIZARD_STEPS.length - 1)) * 100}%` }}
                    />
                )}

                <div className="relative space-y-1">
                    {WIZARD_STEPS.map((step, i) => {
                        const isDone = i < suggestedIdx;
                        const isCurrent = i === suggestedIdx;
                        const isActive = i === activeIdx;
                        const isFuture = i > suggestedIdx;
                        const StepIcon = step.icon;

                        return (
                            <button
                                key={step.key}
                                type="button"
                                onClick={() => { if (!isFuture) onStepClick(step.key); }}
                                disabled={isFuture}
                                className={cn(
                                    "w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left transition-all duration-200 group relative",
                                    isActive
                                        ? "bg-primary/8 shadow-sm ring-1 ring-primary/15"
                                        : isFuture
                                            ? "opacity-60 cursor-not-allowed"
                                            : "hover:bg-muted/60",
                                )}
                            >
                                {/* Step circle */}
                                <div className={cn(
                                    "relative z-10 flex items-center justify-center h-[34px] w-[34px] rounded-full shrink-0 transition-all duration-300 border-2",
                                    isDone
                                        ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/25"
                                        : isCurrent
                                            ? "bg-primary border-primary text-primary-foreground shadow-md shadow-primary/30 ring-4 ring-primary/10"
                                            : "bg-background border-border text-muted-foreground/50"
                                )}>
                                    {isDone ? (
                                        <CheckCircle className="h-4 w-4" />
                                    ) : (
                                        <StepIcon className={cn("h-4 w-4", isCurrent && "animate-pulse")} />
                                    )}
                                </div>

                                {/* Text */}
                                <div className="min-w-0 flex-1">
                                    <p className={cn(
                                        "text-[12px] font-semibold leading-tight transition-colors flex items-center gap-1.5",
                                        isDone ? "text-emerald-600 dark:text-emerald-400" :
                                        isCurrent ? "text-foreground" :
                                        isFuture ? "text-muted-foreground/50" : "text-muted-foreground"
                                    )}>
                                        {step.label}
                                        {isCurrent && (
                                            <Badge variant="secondary" className="text-[8px] h-3.5 px-1 bg-primary/15 text-primary font-bold tracking-wide animate-pulse leading-none">
                                                NOW
                                            </Badge>
                                        )}
                                    </p>
                                    <p className={cn(
                                        "text-[10px] leading-snug mt-0.5 transition-colors",
                                        isFuture ? "text-muted-foreground/30" : "text-muted-foreground/70"
                                    )}>
                                        {step.description}
                                    </p>
                                </div>

                                {isDone && (
                                    <span className="text-[9px] font-medium text-emerald-500/70 shrink-0">Done</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Summary stats */}
            {summary && (
                <div className="pt-3 border-t border-border/40 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Progress</p>
                    <div className="grid grid-cols-2 gap-1.5">
                        {[
                            { label: "Draft", count: summary.draft, color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
                            { label: "Published", count: summary.published, color: "bg-violet-500", textColor: "text-violet-600 dark:text-violet-400" },
                            { label: "Signed", count: summary.signed, color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400" },
                            { label: "Paid", count: summary.paid, color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
                            ...(summary.onHold > 0 ? [{ label: "On Hold", count: summary.onHold, color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" }] : []),
                        ].map(({ label, count, color, textColor }) => (
                            <div key={label} className="flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-1.5">
                                <div className={cn("h-2 w-2 rounded-full shrink-0", color)} />
                                <div className="flex items-center justify-between flex-1 min-w-0">
                                    <span className="text-[10px] text-muted-foreground truncate">{label}</span>
                                    <span className={cn("text-xs font-bold tabular-nums", textColor)}>{count}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Total bar */}
                    {summary.total > 0 && (
                        <div className="mt-2">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                <span>Overall completion</span>
                                <span className="font-medium">{Math.round((summary.paid / summary.total) * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
                                {summary.paid > 0 && <div className="bg-blue-500 transition-all duration-500" style={{ width: `${(summary.paid / summary.total) * 100}%` }} />}
                                {summary.signed > 0 && <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(summary.signed / summary.total) * 100}%` }} />}
                                {summary.published > 0 && <div className="bg-violet-500 transition-all duration-500" style={{ width: `${(summary.published / summary.total) * 100}%` }} />}
                                {summary.draft > 0 && <div className="bg-amber-500/40 transition-all duration-500" style={{ width: `${(summary.draft / summary.total) * 100}%` }} />}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
