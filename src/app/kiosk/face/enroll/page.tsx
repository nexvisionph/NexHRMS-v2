"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useKioskStore } from "@/store/kiosk.store";
import { loadFaceModels, detectFace, averageDescriptors } from "@/lib/face-api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    ArrowLeft, Camera, CheckCircle, XCircle, Loader2, RotateCcw,
    ScanFace, ChevronRight,
} from "lucide-react";

/**
 * Face Enrollment — Front-face capture with multi-frame averaging.
 *
 * Captures multiple frames of the front face, averages the 128-d descriptors
 * for a robust embedding, and sends BOTH the embedding AND a reference image
 * to the server for storage. The reference image enables AI-enhanced matching.
 *
 * Mobile-optimized: adaptive camera resolution, touch-friendly buttons.
 */

type EnrollState = "loading-models" | "idle" | "camera" | "scanning" | "captured" | "enrolling" | "done" | "error";

/** Detect if the device is mobile based on screen width and touch support. */
function isMobileDevice(): boolean {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768 || ("ontouchstart" in window);
}

export default function FaceEnrollPage() {
    const router = useRouter();
    const currentUser = useAuthStore((s) => s.currentUser);
    const employees = useEmployeesStore((s) => s.employees);
    const companyName = useAppearanceStore((s) => s.companyName);
    const ks = useKioskStore((s) => s.settings);

    // Resolve the actual employee ID (e.g. "EMP027") from the auth profile
    const myEmployee = employees.find(
        (e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name
    );
    const employeeId = myEmployee?.id || currentUser.id || "";

    const [state, setState] = useState<EnrollState>("loading-models");
    const [descriptor, setDescriptor] = useState<number[] | null>(null);
    const [referenceImage, setReferenceImage] = useState<string>("");
    const [previewUrl, setPreviewUrl] = useState<string>("");
    const [scanProgress, setScanProgress] = useState(0);
    const [error, setError] = useState("");
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
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

    // Load face-api.js models on mount
    useEffect(() => {
        loadFaceModels()
            .then(() => setState("idle"))
            .catch((err) => {
                console.error("Failed to load face models:", err);
                setError("Failed to load face recognition models. Please refresh.");
                setState("error");
            });
    }, []);

    const startCamera = useCallback(async () => {
        try {
            const mobile = isMobileDevice();
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: { ideal: mobile ? 480 : 640 },
                    height: { ideal: mobile ? 640 : 480 },
                },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setState("camera");
        } catch {
            setError("Camera access denied. Please allow camera permission and ensure you're on HTTPS.");
            setState("error");
        }
    }, []);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
    }, []);

    useEffect(() => {
        return () => stopCamera();
    }, [stopCamera]);

    /**
     * Multi-frame scan: capture up to 7 frames, require 3+ good detections,
     * average top 5 descriptors. Also captures reference image from the best frame.
     */
    const handleScan = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        setState("scanning");
        setScanProgress(0);
        console.log(`[kiosk-enroll] Starting multi-frame scan for employeeId=${employeeId}`);

        const validFrames: { descriptor: number[]; score: number }[] = [];
        const MAX_ATTEMPTS = 7;
        const MIN_GOOD_FRAMES = 3;
        let bestScore = 0;
        let bestImageData = "";

        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            setScanProgress(Math.round(((i + 1) / MAX_ATTEMPTS) * 100));
            const result = await detectFace(videoRef.current);
            if (result && result.score >= 0.65) {
                console.log(`[kiosk-enroll] Frame ${i + 1}: score=${result.score.toFixed(3)} ✓`);
                validFrames.push({ descriptor: result.descriptor, score: result.score });
                // Capture the best-scoring frame as the reference image
                if (result.score > bestScore) {
                    bestScore = result.score;
                    const canvas = canvasRef.current;
                    canvas.width = videoRef.current.videoWidth;
                    canvas.height = videoRef.current.videoHeight;
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        ctx.drawImage(videoRef.current, 0, 0);
                        bestImageData = canvas.toDataURL("image/jpeg", 0.8);
                    }
                }
            } else {
                console.log(`[kiosk-enroll] Frame ${i + 1}: ${result ? `score=${result.score.toFixed(3)} ✗ (below 0.65)` : "no face detected"}`);
            }
            if (i < MAX_ATTEMPTS - 1) {
                await new Promise((r) => setTimeout(r, 350));
            }
        }

        if (validFrames.length < MIN_GOOD_FRAMES) {
            console.warn(`[kiosk-enroll] REJECTED: insufficient frames (${validFrames.length} < ${MIN_GOOD_FRAMES})`);
            toast.error(
                validFrames.length === 0
                    ? "No face detected. Position your face in the oval and ensure good lighting."
                    : `Only ${validFrames.length} good frame(s). Try better lighting or hold still.`
            );
            setState("camera");
            setScanProgress(0);
            return;
        }

        // Average top descriptors for stability
        validFrames.sort((a, b) => b.score - a.score);
        const averaged = averageDescriptors(validFrames.slice(0, 5).map((f) => f.descriptor));
        const embNorm = Math.sqrt(averaged.reduce((s, v) => s + v * v, 0));
        console.log(`[kiosk-enroll] Averaged embedding: norm=${embNorm.toFixed(4)} frames=${validFrames.length} bestScore=${(bestScore * 100).toFixed(0)}%`);

        setDescriptor(averaged);
        setReferenceImage(bestImageData);
        setPreviewUrl(bestImageData);
        setState("captured");
        toast.success(`Face captured (${validFrames.length} frames, best: ${(bestScore * 100).toFixed(0)}%)`);
    }, [employeeId]);

    const handleRetake = useCallback(() => {
        setDescriptor(null);
        setReferenceImage("");
        setPreviewUrl("");
        setState("camera");
    }, []);

    const handleEnroll = useCallback(async () => {
        if (!descriptor || descriptor.length !== 128) {
            setError("No valid face embedding captured");
            setState("error");
            return;
        }

        setState("enrolling");
        setError("");
        const embNorm = Math.sqrt(descriptor.reduce((s, v) => s + v * v, 0));
        console.log(`[kiosk-enroll] Enrolling: employeeId=${employeeId} embNorm=${embNorm.toFixed(4)} hasRefImage=${!!referenceImage}`);

        try {
            const res = await fetch("/api/face-recognition/enroll?action=enroll", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": currentUser.id || "system",
                    ...(process.env.NEXT_PUBLIC_KIOSK_API_KEY
                        ? { "x-kiosk-api-key": process.env.NEXT_PUBLIC_KIOSK_API_KEY }
                        : {}),
                },
                body: JSON.stringify({
                    employeeId,
                    embedding: descriptor,
                    referenceImage: referenceImage || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.ok) {
                setError(data.error || "Enrollment failed");
                setState("error");
                return;
            }

            stopCamera();
            setState("done");
            toast.success("Face enrolled successfully!");
            setTimeout(() => router.push("/kiosk/face"), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Network error");
            setState("error");
        }
    }, [descriptor, referenceImage, currentUser.id, stopCamera, router]);

    return (
        <div className={cn(
            "fixed inset-0 flex flex-col select-none overflow-auto",
            ks.kioskTheme === "midnight" ? "bg-slate-950" :
            ks.kioskTheme === "charcoal" ? "bg-neutral-950" : "bg-zinc-950"
        )}>
            {/* Ambient blob */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full blur-[130px] opacity-20 bg-violet-600" />
            </div>

            {/* Top bar */}
            <header className="relative z-10 w-full flex items-center justify-between px-4 sm:px-8 pt-4 sm:pt-6">
                <button onClick={() => router.push("/kiosk/face")} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors min-h-[44px]">
                    <ArrowLeft className="h-4 w-4" /><span className="text-sm">Back</span>
                </button>
                <div className="text-center">
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Face Enrollment</p>
                </div>
                <div className="w-16 sm:w-20" />
            </header>

            {/* Main content */}
            <main className="relative z-10 flex flex-col items-center justify-center gap-4 sm:gap-6 px-4 sm:px-6 flex-1 w-full max-w-md mx-auto py-4">

                {/* Loading models */}
                {state === "loading-models" && (
                    <div className="text-center space-y-4">
                        <Loader2 className="h-12 w-12 text-violet-400 animate-spin mx-auto" />
                        <p className="text-white/60 text-sm">Loading face recognition models...</p>
                        <p className="text-white/30 text-xs">This may take a few seconds on first load</p>
                    </div>
                )}

                {/* Done state */}
                {state === "done" && (
                    <div className="text-center space-y-4 animate-in zoom-in-90 duration-300">
                        <div className="h-20 w-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle className="h-10 w-10 text-emerald-400" />
                        </div>
                        <p className="text-2xl font-bold text-emerald-300">Face Enrolled!</p>
                        <p className="text-white/40 text-sm">Your face has been securely enrolled for recognition.</p>
                        <p className="text-white/30 text-xs">Redirecting to verification kiosk...</p>
                    </div>
                )}

                {/* Error state */}
                {state === "error" && (
                    <div className="text-center space-y-4">
                        <div className="h-20 w-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                            <XCircle className="h-10 w-10 text-red-400" />
                        </div>
                        <p className="text-lg font-bold text-red-300">Enrollment Failed</p>
                        <p className="text-white/40 text-sm">{error}</p>
                        <button onClick={() => { setDescriptor(null); setReferenceImage(""); setPreviewUrl(""); setState("idle"); setError(""); }}
                            className="px-6 py-3 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors min-h-[44px]">
                            <RotateCcw className="h-3.5 w-3.5 inline mr-2" />Start Over
                        </button>
                    </div>
                )}

                {/* Enrolling state */}
                {state === "enrolling" && (
                    <div className="text-center space-y-4">
                        <Loader2 className="h-12 w-12 text-violet-400 animate-spin mx-auto" />
                        <p className="text-white/60 text-sm">Enrolling your face...</p>
                    </div>
                )}

                {/* Idle / Camera / Scanning / Captured states */}
                {(state === "idle" || state === "camera" || state === "scanning" || state === "captured") && (
                    <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-4 sm:p-6 backdrop-blur-sm flex flex-col items-center gap-4 sm:gap-5 shadow-2xl w-full">
                        <div className="flex items-center gap-2">
                            <ScanFace className="h-4 w-4 text-violet-400/60" />
                            <p className="text-white/40 text-[11px] font-semibold uppercase tracking-widest">
                                Front Face Capture
                            </p>
                        </div>

                        <p className="text-white/60 text-sm text-center">
                            {state === "captured"
                                ? "Review your capture below, then enroll."
                                : "Look straight at the camera and press Scan."}
                        </p>

                        {/* Camera viewport */}
                        <div className="relative w-full aspect-[3/4] sm:aspect-[4/3] rounded-2xl overflow-hidden bg-black/50">
                            {state === "captured" && previewUrl ? (
                                <img // eslint-disable-line @next/next/no-img-element
                                    src={previewUrl}
                                    alt="Captured face"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <>
                                    <video
                                        ref={videoRef}
                                        className="w-full h-full object-cover"
                                        style={{ transform: "scaleX(-1)" }}
                                        playsInline
                                        muted
                                        autoPlay
                                    />
                                    {/* Oval face guide */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className={cn(
                                            "w-40 h-52 sm:w-48 sm:h-60 rounded-[50%] border-2 border-dashed transition-colors",
                                            state === "scanning" ? "border-amber-400 animate-pulse" : "border-white/20"
                                        )} />
                                    </div>
                                    {/* Scanning overlay */}
                                    {state === "scanning" && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                                            <Loader2 className="h-8 w-8 text-white animate-spin" />
                                            <p className="text-white/70 text-xs mt-2">Scanning face... {scanProgress}%</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Action buttons — min 44px height for mobile touch targets */}
                        <div className="w-full flex gap-3">
                            {state === "idle" && (
                                <button onClick={startCamera}
                                    className="flex-1 py-3.5 rounded-xl bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-bold transition-all min-h-[44px]">
                                    <Camera className="h-4 w-4 inline mr-2" />Open Camera
                                </button>
                            )}
                            {state === "camera" && (
                                <button onClick={handleScan}
                                    className="flex-1 py-3.5 rounded-xl bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-bold transition-all min-h-[44px]">
                                    <Camera className="h-4 w-4 inline mr-2" />Scan Face
                                </button>
                            )}
                            {state === "captured" && (
                                <>
                                    <button onClick={handleRetake}
                                        className="flex-1 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all min-h-[44px]">
                                        <RotateCcw className="h-3.5 w-3.5 inline mr-1.5" />Retake
                                    </button>
                                    <button onClick={handleEnroll}
                                        className="flex-1 py-3.5 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white text-sm font-bold transition-all min-h-[44px]">
                                        Enroll<ChevronRight className="h-4 w-4 inline ml-1" />
                                    </button>
                                </>
                            )}
                        </div>

                        {state === "idle" && (
                            <p className="text-white/25 text-[10px] text-center">
                                Your face will be scanned using multiple frames for accuracy.
                                Works best with good lighting and a clear front-facing view.
                            </p>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="relative z-10 w-full flex items-center justify-center pb-4 sm:pb-6">
                <div className="flex items-center gap-2 text-white/20 text-xs">
                    <span>{companyName || "Soren Data Solutions Inc."} • Face Enrollment</span>
                </div>
            </footer>
        </div>
    );
}
