"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Printer, QrCode, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPayload(null);
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
    const w = window.open("", "_blank", "width=600,height=700");
    if (!w) return toast.error("Pop-up blocked — allow pop-ups to print");
    w.document.write(`
      <html><head><title>Project QR — ${projectName}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px}h1{margin:0 0 8px}p{color:#555;margin:0 0 24px}img{max-width:480px}</style>
      </head><body>
        <h1>${projectName}</h1>
        <p>Scan to log attendance for this project</p>
        <img src="${url}" />
        <p style="font-size:11px;margin-top:24px">Project ID: ${projectId}</p>
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
        </DialogHeader>
        <div className="space-y-4">
          <div ref={wrapRef} className="flex items-center justify-center bg-white p-6 rounded-lg border">
            {loading && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
            {error && (
              <div className="flex flex-col items-center gap-2 text-destructive py-8">
                <AlertCircle className="h-8 w-8" />
                <p className="text-sm">{error}</p>
              </div>
            )}
            {payload && !error && (
              <QRCodeCanvas
                value={payload}
                size={256}
                level="H"
                includeMargin
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Permanent QR code. Print and post at the project site. Geofence verification
            ensures workers must be physically present to check in.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleDownload} disabled={!payload}>
              <Download className="h-4 w-4 mr-1" /> Download
            </Button>
            <Button className="flex-1" onClick={handlePrint} disabled={!payload}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
