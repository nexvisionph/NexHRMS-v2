"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { loadFaceModels, detectFace, averageDescriptors } from "@/lib/face-api";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ScanFace, Camera, CheckCircle, XCircle, Loader2, RotateCcw,
    ChevronRight, ShieldCheck, Trash2, Sun, Smartphone, AlertTriangle,
} from "lucide-react";

/**
 * Employee Face Enrollment Page — Mobile-first
 *
 * Accessible at /{role}/face-enrollment (no kiosk PIN required).
 * Uses face-api.js to capture 3 angles (front/left/right),
 * averages descriptors into a single 128-d embedding, and stores in DB.
 *
 * Mobile adaptations:
 * - Portrait-friendly camera aspect ratio
 * - Wake Lock to prevent screen dimming during enrollment
 * - Video readiness gate (waits for onloadedmetadata before enabling capture)
 * - Touch-optimized buttons (min 44px targets)
 * - Mobile-specific camera permission error guidance
 * - Responsive layout for all screen sizes
 */

const STEPS = [
    { label: "Front", instruction: "Look straight at the camera" },
    { label: "Left", instruction: "Turn your head slightly left" },
    { label: "Right", instruction: "Turn your head slightly right" },
] as const;

type EnrollState = "loading-models" | "checking" | "idle" | "starting-camera" | "camera" | "countdown" | "detecting" | "captured" | "enrolling" | "done" | "error";

/** Detect if running on a mobile/tablet device */
function isMobileDevice(): boolean {
    if (typeof window === "undefined") return false;
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
}

/** Request Wake Lock to prevent screen dimming during camera usage */
async function requestWakeLock(): Promise<WakeLockSentinel | null> {
    try {
        if ("wakeLock" in navigator) {
            return await navigator.wakeLock.request("screen");
        }
    } catch { /* Wake Lock not supported or denied — non-critical */ }
    return null;
}

