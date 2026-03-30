"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    ScanFace, CheckCircle, ShieldAlert, Loader2, Camera,
    Smartphone, Sun, AlertTriangle,
} from "lucide-react";
import { loadFaceModels, detectFace, averageDescriptors } from "@/lib/face-api";

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
    /** When true, face verification cannot be skipped (face_only / face_or_qr projects) */
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
    required = false,
}: RealFaceVerificationProps) {
    const [phase, setPhase] = useState<Phase>("loading");
    const [error, setError] = useState("");
    const [errorHint, setErrorHint] = useState("");
    const [videoReady, setVideoReady] = useState(false);
    const [isMobile] = useState(() => isMobileDevice());
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

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

            // Mobile-adaptive camera constraints
            const constraints: MediaStreamConstraints = {
                video: {
                    facingMode: "user",
                    width: { ideal: isMobile ? 480 : 640 },
                    height: { ideal: isMobile ? 640 : 480 },
                },
                audio: false,
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Wait for video metadata to be loaded before enabling controls
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play().then(() => {
                        setVideoReady(true);
                        setPhase("camera");
                    }).catch(() => {
                        // Autoplay blocked — user interaction needed
                        setVideoReady(true);
                        setPhase("camera");
                    });
                };
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

        // Multi-frame detection: capture up to 10 frames over ~3s.
        // More frames = more stable averaged embedding for reliable matching.
        // Use the same confidence floor as enrollment (0.6 from face-api).
        const canvas = canvasRef.current;
        const validDescriptors: { descriptor: number[]; score: number }[] = [];
        const MAX_ATTEMPTS = 10;
        const MIN_GOOD_FRAMES = 3;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            if (canvas) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                if (ctx) ctx.drawImage(video, 0, 0);
                const result = await detectFace(canvas);
                // Accept any face that passes the base SSD MobileNet threshold (0.6)
                // This matches what enrollment accepts, preventing quality mismatch
                if (result && result.score >= 0.6) {
                    validDescriptors.push({ descriptor: result.descriptor, score: result.score });
                }
            }
            if (attempt < MAX_ATTEMPTS - 1) {
                await new Promise((r) => setTimeout(r, 300));
            }
            // Early exit once we have plenty of good frames
            if (validDescriptors.length >= 7) break;
        }

        if (validDescriptors.length < MIN_GOOD_FRAMES) {
            cleanup();
            setError(validDescriptors.length === 0 ? "No face detected." : "Face detection unstable — only partial frames captured.");
            setErrorHint(isMobile
                ? "Hold your phone at arm's length, ensure good lighting, and look directly at the screen."
                : "Position your face clearly within the oval guide and ensure good lighting.");
            setPhase("failed");
            return;
        }

        // Sort by detection confidence and take top frames, then average
        validDescriptors.sort((a, b) => b.score - a.score);
        const topDescriptors = validDescriptors.slice(0, 5).map((d) => d.descriptor);
        const averaged = averageDescriptors(topDescriptors);

        // Capture probe image for AI face comparison before stopping camera
        const probeImage = canvas?.toDataURL("image/jpeg", 0.85);

        // Stop camera after capture
        cleanup();
        setPhase("verifying");

        try {
            // When employeeId is provided, use targeted verify (tighter identity check)
            // Send a single averaged embedding for more robust matching.
            if (employeeId) {
                const res = await fetch("/api/face-recognition/enroll?action=verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ employeeId, embedding: averaged, probeImage }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.ok && data.verified) {
                        setPhase("verified");
                        setTimeout(() => onVerified(), 1500);
                        return;
                    }
                }

                // Check if employee has enrollment at all
                const statusRes = await fetch(`/api/face-recognition/enroll?action=status&employeeId=${encodeURIComponent(employeeId)}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    if (!statusData.enrolled) {
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
            const res = await fetch("/api/face-recognition/enroll?action=match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ embedding: averaged, probeImage }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.ok && data.employeeId) {
                    setPhase("verified");
                    setTimeout(() => onVerified(), 1500);
                    return;
                }
            }

            setError("Face verification failed.");
            setErrorHint("Your face did not match any enrolled profile. Try with better lighting or enroll first.");
            setPhase("failed");
        } catch {
            setError("Network error during verification.");
            setErrorHint("Check your internet connection and try again.");
            setPhase("failed");
        }
    }, [videoReady, employeeId, onVerified, cleanup, isMobile]);

    const handleRetry = useCallback(() => {
        cleanup();
        setError("");
        setErrorHint("");
        setVideoReady(false);
        startCamera();
    }, [cleanup, startCamera]);

    const handleSkipNoEnrollment = useCallback(() => {
        onVerified();
    }, [onVerified]);

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
            <Card className={`border ${required ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
                <CardContent className="p-5 sm:p-6 flex flex-col items-center gap-3">
                    <div className={`h-14 w-14 sm:h-16 sm:w-16 rounded-full flex items-center justify-center ${required ? "bg-red-500/15" : "bg-amber-500/15"}`}>
                        <ScanFace className={`h-7 w-7 sm:h-8 sm:w-8 ${required ? "text-red-500" : "text-amber-500"}`} />
                    </div>
                    <p className={`text-sm font-medium ${required ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                        {required ? "Face Enrollment Required" : "Face Not Enrolled"}
                    </p>
                    <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                        {required
                            ? "Your project requires face verification for check-in. Please enroll your face first."
                            : "You haven\u2019t enrolled your face yet. Visit the Face Enrollment page to register your biometric signature."}
                    </p>
                    {required ? (
                        <Button
                            onClick={() => { window.location.href = `/${window.location.pathname.split("/")[1]}/face-enrollment`; }}
                            variant="outline"
                            className="gap-1.5 min-h-[44px] w-full sm:w-auto"
                        >
                            <ScanFace className="h-4 w-4" /> Go to Face Enrollment
                        </Button>
                    ) : (
                        <Button onClick={handleSkipNoEnrollment} className="gap-1.5 min-h-[44px] w-full sm:w-auto">
                            <CheckCircle className="h-4 w-4" /> Continue Check-In
                        </Button>
                    )}
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
                    {/* Single always-mounted video element — stream is attached here and stays
                        across phase transitions to avoid black screen from re-mount */}
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

                    {/* Responsive face oval guide */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className={`w-[40%] max-w-[160px] aspect-[3/4] rounded-full border-2 transition-colors duration-300 ${
                            phase === "scanning" ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]" : "border-white/50"
                        }`} />
                    </div>

                    {/* Mobile-friendly hint bar */}
                    {isMobile && phase === "camera" && (
                        <div className="absolute top-3 left-0 right-0 flex justify-center">
                            <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1.5">
                                <Smartphone className="h-3 w-3 text-white/70" />
                                <span className="text-white/80 text-[10px]">Hold at arm&apos;s length</span>
                            </div>
                        </div>
                    )}

                    {phase === "scanning" && (
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                            <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-white text-sm font-medium">Detecting face...</span>
                            </div>
                        </div>
                    )}
                    {phase === "camera" && (
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                            <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-1.5">
                                <span className="text-white/80 text-xs">Position your face in the oval</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-3 sm:p-4 flex flex-col items-center gap-2">
                    {phase === "camera" && (
                        <Button
                            onClick={handleScan}
                            className="w-full gap-2 min-h-[48px] text-base sm:text-sm sm:min-h-[40px]"
                            disabled={!videoReady}
                        >
                            <ScanFace className="h-5 w-5 sm:h-4 sm:w-4" />
                            {videoReady ? "Verify My Face" : "Preparing camera..."}
                        </Button>
                    )}
                    {isMobile && phase === "camera" && (
                        <p className="text-[10px] text-muted-foreground text-center">
                            Ensure good lighting and look directly at the camera
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
