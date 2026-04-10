"use client";

import { useEffect, useMemo } from "react";
import { useAuthStore } from "@/store/auth.store";
import {
    useAppearanceStore,
    COLOR_PRESETS,
    FONT_OPTIONS,
    RADIUS_OPTIONS,
    type ColorThemeId,
} from "@/store/appearance.store";

// ─── Full-App Theme Generation ────────────────────────────────────────────────
// Each preset overrides ALL CSS vars so the entire UI changes color, not just primary.

interface ThemeVars { [key: string]: string }

/** Generate a complete light + dark theme from hue angle (oklch) and chroma.
 *  lightL / darkL = primary lightness for light/dark mode (per-preset tuned). */
function generateFullTheme(
    hue: number,
    chroma: number,
    opts?: {
        lightL?: number;          // primary lightness in light mode  (default 0.52)
        darkL?: number;           // primary lightness in dark mode   (default 0.65)
        lightPrimaryFg?: string;
        darkPrimaryFg?: string;
    }
): { light: ThemeVars; dark: ThemeVars } {
    const h   = hue;
    const c   = chroma;
    const lL  = opts?.lightL ?? 0.52;
    const dL  = opts?.darkL  ?? 0.65;
    const lpf = opts?.lightPrimaryFg ?? "oklch(0.985 0 0)";
    const dpf = opts?.darkPrimaryFg  ?? "oklch(0.985 0 0)";

    // Ring in dark mode: slightly lighter than primary so focus rings are visible
    const darkRingL = Math.min(dL + 0.08, 0.82);

    return {
        light: {
            // Surfaces — near-white; foreground is achromatic for crisp readability
            "--background":           `oklch(0.99 0.003 ${h})`,
            "--foreground":           "oklch(0.145 0 0)",
            "--card":                 "oklch(1 0 0)",
            "--card-foreground":      "oklch(0.145 0 0)",
            "--popover":              "oklch(1 0 0)",
            "--popover-foreground":   "oklch(0.145 0 0)",
            // Primary
            "--primary":              `oklch(${lL} ${c} ${h})`,
            "--primary-foreground":   lpf,
            // Secondary — very light hue tint; dark text for contrast
            "--secondary":            `oklch(0.955 0.020 ${h})`,
            "--secondary-foreground": "oklch(0.145 0 0)",
            // Muted — light tint; foreground must pass WCAG AA (≥4.5:1 on ~white)
            // oklch(0.42 0 0) ≈ #636363, contrast ~5.5:1 on oklch(0.99) ✓
            "--muted":                `oklch(0.960 0.012 ${h})`,
            "--muted-foreground":     `oklch(0.42 0.010 ${h})`,
            // Accent
            "--accent":               `oklch(0.955 0.020 ${h})`,
            "--accent-foreground":    "oklch(0.145 0 0)",
            // Destructive (universal red)
            "--destructive":          "oklch(0.577 0.245 27.325)",
            // Chrome
            "--border":               `oklch(0.905 0.014 ${h})`,
            "--input":                `oklch(0.905 0.014 ${h})`,
            "--ring":                 `oklch(${lL} ${c} ${h})`,
            // Charts — 5 harmonious hues, evenly spread
            "--chart-1": `oklch(${(lL + 0.04).toFixed(2)} ${(c * 0.92).toFixed(3)} ${h})`,
            "--chart-2": `oklch(0.63 ${(c * 0.70).toFixed(3)} ${(h + 72) % 360})`,
            "--chart-3": `oklch(0.52 ${(c * 0.58).toFixed(3)} ${(h + 144) % 360})`,
            "--chart-4": `oklch(0.70 ${(c * 0.68).toFixed(3)} ${(h + 216) % 360})`,
            "--chart-5": `oklch(0.62 ${(c * 0.80).toFixed(3)} ${(h + 288) % 360})`,
            // Sidebar — slightly off-white with hue tint; text is full dark
            "--sidebar":                      `oklch(0.975 0.008 ${h})`,
            "--sidebar-foreground":           "oklch(0.145 0 0)",
            "--sidebar-primary":              `oklch(${lL} ${c} ${h})`,
            "--sidebar-primary-foreground":   lpf,
            "--sidebar-accent":               `oklch(0.955 0.020 ${h})`,
            "--sidebar-accent-foreground":    "oklch(0.145 0 0)",
            "--sidebar-border":               `oklch(0.905 0.014 ${h})`,
            "--sidebar-ring":                 `oklch(${lL} ${c} ${h})`,
        },
        dark: {
            // Surfaces — near-black with subtle hue tint; foreground is near-white
            "--background":           `oklch(0.145 0.010 ${h})`,
            "--foreground":           "oklch(0.985 0 0)",
            "--card":                 `oklch(0.205 0.012 ${h})`,
            "--card-foreground":      "oklch(0.985 0 0)",
            "--popover":              `oklch(0.205 0.012 ${h})`,
            "--popover-foreground":   "oklch(0.985 0 0)",
            // Primary
            "--primary":              `oklch(${dL} ${(c * 0.88).toFixed(3)} ${h})`,
            "--primary-foreground":   dpf,
            // Secondary
            "--secondary":            `oklch(0.270 0.022 ${h})`,
            "--secondary-foreground": "oklch(0.985 0 0)",
            // Muted — foreground at 0.72 ≈ 5.8:1 on oklch(0.145) dark bg ✓
            "--muted":                `oklch(0.270 0.018 ${h})`,
            "--muted-foreground":     `oklch(0.72 0.025 ${h})`,
            // Accent
            "--accent":               `oklch(0.270 0.026 ${h})`,
            "--accent-foreground":    "oklch(0.985 0 0)",
            // Destructive
            "--destructive":          "oklch(0.704 0.191 22.216)",
            // Chrome — border slightly lighter than card for visible separation
            "--border":               `oklch(0.32 0.018 ${h})`,
            "--input":                `oklch(0.34 0.020 ${h})`,
            "--ring":                 `oklch(${darkRingL.toFixed(3)} ${(c * 0.72).toFixed(3)} ${h})`,
            // Charts
            "--chart-1": `oklch(${dL.toFixed(2)} ${(c * 0.90).toFixed(3)} ${h})`,
            "--chart-2": `oklch(0.67 ${(c * 0.72).toFixed(3)} ${(h + 72) % 360})`,
            "--chart-3": `oklch(0.55 ${(c * 0.58).toFixed(3)} ${(h + 144) % 360})`,
            "--chart-4": `oklch(0.71 ${(c * 0.62).toFixed(3)} ${(h + 216) % 360})`,
            "--chart-5": `oklch(0.64 ${(c * 0.78).toFixed(3)} ${(h + 288) % 360})`,
            // Sidebar
            "--sidebar":                      `oklch(0.205 0.012 ${h})`,
            "--sidebar-foreground":           "oklch(0.985 0 0)",
            "--sidebar-primary":              `oklch(${dL} ${(c * 0.88).toFixed(3)} ${h})`,
            "--sidebar-primary-foreground":   dpf,
            "--sidebar-accent":               `oklch(0.270 0.026 ${h})`,
            "--sidebar-accent-foreground":    "oklch(0.985 0 0)",
            "--sidebar-border":               `oklch(0.32 0.018 ${h})`,
            "--sidebar-ring":                 `oklch(${darkRingL.toFixed(3)} ${(c * 0.72).toFixed(3)} ${h})`,
        },
    };
}

