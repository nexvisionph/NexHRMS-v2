"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Bell, ArrowLeft, RotateCcw, Mail, MessageSquare,
    Shield, Pencil, CheckCircle, Zap,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import type { NotificationChannel, NotificationTrigger } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, description, children }: {
    icon: React.ElementType; title: string; description: string;
    children: React.ReactNode;
}) {
    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-base">{title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">{children}</CardContent>
        </Card>
    );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
                <p className="text-sm font-medium">{label}</p>
                {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

const TRIGGER_LABELS: Record<string, string> = {
    payslip_published: "Payslip Published",
    payslip_signed: "Payslip Signed",
    payslip_unsigned_reminder: "Unsigned Payslip Reminder",
    payment_confirmed: "Payment Confirmed",
    leave_submitted: "Leave Submitted",
    leave_approved: "Leave Approved",
    leave_rejected: "Leave Rejected",
    attendance_missing: "Missing Attendance",
    geofence_violation: "Geofence Violation",
    location_disabled: "GPS/Location Disabled",
    loan_reminder: "Loan Payment Reminder",
    overtime_submitted: "Overtime Submitted",
    birthday: "Employee Birthday",
    contract_expiry: "Contract Expiry",
    daily_summary: "Daily Summary Report",
};

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string; icon: string }[] = [
    { value: "in_app", label: "In-App Only", icon: "🔔" },
    { value: "email", label: "Email", icon: "📧" },
    { value: "sms", label: "SMS", icon: "📱" },
    { value: "both", label: "Email + SMS", icon: "📨" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const { rules, providerConfig, updateRule, toggleRule, resetRules, updateProviderConfig, fetchFromDb, hasFetchedFromDb } = useNotificationsStore();
    const [resetOpen, setResetOpen] = useState(false);
    const [editingTrigger, setEditingTrigger] = useState<NotificationTrigger | null>(null);
    const rh = useRoleHref();

    useEffect(() => {
        if (!hasFetchedFromDb) { fetchFromDb(); }
    }, [hasFetchedFromDb, fetchFromDb]);

    if (currentUser.role !== "admin") {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">Admin access required.</p>
            </div>
        );
    }

    const editRule = rules.find((r) => r.trigger === editingTrigger);

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href={rh("/settings")}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Notification Settings</h1>
                        <p className="text-sm text-muted-foreground">Configure notification rules, channels, and templates</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setResetOpen(true)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                    </Button>
                </div>
            </div>

            {/* Provider Configuration */}
            <Section icon={Shield} title="Provider Configuration" description="Configure SMS and email providers (simulated in MVP)">
                <Row label="SMS Provider" hint="Semaphore (PH) or Twilio">
                    <Select value={providerConfig.smsProvider} onValueChange={(v) => updateProviderConfig({ smsProvider: v as "semaphore" | "twilio" })}>
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="semaphore">Semaphore</SelectItem>
                            <SelectItem value="twilio">Twilio</SelectItem>
                        </SelectContent>
                    </Select>
                </Row>
                <Row label="Email Provider" hint="Resend or SMTP gateway">
                    <Select value={providerConfig.emailProvider} onValueChange={(v) => updateProviderConfig({ emailProvider: v as "resend" | "smtp" })}>
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="resend">Resend</SelectItem>
                            <SelectItem value="smtp">SMTP</SelectItem>
                        </SelectContent>
                    </Select>
                </Row>
                <Row label="Enable SMS Sending" hint="Allow SMS notifications to be dispatched">
                    <Switch checked={providerConfig.smsEnabled} onCheckedChange={(v) => updateProviderConfig({ smsEnabled: v })} />
                </Row>
                <Row label="Enable Email Sending" hint="Allow email notifications to be dispatched">
                    <Switch checked={providerConfig.emailEnabled} onCheckedChange={(v) => updateProviderConfig({ emailEnabled: v })} />
                </Row>
                <Row label="Default Sender Name" hint="From name for emails and SMS">
                    <Input
                        value={providerConfig.defaultSenderName}
                        onChange={(e) => updateProviderConfig({ defaultSenderName: e.target.value })}
                        className="w-[160px]"
                    />
                </Row>
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                        <Zap className="inline h-3 w-3 mr-1 -mt-px" />
                        <strong>Simulation Mode:</strong> All notifications are simulated. No real SMS or emails are sent. Dispatches are logged to the Notification Log.
                    </p>
                </div>
            </Section>

            {/* Notification Rules */}
            <Section icon={Bell} title="Notification Rules" description="Enable/disable triggers and configure delivery channels">
                <div className="space-y-3">
                    {rules.map((rule) => (
                        <div
                            key={rule.trigger}
                            className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors ${
                                rule.enabled ? "bg-card border-border/50" : "bg-muted/30 border-border/30 opacity-60"
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <Switch
                                    checked={rule.enabled}
                                    onCheckedChange={() => toggleRule(rule.id)}
                                />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium">{TRIGGER_LABELS[rule.trigger] || rule.trigger}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <Badge variant="secondary" className="text-[10px]">
                                            {CHANNEL_OPTIONS.find((c) => c.value === rule.channel)?.icon || "🔔"}{" "}
                                            {CHANNEL_OPTIONS.find((c) => c.value === rule.channel)?.label || rule.channel}
                                        </Badge>
                                        {rule.timing && (
                                            <Badge variant="outline" className="text-[10px]">{rule.timing}</Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                                onClick={() => setEditingTrigger(rule.trigger)}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            </Section>

            {/* Summary */}
            <Card className="border border-border/50">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                            <span>{rules.filter((r) => r.enabled).length} of {rules.length} rules active</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                                <Mail className="h-3 w-3 mr-1" /> {rules.filter((r) => r.enabled && (r.channel === "email" || r.channel === "both")).length} email
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                                <MessageSquare className="h-3 w-3 mr-1" /> {rules.filter((r) => r.enabled && (r.channel === "sms" || r.channel === "both")).length} SMS
                            </Badge>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Rule Dialog */}
            <Dialog open={!!editingTrigger} onOpenChange={(open) => { if (!open) setEditingTrigger(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-4 w-4" />
                            Edit Rule: {editingTrigger ? TRIGGER_LABELS[editingTrigger] || editingTrigger : ""}
                        </DialogTitle>
                    </DialogHeader>
                    {editRule && (
                        <div className="space-y-4 pt-2">
                            <Row label="Enabled" hint="Toggle this notification trigger">
                                <Switch
                                    checked={editRule.enabled}
                                    onCheckedChange={() => {
                                        toggleRule(editRule.id);
                                    }}
                                />
                            </Row>
                            <div>
                                <label className="text-sm font-medium">Channel</label>
                                <Select
                                    value={editRule.channel}
                                    onValueChange={(v) => updateRule(editRule.id, { channel: v as NotificationChannel })}
                                >
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CHANNEL_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.icon} {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Timing</label>
                                <Select
                                    value={editRule.timing}
                                    onValueChange={(v) => updateRule(editRule.id, { timing: v as "immediate" | "scheduled" })}
                                >
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="immediate">Immediate</SelectItem>
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Subject Template</label>
                                <Input
                                    value={editRule.subjectTemplate || ""}
                                    onChange={(e) => updateRule(editRule.id, { subjectTemplate: e.target.value })}
                                    placeholder="Subject with {name}, {period} variables"
                                    className="mt-1"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">Variables: {"{name}"}, {"{period}"}, {"{date}"}, {"{amount}"}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Body Template</label>
                                <Textarea
                                    value={editRule.bodyTemplate || ""}
                                    onChange={(e) => updateRule(editRule.id, { bodyTemplate: e.target.value })}
                                    placeholder="Body with {name}, {period} variables"
                                    className="mt-1"
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">SMS Template</label>
                                <Textarea
                                    value={editRule.smsTemplate || ""}
                                    onChange={(e) => updateRule(editRule.id, { smsTemplate: e.target.value })}
                                    placeholder="SMS text with {name}, {period} variables"
                                    className="mt-1"
                                    rows={2}
                                />
                            </div>
                            <Button
                                className="w-full"
                                onClick={() => {
                                    setEditingTrigger(null);
                                    toast.success("Rule updated");
                                }}
                            >
                                Save Changes
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Reset Dialog */}
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Notification Rules?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will restore all notification rules, channels, and templates to their default settings.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { resetRules(); setResetOpen(false); toast.success("Notification rules reset to defaults"); }}>Reset</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
