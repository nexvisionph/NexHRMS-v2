"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import {
    changeMyPassword,
} from "@/services/auth.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sun, Moon, Monitor, Building2, Shield, Bell, Palette, ClipboardList, Pencil, Plus, Clock3, ChevronRight, Wallet, CalendarDays, Lock, Eye, EyeOff, KeyRound, RotateCcw, TriangleAlert, Tablet, MapPin, MessageSquare, ListTodo, Settings2, Users, CreditCard, Megaphone, Wrench, Trash2 } from "lucide-react";
import type { Role } from "@/types";
import { toast } from "sonner";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTimesheetStore } from "@/store/timesheet.store";
import { usePayrollStore, DEFAULT_PAY_SCHEDULE } from "@/store/payroll.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useProjectsStore } from "@/store/projects.store";
import { useLeaveStore } from "@/store/leave.store";
import { useLoansStore } from "@/store/loans.store";
import { useEventsStore } from "@/store/events.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useAuditStore } from "@/store/audit.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useLocationStore } from "@/store/location.store";
import { useTasksStore } from "@/store/tasks.store";
import { useMessagingStore } from "@/store/messaging.store";
import type { AttendanceRuleSet, PayFrequency } from "@/types";
import Link from "next/link";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { cn } from "@/lib/utils";

const USE_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/* ═══════════════════════════════════════════════════════════════
   ADMIN VIEW — Redesigned Settings Management
   Tab-based layout: General | Payroll & Time | Communication | System
   ═══════════════════════════════════════════════════════════════ */

interface OrgSettings { companyName: string; industry: string; emailAbsenceAlerts: boolean; emailLeaveUpdates: boolean; emailPayrollAlerts: boolean; }
const defaultOrgSettings: OrgSettings = { companyName: "NexHRMS", industry: "technology", emailAbsenceAlerts: true, emailLeaveUpdates: true, emailPayrollAlerts: true };
function readOrgSettings() {
    if (typeof window === "undefined") return defaultOrgSettings;
    try { const s = localStorage.getItem("nexhrms-org-settings"); if (s) return { ...defaultOrgSettings, ...JSON.parse(s) }; } catch { /* ignore */ }
    return defaultOrgSettings;
}

function useOrgSettings() {
    const [settings, setSettings] = useState(readOrgSettings);
    const update = (patch: Partial<OrgSettings>) => {
        setSettings((prev: OrgSettings) => {
            const next = { ...prev, ...patch };
            localStorage.setItem("nexhrms-org-settings", JSON.stringify(next));
            return next;
        });
    };
    return { settings, update };
}

/* ── Tab definitions ───────────────────────────────── */
type TabKey = "general" | "payroll" | "communication" | "system";
const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
    { key: "general",       label: "General",         icon: Settings2,   desc: "Company, appearance & quick links" },
    { key: "payroll",       label: "Payroll & Time",  icon: CreditCard,  desc: "Pay schedule & timesheet rules" },
    { key: "communication", label: "Communication",   icon: Megaphone,   desc: "Notifications & messaging" },
    { key: "system",        label: "System",          icon: Wrench,      desc: "Security, users & data" },
];

