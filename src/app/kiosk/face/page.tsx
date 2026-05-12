"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

// Neon theme colors
const NEON_GREEN = "#39FF14";
const NEON_GREEN_DIM = "rgba(57, 255, 20, 0.6)";

/**
 * Face Recognition Kiosk Page
 *
 * Uses face-api.js (client-side, WebGL) for real 128-d embedding computation.
 * Sends embedding to server for matching against enrolled employees.
 * Black and neon green SaaS branding.
 */

type ScanState = "loading" | "idle" | "scanning" | "verifying" | "verified" | "failed";

export default function FaceKioskPage() {
    const router = useRouter();
    const ks = useKioskStore((s) => s.settings);
    const { appendEvent, checkIn, checkOut, recordEvidence, logs: attendanceLogs } = useAttendanceStore();
    const employees = useEmployeesStore((s) => s.employees);
    const companyName = useAppearanceStore((s) => s.companyName);
    const logoUrl = useAppearanceStore((s) => s.logoUrl);
    const getProjectForEmployee = useProjectsStore((s) => s.getProjectForEmployee);

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
        const stored = localStorage.getItem("soren-kiosk-face-device-id");
        if (stored) return stored;
        const id = `KIOSK-FACE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        localStorage.setItem("soren-kiosk-face-device-id", id);
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
    const [guidanceHint, setGuidanceHint] = useState<string>("Position your face in the oval");

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

    // Derive today's activity from persisted attendance logs (survives refresh)
    // Merge with session kiosk log so new entries appear immediately
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
        // Merge session entries not already covered by store (for the same session before store syncs)
        const storeKeys = new Set(storeEntries.map((e) => `${e.name}|${e.type}|${e.time}`));
        for (const entry of kioskLog) {
            const key = `${entry.name}|${entry.type}|${entry.time}`;
            if (!storeKeys.has(key)) storeEntries.push(entry);
        }
        // Sort by time descending (most recent first)
        storeEntries.sort((a, b) => b.time.localeCompare(a.time));
        return storeEntries;
    }, [attendanceLogs, employees, kioskLog]);

    // PIN verification — redirect if not verified; also guard against browser back
    useEffect(() => {
        const verified = sessionStorage.getItem("kiosk-pin-verified");
        const verifiedTime = sessionStorage.getItem("kiosk-pin-verified-time");
        if (!verified || !verifiedTime) { router.replace("/kiosk?target=face"); return; }
        const elapsed = Date.now() - parseInt(verifiedTime);
        if (elapsed > 5 * 60 * 1000) {
            sessionStorage.removeItem("kiosk-pin-verified");
            sessionStorage.removeItem("kiosk-pin-verified-time");
            router.replace("/kiosk?target=face");
            return;
        }
        // Push a guard history entry so browser back hits this page again
        // instead of leaving to the PIN page. On popstate, clear PIN and redirect.
        window.history.pushState({ kioskGuard: true }, "");
        const handlePopState = () => {
            sessionStorage.removeItem("kiosk-pin-verified");
            sessionStorage.removeItem("kiosk-pin-verified-time");
            router.replace("/kiosk");
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
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
        const FACE_HOLD_MS = 1500; // hold face steady for 1.5s before triggering scan
        const SCAN_COOLDOWN_MS = 5000; // cooldown between auto-scans

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
                    const faceRatio = result.box.width / vw;

                    setTrackingBox({
                        x: ((vw - result.box.x - result.box.width) / vw) * 100, // mirror
                        y: (result.box.y / vh) * 100,
                        w: (result.box.width / vw) * 100,
                        h: (result.box.height / vh) * 100,
                        score: result.score,
                    });

                    // Check face positioning before allowing auto-scan
                    const isFaceTooSmall = faceRatio < 0.15;
                    const isFaceTooLarge = faceRatio > 0.55;
                    const isFaceFrontFacing = Math.abs(result.yaw) < 0.25; // must look straight
                    const isFaceWellPositioned = !isFaceTooSmall && !isFaceTooLarge && isFaceFrontFacing && result.score >= 0.75;

                    if (isFaceTooSmall) {
                        setTrackingStatus("detecting");
                        setGuidanceHint("Move closer to the camera");
                        faceSeenSinceRef.current = null;
                    } else if (isFaceTooLarge) {
                        setTrackingStatus("detecting");
                        setGuidanceHint("Move back a little");
                        faceSeenSinceRef.current = null;
                    } else if (!isFaceFrontFacing) {
                        setTrackingStatus("detecting");
                        setGuidanceHint("Look straight at the camera");
                        faceSeenSinceRef.current = null;
                    } else if (result.score < 0.75) {
                        setTrackingStatus("detecting");
                        setGuidanceHint("Improve lighting for better detection");
                        faceSeenSinceRef.current = null;
                    } else {
                        setGuidanceHint("Hold steady — recognizing...");
                        const now = Date.now();
                        if (!faceSeenSinceRef.current) {
                            faceSeenSinceRef.current = now;
                            setTrackingStatus("detecting");
                        }

                        const heldFor = now - faceSeenSinceRef.current;
                        if (isFaceWellPositioned && heldFor > 400 && heldFor < FACE_HOLD_MS) {
                            setTrackingStatus("hold-steady");
                        }

                        // Auto-trigger scan when face held steady long enough AND well-positioned
                        if (isFaceWellPositioned && heldFor >= FACE_HOLD_MS && now > scanCooldownRef.current) {
                            setTrackingStatus("scanning");
                            faceSeenSinceRef.current = null;
                            scanCooldownRef.current = now + SCAN_COOLDOWN_MS;
                            handleScanRef.current();
                            return; // stop loop, handleScan manages state
                        }
                    }
                } else {
                    setTrackingBox(null);
                    setTrackingStatus("no-face");
                    setGuidanceHint("Position your face in the oval");
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
                setGuidanceHint("");
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
                const serverError = matchData.error;
                const errorMsg = serverError
                    ? `Recognition failed: ${serverError}`
                    : "Face not recognized. Please ensure you have enrolled your face and try again.";
                console.log(`[kiosk-face] ❌ NO MATCH: ${serverError || "face not recognized"}`);
                toast.error(errorMsg);
                setGuidanceHint("Try again — look straight at the camera");
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

        // ── Duplicate check-in / check-out guard ──
        const today = new Date().toISOString().split("T")[0];
        const todayLog = attendanceLogs.find((l) => l.employeeId === empId && l.date === today);
        if (mode === "in" && todayLog?.checkIn) {
            toast.error(`${matchedName} has already checked in today at ${todayLog.checkIn}.`, { duration: 4000 });
            setScanState("idle");
            setMatchedName("");
            setMatchDistance(null);
            setTrackingStatus("no-face");
            return;
        }
        if (mode === "out" && todayLog?.checkOut) {
            toast.error(`${matchedName} has already checked out today at ${todayLog.checkOut}.`, { duration: 4000 });
            setScanState("idle");
            setMatchedName("");
            setMatchDistance(null);
            setTrackingStatus("no-face");
            return;
        }
        if (mode === "out" && !todayLog?.checkIn) {
            toast.error(`${matchedName} hasn't checked in yet today.`, { duration: 4000 });
            setScanState("idle");
            setMatchedName("");
            setMatchDistance(null);
            setTrackingStatus("no-face");
            return;
        }

        if (mode === "in") checkWorkDay(empId);

        // Event ledger (append-only audit trail)
        const eventId = appendEvent({
            employeeId: empId,
            eventType: mode === "in" ? "IN" : "OUT",
            timestampUTC: new Date().toISOString(),
            deviceId,
        });

        // Record face verification evidence for audit trail
        recordEvidence({
            eventId,
            gpsLat: undefined,
            gpsLng: undefined,
            gpsAccuracyMeters: undefined,
            geofencePass: undefined, // Not currently checking geofence in face kiosk
            qrTokenId: undefined, // Not applicable for face verification
            deviceIntegrityResult: undefined,
            faceVerified: true, // Face was verified before confirm was enabled
            mockLocationDetected: false,
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
    }, [matchedName, mode, employees, getProjectForEmployee, ks, checkIn, checkOut, appendEvent, recordEvidence, deviceId, checkWorkDay, attendanceLogs]);

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
                    <ArrowLeft className="h-4 w-4" /><span>Back</span>
                </button>
                <div className="text-center">
                    {ks.showClock && (
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
                    {ks.showDate && (
                        <p className="text-white/40 mt-1" style={{ fontSize: "clamp(0.65rem, 1vw, 0.75rem)" }}>{dateStr}</p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {ks.showLogo && logoUrl ? (
                        <img 
                            src={logoUrl} 
                            alt={companyName}
                            className="object-contain brightness-0 invert opacity-90"
                            style={{ height: "clamp(1.5rem, 3vh, 2rem)", maxWidth: "clamp(80px, 10vw, 120px)" }}
                        />
                    ) : (
                        <span className="font-semibold text-white/40" style={{ fontSize: "clamp(0.75rem, 1.2vw, 0.875rem)" }}>
                            {companyName || "Soren Data Solutions Inc."}
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
                                    {now.toLocaleTimeString()}
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
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Main content — two-column on desktop, stacked on mobile */}
            <main 
                className="relative z-10 flex flex-col lg:flex-row items-start justify-center flex-1 w-full mx-auto"
                style={{ 
                    gap: "clamp(1rem, 3vw, 2rem)",
                    padding: "clamp(1rem, 2vh, 1.5rem) clamp(1rem, 3vw, 2rem)",
                    maxWidth: "min(1400px, 95vw)",
                }}
            >
                {/* LEFT: Face Scanner Column */}
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
                            onClick={() => { setMode("in"); setScanState("idle"); setMatchedName(""); setTrackingStatus("no-face"); setTrackingBox(null); if (autoConfirmTimerRef.current) { clearInterval(autoConfirmTimerRef.current); autoConfirmTimerRef.current = null; } setAutoConfirmCountdown(null); }}
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
                            <LogIn className="h-4 w-4" />Check In
                        </button>
                        {ks.allowCheckOut && (
                            <button
                                onClick={() => { setMode("out"); setScanState("idle"); setMatchedName(""); setTrackingStatus("no-face"); setTrackingBox(null); if (autoConfirmTimerRef.current) { clearInterval(autoConfirmTimerRef.current); autoConfirmTimerRef.current = null; } setAutoConfirmCountdown(null); }}
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
                                <LogOut className="h-4 w-4" />Check Out
                            </button>
                        )}
                    </div>

                    {/* Enrollment Required */}
                    {enrollmentChecked && !isEnrolled ? (
                        <div 
                            className="border border-amber-500/30 rounded-3xl backdrop-blur-xl flex flex-col items-center shadow-2xl w-full"
                            style={{
                                padding: "clamp(1rem, 3vh, 2rem)",
                                gap: "clamp(1rem, 2vh, 1.5rem)",
                                maxWidth: "min(400px, 90vw)",
                                background: "rgba(255, 255, 255, 0.04)",
                            }}
                        >
                            <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <AlertTriangle className="h-8 w-8 text-amber-400" />
                            </div>
                            <p className="text-lg font-bold text-center text-white">Face Enrollment Required</p>
                            <p className="text-sm text-center text-white/40">
                                You need to enroll your face before using face recognition check-in.
                            </p>
                            <button 
                                onClick={() => router.replace("/kiosk/face/enroll")}
                                className="w-full rounded-xl text-black font-bold transition-all min-h-[44px] hover:opacity-90"
                                style={{
                                    padding: "clamp(0.75rem, 1.5vh, 1rem)",
                                    fontSize: "clamp(0.75rem, 1.2vw, 0.875rem)",
                                    background: NEON_GREEN,
                                    boxShadow: `0 0 30px ${NEON_GREEN}40`,
                                }}
                            >
                                <ScanFace className="h-4 w-4 inline mr-2" />Enroll Face Now
                            </button>
                        </div>
                    ) : (
                        /* Face Recognition Panel */
                        <div 
                            className="rounded-3xl backdrop-blur-xl flex flex-col items-center shadow-2xl w-full"
                            style={{
                                padding: "clamp(1rem, 3vh, 1.5rem)",
                                gap: "clamp(1rem, 2vh, 1.5rem)",
                                background: "rgba(255, 255, 255, 0.03)",
                                border: `1px solid ${NEON_GREEN}15`,
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <ScanFace style={{ color: NEON_GREEN, opacity: 0.6 }} className="h-4 w-4" />
                                <p 
                                    className="font-semibold uppercase tracking-widest text-white/40"
                                    style={{ fontSize: "clamp(0.6rem, 1vw, 0.7rem)" }}
                                >
                                    Face Recognition
                                </p>
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
                                             scanState === "scanning" ? "Capturing face..." : "Recognizing..."}
                                        </p>
                                    </div>
                                )}
                                {/* Smart guidance hint overlay */}
                                {scanState === "idle" && guidanceHint && (
                                    <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
                                        <div className={cn(
                                            "backdrop-blur-sm rounded-full px-3 py-1.5 max-w-[90%]",
                                            trackingStatus === "hold-steady" ? "bg-blue-900/70" :
                                            trackingStatus === "detecting" ? "bg-amber-900/70" :
                                            "bg-black/60"
                                        )}>
                                            <span className={cn(
                                                "text-[11px] font-medium",
                                                trackingStatus === "hold-steady" ? "text-blue-300" :
                                                trackingStatus === "detecting" ? "text-amber-300" :
                                                "text-white/70"
                                            )}>{guidanceHint}</span>
                                        </div>
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
                                            Match distance: {matchDistance.toFixed(4)} (threshold: 0.42)
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
                                <p 
                                    className="text-center text-white/30"
                                    style={{ fontSize: "clamp(0.55rem, 0.9vw, 0.65rem)" }}
                                >
                                    {trackingStatus === "no-face"
                                        ? "Step in front of the camera — auto-scan will detect your face"
                                        : "Hold steady for automatic recognition"}
                                </p>
                            )}

                            {/* Re-enroll link */}
                            <button 
                                onClick={() => router.replace("/kiosk/face/enroll")}
                                className="flex items-center gap-1.5 text-white/25 hover:text-white/50 transition-colors"
                                style={{ fontSize: "clamp(0.55rem, 0.9vw, 0.65rem)" }}
                            >
                                <RotateCcw className="h-3 w-3" />Re-enroll Face
                            </button>
                        </div>
                    )}
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
                                <p className="text-white/10" style={{ fontSize: "clamp(0.55rem, 0.9vw, 0.65rem)" }}>Scan a face to check in or out</p>
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
                    <span>{companyName || "Soren Data Solutions Inc."} • Face Recognition Kiosk</span>
                </div>
            </footer>
        </div>
    );
}
