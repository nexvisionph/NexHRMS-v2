"use client";

import { useRouter } from "next/navigation";
import { useKioskStore } from "@/store/kiosk.store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
    ScanFace, 
    QrCode,
    ArrowLeft,
    Shield,
} from "lucide-react";

/**
 * Kiosk Type Selection Page
 * 
 * Allows user to choose between Face Recognition or QR Code kiosk.
 * Only shows enabled methods.
 */

export default function KioskSelectPage() {
    const router = useRouter();
    const { settings } = useKioskStore();

    const handleSelect = (type: "face" | "qr") => {
        // Verify PIN is still valid (within 5 minutes)
        const verifiedTime = sessionStorage.getItem("kiosk-pin-verified-time");
        if (verifiedTime) {
            const elapsed = Date.now() - parseInt(verifiedTime);
            if (elapsed > 5 * 60 * 1000) {
                // PIN expired, redirect to login
                sessionStorage.removeItem("kiosk-pin-verified");
                sessionStorage.removeItem("kiosk-pin-verified-time");
                router.push("/kiosk");
                return;
            }
        }

        // Route to selected kiosk
        if (type === "face") {
            router.push("/kiosk/face");
        } else {
            router.push("/kiosk/qr");
        }
    };

    return (
        <div className={cn(
            "fixed inset-0 flex flex-col items-center justify-center transition-colors duration-700 select-none",
            settings.kioskTheme === "midnight" ? "bg-slate-950" : 
            settings.kioskTheme === "charcoal" ? "bg-neutral-950" : "bg-zinc-950"
        )}>
            {/* Ambient background */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full blur-[130px] opacity-20 bg-primary" />
                <div className="absolute -bottom-48 -right-48 w-[650px] h-[650px] rounded-full blur-[150px] opacity-15 bg-primary/60" />
            </div>

            {/* Back button */}
            <button
                onClick={() => router.push("/kiosk")}
                className="absolute top-6 left-6 flex items-center gap-2 text-white/50 hover:text-white transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Back</span>
            </button>

            {/* Header */}
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Select Kiosk Type</h1>
                <p className="text-white/60">Choose your preferred check-in method</p>
            </div>

            {/* Selection cards */}
            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl px-4">
                {/* Face Recognition Card */}
                {settings.enableFace && (
                    <Card
                        onClick={() => handleSelect("face")}
                        className={cn(
                            "cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl border-0 bg-white/5",
                            "hover:bg-white/10 hover:border-primary/50"
                        )}
                    >
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto mb-3 h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                <ScanFace className="h-10 w-10 text-emerald-400" />
                            </div>
                            <CardTitle className="text-xl text-white">Face Recognition</CardTitle>
                            <CardDescription className="text-white/60">
                                Quick check-in with AI-powered face verification
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <ul className="text-xs text-white/50 space-y-1">
                                <li>✓ Contactless check-in</li>
                                <li>✓ AI liveness detection</li>
                                <li>✓ Anti-spoofing protection</li>
                            </ul>
                            <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700">
                                Select Face
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* QR Code Card */}
                {settings.enableQr && (
                    <Card
                        onClick={() => handleSelect("qr")}
                        className={cn(
                            "cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl border-0 bg-white/5",
                            "hover:bg-white/10 hover:border-primary/50"
                        )}
                    >
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto mb-3 h-20 w-20 rounded-full bg-violet-500/10 flex items-center justify-center">
                                <QrCode className="h-10 w-10 text-violet-400" />
                            </div>
                            <CardTitle className="text-xl text-white">QR Code</CardTitle>
                            <CardDescription className="text-white/60">
                                Scan your personal QR code to check in
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-center">
                            <ul className="text-xs text-white/50 space-y-1">
                                <li>✓ Dynamic 30-second tokens</li>
                                <li>✓ Location-validated</li>
                                <li>✓ Single-use only</li>
                            </ul>
                            <Button className="w-full mt-4 bg-violet-600 hover:bg-violet-700">
                                Select QR
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Security badge */}
            <div className="absolute bottom-6 flex items-center gap-2 text-white/30 text-xs">
                <Shield className="h-3.5 w-3.5" />
                <span>Secure kiosk access • PIN protected</span>
            </div>
        </div>
    );
}
