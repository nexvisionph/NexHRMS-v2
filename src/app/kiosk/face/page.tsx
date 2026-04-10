"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAttendanceStore } from "@/store/attendance.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useKioskStore } from "@/store/kiosk.store";
import { useProjectsStore } from "@/store/projects.store";
import { loadFaceModels, detectFace, detectFaceQuick, averageDescriptors, descriptorConsistency } from "@/lib/face-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    ArrowLeft, ScanFace, LogIn, LogOut, CheckCircle, XCircle,
    Loader2, RotateCcw, AlertTriangle, Camera, ClipboardList,
} from "lucide-react";

/**
 * Face Recognition Kiosk Page
 *
 * Uses face-api.js (client-side, WebGL) for real 128-d embedding computation.
 * Sends embedding to server for matching against enrolled employees.
 * Qwen AI liveness check can be layered on top via /api/attendance/verify-face.
 */

type ScanState = "loading" | "idle" | "scanning" | "verifying" | "verified" | "failed";

export default function FaceKioskPage() {
    const router = useRouter();
    const ks = useKioskStore((s) => s.settings);
    const { appendEvent, checkIn, checkOut } = useAttendanceStore();
    const employees = useEmployeesStore((s) => s.employees);
    const companyName = useAppearanceStore((s) => s.companyName);
    const logoUrl = useAppearanceStore((s) => s.logoUrl);
    const getProjectForEmployee = useProjectsStore((s) => s.getProjectForEmployee);

    const isAutoTheme = ks.kioskTheme === "auto";

    const [mode, setMode] = useState<"in" | "out">("in");
    const [feedback, setFeedback] = useState<"idle" | "success-in" | "success-out" | "error">("idle");
    const [now, setNow] = useState(new Date());
    const [scanState, setScanState] = useState<ScanState>("loading");
    const [matchedName, setMatchedName] = useState("");
    const [matchDistance, setMatchDistance] = useState<number | null>(null);
    const [checkedInName, setCheckedInName] = useState("");
    const [enrollmentChecked, setEnrollmentChecked] = useState(false);
    const [isEnrolled, setIsEnrolled] = useState(true);

    // Persistent device identifier (same pattern as QR kiosk)
    const [deviceId] = useState(() => {
        if (typeof window === "undefined") return "";
        const stored = localStorage.getItem("nexhrms-kiosk-face-device-id");
        if (stored) return stored;
        const id = `KIOSK-FACE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        localStorage.setItem("nexhrms-kiosk-face-device-id", id);
        return id;
    });

    // Daily kiosk activity log — tracks each check-in/out event with name & time
    const [kioskLog, setKioskLog] = useState<Array<{ name: string; type: "in" | "out"; time: string }>>([]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // ── Auto-detect tracking refs ──
    const autoDetectRef = useRef<number | null>(null);
    const faceSeenSinceRef = useRef<number | null>(null);
    const scanCooldownRef = useRef<number>(0);
    const autoConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [trackingBox, setTrackingBox] = useState<{ x: number; y: number; w: number; h: number; score: number } | null>(null);
    const [trackingStatus, setTrackingStatus] = useState<"no-face" | "detecting" | "hold-steady" | "scanning" | "matched">("no-face");
    const [autoConfirmCountdown, setAutoConfirmCountdown] = useState<number | null>(null);

    // Clear kiosk log at midnight
    useEffect(() => {
        const storedDate = sessionStorage.getItem("kiosk-log-date");
        const today = new Date().toISOString().split("T")[0];
        if (storedDate !== today) {
            sessionStorage.removeItem("kiosk-activity-log");
            sessionStorage.setItem("kiosk-log-date", today);
            setKioskLog([]);
        } else {
            try {
                const saved = sessionStorage.getItem("kiosk-activity-log");
                if (saved) setKioskLog(JSON.parse(saved));
            } catch { /* ignore parse errors */ }
        }
    }, []);

    // PIN verification
    useEffect(() => {
        const verified = sessionStorage.getItem("kiosk-pin-verified");
        const verifiedTime = sessionStorage.getItem("kiosk-pin-verified-time");
        if (!verified || !verifiedTime) { router.push("/kiosk?target=face"); return; }
        const elapsed = Date.now() - parseInt(verifiedTime);
        if (elapsed > 5 * 60 * 1000) {
            sessionStorage.removeItem("kiosk-pin-verified");
            sessionStorage.removeItem("kiosk-pin-verified-time");
            router.push("/kiosk?target=face");
        }
    }, [router]);

    // Load face-api.js models + start camera
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await loadFaceModels();
                if (cancelled) return;
                const mobile = window.innerWidth < 768 || ("ontouchstart" in window);
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "user",
                        width: { ideal: mobile ? 480 : 640 },
                        height: { ideal: mobile ? 640 : 480 },
                    },
                });
                if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    // Wait for metadata before enabling scan — ensures videoWidth/Height are ready
                    await new Promise<void>((resolve) => {
                        const v = videoRef.current!;
                        if (v.readyState >= 2) { v.play().catch(() => {}); resolve(); return; }
                        v.onloadedmetadata = () => { v.play().catch(() => {}); resolve(); };
                    });
                }
                if (!cancelled) setScanState("idle");
            } catch (err) {
                console.error("Face kiosk init error:", err);
                setScanState("failed");
            }
        })();
        return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
    }, []);

    // On a shared kiosk, enrollment check is skipped — matching happens server-side against all enrolled faces
    useEffect(() => {
        setIsEnrolled(true);
        setEnrollmentChecked(true);
    }, []);

    // ── Auto-detect tracking refs and refs for handler functions ──
    const scanStateRef = useRef(scanState);
    scanStateRef.current = scanState;
    const feedbackRef = useRef(feedback);
    feedbackRef.current = feedback;
    const handleScanRef = useRef<() => void>(() => {});

    useEffect(() => {
        if (scanState !== "idle") return;
        if (feedback !== "idle") return;

        let cancelled = false;
        const FACE_HOLD_MS = 1200; // hold face steady for 1.2s before triggering scan
        const SCAN_COOLDOWN_MS = 4000; // cooldown between auto-scans

        async function trackLoop() {
            if (cancelled) return;
            if (scanStateRef.current !== "idle" || feedbackRef.current !== "idle") {
                setTrackingBox(null);
                setTrackingStatus("no-face");
                faceSeenSinceRef.current = null;
                autoDetectRef.current = requestAnimationFrame(trackLoop);
                return;
            }

            const video = videoRef.current;
            if (!video || video.readyState < 2) {
                autoDetectRef.current = requestAnimationFrame(trackLoop);
                return;
            }

            try {
                const result = await detectFaceQuick(video);
                if (cancelled) return;

                if (result && result.score >= 0.7) {
                    // Map box to percentage coordinates for overlay
                    const vw = video.videoWidth;
                    const vh = video.videoHeight;
                    setTrackingBox({
                        x: ((vw - result.box.x - result.box.width) / vw) * 100, // mirror
                        y: (result.box.y / vh) * 100,
                        w: (result.box.width / vw) * 100,
                        h: (result.box.height / vh) * 100,
                        score: result.score,
                    });

                    const now = Date.now();
                    if (!faceSeenSinceRef.current) {
                        faceSeenSinceRef.current = now;
                        setTrackingStatus("detecting");
                    }

                    const heldFor = now - faceSeenSinceRef.current;
                    if (heldFor > 400 && heldFor < FACE_HOLD_MS) {
                        setTrackingStatus("hold-steady");
                    }

                    // Auto-trigger scan when face held steady long enough
                    if (heldFor >= FACE_HOLD_MS && now > scanCooldownRef.current) {
                        setTrackingStatus("scanning");
                        faceSeenSinceRef.current = null;
                        scanCooldownRef.current = now + SCAN_COOLDOWN_MS;
                        handleScanRef.current();
                        return; // stop loop, handleScan manages state
                    }
                } else {
                    setTrackingBox(null);
                    setTrackingStatus("no-face");
                    faceSeenSinceRef.current = null;
                }
            } catch {
                // ignore detection errors in tracking loop
            }

            if (!cancelled) {
                // Throttle to ~5fps for lightweight tracking
                await new Promise((r) => setTimeout(r, 200));
                autoDetectRef.current = requestAnimationFrame(trackLoop);
            }
        }

        autoDetectRef.current = requestAnimationFrame(trackLoop);
        return () => {
            cancelled = true;
            if (autoDetectRef.current) cancelAnimationFrame(autoDetectRef.current);
        };
    }, [scanState, feedback]);

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // ── Scan & Verify ──
    const handleScan = useCallback(async () => {
        if (!videoRef.current) return;
        setScanState("scanning");

        // Multi-frame: capture up to 7 frames, require 3+ good ones, then average
        const validDescriptors: { descriptor: number[]; score: number }[] = [];
        const MAX_ATTEMPTS = 10;
        const MIN_GOOD_FRAMES = 4;
        const MIN_DETECTION_SCORE = 0.75;
        const MAX_CONSISTENCY_DISTANCE = 0.35; // reject if frames are too inconsistent

        console.log("[kiosk-face] Starting multi-frame face capture...");

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const result = await detectFace(videoRef.current);
            if (result) {
                console.log(`[kiosk-face] Frame ${attempt + 1}: score=${result.score.toFixed(3)} ${result.score >= MIN_DETECTION_SCORE ? "✓" : "✗ (below threshold)"}`);
                if (result.score >= MIN_DETECTION_SCORE) {
                    validDescriptors.push({ descriptor: result.descriptor, score: result.score });
                }
            } else {
                console.log(`[kiosk-face] Frame ${attempt + 1}: no face detected`);
            }
            if (attempt < MAX_ATTEMPTS - 1) {
                await new Promise((r) => setTimeout(r, 300));
            }
            // Early exit once we have enough high-quality frames
            if (validDescriptors.length >= 7) break;
        }

        console.log(`[kiosk-face] Captured ${validDescriptors.length}/${MAX_ATTEMPTS} valid frames (need ${MIN_GOOD_FRAMES}+)`);

        if (validDescriptors.length < MIN_GOOD_FRAMES) {
            console.warn(`[kiosk-face] REJECTED: insufficient frames (${validDescriptors.length} < ${MIN_GOOD_FRAMES})`);
            toast.error(validDescriptors.length === 0
                ? "No face detected. Position your face clearly."
                : `Only ${validDescriptors.length} frame(s) captured. Hold steady with good lighting.`);
            setScanState("idle");
            return;
        }

        // Sort by detection confidence and take top frames
        validDescriptors.sort((a, b) => b.score - a.score);
        const topDescriptors = validDescriptors.slice(0, 5).map((d) => d.descriptor);

        // Consistency check: ensure frames are from the same face
        const consistency = descriptorConsistency(topDescriptors);
        console.log(`[kiosk-face] Frame consistency (avg pairwise distance): ${consistency.toFixed(4)} (max allowed: ${MAX_CONSISTENCY_DISTANCE})`);

        if (consistency > MAX_CONSISTENCY_DISTANCE) {
            console.warn(`[kiosk-face] REJECTED: frames inconsistent (${consistency.toFixed(4)} > ${MAX_CONSISTENCY_DISTANCE}) — possible movement or lighting change`);
            toast.error("Face detection unstable. Hold still and ensure consistent lighting.");
            setScanState("idle");
            return;
        }

        const averaged = averageDescriptors(topDescriptors);

        // Log embedding quality metrics
        const embNorm = Math.sqrt(averaged.reduce((s, v) => s + v * v, 0));
        const nonZeroDims = averaged.filter(v => Math.abs(v) > 1e-8).length;
        console.log(`[kiosk-face] Averaged embedding: norm=${embNorm.toFixed(4)} nonZeroDims=${nonZeroDims}/128 avgScore=${(validDescriptors.slice(0, 5).reduce((s, d) => s + d.score, 0) / Math.min(validDescriptors.length, 5)).toFixed(3)}`);

        // Capture probe image for AI face comparison
        let probeImage: string | undefined;
        if (videoRef.current?.videoWidth && videoRef.current?.videoHeight) {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = videoRef.current.videoWidth;
            tempCanvas.height = videoRef.current.videoHeight;
            const ctx = tempCanvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0);
                probeImage = tempCanvas.toDataURL("image/jpeg", 0.85);
            }
        }

        setScanState("verifying");

        try {
            console.log("[kiosk-face] Sending embedding to server for matching...");
            const matchRes = await fetch("/api/face-recognition/enroll?action=match", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(process.env.NEXT_PUBLIC_KIOSK_API_KEY
                        ? { "x-kiosk-api-key": process.env.NEXT_PUBLIC_KIOSK_API_KEY }
                        : {}),
                },
                body: JSON.stringify({ embedding: averaged, probeImage }),
            });
            const matchData = await matchRes.json();

            console.log(`[kiosk-face] Server response:`, {
                ok: matchData.ok,
                matched: matchData.matched,
                employeeId: matchData.employeeId,
                distance: matchData.distance?.toFixed(4),
                aiConfidence: matchData.aiConfidence,
                error: matchData.error,
            });

            if (matchData.ok && matchData.matched && matchData.employeeId) {
                const emp = employees.find((e) => e.id === matchData.employeeId);
                const name = emp?.name || matchData.employeeId;
                setMatchedName(name);
                setMatchDistance(matchData.distance);
                setScanState("verified");
                setTrackingStatus("matched");
                setTrackingBox(null);
                console.log(`[kiosk-face] ✅ MATCH: ${name} (distance=${matchData.distance?.toFixed(4)})`);
                toast.success(`Matched: ${name} (distance: ${matchData.distance?.toFixed(3)})`);

                // Auto-confirm after 3s countdown
                setAutoConfirmCountdown(3);
                let count = 3;
                const countdownInterval = setInterval(() => {
                    count--;
                    if (count <= 0) {
                        clearInterval(countdownInterval);
                        setAutoConfirmCountdown(null);
                        // Trigger confirm
                        handleConfirmRef.current?.();
                    } else {
                        setAutoConfirmCountdown(count);
                    }
                }, 1000);
                autoConfirmTimerRef.current = countdownInterval;
            } else {
                console.log(`[kiosk-face] ❌ NO MATCH: face not recognized`);
                toast.error("Face not recognized. Please try again or re-enroll.");
                setScanState("idle");
            }
        } catch (err) {
            console.error("[kiosk-face] Verification request failed:", err);
            toast.error("Verification service unavailable");
            setScanState("idle");
        }
    }, [employees]);
    handleScanRef.current = handleScan;

    // ── Check-in/out ──
    const checkWorkDay = useCallback((empId: string) => {
        if (!ks.warnOffDay) return;
        const emp = employees.find((e) => e.id === empId);
        if (emp?.workDays?.length) {
            const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
            if (!emp.workDays.includes(day)) {
                toast.warning(`${day} is outside your scheduled days.`, { duration: 4000 });
            }
        }
    }, [ks.warnOffDay, employees]);

    const handleConfirm = useCallback(() => {
        // Clear any auto-confirm countdown
        if (autoConfirmTimerRef.current) {
            clearInterval(autoConfirmTimerRef.current);
            autoConfirmTimerRef.current = null;
        }
        setAutoConfirmCountdown(null);

        const empId = employees.find((e) => e.name === matchedName)?.id || "UNKNOWN";
        const project = getProjectForEmployee(empId);

        // Reject employees whose project only allows QR
        if (project?.verificationMethod === "qr_only") {
            toast.error("This employee is assigned to QR-only verification. Please use the QR kiosk.");
            setScanState("idle");
            setMatchedName("");
            setMatchDistance(null);
            return;
        }

        if (mode === "in") checkWorkDay(empId);

        // Event ledger (append-only audit trail)
        appendEvent({
            employeeId: empId,
            eventType: mode === "in" ? "IN" : "OUT",
            timestampUTC: new Date().toISOString(),
            deviceId,
        });

        // Daily log (backward-compatible computed view)
        if (mode === "in") {
            checkIn(empId, project?.id);
        } else {
            checkOut(empId, project?.id);
        }
        // Add to kiosk daily activity log
        const timeNow = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
        const newEntry = { name: matchedName, type: mode, time: timeNow };
        setKioskLog((prev) => {
            const updated = [newEntry, ...prev];
            try { sessionStorage.setItem("kiosk-activity-log", JSON.stringify(updated)); } catch { /* full */ }
            return updated;
        });
        setFeedback(mode === "in" ? "success-in" : "success-out");
        setCheckedInName(matchedName);
        setTrackingStatus("no-face");
        setTimeout(() => {
            setFeedback("idle");
            setCheckedInName("");
            setMatchedName("");
            setMatchDistance(null);
            setScanState("idle");
        }, ks.feedbackDuration);
    }, [matchedName, mode, employees, getProjectForEmployee, ks, checkIn, checkOut, appendEvent, deviceId, checkWorkDay]);

    // Ref so auto-confirm timer can call the latest handleConfirm
    const handleConfirmRef = useRef(handleConfirm);
    handleConfirmRef.current = handleConfirm;

    // ── Time display ──
    const h = now.getHours();
    const timeStr = ks.clockFormat === "12h"
        ? `${h % 12 || 12}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
        : `${String(h).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
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
            {/* Ambient blob */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full blur-[130px] opacity-20 transition-colors duration-700"
                    style={{ backgroundColor: isSuccess ? (isSuccessIn ? "#10b981" : "#0ea5e9") : isError ? "#ef4444" : "#3b82f6" }} />
            </div>

            {/* Top bar */}
            <header className="relative z-10 w-full flex items-center justify-between px-4 sm:px-8 pt-4 sm:pt-6">
                <button onClick={() => router.push("/kiosk")} className={cn("flex items-center gap-2 transition-colors min-h-[44px]",
                    isAutoTheme && !isSuccess && !isError ? "text-muted-foreground hover:text-foreground" : "text-white/50 hover:text-white"
                )}>
                    <ArrowLeft className="h-4 w-4" /><span className="text-sm">Back</span>
                </button>
                <div className="text-center">
                    {ks.showClock && (
                        <p className={cn("font-mono text-2xl sm:text-4xl font-bold tracking-widest tabular-nums drop-shadow-lg", textClass)}>{timeStr}</p>
                    )}
                    {ks.showDate && <p className={cn("text-xs mt-1", textMutedClass)}>{dateStr}</p>}
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
                                <div className={cn("h-20 w-20 mx-auto rounded-full flex items-center justify-center",
                                    isSuccessIn ? "bg-emerald-500/20" : "bg-sky-500/20")}>
                                    <CheckCircle className={cn("h-10 w-10", isSuccessIn ? "text-emerald-400" : "text-sky-400")} />
                                </div>
                                <p className={cn("text-3xl font-bold", isSuccessIn ? "text-emerald-300" : "text-sky-300")}>
                                    {isSuccessIn ? "Checked In" : "Checked Out"}
                                </p>
                                {checkedInName && <p className="text-white text-4xl font-bold mt-2">{checkedInName}</p>}
                                <p className="text-white/30 text-sm">{now.toLocaleTimeString()}</p>
                            </>
                        ) : (
                            <>
                                <div className="h-20 w-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                                    <XCircle className="h-10 w-10 text-red-400" />
                                </div>
                                <p className="text-2xl font-bold text-red-300">Invalid - Try Again</p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Main content — two-column on desktop, stacked on mobile */}
            <main className="relative z-10 flex flex-col lg:flex-row items-start justify-center gap-4 sm:gap-6 px-4 sm:px-6 flex-1 w-full max-w-6xl mx-auto py-4">
                {/* LEFT: Face Scanner Column */}
                <div className="flex flex-col items-center gap-4 sm:gap-6 w-full lg:w-[420px] lg:flex-shrink-0">
                    {/* Mode toggle */}
                    <div className={cn("flex rounded-2xl overflow-hidden border backdrop-blur-sm", toggleBgClass)}>
                        <button
                            onClick={() => { setMode("in"); setScanState("idle"); setMatchedName(""); setTrackingStatus("no-face"); setTrackingBox(null); if (autoConfirmTimerRef.current) { clearInterval(autoConfirmTimerRef.current); autoConfirmTimerRef.current = null; } setAutoConfirmCountdown(null); }}
                            className={cn(
                                "px-6 sm:px-10 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 min-h-[44px]",
                                mode === "in" ? "bg-emerald-500/80 text-white shadow-lg shadow-emerald-900/30" : toggleInactiveClass
                            )}
                        >
                            <LogIn className="h-4 w-4" />Check In
                        </button>
                        {ks.allowCheckOut && (
                            <button
                                onClick={() => { setMode("out"); setScanState("idle"); setMatchedName(""); setTrackingStatus("no-face"); setTrackingBox(null); if (autoConfirmTimerRef.current) { clearInterval(autoConfirmTimerRef.current); autoConfirmTimerRef.current = null; } setAutoConfirmCountdown(null); }}
                                className={cn(
                                    "px-6 sm:px-10 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 min-h-[44px]",
                                    mode === "out" ? "bg-sky-500/80 text-white shadow-lg shadow-sky-900/30" : toggleInactiveClass
                                )}
                            >
                                <LogOut className="h-4 w-4" />Check Out
                            </button>
                        )}
                    </div>

                    {/* Enrollment Required */}
                    {enrollmentChecked && !isEnrolled ? (
                        <div className={cn("border border-amber-500/30 rounded-3xl p-4 sm:p-8 backdrop-blur-sm flex flex-col items-center gap-4 sm:gap-5 shadow-2xl w-full max-w-sm",
                            isAutoTheme ? "bg-card" : "bg-white/[0.04]"
                        )}>
                            <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <AlertTriangle className="h-8 w-8 text-amber-400" />
                            </div>
                            <p className={cn("text-lg font-bold text-center", textClass)}>Face Enrollment Required</p>
                            <p className={cn("text-sm text-center", textMutedClass)}>
                                You need to enroll your face before using face recognition check-in.
                            </p>
                            <button onClick={() => router.push("/kiosk/face/enroll")}
                                className="w-full py-3.5 rounded-xl bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-bold transition-all min-h-[44px]">
                                <ScanFace className="h-4 w-4 inline mr-2" />Enroll Face Now
                            </button>
                        </div>
                    ) : (
                        /* Face Recognition Panel */
                        <div className={cn("rounded-3xl p-4 sm:p-6 backdrop-blur-sm flex flex-col items-center gap-4 sm:gap-5 shadow-2xl w-full border", cardClass)}>
                            <div className="flex items-center gap-2">
                                <ScanFace className="h-4 w-4 text-emerald-400/60" />
                                <p className={cn("text-[11px] font-semibold uppercase tracking-widest", textMutedClass)}>Face Recognition</p>
                            </div>

                            {/* Camera feed */}
                            <div className="relative w-full aspect-[3/4] sm:aspect-[4/3] rounded-2xl overflow-hidden bg-black/50">
                                <video
                                    ref={videoRef}
                                    className="w-full h-full object-cover"
                                    style={{ transform: "scaleX(-1)" }}
                                    playsInline
                                    muted
                                    autoPlay
                                />
                                {/* Oval guide */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className={cn(
                                        "w-40 h-52 sm:w-48 sm:h-60 rounded-[50%] border-2 border-dashed transition-colors duration-300",
                                        scanState === "scanning" || scanState === "verifying" ? "border-amber-400 animate-pulse" :
                                        scanState === "verified" ? "border-emerald-400" :
                                        trackingStatus === "hold-steady" ? "border-blue-400 animate-pulse" :
                                        trackingStatus === "detecting" ? "border-white/40" : "border-white/20"
                                    )} />
                                </div>
                                {/* Live face tracking box */}
                                {trackingBox && scanState === "idle" && (
                                    <div
                                        className={cn(
                                            "absolute border-2 rounded-lg transition-all duration-150 pointer-events-none",
                                            trackingStatus === "hold-steady" ? "border-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.4)]" :
                                            trackingStatus === "matched" ? "border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]" :
                                            "border-white/40"
                                        )}
                                        style={{
                                            left: `${trackingBox.x}%`,
                                            top: `${trackingBox.y}%`,
                                            width: `${trackingBox.w}%`,
                                            height: `${trackingBox.h}%`,
                                        }}
                                    >
                                        <span className={cn(
                                            "absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono whitespace-nowrap px-1.5 py-0.5 rounded",
                                            trackingStatus === "hold-steady" ? "bg-blue-500/80 text-white" :
                                            "bg-black/50 text-white/70"
                                        )}>
                                            {trackingStatus === "hold-steady" ? "Hold steady..." :
                                             trackingStatus === "detecting" ? `Face detected (${(trackingBox.score * 100).toFixed(0)}%)` :
                                             ""}
                                        </span>
                                    </div>
                                )}
                                {/* Loading/scanning overlay */}
                                {(scanState === "loading" || scanState === "scanning" || scanState === "verifying") && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                                        <Loader2 className="h-8 w-8 text-white animate-spin" />
                                        <p className="text-white/70 text-xs mt-2">
                                            {scanState === "loading" ? "Loading models..." :
                                             scanState === "scanning" ? "Detecting face..." : "Verifying identity..."}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Verified result — prominent matched name */}
                            {scanState === "verified" && matchedName && (
                                <div className="w-full space-y-3">
                                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                            <CheckCircle className="h-5 w-5 text-emerald-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-emerald-300 font-bold text-base truncate">{matchedName}</p>
                                            <p className="text-emerald-400/60 text-[10px]">Identity verified</p>
                                        </div>
                                    </div>
                                    {matchDistance !== null && (
                                        <p className="text-white/20 text-[10px] text-center">
                                            Match distance: {matchDistance.toFixed(4)} (threshold: 0.38)
                                        </p>
                                    )}
                                    <button
                                        onClick={handleConfirm}
                                        className={cn(
                                            "w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.98] min-h-[44px]",
                                            mode === "in"
                                                ? "bg-emerald-500/80 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40"
                                                : "bg-sky-500/80 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/40"
                                        )}
                                    >
                                        {mode === "in" ? "Confirm Check In" : "Confirm Check Out"}
                                        {autoConfirmCountdown !== null && (
                                            <span className="ml-2 opacity-70">({autoConfirmCountdown}s)</span>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Scan button — now secondary since auto-scan is active */}
                            {scanState === "idle" && (
                                <button onClick={handleScan}
                                    className={cn(
                                        "w-full py-3.5 rounded-xl text-sm font-bold transition-all min-h-[44px]",
                                        trackingStatus === "hold-steady"
                                            ? "bg-blue-500/80 hover:bg-blue-500 text-white"
                                            : "bg-violet-500/80 hover:bg-violet-500 text-white"
                                    )}>
                                    {trackingStatus === "hold-steady" ? (
                                        <><Loader2 className="h-4 w-4 inline mr-2 animate-spin" />Recognizing...</>
                                    ) : trackingStatus === "detecting" ? (
                                        <><ScanFace className="h-4 w-4 inline mr-2" />Face Detected — Hold Steady</>
                                    ) : (
                                        <><Camera className="h-4 w-4 inline mr-2" />Scan Face</>
                                    )}
                                </button>
                            )}

                            {/* Failed state */}
                            {scanState === "failed" && (
                                <div className="text-center space-y-2">
                                    <p className="text-red-400 text-sm">Failed to initialize camera or models</p>
                                    <p className="text-white/30 text-xs">Make sure you&apos;re on HTTPS and camera permission is granted.</p>
                                    <button onClick={() => window.location.reload()}
                                        className="px-4 py-3 rounded-xl bg-white/10 text-white text-xs hover:bg-white/20 min-h-[44px]">
                                        <RotateCcw className="h-3 w-3 inline mr-1" />Retry
                                    </button>
                                </div>
                            )}

                            {scanState === "idle" && (
                                <p className={cn("text-[10px] text-center", textFaintClass)}>
                                    {trackingStatus === "no-face"
                                        ? "Step in front of the camera — auto-scan will detect your face"
                                        : "Hold steady for automatic recognition"}
                                </p>
                            )}

                            {/* Re-enroll link */}
                            <button onClick={() => router.push("/kiosk/face/enroll")}
                                className={cn("flex items-center gap-1.5 text-[10px] transition-colors",
                                    isAutoTheme ? "text-muted-foreground/40 hover:text-muted-foreground" : "text-white/25 hover:text-white/50"
                                )}>
                                <RotateCcw className="h-3 w-3" />Re-enroll Face
                            </button>
                        </div>
                    )}
                </div>

                {/* RIGHT: Daily Activity Log */}
                <div className={cn("w-full lg:flex-1 lg:max-w-sm rounded-3xl backdrop-blur-sm shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-160px)] border", cardClass)}>
                    <div className={cn("px-4 py-3 border-b flex items-center gap-2",
                        isAutoTheme ? "border-border" : "border-white/10"
                    )}>
                        <ClipboardList className="h-4 w-4 text-blue-400/70" />
                        <h2 className={cn("text-xs font-semibold uppercase tracking-widest",
                            isAutoTheme ? "text-muted-foreground" : "text-white/70"
                        )}>Today&apos;s Activity</h2>
                        <span className={cn("ml-auto text-[10px] tabular-nums", textFaintClass)}>{kioskLog.length} {kioskLog.length === 1 ? "entry" : "entries"}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                        {kioskLog.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2">
                                <ClipboardList className={cn("h-8 w-8", isAutoTheme ? "text-muted-foreground/20" : "text-white/10")} />
                                <p className={cn("text-xs", isAutoTheme ? "text-muted-foreground/40" : "text-white/20")}>No activity yet today</p>
                                <p className={cn("text-[10px]", isAutoTheme ? "text-muted-foreground/30" : "text-white/10")}>Scan a face to check in or out</p>
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
                    <span>{companyName || "NexHRMS"} • Face Recognition Kiosk</span>
                </div>
            </footer>
        </div>
    );
}
