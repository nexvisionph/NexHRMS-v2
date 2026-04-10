import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KioskCheckInMethod = "pin" | "qr" | "face" | "nfc" | "all";
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

  checkInMethod: "all",
  enablePin: true,
  enableQr: true,
  enableFace: true,
  enableNfc: true,
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

  faceRecEnabled: true,
  faceRecRequired: false,
  faceRecAutoStart: true,
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
  updateSettings: (patch: Partial<KioskSettings>) => void;
  resetSettings: () => void;
}

export const useKioskStore = create<KioskStore>()(
  persist(
    (set) => ({
      settings: { ...DEFAULT_SETTINGS },
      updateSettings: (patch) =>
        set((state) => ({ settings: { ...state.settings, ...patch } })),
      resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS } }),
    }),
    { name: "nexhrms-kiosk-settings" }
  )
);
