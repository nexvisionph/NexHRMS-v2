"use client";

/**
 * ProjectQrScanner
 *
 * A mobile-first QR scanner for project attendance check-in.
 * Uses BarcodeDetector API (Chrome/Safari) with jsQR canvas-loop fallback.
 *
 * When a QR is decoded:
 *  - If the value looks like a URL (starts with "http"), it extracts the `qr`
 *    search param so the handler receives the raw signed payload.
 *  - Otherwise passes the raw decoded string to onScanned.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsQR from "jsqr";
import { canUseCamera, cameraHttpsHint } from "@/lib/camera-context";

interface ProjectQrScannerProps {
  onScanned: (payload: string) => void;
  onCancel: () => void;
}

type ScannerState = "requesting" | "scanning" | "error";

export function ProjectQrScanner({ onScanned, onCancel }: ProjectQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const calledRef = useRef(false); // prevent double-fire

  const [scannerState, setScannerState] = useState<ScannerState>("requesting");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const stopStream = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const handleDecoded = useCallback(
    (raw: string) => {
      if (calledRef.current) return;
      calledRef.current = true;
      stopStream();

      // Extract payload from URL if the QR encodes a deep-link
      let payload = raw;
      if (raw.startsWith("http")) {
        try {
          const url = new URL(raw);
          const qrParam = url.searchParams.get("qr");
          if (qrParam) payload = qrParam;
        } catch {
          // not a valid URL — use raw
        }
      }
      onScanned(payload);
    },
    [onScanned, stopStream],
  );

  // jsQR canvas-loop fallback
  const startJsQrLoop = useCallback(
    (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const tick = () => {
        if (video.readyState >= video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code?.data) {
            handleDecoded(code.data);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [handleDecoded],
  );

  // BarcodeDetector (modern) — with jsQR fallback
  const startBarcodeDetectorLoop = useCallback(
    (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BD = (window as any).BarcodeDetector as {
        new (init: { formats: string[] }): {
          detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
        };
      } | undefined;

      if (!BD) {
        startJsQrLoop(video, canvas);
        return;
      }

      const detector = new BD({ formats: ["qr_code"] });

      const tick = async () => {
        if (video.readyState >= video.HAVE_ENOUGH_DATA) {
          try {
            const results = await detector.detect(video);
            if (results.length > 0 && results[0].rawValue) {
              handleDecoded(results[0].rawValue);
              return;
            }
          } catch {
            // BarcodeDetector failed — fall back to jsQR
            startJsQrLoop(video, canvas);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [handleDecoded, startJsQrLoop],
  );

  useEffect(() => {
    let cancelled = false;

    async function initCamera() {
      try {
        if (!canUseCamera(window)) {
          throw new Error(cameraHttpsHint());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        const canvas = canvasRef.current!;
        video.srcObject = stream;
        await video.play();
        setScannerState("scanning");
        startBarcodeDetectorLoop(video, canvas);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error && err.message.includes("HTTPS")
            ? err.message
            : err instanceof DOMException && err.name === "NotAllowedError"
            ? "Camera permission denied. Allow camera access to scan the QR code."
            : "Could not access camera. Please ensure no other app is using it.";
        setErrorMsg(msg);
        setScannerState("error");
      }
    }

    void initCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [startBarcodeDetectorLoop, stopStream]);

  const handleCancel = () => {
    stopStream();
    onCancel();
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {scannerState === "requesting" && (
        <div className="flex flex-col items-center gap-2 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Requesting camera access…</p>
        </div>
      )}

      {scannerState === "error" && (
        <div className="flex flex-col items-center gap-2 py-8">
          <XCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive text-center">{errorMsg}</p>
        </div>
      )}

      {/* Video element — always rendered so the ref is valid */}
      <div className={`relative w-full max-w-xs ${scannerState !== "scanning" ? "hidden" : ""}`}>
        {/* Corner guide overlay */}
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          <div className="relative w-48 h-48">
            {/* TL */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-sm" />
            {/* TR */}
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-sm" />
            {/* BL */}
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-sm" />
            {/* BR */}
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-sm" />
          </div>
        </div>

        <video
          ref={videoRef}
          className="w-full rounded-lg object-cover aspect-square bg-black"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute bottom-0 left-0 right-0 text-center pb-2">
          <span className="text-xs text-white drop-shadow bg-black/40 px-2 py-0.5 rounded-full">
            <Camera className="inline h-3 w-3 mr-1" />
            Point at the QR code
          </span>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={handleCancel}>
        Cancel
      </Button>
    </div>
  );
}
