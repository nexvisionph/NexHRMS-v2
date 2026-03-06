import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Color Theme Presets ──────────────────────────────────────────────────────

export type ColorThemeId =
  | "default"
  | "blue"
  | "green"
  | "rose"
  | "orange"
  | "violet"
  | "teal"
  | "amber"
  | "white"
  | "black"
  | "custom";

export interface ColorPreset {
  id: ColorThemeId;
  label: string;
  /** oklch primary for light */
  lightPrimary: string;
  lightPrimaryFg: string;
  /** oklch primary for dark */
  darkPrimary: string;
  darkPrimaryFg: string;
  /** preview swatch (hex for display only) */
  swatch: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "default",
    label: "Neutral",
    lightPrimary: "oklch(0.205 0 0)",
    lightPrimaryFg: "oklch(0.985 0 0)",
    darkPrimary: "oklch(0.922 0 0)",
    darkPrimaryFg: "oklch(0.205 0 0)",
    swatch: "#171717",
  },
  {
    id: "blue",
    label: "Blue",
    lightPrimary: "oklch(0.488 0.243 264.376)",
    lightPrimaryFg: "oklch(0.985 0 0)",
    darkPrimary: "oklch(0.623 0.214 259.815)",
    darkPrimaryFg: "oklch(0.985 0 0)",
    swatch: "#2563eb",
  },
  {
    id: "green",
    label: "Green",
    lightPrimary: "oklch(0.527 0.185 155.224)",
    lightPrimaryFg: "oklch(0.985 0 0)",
    darkPrimary: "oklch(0.648 0.2 155.224)",
    darkPrimaryFg: "oklch(0.985 0 0)",
    swatch: "#16a34a",
  },
  {
    id: "rose",
    label: "Rose",
    lightPrimary: "oklch(0.585 0.233 17.642)",
    lightPrimaryFg: "oklch(0.985 0 0)",
    darkPrimary: "oklch(0.712 0.194 17.642)",
    darkPrimaryFg: "oklch(0.985 0 0)",
    swatch: "#e11d48",
  },
  {
    id: "orange",
    label: "Orange",
    lightPrimary: "oklch(0.646 0.222 41.116)",
    lightPrimaryFg: "oklch(0.985 0 0)",
    darkPrimary: "oklch(0.746 0.198 41.116)",
    darkPrimaryFg: "oklch(0.985 0 0)",
    swatch: "#ea580c",
  },
  {
    id: "violet",
    label: "Violet",
    lightPrimary: "oklch(0.541 0.281 293.009)",
    lightPrimaryFg: "oklch(0.985 0 0)",
    darkPrimary: "oklch(0.654 0.241 293.009)",
    darkPrimaryFg: "oklch(0.985 0 0)",
    swatch: "#7c3aed",
  },
  {
    id: "teal",
    label: "Teal",
    lightPrimary: "oklch(0.6 0.118 184.704)",
    lightPrimaryFg: "oklch(0.985 0 0)",
    darkPrimary: "oklch(0.72 0.118 184.704)",
    darkPrimaryFg: "oklch(0.985 0 0)",
    swatch: "#0d9488",
  },
  {
    id: "amber",
    label: "Amber",
    lightPrimary: "oklch(0.666 0.179 58.318)",
    lightPrimaryFg: "oklch(0.205 0 0)",
    darkPrimary: "oklch(0.78 0.165 58.318)",
    darkPrimaryFg: "oklch(0.205 0 0)",
    swatch: "#d97706",
  },
  {
    id: "white",
    label: "White",
    lightPrimary: "oklch(0.22 0 0)",
    lightPrimaryFg: "oklch(0.985 0 0)",
    darkPrimary: "oklch(0.88 0 0)",
    darkPrimaryFg: "oklch(0.145 0 0)",
    swatch: "#ffffff",
  },
  {
    id: "black",
    label: "Black",
    lightPrimary: "oklch(0.06 0 0)",
    lightPrimaryFg: "oklch(0.985 0 0)",
    darkPrimary: "oklch(0.94 0 0)",
    darkPrimaryFg: "oklch(0.10 0 0)",
    swatch: "#000000",
  },
];

// ─── Font Options ─────────────────────────────────────────────────────────────

export type FontFamilyId = "geist" | "inter" | "system" | "mono" | "poppins";

export const FONT_OPTIONS: { id: FontFamilyId; label: string; value: string; googleFont?: string }[] = [
  { id: "geist", label: "Geist Sans", value: "var(--font-geist-sans), system-ui, sans-serif" },
  { id: "inter", label: "Inter", value: "'Inter', system-ui, sans-serif", googleFont: "Inter:wght@300;400;500;600;700" },
  { id: "system", label: "System UI", value: "system-ui, -apple-system, sans-serif" },
  { id: "mono", label: "Monospace", value: "'JetBrains Mono', 'Fira Code', monospace", googleFont: "JetBrains+Mono:wght@400;500;600;700" },
  { id: "poppins", label: "Poppins", value: "'Poppins', system-ui, sans-serif", googleFont: "Poppins:wght@300;400;500;600;700" },
];

