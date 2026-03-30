"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAttendanceStore } from "@/store/attendance.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useKioskStore } from "@/store/kiosk.store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    ArrowLeft, QrCode, LogIn, LogOut, CheckCircle, XCircle, Camera, CameraOff, Loader2,
} from "lucide-react";

/**
 * QR Code Kiosk Page
 * 
 * Dedicated QR code scanning check-in/out terminal.
 * Uses dynamic 30-second tokens with location validation.
 */

export default function QRKioskPage() {
    const router = useRouter();
    const ks = useKioskStore((s) => s.settings);
    const { appendEvent } = useAttendanceStore();
    const employees = useEmployeesStore((s) => s.employees);
    const companyName = useAppearanceStore((s) => s.companyName);

    const [mode, setMode] = useState<"in" | "out">("in");
    const [feedback, setFeedback] = useState<"idle" | "success-in" | "success-out" | "error">("idle");
    const [now, setNow] = useState(new Date());
    const [checkedInName, setCheckedInName] = useState("");
    const [errorMessage, setErrorMessage] = useState("QR code not recognized");
    const [deviceId] = useState(() => {
        if (typeof window === "undefined") return "";
        const stored = localStorage.getItem("nexhrms-kiosk-qr-device-id");
        if (stored) return stored;
        const id = `KIOSK-QR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        localStorage.setItem("nexhrms-kiosk-qr-device-id", id);
        return id;
    });

    // QR scanner state
    const [qrScanning, setQrScanning] = useState(false);
    const [qrCameraError, setQrCameraError] = useState(false);
    const [qrProcessing, setQrProcessing] = useState(false);
    const qrVideoRef = useRef<HTMLVideoElement>(null);
    const qrStreamRef = useRef<MediaStream | null>(null);
    const qrScanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Verify PIN access
    useEffect(() => {
        const verified = sessionStorage.getItem("kiosk-pin-verified");
        const verifiedTime = sessionStorage.getItem("kiosk-pin-verified-time");
        
        if (!verified || !verifiedTime) {
            router.push("/kiosk");
            return;
        }

        const elapsed = Date.now() - parseInt(verifiedTime);
        if (elapsed > 5 * 60 * 1000) {
            sessionStorage.removeItem("kiosk-pin-verified");
            sessionStorage.removeItem("kiosk-pin-verified-time");
            router.push("/kiosk");
        }
    }, [router]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const stopQrScanner = useCallback(() => {
        qrStreamRef.current?.getTracks().forEach((t) => t.stop());
        qrStreamRef.current = null;
        if (qrScanIntervalRef.current) {
            clearInterval(qrScanIntervalRef.current);
            qrScanIntervalRef.current = null;
        }
        setQrScanning(false);
    }, []);

    // Cleanup QR scanner on unmount
    useEffect(() => {
        return () => {
            stopQrScanner();
        };
    }, [stopQrScanner]);

    const checkWorkDay = useCallback((empId: string) => {
        if (!ks.warnOffDay) return;
        const emp = employees.find((e) => e.id === empId);
        if (emp?.workDays?.length) {
            const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
            if (!emp.workDays.includes(day)) {
                toast.warning(`${day} is outside your scheduled days.`, { duration: 4000 });
            }
        }
    }, [employees, ks.warnOffDay]);

    const triggerFeedback = useCallback((state: typeof feedback, name?: string) => {
        setFeedback(state);
        if (name) setCheckedInName(name);
        setTimeout(() => {
            setFeedback("idle");
            setCheckedInName("");
            setQrProcessing(false);
        }, ks.feedbackDuration);
    }, [ks.feedbackDuration]);

    const clockEmployee = useCallback((empId: string, empName: string) => {
        if (mode === "in") checkWorkDay(empId);
        appendEvent({
            employeeId: empId,
            eventType: mode === "in" ? "IN" : "OUT",
            timestampUTC: new Date().toISOString(),
            deviceId,
        });
        triggerFeedback(mode === "in" ? "success-in" : "success-out", empName);
    }, [mode, deviceId, appendEvent, checkWorkDay, triggerFeedback]);

    const processQrPayload = useCallback(async (payload: string) => {
        if (qrProcessing) return;
        setQrProcessing(true);

        try {
            // Send the full payload — the API auto-detects format
            // Supports: NEXHRMS-DAY:*, NEXHRMS-QR:*, NEXHRMS-DYN-*
            const response = await fetch("/api/attendance/validate-qr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payload,
                    kioskId: deviceId,
                }),
            });

            const result = await response.json();

            if (!result.valid) {
                setErrorMessage(result.message || "Invalid QR code");
                triggerFeedback("error");
                setQrProcessing(false);
                return;
            }

            // Find employee
            const empId = result.employeeId;
            const emp = employees.find((e) => e.id === empId);
            
            if (emp) {
                stopQrScanner();
                clockEmployee(emp.id, emp.name);
            } else if (empId) {
                stopQrScanner();
                clockEmployee(empId, `Employee ${empId}`);
            } else {
                setErrorMessage("Employee not found");
                triggerFeedback("error");
            }
        } catch (error) {
            console.error("[processQrPayload] Error:", error);
            setErrorMessage("Failed to process QR code");
            triggerFeedback("error");
        } finally {
            setQrProcessing(false);
        }
    }, [employees, qrProcessing, deviceId, stopQrScanner, clockEmployee, triggerFeedback]);

    const startQrScanner = useCallback(async () => {
        setQrCameraError(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
            });
            qrStreamRef.current = stream;
            if (qrVideoRef.current) {
                qrVideoRef.current.srcObject = stream;
            }
            setQrScanning(true);

            // Use BarcodeDetector API if available
            if ("BarcodeDetector" in window) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
                qrScanIntervalRef.current = setInterval(async () => {
                    if (!qrVideoRef.current || qrVideoRef.current.readyState < 2) return;
                    try {
                        const barcodes = await detector.detect(qrVideoRef.current);
                        if (barcodes.length > 0 && barcodes[0].rawValue) {
                            processQrPayload(barcodes[0].rawValue);
                        }
                    } catch {
                        // Scan frame error - skip
                    }
                }, 300);
            }
        } catch {
            setQrCameraError(true);
            setQrScanning(true);
        }
    }, [processQrPayload]);

    // Demo QR tap (for testing without actual scanner)
    const handleDemoQrTap = async () => {
        // Fetch a real daily QR payload via the API for EMP027 (QR test employee)
        try {
            const res = await fetch(`/api/attendance/daily-qr?employeeId=EMP027`);
            if (res.ok) {
                const data = await res.json();
                processQrPayload(data.payload);
            } else {
                // Fallback: clock EMP027 directly
                const emp = employees.find((e) => e.id === "EMP027");
                clockEmployee("EMP027", emp?.name || "Jamie Reyes");
            }
        } catch {
            // Fallback: clock EMP027 directly
            const emp = employees.find((e) => e.id === "EMP027");
            clockEmployee("EMP027", emp?.name || "Jamie Reyes");
        }
    };

    // Time formatters
    const h = now.getHours();
    const timeStr = ks.clockFormat === "12h"
        ? `${h % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
        : `${String(h).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    const isSuccessIn = feedback === "success-in";
    const isSuccessOut = feedback === "success-out";
    const isError = feedback === "error";
    const isSuccess = isSuccessIn || isSuccessOut;

    return (
        <div className={cn(
            "fixed inset-0 flex flex-col transition-colors duration-700 select-none",
            isSuccess ? (isSuccessIn ? "bg-emerald-950" : "bg-sky-950") : isError ? "bg-red-950" : 
            ks.kioskTheme === "midnight" ? "bg-slate-950" : 
            ks.kioskTheme === "charcoal" ? "bg-neutral-950" : "bg-zinc-950"
        )}>
            {/* Ambient blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full blur-[130px] opacity-20 transition-colors duration-700"
                    style={{ backgroundColor: isSuccess ? (isSuccessIn ? "#10b981" : "#0ea5e9") : isError ? "#ef4444" : "#8b5cf6" }} />
            </div>

            {/* Top bar */}
            <header className="relative z-10 w-full flex items-center justify-between px-8 pt-6">
                <button
                    onClick={() => router.push("/kiosk/select")}
                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-sm">Back</span>
                </button>
                <div className="text-center">
                    {ks.showClock && (
                        <p className="text-white font-mono text-4xl font-bold tracking-widest tabular-nums drop-shadow-lg">
                            {timeStr}
                        </p>
                    )}
                    {ks.showDate && (
                        <p className="text-white/40 text-xs mt-1">{dateStr}</p>
                    )}
                </div>
                <div className="w-20" />
            </header>

            {/* Main content */}
            <main className="relative z-10 flex flex-col items-center justify-center gap-6 px-6 flex-1 w-full max-w-2xl">
                {/* Mode toggle */}
                <div className="flex rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] backdrop-blur-sm">
                    <button
                        onClick={() => { setMode("in"); }}
                        className={cn(
                            "px-10 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200",
                            mode === "in"
                                ? "bg-emerald-500/80 text-white shadow-lg shadow-emerald-900/30"
                                : "text-white/30 hover:text-white/60"
                        )}
                    >
                        <LogIn className="h-4 w-4" />
                        Check In
                    </button>
                    {ks.allowCheckOut && (
                        <button
                            onClick={() => { setMode("out"); }}
                            className={cn(
                                "px-10 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200",
                                mode === "out"
                                    ? "bg-sky-500/80 text-white shadow-lg shadow-sky-900/30"
                                    : "text-white/30 hover:text-white/60"
                            )}
                        >
                            <LogOut className="h-4 w-4" />
                            Check Out
                        </button>
                    )}
                </div>

                {/* Success/Error overlay */}
                {feedback !== "idle" && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="text-center space-y-4 animate-in zoom-in-90 duration-300">
                            {isSuccess ? (
                                <>
                                    <div className={cn("h-20 w-20 mx-auto rounded-full flex items-center justify-center",
                                        isSuccessIn ? "bg-emerald-500/20" : "bg-sky-500/20")}>
                                        <CheckCircle className={cn("h-10 w-10", isSuccessIn ? "text-emerald-400" : "text-sky-400")} />
                                    </div>
                                    <p className={cn("text-3xl font-bold", isSuccessIn ? "text-emerald-300" : "text-sky-300")}>
                                        {isSuccessIn ? "Checked In" : "Checked Out"}
                                    </p>
                                    {checkedInName && <p className="text-white/60 text-lg">{checkedInName}</p>}
                                    <p className="text-white/30 text-sm">{now.toLocaleTimeString()}</p>
                                </>
                            ) : (
                                <>
                                    <div className="h-20 w-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                                        <XCircle className="h-10 w-10 text-red-400" />
                                    </div>
                                    <p className="text-2xl font-bold text-red-300">Invalid - Try Again</p>
                                    <p className="text-white/30 text-sm">{errorMessage}</p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* QR Scanner Panel */}
                <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-8 backdrop-blur-sm flex flex-col items-center gap-5 shadow-2xl w-full max-w-sm">
                    <div className="flex items-center gap-2">
                        <QrCode className="h-4 w-4 text-violet-400/60" />
                        <p className="text-white/40 text-[11px] font-semibold uppercase tracking-widest">Scan QR Code</p>
                    </div>

                    {!qrScanning ? (
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-28 h-28 rounded-full border-2 border-white/15 bg-white/[0.03] flex items-center justify-center">
                                <QrCode className="h-10 w-10 text-white/25" />
                            </div>
                            <p className="text-white/30 text-xs text-center">
                                Open the camera to scan an employee&apos;s QR code
                            </p>
                            <div className="flex gap-2 w-full">
                                <button
                                    onClick={startQrScanner}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-semibold transition-all"
                                >
                                    <Camera className="h-4 w-4" />
                                    Start Scanner
                                </button>
                                <button
                                    onClick={handleDemoQrTap}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-all"
                                >
                                    Demo
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="relative w-full bg-black rounded-xl overflow-hidden" style={{ aspectRatio: "4/3", maxHeight: "240px" }}>
                                {!qrCameraError ? (
                                    <video ref={qrVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800">
                                        <CameraOff className="h-12 w-12 text-neutral-600" />
                                    </div>
                                )}
                                {/* Scan frame overlay */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-36 h-36 border-2 border-violet-400/50 rounded-lg relative">
                                        {["top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
                                            "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
                                            "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
                                            "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg"].map((c) => (
                                            <div key={c} className={`absolute w-6 h-6 border-violet-400 ${c}`} />
                                        ))}
                                    </div>
                                </div>
                                {qrProcessing && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => { stopQrScanner(); setQrCameraError(false); }}
                                className="text-white/50 hover:text-white text-xs"
                            >
                                Cancel
                            </button>
                        </>
                    )}
                </div>

                {/* Info */}
                <p className="text-white/40 text-xs text-center max-w-sm">
                    Daily QR codes rotate at midnight and are valid for the entire day.
                    View your QR code from the employee dashboard.
                </p>
            </main>

            {/* Footer */}
            <footer className="relative z-10 w-full flex items-center justify-center pb-6">
                <div className="flex items-center gap-2 text-white/30 text-xs">
                    <span>{companyName || "NexHRMS"} • QR Code Kiosk</span>
                </div>
            </footer>
        </div>
    );
}
