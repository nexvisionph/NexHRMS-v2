"use client";

import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEmployeesStore } from "@/store/employees.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useKioskStore } from "@/store/kiosk.store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    ArrowLeft, QrCode, LogIn, LogOut, CheckCircle, XCircle, CameraOff, Loader2, ClipboardList,
} from "lucide-react";
import jsQR from "jsqr";
import { canUseCamera, cameraHttpsHint } from "@/lib/camera-context";

// Neon theme colors
const NEON_GREEN = "#39FF14";
const NEON_GREEN_DIM = "rgba(57, 255, 20, 0.6)";

/** Isolated clock component — re-renders every second without triggering parent re-render */
const KioskClock = memo(function KioskClock({ clockFormat, showClock, showDate }: {
    clockFormat: string; showClock: boolean; showDate: boolean;
}) {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);
    const h = now.getHours();
    const timeStr = clockFormat === "12h"
        ? `${h % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
        : `${String(h).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    return (
        <div className="text-center">
            {showClock && (
                <p 
                    className="font-mono font-bold tracking-widest tabular-nums"
                    style={{ 
                        fontSize: "clamp(1.25rem, 3vw, 2.5rem)",
                        color: NEON_GREEN,
                        textShadow: `0 0 20px ${NEON_GREEN_DIM}, 0 0 40px ${NEON_GREEN_DIM}`
                    }}
                >
                    {timeStr}
                </p>
            )}
            {showDate && (
                <p className="text-white/40 mt-1" style={{ fontSize: "clamp(0.65rem, 1vw, 0.75rem)" }}>{dateStr}</p>
            )}
        </div>
    );
});

/**
 * QR Code Kiosk Page
 * 
 * Dedicated QR code scanning check-in/out terminal.
 * Uses daily HMAC-signed tokens with location validation.
 * Black and neon green SaaS branding.
 */

