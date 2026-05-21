/**
 * Clear stale Zustand persist() localStorage keys.
 *
 * These keys belonged to stores that previously used persist() middleware
 * but now rely on Supabase hydration as the source of truth. Removing them
 * prevents stale data from being rehydrated on page load.
 *
 * Called automatically at the start of hydrateAllStores().
 */

/**
 * Every known Zustand persist key that should NOT be in localStorage.
 * Includes both current keys from recently de-persisted stores and
 * legacy keys from older store versions that may still exist on user devices.
 */
const STALE_KEYS = [
  // Stores that had persist() removed (now Supabase-hydrated)
  "nexhrms-bir-compliance",
  "soren-disciplinary",
  "soren-documents",
  "performance-store",
  // Legacy keys from older store versions (referenced in storage.ts EVICTION_ORDER)
  "soren-employees",
  "soren-attendance",
  "soren-payroll",
  "soren-leave",
  "soren-loans",
  "soren-notifications",
  "soren-messaging",
  "soren-tasks",
  "soren-timesheet",
  "soren-audit",
  "soren-events",
  "soren-projects",
  "soren-location",
  "soren-deductions",
  "soren-jobs",
  "soren-departments",
  "soren-job-titles",
  "soren-roles",
  // Alternate key formats that may exist on older installs
  "nexhrms-deductions",
  "hrms-departments",
  "hrms-job-titles",
  "nexhrms-employees",
  "nexhrms-attendance",
  "nexhrms-payroll",
  "nexhrms-leave",
  "nexhrms-loans",
  "nexhrms-notifications",
  "nexhrms-messaging",
  "nexhrms-tasks",
  "nexhrms-timesheet",
  "nexhrms-audit",
  "nexhrms-events",
  "nexhrms-projects",
  "nexhrms-location",
  "nexhrms-performance",
  "nexhrms-disciplinary",
  "nexhrms-documents",
  "nexhrms-jobs",
  "nexhrms-roles",
];

/**
 * Keys that should be KEPT — active persist() stores.
 * Never clear these.
 */
const KEEP_KEYS = new Set([
  "soren-auth",
  "soren-appearance",
  "soren-kiosk-settings",
  "soren-offline-queue",
  "nexhrms-pages",
]);

/**
 * Remove stale localStorage keys. Returns the number of keys cleared.
 */
export function clearStaleStorage(): number {
  if (typeof window === "undefined") return 0;
  let cleared = 0;
  for (const key of STALE_KEYS) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      cleared++;
    }
  }
  if (cleared > 0) {
    console.info(`[storage] Cleared ${cleared} stale localStorage key(s)`);
  }
  return cleared;
}

/**
 * Nuclear clear: remove ALL Zustand-related localStorage keys except
 * the ones we explicitly want to keep (auth session, appearance, kiosk).
 * Use this when the targeted STALE_KEYS list misses entries.
 *
 * Returns the number of keys cleared.
 */
export function clearAllZustandStorage(): number {
  if (typeof window === "undefined") return 0;
  let cleared = 0;
  const keysToCheck = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) keysToCheck.push(key);
  }
  for (const key of keysToCheck) {
    if (KEEP_KEYS.has(key)) continue;
    // Zustand persist keys typically contain "soren-", "nexhrms-", "hrms-",
    // or are known store names like "performance-store"
    if (
      key.startsWith("soren-") ||
      key.startsWith("nexhrms-") ||
      key.startsWith("hrms-") ||
      key === "performance-store"
    ) {
      localStorage.removeItem(key);
      cleared++;
    }
  }
  if (cleared > 0) {
    console.info(`[storage] Nuclear clear: removed ${cleared} Zustand localStorage key(s)`);
  }
  return cleared;
}
