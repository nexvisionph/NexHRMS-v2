"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useKioskStore } from "@/store/kiosk.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
    Shield, 
    Lock, 
    ScanFace, 
    QrCode, 
    Building2, 
    XCircle,
    ChevronRight,
    Camera,
} from "lucide-react";

/**
 * Kiosk Landing Page with ADMIN PIN Protection + Method Selection
 * 
 * The PIN (default: 000000) is for ADMINISTRATORS to unlock/access kiosk mode.
 * Employees do NOT use this PIN — they authenticate via QR code or Face recognition.
 * 
 * Flow: Admin enters PIN → kiosk unlocks → method selection (Face / QR) → employees scan to check-in/out.
 * If only one method is enabled, auto-redirects after PIN verification.
 */

type PageState = "pin_entry" | "method_select";

export default function KioskLandingPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const targetKiosk = searchParams.get("target"); // "qr" | "face" | null
    const { settings } = useKioskStore();
    const companyName = useAppearanceStore((s) => s.companyName);
    const logoUrl = useAppearanceStore((s) => s.logoUrl);
    const isAutoTheme = settings.kioskTheme === "auto";
    
    const [pageState, setPageState] = useState<PageState>("pin_entry");
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showError, setShowError] = useState(false);
    const [now, setNow] = useState(new Date());
    
    // Update clock
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Check if kiosk is enabled
    if (!settings.kioskEnabled) {
        return (
            <div className={cn(
                "fixed inset-0 flex items-center justify-center select-none",
                isAutoTheme ? "bg-background text-muted-foreground" : "bg-zinc-950 text-white/40"
            )}>
                <div className="text-center space-y-3">
                    <Shield className={cn("h-12 w-12 mx-auto", isAutoTheme ? "text-muted-foreground/50" : "text-white/20")} />
                    <p className="text-lg font-semibold">Kiosk Disabled</p>
                    <p className={cn("text-sm", isAutoTheme ? "text-muted-foreground/60" : "text-white/25")}>
                        An administrator has disabled this kiosk.
                    </p>
                </div>
            </div>
        );
    }

    const handlePinSubmit = async () => {
        setIsLoading(true);
        setError("");
        setShowError(false);

        try {
            // Verify via DB API first, fall back to Zustand store for demo mode
            let pinValid = false;
            try {
                const res = await fetch(`/api/kiosk/admin-pin?pin=${encodeURIComponent(pin)}`);
                if (res.ok) {
                    const data = await res.json() as { valid?: boolean };
                    pinValid = data.valid === true;
                } else {
                    // API unavailable — fall back to local store
                    pinValid = pin === (settings.adminPin || "000000");
                }
            } catch {
                // Network error / demo mode — fall back to local store
                pinValid = pin === (settings.adminPin || "000000");
            }

            if (!pinValid) {
                setError("Incorrect PIN. Please try again.");
                setShowError(true);
                setPin("");
                toast.error("Incorrect kiosk PIN");
                setIsLoading(false);
                return;
            }

            // PIN verified — store session
            toast.success("Kiosk unlocked");
            sessionStorage.setItem("kiosk-pin-verified", "true");
            sessionStorage.setItem("kiosk-pin-verified-time", Date.now().toString());
            
            // Determine next step based on target param or enabled methods
            const faceEnabled = settings.enableFace;
            const qrEnabled = settings.enableQr;

            if (targetKiosk === "qr") {
                router.push("/kiosk/qr");
            } else if (targetKiosk === "face") {
                router.push("/kiosk/face");
            } else if (faceEnabled && !qrEnabled) {
                router.push("/kiosk/face");
            } else if (qrEnabled && !faceEnabled) {
                router.push("/kiosk/qr");
            } else {
                // Both enabled — show method selection
                setPageState("method_select");
            }
        } catch (err) {
            setError("An error occurred. Please try again.");
            setShowError(true);
            console.error("[kiosk-pin] Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Time formatters
    const h = now.getHours();
    const timeStr = settings.clockFormat === "12h"
        ? `${h % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
        : `${String(h).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    
    const dateStr = now.toLocaleDateString("en-US", { 
        weekday: "long", 
        month: "long", 
        day: "numeric", 
        year: "numeric" 
    });

    // Theme-aware classes
    const bgClass = isAutoTheme ? "bg-background" :
        settings.kioskTheme === "midnight" ? "bg-slate-950" :
        settings.kioskTheme === "charcoal" ? "bg-neutral-950" : "bg-zinc-950";
    const cardBgClass = isAutoTheme ? "bg-card border-border" :
        settings.kioskTheme === "midnight" ? "bg-slate-900/50 border-0" :
        settings.kioskTheme === "charcoal" ? "bg-neutral-900/50 border-0" : "bg-zinc-900/50 border-0";
    const textClass = isAutoTheme ? "text-foreground" : "text-white";
    const textMutedClass = isAutoTheme ? "text-muted-foreground" : "text-white/60";
    const textSubtleClass = isAutoTheme ? "text-muted-foreground/60" : "text-white/40";
    const textFaintClass = isAutoTheme ? "text-muted-foreground/40" : "text-white/30";
    const inputBgClass = isAutoTheme ? "bg-muted/50 border-border" : "bg-white/5 border-white/10 text-white";

    return (
        <div className={cn(
            "fixed inset-0 flex flex-col items-center justify-center transition-colors duration-700 select-none",
            bgClass
        )}>
            {/* Ambient background blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full blur-[130px] opacity-20 bg-primary" />
                <div className="absolute -bottom-48 -right-48 w-[650px] h-[650px] rounded-full blur-[150px] opacity-15 bg-primary/60" />
            </div>

            {/* Top bar: brand left | clock absolute center | device ID right */}
            <header className="absolute top-0 w-full grid grid-cols-3 items-center px-8 pt-6">
                {/* Left — brand */}
                <div className="flex items-center gap-3">
                    {settings.showLogo && logoUrl ? (
                        <img 
                            src={logoUrl} 
                            alt={companyName} 
                            className={cn(
                                "h-8 max-w-[130px] object-contain",
                                !isAutoTheme && "brightness-0 invert opacity-90"
                            )}
                        />
                    ) : (
                        <span className={cn("font-bold text-lg tracking-tight", textClass)}>
                            {companyName || "NexHRMS"}
                        </span>
                    )}
                </div>
                {/* Center — clock (truly centered via grid) */}
                <div className="text-center">
                    {settings.showClock && (
                        <p className={cn("font-mono text-5xl font-bold tracking-widest tabular-nums drop-shadow-lg", textClass)}>
                            {timeStr}
                        </p>
                    )}
                    {settings.showDate && (
                        <p className={cn("text-xs mt-1.5 tracking-wide", textSubtleClass)}>{dateStr}</p>
                    )}
                </div>
                {/* Right — device ID */}
                <div className={cn("flex items-center justify-end gap-1.5 text-[11px] font-mono", textFaintClass)}>
                    {settings.showDeviceId && (
                        <>
                            <Shield className="h-3.5 w-3.5" />
                            <span>KIOSK-XXXX</span>
                        </>
                    )}
                </div>
            </header>

            {/* PIN Entry */}
            {pageState === "pin_entry" && (
                <Card className={cn(
                    "relative z-10 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-300",
                    cardBgClass
                )}>
                    <CardHeader className="text-center pb-2 pt-8">
                        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center ring-1 ring-primary/20">
                            <Lock className="h-7 w-7 text-primary" />
                        </div>
                        <CardTitle className={cn("text-xl font-bold tracking-tight", textClass)}>
                            Kiosk Access
                        </CardTitle>
                        <p className={cn("text-sm mt-1", textMutedClass)}>
                            Enter the admin PIN to unlock the kiosk
                        </p>
                    </CardHeader>
                    
                    <CardContent className="space-y-5 px-6 pb-7 pt-5">
                        <div className="space-y-2">
                            <Input
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={settings.pinLength || 6}
                                value={pin}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, "");
                                    setPin(value);
                                    setError("");
                                    setShowError(false);
                                }}
                                onKeyDown={(e) => e.key === "Enter" && pin.length >= 4 && !isLoading && handlePinSubmit()}
                                className={cn(
                                    "text-center text-2xl tracking-[0.6em] font-mono h-14 rounded-xl",
                                    inputBgClass,
                                    showError && "border-red-500 focus:border-red-500"
                                )}
                                placeholder={"•".repeat(settings.pinLength || 6)}
                                disabled={isLoading}
                                autoFocus
                            />
                            
                            {showError && (
                                <div className="flex items-center justify-center gap-2 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                                    <XCircle className="h-4 w-4 shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>

                        <Button
                            onClick={handlePinSubmit}
                            disabled={pin.length < 4 || isLoading}
                            className="w-full h-12 text-base font-semibold rounded-xl"
                        >
                            {isLoading ? (
                                <>
                                    <Shield className="h-4 w-4 mr-2 animate-pulse" />
                                    Verifying…
                                </>
                            ) : (
                                <>
                                    <Lock className="h-4 w-4 mr-2" />
                                    Unlock Kiosk
                                </>
                            )}
                        </Button>

                        <p className={cn("text-center text-[11px]", textSubtleClass)}>
                            Change PIN in Admin Settings → Kiosk
                        </p>

                        {(settings.enableFace || settings.enableQr || settings.enablePin) && (
                            <div className={cn("flex items-center justify-center gap-5 pt-3 border-t", isAutoTheme ? "border-border" : "border-white/10")}>
                                {settings.enableFace && (
                                    <div className={cn("flex items-center gap-1.5 text-xs", textMutedClass)}>
                                        <ScanFace className="h-3.5 w-3.5" /><span>Face</span>
                                    </div>
                                )}
                                {settings.enableQr && (
                                    <div className={cn("flex items-center gap-1.5 text-xs", textMutedClass)}>
                                        <QrCode className="h-3.5 w-3.5" /><span>QR</span>
                                    </div>
                                )}
                                {settings.enablePin && (
                                    <div className={cn("flex items-center gap-1.5 text-xs", textMutedClass)}>
                                        <Shield className="h-3.5 w-3.5" /><span>PIN</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Method Selection */}
            {pageState === "method_select" && (
                <div className="relative z-10 w-full max-w-2xl px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center mb-8">
                        <h2 className={cn("text-2xl font-bold", textClass)}>Choose Check-in Method</h2>
                        <p className={cn("text-sm mt-1", textMutedClass)}>
                            Select how employees will verify their attendance
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Face Recognition Card */}
                        {settings.enableFace && (
                            <button
                                onClick={() => router.push("/kiosk/face")}
                                className={cn(
                                    "group rounded-2xl p-6 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-xl",
                                    isAutoTheme
                                        ? "bg-card border border-border hover:border-emerald-500/40 hover:bg-emerald-500/5"
                                        : "bg-white/[0.04] border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/25 transition-colors">
                                        <ScanFace className="h-7 w-7 text-emerald-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h3 className={cn("text-lg font-semibold", textClass)}>Face Recognition</h3>
                                            <ChevronRight className={cn("h-5 w-5 group-hover:translate-x-1 transition-transform", textMutedClass)} />
                                        </div>
                                        <p className={cn("text-sm mt-1", textMutedClass)}>
                                            Employees scan their face using the camera for instant verification.
                                        </p>
                                        <div className={cn("flex items-center gap-3 mt-3 text-xs", textSubtleClass)}>
                                            <span className="flex items-center gap-1"><Camera className="h-3 w-3" /> Camera scan</span>
                                            <span>•</span>
                                            <span>AI matching</span>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        )}
                        {/* QR Code Card */}
                        {settings.enableQr && (
                            <button
                                onClick={() => router.push("/kiosk/qr")}
                                className={cn(
                                    "group rounded-2xl p-6 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-xl",
                                    isAutoTheme
                                        ? "bg-card border border-border hover:border-violet-500/40 hover:bg-violet-500/5"
                                        : "bg-white/[0.04] border border-white/10 hover:border-violet-500/40 hover:bg-violet-500/5"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-violet-500/15 flex items-center justify-center shrink-0 group-hover:bg-violet-500/25 transition-colors">
                                        <QrCode className="h-7 w-7 text-violet-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h3 className={cn("text-lg font-semibold", textClass)}>QR Code Scanner</h3>
                                            <ChevronRight className={cn("h-5 w-5 group-hover:translate-x-1 transition-transform", textMutedClass)} />
                                        </div>
                                        <p className={cn("text-sm mt-1", textMutedClass)}>
                                            Employees show their daily QR code from the mobile app.
                                        </p>
                                        <div className={cn("flex items-center gap-3 mt-3 text-xs", textSubtleClass)}>
                                            <span className="flex items-center gap-1"><QrCode className="h-3 w-3" /> QR scan</span>
                                            <span>•</span>
                                            <span>Daily rotation</span>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => { setPageState("pin_entry"); setPin(""); }}
                        className={cn("mt-6 mx-auto block text-sm hover:underline", textMutedClass)}
                    >
                        ← Back to PIN
                    </button>
                </div>
            )}

            {/* Footer */}
            <footer className="absolute bottom-0 w-full flex items-center justify-center pb-6">
                <div className={cn("flex items-center gap-2 text-xs", textFaintClass)}>
                    {settings.showSecurityBadge && (
                        <>
                            <Building2 className="h-3.5 w-3.5" />
                            <span>{companyName || "NexHRMS"} Attendance Kiosk</span>
                        </>
                    )}
                </div>
            </footer>
        </div>
    );
}
