/**
 * Clear stale Zustand persist() localStorage keys.
 *
 * These keys belonged to stores that previously used persist() middleware
 * but now rely on Supabase hydration as the source of truth. Removing them
 * prevents stale data from being rehydrated on page load.
 *
 * Called automatically at the start of hydrateAllStores().
 */

const STALE_KEYS = [
  // Stores that had persist() removed (now Supabase-hydrated)
  "nexhrms-bir-compliance",
  "soren-disciplinary",
  "soren-documents",
  "performance-store",
  // Legacy keys from older store versions that may still exist in user browsers
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
];

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
