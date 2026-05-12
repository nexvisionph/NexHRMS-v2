"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanFace, CheckCircle, Camera, CameraOff, ShieldAlert, Loader2 } from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────── */

export interface FaceVerificationResult {
    verified: boolean;
    confidence: string;
    reason: string;
}

interface FaceRecognitionProps {
    onVerified: (result?: FaceVerificationResult) => void;
    disabled?: boolean;
    variant?: "default" | "kiosk";
    countdownSeconds?: number;
    autoStart?: boolean;
    employeeName?: string;
    demoMode?: boolean;
}

/* ─── AI call ────────────────────────────────────────────────── */

async function verifyFaceWithAI(
    imageBase64: string,
    employeeName?: string,
): Promise<FaceVerificationResult> {
    try {
        const res = await fetch("/api/attendance/verify-face", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64, employeeName }),
        });
        if (!res.ok) return { verified: true, confidence: "low", reason: "AI service error — fallback allowed." };
        return await res.json();
    } catch {
        return { verified: true, confidence: "low", reason: "Network error — fallback allowed." };
    }
}

/* ─── Component ──────────────────────────────────────────────── */

export function FaceRecognitionSimulator({
    onVerified,
    disabled,
    variant = "default",
    countdownSeconds = 3,
    autoStart = false,
    employeeName,
    demoMode = false,
}: FaceRecognitionProps) {
    const isKiosk = variant === "kiosk";
    const [phase, setPhase] = useState<"idle" | "camera" | "scanning" | "verifying" | "verified" | "failed">("idle");
    const [countdown, setCountdown] = useState(countdownSeconds);
    const [cameraError, setCameraError] = useState(false);
    const [aiResult, setAiResult] = useState<FaceVerificationResult | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startCamera = useCallback(async () => {
        setCameraError(false);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
            });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            setPhase("camera");
        } catch {
            setCameraError(true);
            setPhase("camera");
        }
    }, []);

    useEffect(() => {
        if (autoStart && phase === "idle" && !disabled) startCamera();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart]);

    useEffect(() => {
        return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
    }, []);

    const captureFrame = useCallback((): string | null => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return null;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.75);
    }, []);

    const startScan = useCallback(() => {
        setPhase("scanning");
        setCountdown(countdownSeconds);
    }, [countdownSeconds]);

    useEffect(() => {
        if (phase !== "scanning") return;
        if (countdown <= 0) {
            const imageData = captureFrame();
            streamRef.current?.getTracks().forEach((t) => t.stop());
            if (demoMode || !imageData) {
                const result: FaceVerificationResult = { verified: true, confidence: "demo", reason: "Demo mode — simulated verification." };
                setAiResult(result);
                setPhase("verified");
                onVerified(result);
                return;
            }
            setPhase("verifying");
            verifyFaceWithAI(imageData, employeeName).then((result) => {
                setAiResult(result);
                if (result.verified) { setPhase("verified"); onVerified(result); }
                else setPhase("failed");
            });
            return;
        }
        const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [phase, countdown, onVerified, captureFrame, demoMode, employeeName]);

    const retry = useCallback(() => {
        setPhase("idle");
        setAiResult(null);
        setCountdown(countdownSeconds);
        setCameraError(false);
    }, [countdownSeconds]);

    // ── Failed ───────────────────────────────────────────────────
    if (phase === "failed") {
        return (
            <Card className={`border border-red-500/30 ${isKiosk ? "bg-red-500/10 border-0 rounded-2xl" : "bg-red-500/5"}`}>
                <CardContent className="p-6 flex flex-col items-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-red-500/15 flex items-center justify-center">
                        <ShieldAlert className="h-8 w-8 text-red-500" />
                    </div>
                    <p className={`text-sm font-medium ${isKiosk ? "text-red-400" : "text-red-700 dark:text-red-400"}`}>
                        Face Verification Failed
                    </p>
                    <p className={`text-xs text-center ${isKiosk ? "text-white/50" : "text-muted-foreground"}`}>
                        {aiResult?.reason || "Could not verify your face."}
                    </p>
                    <Button onClick={retry} size="sm" variant="outline" className={isKiosk ? "text-white border-white/20 hover:bg-white/10" : ""}>
                        Try Again
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // ── Verifying (AI processing) ────────────────────────────────
    if (phase === "verifying") {
        return (
            <Card className={`border ${isKiosk ? "border-0 bg-white/[0.04] rounded-2xl" : "border-blue-500/30 bg-blue-500/5"}`}>
                <CardContent className="p-6 flex flex-col items-center gap-3">
                    <Loader2 className={`h-10 w-10 animate-spin ${isKiosk ? "text-blue-400" : "text-blue-500"}`} />
                    <p className={`text-sm font-medium ${isKiosk ? "text-white" : ""}`}>Verifying Face...</p>
                    <p className={`text-xs ${isKiosk ? "text-white/50" : "text-muted-foreground"}`}>AI liveness detection in progress</p>
                </CardContent>
            </Card>
        );
    }

    // ── Verified ─────────────────────────────────────────────────
    if (phase === "verified") {
        return (
            <Card className={`border border-emerald-500/30 ${isKiosk ? "bg-emerald-500/10 border-0 rounded-2xl" : "bg-emerald-500/5"}`}>
                <CardContent className="p-6 flex flex-col items-center gap-3">
                    <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                    </div>
                    <p className={`text-sm font-medium ${isKiosk ? "text-emerald-400" : "text-emerald-700 dark:text-emerald-400"}`}>Face Verified ✅</p>
                    <p className={`text-xs ${isKiosk ? "text-white/50" : "text-muted-foreground"}`}>
                        {aiResult?.confidence === "demo" ? "Identity confirmed (demo mode)" : `AI confidence: ${aiResult?.confidence || "high"}`}
                    </p>
                </CardContent>
            </Card>
        );
    }

    // ── Camera / Scanning ─────────────────────────────────────────
    if (phase === "camera" || phase === "scanning") {
        return (
            <Card className={`overflow-hidden ${isKiosk ? "border-0 bg-white/[0.04] rounded-2xl" : "border border-border/50"}`}>
                <CardContent className="p-0">
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="relative w-full bg-black" style={{ aspectRatio: "4/3", maxHeight: "260px" }}>
                        {!cameraError ? (
                            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-800">
                                <ScanFace className="h-20 w-20 text-neutral-600" />
                            </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className={`relative w-32 h-40 rounded-full border-2 transition-colors duration-500 ${phase === "scanning" ? "border-emerald-400" : "border-white/50"}`}>
                                {["top-left", "top-right", "bottom-left", "bottom-right"].map((corner) => (
                                    <div key={corner} className={`absolute w-5 h-5 border-2 transition-colors duration-300
                      ${corner.includes("top") ? "top-0" : "bottom-0"} ${corner.includes("left") ? "left-0" : "right-0"}
                      ${corner.includes("top") && corner.includes("left") ? "border-t-2 border-l-2 rounded-tl" : ""}
                      ${corner.includes("top") && corner.includes("right") ? "border-t-2 border-r-2 rounded-tr" : ""}
                      ${corner.includes("bottom") && corner.includes("left") ? "border-b-2 border-l-2 rounded-bl" : ""}
                      ${corner.includes("bottom") && corner.includes("right") ? "border-b-2 border-r-2 rounded-br" : ""}
                      ${phase === "scanning" ? "border-emerald-400" : "border-white/70"}`} />
                                ))}
                            </div>
                        </div>
                        {phase === "scanning" && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                <div className="absolute left-0 right-0 h-0.5 bg-emerald-400/60 animate-bounce" style={{ animation: "scanSweep 1s ease-in-out infinite" }} />
                            </div>
                        )}
                        {phase === "scanning" && (
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                                <div className="bg-black/60 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-white text-sm font-medium">Scanning... {countdown}s</span>
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
                        {cameraError && (
                            <div className="absolute top-3 left-3">
                                <div className="flex items-center gap-1 bg-amber-500/80 backdrop-blur-sm rounded px-2 py-1">
                                    <CameraOff className="h-3 w-3 text-white" />
                                    <span className="text-white text-[10px] font-medium">Camera unavailable</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 flex flex-col items-center gap-2">
                        {phase === "camera" && (
                            <Button onClick={startScan} className={`w-full gap-1.5 ${isKiosk ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`} size="sm">
                                <ScanFace className="h-4 w-4" /> Scan My Face
                            </Button>
                        )}
                        {phase === "scanning" && (
                            <p className={`text-xs ${isKiosk ? "text-white/50" : "text-muted-foreground"}`}>Please hold still...</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ── Idle ──────────────────────────────────────────────────────
    return (
        <Card className={`${isKiosk ? "border-0 bg-white/[0.04] rounded-2xl" : "border border-border/50"}`}>
            <CardContent className="p-6 flex flex-col items-center gap-3">
                <canvas ref={canvasRef} className="hidden" />
                <div className={`h-16 w-16 rounded-full flex items-center justify-center ${isKiosk ? "bg-white/[0.06]" : "bg-muted"}`}>
                    <Camera className={`h-8 w-8 ${isKiosk ? "text-white/40" : "text-muted-foreground"}`} />
                </div>
                <p className={`text-sm font-medium ${isKiosk ? "text-white" : ""}`}>Face Recognition</p>
                <p className={`text-xs text-center ${isKiosk ? "text-white/50" : "text-muted-foreground"}`}>
                    AI-powered face verification with liveness detection
                </p>
                <Button onClick={startCamera} disabled={disabled}
                    className={`gap-1.5 mt-1 ${isKiosk ? "bg-white/10 hover:bg-white/15 text-white border-0" : ""}`}>
                    <Camera className="h-4 w-4" /> Open Camera
                </Button>
            </CardContent>
        </Card>
    );
}
