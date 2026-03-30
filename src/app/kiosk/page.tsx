"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useKioskStore } from "@/store/kiosk.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
    Shield, 
    Lock, 
    ScanFace, 
    QrCode, 
    Building2, 
    AlertTriangle,
    CheckCircle,
    XCircle,
} from "lucide-react";

/**
 * Kiosk Landing Page with PIN Protection
 * 
 * Requires 6-digit PIN to access either Face Recognition or QR Code kiosk.
 * Admins can configure the PIN in Settings > Kiosk.
 */

export default function KioskLandingPage() {
    const router = useRouter();
    const { settings } = useKioskStore();
    const companyName = useAppearanceStore((s) => s.companyName);
    const logoUrl = useAppearanceStore((s) => s.logoUrl);
    
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
            <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 text-white/40 select-none">
                <div className="text-center space-y-3">
                    <Shield className="h-12 w-12 mx-auto text-white/20" />
                    <p className="text-lg font-semibold">Kiosk Disabled</p>
                    <p className="text-sm text-white/25">An administrator has disabled this kiosk.</p>
                </div>
            </div>
        );
    }

    const handlePinSubmit = async () => {
        setIsLoading(true);
        setError("");
        setShowError(false);

        try {
            // In production, verify against database
            // For now, use the PIN from kiosk settings (default: 000000)
            const expectedPin = settings.adminPin || "000000";
            
            if (pin !== expectedPin) {
                setError("Incorrect PIN. Please try again.");
                setShowError(true);
                setPin("");
                toast.error("Incorrect kiosk PIN");
                setIsLoading(false);
                return;
            }

            // PIN verified - redirect to kiosk selection
            toast.success("PIN verified");
            
            // Store PIN verification in session
            sessionStorage.setItem("kiosk-pin-verified", "true");
            sessionStorage.setItem("kiosk-pin-verified-time", Date.now().toString());
            
            // Redirect to kiosk type selection or default
            router.push("/kiosk/select");
        } catch (err) {
            setError("An error occurred. Please try again.");
            setShowError(true);
            console.error("[kiosk-pin] Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handlePinSubmit();
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

    return (
        <div className={cn(
            "fixed inset-0 flex flex-col items-center justify-center transition-colors duration-700 select-none",
            settings.kioskTheme === "midnight" ? "bg-slate-950" : 
            settings.kioskTheme === "charcoal" ? "bg-neutral-950" : "bg-zinc-950"
        )}>
            {/* Ambient background blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full blur-[130px] opacity-20 bg-primary" />
                <div className="absolute -bottom-48 -right-48 w-[650px] h-[650px] rounded-full blur-[150px] opacity-15 bg-primary/60" />
            </div>

            {/* Top bar */}
            <header className="absolute top-0 w-full flex items-center justify-between px-8 pt-6">
                <div className="flex items-center gap-3">
                    {settings.showLogo && logoUrl ? (
                        <img 
                            src={logoUrl} 
                            alt={companyName} 
                            className="h-8 max-w-[130px] object-contain brightness-0 invert opacity-90" 
                        />
                    ) : (
                        <span className="text-white font-bold text-lg tracking-tight">
                            {companyName || "NexHRMS"}
                        </span>
                    )}
                </div>
                <div className="text-center">
                    {settings.showClock && (
                        <p className="text-white font-mono text-4xl font-bold tracking-widest tabular-nums drop-shadow-lg">
                            {timeStr}
                        </p>
                    )}
                    {settings.showDate && (
                        <p className="text-white/40 text-xs mt-1">{dateStr}</p>
                    )}
                </div>
                <div className="flex items-center gap-1.5 text-white/25 text-[11px] font-mono">
                    {settings.showDeviceId && (
                        <>
                            <Shield className="h-3.5 w-3.5" />
                            <span>KIOSK-XXXX</span>
                        </>
                    )}
                </div>
            </header>

            {/* Main content */}
            <Card className={cn(
                "relative z-10 w-full max-w-md border-0 shadow-2xl animate-in fade-in zoom-in-95 duration-300",
                settings.kioskTheme === "midnight" ? "bg-slate-900/50" : 
                settings.kioskTheme === "charcoal" ? "bg-neutral-900/50" : "bg-zinc-900/50"
            )}>
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-2 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Lock className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">
                        Kiosk Access
                    </CardTitle>
                    <p className="text-white/60 text-sm mt-1">
                        Enter your 6-digit PIN to access the attendance kiosk
                    </p>
                </CardHeader>
                
                <CardContent className="space-y-4 pt-4">
                    {/* PIN Input */}
                    <div className="space-y-2">
                        <Input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={pin}
                            onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, "");
                                setPin(value);
                                setError("");
                                setShowError(false);
                            }}
                            onKeyPress={handleKeyPress}
                            className={cn(
                                "text-center text-2xl tracking-[0.5em] font-mono bg-white/5 border-white/10 text-white",
                                "focus:border-primary focus:ring-primary/20",
                                showError && "border-red-500 focus:border-red-500"
                            )}
                            placeholder="000000"
                            disabled={isLoading}
                            autoFocus
                        />
                        
                        {showError && (
                            <div className="flex items-center justify-center gap-2 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                                <XCircle className="h-4 w-4" />
                                <span>{error}</span>
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <Button
                        onClick={handlePinSubmit}
                        disabled={pin.length !== 6 || isLoading}
                        className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
                    >
                        {isLoading ? (
                            <>
                                <Shield className="h-4 w-4 mr-2 animate-pulse" />
                                Verifying...
                            </>
                        ) : (
                            <>
                                <Lock className="h-4 w-4 mr-2" />
                                Access Kiosk
                            </>
                        )}
                    </Button>

                    {/* Help text */}
                    <div className="text-center text-xs text-white/40 space-y-1">
                        <p>Default PIN: <Badge variant="secondary" className="text-[10px]">000000</Badge></p>
                        <p>Change in Settings → Kiosk</p>
                    </div>

                    {/* Kiosk methods preview */}
                    <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/10">
                        {settings.enableFace && (
                            <div className="flex items-center gap-2 text-white/50 text-xs">
                                <ScanFace className="h-4 w-4" />
                                <span>Face</span>
                            </div>
                        )}
                        {settings.enableQr && (
                            <div className="flex items-center gap-2 text-white/50 text-xs">
                                <QrCode className="h-4 w-4" />
                                <span>QR</span>
                            </div>
                        )}
                        {settings.enablePin && (
                            <div className="flex items-center gap-2 text-white/50 text-xs">
                                <Shield className="h-4 w-4" />
                                <span>PIN</span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Footer */}
            <footer className="absolute bottom-0 w-full flex items-center justify-center pb-6">
                <div className="flex items-center gap-2 text-white/30 text-xs">
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
