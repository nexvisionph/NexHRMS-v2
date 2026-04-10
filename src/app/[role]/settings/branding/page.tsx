"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    ArrowLeft, Building2, LogIn, Upload, Trash2, Image as ImageIcon,
    ZoomIn, ZoomOut, Crop, RotateCcw, Move,
} from "lucide-react";
import Link from "next/link";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { cn } from "@/lib/utils";

// ─── Logo Cropper ─────────────────────────────────────────────────────────────

const CANVAS_W = 480;
const CANVAS_H = 280;

type AspectOpt = { label: string; ratio: number; outW: number; outH: number; desc: string };

const ASPECT_OPTIONS: AspectOpt[] = [
    { label: "Wide 4:1",   ratio: 4,   outW: 320, outH: 80,  desc: "Best for sidebar (recommended)" },
    { label: "Banner 3:1", ratio: 3,   outW: 240, outH: 80,  desc: "Top navigation / header" },
    { label: "Square 1:1", ratio: 1,   outW: 128, outH: 128, desc: "Icon / app icon" },
];

function LogoCropper({
    imgSrc,
    onApply,
    onCancel,
}: {
    imgSrc: string;
    onApply: (dataUrl: string) => void;
    onCancel: () => void;
}) {
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const imgRef      = useRef<HTMLImageElement | null>(null);
    const dragging    = useRef(false);
    const lastPos     = useRef<{ x: number; y: number } | null>(null);

    const [aspectIdx, setAspectIdx] = useState(0);
    const [scale,  setScale]  = useState(1);
    const [panX,   setPanX]   = useState(0);
    const [panY,   setPanY]   = useState(0);
    const [ready,  setReady]  = useState(false);

    const aspect = ASPECT_OPTIONS[aspectIdx];

    // Crop frame size/position in canvas pixels (recomputed per aspect)
    const frameW = Math.min(CANVAS_W - 32, (CANVAS_H - 32) * aspect.ratio);
    const frameH = frameW / aspect.ratio;
    const frameX = (CANVAS_W - frameW) / 2;
    const frameY = (CANVAS_H - frameH) / 2;

    // Initial fit: fill the crop frame
    const fitToFrame = useCallback((img: HTMLImageElement, fw: number, fh: number, fx: number, fy: number) => {
        const s = Math.max(fw / img.width, fh / img.height) * 1.05;
        const clampedS = Math.min(s, 8);
        setScale(clampedS);
        setPanX(fx + (fw - img.width  * clampedS) / 2);
        setPanY(fy + (fh - img.height * clampedS) / 2);
    }, []);

    // Load image once
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            fitToFrame(img, frameW, frameH, frameX, frameY);
            setReady(true);
        };
        img.src = imgSrc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imgSrc]);

    // Re-fit when aspect changes
    useEffect(() => {
        const img = imgRef.current;
        if (!img || !ready) return;
        fitToFrame(img, frameW, frameH, frameX, frameY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aspectIdx]);

    // Draw on every state change
    useEffect(() => {
        const canvas = canvasRef.current;
        const img    = imgRef.current;
        if (!canvas || !img || !ready) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const iw = img.width  * scale;
        const ih = img.height * scale;

        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        // 1. Dimmed image (outside frame)
        ctx.globalAlpha = 0.3;
        ctx.drawImage(img, panX, panY, iw, ih);
        ctx.globalAlpha = 1;

        // 2. Dark vignette panels (4 rects around the frame)
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0,              0,               CANVAS_W,       frameY            ); // top
        ctx.fillRect(0,              frameY + frameH, CANVAS_W,       CANVAS_H - frameY - frameH); // bottom
        ctx.fillRect(0,              frameY,          frameX,         frameH            ); // left
        ctx.fillRect(frameX + frameW,frameY,          CANVAS_W - frameX - frameW, frameH); // right

        // 3. Bright image clipped to crop frame
        ctx.save();
        ctx.beginPath();
        ctx.rect(frameX, frameY, frameW, frameH);
        ctx.clip();
        ctx.drawImage(img, panX, panY, iw, ih);
        ctx.restore();

        // 4. Rule of thirds guides
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth   = 0.75;
        for (let i = 1; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(frameX + (frameW / 3) * i, frameY);
            ctx.lineTo(frameX + (frameW / 3) * i, frameY + frameH);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(frameX,           frameY + (frameH / 3) * i);
            ctx.lineTo(frameX + frameW,  frameY + (frameH / 3) * i);
            ctx.stroke();
        }

        // 5. Frame border
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth   = 1.5;
        ctx.strokeRect(frameX, frameY, frameW, frameH);

        // 6. Corner L-brackets
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth   = 2.5;
        const bs = 14;
        ([ [frameX,         frameY,          1,  1],
           [frameX+frameW,  frameY,         -1,  1],
           [frameX,         frameY+frameH,   1, -1],
           [frameX+frameW,  frameY+frameH,  -1, -1],
        ] as [number, number, number, number][]).forEach(([x, y, dx, dy]) => {
            ctx.beginPath();
            ctx.moveTo(x + dx * bs, y);
            ctx.lineTo(x, y);
            ctx.lineTo(x, y + dy * bs);
            ctx.stroke();
        });
    }, [panX, panY, scale, ready, frameX, frameY, frameW, frameH]);

    // ─── Mouse / touch panning ───────────────────────────────────────────────
    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        dragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!dragging.current || !lastPos.current) return;
        setPanX(px => px + (e.clientX - lastPos.current!.x));
        setPanY(py => py + (e.clientY - lastPos.current!.y));
        lastPos.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => { dragging.current = false; };

    const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.08 : 0.93;
        setScale(s => Math.min(10, Math.max(0.1, s * factor)));
    };

    // ─── Apply: extract crop frame to offscreen canvas ───────────────────────
    const handleApply = () => {
        const img = imgRef.current;
        if (!img) return;
        const off = document.createElement("canvas");
        off.width  = aspect.outW;
        off.height = aspect.outH;
        const ctx = off.getContext("2d")!;
        const srcX = (frameX - panX) / scale;
        const srcY = (frameY - panY) / scale;
        const srcW = frameW / scale;
        const srcH = frameH / scale;
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, aspect.outW, aspect.outH);
        onApply(off.toDataURL("image/png"));
    };

    const resetFit = () => {
        const img = imgRef.current;
        if (img) fitToFrame(img, frameW, frameH, frameX, frameY);
    };

    return (
        <div className="space-y-4">
            {/* Aspect ratio selector */}
            <div className="flex gap-2 flex-wrap">
                {ASPECT_OPTIONS.map((opt, i) => (
                    <button
                        key={opt.label}
                        onClick={() => setAspectIdx(i)}
                        className={cn(
                            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                            i === aspectIdx
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border hover:border-primary/50"
                        )}
                    >
                        {opt.label}
                        {i === 0 && <span className="ml-1.5 text-[10px] opacity-70">★ Rec.</span>}
                    </button>
                ))}
                <span className="ml-auto self-center text-[11px] text-muted-foreground">
                    Output: {aspect.outW}×{aspect.outH}px — {aspect.desc}
                </span>
            </div>

            {/* Canvas */}
            <div className="relative rounded-xl overflow-hidden border border-border bg-zinc-900 cursor-move select-none">
                <canvas
                    ref={canvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    className="w-full"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                    onWheel={onWheel}
                />
                <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] text-white/70">
                    <Move className="h-3 w-3" /> Drag to pan · Scroll to zoom
                </div>
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-3">
                <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Slider
                    min={10} max={800} step={1}
                    value={[Math.round(scale * 100)]}
                    onValueChange={([v]) => setScale(v / 100)}
                    className="flex-1"
                />
                <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="w-12 text-right text-xs text-muted-foreground font-mono">
                    {Math.round(scale * 100)}%
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetFit} title="Reset fit">
                    <RotateCcw className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Footer actions */}
            <DialogFooter>
                <Button variant="outline" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleApply} className="gap-1.5">
                    <Crop className="h-4 w-4" /> Apply Crop
                </Button>
            </DialogFooter>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export default function BrandingPage() {
    const { currentUser } = useAuthStore();
    const appearance = useAppearanceStore();
    const fileInputRef    = useRef<HTMLInputElement>(null);
    const faviconInputRef = useRef<HTMLInputElement>(null);
    const rh = useRoleHref();

    const [cropSrc,  setCropSrc]  = useState<string>("");
    const [cropOpen, setCropOpen] = useState(false);

    if (currentUser.role !== "admin") {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground">Admin access required.</p>
            </div>
        );
    }

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) { toast.error("File must be under 2 MB."); return; }
        if (!file.type.startsWith("image/")) { toast.error("Only image files are allowed."); return; }
        // Reset the input so the same file can be re-selected after cancel
        e.target.value = "";
        const reader = new FileReader();
        reader.onload = () => {
            setCropSrc(reader.result as string);
            setCropOpen(true);
        };
        reader.readAsDataURL(file);
    };

    const handleFaviconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_FILE_SIZE) { toast.error("Favicon must be under 2 MB."); return; }
        const reader = new FileReader();
        reader.onload = () => {
            appearance.setBranding({ faviconUrl: reader.result as string });
            toast.success("Favicon uploaded.");
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Logo Cropper Dialog */}
            <Dialog open={cropOpen} onOpenChange={(o) => { if (!o) setCropOpen(false); }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Crop className="h-5 w-5" /> Crop & Resize Logo
                        </DialogTitle>
                    </DialogHeader>
                    {cropSrc && (
                        <LogoCropper
                            imgSrc={cropSrc}
                            onApply={(dataUrl) => {
                                appearance.setBranding({ logoUrl: dataUrl });
                                setCropOpen(false);
                                setCropSrc("");
                                toast.success("Logo saved.");
                            }}
                            onCancel={() => {
                                setCropOpen(false);
                                setCropSrc("");
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link href={rh("/settings")}>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Branding</h1>
                    <p className="text-sm text-muted-foreground">Company identity & login page customization</p>
                </div>
            </div>

            <Tabs defaultValue="identity" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="identity" className="gap-1.5">
                        <Building2 className="h-4 w-4" /> Identity
                    </TabsTrigger>
                    <TabsTrigger value="login" className="gap-1.5">
                        <LogIn className="h-4 w-4" /> Login Page
                    </TabsTrigger>
                </TabsList>

                {/* ═══════════════ IDENTITY TAB ═══════════════ */}
                <TabsContent value="identity" className="space-y-6">
                    {/* Company Name */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Company Name</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium">Name</label>
                                <Input
                                    value={appearance.companyName}
                                    onChange={(e) => appearance.setBranding({ companyName: e.target.value })}
                                    placeholder="Your Company Name"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium">Tagline</label>
                                <Input
                                    value={appearance.brandTagline}
                                    onChange={(e) => appearance.setBranding({ brandTagline: e.target.value })}
                                    placeholder="e.g. Human Resources Made Simple"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium">Accent Badge Text</label>
                                <Input
                                    value={appearance.accentBadgeText}
                                    onChange={(e) => appearance.setBranding({ accentBadgeText: e.target.value })}
                                    placeholder="e.g. BETA, v2.0, ENTERPRISE"
                                />
                                <p className="text-[11px] text-muted-foreground">Shows as a small badge next to the company name in the topbar</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Logo */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                Logo
                                <span className="text-[10px] font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                    Recommended: 320×80 px · PNG / SVG · 2 MB max
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {/* Preview + actions row */}
                            <div className="flex items-center gap-5 flex-wrap">
                                {/* Preview box */}
                                <div className="flex flex-col items-center gap-1.5">
                                    <div className={cn(
                                        "h-16 w-52 rounded-lg border-2 flex items-center justify-center p-2 transition-colors",
                                        appearance.logoUrl
                                            ? "border-border bg-muted/30"
                                            : "border-dashed border-border bg-muted/20"
                                    )}>
                                        {appearance.logoUrl ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img
                                                src={appearance.logoUrl}
                                                alt="Logo preview"
                                                className="max-h-full max-w-full object-contain"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center gap-1">
                                                <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                                                <span className="text-[10px] text-muted-foreground/50">No logo</span>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">Sidebar preview</span>
                                </div>

                                {/* Buttons */}
                                <div className="space-y-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5 w-full"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="h-3.5 w-3.5" />
                                        {appearance.logoUrl ? "Replace Logo" : "Upload Logo"}
                                    </Button>
                                    {appearance.logoUrl && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1.5 w-full"
                                                onClick={() => {
                                                    setCropSrc(appearance.logoUrl);
                                                    setCropOpen(true);
                                                }}
                                            >
                                                <Crop className="h-3.5 w-3.5" /> Edit / Crop
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-1.5 w-full text-destructive hover:text-destructive"
                                                onClick={() => {
                                                    appearance.setBranding({ logoUrl: "" });
                                                    toast.success("Logo removed.");
                                                }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" /> Remove
                                            </Button>
                                        </>
                                    )}
                                </div>

                                {/* Size guide */}
                                <div className="ml-auto text-[11px] text-muted-foreground space-y-1.5 border border-border rounded-lg px-4 py-3 bg-muted/20">
                                    <p className="font-semibold text-foreground text-xs mb-2">Size Guide</p>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                                        <span><b>Wide 4:1</b> — 320×80 px (sidebar)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-primary/60 inline-block" />
                                        <span><b>Banner 3:1</b> — 240×80 px (topbar)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-primary/30 inline-block" />
                                        <span><b>Square 1:1</b> — 128×128 px (icon)</span>
                                    </div>
                                    <p className="pt-1 opacity-70">PNG or SVG with transparent background works best.</p>
                                </div>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                            />

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Show Logo Text</p>
                                    <p className="text-xs text-muted-foreground">Show company name next to logo in sidebar</p>
                                </div>
                                <Switch
                                    checked={appearance.logoTextVisible}
                                    onCheckedChange={(v) => appearance.setBranding({ logoTextVisible: v })}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Favicon */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Favicon</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-4">
                                {appearance.faviconUrl ? (
                                    <div className="h-10 w-10 rounded-lg border border-border bg-muted/50 flex items-center justify-center p-1">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={appearance.faviconUrl}
                                            alt="Favicon preview"
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className="h-10 w-10 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                                        <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5"
                                        onClick={() => faviconInputRef.current?.click()}
                                    >
                                        <Upload className="h-3.5 w-3.5" /> Upload Favicon
                                    </Button>
                                    {appearance.faviconUrl && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="gap-1.5 text-destructive hover:text-destructive"
                                            onClick={() => {
                                                appearance.setBranding({ faviconUrl: "" });
                                                toast.success("Favicon removed.");
                                            }}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" /> Remove
                                        </Button>
                                    )}
                                </div>
                                <input
                                    ref={faviconInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFaviconUpload}
                                    className="hidden"
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground">Recommended: 32×32 or 64×64 PNG/ICO. Max 500 KB.</p>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ═══════════════ LOGIN PAGE TAB ═══════════════ */}
                <TabsContent value="login" className="space-y-6">
                    {/* Login Text */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Login Text</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium">Heading</label>
                                <Input
                                    value={appearance.loginHeading}
                                    onChange={(e) => appearance.setLoginConfig({ loginHeading: e.target.value })}
                                    placeholder="NexHRMS"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium">Subheading</label>
                                <Input
                                    value={appearance.loginSubheading}
                                    onChange={(e) => appearance.setLoginConfig({ loginSubheading: e.target.value })}
                                    placeholder="Sign in to your account to continue"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Login Background */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Background Style</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-3">
                                {([
                                    { id: "gradient", label: "Gradient", desc: "Subtle gradient background" },
                                    { id: "solid", label: "Solid", desc: "Plain solid color" },
                                    { id: "pattern", label: "Pattern", desc: "Grid pattern overlay" },
                                ] as const).map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => appearance.setLoginConfig({ loginBackground: opt.id })}
                                        className={cn(
                                            "flex flex-col items-center gap-1 rounded-lg border-2 px-4 py-3 transition-all flex-1",
                                            appearance.loginBackground === opt.id
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/40"
                                        )}
                                    >
                                        <span className="text-sm font-medium">{opt.label}</span>
                                        <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>

                            {appearance.loginBackground === "solid" && (
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-medium">Background Color</label>
                                    <input
                                        type="color"
                                        value={appearance.loginBgColor || "#f5f5f5"}
                                        onChange={(e) => appearance.setLoginConfig({ loginBgColor: e.target.value })}
                                        className="h-9 w-14 cursor-pointer rounded border border-border"
                                    />
                                    <span className="text-xs text-muted-foreground font-mono">{appearance.loginBgColor || "#f5f5f5"}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Login Card Style */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Card Layout</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-3">
                                {([
                                    { id: "centered", label: "Centered", desc: "Card in the center of screen" },
                                    { id: "split", label: "Split", desc: "Left panel + right form" },
                                ] as const).map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => appearance.setLoginConfig({ loginCardStyle: opt.id })}
                                        className={cn(
                                            "flex flex-col items-center gap-2 rounded-lg border-2 px-6 py-4 transition-all flex-1",
                                            appearance.loginCardStyle === opt.id
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/40"
                                        )}
                                    >
                                        {/* Mini layout preview */}
                                        <div className="flex h-10 w-16 gap-0.5">
                                            {opt.id === "split" ? (
                                                <>
                                                    <div className="w-1/2 bg-primary/20 rounded-sm" />
                                                    <div className="w-1/2 bg-muted rounded-sm flex items-center justify-center">
                                                        <div className="h-4 w-4 bg-primary/30 rounded-sm" />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-full bg-muted rounded-sm flex items-center justify-center">
                                                    <div className="h-5 w-8 bg-primary/30 rounded-sm" />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs font-medium">{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Live Preview */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Preview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div
                                className={cn(
                                    "rounded-lg border border-border overflow-hidden h-48 flex",
                                    appearance.loginCardStyle === "split" ? "flex-row" : "items-center justify-center",
                                    appearance.loginBackground === "gradient" && "bg-gradient-to-br from-background via-muted/30 to-background",
                                    appearance.loginBackground === "pattern" && "bg-muted/20",
                                )}
                                style={appearance.loginBackground === "solid" ? { backgroundColor: appearance.loginBgColor || "#f5f5f5" } : undefined}
                            >
                                {appearance.loginCardStyle === "split" && (
                                    <div className="w-1/2 bg-primary/10 flex items-center justify-center">
                                        <span className="text-xs text-muted-foreground">Branding Panel</span>
                                    </div>
                                )}
                                <div className={cn(
                                    "bg-card border border-border rounded-lg p-4 shadow-sm text-center space-y-2",
                                    appearance.loginCardStyle === "split" ? "m-auto w-3/4 max-w-[200px]" : "w-48"
                                )}>
                                    <p className="text-xs font-bold">{appearance.loginHeading || "NexHRMS"}</p>
                                    <p className="text-[9px] text-muted-foreground">{appearance.loginSubheading || "Sign in"}</p>
                                    <div className="h-px bg-border" />
                                    <div className="h-3 w-full bg-muted rounded" />
                                    <div className="h-3 w-full bg-muted rounded" />
                                    <div className="h-4 w-full bg-primary/30 rounded" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
