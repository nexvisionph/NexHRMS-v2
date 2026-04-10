"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEmployeesStore } from "@/store/employees.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useKioskStore } from "@/store/kiosk.store";
import { useProjectsStore } from "@/store/projects.store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    ArrowLeft, QrCode, LogIn, LogOut, CheckCircle, XCircle, Camera, CameraOff, Loader2, ClipboardList,
} from "lucide-react";
import jsQR from "jsqr";

/**
 * QR Code Kiosk Page
 * 
 * Dedicated QR code scanning check-in/out terminal.
 * Uses daily HMAC-signed tokens with location validation.
 * Theme-aware: supports light/dark via app theme when kioskTheme is "auto".
 */

export default function QRKioskPage() {
    const router = useRouter();
    const ks = useKioskStore((s) => s.settings);
    const employees = useEmployeesStore((s) => s.employees);
    const companyName = useAppearanceStore((s) => s.companyName);
    const logoUrl = useAppearanceStore((s) => s.logoUrl);
    const getProjectForEmployee = useProjectsStore((s) => s.getProjectForEmployee);

    const isAutoTheme = ks.kioskTheme === "auto";

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

    // Daily activity log — persisted in sessionStorage, clears at midnight
    const [kioskLog, setKioskLog] = useState<Array<{ name: string; type: "in" | "out"; time: string }>>([]);

    // QR scanner state
    const [qrScanning, setQrScanning] = useState(false);
    const [qrCameraError, setQrCameraError] = useState(false);
    const [qrProcessing, setQrProcessing] = useState(false);
    const processingLockRef = useRef(false); // Synchronous lock to prevent duplicate scans
    const qrVideoRef = useRef<HTMLVideoElement>(null);
    const qrStreamRef = useRef<MediaStream | null>(null);
    const qrScanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Initialize/restore daily log from sessionStorage
    useEffect(() => {
        const storedDate = sessionStorage.getItem("kiosk-qr-log-date");
        const today = new Date().toISOString().split("T")[0];
        if (storedDate !== today) {
            sessionStorage.removeItem("kiosk-qr-activity-log");
            sessionStorage.setItem("kiosk-qr-log-date", today);
            setKioskLog([]);
        } else {
            try {
                const saved = sessionStorage.getItem("kiosk-qr-activity-log");
                if (saved) setKioskLog(JSON.parse(saved));
            } catch { /* ignore parse errors */ }
        }
    }, []);

    // Verify PIN access
    useEffect(() => {
        const verified = sessionStorage.getItem("kiosk-pin-verified");
        const verifiedTime = sessionStorage.getItem("kiosk-pin-verified-time");
        
        if (!verified || !verifiedTime) {
            router.push("/kiosk?target=qr");
            return;
        }

        const elapsed = Date.now() - parseInt(verifiedTime);
        if (elapsed > 5 * 60 * 1000) {
            sessionStorage.removeItem("kiosk-pin-verified");
            sessionStorage.removeItem("kiosk-pin-verified-time");
            router.push("/kiosk?target=qr");
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

    const autoRestartRef = useRef(true);
    const startQrScannerRef = useRef<() => void>(() => {});

    const triggerFeedback = useCallback((state: "idle" | "success-in" | "success-out" | "error", name?: string) => {
        setFeedback(state);
        if (name) setCheckedInName(name);
        setTimeout(() => {
            setFeedback("idle");
            setCheckedInName("");
            setQrProcessing(false);
            // Auto-restart scanner for the next employee
            if (autoRestartRef.current && (state === "success-in" || state === "success-out")) {
                startQrScannerRef.current();
            }
        }, ks.feedbackDuration);
    }, [ks.feedbackDuration]);

    const addToKioskLog = useCallback((name: string) => {
        const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
        const newEntry = { name, type: mode, time: timeNow };
        setKioskLog((prev) => {
            // Prevent duplicate: same name + same type + same time = skip
            const isDuplicate = prev.length > 0 && prev[0].name === name && prev[0].type === mode && prev[0].time === timeNow;
            if (isDuplicate) return prev;
            
            const updated = [newEntry, ...prev].slice(0, 100); // Keep max 100 entries
            try { sessionStorage.setItem("kiosk-qr-activity-log", JSON.stringify(updated)); } catch { /* full */ }
            return updated;
        });
    }, [mode]);

    const clearKioskLog = useCallback(() => {
        setKioskLog([]);
        try { sessionStorage.removeItem("kiosk-qr-activity-log"); } catch { /* ignore */ }
    }, []);

    const clockEmployee = useCallback((empId: string, empName: string) => {
        // checkWorkDay for analytics (local only)
        if (mode === "in") checkWorkDay(empId);

        // NOTE: DB write already happened in /api/attendance/validate-qr
        // We no longer call store checkIn/checkOut here to avoid double-writes

        // Activity log (local kiosk UI only)
        addToKioskLog(empName);
        triggerFeedback(mode === "in" ? "success-in" : "success-out", empName);
    }, [mode, checkWorkDay, addToKioskLog, triggerFeedback]);

    const processQrPayload = useCallback(async (payload: string) => {
        // Use ref-based lock (synchronous) to prevent duplicate scans
        if (processingLockRef.current || qrProcessing) return;
        processingLockRef.current = true;
        setQrProcessing(true);

        // Stop scanner immediately to prevent more scans while processing
        stopQrScanner();

        try {
            const response = await fetch("/api/attendance/validate-qr", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(process.env.NEXT_PUBLIC_KIOSK_API_KEY
                        ? { "x-kiosk-api-key": process.env.NEXT_PUBLIC_KIOSK_API_KEY }
                        : {}),
                },
                body: JSON.stringify({
                    payload,
                    kioskId: deviceId,
                    mode,
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
                // Check if employee's project requires face_only verification
                const project = getProjectForEmployee(emp.id);
                if (project?.verificationMethod === "face_only") {
                    setErrorMessage(`${emp.name}'s project requires face verification. Use the Face kiosk.`);
                    triggerFeedback("error");
                    return;
                }
                clockEmployee(emp.id, emp.name);
            } else if (empId) {
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
            processingLockRef.current = false;
        }
    }, [employees, qrProcessing, deviceId, stopQrScanner, clockEmployee, getProjectForEmployee, triggerFeedback]);

    const startQrScanner = useCallback(async () => {
        setQrCameraError(false);
        setQrScanning(true);
        try {
            // Try environment camera first; fall back to any camera (for desktops)
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
                });
            } catch {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 } },
                });
            }
            qrStreamRef.current = stream;

            if (qrVideoRef.current) {
                qrVideoRef.current.srcObject = stream;
                // Ensure video plays — required on some browsers/deployments
                await new Promise<void>((resolve) => {
                    const v = qrVideoRef.current!;
                    const onReady = () => {
                        v.play().catch(() => {}).finally(resolve);
                    };
                    if (v.readyState >= 2) { onReady(); } else { v.onloadedmetadata = onReady; }
                });
            }

            if ("BarcodeDetector" in window) {
                // Native BarcodeDetector (Chrome/Edge)
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
            } else {
                // Fallback: jsQR (Safari, Firefox, and other browsers)
                if (!qrCanvasRef.current) {
                    qrCanvasRef.current = document.createElement("canvas");
                }
                const canvas = qrCanvasRef.current;
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                qrScanIntervalRef.current = setInterval(() => {
                    if (!qrVideoRef.current || qrVideoRef.current.readyState < 2 || !ctx) return;
                    canvas.width = qrVideoRef.current.videoWidth;
                    canvas.height = qrVideoRef.current.videoHeight;
                    ctx.drawImage(qrVideoRef.current, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, canvas.width, canvas.height);
                    if (code?.data) {
                        processQrPayload(code.data);
                    }
                }, 400);
            }
        } catch (err) {
            console.error("[QR] Camera error:", err);
            setQrCameraError(true);
        }
    }, [processQrPayload]);

    // Keep startQrScannerRef in sync to avoid circular dependency with triggerFeedback
    startQrScannerRef.current = startQrScanner;

    // Auto-start scanner when page loads (after PIN verification)
    useEffect(() => {
        const verified = sessionStorage.getItem("kiosk-pin-verified");
        if (verified && !qrScanning && feedback === "idle") {
            // Small delay to allow video element to mount
            const timer = setTimeout(() => {
                startQrScanner();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [startQrScanner, qrScanning, feedback]);

    // Demo QR tap (for testing without actual scanner)
    const handleDemoQrTap = async () => {
        try {
            const res = await fetch(`/api/attendance/daily-qr?employeeId=EMP027`);
            if (res.ok) {
                const data = await res.json();
                processQrPayload(data.payload);
            } else {
                // Show error instead of fake clock-in
                setErrorMessage("Demo employee not found");
                triggerFeedback("error");
            }
        } catch {
            setErrorMessage("Failed to generate demo QR");
            triggerFeedback("error");
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

    // Theme-aware classes
    const bgClass = isSuccess ? (isSuccessIn ? "bg-emerald-950 dark:bg-emerald-950" : "bg-sky-950 dark:bg-sky-950") :
        isError ? "bg-red-950 dark:bg-red-950" :
        isAutoTheme ? "bg-background" :
        ks.kioskTheme === "midnight" ? "bg-slate-950" :
        ks.kioskTheme === "charcoal" ? "bg-neutral-950" : "bg-zinc-950";
    const textClass = isAutoTheme && !isSuccess && !isError ? "text-foreground" : "text-white";
    const textMutedClass = isAutoTheme && !isSuccess && !isError ? "text-muted-foreground" : "text-white/40";
    const textFaintClass = isAutoTheme && !isSuccess && !isError ? "text-muted-foreground/40" : "text-white/30";
    const cardClass = isAutoTheme && !isSuccess && !isError ? "bg-card border-border" : "bg-white/[0.04] border-white/10";
    const toggleBgClass = isAutoTheme && !isSuccess && !isError ? "border-border bg-muted/30" : "border-white/10 bg-white/[0.03]";
    const toggleInactiveClass = isAutoTheme && !isSuccess && !isError ? "text-muted-foreground hover:text-foreground" : "text-white/30 hover:text-white/60";

    return (
        <div className={cn(
            "fixed inset-0 flex flex-col transition-colors duration-700 select-none overflow-auto",
            bgClass
        )}>
            {/* Ambient blobs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full blur-[130px] opacity-20 transition-colors duration-700"
                    style={{ backgroundColor: isSuccess ? (isSuccessIn ? "#10b981" : "#0ea5e9") : isError ? "#ef4444" : "#8b5cf6" }} />
            </div>

            {/* Top bar */}
            <header className="relative z-10 w-full flex items-center justify-between px-4 sm:px-8 pt-4 sm:pt-6">
                <button
                    onClick={() => router.push("/kiosk")}
                    className={cn("flex items-center gap-2 transition-colors min-h-[44px]",
                        isAutoTheme && !isSuccess && !isError ? "text-muted-foreground hover:text-foreground" : "text-white/50 hover:text-white"
                    )}
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="text-sm">Back</span>
                </button>
                <div className="text-center">
                    {ks.showClock && (
                        <p className={cn("font-mono text-2xl sm:text-4xl font-bold tracking-widest tabular-nums drop-shadow-lg", textClass)}>
                            {timeStr}
                        </p>
                    )}
                    {ks.showDate && (
                        <p className={cn("text-xs mt-1", textMutedClass)}>{dateStr}</p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {ks.showLogo && logoUrl ? (
                        <img src={logoUrl} alt={companyName}
                            className={cn("h-7 max-w-[100px] object-contain", !isAutoTheme && "brightness-0 invert opacity-90")} />
                    ) : (
                        <span className={cn("font-semibold text-sm", textMutedClass)}>{companyName || "NexHRMS"}</span>
                    )}
                </div>
            </header>

            {/* Success/Error overlay */}
            {feedback !== "idle" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="text-center space-y-4 animate-in zoom-in-90 duration-300">
                        {isSuccess ? (
                            <>
                                <div className={cn("h-24 w-24 mx-auto rounded-full flex items-center justify-center",
                                    isSuccessIn ? "bg-emerald-500/20" : "bg-sky-500/20")}>
                                    <CheckCircle className={cn("h-12 w-12", isSuccessIn ? "text-emerald-400" : "text-sky-400")} />
                                </div>
                                <p className={cn("text-3xl font-bold", isSuccessIn ? "text-emerald-300" : "text-sky-300")}>
                                    {isSuccessIn ? "Checked In" : "Checked Out"}
                                </p>
                                {checkedInName && (
                                    <p className="text-white text-4xl font-bold mt-2">{checkedInName}</p>
                                )}
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

            {/* Main content — two-column on desktop */}
            <main className="relative z-10 flex flex-col lg:flex-row items-start justify-center gap-4 sm:gap-6 px-4 sm:px-6 flex-1 w-full max-w-6xl mx-auto py-4">
                {/* LEFT: QR Scanner Column */}
                <div className="flex flex-col items-center gap-4 sm:gap-6 w-full lg:w-[420px] lg:flex-shrink-0">
                    {/* Mode toggle */}
                    <div className={cn("flex rounded-2xl overflow-hidden border backdrop-blur-sm", toggleBgClass)}>
                        <button
                            onClick={() => setMode("in")}
                            className={cn(
                                "px-6 sm:px-10 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 min-h-[44px]",
                                mode === "in"
                                    ? "bg-emerald-500/80 text-white shadow-lg shadow-emerald-900/30"
                                    : toggleInactiveClass
                            )}
                        >
                            <LogIn className="h-4 w-4" />
                            Check In
                        </button>
                        {ks.allowCheckOut && (
                            <button
                                onClick={() => setMode("out")}
                                className={cn(
                                    "px-6 sm:px-10 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 min-h-[44px]",
                                    mode === "out"
                                        ? "bg-sky-500/80 text-white shadow-lg shadow-sky-900/30"
                                        : toggleInactiveClass
                                )}
                            >
                                <LogOut className="h-4 w-4" />
                                Check Out
                            </button>
                        )}
                    </div>

                    {/* QR Scanner Panel */}
                    <div className={cn(
                        "rounded-3xl p-4 sm:p-6 backdrop-blur-sm flex flex-col items-center gap-4 sm:gap-5 shadow-2xl w-full border",
                        cardClass
                    )}>
                        <div className="flex items-center gap-2">
                            <QrCode className="h-4 w-4 text-violet-400/60" />
                            <p className={cn("text-[11px] font-semibold uppercase tracking-widest", textMutedClass)}>Scan QR Code</p>
                        </div>

                        {!qrScanning ? (
                            <div className="flex flex-col items-center gap-4">
                                <div className={cn(
                                    "w-28 h-28 rounded-full border-2 flex items-center justify-center",
                                    isAutoTheme ? "border-border bg-muted/30" : "border-white/15 bg-white/[0.03]"
                                )}>
                                    <QrCode className={cn("h-10 w-10", isAutoTheme ? "text-muted-foreground/40" : "text-white/25")} />
                                </div>
                                <p className={cn("text-xs text-center", textMutedClass)}>
                                    Open the camera to scan an employee&apos;s QR code
                                </p>
                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={() => { autoRestartRef.current = true; startQrScanner(); }}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-semibold transition-all min-h-[44px]"
                                    >
                                        <Camera className="h-4 w-4" />
                                        Start Scanner
                                    </button>
                                    {process.env.NODE_ENV === "development" && (
                                        <button
                                            onClick={handleDemoQrTap}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all min-h-[44px]",
                                                isAutoTheme ? "bg-muted hover:bg-muted/80 text-foreground" : "bg-white/10 hover:bg-white/15 text-white"
                                            )}
                                        >
                                            Demo
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="relative w-full bg-black rounded-xl overflow-hidden" style={{ aspectRatio: "4/3", maxHeight: "280px" }}>
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
                                    onClick={() => { autoRestartRef.current = false; stopQrScanner(); setQrCameraError(false); }}
                                    className={cn("text-xs min-h-[44px]",
                                        isAutoTheme ? "text-muted-foreground hover:text-foreground" : "text-white/50 hover:text-white"
                                    )}
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>

                    {/* Info */}
                    <p className={cn("text-xs text-center max-w-sm", textMutedClass)}>
                        Daily QR codes rotate at midnight and are valid for the entire day.
                        View your QR code from the employee dashboard.
                    </p>
                </div>

                {/* RIGHT: Daily Activity Log */}
                <div className={cn(
                    "w-full lg:flex-1 lg:max-w-sm rounded-3xl backdrop-blur-sm shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-160px)] border",
                    cardClass
                )}>
                    <div className={cn("px-4 py-3 border-b flex items-center gap-2",
                        isAutoTheme ? "border-border" : "border-white/10"
                    )}>
                        <ClipboardList className="h-4 w-4 text-violet-400/70" />
                        <h2 className={cn("text-xs font-semibold uppercase tracking-widest",
                            isAutoTheme ? "text-muted-foreground" : "text-white/70"
                        )}>Today&apos;s Activity</h2>
                        <span className={cn("ml-auto text-[10px] tabular-nums", textFaintClass)}>
                            {kioskLog.length} {kioskLog.length === 1 ? "entry" : "entries"}
                        </span>
                        {kioskLog.length > 0 && (
                            <button
                                onClick={clearKioskLog}
                                className={cn("p-1 rounded hover:bg-white/10 transition-colors", textFaintClass)}
                                title="Clear activity log"
                            >
                                <XCircle className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                        {kioskLog.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2">
                                <ClipboardList className={cn("h-8 w-8", isAutoTheme ? "text-muted-foreground/20" : "text-white/10")} />
                                <p className={cn("text-xs", isAutoTheme ? "text-muted-foreground/40" : "text-white/20")}>No activity yet today</p>
                                <p className={cn("text-[10px]", isAutoTheme ? "text-muted-foreground/30" : "text-white/10")}>Scan a QR code to check in or out</p>
                            </div>
                        ) : (
                            kioskLog.map((entry, i) => (
                                <div key={i} className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors",
                                    entry.type === "in"
                                        ? "bg-emerald-500/5 border-emerald-500/20"
                                        : "bg-sky-500/5 border-sky-500/20"
                                )}>
                                    <div className={cn(
                                        "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                                        entry.type === "in" ? "bg-emerald-500/20" : "bg-sky-500/20"
                                    )}>
                                        {entry.type === "in"
                                            ? <LogIn className="h-3.5 w-3.5 text-emerald-400" />
                                            : <LogOut className="h-3.5 w-3.5 text-sky-400" />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn("text-sm font-medium truncate", isAutoTheme ? "text-foreground" : "text-white/80")}>{entry.name}</p>
                                        <p className={cn(
                                            "text-[10px]",
                                            entry.type === "in" ? "text-emerald-400/60" : "text-sky-400/60"
                                        )}>
                                            {entry.type === "in" ? "Checked In" : "Checked Out"}
                                        </p>
                                    </div>
                                    <span className={cn("text-[10px] tabular-nums shrink-0", textFaintClass)}>{entry.time}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 w-full flex items-center justify-center pb-4 sm:pb-6">
                <div className={cn("flex items-center gap-2 text-xs", textFaintClass)}>
                    <span>{companyName || "NexHRMS"} • QR Code Kiosk</span>
                </div>
            </footer>
        </div>
    );
}
