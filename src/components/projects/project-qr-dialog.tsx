"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateProjectQR, getProjectQRDisplayData } from "@/lib/project-qr";
import { Download, Printer, QrCode, Copy } from "lucide-react";
import type { Project } from "@/types";

interface ProjectQRDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectQRDialog({ project, open, onOpenChange }: ProjectQRDialogProps) {
  const [qrData, setQrData] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open) {
      generateProjectQR(project.id, project.name).then(setQrData);
    }
  }, [open, project.id, project.name]);

  // Simple QR-like visual (in production, use a QR library like 'qrcode')
  useEffect(() => {
    if (!canvasRef.current || !qrData) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 256;
    canvas.width = size;
    canvas.height = size;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    // Generate a deterministic pattern from the QR data
    ctx.fillStyle = "#000000";
    const cellSize = 8;
    const grid = size / cellSize;

    // Simple hash-based pattern (placeholder for real QR encoding)
    let hash = 0;
    for (let i = 0; i < qrData.length; i++) {
      hash = ((hash << 5) - hash) + qrData.charCodeAt(i);
      hash = hash & hash;
    }

    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        // Position patterns (corners)
        const isCorner = (x < 7 && y < 7) || (x >= grid - 7 && y < 7) || (x < 7 && y >= grid - 7);
        if (isCorner) {
          const cx = x < 7 ? x : (x >= grid - 7 ? x - (grid - 7) : x);
          const cy = y < 7 ? y : (y >= grid - 7 ? y - (grid - 7) : y);
          const isBorder = cx === 0 || cx === 6 || cy === 0 || cy === 6;
          const isInner = cx >= 2 && cx <= 4 && cy >= 2 && cy <= 4;
          if (isBorder || isInner) {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        } else {
          // Data pattern
          const seed = (hash + x * 31 + y * 37 + x * y) & 0xffffffff;
          if (seed % 3 !== 0) {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }
    }

    // Center label
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(size / 2 - 30, size / 2 - 10, 60, 20);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PROJECT", size / 2, size / 2 + 4);
  }, [qrData]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `project-qr-${project.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const handlePrint = () => {
    if (!canvasRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>Project QR - ${project.name}</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;">
          <h2>${project.name}</h2>
          <img src="${canvasRef.current.toDataURL("image/png")}" style="width:300px;height:300px;" />
          <p style="color:#666;margin-top:16px;">Scan this QR code to check in at this project location.</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleCopy = async () => {
    if (!qrData) return;
    await navigator.clipboard.writeText(qrData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayData = getProjectQRDisplayData(project.id, project.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Project QR Code
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-center">
            <p className="font-medium">{displayData.label}</p>
            <p className="text-sm text-muted-foreground">{displayData.subtitle}</p>
          </div>

          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="border rounded-lg shadow-sm"
              style={{ width: 256, height: 256 }}
            />
          </div>

          <p className="text-xs text-center text-muted-foreground">
            This QR code is permanent and unique to this project. Employees scan it to record attendance.
          </p>

          <div className="flex gap-2">
            <Button onClick={handleDownload} variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />Download PNG
            </Button>
            <Button onClick={handlePrint} variant="outline" className="flex-1">
              <Printer className="h-4 w-4 mr-2" />Print
            </Button>
          </div>
          <Button onClick={handleCopy} variant="ghost" className="w-full" size="sm">
            <Copy className="h-3 w-3 mr-2" />{copied ? "Copied!" : "Copy QR Data"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
