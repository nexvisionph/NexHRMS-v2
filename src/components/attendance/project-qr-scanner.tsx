"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { validateProjectQR, type ProjectQRPayload } from "@/lib/project-qr";
import { useProjectsStore } from "@/store/projects.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { getDistanceMeters } from "@/lib/geofence";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Camera, CheckCircle, XCircle, MapPin, AlertTriangle } from "lucide-react";

interface ProjectQRScannerProps {
  employeeId: string;
  onSuccess?: (projectId: string) => void;
  onError?: (error: string) => void;
}

export function ProjectQRScanner({ employeeId, onSuccess, onError }: ProjectQRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; projectName?: string } | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  const projects = useProjectsStore((s) => s.projects);
  const appendEvent = useAttendanceStore((s) => s.appendEvent);

  // Get GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => {} // Silently fail — geofence check will handle it
      );
    }
  }, []);

  const startScanning = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
      }
    } catch {
      setResult({ success: false, message: "Camera access denied" });
    }
  }, []);

  const stopScanning = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  // Simulate QR scan (in production, use BarcodeDetector API or jsQR)
  const handleManualScan = async (qrData: string) => {
    stopScanning();

    const validation = await validateProjectQR(qrData);

    if (!validation.valid || !validation.payload) {
      setResult({ success: false, message: validation.error || "Invalid QR code" });
      onError?.(validation.error || "Invalid QR code");
      return;
    }

    const payload = validation.payload;

    // Find the project
    const project = projects.find((p) => p.id === payload.projectId);
    if (!project) {
      setResult({ success: false, message: "Project not found in system" });
      onError?.("Project not found");
      return;
    }

    // Check if employee is assigned to this project
    if (!project.assignedEmployeeIds.includes(employeeId)) {
      setResult({ success: false, message: "You are not assigned to this project" });
      onError?.("Not assigned to project");
      return;
    }

    // Geofence check (if location available and project has geofence)
    if (location && project.location) {
      const distance = getDistanceMeters(
        location.lat,
        location.lng,
        project.location.lat,
        project.location.lng
      );
      const radius = project.geofenceRadiusMeters || project.location.radius || 100;

      if (distance > radius) {
        setResult({
          success: false,
          message: `Outside geofence (${Math.round(distance)}m away, max ${radius}m)`,
        });
        onError?.("Outside geofence");
        return;
      }
    }

    // Record attendance event
    appendEvent({
      employeeId,
      eventType: "IN",
      timestampUTC: new Date().toISOString(),
      projectId: project.id,
      description: `Project QR check-in: ${project.name}`,
      metadata: location ? { gpsLat: location.lat, gpsLng: location.lng, gpsAccuracy: location.accuracy } : undefined,
    });

    setResult({ success: true, message: "Check-in successful!", projectName: project.name });
    onSuccess?.(project.id);
  };

  useEffect(() => {
    return () => stopScanning();
  }, [stopScanning]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Project QR Scanner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Camera View */}
        <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          {!scanning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-primary rounded-lg animate-pulse" />
            </div>
          )}
        </div>

        {/* Location Status */}
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" />
          {location ? (
            <span className="text-green-600">GPS active (±{Math.round(location.accuracy)}m)</span>
          ) : (
            <span className="text-yellow-600">Acquiring GPS...</span>
          )}
        </div>

        {/* Controls */}
        {!scanning ? (
          <Button onClick={startScanning} className="w-full">
            <Camera className="h-4 w-4 mr-2" />Start Scanning
          </Button>
        ) : (
          <Button onClick={stopScanning} variant="outline" className="w-full">
            Stop Scanning
          </Button>
        )}

        {/* Result */}
        {result && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${result.success ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"}`}>
            {result.success ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
            <div>
              <p className="font-medium">{result.message}</p>
              {result.projectName && <p className="text-sm opacity-80">Project: {result.projectName}</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