export default function QRKioskPage() {
    const router = useRouter();
    const ks = useKioskStore((s) => s.settings);
    const employees = useEmployeesStore((s) => s.employees);
    const attendanceLogs = useAttendanceStore((s) => s.logs);
    const companyName = useAppearanceStore((s) => s.companyName);
    const logoUrl = useAppearanceStore((s) => s.logoUrl);

    const [mode, setMode] = useState<"in" | "out">("in");
    const modeRef = useRef<"in" | "out">("in");
    const handleSetMode = useCallback((m: "in" | "out") => { setMode(m); modeRef.current = m; }, []);
    const [feedback, setFeedback] = useState<"idle" | "success-in" | "success-out" | "error">("idle");
    const [checkedInName, setCheckedInName] = useState("");
    const [errorMessage, setErrorMessage] = useState("QR code not recognized");
    const [deviceId] = useState(() => {
        if (typeof window === "undefined") return "";
        const stored = localStorage.getItem("sdsi-kiosk-qr-device-id");
        if (stored) return stored;
        const id = `KIOSK-QR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        localStorage.setItem("sdsi-kiosk-qr-device-id", id);
        return id;
    });

    // Daily activity log — persisted in sessionStorage, clears at midnight
    const [kioskLog, setKioskLog] = useState<Array<{ name: string; type: "in" | "out"; time: string }>>([]);

    // QR scanner state
    const [qrScanning, setQrScanning] = useState(false);
    const [qrCameraError, setQrCameraError] = useState(false);
    const [qrCameraMessage, setQrCameraMessage] = useState("Camera unavailable");
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

    // Derive today's activity from persisted attendance logs (survives refresh)
    const todayActivity = useMemo(() => {
        const today = new Date().toISOString().split("T")[0];
        const todayLogs = attendanceLogs.filter((l) => l.date === today && (l.checkIn || l.checkOut));
        const storeEntries: Array<{ name: string; type: "in" | "out"; time: string }> = [];
        for (const log of todayLogs) {
            const emp = employees.find((e) => e.id === log.employeeId);
            const name = emp?.name || log.employeeId;
            if (log.checkOut) {
                storeEntries.push({ name, type: "out", time: log.checkOut });
            }
            if (log.checkIn) {
                storeEntries.push({ name, type: "in", time: log.checkIn });
            }
        }
        // Merge session entries not already covered by store
        const storeKeys = new Set(storeEntries.map((e) => `${e.name}|${e.type}|${e.time}`));
        for (const entry of kioskLog) {
            const key = `${entry.name}|${entry.type}|${entry.time}`;
            if (!storeKeys.has(key)) storeEntries.push(entry);
        }
        storeEntries.sort((a, b) => b.time.localeCompare(a.time));
        return storeEntries;
    }, [attendanceLogs, employees, kioskLog]);

    // Verify PIN access — redirect if not verified; guard browser back
    useEffect(() => {
        const verified = sessionStorage.getItem("kiosk-pin-verified");
        const verifiedTime = sessionStorage.getItem("kiosk-pin-verified-time");
        
        if (!verified || !verifiedTime) {
            router.replace("/kiosk?target=qr");
            return;
        }

        const elapsed = Date.now() - parseInt(verifiedTime);
        if (elapsed > 5 * 60 * 1000) {
            sessionStorage.removeItem("kiosk-pin-verified");
            sessionStorage.removeItem("kiosk-pin-verified-time");
            router.replace("/kiosk?target=qr");
            return;
        }
        // Push a guard history entry so browser back clears PIN and redirects
        window.history.pushState({ kioskGuard: true }, "");
        const handlePopState = () => {
            sessionStorage.removeItem("kiosk-pin-verified");
            sessionStorage.removeItem("kiosk-pin-verified-time");
            router.replace("/kiosk");
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [router]);

    const stopQrScanner = useCallback(() => {
        qrStreamRef.current?.getTracks().forEach((t) => t.stop());
        qrStreamRef.current = null;
        if (qrVideoRef.current) {
            qrVideoRef.current.srcObject = null;
        }
        if (qrScanIntervalRef.current) {
            clearInterval(qrScanIntervalRef.current);
            qrScanIntervalRef.current = null;
        }
        setQrScanning(false);
    }, []);

    const waitForQrVideo = useCallback(async () => {
        for (let i = 0; i < 20; i += 1) {
            if (qrVideoRef.current) return qrVideoRef.current;
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return null;
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
            processingLockRef.current = false;
            // Auto-restart scanner after ANY feedback (success or error)
            if (autoRestartRef.current) {
                startQrScannerRef.current();
            }
        }, state === "error" ? Math.max(ks.feedbackDuration, 2000) : ks.feedbackDuration);
    }, [ks.feedbackDuration]);

    const addToKioskLog = useCallback((name: string) => {
        const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
        const currentMode = modeRef.current;
        const newEntry = { name, type: currentMode, time: timeNow };
        setKioskLog((prev) => {
            // Prevent duplicate: same name + same type + same time = skip
            const isDuplicate = prev.length > 0 && prev[0].name === name && prev[0].type === currentMode && prev[0].time === timeNow;
            if (isDuplicate) return prev;
            
            const updated = [newEntry, ...prev].slice(0, 100); // Keep max 100 entries
            try { sessionStorage.setItem("kiosk-qr-activity-log", JSON.stringify(updated)); } catch { /* full */ }
            return updated;
        });
    }, []);

    const clearKioskLog = useCallback(() => {
        setKioskLog([]);
        try { sessionStorage.removeItem("kiosk-qr-activity-log"); } catch { /* ignore */ }
    }, []);

    const { checkIn: storeCheckIn, checkOut: storeCheckOut } = useAttendanceStore();

    const clockEmployee = useCallback((empId: string, empName: string) => {
        // checkWorkDay for analytics (local only)
        if (modeRef.current === "in") checkWorkDay(empId);

        // DB write already happened in /api/attendance/validate-qr.
        // Sync local Zustand store so todayActivity and duplicate guards stay current.
        if (modeRef.current === "in") {
            storeCheckIn(empId);
        } else {
            storeCheckOut(empId);
        }

        // Activity log (local kiosk UI only)
        addToKioskLog(empName);
        triggerFeedback(modeRef.current === "in" ? "success-in" : "success-out", empName);
    }, [checkWorkDay, addToKioskLog, triggerFeedback, storeCheckIn, storeCheckOut]);

    // Use a ref for processQrPayload so the scanning interval always calls
    // the latest version — avoids stale closure issues when deps change.
    const processQrPayloadRef = useRef<(payload: string) => Promise<void>>(async () => {});

    const processQrPayload = useCallback(async (payload: string) => {
        // Use ref-based lock (synchronous) to prevent duplicate scans
        if (processingLockRef.current) return;
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
                    mode: modeRef.current,
                }),
            });

            const result = await response.json();

            // Project QR codes must be scanned with the employee's phone, not the kiosk
            if (result.qrType === "project") {
                setErrorMessage("Project QR — please scan this code with your phone");
                triggerFeedback("error");
                return;
            }

            if (!result.valid) {
                setErrorMessage(result.message || "Invalid QR code");
                triggerFeedback("error");
                return;
            }

            // Find employee
            const empId = result.employeeId;
            const emp = employees.find((e) => e.id === empId);

            if (emp) {
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
        }
        // NOTE: processingLockRef is cleared by triggerFeedback timeout —
        // do NOT clear it here or a second scan could fire before the
        // feedback overlay dismisses.
    }, [employees, deviceId, stopQrScanner, clockEmployee, triggerFeedback]);

    // Keep the ref in sync so the scan interval always uses the latest callback
    processQrPayloadRef.current = processQrPayload;

    const startQrScanner = useCallback(async () => {
        qrStreamRef.current?.getTracks().forEach((t) => t.stop());
        qrStreamRef.current = null;
        if (qrScanIntervalRef.current) {
            clearInterval(qrScanIntervalRef.current);
            qrScanIntervalRef.current = null;
        }
        setQrCameraError(false);
        setQrCameraMessage("Camera unavailable");
        setQrScanning(true);
        try {
            if (!canUseCamera(window)) {
                throw new Error(cameraHttpsHint("/kiosk/qr"));
            }
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error("Camera is not supported by this browser.");
            }

            const video = await waitForQrVideo();
            if (!video) {
                throw new Error("Camera preview did not load. Refresh the kiosk page and try again.");
            }

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

            video.srcObject = stream;
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error("Camera preview timed out.")), 5000);
                const onReady = () => {
                    video.play()
                        .then(() => {
                            clearTimeout(timeout);
                            resolve();
                        })
                        .catch((error) => {
                            clearTimeout(timeout);
                            reject(error);
                        });
                };
                if (video.readyState >= 2) onReady();
                else video.onloadedmetadata = onReady;
            });

            if ("BarcodeDetector" in window) {
                // Native BarcodeDetector (Chrome/Edge)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
                qrScanIntervalRef.current = setInterval(async () => {
                    if (!qrVideoRef.current || qrVideoRef.current.readyState < 2) return;
                    try {
                        const barcodes = await detector.detect(qrVideoRef.current);
                        if (barcodes.length > 0 && barcodes[0].rawValue) {
                            processQrPayloadRef.current(barcodes[0].rawValue);
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
                        processQrPayloadRef.current(code.data);
                    }
                }, 400);
            }
        } catch (err) {
            console.error("[QR] Camera error:", err);
            qrStreamRef.current?.getTracks().forEach((t) => t.stop());
            qrStreamRef.current = null;
            if (qrVideoRef.current) qrVideoRef.current.srcObject = null;
            setQrCameraMessage(err instanceof Error ? err.message : "Camera unavailable");
            setQrCameraError(true);
            setQrScanning(false);
        }
    }, [waitForQrVideo]);

    // Keep startQrScannerRef in sync to avoid circular dependency with triggerFeedback
    startQrScannerRef.current = startQrScanner;

    // Auto-start scanner once on initial page load (after PIN verification).
    // Scanner stays always-on — no manual start/stop.
    const hasAutoStartedRef = useRef(false);
    useEffect(() => {
        if (hasAutoStartedRef.current) return;
        const verified = sessionStorage.getItem("kiosk-pin-verified");
        if (verified && feedback === "idle") {
            hasAutoStartedRef.current = true;
            autoRestartRef.current = true;
            const timer = setTimeout(() => { startQrScanner(); }, 500);
            return () => clearTimeout(timer);
        }
    }, [startQrScanner, feedback]);

    const isSuccessIn = feedback === "success-in";
    const isSuccessOut = feedback === "success-out";
    const isError = feedback === "error";
    const isSuccess = isSuccessIn || isSuccessOut;

    return (
        <div className="fixed inset-0 flex flex-col select-none overflow-auto bg-black transition-colors duration-500">
            {/* Animated gradient background */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {/* Top-left neon blob */}
                <div 
                    className="absolute rounded-full blur-[150px] animate-pulse"
                    style={{
                        width: "clamp(300px, 40vw, 600px)",
                        height: "clamp(300px, 40vh, 600px)",
                        top: "-10%",
                        left: "-10%",
                        background: isSuccess 
                            ? (isSuccessIn ? "rgba(16, 185, 129, 0.3)" : "rgba(14, 165, 233, 0.3)")
                            : isError ? "rgba(239, 68, 68, 0.3)" : `linear-gradient(135deg, ${NEON_GREEN}40 0%, ${NEON_GREEN}10 100%)`,
                        animationDuration: "4s",
                    }}
                />
                {/* Bottom-right neon blob */}
                <div 
                    className="absolute rounded-full blur-[180px] animate-pulse"
                    style={{
                        width: "clamp(350px, 50vw, 700px)",
                        height: "clamp(350px, 50vh, 700px)",
                        bottom: "-15%",
                        right: "-15%",
                        background: isSuccess 
                            ? (isSuccessIn ? "rgba(16, 185, 129, 0.2)" : "rgba(14, 165, 233, 0.2)")
                            : isError ? "rgba(239, 68, 68, 0.2)" : `linear-gradient(315deg, ${NEON_GREEN}30 0%, transparent 70%)`,
                        animationDuration: "6s",
                        animationDelay: "1s",
                    }}
                />
                {/* Grid pattern */}
                <div 
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(${NEON_GREEN}20 1px, transparent 1px), linear-gradient(90deg, ${NEON_GREEN}20 1px, transparent 1px)`,
                        backgroundSize: "clamp(30px, 4vw, 50px) clamp(30px, 4vw, 50px)",
                    }}
                />
            </div>

            {/* Top bar */}
            <header 
                className="relative z-10 w-full flex items-center justify-between"
                style={{ padding: "clamp(1rem, 3vh, 1.5rem) clamp(1rem, 3vw, 2rem)" }}
            >
                <button
                    onClick={() => {
                        sessionStorage.removeItem("kiosk-pin-verified");
                        sessionStorage.removeItem("kiosk-pin-verified-time");
                        router.replace("/kiosk");
                    }}
                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors min-h-[44px]"
                    style={{ fontSize: "clamp(0.75rem, 1.2vw, 0.875rem)" }}
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                </button>
                <KioskClock clockFormat={ks.clockFormat} showClock={ks.showClock} showDate={ks.showDate} />
                <div className="flex items-center gap-3">
                    {ks.showLogo && logoUrl ? (
                        <Image
                            src={logoUrl}
                            alt={companyName}
                            width={120}
                            height={32}
                            className="object-contain brightness-0 invert opacity-90"
                            style={{ height: "clamp(1.5rem, 3vh, 2rem)", maxWidth: "clamp(80px, 10vw, 120px)", width: "auto" }}
                        />
                    ) : (
                        <span className="font-semibold text-white/40" style={{ fontSize: "clamp(0.75rem, 1.2vw, 0.875rem)" }}>
                            {companyName || "SDSI"}
                        </span>
                    )}
                </div>
            </header>

            {/* Success/Error overlay */}
            {feedback !== "idle" && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
                    <div className="text-center space-y-4 animate-in zoom-in-90 duration-300">
                        {isSuccess ? (
                            <>
                                <div 
                                    className="mx-auto rounded-full flex items-center justify-center"
                                    style={{
                                        width: "clamp(80px, 15vw, 120px)",
                                        height: "clamp(80px, 15vw, 120px)",
                                        background: isSuccessIn 
                                            ? `radial-gradient(circle, ${NEON_GREEN}30 0%, transparent 70%)`
                                            : "radial-gradient(circle, rgba(14, 165, 233, 0.3) 0%, transparent 70%)",
                                        boxShadow: isSuccessIn 
                                            ? `0 0 60px ${NEON_GREEN}40` 
                                            : "0 0 60px rgba(14, 165, 233, 0.4)",
                                    }}
                                >
                                    <CheckCircle 
                                        style={{ 
                                            width: "clamp(40px, 8vw, 60px)", 
                                            height: "clamp(40px, 8vw, 60px)",
                                            color: isSuccessIn ? NEON_GREEN : "#0ea5e9",
                                        }} 
                                    />
                                </div>
                                <p 
                                    className="font-bold"
                                    style={{ 
                                        fontSize: "clamp(1.5rem, 5vw, 2.5rem)",
                                        color: isSuccessIn ? NEON_GREEN : "#0ea5e9",
                                        textShadow: isSuccessIn 
                                            ? `0 0 30px ${NEON_GREEN}60` 
                                            : "0 0 30px rgba(14, 165, 233, 0.6)",
                                    }}
                                >
                                    {isSuccessIn ? "Checked In" : "Checked Out"}
                                </p>
                                {checkedInName && (
                                    <p 
                                        className="text-white font-bold mt-2"
                                        style={{ fontSize: "clamp(1.75rem, 6vw, 3rem)" }}
                                    >
                                        {checkedInName}
                                    </p>
                                )}
                                <p className="text-white/30" style={{ fontSize: "clamp(0.75rem, 1.5vw, 1rem)" }}>
                                    {new Date().toLocaleTimeString()}
                                </p>
                            </>
                        ) : (
                            <>
                                <div 
                                    className="mx-auto rounded-full bg-red-500/20 flex items-center justify-center"
                                    style={{
                                        width: "clamp(70px, 12vw, 100px)",
                                        height: "clamp(70px, 12vw, 100px)",
                                    }}
                                >
                                    <XCircle 
                                        className="text-red-400"
                                        style={{ 
                                            width: "clamp(35px, 6vw, 50px)", 
                                            height: "clamp(35px, 6vw, 50px)" 
                                        }} 
                                    />
                                </div>
                                <p 
                                    className="font-bold text-red-300"
                                    style={{ fontSize: "clamp(1.25rem, 3vw, 1.75rem)" }}
                                >
                                    Invalid - Try Again
                                </p>
                                <p className="text-white/30" style={{ fontSize: "clamp(0.75rem, 1.2vw, 0.875rem)" }}>
                                    {errorMessage}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Main content — two-column on desktop */}
            <main 
                className="relative z-10 flex flex-col lg:flex-row items-start justify-center flex-1 w-full mx-auto"
                style={{ 
                    gap: "clamp(1rem, 3vw, 2rem)",
                    padding: "clamp(1rem, 2vh, 1.5rem) clamp(1rem, 3vw, 2rem)",
                    maxWidth: "min(1400px, 95vw)",
                }}
            >
                {/* LEFT: QR Scanner Column */}
                <div 
                    className="flex flex-col items-center w-full lg:flex-shrink-0"
                    style={{ 
                        gap: "clamp(1rem, 2vh, 1.5rem)",
                        maxWidth: "min(480px, 100%)",
                    }}
                >
                    {/* Mode toggle */}
                    <div 
                        className="flex rounded-2xl overflow-hidden backdrop-blur-xl"
                        style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: `1px solid ${NEON_GREEN}20`,
                        }}
                    >
                        <button
                            onClick={() => handleSetMode("in")}
                            className={cn(
                                "flex items-center justify-center gap-2 font-semibold transition-all duration-200 min-h-[44px]",
                                mode === "in" ? "text-black" : "text-white/30 hover:text-white/60"
                            )}
                            style={{
                                padding: "clamp(0.6rem, 1.5vh, 0.75rem) clamp(1.5rem, 4vw, 2.5rem)",
                                fontSize: "clamp(0.75rem, 1.2vw, 0.875rem)",
                                background: mode === "in" ? NEON_GREEN : "transparent",
                                boxShadow: mode === "in" ? `0 0 30px ${NEON_GREEN}50` : "none",
                            }}
                        >
                            <LogIn className="h-4 w-4" />
                            Check In
                        </button>
                        {ks.allowCheckOut && (
                            <button
                                onClick={() => handleSetMode("out")}
                                className={cn(
                                    "flex items-center justify-center gap-2 font-semibold transition-all duration-200 min-h-[44px]",
                                    mode === "out" ? "text-black" : "text-white/30 hover:text-white/60"
                                )}
                                style={{
                                    padding: "clamp(0.6rem, 1.5vh, 0.75rem) clamp(1.5rem, 4vw, 2.5rem)",
                                    fontSize: "clamp(0.75rem, 1.2vw, 0.875rem)",
                                    background: mode === "out" ? "#0ea5e9" : "transparent",
                                    boxShadow: mode === "out" ? "0 0 30px rgba(14, 165, 233, 0.5)" : "none",
                                }}
                            >
                                <LogOut className="h-4 w-4" />
                                Check Out
                            </button>
                        )}
                    </div>

                    {/* QR Scanner Panel — Always On */}
                    <div 
                        className="rounded-3xl backdrop-blur-xl flex flex-col items-center shadow-2xl w-full"
                        style={{
                            padding: "clamp(1.25rem, 3vh, 2rem)",
                            background: "rgba(255, 255, 255, 0.03)",
                            border: `1px solid ${NEON_GREEN}15`,
                            gap: "clamp(1.25rem, 2.5vh, 1.75rem)",
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <QrCode style={{ color: NEON_GREEN, opacity: 0.6 }} className="h-4 w-4" />
                            <p 
                                className="font-semibold uppercase tracking-widest text-white/40"
                                style={{ fontSize: "clamp(0.6rem, 1vw, 0.7rem)" }}
                            >
                                Scan QR Code
                            </p>
                        </div>

                        {/* Always show camera view */}
                        <div 
                            className="relative w-full bg-black rounded-xl overflow-hidden" 
                            style={{ 
                                aspectRatio: "4/3", 
                                maxHeight: "clamp(220px, 40vh, 360px)",
                                border: `2px solid ${NEON_GREEN}30`,
                            }}
                        >
                            <video
                                ref={qrVideoRef}
                                autoPlay
                                muted
                                playsInline
                                className={cn(
                                    "absolute inset-0 w-full h-full object-cover transition-opacity",
                                    qrScanning && !qrCameraError ? "opacity-100" : "opacity-0"
                                )}
                            />
                            {qrCameraError ? (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-neutral-900 to-neutral-800">
                                    <CameraOff className="h-12 w-12 text-neutral-600" />
                                    <p className="max-w-[260px] text-center text-white/50" style={{ fontSize: "clamp(0.65rem, 1vw, 0.75rem)" }}>
                                        {qrCameraMessage}
                                    </p>
                                    <button
                                        onClick={() => { setQrCameraError(false); startQrScanner(); }}
                                        className="rounded-lg text-black font-semibold transition-all hover:opacity-90"
                                        style={{
                                            padding: "clamp(0.4rem, 1vh, 0.5rem) clamp(0.75rem, 2vw, 1rem)",
                                            fontSize: "clamp(0.65rem, 1vw, 0.75rem)",
                                            background: NEON_GREEN,
                                        }}
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : !qrScanning ? (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-neutral-900 to-neutral-800">
                                    <Loader2 style={{ color: NEON_GREEN }} className="h-10 w-10 animate-spin" />
                                    <p className="text-white/40" style={{ fontSize: "clamp(0.65rem, 1vw, 0.75rem)" }}>
                                        Starting camera...
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Scan frame overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div 
                                            className="rounded-lg relative"
                                            style={{
                                                width: "clamp(110px, 22vw, 180px)",
                                                height: "clamp(110px, 22vw, 180px)",
                                                border: `2px solid ${NEON_GREEN}50`,
                                            }}
                                        >
                                            {["top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
                                                "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
                                                "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
                                                "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg"].map((c) => (
                                                <div key={c} className={`absolute w-6 h-6 ${c}`} style={{ borderColor: NEON_GREEN }} />
                                            ))}
                                        </div>
                                    </div>
                                    {qrProcessing && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <Loader2 style={{ color: NEON_GREEN }} className="h-8 w-8 animate-spin" />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <p 
                            className="text-white/40 text-center"
                            style={{ fontSize: "clamp(0.65rem, 1vw, 0.75rem)" }}
                        >
                            Position your QR code within the frame
                        </p>
                    </div>

                    {/* Info */}
                    <p 
                        className="text-white/30 text-center"
                        style={{ 
                            fontSize: "clamp(0.6rem, 0.9vw, 0.7rem)",
                            maxWidth: "min(380px, 90vw)",
                        }}
                    >
                        Daily QR codes rotate at midnight. View your QR code from the employee dashboard.
                    </p>
                </div>

                {/* RIGHT: Daily Activity Log */}
                <div 
                    className="w-full lg:flex-1 rounded-3xl backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col"
                    style={{
                        maxWidth: "min(400px, 100%)",
                        maxHeight: "clamp(300px, 50vh, 500px)",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: `1px solid ${NEON_GREEN}15`,
                    }}
                >
                    <div 
                        className="flex items-center gap-2"
                        style={{
                            padding: "clamp(0.75rem, 1.5vh, 1rem) clamp(1rem, 2vw, 1.25rem)",
                            borderBottom: `1px solid ${NEON_GREEN}10`,
                        }}
                    >
                        <ClipboardList style={{ color: NEON_GREEN, opacity: 0.7 }} className="h-4 w-4" />
                        <h2 
                            className="font-semibold uppercase tracking-widest text-white/70"
                            style={{ fontSize: "clamp(0.6rem, 1vw, 0.7rem)" }}
                        >
                            Today&apos;s Activity
                        </h2>
                        <span 
                            className="ml-auto tabular-nums text-white/30"
                            style={{ fontSize: "clamp(0.55rem, 0.9vw, 0.65rem)" }}
                        >
                            {todayActivity.length} {todayActivity.length === 1 ? "entry" : "entries"}
                        </span>
                        {todayActivity.length > 0 && (
                            <button
                                onClick={clearKioskLog}
                                className="p-1 rounded hover:bg-white/10 transition-colors text-white/30"
                                title="Clear activity log"
                            >
                                <XCircle className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                    <div 
                        className="flex-1 overflow-y-auto space-y-1.5"
                        style={{ padding: "clamp(0.5rem, 1.5vh, 0.75rem)" }}
                    >
                        {todayActivity.length === 0 ? (
                            <div 
                                className="flex flex-col items-center justify-center gap-2"
                                style={{ padding: "clamp(1.5rem, 5vh, 3rem) 0" }}
                            >
                                <ClipboardList className="text-white/10" style={{ width: "clamp(24px, 5vw, 32px)", height: "clamp(24px, 5vw, 32px)" }} />
                                <p className="text-white/20" style={{ fontSize: "clamp(0.65rem, 1vw, 0.75rem)" }}>No activity yet today</p>
                                <p className="text-white/10" style={{ fontSize: "clamp(0.55rem, 0.9vw, 0.65rem)" }}>Scan a QR code to check in or out</p>
                            </div>
                        ) : (
                            todayActivity.map((entry, i) => (
                                <div 
                                    key={i} 
                                    className="flex items-center gap-3 rounded-xl transition-colors"
                                    style={{
                                        padding: "clamp(0.5rem, 1vh, 0.75rem) clamp(0.75rem, 1.5vw, 1rem)",
                                        background: entry.type === "in" 
                                            ? `${NEON_GREEN}08` 
                                            : "rgba(14, 165, 233, 0.05)",
                                        border: entry.type === "in"
                                            ? `1px solid ${NEON_GREEN}20`
                                            : "1px solid rgba(14, 165, 233, 0.2)",
                                    }}
                                >
                                    <div 
                                        className="rounded-full flex items-center justify-center shrink-0"
                                        style={{
                                            width: "clamp(24px, 4vw, 32px)",
                                            height: "clamp(24px, 4vw, 32px)",
                                            background: entry.type === "in" ? `${NEON_GREEN}20` : "rgba(14, 165, 233, 0.2)",
                                        }}
                                    >
                                        {entry.type === "in"
                                            ? <LogIn style={{ color: NEON_GREEN, width: "clamp(12px, 2vw, 16px)", height: "clamp(12px, 2vw, 16px)" }} />
                                            : <LogOut className="text-sky-400" style={{ width: "clamp(12px, 2vw, 16px)", height: "clamp(12px, 2vw, 16px)" }} />
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p 
                                            className="font-medium truncate text-white/80"
                                            style={{ fontSize: "clamp(0.75rem, 1.2vw, 0.875rem)" }}
                                        >
                                            {entry.name}
                                        </p>
                                        <p 
                                            style={{ 
                                                fontSize: "clamp(0.55rem, 0.9vw, 0.65rem)",
                                                color: entry.type === "in" ? `${NEON_GREEN}99` : "rgba(14, 165, 233, 0.6)",
                                            }}
                                        >
                                            {entry.type === "in" ? "Checked In" : "Checked Out"}
                                        </p>
                                    </div>
                                    <span 
                                        className="tabular-nums shrink-0 text-white/30"
                                        style={{ fontSize: "clamp(0.55rem, 0.9vw, 0.65rem)" }}
                                    >
                                        {entry.time}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer 
                className="relative z-10 w-full flex items-center justify-center"
                style={{ padding: "clamp(0.75rem, 2vh, 1.5rem) 0" }}
            >
                <div 
                    className="flex items-center gap-2 text-white/20"
                    style={{ fontSize: "clamp(0.6rem, 1vw, 0.75rem)" }}
                >
                    <div 
                        className="h-1.5 w-1.5 rounded-full animate-pulse"
                        style={{ backgroundColor: NEON_GREEN }}
                    />
                    <span>{companyName || "Soren Data Solutions Inc."} • QR Code Kiosk</span>
                </div>
            </footer>
        </div>
    );
}
