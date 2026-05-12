/**
 * Validated environment accessors.
 * Throws at startup if required vars are missing (when not in demo mode).
 */

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Supabase project URL — required unless demo mode.
 * IMPORTANT: Must use static dot-notation for NEXT_PUBLIC_ vars —
 * Next.js/Turbopack only inlines these at build time with static property access.
 * Dynamic bracket access (`process.env[name]`) returns undefined in client bundles.
 */
export function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value && !isDemoMode) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }
  return value ?? "";
}

/** Supabase anonymous key — required unless demo mode. */
export function getSupabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value && !isDemoMode) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return value ?? "";
}

/** Service role key — server-side only (dynamic access is fine in Node.js). */
export function getServiceRoleKey(): string {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}

// ─── Qwen AI (DashScope) ─────────────────────────────────────────────────────

/** DashScope API base URL for Qwen vision models. */
export function getDashScopeBaseUrl(): string {
  return process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
}

/** Qwen API key — server-side only. */
export function getQwenApiKey(): string | undefined {
  return process.env.QWEN_API_KEY;
}

/**
 * Qwen model name based on environment.
 * Production uses qwen-vl-max (best accuracy / liveness detection).
 * Development uses qwen-vl-plus (faster, cheaper).
 */
export function getQwenModel(): string {
  if (process.env.QWEN_MODEL) return process.env.QWEN_MODEL;
  return process.env.NODE_ENV === "production" ? "qwen-vl-max" : "qwen-vl-plus";
}

/** Face template encryption key — server-side only. */
export function getFaceTemplateEncryptionKey(): string {
  return process.env.FACE_TEMPLATE_ENCRYPTION_KEY || "soren-default-key-change-in-production";
}

// ─── T800 Biometric Bridge ───────────────────────────────────────────────────

/** T800 bridge target URL — server-side only. */
export function getT800BridgeTargetUrl(): string {
  return process.env.T800_BRIDGE_TARGET_URL || process.env.HRMS_URL || "http://localhost:3000/api/attendance/t800";
}

/** Comma-separated list of allowed T800 device IDs — server-side only. */
export function getT800AllowedDeviceIds(): string[] {
  return (process.env.T800_DEVICE_IDS || process.env.BIOMETRIC_DEVICE_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** T800 request code accepted by the attendance adapter. */
export function getT800RequestCode(): string {
  return process.env.T800_REQUEST_CODE || "realtime_glog";
}

/** When true, legacy biometric endpoints and UI are disabled and only T800 flow is allowed. */
export function getT800Only(): boolean {
  return process.env.T800_ONLY === "true";
}

// ─── Kiosk Security ───────────────────────────────────────────────────────────

/** Kiosk device API key — server-side only. Optional in dev, required in production. */
export function getKioskApiKey(): string | undefined {
  return process.env.KIOSK_API_KEY;
}