// ─── Density ──────────────────────────────────────────────────────────────────

export type DensityId = "compact" | "default" | "relaxed";

// ─── Radius ───────────────────────────────────────────────────────────────────

export const RADIUS_OPTIONS = [
  { id: "none", label: "None", value: "0" },
  { id: "sm", label: "Small", value: "0.375rem" },
  { id: "md", label: "Medium", value: "0.625rem" },
  { id: "lg", label: "Large", value: "0.875rem" },
  { id: "full", label: "Full", value: "1.25rem" },
] as const;

export type RadiusId = (typeof RADIUS_OPTIONS)[number]["id"];

// ─── Module Flags ─────────────────────────────────────────────────────────────

export interface ModuleFlags {
  attendance: boolean;
  leave: boolean;
  payroll: boolean;
  loans: boolean;
  projects: boolean;
  reports: boolean;
  timesheets: boolean;
  kiosk: boolean;
  notifications: boolean;
  audit: boolean;
  directory: boolean;
  tasks: boolean;
  messages: boolean;
}

export const DEFAULT_MODULE_FLAGS: ModuleFlags = {
  attendance: true,
  leave: true,
  payroll: true,
  loans: true,
  projects: true,
  reports: true,
  timesheets: true,
  kiosk: true,
  notifications: true,
  audit: true,
  directory: true,
  tasks: true,
  messages: true,
};

export const MODULE_INFO: Record<keyof ModuleFlags, { label: string; description: string; icon: string }> = {
  attendance: { label: "Attendance", description: "Clock-in/out tracking, geofencing, daily logs", icon: "Clock" },
  leave: { label: "Leave Management", description: "Leave requests, balances, approvals", icon: "CalendarOff" },
  payroll: { label: "Payroll", description: "Salary processing, payslips, deductions", icon: "Wallet" },
  loans: { label: "Loans", description: "Employee loan management & repayment tracking", icon: "Banknote" },
  projects: { label: "Projects", description: "Project tracking, task management", icon: "FolderKanban" },
  reports: { label: "Reports", description: "Analytics, government reports, exports", icon: "BarChart3" },
  timesheets: { label: "Timesheets", description: "Weekly timesheets and approvals", icon: "ClipboardList" },
  kiosk: { label: "Kiosk", description: "Self-service kiosk terminal for attendance", icon: "Building2" },
  notifications: { label: "Notifications", description: "SMS & email notification management", icon: "Bell" },
  audit: { label: "Audit Log", description: "System-wide audit trail & history", icon: "FileSearch" },
  directory: { label: "Employee Directory", description: "Employee directory and org chart", icon: "Contact" },
  tasks: { label: "Task Management", description: "Task groups, assignments, photo & GPS proof", icon: "ListTodo" },
  messages: { label: "Messaging Hub", description: "Channels, announcements, multi-channel messaging", icon: "MessageSquare" },
};

// ─── Navigation Overrides ─────────────────────────────────────────────────────

export interface NavOverride {
  /** href of the original nav item */
  href: string;
  /** Custom label (empty = use default) */
  label?: string;
  /** Custom icon name (empty = use default) */
  icon?: string;
  /** Sort order override */
  order?: number;
  /** Whether to hide from sidebar */
  hidden?: boolean;
}

// ─── Sidebar Variant ──────────────────────────────────────────────────────────

export type SidebarVariant = "default" | "colored";

// ─── Login Page Config ────────────────────────────────────────────────────────

export type LoginBackground = "gradient" | "solid" | "pattern";
export type LoginCardStyle = "centered" | "split";

// ─── Store Interface ──────────────────────────────────────────────────────────

export interface AppearanceState {
  // Color Theme
  colorTheme: ColorThemeId;
  customPrimaryLight: string;
  customPrimaryDark: string;

  // Typography & Layout
  fontFamily: FontFamilyId;
  radius: RadiusId;
  density: DensityId;

  // Branding
  companyName: string;
  logoUrl: string;
  logoTextVisible: boolean;
  faviconUrl: string;
  brandTagline: string;
  accentBadgeText: string;

  // Module Flags
  modules: ModuleFlags;

  // Navigation Overrides
  navOverrides: NavOverride[];

  // Shell Config
  sidebarVariant: SidebarVariant;
  showCompanyNameInTopbar: boolean;
  topbarBannerEnabled: boolean;
  topbarBannerText: string;
  topbarBannerColor: string;

