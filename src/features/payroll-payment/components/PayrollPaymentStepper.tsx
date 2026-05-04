import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PayrollStepId } from "../types/payrollPayment.types";

interface PayrollPaymentStepperProps {
    steps: { id: PayrollStepId; label: string }[];
    activeStep: PayrollStepId;
    completedSteps: PayrollStepId[];
    onStepClick: (step: PayrollStepId) => void;
}

export function PayrollPaymentStepper({ steps, activeStep, completedSteps, onStepClick }: PayrollPaymentStepperProps) {
    const activeIndex = steps.findIndex((step) => step.id === activeStep);

    return (
        <aside className="rounded-lg border border-border/50 bg-card p-3 lg:w-64 lg:shrink-0">
            <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
                {steps.map((step, index) => {
                    const complete = completedSteps.includes(step.id);
                    const disabled = index > activeIndex && !completedSteps.includes(steps[index - 1]?.id);
                    const active = step.id === activeStep;

                    return (
                        <Button
                            key={step.id}
                            type="button"
                            variant={active ? "default" : "ghost"}
                            className={`h-auto min-w-48 justify-start gap-3 px-3 py-3 lg:min-w-0 ${complete && !active ? "text-emerald-600 dark:text-emerald-400" : ""}`}
                            disabled={disabled}
                            onClick={() => onStepClick(step.id)}
                        >
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${active ? "border-primary-foreground/40" : complete ? "border-emerald-500 bg-emerald-500/10" : "border-border"}`}>
                                {complete ? <Check className="h-4 w-4" /> : disabled ? <Lock className="h-3.5 w-3.5" /> : index + 1}
                            </span>
                            <span className="text-left text-sm">{step.label}</span>
                        </Button>
                    );
                })}
            </div>
        </aside>
    );
}
