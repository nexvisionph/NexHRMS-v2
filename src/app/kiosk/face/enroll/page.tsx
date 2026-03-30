"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
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
 * Face Enrollment Wizard — 3-step capture with real face-api.js embeddings
 *
 * Step 1: Front-facing capture → 128-d descriptor
 * Step 2: Left-angle capture → 128-d descriptor
 * Step 3: Right-angle capture → 128-d descriptor
 *
 * All 3 descriptors are averaged into a single robust embedding,
 * then sent to the server for storage (no images leave the browser).
 */

const STEPS = [
    { label: "Front", instruction: "Look straight at the camera" },
    { label: "Left", instruction: "Turn your head slightly to the left" },
    { label: "Right", instruction: "Turn your head slightly to the right" },
] as const;

type EnrollState = "loading-models" | "idle" | "camera" | "countdown" | "detecting" | "captured" | "enrolling" | "done" | "error";

export default function FaceEnrollPage() {
    const router = useRouter();
    const currentUser = useAuthStore((s) => s.currentUser);
    const companyName = useAppearanceStore((s) => s.companyName);
    const ks = useKioskStore((s) => s.settings);

    const [step, setStep] = useState(0);
    const [state, setState] = useState<EnrollState>("loading-models");
    const [descriptors, setDescriptors] = useState<number[][]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [countdown, setCountdown] = useState(3);
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
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setState("camera");
        } catch {
            setError("Camera access denied. Please allow camera permission.");
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

    const captureAndDetect = useCallback(async () => {
        setState("detecting");

        if (!videoRef.current || !canvasRef.current) {
            setError("Camera not available");
            setState("error");
            return;
        }

        // Draw current frame to canvas for preview
        const canvas = canvasRef.current;
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
        }
        const previewUrl = canvas.toDataURL("image/jpeg", 0.85);

        // Detect face and get 128-d descriptor from the VIDEO element
        const result = await detectFace(videoRef.current);

        if (!result) {
            toast.error("No face detected. Please position your face clearly and try again.");
            setState("camera");
            return;
        }

        if (result.score < 0.7) {
            toast.error("Low confidence detection. Please improve lighting and try again.");
            setState("camera");
            return;
        }

        // Store descriptor and preview
        setDescriptors((prev) => [...prev, result.descriptor]);
        setPreviews((prev) => [...prev, previewUrl]);
        setState("captured");
        toast.success(`Face detected (confidence: ${(result.score * 100).toFixed(0)}%)`);
    }, []);

    const beginCapture = useCallback(() => {
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
    }, [captureAndDetect]);

    const handleRetake = useCallback(() => {
        setDescriptors((prev) => prev.slice(0, -1));
        setPreviews((prev) => prev.slice(0, -1));
        setState("camera");
    }, []);

    const handleEnroll = useCallback(async () => {
        setState("enrolling");
        setError("");
        try {
            // Average the 3 descriptors into one robust embedding
            const avgEmbedding = averageDescriptors(descriptors);

            if (avgEmbedding.length !== 128) {
                setError("Failed to compute face embedding");
                setState("error");
                return;
            }

            const res = await fetch("/api/face-recognition/enroll?action=enroll", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-user-id": currentUser.id || "system",
                },
                body: JSON.stringify({
                    employeeId: currentUser.id || "EMP001",
                    embedding: avgEmbedding,
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
    }, [descriptors, currentUser.id, stopCamera, router]);

    const handleNext = useCallback(() => {
        if (step < 2) {
            setStep((s) => s + 1);
            setState("camera");
        } else {
            handleEnroll();
        }
    }, [step, handleEnroll]);

    const currentStep = STEPS[step];

    return (
        <div className={cn(
            "fixed inset-0 flex flex-col select-none",
            ks.kioskTheme === "midnight" ? "bg-slate-950" :
            ks.kioskTheme === "charcoal" ? "bg-neutral-950" : "bg-zinc-950"
        )}>
            {/* Ambient blob */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -left-40 w-[550px] h-[550px] rounded-full blur-[130px] opacity-20 bg-violet-600" />
            </div>

            {/* Top bar */}
            <header className="relative z-10 w-full flex items-center justify-between px-8 pt-6">
                <button onClick={() => router.push("/kiosk/face")} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors">
                    <ArrowLeft className="h-4 w-4" /><span className="text-sm">Back</span>
                </button>
                <div className="text-center">
                    <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Face Enrollment</p>
                </div>
                <div className="w-20" />
            </header>

            {/* Progress steps */}
            <div className="relative z-10 flex items-center justify-center gap-3 mt-6 px-8">
                {STEPS.map((s, i) => (
                    <div key={s.label} className="flex items-center gap-2">
                        <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                            i < step ? "bg-emerald-500 text-white" :
                            i === step ? "bg-violet-500 text-white" : "bg-white/10 text-white/30"
                        )}>
                            {i < step ? <CheckCircle className="h-4 w-4" /> : i + 1}
                        </div>
                        <span className={cn("text-xs font-medium", i <= step ? "text-white/70" : "text-white/20")}>{s.label}</span>
                        {i < 2 && <ChevronRight className="h-3 w-3 text-white/15 mx-1" />}
                    </div>
                ))}
            </div>

            {/* Main content */}
            <main className="relative z-10 flex flex-col items-center justify-center gap-6 px-6 flex-1 w-full max-w-md mx-auto">

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
                        <p className="text-white/40 text-sm">Your 128-dimensional face signature has been securely stored.</p>
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
                        <button onClick={() => { setDescriptors([]); setPreviews([]); setStep(0); setState("idle"); setError(""); }} className="px-6 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors">
                            <RotateCcw className="h-3.5 w-3.5 inline mr-2" />Start Over
                        </button>
                    </div>
                )}

                {/* Enrolling state */}
                {state === "enrolling" && (
                    <div className="text-center space-y-4">
                        <Loader2 className="h-12 w-12 text-violet-400 animate-spin mx-auto" />
                        <p className="text-white/60 text-sm">Computing average embedding from {descriptors.length} captures...</p>
                    </div>
                )}

                {/* Detecting face */}
                {state === "detecting" && (
                    <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-6 backdrop-blur-sm flex flex-col items-center gap-5 shadow-2xl w-full">
                        <Loader2 className="h-8 w-8 text-violet-400 animate-spin" />
                        <p className="text-white/60 text-sm">Detecting face & computing embedding...</p>
                    </div>
                )}

                {/* Idle / Camera / Countdown / Captured states */}
                {(state === "idle" || state === "camera" || state === "countdown" || state === "captured") && (
                    <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-6 backdrop-blur-sm flex flex-col items-center gap-5 shadow-2xl w-full">
                        <div className="flex items-center gap-2">
                            <ScanFace className="h-4 w-4 text-violet-400/60" />
                            <p className="text-white/40 text-[11px] font-semibold uppercase tracking-widest">
                                Step {step + 1}: {currentStep.label}
                            </p>
                        </div>

                        <p className="text-white/60 text-sm text-center">{currentStep.instruction}</p>

                        {/* Camera viewport */}
                        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black/50">
                            {state === "captured" && previews[step] ? (
                                <img // eslint-disable-line @next/next/no-img-element
                                    src={previews[step]}
                                    alt={`Capture ${step + 1}`}
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
                                    />
                                    {/* Oval guide overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className={cn(
                                            "w-48 h-60 rounded-[50%] border-2 border-dashed transition-colors",
                                            state === "countdown" ? "border-amber-400" : "border-white/20"
                                        )} />
                                    </div>
                                    {state === "countdown" && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                            <span className="text-6xl font-bold text-white drop-shadow-lg animate-pulse">{countdown}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Action buttons */}
                        <div className="w-full flex gap-3">
                            {state === "idle" && (
                                <button onClick={startCamera} className="flex-1 py-3 rounded-xl bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-bold transition-all">
                                    <Camera className="h-4 w-4 inline mr-2" />Open Camera
                                </button>
                            )}
                            {state === "camera" && (
                                <button onClick={beginCapture} className="flex-1 py-3 rounded-xl bg-violet-500/80 hover:bg-violet-500 text-white text-sm font-bold transition-all">
                                    <Camera className="h-4 w-4 inline mr-2" />Capture
                                </button>
                            )}
                            {state === "captured" && (
                                <>
                                    <button onClick={handleRetake} className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all">
                                        <RotateCcw className="h-3.5 w-3.5 inline mr-1.5" />Retake
                                    </button>
                                    <button onClick={handleNext} className="flex-1 py-3 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white text-sm font-bold transition-all">
                                        {step < 2 ? "Next" : "Enroll"}<ChevronRight className="h-4 w-4 inline ml-1" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Embedding info */}
                        {state === "captured" && descriptors[step] && (
                            <p className="text-white/20 text-[10px] text-center">
                                128-d descriptor captured (score: {(descriptors[step][0] * 100).toFixed(0)}...)
                            </p>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="relative z-10 w-full flex items-center justify-center pb-6">
                <div className="flex items-center gap-2 text-white/20 text-xs">
                    <span>{companyName || "NexHRMS"} • Embeddings computed locally via face-api.js</span>
                </div>
            </footer>
        </div>
    );
}