  // Login Page
  loginBackground: LoginBackground;
  loginBgColor: string;
  loginCardStyle: LoginCardStyle;
  loginHeading: string;
  loginSubheading: string;

  // Actions
  setColorTheme: (theme: ColorThemeId) => void;
  setCustomPrimary: (light: string, dark: string) => void;
  setFontFamily: (font: FontFamilyId) => void;
  setRadius: (radius: RadiusId) => void;
  setDensity: (density: DensityId) => void;
  setBranding: (patch: Partial<Pick<AppearanceState, "companyName" | "logoUrl" | "logoTextVisible" | "faviconUrl" | "brandTagline" | "accentBadgeText">>) => void;
  toggleModule: (mod: keyof ModuleFlags) => void;
  setModules: (mods: ModuleFlags) => void;
  setNavOverrides: (overrides: NavOverride[]) => void;
  updateNavOverride: (href: string, patch: Partial<NavOverride>) => void;
  setSidebarVariant: (variant: SidebarVariant) => void;
  setTopbarBanner: (patch: Partial<Pick<AppearanceState, "topbarBannerEnabled" | "topbarBannerText" | "topbarBannerColor">>) => void;
  setShowCompanyNameInTopbar: (show: boolean) => void;
  setLoginConfig: (patch: Partial<Pick<AppearanceState, "loginBackground" | "loginBgColor" | "loginCardStyle" | "loginHeading" | "loginSubheading">>) => void;
  resetAppearance: () => void;
}

const INITIAL_STATE = {
  colorTheme: "default" as ColorThemeId,
  customPrimaryLight: "oklch(0.488 0.243 264.376)",
  customPrimaryDark: "oklch(0.623 0.214 259.815)",
  fontFamily: "geist" as FontFamilyId,
  radius: "md" as RadiusId,
  density: "default" as DensityId,
  companyName: "NexHRMS",
  logoUrl: "",
  logoTextVisible: true,
  faviconUrl: "",
  brandTagline: "",
  accentBadgeText: "",
  modules: { ...DEFAULT_MODULE_FLAGS },
  navOverrides: [] as NavOverride[],
  sidebarVariant: "default" as SidebarVariant,
  showCompanyNameInTopbar: false,
  topbarBannerEnabled: false,
  topbarBannerText: "",
  topbarBannerColor: "#3b82f6",
  loginBackground: "gradient" as LoginBackground,
  loginBgColor: "",
  loginCardStyle: "centered" as LoginCardStyle,
  loginHeading: "NexHRMS",
  loginSubheading: "Sign in to your account to continue",
};

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setColorTheme: (colorTheme) => set({ colorTheme }),

      setCustomPrimary: (customPrimaryLight, customPrimaryDark) =>
        set({ customPrimaryLight, customPrimaryDark, colorTheme: "custom" }),

      setFontFamily: (fontFamily) => set({ fontFamily }),

      setRadius: (radius) => set({ radius }),

      setDensity: (density) => set({ density }),

      setBranding: (patch) => set((s) => ({ ...s, ...patch })),

      toggleModule: (mod) =>
        set((s) => ({
          modules: { ...s.modules, [mod]: !s.modules[mod] },
        })),

      setModules: (modules) => set({ modules }),

      setNavOverrides: (navOverrides) => set({ navOverrides }),

      updateNavOverride: (href, patch) =>
        set((s) => {
          const idx = s.navOverrides.findIndex((o) => o.href === href);
          if (idx === -1) {
            return { navOverrides: [...s.navOverrides, { href, ...patch }] };
          }
          const updated = [...s.navOverrides];
          updated[idx] = { ...updated[idx], ...patch };
          return { navOverrides: updated };
        }),

      setSidebarVariant: (sidebarVariant) => set({ sidebarVariant }),

      setTopbarBanner: (patch) => set((s) => ({ ...s, ...patch })),

      setShowCompanyNameInTopbar: (showCompanyNameInTopbar) => set({ showCompanyNameInTopbar }),

      setLoginConfig: (patch) => set((s) => ({ ...s, ...patch })),

      resetAppearance: () => set(INITIAL_STATE),
    }),
    {
      name: "nexhrms-appearance",
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          const oldModules = (state.modules ?? {}) as Record<string, boolean>;
          state.modules = { ...DEFAULT_MODULE_FLAGS, ...oldModules };
        }
        return state as unknown as AppearanceState;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppearanceState>;
        // Deep-merge modules so new defaults are always present
        return {
          ...current,
          ...p,
          modules: { ...DEFAULT_MODULE_FLAGS, ...(p.modules ?? {}) },
        };
      },
    }
  )
);