export default function AdminSettingsView() {
    const { theme, setTheme, currentUser } = useAuthStore();
    const demoChangePassword = useAuthStore((s) => s.changePassword);

    const { settings, update } = useOrgSettings();
    const { ruleSets, updateRuleSet, addRuleSet, deleteRuleSet } = useTimesheetStore();
    const { paySchedule, updatePaySchedule } = usePayrollStore();
    const { hasPermission } = useRolesStore();
    const { config: msgConfig, updateConfig: updateMsgConfig } = useMessagingStore();
    const { groups: taskGroups, tasks: allTasksArr } = useTasksStore();
    const rh = useRoleHref();
    const canManageRoles = hasPermission(currentUser.role, "settings:roles");

    const [activeTab, setActiveTab] = useState<TabKey>("general");

    // ─── Global Reset ──────────────────────────────────────────────
    const [resetAllOpen, setResetAllOpen] = useState(false);
    const handleResetAll = () => {
        useAuthStore.getState().resetToSeed();
        useEmployeesStore.getState().resetToSeed();
        useProjectsStore.getState().resetToSeed();
        useAttendanceStore.getState().resetToSeed();
        usePayrollStore.getState().resetToSeed();
        useLeaveStore.getState().resetToSeed();
        useLoansStore.getState().resetToSeed();
        useTimesheetStore.getState().resetToSeed();
        useEventsStore.getState().resetToSeed();
        useNotificationsStore.getState().resetToSeed();
        useAuditStore.getState().resetToSeed();
        useAppearanceStore.getState().resetAppearance();
        useLocationStore.getState().resetToSeed();
        useTasksStore.getState().resetToSeed();
        useMessagingStore.getState().resetToSeed();
        setResetAllOpen(false);
        toast.success("All demo data has been reset to seed state.");
    };

    // ─── Password Change ──────────────────────────────────────────
    const [pwOld, setPwOld] = useState("");
    const [pwNew, setPwNew] = useState("");
    const [pwConfirm, setPwConfirm] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [changingPw, setChangingPw] = useState(false);

    const handleChangePassword = async () => {
        if (pwNew !== pwConfirm) { toast.error("Passwords do not match."); return; }
        if (pwNew.length < 6) { toast.error("Password must be at least 6 characters."); return; }
        if (USE_DEMO_MODE) {
            const result = demoChangePassword(currentUser.id, pwOld, pwNew);
            if (!result.ok) { toast.error(result.error); return; }
        } else {
            setChangingPw(true);
            const result = await changeMyPassword(pwNew);
            setChangingPw(false);
            if (!result.ok) { toast.error(result.error); return; }
        }
        toast.success("Password changed successfully.");
        setPwOld(""); setPwNew(""); setPwConfirm("");
    };

    // ─── Rule Set Editing ────────────────────────────────────────
    const [editRuleOpen, setEditRuleOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<AttendanceRuleSet | null>(null);
    const [editName, setEditName] = useState("");
    const [editStandardHours, setEditStandardHours] = useState("8");
    const [editGraceMinutes, setEditGraceMinutes] = useState("10");
    const [editRoundingPolicy, setEditRoundingPolicy] = useState<"none" | "nearest_15" | "nearest_30">("nearest_15");
    const [editOTRequired, setEditOTRequired] = useState(true);
    const [editNightDiffStart, setEditNightDiffStart] = useState("22:00");
    const [editNightDiffEnd, setEditNightDiffEnd] = useState("06:00");
    const [editHolidayMultiplier, setEditHolidayMultiplier] = useState("2.0");

    const [addRuleOpen, setAddRuleOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newStandardHours, setNewStandardHours] = useState("8");
    const [newGraceMinutes, setNewGraceMinutes] = useState("10");
    const [newRoundingPolicy, setNewRoundingPolicy] = useState<"none" | "nearest_15" | "nearest_30">("nearest_15");
    const [newOTRequired, setNewOTRequired] = useState(true);
    const [newNightDiffStart, setNewNightDiffStart] = useState("22:00");
    const [newNightDiffEnd, setNewNightDiffEnd] = useState("06:00");
    const [newHolidayMultiplier, setNewHolidayMultiplier] = useState("2.0");

    const handleOpenAdd = () => {
        setNewName(""); setNewStandardHours("8"); setNewGraceMinutes("10"); setNewRoundingPolicy("nearest_15"); setNewOTRequired(true); setNewNightDiffStart("22:00"); setNewNightDiffEnd("06:00"); setNewHolidayMultiplier("2.0"); setAddRuleOpen(true);
    };

    const handleCreateNew = () => {
        if (!newName || !newStandardHours || !newGraceMinutes) { toast.error("Please fill all required fields"); return; }
        addRuleSet({ name: newName, standardHoursPerDay: Number(newStandardHours), graceMinutes: Number(newGraceMinutes), roundingPolicy: newRoundingPolicy, overtimeRequiresApproval: newOTRequired, nightDiffStart: newNightDiffStart, nightDiffEnd: newNightDiffEnd, holidayMultiplier: Number(newHolidayMultiplier) });
        toast.success(`Rule set "${newName}" created successfully`); setAddRuleOpen(false);
    };

    const handleOpenEdit = (rule: AttendanceRuleSet) => {
        setEditingRule(rule); setEditName(rule.name); setEditStandardHours(String(rule.standardHoursPerDay)); setEditGraceMinutes(String(rule.graceMinutes)); setEditRoundingPolicy(rule.roundingPolicy); setEditOTRequired(rule.overtimeRequiresApproval); setEditNightDiffStart(rule.nightDiffStart || "22:00"); setEditNightDiffEnd(rule.nightDiffEnd || "06:00"); setEditHolidayMultiplier(String(rule.holidayMultiplier)); setEditRuleOpen(true);
    };

    const handleSaveEdit = () => {
        if (!editingRule) return;
        if (!editName || !editStandardHours || !editGraceMinutes) { toast.error("Please fill all required fields"); return; }
        updateRuleSet(editingRule.id, { name: editName, standardHoursPerDay: Number(editStandardHours), graceMinutes: Number(editGraceMinutes), roundingPolicy: editRoundingPolicy, overtimeRequiresApproval: editOTRequired, nightDiffStart: editNightDiffStart, nightDiffEnd: editNightDiffEnd, holidayMultiplier: Number(editHolidayMultiplier) });
        toast.success("Rule set updated successfully"); setEditRuleOpen(false); setEditingRule(null);
    };

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       Quick-link card helper
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    const QuickLink = ({ href, icon: Icon, title, desc }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) => (
        <Link href={rh(href)}>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 hover:border-primary/20 transition-all group cursor-pointer">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium group-hover:text-primary transition-colors">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
            </div>
        </Link>
    );

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       TAB PANELS
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

    /* ── 1. GENERAL ───────────────────────────────── */
    const GeneralTab = () => (
        <div className="space-y-6">
            {/* Company Information */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base">Company Information</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Basic details about your organization</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Company Name</label>
                        <Input value={settings.companyName} onChange={(e) => update({ companyName: e.target.value })} className="mt-1.5" />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Industry</label>
                        <Select value={settings.industry} onValueChange={(v) => update({ industry: v })}>
                            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="technology">Technology</SelectItem>
                                <SelectItem value="healthcare">Healthcare</SelectItem>
                                <SelectItem value="finance">Finance</SelectItem>
                                <SelectItem value="education">Education</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={() => toast.success("Organization settings saved")} size="sm">Save Changes</Button>
                </CardContent>
            </Card>

            {/* Appearance — Theme Toggle */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base">Appearance</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Choose how the system looks for you</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">Theme</p>
                            <p className="text-xs text-muted-foreground">Light, dark, or match your system</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {([{ value: "light" as const, icon: Sun, label: "Light" }, { value: "dark" as const, icon: Moon, label: "Dark" }, { value: "system" as const, icon: Monitor, label: "Auto" }]).map((t) => (
                                <Button key={t.value} variant={theme === t.value ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => { setTheme(t.value); toast.success(`Theme set to ${t.label}`); }}>
                                    <t.icon className="h-4 w-4" />{t.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Links to Sub-pages */}
            <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Configure Modules</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <QuickLink href="/settings/organization" icon={Building2} title="Org Structure" desc="Departments & positions" />
                    <QuickLink href="/settings/shifts" icon={Clock3} title="Shifts & Time" desc="Shift templates & assignments" />
                    <QuickLink href="/settings/roles" icon={Shield} title="Roles & Permissions" desc="Manage who can access what" />
                    <QuickLink href="/settings/appearance" icon={Palette} title="Theme & Layout" desc="Colors, fonts & sidebar style" />
                    <QuickLink href="/settings/navigation" icon={ClipboardList} title="Sidebar Navigation" desc="Reorder & customize menu items" />
                    <QuickLink href="/settings/kiosk" icon={Tablet} title="Kiosk Settings" desc="Check-in terminal configuration" />
                    <QuickLink href="/settings/location" icon={MapPin} title="Location & GPS" desc="Geofencing, selfie & break rules" />
                    <QuickLink href="/settings/notifications" icon={Bell} title="Notification Rules" desc="Alert channels & templates" />
                </div>
            </div>
        </div>
    );

    /* ── 2. PAYROLL & TIME ────────────────────────── */
    const PayrollTab = () => (
        <div className="space-y-6">
            {/* Pay Schedule */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base">Pay Schedule</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">How often employees get paid. Individual employees can have overrides from their profile.</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div>
                        <label className="text-sm font-medium">Pay Frequency</label>
                        <p className="text-xs text-muted-foreground mb-1.5">How often do you run payroll?</p>
                        <Select value={paySchedule.defaultFrequency} onValueChange={(v) => { updatePaySchedule({ defaultFrequency: v as PayFrequency }); toast.success(`Frequency set to ${v.replace("_", "-")}`); }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="monthly">Monthly — once per month</SelectItem>
                                <SelectItem value="semi_monthly">Semi-Monthly — twice per month (e.g. 15th & 30th)</SelectItem>
                                <SelectItem value="bi_weekly">Bi-Weekly — every 2 weeks</SelectItem>
                                <SelectItem value="weekly">Weekly — every week</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {paySchedule.defaultFrequency === "semi_monthly" && (
                        <div className="p-4 rounded-lg border border-border/50 bg-muted/30 space-y-4">
                            <p className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Semi-Monthly Details</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-medium">1st Cutoff Day</label>
                                    <Input type="number" min={1} max={28} value={paySchedule.semiMonthlyFirstCutoff} onChange={(e) => updatePaySchedule({ semiMonthlyFirstCutoff: Number(e.target.value) || 15 })} className="mt-1" />
                                    <p className="text-[11px] text-muted-foreground mt-1">Coverage: 1st to this day</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">1st Pay Day</label>
                                    <Input type="number" min={1} max={28} value={paySchedule.semiMonthlyFirstPayDay} onChange={(e) => updatePaySchedule({ semiMonthlyFirstPayDay: Number(e.target.value) || 20 })} className="mt-1" />
                                    <p className="text-[11px] text-muted-foreground mt-1">When salary is released</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">2nd Pay Day</label>
                                    <Input type="number" min={1} max={28} value={paySchedule.semiMonthlySecondPayDay} onChange={(e) => updatePaySchedule({ semiMonthlySecondPayDay: Number(e.target.value) || 5 })} className="mt-1" />
                                    <p className="text-[11px] text-muted-foreground mt-1">Of the following month</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium">Gov&apos;t Deductions Timing</label>
                                <p className="text-[11px] text-muted-foreground mb-1">When to deduct SSS, PhilHealth, Pag-IBIG & tax</p>
                                <Select value={paySchedule.deductGovFrom} onValueChange={(v) => updatePaySchedule({ deductGovFrom: v as "first" | "second" | "both" })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="first">1st Cutoff Only</SelectItem>
                                        <SelectItem value="second">2nd Cutoff Only</SelectItem>
                                        <SelectItem value="both">Split Across Both Cutoffs</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    {paySchedule.defaultFrequency === "monthly" && (
                        <div className="p-4 rounded-lg border border-border/50 bg-muted/30 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Monthly Pay Day</p>
                            <div>
                                <label className="text-xs font-medium">Day of Month</label>
                                <Input type="number" min={1} max={31} value={paySchedule.monthlyPayDay} onChange={(e) => updatePaySchedule({ monthlyPayDay: Number(e.target.value) || 30 })} className="mt-1" />
                                <p className="text-[11px] text-muted-foreground mt-1">Salary released on this day each month</p>
                            </div>
                        </div>
                    )}
                    {paySchedule.defaultFrequency === "bi_weekly" && (
                        <div className="p-4 rounded-lg border border-border/50 bg-muted/30 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Bi-Weekly Schedule</p>
                            <div>
                                <label className="text-xs font-medium">Start Date</label>
                                <Input type="date" value={paySchedule.biWeeklyStartDate} onChange={(e) => updatePaySchedule({ biWeeklyStartDate: e.target.value })} className="mt-1" />
                                <p className="text-[11px] text-muted-foreground mt-1">First pay period starts here, then repeats every 14 days</p>
                            </div>
                        </div>
                    )}
                    {paySchedule.defaultFrequency === "weekly" && (
                        <div className="p-4 rounded-lg border border-border/50 bg-muted/30 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> Weekly Pay Day</p>
                            <Select value={String(paySchedule.weeklyPayDay)} onValueChange={(v) => updatePaySchedule({ weeklyPayDay: Number(v) })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Monday</SelectItem>
                                    <SelectItem value="2">Tuesday</SelectItem>
                                    <SelectItem value="3">Wednesday</SelectItem>
                                    <SelectItem value="4">Thursday</SelectItem>
                                    <SelectItem value="5">Friday</SelectItem>
                                    <SelectItem value="6">Saturday</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Current Schedule Summary</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {paySchedule.defaultFrequency === "semi_monthly" && `Semi-monthly: 1st\u2013${paySchedule.semiMonthlyFirstCutoff} (pay day ${paySchedule.semiMonthlyFirstPayDay}) & ${paySchedule.semiMonthlyFirstCutoff + 1}\u2013end of month (pay day ${paySchedule.semiMonthlySecondPayDay} next month). Gov deductions from ${paySchedule.deductGovFrom === "both" ? "both cutoffs" : paySchedule.deductGovFrom === "first" ? "1st cutoff" : "2nd cutoff"}.`}
                            {paySchedule.defaultFrequency === "monthly" && `Monthly payroll released on the ${paySchedule.monthlyPayDay}th of each month.`}
                            {paySchedule.defaultFrequency === "bi_weekly" && `Bi-weekly starting ${paySchedule.biWeeklyStartDate}, every 14 days.`}
                            {paySchedule.defaultFrequency === "weekly" && `Weekly payroll every ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][paySchedule.weeklyPayDay]}.`}
                        </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { updatePaySchedule(DEFAULT_PAY_SCHEDULE); toast.success("Pay schedule reset to defaults"); }}>Reset to Defaults</Button>
                </CardContent>
            </Card>

            {/* Timesheet Rule Sets */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-primary" />
                            <div>
                                <CardTitle className="text-base">Timesheet Rules</CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">Define how work hours are calculated for different shifts</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleOpenAdd}><Plus className="h-4 w-4" />New Rule Set</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {ruleSets.map((rs) => (
                            <div key={rs.id} className="p-4 rounded-lg border border-border/50 hover:border-primary/20 transition-colors space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-xs">{rs.name}</Badge>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => handleOpenEdit(rs)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                                        {ruleSets.length > 1 && (
                                            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => { deleteRuleSet(rs.id); toast.success(`Rule set "${rs.name}" deleted`); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                    <span>Work hours: <strong className="text-foreground">{rs.standardHoursPerDay}h/day</strong></span>
                                    <span>Late grace: <strong className="text-foreground">{rs.graceMinutes} min</strong></span>
                                    <span>Rounding: <strong className="text-foreground">{rs.roundingPolicy === "none" ? "Exact" : rs.roundingPolicy.replace("nearest_", "Nearest ")}</strong></span>
                                    <span>Overtime approval: <strong className="text-foreground">{rs.overtimeRequiresApproval ? "Required" : "Not needed"}</strong></span>
                                    <span>Night pay: <strong className="text-foreground">{rs.nightDiffStart || "N/A"} — {rs.nightDiffEnd || "N/A"}</strong></span>
                                    <span>Holiday pay: <strong className="text-foreground">{rs.holidayMultiplier}× rate</strong></span>
                                </div>
                            </div>
                        ))}
                        {ruleSets.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">No timesheet rules configured yet.</p>
                                <p className="text-xs mt-1">Click &quot;New Rule Set&quot; to create one.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Task Management Summary */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <ListTodo className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base">Task Management</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Overview of employee task assignments</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50"><p className="text-xl font-bold">{taskGroups.length}</p><p className="text-xs text-muted-foreground">Groups</p></div>
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50"><p className="text-xl font-bold">{allTasksArr.length}</p><p className="text-xs text-muted-foreground">Total Tasks</p></div>
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50"><p className="text-xl font-bold">{allTasksArr.filter((t) => t.status === "open" || t.status === "in_progress").length}</p><p className="text-xs text-muted-foreground">Active</p></div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">Manage task details from the <Link href={rh("/tasks")} className="text-primary underline-offset-4 hover:underline font-medium">Tasks page</Link>.</p>
                </CardContent>
            </Card>
        </div>
    );

    /* ── 3. COMMUNICATION ──────────────────────────── */
    const CommunicationTab = () => (
        <div className="space-y-6">
            {/* Email Notifications */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base">Email Alerts</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Choose which events send automatic email notifications</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-1">
                    {([
                        { key: "emailAbsenceAlerts" as const, label: "Employee Absence", desc: "Get notified when someone is absent" },
                        { key: "emailLeaveUpdates" as const, label: "Leave Approvals", desc: "When a leave request is approved or rejected" },
                        { key: "emailPayrollAlerts" as const, label: "Payroll Updates", desc: "Notifications when payslips are issued" },
                    ]).map((n) => (
                        <div key={n.key} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
                            <div>
                                <p className="text-sm font-medium">{n.label}</p>
                                <p className="text-xs text-muted-foreground">{n.desc}</p>
                            </div>
                            <Switch checked={settings[n.key]} onCheckedChange={(checked) => { update({ [n.key]: checked }); toast.success(`${n.label} ${checked ? "enabled" : "disabled"}`); }} />
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Messaging Channels */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base">Messaging Channels</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">How the system delivers messages to employees</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div>
                        <label className="text-sm font-medium">Default Delivery Method</label>
                        <p className="text-xs text-muted-foreground mb-1.5">Primary channel for sending messages</p>
                        <Select value={msgConfig.defaultChannel} onValueChange={(v) => { updateMsgConfig({ defaultChannel: v as "email" | "whatsapp" | "sms" | "in_app" }); toast.success(`Default channel set to ${v}`); }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="in_app">In-App Notification</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between py-3 border-b border-border/30">
                            <div>
                                <p className="text-sm font-medium">WhatsApp Messages</p>
                                <p className="text-xs text-muted-foreground">Send via Meta Cloud API</p>
                            </div>
                            <Switch checked={msgConfig.whatsappEnabled} onCheckedChange={(v) => { updateMsgConfig({ whatsappEnabled: v }); toast.success(`WhatsApp ${v ? "enabled" : "disabled"}`); }} />
                        </div>
                        <div className="flex items-center justify-between py-3 opacity-50">
                            <div>
                                <p className="text-sm font-medium flex items-center gap-2">SMS <Badge variant="outline" className="text-[10px]">Coming Soon</Badge></p>
                                <p className="text-xs text-muted-foreground">Semaphore — not available yet</p>
                            </div>
                            <Switch checked={false} disabled />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <p className="text-sm font-medium">Email Sender Details</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground">Sender Name</label>
                                <Input value={msgConfig.emailFromName} onChange={(e) => updateMsgConfig({ emailFromName: e.target.value })} className="mt-1" />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Sender Email</label>
                                <Input value={msgConfig.emailFromAddress} onChange={(e) => updateMsgConfig({ emailFromAddress: e.target.value })} className="mt-1" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    /* ── 4. SYSTEM ──────────────────────────────────── */
    const SystemTab = () => (
        <div className="space-y-6">
            {/* Roles Summary */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base">Roles Overview</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">System roles and what they can do</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {([
                            { role: "Admin", desc: "Full system access — can manage everything", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
                            { role: "HR", desc: "Employee management, attendance & leave", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
                            { role: "Finance", desc: "Financial data and reporting", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
                            { role: "Supervisor", desc: "Team oversight & timesheet approval", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400" },
                            { role: "Payroll Admin", desc: "Payroll processing & deductions", color: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
                            { role: "Auditor", desc: "Read-only access to audit trail", color: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
                            { role: "Employee", desc: "Self-service — own records only", color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
                        ]).map((r) => (
                            <div key={r.role} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30">
                                <Badge variant="secondary" className={`text-xs shrink-0 ${r.color}`}>{r.role}</Badge>
                                <span className="text-sm text-muted-foreground">{r.desc}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3">
                        <Link href={rh("/settings/roles")} className="text-sm text-primary hover:underline underline-offset-4 font-medium">
                            Configure detailed permissions →
                        </Link>
                    </div>
                </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base">Change Your Password</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">Update the password for your own account</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 max-w-sm">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Current Password</label>
                            <div className="relative">
                                <Input type={showPw ? "text" : "password"} value={pwOld} onChange={(e) => setPwOld(e.target.value)} placeholder="Enter current password" />
                                <button type="button" className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => setShowPw((v) => !v)}>{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                            </div>
                        </div>
                        <div className="space-y-1.5"><label className="text-sm font-medium">New Password</label><Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="Minimum 6 characters" /></div>
                        <div className="space-y-1.5"><label className="text-sm font-medium">Confirm Password</label><Input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="Type it again to confirm" /></div>
                        <Button className="w-full" onClick={handleChangePassword} disabled={!pwOld || !pwNew || !pwConfirm}><KeyRound className="w-4 h-4 mr-1.5" /> Update Password</Button>
                    </div>
                </CardContent>
            </Card>

            {/* User Accounts — moved to Employees page */}
            {canManageRoles && (
                <Card className="border border-border/50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Users className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium">User Accounts</p>
                                <p className="text-xs text-muted-foreground">Account management has been moved to the Employees page for a unified experience.</p>
                            </div>
                            <Link href={rh("/employees/manage")}>
                                <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                                    <Users className="h-3.5 w-3.5" /> Go to Employees
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Danger Zone */}
            {canManageRoles && (
                <Card className="border-destructive/30">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <TriangleAlert className="h-5 w-5 text-destructive" />
                            <div>
                                <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
                                <p className="text-xs text-muted-foreground mt-0.5">Irreversible actions — be careful here</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                            <div>
                                <p className="text-sm font-medium">Reset All Data</p>
                                <p className="text-xs text-muted-foreground">Restores everything back to demo/seed data. You will be logged out.</p>
                            </div>
                            <Button variant="destructive" size="sm" className="ml-4 shrink-0" onClick={() => setResetAllOpen(true)}><RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset All</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );

    /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       RENDER
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
    return (
        <>
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Manage your company&apos;s system preferences</p>
            </div>

            {/* Tab Layout: sidebar on desktop, horizontal scroll on mobile */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Tab Navigation */}
                <nav className="lg:w-56 shrink-0">
                    {/* Mobile: horizontal scroll */}
                    <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                                    activeTab === tab.key
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    {/* Desktop: vertical sidebar */}
                    <div className="hidden lg:flex flex-col gap-1">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all w-full",
                                    activeTab === tab.key
                                        ? "bg-primary/10 text-primary border border-primary/20"
                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent"
                                )}
                            >
                                <tab.icon className={cn("h-4.5 w-4.5 shrink-0", activeTab === tab.key ? "text-primary" : "")} />
                                <div>
                                    <p className="text-sm font-medium">{tab.label}</p>
                                    <p className="text-[11px] text-muted-foreground leading-tight">{tab.desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </nav>

                {/* Tab Content */}
                <div className="flex-1 min-w-0 max-w-3xl">
                    {activeTab === "general" && <GeneralTab />}
                    {activeTab === "payroll" && <PayrollTab />}
                    {activeTab === "communication" && <CommunicationTab />}
                    {activeTab === "system" && <SystemTab />}
                </div>
            </div>
        </div>

        {/* ──── Dialogs ──────────────────────────────────────── */}

        {/* Edit Rule Set Dialog */}
        <Dialog open={editRuleOpen} onOpenChange={setEditRuleOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Edit Timesheet Rule Set — {editingRule?.id}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                    <div><label className="text-sm font-medium">Rule Set Name *</label><Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g., Standard PH Rule Set" className="mt-1" /></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-sm font-medium">Work Hours Per Day *</label><Input type="number" min="1" max="24" step="0.5" value={editStandardHours} onChange={(e) => setEditStandardHours(e.target.value)} className="mt-1" /></div>
                        <div><label className="text-sm font-medium">Late Grace Period (min) *</label><Input type="number" min="0" max="60" value={editGraceMinutes} onChange={(e) => setEditGraceMinutes(e.target.value)} className="mt-1" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-sm font-medium">Time Rounding</label><Select value={editRoundingPolicy} onValueChange={(v) => setEditRoundingPolicy(v as "none" | "nearest_15" | "nearest_30")}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Exact minutes (no rounding)</SelectItem><SelectItem value="nearest_15">Nearest 15 minutes</SelectItem><SelectItem value="nearest_30">Nearest 30 minutes</SelectItem></SelectContent></Select></div>
                        <div><label className="text-sm font-medium">Holiday Pay Multiplier</label><Input type="number" min="1" max="5" step="0.1" value={editHolidayMultiplier} onChange={(e) => setEditHolidayMultiplier(e.target.value)} className="mt-1" /><p className="text-[11px] text-muted-foreground mt-1">e.g. 2× means double pay on holidays</p></div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border/50"><div><p className="text-sm font-medium">Require Overtime Approval</p><p className="text-xs text-muted-foreground">OT hours must be pre-approved by a supervisor</p></div><Switch checked={editOTRequired} onCheckedChange={setEditOTRequired} /></div>
                    <div>
                        <label className="text-sm font-medium">Night Shift Pay Hours</label>
                        <p className="text-xs text-muted-foreground mb-2">Employees working during these hours receive night differential pay</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs text-muted-foreground">From</label><Input type="time" value={editNightDiffStart} onChange={(e) => setEditNightDiffStart(e.target.value)} className="mt-1" /></div>
                            <div><label className="text-xs text-muted-foreground">Until</label><Input type="time" value={editNightDiffEnd} onChange={(e) => setEditNightDiffEnd(e.target.value)} className="mt-1" /></div>
                        </div>
                    </div>
                    <Button onClick={handleSaveEdit} className="w-full">Save Changes</Button>
                </div>
            </DialogContent>
        </Dialog>

        {/* Add Rule Set Dialog */}
        <Dialog open={addRuleOpen} onOpenChange={setAddRuleOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create New Timesheet Rule Set</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                    <div><label className="text-sm font-medium">Rule Set Name *</label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Night Shift Rule Set" className="mt-1" /><p className="text-xs text-muted-foreground mt-1">Give it a descriptive name for the shift type</p></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-sm font-medium">Work Hours Per Day *</label><Input type="number" min="1" max="24" step="0.5" value={newStandardHours} onChange={(e) => setNewStandardHours(e.target.value)} className="mt-1" /></div>
                        <div><label className="text-sm font-medium">Late Grace Period (min) *</label><Input type="number" min="0" max="60" value={newGraceMinutes} onChange={(e) => setNewGraceMinutes(e.target.value)} className="mt-1" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-sm font-medium">Time Rounding</label><Select value={newRoundingPolicy} onValueChange={(v) => setNewRoundingPolicy(v as "none" | "nearest_15" | "nearest_30")}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Exact minutes (no rounding)</SelectItem><SelectItem value="nearest_15">Nearest 15 minutes</SelectItem><SelectItem value="nearest_30">Nearest 30 minutes</SelectItem></SelectContent></Select></div>
                        <div><label className="text-sm font-medium">Holiday Pay Multiplier</label><Input type="number" min="1" max="5" step="0.1" value={newHolidayMultiplier} onChange={(e) => setNewHolidayMultiplier(e.target.value)} className="mt-1" /><p className="text-[11px] text-muted-foreground mt-1">e.g. 2× means double pay on holidays</p></div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border/50"><div><p className="text-sm font-medium">Require Overtime Approval</p><p className="text-xs text-muted-foreground">OT hours must be pre-approved by a supervisor</p></div><Switch checked={newOTRequired} onCheckedChange={setNewOTRequired} /></div>
                    <div>
                        <label className="text-sm font-medium">Night Shift Pay Hours</label>
                        <p className="text-xs text-muted-foreground mb-2">Employees working during these hours receive night differential pay</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs text-muted-foreground">From</label><Input type="time" value={newNightDiffStart} onChange={(e) => setNewNightDiffStart(e.target.value)} className="mt-1" /></div>
                            <div><label className="text-xs text-muted-foreground">Until</label><Input type="time" value={newNightDiffEnd} onChange={(e) => setNewNightDiffEnd(e.target.value)} className="mt-1" /></div>
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Quick Presets</p>
                        <p className="text-xs text-muted-foreground mb-2">Click to auto-fill common configurations</p>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setNewName("Night Shift Rule Set"); setNewStandardHours("8"); setNewGraceMinutes("15"); setNewNightDiffStart("22:00"); setNewNightDiffEnd("06:00"); }}>Night Shift (10PM-6AM)</Button>
                            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setNewName("Flexible Hours Rule Set"); setNewStandardHours("6"); setNewGraceMinutes("30"); setNewRoundingPolicy("none"); }}>Flexible (6h, 30min grace)</Button>
                            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setNewName("12-Hour Shift Rule Set"); setNewStandardHours("12"); setNewGraceMinutes("10"); }}>12-Hour Shift</Button>
                            <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setNewName("Part-Time Rule Set"); setNewStandardHours("4"); setNewGraceMinutes("5"); setNewOTRequired(false); }}>Part-Time (4h)</Button>
                        </div>
                    </div>
                    <Button onClick={handleCreateNew} className="w-full">Create Rule Set</Button>
                </div>
            </DialogContent>
        </Dialog>

        {/* Reset All Data Confirmation */}
        <AlertDialog open={resetAllOpen} onOpenChange={setResetAllOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Reset All Data?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently wipe all data across every module and restore the original demo state. You will be logged out immediately.<br /><br /><strong>This action cannot be undone.</strong></AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleResetAll}><RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Yes, Reset Everything</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