/** Preset config: hue, chroma, lightness (light mode), lightness (dark mode),
 *  and optional foreground overrides. Values are hand-tuned per hue for correct
 *  perceived brightness and contrast.
 *
 *  Reference sRGB approximate:
 *   blue   #3b82f6  violet #7c3aed  rose   #f43f5e  teal #14b8a6
 *   green  #22c55e  orange #f97316  amber  #f59e0b
 */
const PRESET_CONFIG: Record<Exclude<ColorThemeId, "default" | "custom">, {
    hue: number; chroma: number;
    lightL?: number; darkL?: number;
    lightPrimaryFg?: string; darkPrimaryFg?: string;
}> = {
    //                  hue    chroma  lightL  darkL
    blue:   { hue: 262, chroma: 0.243, lightL: 0.585, darkL: 0.650 },
    green:  { hue: 145, chroma: 0.200, lightL: 0.525, darkL: 0.630 },
    rose:   { hue:  15, chroma: 0.238, lightL: 0.580, darkL: 0.660 },
    orange: { hue:  37, chroma: 0.218, lightL: 0.650, darkL: 0.710 },
    violet: { hue: 293, chroma: 0.258, lightL: 0.535, darkL: 0.648 },
    teal:   { hue: 183, chroma: 0.172, lightL: 0.545, darkL: 0.640 },
    // Amber: bright gold — needs dark text for contrast in both modes
    amber:  { hue:  60, chroma: 0.178, lightL: 0.760, darkL: 0.780,
               lightPrimaryFg: "oklch(0.145 0.02 60)",
               darkPrimaryFg:  "oklch(0.145 0.02 60)" },
    // White: pure minimal achromatic — clean white + dark charcoal buttons
    white:  { hue:   0, chroma: 0,     lightL: 0.220, darkL: 0.880,
               darkPrimaryFg: "oklch(0.12 0 0)" },
    // Black: stark high-contrast — pure black buttons in light, white in dark
    black:  { hue:   0, chroma: 0,     lightL: 0.060, darkL: 0.940,
               darkPrimaryFg: "oklch(0.10 0 0)" },
};

/** Build the full CSS string from a ThemeVars object. */
function varsToCSS(vars: ThemeVars): string {
    return Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n");
}