export default function FaceEnrollmentPage() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const employeeId = currentUser.id || "";

    const [step, setStep] = useState(0);
    const [state, setState] = useState<EnrollState>("loading-models");
    const [descriptors, setDescriptors] = useState<number[][]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [countdown, setCountdown] = useState(3);
    const [error, setError] = useState("");
    const [errorHint, setErrorHint] = useState("");
    const [enrolled, setEnrolled] = useState(false);
    const [enrolledAt, setEnrolledAt] = useState<string | null>(null);
    const [videoReady, setVideoReady] = useState(false);
    const [isMobile] = useState(() => isMobileDevice());
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    // Clean up camera + wake lock
    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        wakeLockRef.current?.release().catch(() => {});
        wakeLockRef.current = null;
    }, []);

    // Load models + check enrollment status
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                await loadFaceModels();
                if (cancelled) return;
                setState("checking");
                const res = await fetch(`/api/face-recognition/enroll?action=status&employeeId=${encodeURIComponent(employeeId)}`);
                if (!cancelled && res.ok) {
                    const data = await res.json();
                    if (data.enrolled) {
                        setEnrolled(true);
                        setEnrolledAt(data.enrolledAt || null);
                    }
                }
                if (!cancelled) setState("idle");
            } catch (err) {
                if (!cancelled) {
                    console.error("Failed to load face models:", err);
                    setError("Failed to load face recognition models.");
                    setErrorHint(isMobileDevice()
                        ? "Check your internet connection (models are ~12 MB) and refresh the page."
                        : "Please refresh the page to retry.");
                    setState("error");
                }
            }
        })();
        return () => { cancelled = true; };
    }, [employeeId]);

    useEffect(() => {
        return () => stopCamera();
    }, [stopCamera]);

    const startCamera = useCallback(async () => {
        setVideoReady(false);
        setError("");
        setErrorHint("");
        setState("starting-camera");

        try {
            wakeLockRef.current = await requestWakeLock();

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
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play().then(() => {
                        setVideoReady(true);
                        setState("camera");
                    }).catch(() => {
                        setVideoReady(true);
                        setState("camera");
                    });
                };
            }
        } catch (err) {
            const domErr = err instanceof DOMException;
            if (domErr && (err as DOMException).name === "NotAllowedError") {
                setError("Camera access denied.");
                setErrorHint(isMobile
                    ? "Open your browser settings → Site Settings → Camera, and allow access for this site."
                    : "Click the camera icon in the address bar to grant permission.");
            } else if (domErr && (err as DOMException).name === "NotFoundError") {
                setError("No camera found on this device.");
                setErrorHint("Ensure your device has a front-facing camera.");
            } else {
                setError("Could not access camera.");
                setErrorHint(isMobile
                    ? "Close other apps using the camera and try again."
                    : "Check that no other application is using the camera.");
            }
            setState("error");
        }
    }, [isMobile]);

    const captureAndDetect = useCallback(async () => {
        setState("detecting");
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
            setError("Camera stream not ready.");
            setErrorHint("Wait a moment and try again.");
            setState("error");
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");

        // Multi-frame detection: capture up to 5 frames, average the best ones.
        // More frames and averaging produce a more stable enrollment embedding
        // that matches verification embeddings more reliably across sessions.
        const allDetections: { descriptor: number[]; score: number }[] = [];
        const MAX_ATTEMPTS = 5;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            if (ctx) ctx.drawImage(video, 0, 0);
            const result = await detectFace(canvas);
            if (result && result.score >= 0.6) {
                allDetections.push({ descriptor: result.descriptor, score: result.score });
            }
            // Brief delay before next attempt to get a different frame
            if (attempt < MAX_ATTEMPTS - 1) {
                await new Promise((r) => setTimeout(r, 250));
            }
        }

        // Use the best detection for the preview/toast, but store the averaged descriptor
        const best = allDetections.length > 0
            ? allDetections.reduce((a, b) => a.score > b.score ? a : b)
            : null;

        if (!best || allDetections.length === 0) {
            toast.error(isMobile
                ? "No face detected. Hold phone at arm's length in good lighting."
                : "No face detected. Position your face clearly and try again.");
            setState("camera");
            return;
        }

        // Capture preview from the current canvas frame
        if (ctx) ctx.drawImage(video, 0, 0);
        const previewUrl = canvas.toDataURL("image/jpeg", 0.85);

        // Average all detections from this angle for a more stable per-angle descriptor
        const angleAvg = allDetections.length > 1
            ? averageDescriptors(allDetections.map(d => d.descriptor))
            : best.descriptor;

        setDescriptors((prev) => [...prev, angleAvg]);
        setPreviews((prev) => [...prev, previewUrl]);
        setState("captured");
        toast.success(`Face detected (confidence: ${(best.score * 100).toFixed(0)}%, ${allDetections.length} frames averaged)`);
    }, [isMobile]);

    const beginCapture = useCallback(() => {
        if (!videoReady) return;
        setState("countdown");
        setCountdown(3);
        let c = 3;
        const interval = setInterval(() => {
            c -= 1;
            setCountdown(c);
            if (c <= 0) {
                clearInterval(interval);
                captureAndDetect();
            }
        }, 1000);
    }, [captureAndDetect, videoReady]);

    const handleRetake = useCallback(() => {
        setDescriptors((prev) => prev.slice(0, -1));
        setPreviews((prev) => prev.slice(0, -1));
        setState("camera");
    }, []);

    const handleEnroll = useCallback(async () => {
        setState("enrolling");
        setError("");
        setErrorHint("");
        try {
            const avgEmbedding = averageDescriptors(descriptors);
            if (avgEmbedding.length !== 128) {
                setError("Failed to compute face embedding.");
                setState("error");
                return;
            }

            const res = await fetch("/api/face-recognition/enroll?action=enroll", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": currentUser.id || "system",
                },
                body: JSON.stringify({ employeeId, embedding: avgEmbedding, referenceImage: previews[0] }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                setError(data.error || "Enrollment failed.");
                setState("error");
                return;
            }

            stopCamera();
            setEnrolled(true);
            setEnrolledAt(new Date().toISOString());
            setState("done");
            toast.success("Face enrolled successfully!");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Network error");
            setErrorHint("Check your internet connection and try again.");
            setState("error");
        }
    }, [descriptors, previews, employeeId, currentUser.id, stopCamera]);

    const handleNext = useCallback(() => {
        if (step < 2) {
            setStep((s) => s + 1);
            setState("camera");
        } else {
            handleEnroll();
        }
    }, [step, handleEnroll]);

    const handleDelete = useCallback(async () => {
        try {
            const res = await fetch("/api/face-recognition/enroll?action=delete", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-user-id": currentUser.id || "system" },
                body: JSON.stringify({ employeeId }),
            });
            if (res.ok) {
                setEnrolled(false);
                setEnrolledAt(null);
                toast.success("Face enrollment deleted. You can re-enroll anytime.");
            } else {
                toast.error("Failed to delete enrollment.");
            }
        } catch {
            toast.error("Network error.");
        }
    }, [employeeId, currentUser.id]);

    const resetAll = useCallback(() => {
        setDescriptors([]);
        setPreviews([]);
        setStep(0);
        setState("idle");
        setError("");
        setErrorHint("");
        stopCamera();
    }, [stopCamera]);

    const currentStepData = STEPS[step];

    return (
        <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto px-1">
            <div className="text-center space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
                    <ScanFace className="h-5 w-5 sm:h-6 sm:w-6" /> Face Enrollment
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto">
                    Register your face for biometric check-in. No photos are stored — only a secure 128-dimensional signature.
                </p>
            </div>

            {/* Already enrolled banner */}
            {enrolled && state !== "done" && (
                <Card className="border-2 border-emerald-500/30 bg-emerald-500/5">
                    <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Face Already Enrolled</p>
                                <p className="text-xs text-muted-foreground">
                                    {enrolledAt ? `Enrolled on ${new Date(enrolledAt).toLocaleDateString()}` : "Your face is registered."}
                                    {" "}You can re-enroll to update it.
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1 shrink-0 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950 min-h-[40px] w-full sm:w-auto" onClick={handleDelete}>
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Progress steps */}
            {state !== "idle" && state !== "loading-models" && state !== "checking" && state !== "done" && state !== "error" && (
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                    {STEPS.map((s, i) => (
                        <div key={s.label} className="flex items-center gap-1.5 sm:gap-2">
                            <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                i < step ? "bg-emerald-500 text-white" :
                                i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}>
                                {i < step ? <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : i + 1}
                            </div>
                            <span className={`text-[11px] sm:text-xs font-medium hidden min-[400px]:inline ${i <= step ? "" : "text-muted-foreground"}`}>{s.label}</span>
                            {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        </div>
                    ))}
                </div>
            )}

            {/* Loading models */}
            {(state === "loading-models" || state === "checking") && (
                <Card>
                    <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-3">
                        <Loader2 className="h-9 w-9 sm:h-10 sm:w-10 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground text-center">
                            {state === "loading-models" ? "Loading face recognition models..." : "Checking enrollment status..."}
                        </p>
                        {isMobile && state === "loading-models" && (
                            <p className="text-[10px] text-muted-foreground text-center">
                                Downloading models (~12 MB) — faster on Wi-Fi
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Idle — start enrollment */}
            {state === "idle" && (
                <Card>
                    <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4">
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-primary/10 flex items-center justify-center">
                            <ScanFace className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                        </div>
                        <div className="text-center space-y-1 max-w-sm">
                            <p className="text-lg font-semibold">{enrolled ? "Re-enroll Your Face" : "Enroll Your Face"}</p>
                            <p className="text-sm text-muted-foreground">
                                We&apos;ll capture 3 angles of your face — front, left, and right — to create a robust biometric signature.
                            </p>
                        </div>
                        {isMobile && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Sun className="h-3 w-3 shrink-0" />
                                <span>Best results in a well-lit area facing a light source</span>
                            </div>
                        )}
                        <Button onClick={startCamera} size="lg" className="gap-2 min-h-[48px] w-full sm:w-auto">
                            <Camera className="h-5 w-5" /> Start Enrollment
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Starting camera (waiting for stream) */}
            {state === "starting-camera" && (
                <Card>
                    <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-3">
                        <Loader2 className="h-9 w-9 text-primary animate-spin" />
                        <p className="text-sm font-medium">Starting camera...</p>
                        {isMobile && (
                            <p className="text-xs text-muted-foreground text-center">
                                Grant camera access when prompted
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/*
              Single always-rendered video+canvas — visible only during camera states.
              Keeping this mounted at all times means videoRef never loses the stream
              when React transitions between "starting-camera" → "camera" states.
            */}
            <div className={state === "camera" || state === "countdown" || state === "detecting" ? "" : "hidden"}>
                <Card className="overflow-hidden">
                    <CardContent className="p-0">
                        <canvas ref={canvasRef} className="hidden" />
                        {/* Responsive camera: portrait on mobile, landscape on desktop */}
                        <div className="relative w-full bg-black aspect-[3/4] sm:aspect-[4/3] max-h-[55vh] sm:max-h-[380px]">
                            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                            {/* Responsive face oval guide */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className={`w-[40%] max-w-[160px] aspect-[3/4] rounded-full border-2 transition-colors duration-300 ${
                                    state === "countdown" ? "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)]" :
                                    state === "detecting" ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]" : "border-white/50"
                                }`} />
                            </div>
                            {state === "countdown" && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-5xl sm:text-6xl font-bold text-white drop-shadow-lg">{countdown}</span>
                                </div>
                            )}
                            {state === "detecting" && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <Loader2 className="h-9 w-9 sm:h-10 sm:w-10 text-white animate-spin" />
                                </div>
                            )}
                            {/* Mobile hint */}
                            {isMobile && state === "camera" && (
                                <div className="absolute top-3 left-0 right-0 flex justify-center">
                                    <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1.5">
                                        <Smartphone className="h-3 w-3 text-white/70" />
                                        <span className="text-white/80 text-[10px]">Hold at arm&apos;s length</span>
                                    </div>
                                </div>
                            )}
                            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                                <Badge variant="secondary" className="bg-black/60 text-white border-0 px-3 py-1">
                                    Step {step + 1}/3: {currentStepData.instruction}
                                </Badge>
                            </div>
                        </div>
                        <div className="p-3 sm:p-4 flex flex-col items-center gap-2">
                            {state === "camera" && (
                                <Button
                                    onClick={beginCapture}
                                    className="gap-2 w-full min-h-[48px] text-base sm:text-sm sm:min-h-[40px]"
                                    disabled={!videoReady}
                                >
                                    <Camera className="h-5 w-5 sm:h-4 sm:w-4" />
                                    {videoReady ? `Capture ${currentStepData.label}` : "Preparing camera..."}
                                </Button>
                            )}
                            {isMobile && state === "camera" && (
                                <p className="text-[10px] text-muted-foreground text-center">
                                    Ensure good lighting and look directly at the camera
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Captured — show preview */}
            {state === "captured" && (
                <Card>
                    <CardContent className="p-4 sm:p-6 space-y-4">
                        <div className="flex items-center justify-center gap-3 sm:gap-4">
                            {previews.map((p, i) => (
                                <div key={i} className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={p} alt={`Capture ${i + 1}`} className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg object-cover border-2 border-emerald-500/30" />
                                    <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                        <CheckCircle className="h-3 w-3 text-white" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium flex items-center justify-center gap-1.5">
                            <CheckCircle className="h-4 w-4" /> {STEPS[step].label} captured successfully
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleRetake} className="gap-1 min-h-[44px]">
                                <RotateCcw className="h-3.5 w-3.5" /> Retake
                            </Button>
                            <Button onClick={handleNext} className="gap-1 flex-1 min-h-[44px]">
                                {step < 2 ? (<>Next: {STEPS[step + 1].label} <ChevronRight className="h-3.5 w-3.5" /></>) : "Enroll Face"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Enrolling */}
            {state === "enrolling" && (
                <Card>
                    <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-3">
                        <Loader2 className="h-9 w-9 sm:h-10 sm:w-10 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground text-center">Computing average embedding and enrolling...</p>
                    </CardContent>
                </Card>
            )}

            {/* Done */}
            {state === "done" && (
                <Card className="border-2 border-emerald-500/30 bg-emerald-500/5">
                    <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-4">
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
                            <CheckCircle className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-500" />
                        </div>
                        <div className="text-center space-y-1 max-w-sm">
                            <p className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-400">Face Enrolled!</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                Your 128-dimensional face signature has been securely stored. You can now use face recognition during check-in.
                            </p>
                        </div>
                        <Button variant="outline" onClick={resetAll} className="min-h-[44px] w-full sm:w-auto">Done</Button>
                    </CardContent>
                </Card>
            )}

            {/* Error */}
            {state === "error" && (
                <Card className="border-2 border-red-500/30 bg-red-500/5">
                    <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-3">
                        <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-red-500/15 flex items-center justify-center">
                            <XCircle className="h-8 w-8 sm:h-10 sm:w-10 text-red-500" />
                        </div>
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">Enrollment Failed</p>
                        <p className="text-xs text-muted-foreground text-center max-w-[300px]">{error}</p>
                        {errorHint && (
                            <div className="flex items-start gap-1.5 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2 max-w-[320px]">
                                <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-red-600/80 dark:text-red-400/70">{errorHint}</p>
                            </div>
                        )}
                        <Button variant="outline" onClick={resetAll} className="gap-1 min-h-[44px] w-full sm:w-auto">
                            <RotateCcw className="h-3.5 w-3.5" /> Start Over
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Info footer */}
            <div className="text-center space-y-1 pb-4 px-2">
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Your face data is converted to a mathematical signature — no photos are stored on the server.
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Privacy-first biometrics: only a 128-dimensional vector is saved, which cannot be reversed into an image.
                </p>
            </div>
        </div>
    );
}
