"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { loadFaceModels, detectFace, averageDescriptors } from "@/lib/face-api";
import { toast } from "sonner";
import {
    ArrowLeft, Camera, CheckCircle, XCircle, Loader2, RotateCcw,
    ScanFace, ChevronRight,
} from "lucide-react";

// Neon theme colors
const NEON_GREEN = "#39FF14";
const NEON_GREEN_DIM = "rgba(57, 255, 20, 0.6)";

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

    // PIN verification — redirect if not verified; guard browser back
    useEffect(() => {
        const verified = sessionStorage.getItem("kiosk-pin-verified");
        const verifiedTime = sessionStorage.getItem("kiosk-pin-verified-time");
        if (!verified || !verifiedTime) { router.replace("/kiosk"); return; }
        const elapsed = Date.now() - parseInt(verifiedTime);
        if (elapsed > 5 * 60 * 1000) {
            sessionStorage.removeItem("kiosk-pin-verified");
            sessionStorage.removeItem("kiosk-pin-verified-time");
            router.replace("/kiosk");
            return;
        }
        window.history.pushState({ kioskGuard: true }, "");
        const handlePopState = () => {
            router.replace("/kiosk/face");
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
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
            setTimeout(() => router.replace("/kiosk/face"), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Network error");
            setState("error");
        }
    }, [descriptor, referenceImage, currentUser.id, employeeId, stopCamera, router]);

    return (
        <div className="fixed inset-0 flex flex-col select-none overflow-auto bg-black">
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
                        background: `linear-gradient(135deg, ${NEON_GREEN}40 0%, ${NEON_GREEN}10 100%)`,
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
                        background: `linear-gradient(315deg, ${NEON_GREEN}30 0%, transparent 70%)`,
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
                    onClick={() => router.replace("/kiosk/face")} 
                    className="flex items-center gap-2 text-white/50 hover:text-white transition-colors min-h-[44px]"
                    style={{ fontSize: "clamp(0.75rem, 1.2vw, 0.875rem)" }}
                >
                    <ArrowLeft className="h-4 w-4" /><span>Back</span>
                </button>
                <div className="text-center">
                    <p 
                        className="font-semibold uppercase tracking-widest"
                        style={{ 
                            fontSize: "clamp(0.6rem, 1vw, 0.75rem)",
                            color: NEON_GREEN,
                            textShadow: `0 0 10px ${NEON_GREEN_DIM}`,
                        }}
                    >
                        Face Enrollment
                    </p>
                </div>
                <div className="w-16 sm:w-20" />
            </header>

            {/* Main content */}
            <main 
                className="relative z-10 flex flex-col items-center justify-center flex-1 w-full mx-auto"
                style={{
                    gap: "clamp(1rem, 3vh, 1.5rem)",
                    padding: "clamp(1rem, 2vh, 1.5rem) clamp(1rem, 3vw, 2rem)",
                    maxWidth: "min(480px, 95vw)",
                }}
            >

                {/* Loading models */}
                {state === "loading-models" && (
                    <div className="text-center space-y-4">
                        <Loader2 style={{ color: NEON_GREEN }} className="h-12 w-12 animate-spin mx-auto" />
                        <p className="text-white/60 text-sm">Loading face recognition models...</p>
                        <p className="text-white/30 text-xs">This may take a few seconds on first load</p>
                    </div>
                )}

                {/* Done state */}
                {state === "done" && (
                    <div className="text-center space-y-4 animate-in zoom-in-90 duration-300">
                        <div 
                            className="mx-auto rounded-full flex items-center justify-center"
                            style={{
                                width: "clamp(70px, 12vw, 100px)",
                                height: "clamp(70px, 12vw, 100px)",
                                background: `radial-gradient(circle, ${NEON_GREEN}30 0%, transparent 70%)`,
                                boxShadow: `0 0 60px ${NEON_GREEN}40`,
                            }}
                        >
                            <CheckCircle style={{ color: NEON_GREEN, width: "clamp(35px, 6vw, 50px)", height: "clamp(35px, 6vw, 50px)" }} />
                        </div>
                        <p 
                            className="font-bold"
                            style={{ 
                                fontSize: "clamp(1.5rem, 4vw, 2rem)",
                                color: NEON_GREEN,
                                textShadow: `0 0 20px ${NEON_GREEN_DIM}`,
                            }}
                        >
                            Face Enrolled!
                        </p>
                        <p className="text-white/40 text-sm">Your face has been securely enrolled for recognition.</p>
                        <p className="text-white/30 text-xs">Redirecting to verification kiosk...</p>
                    </div>
                )}

                {/* Error state */}
                {state === "error" && (
                    <div className="text-center space-y-4">
                        <div 
                            className="mx-auto rounded-full flex items-center justify-center"
                            style={{
                                width: "clamp(70px, 12vw, 100px)",
                                height: "clamp(70px, 12vw, 100px)",
                                background: "radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, transparent 70%)",
                                boxShadow: "0 0 60px rgba(239, 68, 68, 0.4)",
                            }}
                        >
                            <XCircle style={{ color: "#ef4444", width: "clamp(35px, 6vw, 50px)", height: "clamp(35px, 6vw, 50px)" }} />
                        </div>
                        <p className="text-lg font-bold text-red-400">Enrollment Failed</p>
                        <p className="text-white/40 text-sm">{error}</p>
                        <button 
                            onClick={() => { setDescriptor(null); setReferenceImage(""); setPreviewUrl(""); setState("idle"); setError(""); }}
                            className="rounded-xl text-white text-sm transition-all min-h-[44px]"
                            style={{
                                padding: "clamp(0.75rem, 2vh, 1rem) clamp(1.5rem, 4vw, 2rem)",
                                background: `linear-gradient(135deg, ${NEON_GREEN}30 0%, ${NEON_GREEN}10 100%)`,
                                border: `1px solid ${NEON_GREEN}40`,
                            }}
                        >
                            <RotateCcw className="h-3.5 w-3.5 inline mr-2" style={{ color: NEON_GREEN }} />Start Over
                        </button>
                    </div>
                )}

                {/* Enrolling state */}
                {state === "enrolling" && (
                    <div className="text-center space-y-4">
                        <Loader2 style={{ color: NEON_GREEN }} className="h-12 w-12 animate-spin mx-auto" />
                        <p className="text-white/60 text-sm">Enrolling your face...</p>
                    </div>
                )}

                {/* Idle / Camera / Scanning / Captured states */}
                {(state === "idle" || state === "camera" || state === "scanning" || state === "captured") && (
                    <div 
                        className="backdrop-blur-xl flex flex-col items-center w-full"
                        style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            border: `1px solid ${NEON_GREEN}15`,
                            borderRadius: "clamp(1.25rem, 3vw, 1.5rem)",
                            padding: "clamp(1rem, 3vh, 1.5rem)",
                            gap: "clamp(1rem, 2.5vh, 1.25rem)",
                            boxShadow: `0 0 40px ${NEON_GREEN}08`,
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <ScanFace style={{ color: `${NEON_GREEN}99` }} className="h-4 w-4" />
                            <p 
                                className="font-semibold uppercase tracking-widest"
                                style={{ 
                                    fontSize: "clamp(0.6rem, 1vw, 0.7rem)",
                                    color: `${NEON_GREEN}99`,
                                }}
                            >
                                Front Face Capture
                            </p>
                        </div>

                        <p 
                            className="text-center"
                            style={{
                                fontSize: "clamp(0.75rem, 1.2vw, 0.875rem)",
                                color: "rgba(255, 255, 255, 0.6)",
                            }}
                        >
                            {state === "captured"
                                ? "Review your capture below, then enroll."
                                : "Look straight at the camera and press Scan."}
                        </p>

                        {/* Camera viewport */}
                        <div 
                            className="relative w-full overflow-hidden"
                            style={{
                                aspectRatio: "3/4",
                                borderRadius: "clamp(0.75rem, 2vw, 1rem)",
                                background: "rgba(0, 0, 0, 0.5)",
                                border: `1px solid ${NEON_GREEN}20`,
                            }}
                        >
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
                                        <div 
                                            className="rounded-[50%] border-2 border-dashed transition-colors"
                                            style={{
                                                width: "clamp(8rem, 30vw, 12rem)",
                                                height: "clamp(11rem, 40vw, 15rem)",
                                                borderColor: state === "scanning" ? NEON_GREEN : "rgba(255, 255, 255, 0.2)",
                                                boxShadow: state === "scanning" ? `0 0 30px ${NEON_GREEN}40` : "none",
                                                animation: state === "scanning" ? "pulse 2s infinite" : "none",
                                            }}
                                        />
                                    </div>
                                    {/* Scanning overlay */}
                                    {state === "scanning" && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                                            <Loader2 className="h-8 w-8 animate-spin" style={{ color: NEON_GREEN }} />
                                            <p className="text-white/70 text-xs mt-2">Scanning face... {scanProgress}%</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Action buttons — min 44px height for mobile touch targets */}
                        <div className="w-full flex" style={{ gap: "clamp(0.5rem, 1.5vw, 0.75rem)" }}>
                            {state === "idle" && (
                                <button 
                                    onClick={startCamera}
                                    className="flex-1 rounded-xl text-white text-sm font-bold transition-all min-h-[44px]"
                                    style={{
                                        padding: "clamp(0.75rem, 2vh, 1rem)",
                                        background: `linear-gradient(135deg, ${NEON_GREEN} 0%, ${NEON_GREEN}bb 100%)`,
                                        boxShadow: `0 0 30px ${NEON_GREEN}40`,
                                        color: "#000",
                                    }}
                                >
                                    <Camera className="h-4 w-4 inline mr-2" />Open Camera
                                </button>
                            )}
                            {state === "camera" && (
                                <button 
                                    onClick={handleScan}
                                    className="flex-1 rounded-xl text-sm font-bold transition-all min-h-[44px]"
                                    style={{
                                        padding: "clamp(0.75rem, 2vh, 1rem)",
                                        background: `linear-gradient(135deg, ${NEON_GREEN} 0%, ${NEON_GREEN}bb 100%)`,
                                        boxShadow: `0 0 30px ${NEON_GREEN}40`,
                                        color: "#000",
                                    }}
                                >
                                    <Camera className="h-4 w-4 inline mr-2" />Scan Face
                                </button>
                            )}
                            {state === "captured" && (
                                <>
                                    <button 
                                        onClick={handleRetake}
                                        className="flex-1 rounded-xl text-white text-sm font-medium transition-all min-h-[44px]"
                                        style={{
                                            padding: "clamp(0.75rem, 2vh, 1rem)",
                                            background: `${NEON_GREEN}15`,
                                            border: `1px solid ${NEON_GREEN}30`,
                                        }}
                                    >
                                        <RotateCcw className="h-3.5 w-3.5 inline mr-1.5" style={{ color: NEON_GREEN }} />Retake
                                    </button>
                                    <button 
                                        onClick={handleEnroll}
                                        className="flex-1 rounded-xl text-sm font-bold transition-all min-h-[44px]"
                                        style={{
                                            padding: "clamp(0.75rem, 2vh, 1rem)",
                                            background: `linear-gradient(135deg, ${NEON_GREEN} 0%, ${NEON_GREEN}bb 100%)`,
                                            boxShadow: `0 0 30px ${NEON_GREEN}40`,
                                            color: "#000",
                                        }}
                                    >
                                        Enroll<ChevronRight className="h-4 w-4 inline ml-1" />
                                    </button>
                                </>
                            )}
                        </div>

                        {state === "idle" && (
                            <p 
                                className="text-center"
                                style={{
                                    fontSize: "clamp(0.55rem, 0.9vw, 0.625rem)",
                                    color: "rgba(255, 255, 255, 0.25)",
                                }}
                            >
                                Your face will be scanned using multiple frames for accuracy.
                                Works best with good lighting and a clear front-facing view.
                            </p>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer 
                className="relative z-10 w-full flex items-center justify-center"
                style={{ padding: "clamp(1rem, 2vh, 1.5rem)" }}
            >
                <div 
                    className="flex items-center gap-2"
                    style={{ 
                        fontSize: "clamp(0.6rem, 1vw, 0.75rem)",
                        color: "rgba(255, 255, 255, 0.3)",
                    }}
                >
                    <span 
                        className="animate-pulse rounded-full"
                        style={{
                            width: "6px",
                            height: "6px",
                            background: NEON_GREEN,
                            boxShadow: `0 0 10px ${NEON_GREEN}`,
                        }}
                    />
                    <span>{companyName || "Soren Data Solutions Inc."} • Face Enrollment</span>
                </div>
            </footer>
        </div>
    );
}
