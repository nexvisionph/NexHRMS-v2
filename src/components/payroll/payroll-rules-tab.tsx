"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Layers, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function PayrollRulesTab() {
    const params = useParams();
    const role = params.role as string;
    const isEditable = ["admin", "hr", "payroll_admin"].includes(role);

    const [complianceMode, setComplianceMode] = useState<"dole_standard" | "custom">("dole_standard");
    const [showWarningDialog, setShowWarningDialog] = useState(false);
    const [pendingMode, setPendingMode] = useState<"dole_standard" | "custom" | null>(null);

    // Custom configuration state
    const [customConfig, setCustomConfig] = useState({
        regularOt: "1.25",
        nightDiff: "1.10",
        restDay: "1.30",
        specialHoliday: "1.30",
        regularHoliday: "2.00",
        doubleSpecialHoliday: "1.50",
        doubleHoliday: "3.00",
        enableNightDiff: true,
        minOtMinutes: "60",
        otGracePeriod: "0",
        roundingRule: "none",
        requireOtReview: true,
        requireSupervisorReview: true,
        allowPartialApproval: true,
    });

    const handleSave = () => {
        const regOt = parseFloat(customConfig.regularOt);
        const nd = parseFloat(customConfig.nightDiff);
        const restDay = parseFloat(customConfig.restDay);
        const specHol = parseFloat(customConfig.specialHoliday);
        const regHol = parseFloat(customConfig.regularHoliday);
        const dbSpecHol = parseFloat(customConfig.doubleSpecialHoliday);
        const dbHol = parseFloat(customConfig.doubleHoliday);
        const minOt = parseInt(customConfig.minOtMinutes, 10);
        const grace = parseInt(customConfig.otGracePeriod, 10);

        if (isNaN(regOt) || regOt < 1.00) {
            toast.error("Regular OT Multiplier must be at least 1.00");
            return;
        }
        if (isNaN(nd) || nd < 1.00) {
            toast.error("Night Differential Multiplier must be at least 1.00");
            return;
        }
        if (isNaN(restDay) || restDay < 1.00) {
            toast.error("Rest Day Multiplier must be at least 1.00");
            return;
        }
        if (isNaN(specHol) || specHol < 1.00) {
            toast.error("Special Holiday Multiplier must be at least 1.00");
            return;
        }
        if (isNaN(regHol) || regHol < 1.00) {
            toast.error("Regular Holiday Multiplier must be at least 1.00");
            return;
        }
        if (isNaN(dbSpecHol) || dbSpecHol < 1.00) {
            toast.error("Double Special Holiday Multiplier must be at least 1.00");
            return;
        }
        if (isNaN(dbHol) || dbHol < 1.00) {
            toast.error("Double Holiday Multiplier must be at least 1.00");
            return;
        }
        if (isNaN(minOt) || minOt < 0) {
            toast.error("Minimum OT Minutes must be a non-negative number");
            return;
        }
        if (isNaN(grace) || grace < 0) {
            toast.error("OT Grace Period must be a non-negative number");
            return;
        }

        toast.success("Payroll rules saved successfully!");
    };

    const handleModeChange = (val: string) => {
        setPendingMode(val as "dole_standard" | "custom");
        setShowWarningDialog(true);
    };

    const handleConfirmModeSwitch = () => {
        if (pendingMode) {
            setComplianceMode(pendingMode);
        }
        setShowWarningDialog(false);
        setTimeout(() => setPendingMode(null), 300);
    };

    const handleCancelModeSwitch = () => {
        setShowWarningDialog(false);
        setTimeout(() => setPendingMode(null), 300);
    };

    return (
        <div className="space-y-6">
            {/* Tab Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-primary" />
                    <div>
                        <p className="text-sm font-semibold">Payroll Rules Configuration</p>
                        <p className="text-xs text-muted-foreground">Set compliance mode, overtime multipliers, and approval workflows</p>
                    </div>
                </div>
                {isEditable && complianceMode === "custom" && (
                    <Button onClick={handleSave} className="gap-2 shrink-0">
                        <Save className="h-4 w-4" /> Save Changes
                    </Button>
                )}
            </div>

            {/* Compliance Mode Selector Card */}
            <Card className="border border-border/50">
                <CardContent className="p-6 space-y-4">
                    <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Compliance Mode</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Define standard rules for holiday and overtime payroll calculations</p>
                    </div>

                    {!isEditable ? (
                        <div className="p-4 rounded-lg border border-border/50 bg-muted/20 space-y-1">
                            <p className="text-sm font-semibold">
                                {complianceMode === "dole_standard" ? "Philippine DOLE Standard" : "Custom Company Policy"}
                            </p>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {complianceMode === "dole_standard"
                                    ? "Enforces statutory Department of Labor and Employment (DOLE) multipliers and rules for overtime, holidays, and night differentials."
                                    : "Allows customizing multipliers, minimum overtime thresholds, grace periods, and custom review pipelines according to your company handbook."}
                            </p>
                        </div>
                    ) : (
                        <RadioGroup
                            value={complianceMode}
                            onValueChange={handleModeChange}
                            disabled={!isEditable}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2"
                        >
                            <div className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${complianceMode === "dole_standard" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"}`}>
                                <RadioGroupItem value="dole_standard" id="dole_standard" className="mt-1" />
                                <div className="space-y-1">
                                    <label htmlFor="dole_standard" className="text-sm font-semibold cursor-pointer">
                                        Philippine DOLE Standard
                                    </label>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Enforces statutory Department of Labor and Employment (DOLE) multipliers and rules for overtime, holidays, and night differentials.
                                    </p>
                                </div>
                            </div>

                            <div className={`flex items-start gap-3 p-4 rounded-lg border transition-all ${complianceMode === "custom" ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"}`}>
                                <RadioGroupItem value="custom" id="custom" className="mt-1" />
                                <div className="space-y-1">
                                    <label htmlFor="custom" className="text-sm font-semibold cursor-pointer">
                                        Custom Company Policy
                                    </label>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Allows customizing multipliers, minimum overtime thresholds, grace periods, and custom review pipelines according to your company handbook.
                                    </p>
                                </div>
                            </div>
                        </RadioGroup>
                    )}
                </CardContent>
            </Card>

            {complianceMode === "dole_standard" ? (
                /* DOLE Standard View */
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border border-border/50">
                            <CardContent className="p-6 space-y-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">DOLE Multipliers</p>
                                    <p className="text-xs text-muted-foreground mt-1">Statutory pay rate multipliers mandated by the Department of Labor and Employment (DOLE). These rates are applied automatically when computing overtime and night differential pay.</p>
                                </div>
                                <div className="space-y-4 pt-1">
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">Standard Multipliers</p>
                                        <div className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                                            <span className="text-muted-foreground">Regular OT Multiplier</span>
                                            <span className="font-semibold font-mono">1.25</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                                            <span className="text-muted-foreground">Night Differential Multiplier</span>
                                            <span className="font-semibold font-mono">1.10</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">Rest Day &amp; Holiday Multipliers</p>
                                        <div className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                                            <span className="text-muted-foreground">Rest Day Multiplier</span>
                                            <span className="font-semibold font-mono">1.30</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                                            <span className="text-muted-foreground">Special Holiday Multiplier</span>
                                            <span className="font-semibold font-mono">1.30</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                                            <span className="text-muted-foreground">Regular Holiday Multiplier</span>
                                            <span className="font-semibold font-mono">2.00</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                                            <span className="text-muted-foreground">Double Special Holiday Multiplier</span>
                                            <span className="font-semibold font-mono">1.50</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                                            <span className="text-muted-foreground">Double Holiday Multiplier</span>
                                            <span className="font-semibold font-mono">3.00</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-sm py-1">
                                        <span className="text-muted-foreground">Night Differential</span>
                                        <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 font-medium text-xs">Enabled</Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-border/50">
                            <CardContent className="p-6 space-y-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">DOLE OT &amp; Approval Rules</p>
                                    <p className="text-xs text-muted-foreground mt-1">Overtime eligibility thresholds and approval workflow settings prescribed by DOLE. These define the minimum OT duration, grace periods, and who must sign off before overtime is counted.</p>
                                </div>
                                <div className="space-y-3 pt-1">
                                    <div className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                                        <span className="text-muted-foreground">Minimum OT Minutes</span>
                                        <span className="font-semibold font-mono">60</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                                        <span className="text-muted-foreground">OT Grace Period (minutes)</span>
                                        <span className="font-semibold font-mono">0</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                                        <span className="text-muted-foreground">Rounding Rule</span>
                                        <span className="font-semibold">None</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                                        <span className="text-muted-foreground">Require OT Review</span>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Yes</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                                        <span className="text-muted-foreground">Require Supervisor Review</span>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Yes</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm py-1">
                                        <span className="text-muted-foreground">Allow Partial Approval</span>
                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">Yes</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex items-start gap-2.5 p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-700 dark:text-blue-400">
                        <Info className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>Values are set according to Philippine DOLE regulations and cannot be edited in this mode.</span>
                    </div>
                </div>
            ) : (
                /* Custom Company Policy Mode (Editable Form) */
                <div className="space-y-6">
                    {/* Info Panel for Custom Company Rules */}
                    <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                        <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="space-y-1">
                            <p className="font-semibold text-sm">Custom Company Policy Active</p>
                            <p className="leading-relaxed">
                                NexHRIS will compute payroll strictly according to your organization&apos;s custom rules configured below.
                                Please ensure that these rules are compliant with your company handbook and all relevant labor regulations.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border border-border/50">
                            <CardContent className="p-6 space-y-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Custom Multipliers</p>
                                    <p className="text-xs text-muted-foreground mt-1">Override the default DOLE rates with your own company-defined multipliers.</p>
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">Standard Multipliers</p>
                                        <div className="flex items-center justify-between gap-4">
                                            <label className="text-xs font-medium text-muted-foreground">Regular OT Multiplier</label>
                                            <Input
                                                type="number"
                                                min="1.00"
                                                step="0.01"
                                                value={customConfig.regularOt}
                                                onChange={(e) => setCustomConfig({ ...customConfig, regularOt: e.target.value })}
                                                disabled={!isEditable}
                                                className="w-28 text-right font-mono"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <label className="text-xs font-medium text-muted-foreground">Night Differential Multiplier</label>
                                            <Input
                                                type="number"
                                                min="1.00"
                                                step="0.01"
                                                value={customConfig.nightDiff}
                                                onChange={(e) => setCustomConfig({ ...customConfig, nightDiff: e.target.value })}
                                                disabled={!isEditable}
                                                className="w-28 text-right font-mono"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">Rest Day &amp; Holiday Multipliers</p>
                                        <div className="flex items-center justify-between gap-4">
                                            <label className="text-xs font-medium text-muted-foreground">Rest Day Multiplier</label>
                                            <Input
                                                type="number"
                                                min="1.00"
                                                step="0.01"
                                                value={customConfig.restDay}
                                                onChange={(e) => setCustomConfig({ ...customConfig, restDay: e.target.value })}
                                                disabled={!isEditable}
                                                className="w-28 text-right font-mono"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <label className="text-xs font-medium text-muted-foreground">Special Holiday Multiplier</label>
                                            <Input
                                                type="number"
                                                min="1.00"
                                                step="0.01"
                                                value={customConfig.specialHoliday}
                                                onChange={(e) => setCustomConfig({ ...customConfig, specialHoliday: e.target.value })}
                                                disabled={!isEditable}
                                                className="w-28 text-right font-mono"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <label className="text-xs font-medium text-muted-foreground">Regular Holiday Multiplier</label>
                                            <Input
                                                type="number"
                                                min="1.00"
                                                step="0.01"
                                                value={customConfig.regularHoliday}
                                                onChange={(e) => setCustomConfig({ ...customConfig, regularHoliday: e.target.value })}
                                                disabled={!isEditable}
                                                className="w-28 text-right font-mono"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <label className="text-xs font-medium text-muted-foreground">Double Special Holiday Multiplier</label>
                                            <Input
                                                type="number"
                                                min="1.00"
                                                step="0.01"
                                                value={customConfig.doubleSpecialHoliday}
                                                onChange={(e) => setCustomConfig({ ...customConfig, doubleSpecialHoliday: e.target.value })}
                                                disabled={!isEditable}
                                                className="w-28 text-right font-mono"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <label className="text-xs font-medium text-muted-foreground">Double Holiday Multiplier</label>
                                            <Input
                                                type="number"
                                                min="1.00"
                                                step="0.01"
                                                value={customConfig.doubleHoliday}
                                                onChange={(e) => setCustomConfig({ ...customConfig, doubleHoliday: e.target.value })}
                                                disabled={!isEditable}
                                                className="w-28 text-right font-mono"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="border border-border/50">
                                <CardContent className="p-6 space-y-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Night Differential</p>
                                        <p className="text-xs text-muted-foreground mt-1">Toggles the night shift premium for hours worked between 10 PM and 6 AM. When enabled, the night differential multiplier is applied on top of the employee&apos;s base hourly rate.</p>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <label className="text-xs font-semibold">Enable Night Differential</label>
                                            <p className="text-[10px] text-muted-foreground">Apply night shift premium multipliers</p>
                                        </div>
                                        <Switch
                                            checked={customConfig.enableNightDiff}
                                            onCheckedChange={(v) => setCustomConfig({ ...customConfig, enableNightDiff: v })}
                                            disabled={!isEditable}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border border-border/50">
                                <CardContent className="p-6 space-y-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">OT Policy</p>
                                        <p className="text-xs text-muted-foreground mt-1">Set the minimum number of minutes worked past regular hours before OT is credited, any grace period buffer, and how partial OT minutes are rounded.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 items-center gap-4">
                                            <label className="text-xs font-medium text-muted-foreground">Minimum OT Minutes</label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={customConfig.minOtMinutes}
                                                onChange={(e) => setCustomConfig({ ...customConfig, minOtMinutes: e.target.value })}
                                                disabled={!isEditable}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 items-center gap-4">
                                            <label className="text-xs font-medium text-muted-foreground">OT Grace Period (minutes)</label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={customConfig.otGracePeriod}
                                                onChange={(e) => setCustomConfig({ ...customConfig, otGracePeriod: e.target.value })}
                                                disabled={!isEditable}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 items-center gap-4">
                                            <label className="text-xs font-medium text-muted-foreground">Rounding Rule</label>
                                            <Select
                                                value={customConfig.roundingRule}
                                                onValueChange={(v) => setCustomConfig({ ...customConfig, roundingRule: v })}
                                                disabled={!isEditable}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    <SelectItem value="up">Round Up</SelectItem>
                                                    <SelectItem value="down">Round Down</SelectItem>
                                                    <SelectItem value="nearest">Round to Nearest</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="border border-border/50 md:col-span-2">
                            <CardContent className="p-6 space-y-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Approval Rules</p>
                                    <p className="text-xs text-muted-foreground mt-1">Define who must review and approve overtime requests before they are counted in payroll. Enabling multiple reviewers creates a chain of approvals; partial approval allows accepting a subset of the requested OT hours.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="flex items-center justify-between border-b md:border-b-0 md:border-r border-border/50 pb-4 md:pb-0 md:pr-6">
                                        <div className="space-y-0.5">
                                            <label className="text-xs font-semibold">Require OT Review</label>
                                            <p className="text-[10px] text-muted-foreground">Requires HR/Admin confirmation</p>
                                        </div>
                                        <Switch
                                            checked={customConfig.requireOtReview}
                                            onCheckedChange={(v) => setCustomConfig({ ...customConfig, requireOtReview: v })}
                                            disabled={!isEditable}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between border-b md:border-b-0 md:border-r border-border/50 pb-4 md:pb-0 md:pr-6">
                                        <div className="space-y-0.5">
                                            <label className="text-xs font-semibold">Require Supervisor Review</label>
                                            <p className="text-[10px] text-muted-foreground">Requires supervisor sign-off</p>
                                        </div>
                                        <Switch
                                            checked={customConfig.requireSupervisorReview}
                                            onCheckedChange={(v) => setCustomConfig({ ...customConfig, requireSupervisorReview: v })}
                                            disabled={!isEditable}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <label className="text-xs font-semibold">Allow Partial Approval</label>
                                            <p className="text-[10px] text-muted-foreground">Approve/reject subset of requested hours</p>
                                        </div>
                                        <Switch
                                            checked={customConfig.allowPartialApproval}
                                            onCheckedChange={(v) => setCustomConfig({ ...customConfig, allowPartialApproval: v })}
                                            disabled={!isEditable}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            <AlertDialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
                <AlertDialogContent className="max-w-md">
                    {pendingMode === "custom" ? (
                        <>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                                    <Info className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <AlertDialogTitle className="text-base">Switch to Custom Company Policy?</AlertDialogTitle>
                            </div>
                            <AlertDialogDescription asChild>
                                <div className="space-y-3 pt-1 text-sm">
                                    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3.5 text-amber-800 dark:text-amber-300 space-y-1.5">
                                        <p className="font-semibold text-xs uppercase tracking-wide">Legal Compliance Notice</p>
                                        <p className="text-xs leading-relaxed">
                                            Your organization becomes solely responsible for ensuring that your payroll configuration complies with all applicable Philippine labor laws and DOLE regulations.
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        NexHRIS will compute payroll strictly according to the custom rules you configure. Rates below the statutory minimums may expose your organization to legal risk.
                                    </p>
                                </div>
                            </AlertDialogDescription>
                            <AlertDialogFooter>
                                <Button variant="outline" onClick={handleCancelModeSwitch}>Cancel</Button>
                                <Button onClick={handleConfirmModeSwitch} className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90">I Understand, Proceed</Button>
                            </AlertDialogFooter>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 mb-1">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                                    <Info className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <AlertDialogTitle className="text-base">Revert to Philippine DOLE Standard?</AlertDialogTitle>
                            </div>
                            <AlertDialogDescription asChild>
                                <div className="space-y-3 pt-1 text-sm">
                                    <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3.5 text-amber-800 dark:text-amber-300 space-y-1.5">
                                        <p className="font-semibold text-xs uppercase tracking-wide">Revert Notice</p>
                                        <p className="text-xs leading-relaxed">
                                            This will revert all multipliers, overtime policies, and approval workflows back to statutory defaults. Any unsaved custom company policy configurations will be discarded.
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        NexHRIS will strictly enforce the default Department of Labor and Employment (DOLE) rules for calculations.
                                    </p>
                                </div>
                            </AlertDialogDescription>
                            <AlertDialogFooter>
                                <Button variant="outline" onClick={handleCancelModeSwitch}>Cancel</Button>
                                <Button onClick={handleConfirmModeSwitch} className="bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90">Yes, Revert to DOLE Standard</Button>
                            </AlertDialogFooter>
                        </>
                    )}
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}