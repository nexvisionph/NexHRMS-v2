"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { MapPin, CheckCircle, XCircle, Loader2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Step = "loading" | "locating" | "submitting" | "success" | "error";

interface CheckinResult {
  eventType: "IN" | "OUT";
  time: string;
  projectName: string;
  employeeName: string;
}

export default function CheckinPage() {
  const searchParams = useSearchParams();
  const qrParam = searchParams.get("qr");

  const [step, setStep] = useState<Step>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [result, setResult] = useState<CheckinResult | null>(null);

  useEffect(() => {
    if (!qrParam) {
      setErrorMsg("No QR code found in URL. Please scan the QR sticker again.");
      setStep("error");
      return;
    }

    // Check authentication status
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // Redirect to login with this URL as the next param
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
        return;
      }
      // Authenticated — get location then check in
      setStep("locating");
      getLocationAndCheckin(qrParam);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrParam]);

  function getLocationAndCheckin(payload: string) {
    if (!navigator.geolocation) {
      setErrorMsg("Your browser does not support GPS location, which is required for project check-in.");
      setStep("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        doCheckin(payload, location);
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Please allow location access and scan again."
            : err.code === err.TIMEOUT
            ? "GPS timed out. Move to an area with better signal and scan again."
            : "Could not get your location. Please try again.";
        setErrorMsg(msg);
        setStep("error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function doCheckin(payload: string, location: { lat: number; lng: number; accuracy?: number }) {
    setStep("submitting");
    try {
      const res = await fetch("/api/attendance/project-qr-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, location }),
      });
      const data = await res.json() as {
        ok: boolean;
        error?: string;
        eventType?: "IN" | "OUT";
        time?: string;
        projectName?: string;
        employeeName?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMsg(data.error ?? "Check-in failed. Please try again.");
        setStep("error");
        return;
      }

      setResult({
        eventType: data.eventType!,
        time: data.time!,
        projectName: data.projectName!,
        employeeName: data.employeeName!,
      });
      setStep("success");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStep("error");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <QrCode className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-lg">Project Check-In</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {step === "loading" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Verifying your session…</p>
            </>
          )}

          {step === "locating" && (
            <>
              <MapPin className="h-8 w-8 text-primary mx-auto animate-pulse" />
              <p className="text-sm text-muted-foreground">Getting your location…</p>
              <p className="text-xs text-muted-foreground">Please allow location access when prompted.</p>
            </>
          )}

          {step === "submitting" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Recording attendance…</p>
            </>
          )}

          {step === "success" && result && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <p className="text-xl font-semibold text-green-600">
                  {result.eventType === "IN" ? "Checked In!" : "Checked Out!"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{result.time}</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-left text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Employee</span>
                  <span className="font-medium">{result.employeeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project</span>
                  <span className="font-medium">{result.projectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Event</span>
                  <span className="font-medium">{result.eventType}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">You can close this page.</p>
            </>
          )}

          {step === "error" && (
            <>
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-sm font-medium text-destructive">Check-In Failed</p>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (qrParam) {
                    setStep("locating");
                    getLocationAndCheckin(qrParam);
                  }
                }}
              >
                Try Again
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
