"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sun, Moon, Monitor, Palette, Bell, Lock, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════
   EMPLOYEE VIEW — Personal Preferences Only
   Theme, notification prefs, password change
   ═══════════════════════════════════════════════════════════════ */

const defaultPrefs = { emailAbsenceAlerts: true, emailLeaveUpdates: true, emailPayrollAlerts: true };
function readNotifPrefs() {
    if (typeof window === "undefined") return defaultPrefs;
    try { const s = localStorage.getItem("nexhrms-org-settings"); if (s) { const p = JSON.parse(s); return { emailAbsenceAlerts: p.emailAbsenceAlerts ?? true, emailLeaveUpdates: p.emailLeaveUpdates ?? true, emailPayrollAlerts: p.emailPayrollAlerts ?? true }; } } catch { /* ignore */ }
    return defaultPrefs;
}

function useNotificationPrefs() {
    const [prefs, setPrefs] = useState(readNotifPrefs);

    const update = (patch: Partial<typeof prefs>) => {
        setPrefs((prev) => {
            const next = { ...prev, ...patch };
            const stored = localStorage.getItem("nexhrms-org-settings");
            const full = stored ? { ...JSON.parse(stored), ...next } : next;
            localStorage.setItem("nexhrms-org-settings", JSON.stringify(full));
            return next;
        });
    };
    return { prefs, update };
}

export default function EmployeeSettingsView() {
    const { theme, setTheme, currentUser, changePassword } = useAuthStore();
    const { prefs, update } = useNotificationPrefs();

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

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-sm text-muted-foreground mt-0.5">Manage your personal preferences</p>
            </div>

            {/* Theme */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Palette className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base font-semibold">Appearance</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">Theme</p>
                            <p className="text-xs text-muted-foreground">Choose your preferred theme</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {([
                                { value: "light" as const, icon: Sun, label: "Light" },
                                { value: "dark" as const, icon: Moon, label: "Dark" },
                                { value: "system" as const, icon: Monitor, label: "System" },
                            ]).map((t) => (
                                <Button key={t.value} variant={theme === t.value ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => { setTheme(t.value); toast.success(`Theme set to ${t.label}`); }}>
                                    <t.icon className="h-4 w-4" />{t.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Notification Preferences */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base font-semibold">Notifications</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {([
                        { key: "emailAbsenceAlerts" as const, label: "Absence alerts", desc: "Notify when you are marked absent" },
                        { key: "emailLeaveUpdates" as const, label: "Leave updates", desc: "Notify when your leave is approved/rejected" },
                        { key: "emailPayrollAlerts" as const, label: "Payroll alerts", desc: "Notify when payslips are issued" },
                    ]).map((n) => (
                        <div key={n.key} className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">{n.label}</p>
                                <p className="text-xs text-muted-foreground">{n.desc}</p>
                            </div>
                            <Switch checked={prefs[n.key]} onCheckedChange={(checked) => { update({ [n.key]: checked }); toast.success(`${n.label} ${checked ? "enabled" : "disabled"}`); }} />
                        </div>
                    ))}
                </CardContent>
            </Card>

            {/* Security */}
            <Card className="border border-border/50">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base font-semibold">Security</CardTitle>
                    </div>
                </CardHeader>
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
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">New Password</label>
                            <Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} placeholder="Min. 6 characters" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Confirm New Password</label>
                            <Input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="Re-enter new password" />
                        </div>
                        <Button className="w-full" onClick={handleChangePassword} disabled={!pwOld || !pwNew || !pwConfirm}>
                            <KeyRound className="w-4 h-4 mr-1.5" /> Update Password
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
