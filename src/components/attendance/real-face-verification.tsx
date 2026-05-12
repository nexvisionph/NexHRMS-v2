"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    ScanFace, CheckCircle, ShieldAlert, Loader2, Camera,
    Sun, AlertTriangle, Eye,
} from "lucide-react";
import { loadFaceModels, detectFace, detectFaceQuick, averageDescriptors, descriptorConsistency } from "@/lib/face-api";
import type { FaceTrackingResult } from "@/lib/face-api";
import { useAuthStore } from "@/store/auth.store";

/**
 * Real Face Verification component using face-api.js 128-d embeddings.
 *
 * Mobile-first design:
 * - Waits for video stream to be ready before enabling detection
 * - Uses responsive camera sizing (portrait-friendly)
 * - Touch-optimized buttons (min 44px targets)
 * - Wake Lock API to prevent screen dimming
 * - Graceful camera permission handling with mobile-specific guidance
 * - Fallback if employee has no enrollment (graceful degradation)
 */

interface RealFaceVerificationProps {
    onVerified: () => void;
    disabled?: boolean;
    autoStart?: boolean;
    employeeId?: string;
    employeeName?: string;
    /** When true, face verification cannot be skipped (face_only projects) */
    required?: boolean;
}

type Phase = "loading" | "idle" | "camera" | "waiting-stream" | "scanning" | "verifying" | "verified" | "failed" | "no-enrollment";

