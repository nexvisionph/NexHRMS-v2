"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAttendanceStore } from "@/store/attendance.store";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useKioskStore } from "@/store/kiosk.store";
import { useProjectsStore } from "@/store/projects.store";
import { loadFaceModels, detectFace, averageDescriptors } from "@/lib/face-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    ArrowLeft, ScanFace, LogIn, LogOut, CheckCircle, XCircle,
    Loader2, RotateCcw, AlertTriangle, Camera,
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
    const currentUser = useAuthStore((s) => s.currentUser);
    const { checkIn, checkOut } = useAttendanceStore();
    const employees = useEmployeesStore((s) => s.employees);
    const companyName = useAppearanceStore((s) => s.companyName);
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

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // PIN verification
    useEffect(() => {
        const verified = sessionStorage.getItem("kiosk-pin-verified");
        const verifiedTime = sessionStorage.getItem("kiosk-pin-verified-time");
        if (!verified || !verifiedTime) { router.push("/kiosk"); return; }
        const elapsed = Date.now() - parseInt(verifiedTime);
        if (elapsed > 5 * 60 * 1000) {
            sessionStorage.removeItem("kiosk-pin-verified");
            sessionStorage.removeItem("kiosk-pin-verified-time");
            router.push("/kiosk");
        }
    }, [router]);

    // Load face-api.js models + start camera
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await loadFaceModels();
                if (cancelled) return;
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
                });
                if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();
                }
                setScanState("idle");
            } catch (err) {
                console.error("Face kiosk init error:", err);
                setScanState("failed");
            }
        })();
        return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
    }, []);

    // Check enrollment
    useEffect(() => {
        const employeeId = currentUser.id || "EMP001";
        const project = getProjectForEmployee(employeeId);
        const method = project?.verificationMethod || "face_or_qr";
        if (method === "qr_only" || method === "manual_only") {
            // No face enrollment needed for these methods
            queueMicrotask(() => { setIsEnrolled(true); setEnrollmentChecked(true); });
            return;
        }
        fetch(`/api/face-recognition/enroll?action=status&employeeId=${encodeURIComponent(employeeId)}`)
            .then((r) => r.json())
            .then((data) => { setIsEnrolled(!!data.enrolled); setEnrollmentChecked(true); })
            .catch(() => { setIsEnrolled(true); setEnrollmentChecked(true); });
    }, [currentUser.id, getProjectForEmployee]);

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
        const MAX_ATTEMPTS = 7;
        const MIN_GOOD_FRAMES = 3;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const result = await detectFace(videoRef.current);
            if (result && result.score >= 0.7) {
                validDescriptors.push({ descriptor: result.descriptor, score: result.score });
            }
            if (attempt < MAX_ATTEMPTS - 1) {
                await new Promise((r) => setTimeout(r, 300));
            }
        }

        if (validDescriptors.length < MIN_GOOD_FRAMES) {
            toast.error(validDescriptors.length === 0
                ? "No face detected. Position your face clearly."
                : "Face detection unstable. Try better lighting.");
            setScanState("idle");
            return;
        }

        validDescriptors.sort((a, b) => b.score - a.score);
        const averaged = averageDescriptors(validDescriptors.slice(0, 5).map((d) => d.descriptor));

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
            // Try matching against all enrolled faces first
            const matchRes = await fetch("/api/face-recognition/enroll?action=match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ embedding: averaged, probeImage }),
            });
            const matchData = await matchRes.json();

            if (matchData.ok && matchData.matched && matchData.employeeId) {
                const emp = employees.find((e) => e.id === matchData.employeeId);
                setMatchedName(emp?.name || matchData.employeeId);
                setMatchDistance(matchData.distance);
                setScanState("verified");
                toast.success(`Matched: ${emp?.name || matchData.employeeId} (distance: ${matchData.distance?.toFixed(3)})`);
            } else {
                // Fallback: verify against current user specifically
                const verifyRes = await fetch("/api/face-recognition/enroll?action=verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        employeeId: currentUser.id || "EMP001",
                        embedding: averaged,
                        probeImage,
                    }),
                });
                const verifyData = await verifyRes.json();

                if (verifyData.ok && verifyData.verified) {
                    setMatchedName(currentUser.name || "User");
                    setMatchDistance(verifyData.distance);
                    setScanState("verified");
                    toast.success(`Verified: ${currentUser.name} (distance: ${verifyData.distance?.toFixed(3)})`);
                } else {
                    toast.error("Face not recognized. Please try again or re-enroll.");
                    setScanState("idle");
                }
            }
        } catch {
            toast.error("Verification service unavailable");
            setScanState("idle");
        }
    }, [employees, currentUser.id, currentUser.name]);

    // ── Check-in/out ──
    const checkWorkDay = (empId: string) => {
        if (!ks.warnOffDay) return;
        const emp = employees.find((e) => e.id === empId);
        if (emp?.workDays?.length) {
            const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
            if (!emp.workDays.includes(day)) {
                toast.warning(`${day} is outside your scheduled days.`, { duration: 4000 });
            }
        }
    };

    const handleConfirm = () => {
        const empId = employees.find((e) => e.name === matchedName)?.id || currentUser.id || "EMP001";
        const project = getProjectForEmployee(empId);
        if (mode === "in") checkWorkDay(empId);
        if (mode === "in") {
            checkIn(empId, project?.id);
        } else {
            checkOut(empId, project?.id);
        }
        setFeedback(mode === "in" ? "success-in" : "success-out");
        setCheckedInName(matchedName);
        setTimeout(() => {
            setFeedback("idle");
            setCheckedInName("");
            setMatchedName("");
            setMatchDistance(null);
            setScanState("idle");
        }, ks.feedbackDuration);
    };

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
        <div className={cn(
            "fixed inset-0 flex flex-col transition-colors duration-700 select-none",
            isSuccess ? (isSuccessIn ? "bg-emerald-950" : "bg-sky-950") : isError ? "bg-red-950" :
            ks.kioskTheme === "midnight" ? "bg-slate-950" :
            ks.kioskTheme === "charcoal" ? "bg-neutral-950" : "bg-zinc-950"
        )}>
            {/* Ambient blob */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full blur-[130px] opacity-20 transition-colors duration-700"
                    style={{ backgroundColor: isSuccess ? (isSuccessIn ? "#10b981" : "#0ea5e9") : isError ? "#ef4444" : "#3b82f6" }} />
            </div>

            {/* Top bar */}
            <header className="relative z-10 w-full flex items-center justify-between px-8 pt-6">
                <button onClick={() => router.push("/kiosk/select")} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /><span className="text-sm">Back</span>
                </button>
                <div className="text-center">
                    {ks.showClock && (
                        <p className="text-white font-mono text-4xl font-bold tracking-widest tabular-nums drop-shadow-lg">{timeStr}</p>
                    )}
                    {ks.showDate && <p className="text-white/40 text-xs mt-1">{dateStr}</p>}
                </div>
                <div className="w-20" />
            </header>

            {/* Main content */}
            <main className="relative z-10 flex flex-col items-center justify-center gap-6 px-6 flex-1 w-full max-w-lg mx-auto">
                {/* Mode toggle */}
                <div className="flex rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] backdrop-blur-sm">
                    <button
                        onClick={() => { setMode("in"); setScanState("idle"); setMatchedName(""); }}
                        className={cn(
                            "px-10 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200",
                            mode === "in" ? "bg-emerald-500/80 text-white shadow-lg shadow-emerald-900/30" : "text-white/30 hover:text-white/60"
                        )}
                    >
                        <LogIn className="h-4 w-4" />Check In
                    </button>
                    {ks.allowCheckOut && (
                        <button
                            onClick={() => { setMode("out"); setScanState("idle"); setMatchedName(""); }}
                            className={cn(
                                "px-10 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200",
                                mode === "out" ? "bg-sky-500/80 text-white shadow-lg shadow-sky-900/30" : "text-white/30 hover:text-white/60"
                            )}
                        >
                            <LogOut className="h-4 w-4" />Check Out
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
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Enrollment Required */}
                {enrollmentChecked && !isEnrolled ? (
                    <div className="bg-white/[0.04] border border-amber-500/30 rounded-3xl p-8 backdrop-blur-sm flex flex-col items-center gap-5 shadow-2xl w-full max-w-sm">
                        <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <AlertTriangle className="h-8 w-8 text-amber-400" />
                        </div>
                        <p className="text-white text-lg font-bold text-center">Face Enrollment Required</p>
                        <p className="text-white/40 text-sm text-center">
                            You need to enroll your face before using face recognition check-in.
                        </p>
                        <button onClick={() => router.push("/kiosk/face/enroll")}
                            className="w-full py-3.5 rounded-xl bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-bold transition-all">
                            <ScanFace className="h-4 w-4 inline mr-2" />Enroll Face Now
                        </button>
                    </div>
                ) : (
                    /* Face Recognition Panel */
                    <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-6 backdrop-blur-sm flex flex-col items-center gap-5 shadow-2xl w-full">
                        <div className="flex items-center gap-2">
                            <ScanFace className="h-4 w-4 text-emerald-400/60" />
                            <p className="text-white/40 text-[11px] font-semibold uppercase tracking-widest">Face Recognition</p>
                        </div>

                        {/* Camera feed */}
                        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black/50">
                            <video
                                ref={videoRef}
                                className="w-full h-full object-cover"
                                style={{ transform: "scaleX(-1)" }}
                                playsInline
                                muted
                            />
                            {/* Oval guide */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className={cn(
                                    "w-48 h-60 rounded-[50%] border-2 border-dashed transition-colors",
                                    scanState === "scanning" || scanState === "verifying" ? "border-amber-400 animate-pulse" :
                                    scanState === "verified" ? "border-emerald-400" : "border-white/20"
                                )} />
                            </div>
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

                        {/* Verified result */}
                        {scanState === "verified" && matchedName && (
                            <div className="w-full space-y-3">
                                <div className="flex items-center justify-center gap-2 text-emerald-400/80">
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="text-sm font-medium">{matchedName}</span>
                                </div>
                                {matchDistance !== null && (
                                    <p className="text-white/20 text-[10px] text-center">
                                        Match distance: {matchDistance.toFixed(4)} (threshold: 0.6)
                                    </p>
                                )}
                                <button
                                    onClick={handleConfirm}
                                    className={cn(
                                        "w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.98]",
                                        mode === "in"
                                            ? "bg-emerald-500/80 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40"
                                            : "bg-sky-500/80 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/40"
                                    )}
                                >
                                    {mode === "in" ? "Confirm Check In" : "Confirm Check Out"}
                                </button>
                            </div>
                        )}

                        {/* Scan button */}
                        {scanState === "idle" && (
                            <button onClick={handleScan}
                                className="w-full py-3.5 rounded-xl bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-bold transition-all">
                                <Camera className="h-4 w-4 inline mr-2" />Scan Face
                            </button>
                        )}

                        {/* Failed state */}
                        {scanState === "failed" && (
                            <div className="text-center space-y-2">
                                <p className="text-red-400 text-sm">Failed to initialize camera or models</p>
                                <button onClick={() => window.location.reload()}
                                    className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs hover:bg-white/20">
                                    <RotateCcw className="h-3 w-3 inline mr-1" />Retry
                                </button>
                            </div>
                        )}

                        {scanState === "idle" && (
                            <p className="text-white/25 text-[10px] text-center">
                                Position your face in the oval and click Scan
                            </p>
                        )}

                        {/* Re-enroll link */}
                        <button onClick={() => router.push("/kiosk/face/enroll")}
                            className="flex items-center gap-1.5 text-white/25 hover:text-white/50 text-[10px] transition-colors">
                            <RotateCcw className="h-3 w-3" />Re-enroll Face
                        </button>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="relative z-10 w-full flex items-center justify-center pb-6">
                <div className="flex items-center gap-2 text-white/20 text-xs">
                    <span>{companyName || "NexHRMS"} • Face Recognition Kiosk (face-api.js)</span>
                </div>
            </footer>
        </div>
    );
}
