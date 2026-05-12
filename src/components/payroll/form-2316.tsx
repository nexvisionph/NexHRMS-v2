"use client";

/**
 * Form 2316 Dialog
 * Lets payroll/finance/admin preview and print BIR Form 2316 for an employee+year.
 */

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText, AlertCircle, CheckCircle } from "lucide-react";
import {
    renderForm2316HTML,
    hashForm2316,
    type Form2316TemplateData,
} from "@/lib/form-2316-generator";

interface Form2316DialogProps {
    open: boolean;
    onClose: () => void;
    data: Form2316TemplateData | null;
    onAfterGenerate?: (hash: string) => void | Promise<void>;
}

export function Form2316Dialog({
    open,
    onClose,
    data,
    onAfterGenerate,
}: Form2316DialogProps) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastHash, setLastHash] = useState<string | null>(null);

    if (!data) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Form 2316</DialogTitle>
                        <DialogDescription>No data to render.</DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        );
    }

    const handlePrint = async () => {
        setBusy(true);
        setError(null);
        try {
            const html = renderForm2316HTML(data);
            const hash = await hashForm2316(html);
            setLastHash(hash);

            const win = window.open("", "_blank");
            if (!win) {
                setError("Pop-ups blocked. Allow pop-ups to print Form 2316.");
                return;
            }
            win.document.write(html);
            win.document.close();
            win.focus();
            // Slight delay so styles render in some browsers
            setTimeout(() => {
                try {
                    win.print();
                } catch (e) {
                    console.warn("print() failed:", e);
                }
            }, 250);

            if (onAfterGenerate) await onAfterGenerate(hash);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(`Failed to render Form 2316: ${msg}`);
        } finally {
            setBusy(false);
        }
    };

    const { summary, employee, profile } = data;
    const taxableTotal = summary.totalTaxableComp + summary.prevEmployerIncome;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        BIR Form 2316 — {employee.name} ({summary.year})
                    </DialogTitle>
                    <DialogDescription>
                        Certificate of Compensation Payment / Tax Withheld. Review the values
                        below, then click Print to open a print-ready window.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 text-red-700 text-sm">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {summary.status !== "finalized" && summary.status !== "exported" && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 text-amber-800 text-sm">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>
                            Annual summary is <b>{summary.status}</b>. Form 2316 should only be
                            printed once the summary is <b>finalized</b>.
                        </span>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                    <Field label="Employee TIN" value={profile.tin ?? "—"} />
                    <Field label="Tax Status" value={profile.taxStatus} />
                    <Field
                        label="Classification"
                        value={`${profile.employmentClassification}${profile.isMWE ? " (MWE)" : ""}`}
                    />
                    <Field
                        label="Substituted Filing"
                        value={profile.substitutedFiling ? "Yes" : "No"}
                    />
                </div>

                <div className="border-t pt-3">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">
                        Year-end summary
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <Money label="Taxable (this employer)" v={summary.totalTaxableComp} />
                        <Money label="Non-Taxable" v={summary.totalNonTaxableComp} />
                        <Money label="Prev Employer Income" v={summary.prevEmployerIncome} />
                        <Money label="Prev Employer Tax" v={summary.prevEmployerTax} />
                        <Money label="13th-Mo (Non-Tax)" v={summary.total13thNonTaxable} />
                        <Money label="13th-Mo (Taxable)" v={summary.total13thTaxable} />
                        <Money label="SSS / PHIC / HDMF" v={summary.totalSSS + summary.totalPhilHealth + summary.totalPagIBIG} />
                        <Money label="De Minimis" v={summary.totalDeMinimis} />
                        <Money label="Total Tax Withheld" v={summary.totalTaxWithheld} />
                        <Money label="Annual Tax Due" v={summary.annualTaxDue ?? 0} bold />
                    </div>
                    <div
                        className={`mt-3 p-3 rounded-md text-sm font-medium ${
                            summary.adjustmentType === "over_withheld"
                                ? "bg-emerald-50 text-emerald-800"
                                : summary.adjustmentType === "under_withheld"
                                  ? "bg-amber-50 text-amber-800"
                                  : "bg-slate-50 text-slate-800"
                        }`}
                    >
                        {summary.adjustmentType === "over_withheld"
                            ? "Refund due to employee: "
                            : summary.adjustmentType === "under_withheld"
                              ? "Tax still due / collectible: "
                              : "Balanced — no adjustment: "}
                        ₱
                        {(Math.abs(summary.adjustmentAmount ?? 0)).toLocaleString("en-PH", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        })}
                        <div className="text-xs font-normal mt-1">
                            (Annual taxable income for tax computation: ₱
                            {taxableTotal.toLocaleString("en-PH", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                            )
                        </div>
                    </div>
                </div>

                {lastHash && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-2">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                        <span>
                            Document hash (SHA-256): <code className="font-mono">{lastHash.slice(0, 16)}…</code>
                        </span>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button onClick={handlePrint} disabled={busy}>
                        <Printer className="h-4 w-4 mr-2" />
                        {busy ? "Preparing…" : "Print / Save PDF"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="font-medium">{value}</div>
        </div>
    );
}

function Money({ label, v, bold }: { label: string; v: number; bold?: boolean }) {
    return (
        <div className="flex justify-between border-b py-1">
            <span className="text-muted-foreground">{label}</span>
            <span className={bold ? "font-bold" : ""}>
                ₱{v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
        </div>
    );
}