/** Detect if running on a mobile/tablet device */
function isMobileDevice(): boolean {
    if (typeof window === "undefined") return false;
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

/** Request Wake Lock to prevent screen from dimming during camera usage */
async function requestWakeLock(): Promise<WakeLockSentinel | null> {
    try {
        if ("wakeLock" in navigator) {
            return await navigator.wakeLock.request("screen");
        }
    } catch { /* Wake Lock not supported or denied — non-critical */ }
    return null;
}

export function RealFaceVerification({
    onVerified,
    disabled,
    autoStart = false,
    employeeId,
    required: _required = false,
}: RealFaceVerificationProps) {
    const currentUserId = useAuthStore((s) => s.currentUser?.id);
    const [phase, setPhase] = useState<Phase>("loading");
    const [error, setError] = useState("");
    const [errorHint, setErrorHint] = useState("");
    const [videoReady, setVideoReady] = useState(false);
    const [isMobile] = useState(() => isMobileDevice());
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    // ── Live face tracking state ──
    const [tracking, setTracking] = useState<FaceTrackingResult | null>(null);
    const [guidanceMsg, setGuidanceMsg] = useState("");
    const [guidanceColor, setGuidanceColor] = useState<"red" | "amber" | "green">("red");
    const [scanProgress, setScanProgress] = useState(0);
    const trackingRef = useRef(true);
    const stableCountRef = useRef(0);
    const autoScanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clean up camera + wake lock
    const cleanup = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        wakeLockRef.current?.release().catch(() => {});
        wakeLockRef.current = null;
    }, []);

    // Load face-api models on mount
    useEffect(() => {
        let cancelled = false;
        console.log(`[face-verify] Initializing: employeeId=${employeeId ?? "none"} autoStart=${autoStart} disabled=${disabled}`);
        loadFaceModels()
            .then(() => {
                if (cancelled) return;
                if (autoStart && !disabled) {
                    // Small delay so the dialog/card animation finishes before camera starts
                    setTimeout(() => {
                        if (!cancelled) startCamera();
                    }, 300);
                } else {
                    setPhase("idle");
                }
            })
            .catch(() => {
                if (cancelled) return;
                setError("Failed to load face recognition models.");
                setErrorHint(isMobile
                    ? "Check your internet connection and try refreshing the page."
                    : "Please refresh the page to retry.");
                setPhase("failed");
            });
        return () => { cancelled = true; cleanup(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startCamera = useCallback(async () => {
        setVideoReady(false);
        setPhase("waiting-stream");

        try {
            // Request wake lock to prevent screen dimming
            wakeLockRef.current = await requestWakeLock();

            // Mobile-adaptive camera constraints — try user-facing first, fallback to any
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "user",
                        width: { ideal: isMobile ? 480 : 640 },
                        height: { ideal: isMobile ? 640 : 480 },
                    },
                    audio: false,
                });
            } catch {
                // Fallback: some mobile browsers reject specific constraints
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                });
            }
            streamRef.current = stream;

            // Wait for React to render the video element if ref isn't available yet
            const attachStream = () => {
                const video = videoRef.current;
                if (!video) return false;
                video.srcObject = stream;
                const onReady = () => {
                    video.play().then(() => {
                        setVideoReady(true);
                        setPhase("camera");
                    }).catch(() => {
                        // Autoplay blocked — still transition so user can tap to play
                        setVideoReady(true);
                        setPhase("camera");
                    });
                };
                if (video.readyState >= 2) {
                    onReady();
                } else {
                    video.onloadedmetadata = onReady;
                }
                return true;
            };

            // Try immediately, retry a few times if video ref isn't mounted yet
            if (!attachStream()) {
                let retries = 0;
                const retryInterval = setInterval(() => {
                    retries++;
                    if (attachStream() || retries >= 20) {
                        clearInterval(retryInterval);
                        if (retries >= 20 && !videoRef.current) {
                            console.error("[face-verify] Video element never mounted");
                            setError("Camera initialization failed.");
                            setErrorHint("Please refresh the page and try again.");
                            setPhase("failed");
                        }
                    }
                }, 100);
            }
        } catch (err) {
            const permErr = err instanceof DOMException;
            if (permErr && (err as DOMException).name === "NotAllowedError") {
                setError("Camera access denied.");
                setErrorHint(isMobile
                    ? "Open your browser settings → Site Settings → Camera, and allow access for this site."
                    : "Click the camera icon in the address bar to grant permission.");
            } else if (permErr && (err as DOMException).name === "NotFoundError") {
                setError("No camera found on this device.");
                setErrorHint("Ensure your device has a front-facing camera.");
            } else {
                setError("Could not access camera.");
                setErrorHint(isMobile
                    ? "Close other apps using the camera and try again."
                    : "Check that no other application is using the camera.");
            }
            setPhase("failed");
        }
    }, [isMobile]);

    // ── Live face tracking loop ──
    useEffect(() => {
        if (phase !== "camera" || !videoReady || !videoRef.current) {
            trackingRef.current = false;
            return;
        }

        trackingRef.current = true;
        let rafId: number;
        let lastTrackTime = 0;
        let trackFrameCount = 0;
        const TRACK_INTERVAL = 250;
        console.log(`[face-verify] Tracking loop STARTED (phase=${phase}, videoReady=${videoReady})`);

        const trackLoop = async (timestamp: number) => {
            if (!trackingRef.current || !videoRef.current) return;

            if (timestamp - lastTrackTime >= TRACK_INTERVAL) {
                lastTrackTime = timestamp;

                try {
                    const result = await detectFaceQuick(videoRef.current);
                    if (!trackingRef.current) return;

                    setTracking(result);
                    trackFrameCount++;

                    // Log every 4th frame to avoid console spam
                    if (trackFrameCount % 4 === 1) {
                        console.log(`[face-verify] Track #${trackFrameCount}: ${result ? `score=${result.score.toFixed(2)} yaw=${result.yaw.toFixed(2)} faces=${result.faceCount} ratio=${(result.box.width / (videoRef.current?.videoWidth || 640)).toFixed(2)}` : "no face"} stable=${stableCountRef.current} guidance=${guidanceColor}`);
                    }

                    if (!result) {
                        setGuidanceMsg("No face detected — look at the camera");
                        setGuidanceColor("red");
                        stableCountRef.current = 0;
                    } else if (result.faceCount > 1) {
                        setGuidanceMsg("Multiple faces detected — only one person please");
                        setGuidanceColor("red");
                        stableCountRef.current = 0;
                    } else if (result.score < 0.55) {
                        setGuidanceMsg("Face unclear — improve lighting");
                        setGuidanceColor("amber");
                        stableCountRef.current = 0;
                    } else {
                        const videoW = videoRef.current?.videoWidth || 640;
                        const faceRatio = result.box.width / videoW;

                        if (faceRatio < 0.15) {
                            setGuidanceMsg("Move closer to the camera");
                            setGuidanceColor("amber");
                            stableCountRef.current = 0;
                        } else if (faceRatio > 0.55) {
                            setGuidanceMsg("Move back a little");
                            setGuidanceColor("amber");
                            stableCountRef.current = 0;
                        } else {
                            // For verification, we want a roughly front-facing pose
                            const yaw = result.yaw;
                            if (yaw < -0.25 || yaw > 0.25) {
                                setGuidanceMsg("Look straight at the camera");
                                setGuidanceColor("amber");
                                stableCountRef.current = 0;
                            } else {
                                // Face is well-positioned!
                                stableCountRef.current += 1;
                                const stableNeeded = 4; // ~1s at 250ms

                                if (stableCountRef.current >= stableNeeded) {
                                    setGuidanceMsg("Perfect! Scanning...");
                                    setGuidanceColor("green");
                                } else {
                                    setGuidanceMsg(`Hold still... (${Math.round((stableCountRef.current / stableNeeded) * 100)}%)`);
                                    setGuidanceColor("green");
                                }
                            }
                        }
                    }
                } catch {
                    // Non-critical tracking error
                }
            }

            if (trackingRef.current) {
                rafId = requestAnimationFrame(trackLoop);
            }
        };

        rafId = requestAnimationFrame(trackLoop);

        return () => {
            console.log(`[face-verify] Tracking loop STOPPED (frames tracked: ${trackFrameCount})`);
            trackingRef.current = false;
            cancelAnimationFrame(rafId);
        };
    }, [phase, videoReady]);

    const handleScan = useCallback(async () => {
        const video = videoRef.current;
        if (!video || !videoReady) return;

        // Verify video is actually streaming with valid dimensions
        if (!video.videoWidth || !video.videoHeight) {
            cleanup();
            setError("Camera stream not ready. Please wait a moment and try again.");
            setPhase("failed");
            return;
        }

        setPhase("scanning");
        trackingRef.current = false;
        stableCountRef.current = 0;
        setScanProgress(0);
        console.log(`[face-verify] Starting face scan for employee=${employeeId || "unknown"}`);

        // Multi-frame detection: capture up to 10 frames over ~3s.
        const canvas = canvasRef.current;
        const validDescriptors: { descriptor: number[]; score: number }[] = [];
        const MAX_ATTEMPTS = 10;
        const MIN_GOOD_FRAMES = 4;
        const MIN_DETECTION_SCORE = 0.70;
        const MAX_CONSISTENCY_DISTANCE = 0.35;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            if (canvas) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                if (ctx) ctx.drawImage(video, 0, 0);
                const result = await detectFace(canvas);
                if (result) {
                    console.log(`[face-verify] Frame ${attempt + 1}: score=${result.score.toFixed(3)} ${result.score >= MIN_DETECTION_SCORE ? "✓" : "✗"}`);
                    if (result.score >= MIN_DETECTION_SCORE) {
                        validDescriptors.push({ descriptor: result.descriptor, score: result.score });
                    }
                } else {
                    console.log(`[face-verify] Frame ${attempt + 1}: no face detected`);
                }
            }
            if (attempt < MAX_ATTEMPTS - 1) {
                await new Promise((r) => setTimeout(r, 300));
            }
            setScanProgress(Math.round(((attempt + 1) / MAX_ATTEMPTS) * 100));
            // Early exit once we have plenty of good frames
            if (validDescriptors.length >= 7) break;
        }

        console.log(`[face-verify] Captured ${validDescriptors.length}/${MAX_ATTEMPTS} valid frames (need ${MIN_GOOD_FRAMES}+)`);

        if (validDescriptors.length < MIN_GOOD_FRAMES) {
            console.warn(`[face-verify] REJECTED: insufficient frames (${validDescriptors.length})`);
            cleanup();
            setError(validDescriptors.length === 0 ? "No face detected." : `Only ${validDescriptors.length} frame(s) — hold steady with better lighting.`);
            setErrorHint(isMobile
                ? "Hold your phone at arm's length, ensure good lighting, and look directly at the screen."
                : "Position your face clearly within the oval guide and ensure good lighting.");
            setPhase("failed");
            return;
        }

        // Sort by detection confidence and take top frames, then average
        validDescriptors.sort((a, b) => b.score - a.score);
        const topDescriptors = validDescriptors.slice(0, 5).map((d) => d.descriptor);

        // Consistency check: reject if frames are too different (jitter / movement)
        const consistency = descriptorConsistency(topDescriptors);
        console.log(`[face-verify] Frame consistency: ${consistency.toFixed(4)} (max allowed: ${MAX_CONSISTENCY_DISTANCE})`);

        if (consistency > MAX_CONSISTENCY_DISTANCE) {
            console.warn(`[face-verify] REJECTED: inconsistent frames (${consistency.toFixed(4)})`);
            cleanup();
            setError("Face detection unstable.");
            setErrorHint("Hold still and ensure consistent lighting.");
            setPhase("failed");
            return;
        }

        const averaged = averageDescriptors(topDescriptors);
        const embNorm = Math.sqrt(averaged.reduce((s, v) => s + v * v, 0));
        console.log(`[face-verify] Averaged embedding: norm=${embNorm.toFixed(4)}, avgScore=${(topDescriptors.length > 0 ? validDescriptors.slice(0, topDescriptors.length).reduce((s, d) => s + d.score, 0) / topDescriptors.length : 0).toFixed(3)}`);

        // Capture probe image for AI face comparison before stopping camera
        const probeImage = canvas?.toDataURL("image/jpeg", 0.85);

        // Stop camera after capture
        cleanup();
        setPhase("verifying");

        try {
            // When employeeId is provided, use targeted verify (tighter identity check)
            if (employeeId) {
                console.log(`[face-verify] Sending verify request for employee=${employeeId}`);
                const res = await fetch("/api/face-recognition/enroll?action=verify", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(currentUserId ? { "x-user-id": currentUserId } : {}),
                        ...(process.env.NEXT_PUBLIC_KIOSK_API_KEY
                            ? { "x-kiosk-api-key": process.env.NEXT_PUBLIC_KIOSK_API_KEY }
                            : {}),
                    },
                    body: JSON.stringify({ employeeId, embedding: averaged, probeImage }),
                });
                const verifyData = res.ok ? await res.json() : null;
                console.log(`[face-verify] Verify response:`, verifyData);

                if (verifyData?.ok && verifyData.verified) {
                    console.log(`[face-verify] ✅ VERIFIED employee=${employeeId} distance=${verifyData.distance?.toFixed(4) ?? "?"}`);
                    setPhase("verified");
                    setTimeout(() => onVerified(), 1500);
                    return;
                }

                console.warn(`[face-verify] ❌ Verify FAILED for employee=${employeeId}`, verifyData);

                // Check if employee has enrollment at all
                const statusRes = await fetch(`/api/face-recognition/enroll?action=status&employeeId=${encodeURIComponent(employeeId)}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    if (!statusData.enrolled) {
                        console.log(`[face-verify] Employee ${employeeId} has no face enrollment`);
                        setPhase("no-enrollment");
                        return;
                    }
                }

                setError("Face verification failed.");
                setErrorHint("Your face did not match the enrolled profile. Try with better lighting or re-enroll.");
                setPhase("failed");
                return;
            }

            // Fallback: no employeeId — use broad match with averaged embedding
            console.log(`[face-verify] Sending match request (no specific employee)`);
            const res = await fetch("/api/face-recognition/enroll?action=match", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(currentUserId ? { "x-user-id": currentUserId } : {}),
                    ...(process.env.NEXT_PUBLIC_KIOSK_API_KEY
                        ? { "x-kiosk-api-key": process.env.NEXT_PUBLIC_KIOSK_API_KEY }
                        : {}),
                },
                body: JSON.stringify({ embedding: averaged, probeImage }),
            });

            const matchData = res.ok ? await res.json() : null;
            console.log(`[face-verify] Match response:`, matchData);

            if (matchData?.ok && matchData.employeeId) {
                console.log(`[face-verify] ✅ MATCHED employee=${matchData.employeeId} distance=${matchData.distance?.toFixed(4) ?? "?"}`);
                setPhase("verified");
                setTimeout(() => onVerified(), 1500);
                return;
            }

            console.warn(`[face-verify] ❌ Match FAILED`, matchData);
            setError("Face verification failed.");
            setErrorHint("Your face did not match any enrolled profile. Try with better lighting or enroll first.");
            setPhase("failed");
        } catch (err) {
            console.error(`[face-verify] Network/unexpected error:`, err);
            setError("Network error during verification.");
            setErrorHint("Check your internet connection and try again.");
            setPhase("failed");
        }
    }, [videoReady, employeeId, onVerified, cleanup, isMobile]);

    // ── Auto-scan when face is stable ──
    useEffect(() => {
        if (phase !== "camera" || !videoReady) return;

        if (stableCountRef.current >= 4 && guidanceColor === "green" && guidanceMsg.includes("Scanning")) {
            if (!autoScanTimerRef.current) {
                autoScanTimerRef.current = setTimeout(() => {
                    autoScanTimerRef.current = null;
                    if (phase === "camera") {
                        handleScan();
                    }
                }, 400);
            }
        } else {
            if (autoScanTimerRef.current) {
                clearTimeout(autoScanTimerRef.current);
                autoScanTimerRef.current = null;
            }
        }
    }, [guidanceColor, guidanceMsg, phase, videoReady, handleScan]);

    const handleRetry = useCallback(() => {
        cleanup();
        setError("");
        setErrorHint("");
        setVideoReady(false);
        setTracking(null);
        setGuidanceMsg("");
        setGuidanceColor("red");
        setScanProgress(0);
        stableCountRef.current = 0;
        startCamera();
    }, [cleanup, startCamera]);

    // ── Loading ──────────────────────────────────────────────────
    if (phase === "loading") {
        return (
            <Card className="border border-border/50">
                <CardContent className="p-5 sm:p-6 flex flex-col items-center gap-3">
                    <Loader2 className="h-9 w-9 sm:h-10 sm:w-10 text-primary animate-spin" />
                    <p className="text-sm font-medium">Loading face recognition...</p>
                    <p className="text-xs text-muted-foreground text-center">
                        {isMobile
                            ? "Downloading models (~12 MB) — this is faster on Wi-Fi"
                            : "This may take a few seconds on first load"}
                    </p>
                </CardContent>
            </Card>
        );
    }

    // ── Idle ─────────────────────────────────────────────────────
    if (phase === "idle") {
        return (
            <Card className="border border-border/50">
                <CardContent className="p-5 sm:p-6 flex flex-col items-center gap-3">
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <ScanFace className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Face Verification</p>
                    <p className="text-xs text-muted-foreground text-center max-w-[260px]">
                        Verify your identity using biometric face recognition
                    </p>
                    {isMobile && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Sun className="h-3 w-3 shrink-0" />
                            <span>Best results in a well-lit area</span>
                        </div>
                    )}
                    <Button onClick={startCamera} className="gap-2 min-h-[44px] w-full sm:w-auto" disabled={disabled}>
                        <Camera className="h-4 w-4" /> Start Camera
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // ── No enrollment ────────────────────────────────────────────
    if (phase === "no-enrollment") {
        return (
            <Card className="border border-red-500/30 bg-red-500/5">
                <CardContent className="p-5 sm:p-6 flex flex-col items-center gap-3">
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full flex items-center justify-center bg-red-500/15">
                        <ScanFace className="h-7 w-7 sm:h-8 sm:w-8 text-red-500" />
                    </div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                        Face Enrollment Required
                    </p>
                    <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                        You must enroll your face before checking in. Visit the Face Enrollment page to register your biometric signature.
                    </p>
                    <Button
                        onClick={() => { window.location.href = `/${window.location.pathname.split("/")[1]}/face-enrollment`; }}
                        variant="outline"
                        className="gap-1.5 min-h-[44px] w-full sm:w-auto"
                    >
                        <ScanFace className="h-4 w-4" /> Go to Face Enrollment
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // ── Verified ─────────────────────────────────────────────────
    if (phase === "verified") {
        return (
            <Card className="border border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="p-5 sm:p-6 flex flex-col items-center gap-3">
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <CheckCircle className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-500" />
                    </div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Face Verified</p>
                    <p className="text-xs text-muted-foreground">Identity confirmed via biometric matching</p>
                </CardContent>
            </Card>
        );
    }

    // ── Failed ───────────────────────────────────────────────────
    if (phase === "failed") {
        return (
            <Card className="border border-red-500/30 bg-red-500/5">
                <CardContent className="p-5 sm:p-6 flex flex-col items-center gap-3">
                    <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-red-500/15 flex items-center justify-center">
                        <ShieldAlert className="h-7 w-7 sm:h-8 sm:w-8 text-red-500" />
                    </div>
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">Verification Failed</p>
                    <p className="text-xs text-muted-foreground text-center max-w-[280px]">{error || "Could not verify your face."}</p>
                    {errorHint && (
                        <div className="flex items-start gap-1.5 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2 max-w-[300px]">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-red-600/80 dark:text-red-400/70">{errorHint}</p>
                        </div>
                    )}
                    <Button onClick={handleRetry} variant="outline" className="min-h-[44px] w-full sm:w-auto">Try Again</Button>
                </CardContent>
            </Card>
        );
    }

    // ── Verifying (server call) ──────────────────────────────────
    if (phase === "verifying") {
        return (
            <Card className="border border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-5 sm:p-6 flex flex-col items-center gap-3">
                    <Loader2 className="h-9 w-9 sm:h-10 sm:w-10 text-blue-500 animate-spin" />
                    <p className="text-sm font-medium">Verifying Face...</p>
                    <p className="text-xs text-muted-foreground">Matching against enrolled embeddings</p>
                </CardContent>
            </Card>
        );
    }

    // ── Waiting for stream ───────────────────────────────────────
    // NOTE: No early-return here — falls through to the camera card below so
    // the same <video ref={videoRef}> element stays mounted across the
    // waiting-stream → camera transition. Destroying and re-mounting the
    // video element would detach the stream and cause a black screen.

    // ── Camera / Scanning (also handles waiting-stream — single video element) ──
    return (
        <Card className="overflow-hidden border border-border/50">
            <CardContent className="p-0">
                <canvas ref={canvasRef} className="hidden" />
                {/* Responsive camera view: taller on mobile (portrait), wider on desktop */}
                <div className="relative w-full bg-black aspect-[3/4] sm:aspect-[4/3] max-h-[50vh] sm:max-h-[320px]">
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        style={{ transform: "scaleX(-1)" }}
                    />

                    {/* Spinner overlay while stream is starting */}
                    {phase === "waiting-stream" && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
                            <Loader2 className="h-9 w-9 text-primary animate-spin" />
                            <p className="text-sm font-medium text-white">Starting camera…</p>
                            {isMobile && (
                                <p className="text-xs text-white/60 text-center px-6">Grant camera access when prompted</p>
                            )}
                        </div>
                    )}

                    {/* Face oval guide — color changes based on tracking */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className={`w-[40%] max-w-[160px] aspect-[3/4] rounded-full border-2 transition-all duration-300 ${
                            phase === "scanning" ? "border-blue-400 shadow-[0_0_20px_rgba(96,165,250,0.4)]" :
                            guidanceColor === "green" ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]" :
                            guidanceColor === "amber" ? "border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]" :
                            tracking ? "border-red-400 shadow-[0_0_15px_rgba(248,113,113,0.2)]" : "border-white/50"
                        }`} />
                    </div>

                    {/* Live guidance message banner */}
                    {phase === "camera" && guidanceMsg && (
                        <div className="absolute top-3 left-0 right-0 flex justify-center">
                            <div className={`backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5 max-w-[90%] ${
                                guidanceColor === "green" ? "bg-emerald-900/70" :
                                guidanceColor === "amber" ? "bg-amber-900/70" : "bg-red-900/70"
                            }`}>
                                {guidanceColor === "green" ? <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" /> :
                                 guidanceColor === "amber" ? <Eye className="h-3 w-3 text-amber-400 shrink-0" /> :
                                 <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}
                                <span className={`text-[11px] font-medium ${
                                    guidanceColor === "green" ? "text-emerald-300" :
                                    guidanceColor === "amber" ? "text-amber-300" : "text-red-300"
                                }`}>{guidanceMsg}</span>
                            </div>
                        </div>
                    )}

                    {/* Scanning overlay with progress */}
                    {phase === "scanning" && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 gap-3">
                            <Loader2 className="h-9 w-9 sm:h-10 sm:w-10 text-white animate-spin" />
                            <div className="w-32 sm:w-40 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-400 rounded-full transition-all duration-200"
                                    style={{ width: `${scanProgress}%` }}
                                />
                            </div>
                            <p className="text-white/80 text-xs">Scanning face... {scanProgress}%</p>
                        </div>
                    )}

                    {phase === "camera" && !guidanceMsg && (
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                            <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-1.5">
                                <span className="text-white/80 text-xs">Position your face in the oval</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-3 sm:p-4 flex flex-col items-center gap-2">
                    {phase === "camera" && (
                        <>
                            <Button
                                onClick={handleScan}
                                className="w-full gap-2 min-h-[48px] text-base sm:text-sm sm:min-h-[40px]"
                                disabled={!videoReady || guidanceColor === "red"}
                            >
                                <ScanFace className="h-5 w-5 sm:h-4 sm:w-4" />
                                {!videoReady ? "Preparing camera..." :
                                 guidanceColor === "red" ? "Position your face first" :
                                 guidanceColor === "green" ? "Verify My Face ✓" :
                                 "Verify My Face"}
                            </Button>
                            <p className="text-[10px] text-muted-foreground text-center">
                                {guidanceColor === "green"
                                    ? "Auto-scan will trigger when you hold still — or tap the button"
                                    : "Follow the on-screen guidance to position your face"}
                            </p>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
