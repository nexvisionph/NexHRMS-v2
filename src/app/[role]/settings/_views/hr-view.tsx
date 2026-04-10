"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useTimesheetStore } from "@/store/timesheet.store";
import { usePayrollStore, DEFAULT_PAY_SCHEDULE } from "@/store/payroll.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sun, Moon, Monitor, Building2, Palette, Bell, Lock, Eye, EyeOff, KeyRound, ClipboardList, Pencil, Plus, Clock3, ExternalLink, Wallet, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import type { AttendanceRuleSet, PayFrequency } from "@/types";
import Link from "next/link";
import { useRoleHref } from "@/lib/hooks/use-role-href";

/* ═══════════════════════════════════════════════════════════════
   HR VIEW — Organization Management + Personal Preferences
   Org nav cards, pay schedule, rule sets, theme, notifications, security
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

export default function HrSettingsView() {
    const { theme, setTheme, currentUser, changePassword } = useAuthStore();
    const { settings, update } = useOrgSettings();
    const { ruleSets, updateRuleSet, addRuleSet } = useTimesheetStore();
    const { paySchedule, updatePaySchedule } = usePayrollStore();
    const rh = useRoleHref();

    // ─── Password ─────────────────────────────────────────────────────
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

    // ─── Rule Set Editing ─────────────────────────────────────────────
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
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">HR Settings</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Organization &amp; workforce configuration</p>
            </div>

            {/* Nav Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link href={rh("/settings/organization")}>
                    <Card className="border border-blue-500/20 bg-blue-500/5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center"><Building2 className="h-4 w-4 text-blue-500" /></div>
                                    <div><p className="text-sm font-semibold group-hover:text-blue-600 transition-colors">Org Structure</p><p className="text-xs text-muted-foreground">Departments &amp; positions</p></div>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>
                <Link href={rh("/settings/shifts")}>
                    <Card className="border border-purple-500/20 bg-purple-500/5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center"><Clock3 className="h-4 w-4 text-purple-500" /></div>
                                    <div><p className="text-sm font-semibold group-hover:text-purple-600 transition-colors">Shifts &amp; Time</p><p className="text-xs text-muted-foreground">Shift templates &amp; assignments</p></div>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-purple-500 transition-colors" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

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
                        <Select value={settings.industry} onValueChange={(v) => update({ industry: v })}>
                            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="technology">Technology</SelectItem><SelectItem value="healthcare">Healthcare</SelectItem><SelectItem value="finance">Finance</SelectItem><SelectItem value="education">Education</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={() => toast.success("Organization settings saved")} size="sm">Save Changes</Button>
                </CardContent>
            </Card>

            {/* Pay Schedule */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-muted-foreground" /><CardTitle className="text-base font-semibold">Pay Schedule</CardTitle></div>
                    <p className="text-xs text-muted-foreground">Company-wide pay frequency &amp; cutoff configuration.</p>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div>
                        <label className="text-sm font-medium">Default Pay Frequency</label>
                        <Select value={paySchedule.defaultFrequency} onValueChange={(v) => { updatePaySchedule({ defaultFrequency: v as PayFrequency }); toast.success(`Default frequency set to ${v.replace("_", "-")}`); }}>
                            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="monthly">Monthly (1x per month)</SelectItem><SelectItem value="semi_monthly">Semi-Monthly (2x per month)</SelectItem><SelectItem value="bi_weekly">Bi-Weekly (every 2 weeks)</SelectItem><SelectItem value="weekly">Weekly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {paySchedule.defaultFrequency === "semi_monthly" && (
                        <div className="p-3 rounded-lg border border-border/50 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Semi-Monthly Cutoff</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div><label className="text-xs text-muted-foreground">1st Cutoff Day</label><Input type="number" min={1} max={28} value={paySchedule.semiMonthlyFirstCutoff} onChange={(e) => updatePaySchedule({ semiMonthlyFirstCutoff: Number(e.target.value) || 15 })} className="mt-1" /></div>
                                <div><label className="text-xs text-muted-foreground">1st Pay Day</label><Input type="number" min={1} max={28} value={paySchedule.semiMonthlyFirstPayDay} onChange={(e) => updatePaySchedule({ semiMonthlyFirstPayDay: Number(e.target.value) || 20 })} className="mt-1" /></div>
                                <div><label className="text-xs text-muted-foreground">2nd Pay Day</label><Input type="number" min={1} max={28} value={paySchedule.semiMonthlySecondPayDay} onChange={(e) => updatePaySchedule({ semiMonthlySecondPayDay: Number(e.target.value) || 5 })} className="mt-1" /></div>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Gov&apos;t Deductions From</label>
                                <Select value={paySchedule.deductGovFrom} onValueChange={(v) => updatePaySchedule({ deductGovFrom: v as "first" | "second" | "both" })}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="first">1st Cutoff Only</SelectItem><SelectItem value="second">2nd Cutoff Only</SelectItem><SelectItem value="both">Split Across Both</SelectItem></SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    {paySchedule.defaultFrequency === "monthly" && (
                        <div className="p-3 rounded-lg border border-border/50 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Monthly Pay Day</p>
                            <div><label className="text-xs text-muted-foreground">Pay Day</label><Input type="number" min={1} max={31} value={paySchedule.monthlyPayDay} onChange={(e) => updatePaySchedule({ monthlyPayDay: Number(e.target.value) || 30 })} className="mt-1" /></div>
                        </div>
                    )}
                    {paySchedule.defaultFrequency === "bi_weekly" && (
                        <div className="p-3 rounded-lg border border-border/50 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Bi-Weekly Schedule</p>
                            <div><label className="text-xs text-muted-foreground">Reference Start Date</label><Input type="date" value={paySchedule.biWeeklyStartDate} onChange={(e) => updatePaySchedule({ biWeeklyStartDate: e.target.value })} className="mt-1" /></div>
                        </div>
                    )}
                    {paySchedule.defaultFrequency === "weekly" && (
                        <div className="p-3 rounded-lg border border-border/50 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Weekly Pay Day</p>
                            <Select value={String(paySchedule.weeklyPayDay)} onValueChange={(v) => updatePaySchedule({ weeklyPayDay: Number(v) })}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="1">Monday</SelectItem><SelectItem value="2">Tuesday</SelectItem><SelectItem value="3">Wednesday</SelectItem><SelectItem value="4">Thursday</SelectItem><SelectItem value="5">Friday</SelectItem><SelectItem value="6">Saturday</SelectItem></SelectContent>
                            </Select>
                        </div>
                    )}
                    <Button size="sm" variant="outline" onClick={() => { updatePaySchedule(DEFAULT_PAY_SCHEDULE); toast.success("Pay schedule reset to defaults"); }}>Reset to Defaults</Button>
                </CardContent>
            </Card>

            {/* Roles (Read-only) */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3"><div className="flex items-center gap-2"><Badge variant="secondary" className="text-xs">Info</Badge><CardTitle className="text-base font-semibold">Roles &amp; Permissions</CardTitle></div></CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {([{ role: "Admin", desc: "Full system access", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" }, { role: "HR", desc: "Employee management, attendance, leave", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" }, { role: "Finance", desc: "Payroll and financial data", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" }, { role: "Supervisor", desc: "Timesheet approval, team oversight", color: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400" }, { role: "Employee", desc: "Self-service access only", color: "bg-purple-500/15 text-purple-700 dark:text-purple-400" }]).map((r) => (
                            <div key={r.role} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                                <div className="flex items-center gap-3"><Badge variant="secondary" className={`text-xs ${r.color}`}>{r.role}</Badge><span className="text-sm text-muted-foreground">{r.desc}</span></div>
                            </div>
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
                        <div key={n.key} className="flex items-center justify-between">
                            <div><p className="text-sm font-medium">{n.label}</p><p className="text-xs text-muted-foreground">{n.desc}</p></div>
                            <Switch checked={settings[n.key]} onCheckedChange={(checked) => { update({ [n.key]: checked }); toast.success(`${n.label} ${checked ? "enabled" : "disabled"}`); }} />
                        </div>
                    ))}
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
                                <button type="button" className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground" onClick={() => setShowPw((v) => !v)}>
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5"><label className="text-sm font-medium">New Password</label><Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="Min. 6 characters" /></div>
                        <div className="space-y-1.5"><label className="text-sm font-medium">Confirm New Password</label><Input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="Re-enter new password" /></div>
                        <Button className="w-full" onClick={handleChangePassword} disabled={!pwOld || !pwNew || !pwConfirm}><KeyRound className="w-4 h-4 mr-1.5" /> Update Password</Button>
                    </div>
                </CardContent>
            </Card>

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
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                            <div><p className="text-sm font-medium">Overtime Requires Approval</p><p className="text-xs text-muted-foreground">OT hours must be pre-approved before counting</p></div>
                            <Switch checked={editOTRequired} onCheckedChange={setEditOTRequired} />
                        </div>
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

            {/* Add New Rule Set Dialog */}
            <Dialog open={addRuleOpen} onOpenChange={setAddRuleOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Create New Timesheet Rule Set</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div><label className="text-sm font-medium">Rule Set Name *</label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Night Shift Rule Set" className="mt-1" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium">Standard Hours/Day *</label><Input type="number" min="1" max="24" step="0.5" value={newStandardHours} onChange={(e) => setNewStandardHours(e.target.value)} className="mt-1" /></div>
                            <div><label className="text-sm font-medium">Grace Period (minutes) *</label><Input type="number" min="0" max="60" value={newGraceMinutes} onChange={(e) => setNewGraceMinutes(e.target.value)} className="mt-1" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium">Rounding Policy</label><Select value={newRoundingPolicy} onValueChange={(v) => setNewRoundingPolicy(v as "none" | "nearest_15" | "nearest_30")}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="nearest_15">Nearest 15 min</SelectItem><SelectItem value="nearest_30">Nearest 30 min</SelectItem></SelectContent></Select></div>
                            <div><label className="text-sm font-medium">Holiday Multiplier</label><Input type="number" min="1" max="5" step="0.1" value={newHolidayMultiplier} onChange={(e) => setNewHolidayMultiplier(e.target.value)} className="mt-1" /></div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                            <div><p className="text-sm font-medium">Overtime Requires Approval</p><p className="text-xs text-muted-foreground">OT hours must be pre-approved before counting</p></div>
                            <Switch checked={newOTRequired} onCheckedChange={setNewOTRequired} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Night Differential Hours</label>
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div><label className="text-xs text-muted-foreground">Start Time</label><Input type="time" value={newNightDiffStart} onChange={(e) => setNewNightDiffStart(e.target.value)} className="mt-1" /></div>
                                <div><label className="text-xs text-muted-foreground">End Time</label><Input type="time" value={newNightDiffEnd} onChange={(e) => setNewNightDiffEnd(e.target.value)} className="mt-1" /></div>
                            </div>
                        </div>
                        <Button onClick={handleCreateNew} className="w-full">Create Rule Set</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
