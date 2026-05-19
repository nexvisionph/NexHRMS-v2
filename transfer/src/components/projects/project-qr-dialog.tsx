"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Printer, QrCode, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAppearanceStore } from "@/store/appearance.store";

/**
 * Project QR Dialog
 *
 * Fetches the signed QR payload from /api/projects/[id]/qr and renders it as a
 * permanent, downloadable, printable QR code. The payload is HMAC-signed so
 * even if the QR sticker is photographed and replayed, scans outside the
 * project's geofence are rejected by the server-side validator.
 */
interface ProjectQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

export function ProjectQrDialog({ open, onOpenChange, projectId, projectName }: ProjectQrDialogProps) {
  const [payload, setPayload] = useState<string | null>(null);
  const [checkinUrl, setCheckinUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const logoUrl = useAppearanceStore((s) => s.logoUrl);
  const companyName = useAppearanceStore((s) => s.companyName);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPayload(null);
    setCheckinUrl(null);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/qr`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPayload(data.payload as string);
        setCheckinUrl((data.checkinUrl as string) ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load QR");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, projectId]);

  const handleDownload = () => {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return toast.error("QR not ready");
    try {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `project-${projectId}-qr.png`;
      a.click();
      toast.success("QR downloaded");
    } catch {
      toast.error("Download failed");
    }
  };

  const handlePrint = () => {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return toast.error("QR not ready");
    const url = canvas.toDataURL("image/png");
    const w = window.open("", "_blank", "width=600,height=750");
    if (!w) return toast.error("Pop-up blocked — allow pop-ups to print");
    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:70px;max-width:220px;object-fit:contain;margin:0 auto 6px;display:block">`
      : `<h2 style="margin:0 0 4px;font-size:18px;font-weight:700">${companyName}</h2>`;
    w.document.write(`
      <html><head><title>Project QR — ${projectName}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px}p{color:#555;margin:0 0 8px}img.qr{max-width:420px;display:block;margin:0 auto}small{font-size:11px;color:#888}.location{font-size:16px;font-weight:700;color:#1a1a1a;margin:14px 0 4px}.scan-hint{font-size:12px;color:#666;margin:0 0 20px}</style>
      </head><body>
        ${logoHtml}
        <p style="font-size:11px;color:#888;margin:0 0 20px">${companyName}</p>
        <img class="qr" src="${url}" />
        <p class="location">📍 ${projectName}</p>
        <p class="scan-hint">Scan to log attendance at this location</p>
        <small>Project ID: ${projectId}</small>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Project QR — {projectName}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Signed QR code for {projectName}. Print and post at the project site for employee attendance scanning.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div ref={wrapRef} className="flex flex-col items-center bg-white p-6 rounded-lg border gap-3">
            {/* Logo at top */}
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={companyName} className="max-h-16 max-w-44 object-contain" />
            ) : (
              <p className="font-bold text-base text-black text-center">{companyName}</p>
            )}
            {loading && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
            {error && (
              <div className="flex flex-col items-center gap-2 text-destructive py-8">
                <AlertCircle className="h-8 w-8" />
                <p className="text-sm">{error}</p>
              </div>
            )}
            {payload && !error && (
              <QRCodeCanvas
                value={checkinUrl ?? payload}
                size={240}
                level="H"
                includeMargin
              />
            )}
            {/* Location below QR */}
            {payload && !error && (
              <p className="font-semibold text-sm text-black text-center">📍 {projectName}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Print this QR and post it at the project site. Employees scan it with their phone
            to check in or out. Geofence verification ensures they must be physically present.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleDownload} disabled={!checkinUrl}>
              <Download className="h-4 w-4 mr-1" /> Download
            </Button>
            <Button className="flex-1" onClick={handlePrint} disabled={!checkinUrl}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
