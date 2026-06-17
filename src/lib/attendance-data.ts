"use client";

/**
 * Shared attendance data accessor.
 *
 * Provides imperative (non-hook) access to the current attendance state.
 * Used by service files that need cross-store reads (e.g. payroll-backfill).
 *
 * During migration: reads from the Zustand store.
 * After migration: will read from TanStack Query cache.
 */

import { useAttendanceStore } from "@/store/attendance.store";
import type { AttendanceLog, Holiday } from "@/types";

/**
 * Get all attendance logs (imperative, non-hook).
 */
export function getAttendanceLogs(): AttendanceLog[] {
    return useAttendanceStore.getState().logs;
}

/**
 * Get all holidays (imperative, non-hook).
 */
export function getHolidays(): Holiday[] {
    return useAttendanceStore.getState().holidays;
}
