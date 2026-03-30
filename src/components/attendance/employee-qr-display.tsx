"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, RefreshCw, CheckCircle } from "lucide-react";

interface EmployeeQRDisplayProps {
  employeeId: string;
  employeeName?: string;
  onCheckedIn?: () => void;
}

/**
 * Fetches the daily QR payload for an employee and renders it as a scannable QR code.
 * The employee shows this QR on their phone to the admin kiosk camera for check-in.
 */
export function EmployeeQRDisplay({ employeeId, employeeName, onCheckedIn }: EmployeeQRDisplayProps) {
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQR = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attendance/daily-qr?employeeId=${encodeURIComponent(employeeId)}`);
      if (!res.ok) throw new Error("Failed to generate QR code");
      const data = await res.json();
      setQrPayload(data.payload);
    } catch {
      setError("Could not generate your QR code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQR();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // Auto-refresh QR at midnight when the daily payload expires
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    const timer = setTimeout(() => fetchQR(), msUntilMidnight + 1000); // +1s buffer
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrPayload]);

  if (loading) {
    return (
      <Card className="border border-border/50">
        <CardContent className="p-6 flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full border-4 border-cyan-500/30 border-t-cyan-500 animate-spin" />
          <p className="text-sm font-medium">Generating your QR code...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !qrPayload) {
    return (
      <Card className="border border-red-500/30 bg-red-500/5">
        <CardContent className="p-6 flex flex-col items-center gap-3">
          <QrCode className="h-8 w-8 text-red-500" />
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{error || "QR code unavailable"}</p>
          <Button variant="outline" size="sm" onClick={fetchQR} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-cyan-500/30 bg-cyan-500/5">
      <CardContent className="p-6 flex flex-col items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-cyan-500/10 flex items-center justify-center">
          <QrCode className="h-7 w-7 text-cyan-500" />
        </div>
        <p className="text-sm font-semibold">Your Daily QR Code</p>
        <div className="bg-white p-3 rounded-xl shadow-sm">
          <QRCodeSVG value={qrPayload} size={200} level="M" />
        </div>
        {employeeName && (
          <p className="text-xs text-muted-foreground">{employeeName}</p>
        )}
        <p className="text-xs text-muted-foreground text-center max-w-[250px]">
          Show this QR code to the admin kiosk camera to complete your check-in.
        </p>
        {onCheckedIn && (
          <Button size="sm" variant="outline" onClick={onCheckedIn} className="gap-1.5 mt-1">
            <CheckCircle className="h-4 w-4" /> I&apos;ve Scanned at Kiosk
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
