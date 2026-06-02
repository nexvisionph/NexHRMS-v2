"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import {
    useAppearanceStore,
    COLOR_PRESETS,
    FONT_OPTIONS,
    RADIUS_OPTIONS,
} from "@/store/appearance.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Palette, Type, Layout, RotateCcw, Check, Sun, Moon, Monitor } from "lucide-react";
import Link from "next/link";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { cn } from "@/lib/utils";

export default function AppearancePage() {
    const { currentUser, theme, setTheme } = useAuthStore();
    const appearance = useAppearanceStore();
    const [resetOpen, setResetOpen] = useState(false);
    const rh = useRoleHref();

    if (currentUser.role !== "admin") {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">Admin access required.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Palette className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Appearance</h1>
                            <p className="text-sm text-muted-foreground">Customize theme, typography, and shell layout</p>
                        </div>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setResetOpen(true)}
                    className="gap-1.5 text-muted-foreground"
                >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset All
                </Button>
            </div>

            <Tabs defaultValue="theme" className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="theme" className="gap-1.5">
                        <Palette className="h-4 w-4" /> Theme
                    </TabsTrigger>
                    <TabsTrigger value="typography" className="gap-1.5">
                        <Type className="h-4 w-4" /> Typography
                    </TabsTrigger>
                    <TabsTrigger value="shell" className="gap-1.5">
                        <Layout className="h-4 w-4" /> Shell
                    </TabsTrigger>
                </TabsList>

                {/* ═══════════════ THEME TAB ═══════════════ */}
                <TabsContent value="theme" className="space-y-6">
                    {/* Dark / Light Mode */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Mode</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-3">
                                {([
                                    { value: "light", icon: Sun, label: "Light" },
                                    { value: "dark", icon: Moon, label: "Dark" },
                                    { value: "system", icon: Monitor, label: "System" },
                                ] as const).map(({ value, icon: Icon, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => setTheme(value)}
                                        className={cn(
                                            "flex flex-col items-center gap-2 rounded-lg border-2 px-6 py-4 transition-all",
                                            theme === value
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/50"
                                        )}
                                    >
                                        <Icon className="h-5 w-5" />
                                        <span className="text-xs font-medium">{label}</span>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Color Theme */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Color Theme</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                                {COLOR_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        onClick={() => appearance.setColorTheme(preset.id)}
                                        className={cn(
                                            "relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all hover:scale-105",
                                            appearance.colorTheme === preset.id
                                                ? "border-primary shadow-md"
                                                : "border-border hover:border-primary/40"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "h-8 w-8 rounded-full shadow-inner",
                                                preset.id === "white" && "ring-1 ring-border"
                                            )}
                                            style={{ backgroundColor: preset.swatch }}
                                        />
                                        <span className="text-[11px] font-medium">{preset.label}</span>
                                        {appearance.colorTheme === preset.id && (
                                            <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                                <Check className="h-3 w-3 text-primary-foreground" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Custom color input */}
                            {appearance.colorTheme === "custom" && (
                                <div className="mt-4 grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium">Light Primary (oklch)</label>
                                        <Input
                                            value={appearance.customPrimaryLight}
                                            onChange={(e) => appearance.setCustomPrimary(e.target.value, appearance.customPrimaryDark)}
                                            placeholder="oklch(0.5 0.2 260)"
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium">Dark Primary (oklch)</label>
                                        <Input
                                            value={appearance.customPrimaryDark}
                                            onChange={(e) => appearance.setCustomPrimary(appearance.customPrimaryLight, e.target.value)}
                                            placeholder="oklch(0.65 0.2 260)"
                                            className="text-xs font-mono"
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══════════════ TYPOGRAPHY TAB ═══════════════ */}
                <TabsContent value="typography" className="space-y-6">
                    {/* Font Family */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Font Family</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {FONT_OPTIONS.map((font) => (
                                    <button
                                        key={font.id}
                                        onClick={() => appearance.setFontFamily(font.id)}
                                        className={cn(
                                            "flex items-center justify-between rounded-lg border-2 px-4 py-3 transition-all text-left",
                                            appearance.fontFamily === font.id
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/40"
                                        )}
                                    >
                                        <div>
                                            <p className="text-sm font-medium">{font.label}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: font.value }}>
                                                The quick brown fox
                                            </p>
                                        </div>
                                        {appearance.fontFamily === font.id && (
                                            <Check className="h-4 w-4 text-primary shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Border Radius */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Border Radius</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-3">
                                {RADIUS_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => appearance.setRadius(opt.id)}
                                        className={cn(
                                            "flex flex-col items-center gap-2 rounded-lg border-2 px-4 py-3 transition-all flex-1",
                                            appearance.radius === opt.id
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/40"
                                        )}
                                    >
                                        <div
                                            className="h-8 w-12 border-2 border-primary/60 bg-primary/10"
                                            style={{ borderRadius: opt.value }}
                                        />
                                        <span className="text-[11px] font-medium">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Density */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Density</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-3">
                                {([
                                    { id: "compact", label: "Compact", desc: "Less spacing, smaller text" },
                                    { id: "default", label: "Default", desc: "Standard spacing" },
                                    { id: "relaxed", label: "Relaxed", desc: "More breathing room" },
                                ] as const).map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => appearance.setDensity(opt.id)}
                                        className={cn(
                                            "flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 transition-all flex-1",
                                            appearance.density === opt.id
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/40"
                                        )}
                                    >
                                        <span className="text-sm font-medium">{opt.label}</span>
                                        <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══════════════ SHELL TAB ═══════════════ */}
                <TabsContent value="shell" className="space-y-6">
                    {/* Sidebar Variant */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Sidebar Style</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-3">
                                {([
                                    { id: "default", label: "Default", desc: "Neutral background sidebar" },
                                    { id: "colored", label: "Colored", desc: "Primary-colored sidebar" },
                                ] as const).map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => appearance.setSidebarVariant(opt.id)}
                                        className={cn(
                                            "flex flex-col items-center gap-2 rounded-lg border-2 px-6 py-4 transition-all flex-1",
                                            appearance.sidebarVariant === opt.id
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/40"
                                        )}
                                    >
                                        {/* Mini preview */}
                                        <div className="flex gap-0.5 h-10 w-16">
                                            <div className={cn(
                                                "w-4 rounded-sm",
                                                opt.id === "colored" ? "bg-primary" : "bg-muted"
                                            )} />
                                            <div className="flex-1 bg-muted/50 rounded-sm" />
                                        </div>
                                        <span className="text-xs font-medium">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Company Name in Topbar */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Topbar Options</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Show Company Name</p>
                                    <p className="text-xs text-muted-foreground">Display company name in the top bar</p>
                                </div>
                                <Switch
                                    checked={appearance.showCompanyNameInTopbar}
                                    onCheckedChange={appearance.setShowCompanyNameInTopbar}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Announcement Banner */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Announcement Banner</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Enable Banner</p>
                                    <p className="text-xs text-muted-foreground">Show a sticky banner below the topbar</p>
                                </div>
                                <Switch
                                    checked={appearance.topbarBannerEnabled}
                                    onCheckedChange={(v) => appearance.setTopbarBanner({ topbarBannerEnabled: v })}
                                />
                            </div>
                            {appearance.topbarBannerEnabled && (
                                <>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium">Banner Text</label>
                                        <Input
                                            value={appearance.topbarBannerText}
                                            onChange={(e) => appearance.setTopbarBanner({ topbarBannerText: e.target.value })}
                                            placeholder="e.g. System maintenance scheduled for Sunday..."
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium">Banner Color</label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="color"
                                                value={appearance.topbarBannerColor}
                                                onChange={(e) => appearance.setTopbarBanner({ topbarBannerColor: e.target.value })}
                                                className="h-9 w-14 cursor-pointer rounded border border-border"
                                            />
                                            <span className="text-xs text-muted-foreground font-mono">{appearance.topbarBannerColor}</span>
                                        </div>
                                    </div>
                                    {/* Preview */}
                                    {appearance.topbarBannerText && (
                                        <div
                                            className="rounded-lg px-4 py-2 text-sm font-medium text-white text-center"
                                            style={{ backgroundColor: appearance.topbarBannerColor }}
                                        >
                                            {appearance.topbarBannerText}
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Reset Dialog */}
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Appearance?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will reset all appearance settings (theme, typography, shell config) to defaults. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                appearance.resetAppearance();
                                toast.success("Appearance reset to defaults.");
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Reset
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}