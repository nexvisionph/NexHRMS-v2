"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
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
import { Sun, Moon, Monitor, Building2, Shield, Bell, Palette, ClipboardList, Pencil, Plus, Clock3, ExternalLink, Wallet, CalendarDays, Lock, UserPlus, Trash2, Eye, EyeOff, KeyRound, RotateCcw, TriangleAlert, LayoutDashboard, FileText, Puzzle, Tablet, MapPin, MessageSquare, ListTodo } from "lucide-react";
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

/* ═══════════════════════════════════════════════════════════════
   ADMIN VIEW — Full Settings Management
   Everything: nav cards, customization, pay schedule, rule sets,
   user accounts, danger zone, theme, org, notifications, security
   ═══════════════════════════════════════════════════════════════ */

interface OrgSettings { companyName: string; industry: string; emailAbsenceAlerts: boolean; emailLeaveUpdates: boolean; emailPayrollAlerts: boolean; }
const defaultOrgSettings: OrgSettings = { companyName: "NexHRMS Inc.", industry: "technology", emailAbsenceAlerts: true, emailLeaveUpdates: true, emailPayrollAlerts: true };
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

export default function AdminSettingsView() {
    const { theme, setTheme, currentUser, changePassword, createAccount, adminSetPassword, deleteAccount, accounts } = useAuthStore();
    const { settings, update } = useOrgSettings();
    const { ruleSets, updateRuleSet, addRuleSet } = useTimesheetStore();
    const { paySchedule, updatePaySchedule } = usePayrollStore();
    const { hasPermission } = useRolesStore();
    const { config: msgConfig, updateConfig: updateMsgConfig } = useMessagingStore();
    const { groups: taskGroups, tasks: allTasksArr } = useTasksStore();
    const rh = useRoleHref();
    const canManageRoles = hasPermission(currentUser.role, "settings:roles");
    const canManagePageBuilder = hasPermission(currentUser.role, "settings:page_builder");

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

    const handleChangePassword = () => {
        if (pwNew !== pwConfirm) { toast.error("Passwords do not match."); return; }
        const result = changePassword(currentUser.id, pwOld, pwNew);
        if (!result.ok) { toast.error(result.error); return; }
        toast.success("Password changed successfully.");
        setPwOld(""); setPwNew(""); setPwConfirm("");
    };

    // ─── User Account Management ──────────────────────────────────
    const [addUserOpen, setAddUserOpen] = useState(false);
    const [newUserName, setNewUserName] = useState("");
    const [newUserEmail, setNewUserEmail] = useState("");
    const [newUserRole, setNewUserRole] = useState<Role>("employee");
    const [newUserPw, setNewUserPw] = useState("");
    const [newUserMustChange, setNewUserMustChange] = useState(true);
    const [resetPwUserId, setResetPwUserId] = useState<string | null>(null);
    const [resetPwValue, setResetPwValue] = useState("");

    const handleCreateUser = () => {
        if (!newUserName || !newUserEmail || !newUserPw) { toast.error("Please fill all required fields."); return; }
        const result = createAccount({ name: newUserName, email: newUserEmail, role: newUserRole, password: newUserPw, mustChangePassword: newUserMustChange }, currentUser.email);
        if (!result.ok) { toast.error(result.error); return; }
        toast.success(`Account created for ${newUserName}.`);
        setNewUserName(""); setNewUserEmail(""); setNewUserPw(""); setNewUserRole("employee"); setAddUserOpen(false);
    };

    const handleResetPassword = () => {
        if (!resetPwUserId || resetPwValue.length < 6) { toast.error("Password must be at least 6 characters."); return; }
        adminSetPassword(resetPwUserId, resetPwValue);
        toast.success("Password reset. User will be prompted to change it on next login.");
        setResetPwUserId(null); setResetPwValue("");
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

    return (
        <>
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground mt-0.5">System administration &amp; preferences</p>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link href={rh("/settings/organization")}>
                    <Card className="border border-blue-500/20 bg-blue-500/5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
                        <CardContent className="p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center"><Building2 className="h-4 w-4 text-blue-500" /></div><div><p className="text-sm font-semibold group-hover:text-blue-600 transition-colors">Org Structure</p><p className="text-xs text-muted-foreground">Departments &amp; positions</p></div></div><ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" /></div></CardContent>
                    </Card>
                </Link>
                <Link href={rh("/settings/shifts")}>
                    <Card className="border border-purple-500/20 bg-purple-500/5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
                        <CardContent className="p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center"><Clock3 className="h-4 w-4 text-purple-500" /></div><div><p className="text-sm font-semibold group-hover:text-purple-600 transition-colors">Shifts &amp; Time</p><p className="text-xs text-muted-foreground">Shift templates &amp; assignments</p></div></div><ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" /></div></CardContent>
                    </Card>
                </Link>
            </div>

            {/* Admin Customization Cards */}
            {(canManageRoles || canManagePageBuilder) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {([
                        { href: "/settings/roles", color: "amber", icon: Shield, title: "Roles & Permissions", desc: "Manage roles & access" },
                        { href: "/settings/dashboard-builder", color: "emerald", icon: LayoutDashboard, title: "Dashboard Builder", desc: "Customize per-role dashboards" },
                        { href: "/settings/page-builder", color: "rose", icon: FileText, title: "Page Builder", desc: "Create custom pages" },
                        { href: "/settings/appearance", color: "violet", icon: Palette, title: "Appearance", desc: "Theme, typography & shell" },
                        { href: "/settings/branding", color: "cyan", icon: Building2, title: "Branding", desc: "Logo, identity & login page" },
                        { href: "/settings/modules", color: "teal", icon: Puzzle, title: "Modules", desc: "Enable/disable features" },
                        { href: "/settings/navigation", color: "orange", icon: ClipboardList, title: "Navigation", desc: "Reorder & customize sidebar" },
                        { href: "/settings/kiosk", color: "emerald", icon: Tablet, title: "Kiosk", desc: "Attendance kiosk settings" },
                        { href: "/settings/location", color: "cyan", icon: MapPin, title: "Location & GPS", desc: "Tracking, selfie & break rules" },
                        { href: "/settings/notifications", color: "amber", icon: Bell, title: "Notifications", desc: "Rules, channels & templates" },
                    ]).map((card) => (
                        <Link key={card.href} href={rh(card.href)}>
                            <Card className={`border border-${card.color}-500/20 bg-${card.color}-500/5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group`}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`h-9 w-9 rounded-lg bg-${card.color}-500/10 flex items-center justify-center`}>
                                                <card.icon className={`h-4 w-4 text-${card.color}-500`} />
                                            </div>
                                            <div>
                                                <p className={`text-sm font-semibold group-hover:text-${card.color}-600 transition-colors`}>{card.title}</p>
                                                <p className="text-xs text-muted-foreground">{card.desc}</p>
                                            </div>
                                        </div>
                                        <ExternalLink className={`h-4 w-4 text-muted-foreground group-hover:text-${card.color}-500 transition-colors`} />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            {/* Theme */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3"><div className="flex items-center gap-2"><Palette className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base font-semibold">Appearance</CardTitle></div></CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm font-medium">Theme</p><p className="text-xs text-muted-foreground">Choose your preferred theme</p></div>
                        <div className="flex items-center gap-2">
                            {([{ value: "light" as const, icon: Sun, label: "Light" }, { value: "dark" as const, icon: Moon, label: "Dark" }, { value: "system" as const, icon: Monitor, label: "System" }]).map((t) => (
                                <Button key={t.value} variant={theme === t.value ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => { setTheme(t.value); toast.success(`Theme set to ${t.label}`); }}><t.icon className="h-4 w-4" />{t.label}</Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Organization */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3"><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base font-semibold">Organization</CardTitle></div></CardHeader>
                <CardContent className="space-y-4">
                    <div><label className="text-sm font-medium">Company Name</label><Input value={settings.companyName} onChange={(e) => update({ companyName: e.target.value })} className="mt-1.5" /></div>
                    <div>
                        <label className="text-sm font-medium">Industry</label>
                        <Select value={settings.industry} onValueChange={(v) => update({ industry: v })}><SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="technology">Technology</SelectItem><SelectItem value="healthcare">Healthcare</SelectItem><SelectItem value="finance">Finance</SelectItem><SelectItem value="education">Education</SelectItem></SelectContent></Select>
                    </div>
                    <Button onClick={() => toast.success("Organization settings saved")} size="sm">Save Changes</Button>
                </CardContent>
            </Card>

            {/* Pay Schedule */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base font-semibold">Pay Schedule</CardTitle></div>
                    <p className="text-xs text-muted-foreground">Company-wide pay frequency &amp; cutoff configuration. Individual employees can be overridden from their profile.</p>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div>
                        <label className="text-sm font-medium">Default Pay Frequency</label>
                        <Select value={paySchedule.defaultFrequency} onValueChange={(v) => { updatePaySchedule({ defaultFrequency: v as PayFrequency }); toast.success(`Default frequency set to ${v.replace("_", "-")}`); }}>
                            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="monthly">Monthly (1x per month)</SelectItem><SelectItem value="semi_monthly">Semi-Monthly (2x per month)</SelectItem><SelectItem value="bi_weekly">Bi-Weekly (every 2 weeks)</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent>
                        </Select>
                    </div>
                    {paySchedule.defaultFrequency === "semi_monthly" && (
                        <div className="p-3 rounded-lg border border-border/50 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Semi-Monthly Cutoff</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div><label className="text-xs text-muted-foreground">1st Cutoff Day</label><Input type="number" min={1} max={28} value={paySchedule.semiMonthlyFirstCutoff} onChange={(e) => updatePaySchedule({ semiMonthlyFirstCutoff: Number(e.target.value) || 15 })} className="mt-1" /><p className="text-[10px] text-muted-foreground mt-0.5">e.g. 15 → 1st–15th</p></div>
                                <div><label className="text-xs text-muted-foreground">1st Pay Day</label><Input type="number" min={1} max={28} value={paySchedule.semiMonthlyFirstPayDay} onChange={(e) => updatePaySchedule({ semiMonthlyFirstPayDay: Number(e.target.value) || 20 })} className="mt-1" /><p className="text-[10px] text-muted-foreground mt-0.5">Pay release day</p></div>
                                <div><label className="text-xs text-muted-foreground">2nd Pay Day</label><Input type="number" min={1} max={28} value={paySchedule.semiMonthlySecondPayDay} onChange={(e) => updatePaySchedule({ semiMonthlySecondPayDay: Number(e.target.value) || 5 })} className="mt-1" /><p className="text-[10px] text-muted-foreground mt-0.5">Of next month</p></div>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Gov&apos;t Deductions From</label>
                                <Select value={paySchedule.deductGovFrom} onValueChange={(v) => updatePaySchedule({ deductGovFrom: v as "first" | "second" | "both" })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="first">1st Cutoff Only</SelectItem><SelectItem value="second">2nd Cutoff Only</SelectItem><SelectItem value="both">Split Across Both</SelectItem></SelectContent></Select>
                                <p className="text-[10px] text-muted-foreground mt-0.5">SSS, PhilHealth, Pag-IBIG &amp; tax deduction timing</p>
                            </div>
                        </div>
                    )}
                    {paySchedule.defaultFrequency === "monthly" && (
                        <div className="p-3 rounded-lg border border-border/50 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Monthly Pay Day</p>
                            <div><label className="text-xs text-muted-foreground">Pay Day</label><Input type="number" min={1} max={31} value={paySchedule.monthlyPayDay} onChange={(e) => updatePaySchedule({ monthlyPayDay: Number(e.target.value) || 30 })} className="mt-1" /><p className="text-[10px] text-muted-foreground mt-0.5">Day of month salary is released</p></div>
                        </div>
                    )}
                    {paySchedule.defaultFrequency === "bi_weekly" && (
                        <div className="p-3 rounded-lg border border-border/50 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Bi-Weekly Schedule</p>
                            <div><label className="text-xs text-muted-foreground">Reference Start Date</label><Input type="date" value={paySchedule.biWeeklyStartDate} onChange={(e) => updatePaySchedule({ biWeeklyStartDate: e.target.value })} className="mt-1" /><p className="text-[10px] text-muted-foreground mt-0.5">First pay period starts on this date, then every 2 weeks</p></div>
                        </div>
                    )}
                    {paySchedule.defaultFrequency === "weekly" && (
                        <div className="p-3 rounded-lg border border-border/50 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Weekly Pay Day</p>
                            <Select value={String(paySchedule.weeklyPayDay)} onValueChange={(v) => updatePaySchedule({ weeklyPayDay: Number(v) })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Monday</SelectItem><SelectItem value="2">Tuesday</SelectItem><SelectItem value="3">Wednesday</SelectItem><SelectItem value="4">Thursday</SelectItem><SelectItem value="5">Friday</SelectItem><SelectItem value="6">Saturday</SelectItem></SelectContent></Select>
                        </div>
                    )}
                    <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Current Setup</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {paySchedule.defaultFrequency === "semi_monthly" && `Semi-monthly: 1st\u2013${paySchedule.semiMonthlyFirstCutoff} (pay day ${paySchedule.semiMonthlyFirstPayDay}) & ${paySchedule.semiMonthlyFirstCutoff + 1}\u2013EOM (pay day ${paySchedule.semiMonthlySecondPayDay} next mo). Gov deductions from ${paySchedule.deductGovFrom === "both" ? "both cutoffs" : paySchedule.deductGovFrom === "first" ? "1st cutoff" : "2nd cutoff"}.`}
                            {paySchedule.defaultFrequency === "monthly" && `Monthly payroll released on the ${paySchedule.monthlyPayDay}th of each month.`}
                            {paySchedule.defaultFrequency === "bi_weekly" && `Bi-weekly starting ${paySchedule.biWeeklyStartDate}, every 14 days.`}
                            {paySchedule.defaultFrequency === "weekly" && `Weekly payroll every ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][paySchedule.weeklyPayDay]}.`}
                        </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => { updatePaySchedule(DEFAULT_PAY_SCHEDULE); toast.success("Pay schedule reset to defaults"); }}>Reset to Defaults</Button>
                </CardContent>
            </Card>

            {/* Roles & Permissions */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3"><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base font-semibold">Roles &amp; Permissions</CardTitle></div></CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {([{ role: "Admin", desc: "Full system access", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" }, { role: "HR", desc: "Employee management, attendance, leave", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" }, { role: "Finance", desc: "Payroll and financial data", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" }, { role: "Supervisor", desc: "Timesheet approval, team oversight", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400" }, { role: "Payroll Admin", desc: "Payroll processing, deduction management", color: "bg-violet-500/15 text-violet-700 dark:text-violet-400" }, { role: "Auditor", desc: "Read-only audit trail access", color: "bg-orange-500/15 text-orange-700 dark:text-orange-400" }, { role: "Employee", desc: "Self-service access only", color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" }]).map((r) => (
                            <div key={r.role} className="flex items-center justify-between p-3 rounded-lg border border-border/50"><div className="flex items-center gap-3"><Badge variant="secondary" className={`text-xs ${r.color}`}>{r.role}</Badge><span className="text-sm text-muted-foreground">{r.desc}</span></div></div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Timesheet Rule Sets */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base font-semibold">Timesheet Rule Sets</CardTitle></div>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleOpenAdd}><Plus className="h-4 w-4" />Add Rule Set</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {ruleSets.map((rs) => (
                            <div key={rs.id} className="p-3 rounded-lg border border-border/50 space-y-2">
                                <div className="flex items-center justify-between">
                                    <Badge variant="secondary" className="text-xs bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">{rs.name}</Badge>
                                    <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => handleOpenEdit(rs)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                    <span>Standard Hours: {rs.standardHoursPerDay}h/day</span><span>Grace Period: {rs.graceMinutes}min</span>
                                    <span>Rounding: {rs.roundingPolicy.replace("_", " ")}</span><span>OT Approval: {rs.overtimeRequiresApproval ? "Required" : "None"}</span>
                                    <span>Night Diff: {rs.nightDiffStart || "N/A"} — {rs.nightDiffEnd || "N/A"}</span><span>Holiday Mult: {rs.holidayMultiplier}x</span>
                                </div>
                            </div>
                        ))}
                        {ruleSets.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No rule sets configured.</p>}
                    </div>
                </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3"><div className="flex items-center gap-2"><Bell className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base font-semibold">Notifications</CardTitle></div></CardHeader>
                <CardContent className="space-y-4">
                    {([{ key: "emailAbsenceAlerts" as const, label: "Absence alerts", desc: "Email when an employee is absent" }, { key: "emailLeaveUpdates" as const, label: "Leave updates", desc: "Email when leave is approved/rejected" }, { key: "emailPayrollAlerts" as const, label: "Payroll alerts", desc: "Email when payslips are issued" }]).map((n) => (
                        <div key={n.key} className="flex items-center justify-between"><div><p className="text-sm font-medium">{n.label}</p><p className="text-xs text-muted-foreground">{n.desc}</p></div><Switch checked={settings[n.key]} onCheckedChange={(checked) => { update({ [n.key]: checked }); toast.success(`${n.label} ${checked ? "enabled" : "disabled"}`); }} /></div>
                    ))}
                </CardContent>
            </Card>

            {/* Messaging Channels */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3"><div className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base font-semibold">Messaging Channels</CardTitle></div></CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Default Delivery Channel</label>
                        <Select value={msgConfig.defaultChannel} onValueChange={(v) => { updateMsgConfig({ defaultChannel: v as "email" | "whatsapp" | "sms" | "in_app" }); toast.success(`Default channel set to ${v}`); }}>
                            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="email">✉️ Email (Resend)</SelectItem>
                                <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                                <SelectItem value="in_app">🔔 In-App</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center justify-between">
                        <div><p className="text-sm font-medium">WhatsApp</p><p className="text-xs text-muted-foreground">Meta Cloud API (simulated in MVP)</p></div>
                        <Switch checked={msgConfig.whatsappEnabled} onCheckedChange={(v) => { updateMsgConfig({ whatsappEnabled: v }); toast.success(`WhatsApp ${v ? "enabled" : "disabled"}`); }} />
                    </div>
                    <div className="flex items-center justify-between opacity-60">
                        <div><p className="text-sm font-medium flex items-center gap-2">SMS <Badge variant="outline" className="text-[10px]">Coming Soon</Badge></p><p className="text-xs text-muted-foreground">Semaphore — not available yet</p></div>
                        <Switch checked={false} disabled />
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm font-medium">Email Sender</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs text-muted-foreground">From Name</label><Input value={msgConfig.emailFromName} onChange={(e) => updateMsgConfig({ emailFromName: e.target.value })} className="mt-1" /></div>
                            <div><label className="text-xs text-muted-foreground">From Address</label><Input value={msgConfig.emailFromAddress} onChange={(e) => updateMsgConfig({ emailFromAddress: e.target.value })} className="mt-1" /></div>
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-400">MVP Note</p>
                        <p className="text-xs text-muted-foreground mt-0.5">All channels are simulated — messages are logged to the messaging store. Production requires Resend API key (email), Meta Cloud credentials (WhatsApp), and Semaphore API key (SMS).</p>
                    </div>
                </CardContent>
            </Card>

            {/* Task Management */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3"><div className="flex items-center gap-2"><ListTodo className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base font-semibold">Task Management</CardTitle></div></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50"><p className="text-xl font-bold">{taskGroups.length}</p><p className="text-xs text-muted-foreground">Task Groups</p></div>
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50"><p className="text-xl font-bold">{allTasksArr.length}</p><p className="text-xs text-muted-foreground">Total Tasks</p></div>
                        <div className="p-3 rounded-lg bg-muted/50 border border-border/50"><p className="text-xl font-bold">{allTasksArr.filter((t) => t.status === "open" || t.status === "in_progress").length}</p><p className="text-xs text-muted-foreground">Active</p></div>
                    </div>
                    <p className="text-sm text-muted-foreground">Manage task groups, assignments, and completion requirements from the <Link href={rh("/tasks")} className="text-primary underline-offset-4 hover:underline">Tasks page</Link>.</p>
                </CardContent>
            </Card>

            {/* Security */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3"><div className="flex items-center gap-2"><Lock className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base font-semibold">Security</CardTitle></div></CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">Change your account password.</p>
                    <div className="grid gap-3 max-w-sm">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Current Password</label>
                            <div className="relative">
                                <Input type={showPw ? "text" : "password"} value={pwOld} onChange={(e) => setPwOld(e.target.value)} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" />
                                <button type="button" className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => setShowPw((v) => !v)}>{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                            </div>
                        </div>
                        <div className="space-y-1.5"><label className="text-sm font-medium">New Password</label><Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="Min. 6 characters" /></div>
                        <div className="space-y-1.5"><label className="text-sm font-medium">Confirm New Password</label><Input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="Re-enter new password" /></div>
                        <Button className="w-full" onClick={handleChangePassword} disabled={!pwOld || !pwNew || !pwConfirm}><KeyRound className="w-4 h-4 mr-1.5" /> Update Password</Button>
                    </div>
                </CardContent>
            </Card>

            {/* User Accounts */}
            {canManageRoles && (
                <Card className="border border-border/50">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base font-semibold">User Accounts</CardTitle></div>
                            <Button size="sm" onClick={() => setAddUserOpen(true)}><UserPlus className="w-4 h-4 mr-1.5" /> Add Account</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {accounts.map((acc) => (
                            <div key={acc.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">{acc.name.charAt(0)}</div>
                                    <div className="min-w-0"><p className="text-sm font-medium truncate">{acc.name}</p><p className="text-xs text-muted-foreground truncate">{acc.email}</p></div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <Badge variant="secondary" className="text-[10px] capitalize">{acc.role}</Badge>
                                    {acc.mustChangePassword && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">pw reset</Badge>}
                                    {!acc.profileComplete && <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">onboarding</Badge>}
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Reset password" onClick={() => { setResetPwUserId(acc.id); setResetPwValue(""); }}><KeyRound className="w-3.5 h-3.5" /></Button>
                                    {acc.id !== currentUser.id && <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Delete account" onClick={() => { deleteAccount(acc.id); toast.success(`Account for ${acc.name} deleted.`); }}><Trash2 className="w-3.5 h-3.5" /></Button>}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Danger Zone */}
            {canManageRoles && (
                <Card className="border-destructive/40">
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-destructive"><TriangleAlert className="w-4 h-4" /> Danger Zone</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm font-medium">Reset All Demo Data</p><p className="text-xs text-muted-foreground">Wipes every store and restores seed data. You will be logged out.</p></div>
                            <Button variant="destructive" size="sm" className="ml-4 shrink-0" onClick={() => setResetAllOpen(true)}><RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset All Data</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Edit Rule Set Dialog */}
            <Dialog open={editRuleOpen} onOpenChange={setEditRuleOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Edit Timesheet Rule Set — {editingRule?.id}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div><label className="text-sm font-medium">Rule Set Name *</label><Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g., Standard PH Rule Set" className="mt-1" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium">Standard Hours/Day *</label><Input type="number" min="1" max="24" step="0.5" value={editStandardHours} onChange={(e) => setEditStandardHours(e.target.value)} className="mt-1" /></div>
                            <div><label className="text-sm font-medium">Grace Period (minutes) *</label><Input type="number" min="0" max="60" value={editGraceMinutes} onChange={(e) => setEditGraceMinutes(e.target.value)} className="mt-1" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium">Rounding Policy</label><Select value={editRoundingPolicy} onValueChange={(v) => setEditRoundingPolicy(v as "none" | "nearest_15" | "nearest_30")}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="nearest_15">Nearest 15 min</SelectItem><SelectItem value="nearest_30">Nearest 30 min</SelectItem></SelectContent></Select></div>
                            <div><label className="text-sm font-medium">Holiday Multiplier</label><Input type="number" min="1" max="5" step="0.1" value={editHolidayMultiplier} onChange={(e) => setEditHolidayMultiplier(e.target.value)} className="mt-1" /></div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/50"><div><p className="text-sm font-medium">Overtime Requires Approval</p><p className="text-xs text-muted-foreground">OT hours must be pre-approved before counting</p></div><Switch checked={editOTRequired} onCheckedChange={setEditOTRequired} /></div>
                        <div>
                            <label className="text-sm font-medium">Night Differential Hours</label>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div><label className="text-xs text-muted-foreground">Start Time</label><Input type="time" value={editNightDiffStart} onChange={(e) => setEditNightDiffStart(e.target.value)} className="mt-1" /></div>
                                <div><label className="text-xs text-muted-foreground">End Time</label><Input type="time" value={editNightDiffEnd} onChange={(e) => setEditNightDiffEnd(e.target.value)} className="mt-1" /></div>
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
                            <div><label className="text-sm font-medium">Standard Hours/Day *</label><Input type="number" min="1" max="24" step="0.5" value={newStandardHours} onChange={(e) => setNewStandardHours(e.target.value)} className="mt-1" /></div>
                            <div><label className="text-sm font-medium">Grace Period (minutes) *</label><Input type="number" min="0" max="60" value={newGraceMinutes} onChange={(e) => setNewGraceMinutes(e.target.value)} className="mt-1" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium">Rounding Policy</label><Select value={newRoundingPolicy} onValueChange={(v) => setNewRoundingPolicy(v as "none" | "nearest_15" | "nearest_30")}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None (exact minutes)</SelectItem><SelectItem value="nearest_15">Nearest 15 min</SelectItem><SelectItem value="nearest_30">Nearest 30 min</SelectItem></SelectContent></Select></div>
                            <div><label className="text-sm font-medium">Holiday Multiplier</label><Input type="number" min="1" max="5" step="0.1" value={newHolidayMultiplier} onChange={(e) => setNewHolidayMultiplier(e.target.value)} className="mt-1" /></div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/50"><div><p className="text-sm font-medium">Overtime Requires Approval</p><p className="text-xs text-muted-foreground">OT hours must be pre-approved before counting</p></div><Switch checked={newOTRequired} onCheckedChange={setNewOTRequired} /></div>
                        <div>
                            <label className="text-sm font-medium">Night Differential Hours</label>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div><label className="text-xs text-muted-foreground">Start Time</label><Input type="time" value={newNightDiffStart} onChange={(e) => setNewNightDiffStart(e.target.value)} className="mt-1" /></div>
                                <div><label className="text-xs text-muted-foreground">End Time</label><Input type="time" value={newNightDiffEnd} onChange={(e) => setNewNightDiffEnd(e.target.value)} className="mt-1" /></div>
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Common Presets</p>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setNewName("Night Shift Rule Set"); setNewStandardHours("8"); setNewGraceMinutes("15"); setNewNightDiffStart("22:00"); setNewNightDiffEnd("06:00"); }}>Night Shift (22:00-06:00)</Button>
                                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setNewName("Flexible Hours Rule Set"); setNewStandardHours("6"); setNewGraceMinutes("30"); setNewRoundingPolicy("none"); }}>Flexible (6h, 30min grace)</Button>
                                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setNewName("12-Hour Shift Rule Set"); setNewStandardHours("12"); setNewGraceMinutes("10"); }}>12-Hour Shift</Button>
                                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => { setNewName("Part-Time Rule Set"); setNewStandardHours("4"); setNewGraceMinutes("5"); setNewOTRequired(false); }}>Part-Time (4h)</Button>
                            </div>
                        </div>
                        <Button onClick={handleCreateNew} className="w-full">Create Rule Set</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add User Dialog */}
            <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader><DialogTitle>Create New Account</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-1">
                        <div className="space-y-1.5"><label className="text-sm font-medium">Full Name *</label><Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="e.g. Maria Santos" /></div>
                        <div className="space-y-1.5"><label className="text-sm font-medium">Email *</label><Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="maria@nexhrms.com" /></div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Role *</label>
                            <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as Role)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["admin","hr","finance","employee","supervisor","payroll_admin","auditor"] as Role[]).map((r) => (<SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>))}</SelectContent></Select>
                        </div>
                        <div className="space-y-1.5"><label className="text-sm font-medium">Initial Password *</label><Input type="password" value={newUserPw} onChange={(e) => setNewUserPw(e.target.value)} placeholder="Min. 6 characters" /></div>
                        <div className="flex items-center justify-between pt-1"><div><p className="text-sm font-medium">Require password change</p><p className="text-xs text-muted-foreground">User must create a new password on first login</p></div><Switch checked={newUserMustChange} onCheckedChange={setNewUserMustChange} /></div>
                        <div className="flex gap-2 pt-2"><Button variant="outline" className="flex-1" onClick={() => setAddUserOpen(false)}>Cancel</Button><Button className="flex-1" onClick={handleCreateUser}><UserPlus className="w-4 h-4 mr-1.5" /> Create Account</Button></div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reset Password Dialog */}
            <Dialog open={!!resetPwUserId} onOpenChange={(o) => { if (!o) { setResetPwUserId(null); setResetPwValue(""); } }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-1">
                        <p className="text-sm text-muted-foreground">Set a new temporary password for <strong>{accounts.find((a) => a.id === resetPwUserId)?.name}</strong>.</p>
                        <div className="space-y-1.5"><label className="text-sm font-medium">New Password *</label><Input type="password" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)} placeholder="Min. 6 characters" /></div>
                        <div className="flex gap-2 pt-1"><Button variant="outline" className="flex-1" onClick={() => { setResetPwUserId(null); setResetPwValue(""); }}>Cancel</Button><Button className="flex-1" onClick={handleResetPassword}><KeyRound className="w-4 h-4 mr-1.5" /> Reset Password</Button></div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>

        {/* Reset All Data Confirmation */}
        <AlertDialog open={resetAllOpen} onOpenChange={setResetAllOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Reset All Demo Data?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently wipe all data across every module and restore the original seed / demo state. You will be logged out immediately.<br /><br /><strong>This action cannot be undone.</strong></AlertDialogDescription>
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
