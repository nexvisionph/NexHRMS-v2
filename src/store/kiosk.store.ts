import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KioskCheckInMethod = "pin" | "qr" | "face" | "nfc" | "t800" | "all";
export type KioskTheme = "auto" | "dark" | "midnight" | "charcoal";
export type KioskClockFormat = "12h" | "24h";
export type KioskIdleAction = "none" | "screensaver" | "dim";

export type KioskFaceRecPosition = "left" | "right" | "bottom";
export type PenaltyApplyTo = "devtools" | "spoofing" | "both";

export interface KioskSettings {
  // ── General ──
  kioskEnabled: boolean;
  kioskTitle: string;
  welcomeMessage: string;
  footerMessage: string;

  // ── Check-in methods (granular toggles) ──
  checkInMethod: KioskCheckInMethod; // backward-compat, used as preset
  enablePin: boolean;
  enableQr: boolean;
  enableFace: boolean;
  enableNfc: boolean;
  allowCheckOut: boolean;

  // ── PIN settings ──
  pinLength: number; // 4-8
  maxPinAttempts: number; // 0 = unlimited
  lockoutDuration: number; // seconds, 0 = until admin unlock

  // ── QR / Token settings ──
  tokenRefreshInterval: number; // seconds 10-120
  tokenLength: number; // 6-12 chars

  // ── NFC settings ──
  nfcSimulatedDelay: number; // ms, how long to simulate NFC tap

  // ── Display ──
  kioskTheme: KioskTheme;
  clockFormat: KioskClockFormat;
  showClock: boolean;
  showDate: boolean;
  showLogo: boolean;
  showDeviceId: boolean;
  showSecurityBadge: boolean;

  // ── Behavior ──
  feedbackDuration: number; // ms 1000-5000
  warnOffDay: boolean;
  playSound: boolean;
  idleTimeout: number; // seconds, 0 = off
  idleAction: KioskIdleAction;

  // ── Security ──
  requireGeofence: boolean;
  adminPin: string; // ADMIN-only PIN to unlock kiosk mode (default: 000000). Employees use QR/Face instead.

  // ── Selfie / Photo ──
  selfieEnabled: boolean;
  selfieRequired: boolean;

  // ── Face Recognition (Kiosk) ──
  faceRecEnabled: boolean;
  faceRecRequired: boolean;     // must complete face scan
  faceRecAutoStart: boolean;    // auto-activate camera on kiosk load
  faceRecCountdown: number;     // seconds (1-10) for scan countdown
  faceRecPosition: KioskFaceRecPosition; // panel position

  // ── Anti-Cheat Penalty ──
  devOptionsPenaltyEnabled: boolean;
  devOptionsPenaltyMinutes: number;        // 5-480
  devOptionsPenaltyApplyTo: PenaltyApplyTo;
  devOptionsPenaltyNotifyAdmin: boolean;
}

const DEFAULT_SETTINGS: KioskSettings = {
  kioskEnabled: true,
  kioskTitle: "Attendance Kiosk",
  welcomeMessage: "Choose a method to check in or out",
  footerMessage: "Unauthorized access is prohibited",

  // Default kiosk runs T800-only: device + web use Wi‑Fi connectivity to the bridge/server.
  checkInMethod: "t800",
  enablePin: false,
  enableQr: false,
  enableFace: false,
  enableNfc: false,
  allowCheckOut: true,

  pinLength: 6,
  maxPinAttempts: 0,
  lockoutDuration: 60,

  tokenRefreshInterval: 30,
  tokenLength: 8,

  nfcSimulatedDelay: 1500,

  kioskTheme: "auto",
  clockFormat: "24h",
  showClock: true,
  showDate: true,
  showLogo: true,
  showDeviceId: true,
  showSecurityBadge: true,

  feedbackDuration: 1800,
  warnOffDay: true,
  playSound: false,
  idleTimeout: 0,
  idleAction: "none",

  requireGeofence: false,
  adminPin: "000000",

  selfieEnabled: false,
  selfieRequired: false,

  faceRecEnabled: false,
  faceRecRequired: false,
  faceRecAutoStart: false,
  faceRecCountdown: 3,
  faceRecPosition: "bottom",

  devOptionsPenaltyEnabled: true,
  devOptionsPenaltyMinutes: 30,
  devOptionsPenaltyApplyTo: "both",
  devOptionsPenaltyNotifyAdmin: true,
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface KioskStore {
  settings: KioskSettings;
  hasFetchedConfig: boolean;
  updateSettings: (patch: Partial<KioskSettings>) => void;
  resetSettings: () => void;
  fetchConfig: () => Promise<void>;
}

export const useKioskStore = create<KioskStore>()(
  persist(
    (set, get) => ({
      settings: { ...DEFAULT_SETTINGS },
      hasFetchedConfig: false,

      fetchConfig: async () => {
        try {
          const res = await fetch("/api/settings/kiosk");
          if (!res.ok) return;
          const data = await res.json();
          if (data && typeof data === "object") {
            set((state) => ({
              settings: { ...state.settings, ...data },
              hasFetchedConfig: true,
            }));
          } else {
            set({ hasFetchedConfig: true });
          }
        } catch {
          // DB unavailable — keep local settings
          set({ hasFetchedConfig: true });
        }
      },

      updateSettings: (patch) => {
        set((state) => ({ settings: { ...state.settings, ...patch } }));
        // Fire-and-forget sync to DB (exclude adminPin — it has its own API)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { adminPin, ...safeSettings } = get().settings;
        void fetch("/api/settings/kiosk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...safeSettings, ...patch }),
        }).catch(() => {});
      },

      resetSettings: () => {
        set({ settings: { ...DEFAULT_SETTINGS } });
        // Sync defaults back to DB
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { adminPin, ...safeDefaults } = DEFAULT_SETTINGS;
        void fetch("/api/settings/kiosk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(safeDefaults),
        }).catch(() => {});
      },
    }),
    { name: "soren-kiosk-settings", storage: safePersistStorage }
  )
);
