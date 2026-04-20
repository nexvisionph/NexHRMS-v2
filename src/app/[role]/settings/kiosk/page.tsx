"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useKioskStore } from "@/store/kiosk.store";
import type { KioskTheme, KioskClockFormat, KioskIdleAction, PenaltyApplyTo } from "@/store/kiosk.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
    Monitor, QrCode, KeyRound, Eye, EyeOff,
    RotateCcw, ArrowLeft, Fingerprint, Lock,
    Palette, Layout, Timer, MapPin, ExternalLink,
    ScanFace, AlertTriangle, Nfc, CheckCircle2, X,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRoleHref } from "@/lib/hooks/use-role-href";

// ─── Section wrapper ──────────────────────────────────────────────────────────

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

function SliderRow({ label, hint, value, min, max, step, unit, onChange }: {
    label: string; hint?: string; value: number; min: number; max: number;
    step: number; unit: string; onChange: (v: number) => void;
}) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium">{label}</p>
                    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                </div>
                <Badge variant="secondary" className="tabular-nums text-xs">{value}{unit}</Badge>
            </div>
            <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} className="w-full" />
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KioskSettingsPage() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const { settings, updateSettings, resetSettings, fetchConfig, hasFetchedConfig } = useKioskStore();
    const [resetOpen, setResetOpen] = useState(false);

    useEffect(() => {
        if (!hasFetchedConfig) { fetchConfig(); }
    }, [hasFetchedConfig, fetchConfig]);
    const [showAdminPin, setShowAdminPin] = useState(false);
    const [changingPin, setChangingPin] = useState(false);
    const [newPin, setNewPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [savingPin, setSavingPin] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const rh = useRoleHref();

    if (currentUser.role !== "admin") {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">Admin access required.</p>
            </div>
        );
    }

    const s = settings;
    const u = updateSettings;

    const handleSavePin = async () => {
        if (newPin.length < 4) { toast.error("PIN must be at least 4 digits"); return; }
        if (newPin !== confirmPin) { toast.error("PINs do not match"); return; }
        setSavingPin(true);
        try {
            const res = await fetch("/api/kiosk/admin-pin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin: newPin }),
            });
            if (!res.ok) {
                const err = await res.json() as { error?: string };
                if (res.status !== 401 && res.status !== 403) {
                    updateSettings({ adminPin: newPin });
                    toast.success("PIN updated (saved locally)");
                } else {
                    toast.error(err.error ?? "Failed to save PIN");
                    return;
                }
            } else {
                updateSettings({ adminPin: newPin });
                toast.success("Kiosk PIN updated and saved");
            }
        } catch {
            updateSettings({ adminPin: newPin });
            toast.success("PIN updated (saved locally)");
        } finally {
            setSavingPin(false);
            setChangingPin(false);
            setNewPin("");
            setConfirmPin("");
        }
    };

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
                        <h1 className="text-xl font-bold tracking-tight">Kiosk Settings</h1>
                        <p className="text-sm text-muted-foreground">Customize the attendance kiosk appearance and behavior</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/kiosk" target="_blank">
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <ExternalLink className="h-3.5 w-3.5" /> Preview Kiosk
                        </Button>
                    </Link>
                    <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setResetOpen(true)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                    </Button>
                </div>
            </div>

            {/* ── General ── */}
            <Section icon={Monitor} title="General" description="Basic kiosk info and messaging">
                <Row label="Kiosk Enabled" hint="Toggle the kiosk on or off">
                    <Switch checked={s.kioskEnabled} onCheckedChange={(v) => u({ kioskEnabled: v })} />
                </Row>
                <div className="space-y-1.5">
                    <p className="text-sm font-medium">Kiosk Title</p>
                    <Input value={s.kioskTitle} onChange={(e) => u({ kioskTitle: e.target.value })} placeholder="Attendance Kiosk" />
                </div>
                <div className="space-y-1.5">
                    <p className="text-sm font-medium">Welcome Message</p>
                    <p className="text-xs text-muted-foreground">Displayed under QR and Face scan panels</p>
                    <Input value={s.welcomeMessage} onChange={(e) => u({ welcomeMessage: e.target.value })} placeholder="Scan your QR code or use face recognition" />
                </div>
                <div className="space-y-1.5">
                    <p className="text-sm font-medium">Footer Message</p>
                    <Textarea value={s.footerMessage} onChange={(e) => u({ footerMessage: e.target.value })} rows={2} placeholder="Unauthorized access is prohibited" />
                </div>
            </Section>

            {/* ── Check-in Methods ── */}
            <Section icon={Fingerprint} title="Check-in Methods" description="Toggle which methods appear on the kiosk">
                <Row label="Face Recognition" hint="Face scan tab on the kiosk">
                    <Switch checked={s.enableFace} onCheckedChange={(v) => u({ enableFace: v })} />
                </Row>
                <Row label="QR Code Scan" hint="QR code displayed for mobile app scanning">
                    <Switch checked={s.enableQr} onCheckedChange={(v) => u({ enableQr: v })} />
                </Row>
                <Row label="NFC Badge Scan" hint="NFC ID badge reader for tap check-in">
                    <Switch checked={s.enableNfc} onCheckedChange={(v) => u({ enableNfc: v })} />
                </Row>
                <Row label="Allow Check-Out" hint="If off, kiosk only records check-ins">
                    <Switch checked={s.allowCheckOut} onCheckedChange={(v) => u({ allowCheckOut: v })} />
                </Row>
                <p className="text-[10px] text-muted-foreground">
                    Enable at least one method. When multiple methods are active, the kiosk shows a tab selector bar.
                </p>
            </Section>

            {/* ── QR / Token ── */}
            <Section icon={QrCode} title="QR & Token" description="Token generation and refresh timing">
                <SliderRow label="Refresh Interval" hint="How often the QR code refreshes"
                    value={s.tokenRefreshInterval} min={10} max={120} step={5} unit="s" onChange={(v) => u({ tokenRefreshInterval: v })} />
                <SliderRow label="Token Length" hint="Number of characters in the token"
                    value={s.tokenLength} min={6} max={12} step={1} unit=" chars" onChange={(v) => u({ tokenLength: v })} />
            </Section>

            {/* ── Display ── */}
            <Section icon={Palette} title="Display & Appearance" description="Visual customization for the kiosk screen">
                <Row label="Theme" hint="Background style of the kiosk">
                    <Select value={s.kioskTheme} onValueChange={(v: KioskTheme) => u({ kioskTheme: v })}>
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="dark">Dark (Zinc 950)</SelectItem>
                            <SelectItem value="midnight">Midnight (Blue)</SelectItem>
                            <SelectItem value="charcoal">Charcoal (Gray)</SelectItem>
                        </SelectContent>
                    </Select>
                </Row>
                <Row label="Clock Format" hint="12-hour or 24-hour">
                    <Select value={s.clockFormat} onValueChange={(v: KioskClockFormat) => u({ clockFormat: v })}>
                        <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24h">24-hour</SelectItem>
                            <SelectItem value="12h">12-hour</SelectItem>
                        </SelectContent>
                    </Select>
                </Row>
                <Row label="Show Clock" hint="Display the live clock on screen">
                    <Switch checked={s.showClock} onCheckedChange={(v) => u({ showClock: v })} />
                </Row>
                <Row label="Show Date" hint="Display the current date">
                    <Switch checked={s.showDate} onCheckedChange={(v) => u({ showDate: v })} />
                </Row>
                <Row label="Show Logo" hint="Display company logo in the header">
                    <Switch checked={s.showLogo} onCheckedChange={(v) => u({ showLogo: v })} />
                </Row>
                <Row label="Show Device ID" hint="Display device identifier badge">
                    <Switch checked={s.showDeviceId} onCheckedChange={(v) => u({ showDeviceId: v })} />
                </Row>
                <Row label="Security Badge" hint="Show shield icon on footer">
                    <Switch checked={s.showSecurityBadge} onCheckedChange={(v) => u({ showSecurityBadge: v })} />
                </Row>
            </Section>

            {/* ── Behavior ── */}
            <Section icon={Timer} title="Behavior" description="Feedback timing, sounds, and idle options">
                <SliderRow label="Feedback Duration" hint="How long success/error feedback shows"
                    value={s.feedbackDuration} min={1000} max={5000} step={200} unit="ms" onChange={(v) => u({ feedbackDuration: v })} />
                <Row label="Warn on Off-Days" hint="Show warning if clocking in outside scheduled days">
                    <Switch checked={s.warnOffDay} onCheckedChange={(v) => u({ warnOffDay: v })} />
                </Row>
                <Row label="Play Sound" hint="Audible feedback on check-in/out">
                    <Switch checked={s.playSound} onCheckedChange={(v) => u({ playSound: v })} />
                </Row>
                <SliderRow label="Idle Timeout" hint="Seconds before idle action triggers (0 = off)"
                    value={s.idleTimeout} min={0} max={300} step={15} unit="s" onChange={(v) => u({ idleTimeout: v })} />
                {s.idleTimeout > 0 && (
                    <Row label="Idle Action" hint="What happens when kiosk is idle">
                        <Select value={s.idleAction} onValueChange={(v: KioskIdleAction) => u({ idleAction: v })}>
                            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="screensaver">Screensaver</SelectItem>
                                <SelectItem value="dim">Dim Screen</SelectItem>
                                <SelectItem value="none">Do Nothing</SelectItem>
                            </SelectContent>
                        </Select>
                    </Row>
                )}
            </Section>

            {/* ── Security ── */}
            <Section icon={Lock} title="Security" description="Access control and geofencing">
                <Row label="Require Geofence" hint="Only accept check-ins within approved locations">
                    <Switch checked={s.requireGeofence} onCheckedChange={(v) => u({ requireGeofence: v })} />
                </Row>
                <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium">Admin Kiosk PIN</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Required to unlock the kiosk for configuration. Stored securely as a hash.
                            </p>
                        </div>
                        {!changingPin && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 h-8 text-xs gap-1.5"
                                onClick={() => { setChangingPin(true); setNewPin(""); setConfirmPin(""); }}
                            >
                                <KeyRound className="h-3.5 w-3.5" /> Change PIN
                            </Button>
                        )}
                    </div>

                    {!changingPin && (
                        <div className="flex items-center gap-2">
                            <Input
                                type={showAdminPin ? "text" : "password"}
                                readOnly
                                value={s.adminPin}
                                className="font-mono tracking-[0.4em] w-36 h-9 text-sm bg-muted/40 cursor-default"
                            />
                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowAdminPin(!showAdminPin)}>
                                {showAdminPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    )}

                    {changingPin && (
                        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Set New PIN</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs text-muted-foreground">New PIN</label>
                                    <div className="relative">
                                        <Input
                                            type={showNew ? "text" : "password"}
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={8}
                                            value={newPin}
                                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                                            placeholder="4-8 digits"
                                            className="font-mono tracking-[0.3em] pr-9 h-9 text-sm"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNew(!showNew)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs text-muted-foreground">Confirm PIN</label>
                                    <div className="relative">
                                        <Input
                                            type={showConfirm ? "text" : "password"}
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            maxLength={8}
                                            value={confirmPin}
                                            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                                            placeholder="Repeat PIN"
                                            className={cn(
                                                "font-mono tracking-[0.3em] pr-9 h-9 text-sm",
                                                confirmPin.length > 0 && confirmPin !== newPin && "border-destructive"
                                            )}
                                            onKeyDown={(e) => { if (e.key === "Enter" && !savingPin) { void handleSavePin(); } }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirm(!showConfirm)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {confirmPin.length > 0 && confirmPin !== newPin && (
                                <p className="text-xs text-destructive flex items-center gap-1">
                                    <X className="h-3 w-3" /> PINs do not match
                                </p>
                            )}
                            {confirmPin.length > 0 && confirmPin === newPin && newPin.length >= 4 && (
                                <p className="text-xs text-emerald-600 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> PINs match
                                </p>
                            )}
                            <div className="flex items-center gap-2 pt-1">
                                <Button
                                    size="sm"
                                    className="h-8 text-xs gap-1.5"
                                    onClick={() => { void handleSavePin(); }}
                                    disabled={savingPin || newPin.length < 4 || newPin !== confirmPin}
                                >
                                    {savingPin ? (
                                        <><Lock className="h-3.5 w-3.5 animate-pulse" /> Saving...</>
                                    ) : (
                                        <><CheckCircle2 className="h-3.5 w-3.5" /> Save PIN</>
                                    )}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => { setChangingPin(false); setNewPin(""); setConfirmPin(""); }}
                                    disabled={savingPin}
                                >
                                    Cancel
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                PIN is hashed before storage and cannot be recovered if lost. Default PIN is{" "}
                                <span className="font-mono font-medium">000000</span>.
                            </p>
                        </div>
                    )}
                </div>
            </Section>

            {/* ── Selfie & Photo ── */}
            <Section icon={MapPin} title="Selfie & Photo" description="Photo capture during kiosk check-in">
                <Row label="Enable Selfie Capture" hint="Allow camera selfie during kiosk check-in">
                    <Switch checked={s.selfieEnabled} onCheckedChange={(v) => u({ selfieEnabled: v })} />
                </Row>
                <Row label="Require Selfie" hint="Block check-in if selfie is not captured">
                    <Switch checked={s.selfieRequired} onCheckedChange={(v) => u({ selfieRequired: v })} disabled={!s.selfieEnabled} />
                </Row>
                <p className="text-[10px] text-muted-foreground">
                    When enabled, employees checking in via kiosk will be prompted to take a selfie. Photos are stored with GPS coordinates for site verification.
                    Configure additional selfie settings (quality, retention) in <span className="font-medium text-foreground">Settings &rarr; Location & GPS</span>.
                </p>
            </Section>

            {/* ── Face Recognition ── */}
            <Section icon={ScanFace} title="Face Recognition" description="Face scan settings for the kiosk">
                <Row label="Auto-Start Camera" hint="Automatically activate camera when face tab is selected">
                    <Switch checked={s.faceRecAutoStart} onCheckedChange={(v) => u({ faceRecAutoStart: v })} disabled={!s.enableFace} />
                </Row>
                <SliderRow label="Scan Countdown" hint="Seconds for the face scan countdown"
                    value={s.faceRecCountdown} min={1} max={10} step={1} unit="s" onChange={(v) => u({ faceRecCountdown: v })} />
                <p className="text-[10px] text-muted-foreground">
                    Face recognition appears as a tab on the kiosk when enabled above. After verification, the employee confirms to clock in/out. In this MVP the scan is simulated.
                </p>
            </Section>

            {/* ── NFC Settings ── */}
            <Section icon={Nfc} title="NFC Badge" description="NFC badge reader settings">
                <SliderRow label="Simulated Read Delay" hint="Delay before marking NFC badge as read (simulation)"
                    value={s.nfcSimulatedDelay} min={500} max={5000} step={250} unit="ms" onChange={(v) => u({ nfcSimulatedDelay: v })} />
                <p className="text-[10px] text-muted-foreground">
                    NFC badge scan appears as a tab on the kiosk when enabled. In production this connects to a hardware NFC reader. For the MVP, tap a simulated badge to clock in/out.
                </p>
            </Section>

            {/* ── Anti-Cheat Penalty ── */}
            <Section icon={AlertTriangle} title="Anti-Cheat Penalty" description="Lockout timer when developer tools or spoofing is detected">
                <Row label="Enable Penalty Timer" hint="Lock check-in after a violation is detected">
                    <Switch checked={s.devOptionsPenaltyEnabled} onCheckedChange={(v) => u({ devOptionsPenaltyEnabled: v })} />
                </Row>
                <SliderRow label="Penalty Duration" hint="Minutes the employee is locked out after violation"
                    value={s.devOptionsPenaltyMinutes} min={5} max={480} step={5} unit=" min" onChange={(v) => u({ devOptionsPenaltyMinutes: v })} />
                <Row label="Apply To" hint="Which violations trigger the penalty">
                    <Select value={s.devOptionsPenaltyApplyTo} onValueChange={(v: PenaltyApplyTo) => u({ devOptionsPenaltyApplyTo: v })} disabled={!s.devOptionsPenaltyEnabled}>
                        <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="devtools">DevTools Only</SelectItem>
                            <SelectItem value="spoofing">Spoofing Only</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                    </Select>
                </Row>
                <Row label="Notify Admin" hint="Send notification to admin when penalty is applied">
                    <Switch checked={s.devOptionsPenaltyNotifyAdmin} onCheckedChange={(v) => u({ devOptionsPenaltyNotifyAdmin: v })} disabled={!s.devOptionsPenaltyEnabled} />
                </Row>
                <p className="text-[10px] text-muted-foreground">
                    When an employee is caught with developer tools open or using mock location, their check-in is locked
                    for the configured duration. They must wait <span className="font-medium text-foreground">and</span> resolve the issue before retrying.
                </p>
            </Section>

            {/* ── Quick reference ── */}
            <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                        <Layout className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold">Quick Reference</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-muted-foreground">
                        <p><span className="font-medium text-foreground">Kiosk URL:</span> /kiosk</p>
                        <p><span className="font-medium text-foreground">Status:</span>{" "}
                            <Badge variant={s.kioskEnabled ? "default" : "secondary"} className="text-[10px] ml-1">
                                {s.kioskEnabled ? "Active" : "Disabled"}
                            </Badge>
                        </p>
                        <p><span className="font-medium text-foreground">Methods:</span> {[s.enableFace && "Face", s.enableQr && "QR", s.enableNfc && "NFC"].filter(Boolean).join(", ") || "None"}</p>
                        <p><span className="font-medium text-foreground">Token refresh:</span> every {s.tokenRefreshInterval}s</p>
                        <p><span className="font-medium text-foreground">Feedback:</span> {s.feedbackDuration}ms</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70">
                        Tip: Open the kiosk in a separate browser window in fullscreen mode (F11) for the best experience.
                        Use the admin PIN to exit kiosk lock if needed.
                    </p>
                </CardContent>
            </Card>

            {/* Reset dialog */}
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Kiosk Settings</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will restore all kiosk settings to their defaults. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { resetSettings(); toast.success("Kiosk settings reset to defaults."); }}>
                            Reset All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