// ─── Provider Component ───────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const theme = useAuthStore((s) => s.theme);
    const colorTheme = useAppearanceStore((s) => s.colorTheme);
    const customPrimaryLight = useAppearanceStore((s) => s.customPrimaryLight);
    const customPrimaryDark = useAppearanceStore((s) => s.customPrimaryDark);
    const fontFamily = useAppearanceStore((s) => s.fontFamily);
    const radius = useAppearanceStore((s) => s.radius);
    const density = useAppearanceStore((s) => s.density);
    const faviconUrl = useAppearanceStore((s) => s.faviconUrl);

    // ─── Dark / Light mode ────────────────────────────────────────────────────
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove("light", "dark");

        if (theme === "system") {
            const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            root.classList.add(systemDark ? "dark" : "light");
        } else {
            root.classList.add(theme);
        }
    }, [theme]);

    // ─── Color theme — full-app CSS vars ──────────────────────────────────────
    const themeCSS = useMemo(() => {
        if (colorTheme === "default") return "";

        if (colorTheme === "custom") {
            // Parse oklch(L C H) — extract chroma and hue from the light primary value
            // e.g. "oklch(0.52 0.243 262)" → chroma=0.243, hue=262
            const parts = customPrimaryLight.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
            const lightness = parts ? parseFloat(parts[1]) : 0.52;
            const chroma    = parts ? parseFloat(parts[2]) : 0.2;
            const hue       = parts ? parseFloat(parts[3]) : 262;
            const full = generateFullTheme(hue, chroma, { lightL: lightness, darkL: Math.min(lightness + 0.12, 0.78) });
            // Pin primary to the exact user-chosen values
            full.light["--primary"] = customPrimaryLight;
            full.dark["--primary"]  = customPrimaryDark;
            return `:root {\n${varsToCSS(full.light)}\n}\n.dark {\n${varsToCSS(full.dark)}\n}`;
        }

        const cfg = PRESET_CONFIG[colorTheme as keyof typeof PRESET_CONFIG];
        if (!cfg) return "";
        const full = generateFullTheme(cfg.hue, cfg.chroma, {
            lightL: cfg.lightL,
            darkL:  cfg.darkL,
            lightPrimaryFg: cfg.lightPrimaryFg,
            darkPrimaryFg:  cfg.darkPrimaryFg,
        });
        return `:root {\n${varsToCSS(full.light)}\n}\n.dark {\n${varsToCSS(full.dark)}\n}`;
    }, [colorTheme, customPrimaryLight, customPrimaryDark]);

    useEffect(() => {
        const styleId = "nexhrms-theme-vars";
        let style = document.getElementById(styleId) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement("style");
            style.id = styleId;
            document.head.appendChild(style);
        }
        style.textContent = themeCSS;
    }, [themeCSS]);

    // ─── Radius ───────────────────────────────────────────────────────────────
    useEffect(() => {
        const opt = RADIUS_OPTIONS.find((r) => r.id === radius);
        if (opt) {
            document.documentElement.style.setProperty("--radius", opt.value);
        }
    }, [radius]);

    // ─── Font family ──────────────────────────────────────────────────────────
    useEffect(() => {
        const opt = FONT_OPTIONS.find((f) => f.id === fontFamily);
        if (!opt) return;

        // Load Google Font stylesheet if required
        const linkId = "nexhrms-gfont";
        const existing = document.getElementById(linkId);
        if (opt.googleFont) {
            if (!existing) {
                const link = document.createElement("link");
                link.id = linkId;
                link.rel = "stylesheet";
                link.href = `https://fonts.googleapis.com/css2?family=${opt.googleFont}&display=swap`;
                document.head.appendChild(link);
            } else {
                (existing as HTMLLinkElement).href = `https://fonts.googleapis.com/css2?family=${opt.googleFont}&display=swap`;
            }
        } else if (existing) {
            existing.remove();
        }

        const root = document.documentElement;
        if (fontFamily === "geist") {
            // Geist is provided by Next.js; remove any overrides so the default kicks in
            root.style.removeProperty("--font-sans");
            root.style.removeProperty("--font-sans-override");
        } else {
            // Override both the Tailwind v4 token and our legacy fallback var
            root.style.setProperty("--font-sans", opt.value);
            root.style.setProperty("--font-sans-override", opt.value);
        }
        root.setAttribute("data-font", fontFamily);
    }, [fontFamily]);

    // ─── Density ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const body = document.body;
        body.classList.remove("density-compact", "density-relaxed");
        if (density !== "default") {
            body.classList.add(`density-${density}`);
        }
    }, [density]);

    // ─── Favicon ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!faviconUrl) return;
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
        }
        link.href = faviconUrl;
    }, [faviconUrl]);

    return <>{children}</>;
}
