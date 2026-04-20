"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useLocationStore } from "@/store/location.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    MapPin, ArrowLeft, RotateCcw, Camera, Navigation,
    Coffee,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRoleHref } from "@/lib/hooks/use-role-href";

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

export default function LocationSettingsPage() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const { config, updateConfig, resetToSeed, fetchConfig, hasFetchedConfig } = useLocationStore();
    const [resetOpen, setResetOpen] = useState(false);
    const rh = useRoleHref();

    // Load config from DB on first mount
    useEffect(() => {
        if (!hasFetchedConfig) fetchConfig();
    }, [hasFetchedConfig, fetchConfig]);

    if (currentUser.role !== "admin") {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">Admin access required.</p>
            </div>
        );
    }

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
                        <h1 className="text-xl font-bold tracking-tight">Location & GPS Settings</h1>
                        <p className="text-sm text-muted-foreground">Configure location tracking, selfie, and break rules</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setResetOpen(true)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
            </div>

            {/* Location Tracking */}
            <Section icon={Navigation} title="Location Tracking" description="Background GPS pinging for field employees">
                <Row label="Enable Tracking" hint="Background GPS pings while checked in">
                    <Switch checked={config.enabled} onCheckedChange={(v) => updateConfig({ enabled: v })} />
                </Row>
                <SliderRow
                    label="Ping Interval" hint="How often to record GPS coordinates"
                    value={config.pingIntervalMinutes} min={1} max={30} step={1} unit=" min"
                    onChange={(v) => updateConfig({ pingIntervalMinutes: v })}
                />
                <Row label="Require Location for Check-in" hint="Block check-in if GPS is unavailable">
                    <Switch checked={config.requireLocation} onCheckedChange={(v) => updateConfig({ requireLocation: v })} />
                </Row>
                <Row label="Warn Employee on Geofence Exit" hint="Show warning toast when employee leaves project area">
                    <Switch checked={config.warnEmployeeOutOfFence} onCheckedChange={(v) => updateConfig({ warnEmployeeOutOfFence: v })} />
                </Row>
                <Row label="Alert Admin on Geofence Exit" hint="Notify admin when employee leaves project area">
                    <Switch checked={config.alertAdminOutOfFence} onCheckedChange={(v) => updateConfig({ alertAdminOutOfFence: v })} />
                </Row>
                <Row label="Alert Admin When GPS Disabled" hint="Notify admin if employee turns off location">
                    <Switch checked={config.alertAdminLocationDisabled} onCheckedChange={(v) => updateConfig({ alertAdminLocationDisabled: v })} />
                </Row>
                <Row label="Track During Breaks" hint="Continue GPS pinging during lunch / break periods">
                    <Switch checked={config.trackDuringBreaks} onCheckedChange={(v) => updateConfig({ trackDuringBreaks: v })} />
                </Row>
                <SliderRow
                    label="Ping Retention" hint="Days to keep location ping history"
                    value={config.retainDays} min={7} max={90} step={1} unit=" days"
                    onChange={(v) => updateConfig({ retainDays: v })}
                />
            </Section>

            {/* Selfie / Photo */}
            <Section icon={Camera} title="Site Survey Selfie" description="Require photo evidence during check-in">
                <Row label="Require Selfie on Check-in" hint="Employee must take a selfie with GPS stamp">
                    <Switch checked={config.requireSelfie} onCheckedChange={(v) => updateConfig({ requireSelfie: v })} />
                </Row>
                <SliderRow
                    label="Image Quality" hint="JPEG compression quality (higher = larger file)"
                    value={Math.round(config.selfieCompressionQuality * 100)} min={30} max={100} step={5} unit="%"
                    onChange={(v) => updateConfig({ selfieCompressionQuality: v / 100 })}
                />
                <SliderRow
                    label="Photo Retention" hint="Days to keep selfie images"
                    value={config.selfieMaxAge} min={7} max={180} step={1} unit=" days"
                    onChange={(v) => updateConfig({ selfieMaxAge: v })}
                />
            </Section>

            {/* Break & Lunch Settings */}
            <Section icon={Coffee} title="Break & Lunch Rules" description="Configure lunch break duration and geofence enforcement">
                <SliderRow
                    label="Lunch Duration" hint="Standard lunch break length"
                    value={config.lunchDuration} min={15} max={120} step={5} unit=" min"
                    onChange={(v) => updateConfig({ lunchDuration: v })}
                />
                <Row label="Geofence on Break End" hint="Check if employee is within geofence when ending break">
                    <Switch checked={config.lunchGeofenceRequired} onCheckedChange={(v) => updateConfig({ lunchGeofenceRequired: v })} />
                </Row>
                <SliderRow
                    label="Overtime Threshold" hint="Minutes over lunch before flagging as overtime"
                    value={config.lunchOvertimeThreshold} min={1} max={30} step={1} unit=" min"
                    onChange={(v) => updateConfig({ lunchOvertimeThreshold: v })}
                />
                <SliderRow
                    label="Grace Period" hint="Extra minutes allowed before overtime warning"
                    value={config.breakGracePeriod} min={0} max={15} step={1} unit=" min"
                    onChange={(v) => updateConfig({ breakGracePeriod: v })}
                />
                <SliderRow
                    label="Max Breaks Per Day" hint="Maximum number of break sessions allowed"
                    value={config.allowedBreaksPerDay} min={1} max={5} step={1} unit=""
                    onChange={(v) => updateConfig({ allowedBreaksPerDay: v })}
                />
            </Section>

            {/* Summary */}
            <Card className="border border-border/50">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <Badge variant={config.enabled ? "default" : "secondary"} className="text-[10px]">
                            <Navigation className="h-3 w-3 mr-1" /> Tracking {config.enabled ? "ON" : "OFF"}
                        </Badge>
                        <Badge variant={config.requireSelfie ? "default" : "secondary"} className="text-[10px]">
                            <Camera className="h-3 w-3 mr-1" /> Selfie {config.requireSelfie ? "Required" : "Optional"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                            <Coffee className="h-3 w-3 mr-1" /> {config.lunchDuration}min lunch
                        </Badge>
                        <Badge variant={config.lunchGeofenceRequired ? "default" : "secondary"} className="text-[10px]">
                            <MapPin className="h-3 w-3 mr-1" /> Break geofence {config.lunchGeofenceRequired ? "ON" : "OFF"}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Reset Dialog */}
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Location Settings?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will restore all location tracking, selfie, and break settings to defaults. Existing photos, pings, and break records will also be cleared.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { resetToSeed(); setResetOpen(false); toast.success("Location settings reset to defaults"); }}>Reset</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
