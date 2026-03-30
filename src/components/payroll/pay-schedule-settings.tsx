"use client";

import type { PayScheduleConfig } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Save, CalendarDays, Info } from "lucide-react";
import { toast } from "sonner";

interface PayScheduleSettingsProps {
    schedule: PayScheduleConfig;
    onUpdate: (patch: Partial<PayScheduleConfig>) => void;
}

export function PayScheduleSettings({ schedule, onUpdate }: PayScheduleSettingsProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <div>
                    <p className="text-sm font-semibold">Pay Schedule Configuration</p>
                    <p className="text-xs text-muted-foreground">Configure pay frequency, cutoff dates, and government deduction timing</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Default Frequency */}
                <Card className="border border-border/50">
                    <CardContent className="p-4 space-y-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Pay Frequency</p>
                        <Select
                            value={schedule.defaultFrequency}
                            onValueChange={(v) => onUpdate({ defaultFrequency: v as PayScheduleConfig["defaultFrequency"] })}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="semi_monthly">Semi-Monthly (1st–15th / 16th–EOM)</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="bi_weekly">Bi-Weekly (every 2 weeks)</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs text-blue-700 dark:text-blue-400">
                            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>This is the company default. Individual employees can override via their profile.</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Government Deduction Timing */}
                <Card className="border border-border/50">
                    <CardContent className="p-4 space-y-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Gov&apos;t Deduction Timing</p>
                        <Select
                            value={schedule.deductGovFrom}
                            onValueChange={(v) => onUpdate({ deductGovFrom: v as PayScheduleConfig["deductGovFrom"] })}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="second">2nd Cutoff Only (common in PH)</SelectItem>
                                <SelectItem value="first">1st Cutoff Only</SelectItem>
                                <SelectItem value="both">Split Across Both Cutoffs</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                            Controls when SSS, PhilHealth, Pag-IBIG, and withholding tax are deducted for semi-monthly payroll.
                        </p>
                    </CardContent>
                </Card>

                {/* Semi-Monthly Settings */}
                {schedule.defaultFrequency === "semi_monthly" && (
                    <Card className="border border-border/50 md:col-span-2">
                        <CardContent className="p-4 space-y-4">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Semi-Monthly Configuration</p>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-medium">1st Cutoff Day</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={28}
                                        value={schedule.semiMonthlyFirstCutoff}
                                        onChange={(e) => onUpdate({ semiMonthlyFirstCutoff: parseInt(e.target.value) || 15 })}
                                        className="mt-1"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-0.5">End of 1st pay period</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">1st Pay Day</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={31}
                                        value={schedule.semiMonthlyFirstPayDay}
                                        onChange={(e) => onUpdate({ semiMonthlyFirstPayDay: parseInt(e.target.value) || 20 })}
                                        className="mt-1"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Pay day for 1st cutoff</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">2nd Pay Day</label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={15}
                                        value={schedule.semiMonthlySecondPayDay}
                                        onChange={(e) => onUpdate({ semiMonthlySecondPayDay: parseInt(e.target.value) || 5 })}
                                        className="mt-1"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Pay day for 2nd cutoff (next month)</p>
                                </div>
                            </div>
                            <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs text-muted-foreground">
                                    <strong>Example:</strong> 1st period = 1st–{schedule.semiMonthlyFirstCutoff}th, paid on the {schedule.semiMonthlyFirstPayDay}th.
                                    2nd period = {schedule.semiMonthlyFirstCutoff + 1}th–EOM, paid on the {schedule.semiMonthlySecondPayDay}th of next month.
                                    Gov&apos;t deductions on <strong>{schedule.deductGovFrom === "both" ? "both cutoffs (split 50/50)" : `${schedule.deductGovFrom} cutoff only`}</strong>.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Monthly Settings */}
                {schedule.defaultFrequency === "monthly" && (
                    <Card className="border border-border/50">
                        <CardContent className="p-4 space-y-3">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Monthly Configuration</p>
                            <div>
                                <label className="text-xs font-medium">Monthly Pay Day</label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={schedule.monthlyPayDay}
                                    onChange={(e) => onUpdate({ monthlyPayDay: parseInt(e.target.value) || 30 })}
                                    className="mt-1"
                                />
                                <p className="text-[10px] text-muted-foreground mt-0.5">Day of month to pay employees</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Bi-Weekly Settings */}
                {schedule.defaultFrequency === "bi_weekly" && (
                    <Card className="border border-border/50">
                        <CardContent className="p-4 space-y-3">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Bi-Weekly Configuration</p>
                            <div>
                                <label className="text-xs font-medium">Reference Start Date</label>
                                <Input
                                    type="date"
                                    value={schedule.biWeeklyStartDate}
                                    onChange={(e) => onUpdate({ biWeeklyStartDate: e.target.value })}
                                    className="mt-1"
                                />
                                <p className="text-[10px] text-muted-foreground mt-0.5">Starting point for calculating bi-weekly periods</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Weekly Settings */}
                {schedule.defaultFrequency === "weekly" && (
                    <Card className="border border-border/50">
                        <CardContent className="p-4 space-y-3">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">Weekly Configuration</p>
                            <div>
                                <label className="text-xs font-medium">Pay Day</label>
                                <Select
                                    value={String(schedule.weeklyPayDay)}
                                    onValueChange={(v) => onUpdate({ weeklyPayDay: parseInt(v) })}
                                >
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Sunday</SelectItem>
                                        <SelectItem value="1">Monday</SelectItem>
                                        <SelectItem value="2">Tuesday</SelectItem>
                                        <SelectItem value="3">Wednesday</SelectItem>
                                        <SelectItem value="4">Thursday</SelectItem>
                                        <SelectItem value="5">Friday</SelectItem>
                                        <SelectItem value="6">Saturday</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Save confirmation */}
            <div className="flex justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => toast.success("Pay schedule saved")}
                >
                    <Save className="h-4 w-4" /> Settings Auto-Saved
                </Button>
            </div>
        </div>
    );
}
