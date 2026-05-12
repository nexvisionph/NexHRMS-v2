"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useKioskStore } from "@/store/kiosk.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { 
    Shield, 
    Lock, 
    ScanFace, 
    QrCode, 
    XCircle,
    ChevronRight,
    Camera,
    Fingerprint,
} from "lucide-react";

/**
 * Kiosk Landing Page — Black & Neon Green SaaS Theme
 * 
 * Modern, responsive kiosk interface with Soren Data Solutions branding.
 * PIN-protected admin access with method selection for employee check-in.
 */

type PageState = "pin_entry" | "method_select";

// Neon green theme colors
const NEON_GREEN = "#39FF14";
const NEON_GREEN_DIM = "rgba(57, 255, 20, 0.6)";

export default function KioskLandingPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const targetKiosk = searchParams.get("target");
    const { settings } = useKioskStore();
    const companyName = useAppearanceStore((s) => s.companyName);
    const logoUrl = useAppearanceStore((s) => s.logoUrl);
    
    const [pageState, setPageState] = useState<PageState>("pin_entry");
    const [pin, setPin] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showError, setShowError] = useState(false);
    const [now, setNow] = useState(new Date());

    // On mount: always clear PIN session so that navigating back here forces re-auth
    useEffect(() => {
        sessionStorage.removeItem("kiosk-pin-verified");
        sessionStorage.removeItem("kiosk-pin-verified-time");
    }, []);
    
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!settings.kioskEnabled) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-black select-none">
                <div className="text-center space-y-3">
                    <Shield className="h-12 w-12 mx-auto text-white/20" />
                    <p className="text-lg font-semibold text-white/60">Kiosk Disabled</p>
                    <p className="text-sm text-white/30">An administrator has disabled this kiosk.</p>
                </div>
            </div>
        );
    }

    const handlePinSubmit = async () => {
        setIsLoading(true);
        setError("");
        setShowError(false);

        try {
            let pinValid = false;
            try {
                const res = await fetch(`/api/kiosk/admin-pin?pin=${encodeURIComponent(pin)}`);
                if (res.ok) {
                    const data = await res.json() as { valid?: boolean };
                    pinValid = data.valid === true;
                } else {
                    pinValid = pin === (settings.adminPin || "000000");
                }
            } catch {
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

            toast.success("Kiosk unlocked");
            sessionStorage.setItem("kiosk-pin-verified", "true");
            sessionStorage.setItem("kiosk-pin-verified-time", Date.now().toString());
            
            const faceEnabled = settings.enableFace;
            const qrEnabled = settings.enableQr;

            if (targetKiosk === "qr") {
                router.replace("/kiosk/qr");
            } else if (targetKiosk === "face") {
                router.replace("/kiosk/face");
            } else if (faceEnabled && !qrEnabled) {
                router.replace("/kiosk/face");
            } else if (qrEnabled && !faceEnabled) {
                router.replace("/kiosk/qr");
            } else {
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
        <div className="fixed inset-0 flex flex-col bg-black select-none overflow-hidden">
            {/* Animated gradient background */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div 
                    className="absolute -top-1/4 -left-1/4 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full blur-[120px] opacity-20 animate-pulse"
                    style={{ background: `radial-gradient(circle, ${NEON_GREEN} 0%, transparent 70%)`, animationDuration: "4s" }}
                />
                <div 
                    className="absolute -bottom-1/4 -right-1/4 w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] rounded-full blur-[100px] opacity-15"
                    style={{ background: `radial-gradient(circle, ${NEON_GREEN_DIM} 0%, transparent 70%)` }}
                />
                {/* Grid pattern overlay */}
                <div 
                    className="absolute inset-0 opacity-[0.02]"
                    style={{ 
                        backgroundImage: `linear-gradient(${NEON_GREEN} 1px, transparent 1px), linear-gradient(90deg, ${NEON_GREEN} 1px, transparent 1px)`,
                        backgroundSize: "clamp(30px, 4vw, 60px) clamp(30px, 4vw, 60px)"
                    }}
                />
            </div>

            {/* Header */}
            <header className="relative z-10 w-full grid grid-cols-3 items-center px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
                <div className="flex items-center gap-3">
                    {settings.showLogo && logoUrl ? (
                        <img 
                            src={logoUrl} 
                            alt={companyName} 
                            className="h-6 sm:h-8 max-w-[100px] sm:max-w-[130px] object-contain brightness-0 invert"
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <div 
                                className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${NEON_GREEN}20`, border: `1px solid ${NEON_GREEN}40` }}
                            >
                                <Fingerprint className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: NEON_GREEN }} />
                            </div>
                            <span className="font-bold text-sm sm:text-lg tracking-tight text-white">
                                {companyName || "SDSI"}
                            </span>
                        </div>
                    )}
                </div>
                
                <div className="text-center">
                    {settings.showClock && (
                        <p 
                            className="font-mono text-2xl sm:text-4xl lg:text-5xl font-bold tracking-widest tabular-nums"
                            style={{ color: NEON_GREEN, textShadow: `0 0 30px ${NEON_GREEN}40` }}
                        >
                            {timeStr}
                        </p>
                    )}
                    {settings.showDate && (
                        <p className="text-[10px] sm:text-xs mt-1 tracking-wide text-white/40">{dateStr}</p>
                    )}
                </div>
                
                <div className="flex items-center justify-end gap-1.5 text-[10px] sm:text-[11px] font-mono text-white/30">
                    {settings.showDeviceId && (
                        <>
                            <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5" style={{ color: NEON_GREEN }} />
                            <span>KIOSK-XXXX</span>
                        </>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6">
                {/* PIN Entry */}
                {pageState === "pin_entry" && (
                    <div 
                        className="w-full max-w-[min(400px,90vw)] rounded-2xl sm:rounded-3xl p-6 sm:p-8 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300"
                        style={{ 
                            backgroundColor: "rgba(255, 255, 255, 0.03)",
                            border: `1px solid ${NEON_GREEN}20`,
                            boxShadow: `0 0 60px ${NEON_GREEN}10, inset 0 1px 0 rgba(255,255,255,0.05)`
                        }}
                    >
                        <div className="text-center mb-6 sm:mb-8">
                            <div 
                                className="mx-auto mb-4 h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center"
                                style={{ backgroundColor: `${NEON_GREEN}15`, border: `1px solid ${NEON_GREEN}30` }}
                            >
                                <Lock className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: NEON_GREEN }} />
                            </div>
                            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                                Kiosk Access
                            </h1>
                            <p className="text-xs sm:text-sm mt-1.5 text-white/50">
                                Enter the admin PIN to unlock the kiosk
                            </p>
                        </div>
                        
                        <div className="space-y-4 sm:space-y-5">
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
                                        "text-center text-xl sm:text-2xl tracking-[0.5em] font-mono h-12 sm:h-14 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-[#39FF14]/50 focus:ring-[#39FF14]/20",
                                        showError && "border-red-500 focus:border-red-500"
                                    )}
                                    placeholder={"•".repeat(settings.pinLength || 6)}
                                    disabled={isLoading}
                                    autoFocus
                                />
                                
                                {showError && (
                                    <div className="flex items-center justify-center gap-2 text-red-400 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2">
                                        <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={handlePinSubmit}
                                disabled={pin.length < 4 || isLoading}
                                className="w-full h-11 sm:h-12 text-sm sm:text-base font-semibold rounded-xl text-black transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                style={{ 
                                    backgroundColor: NEON_GREEN,
                                    boxShadow: `0 0 20px ${NEON_GREEN}40`
                                }}
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

                            <p className="text-center text-[10px] sm:text-[11px] text-white/30">
                                Change PIN in Admin Settings → Kiosk
                            </p>

                            {(settings.enableFace || settings.enableQr) && (
                                <div className="flex items-center justify-center gap-4 sm:gap-5 pt-3 sm:pt-4 border-t border-white/10">
                                    {settings.enableFace && (
                                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-white/40">
                                            <ScanFace className="h-3 w-3 sm:h-3.5 sm:w-3.5" style={{ color: NEON_GREEN }} />
                                            <span>Face</span>
                                        </div>
                                    )}
                                    {settings.enableQr && (
                                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-white/40">
                                            <QrCode className="h-3 w-3 sm:h-3.5 sm:w-3.5" style={{ color: NEON_GREEN }} />
                                            <span>QR</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Method Selection */}
                {pageState === "method_select" && (
                    <div className="relative z-10 w-full max-w-3xl px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-6 sm:mb-8">
                            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">Choose Check-in Method</h2>
                            <p className="text-xs sm:text-sm mt-1.5 text-white/50">
                                Select how employees will verify their attendance
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {settings.enableFace && (
                                <button
                                    onClick={() => router.replace("/kiosk/face")}
                                    className="group rounded-2xl p-5 sm:p-6 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                    style={{ 
                                        backgroundColor: "rgba(255, 255, 255, 0.03)",
                                        border: `1px solid ${NEON_GREEN}20`,
                                    }}
                                >
                                    <div className="flex items-start gap-3 sm:gap-4">
                                        <div 
                                            className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
                                            style={{ backgroundColor: `${NEON_GREEN}15`, border: `1px solid ${NEON_GREEN}30` }}
                                        >
                                            <ScanFace className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: NEON_GREEN }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-base sm:text-lg font-semibold text-white">Face Recognition</h3>
                                                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-white/40 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                            <p className="text-xs sm:text-sm mt-1 text-white/50">
                                                Employees scan their face using the camera for instant verification.
                                            </p>
                                            <div className="flex items-center gap-3 mt-2 sm:mt-3 text-[10px] sm:text-xs text-white/30">
                                                <span className="flex items-center gap-1">
                                                    <Camera className="h-3 w-3" style={{ color: NEON_GREEN }} /> Camera scan
                                                </span>
                                                <span>•</span>
                                                <span>AI matching</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            )}
                            
                            {settings.enableQr && (
                                <button
                                    onClick={() => router.replace("/kiosk/qr")}
                                    className="group rounded-2xl p-5 sm:p-6 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                    style={{ 
                                        backgroundColor: "rgba(255, 255, 255, 0.03)",
                                        border: `1px solid ${NEON_GREEN}20`,
                                    }}
                                >
                                    <div className="flex items-start gap-3 sm:gap-4">
                                        <div 
                                            className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
                                            style={{ backgroundColor: `${NEON_GREEN}15`, border: `1px solid ${NEON_GREEN}30` }}
                                        >
                                            <QrCode className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: NEON_GREEN }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-base sm:text-lg font-semibold text-white">QR Code Scanner</h3>
                                                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-white/40 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                            <p className="text-xs sm:text-sm mt-1 text-white/50">
                                                Employees show their daily QR code from the mobile app.
                                            </p>
                                            <div className="flex items-center gap-3 mt-2 sm:mt-3 text-[10px] sm:text-xs text-white/30">
                                                <span className="flex items-center gap-1">
                                                    <QrCode className="h-3 w-3" style={{ color: NEON_GREEN }} /> QR scan
                                                </span>
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
                            className="mt-5 sm:mt-6 mx-auto block text-xs sm:text-sm text-white/40 hover:text-white/60 transition-colors"
                        >
                            ← Back to PIN
                        </button>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="relative z-10 w-full flex items-center justify-center pb-4 sm:pb-6">
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-white/20">
                    {settings.showSecurityBadge && (
                        <>
                            <div 
                                className="h-1.5 w-1.5 rounded-full animate-pulse"
                                style={{ backgroundColor: NEON_GREEN }}
                            />
                            <span>{companyName || "Soren Data Solutions Inc."} Attendance Kiosk</span>
                        </>
                    )}
                </div>
            </footer>
        </div>
    );
}
