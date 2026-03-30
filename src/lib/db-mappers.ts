/**
 * DB ↔ TypeScript mapping utilities.
 *
 * Handles:
 * - snake_case (SQL) ↔ camelCase (TS) key conversion
 * - Flattened SQL columns ↔ nested TS objects (location, segments, etc.)
 */

// ─── Generic snake_case ↔ camelCase Converters ───────────────────────────────

/** Convert a single snake_case key to camelCase */
export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Convert a single camelCase key to snake_case */
export function camelToSnake(key: string): string {
  // Insert _ before a capital that is preceded by a lowercase/digit,
  // or before a capital that is followed by lowercase (handles acronyms like UTC, ID).
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/** Recursively convert all keys in an object from snake_case to camelCase */
export function rowToTs<T extends Record<string, unknown>>(
  row: Record<string, unknown>,
): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamel(key)] = value;
  }
  return result as T;
}

/** Recursively convert all keys in an object from camelCase to snake_case */
export function tsToRow(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value;
  }
  return result;
}

// ─── Project Location: flat SQL cols ↔ nested TS object ──────────────────────

export interface ProjectRow {
  location_lat?: number | null;
  location_lng?: number | null;
  location_radius?: number | null;
  [key: string]: unknown;
}

export function projectRowToTs(row: ProjectRow) {
  const { location_lat, location_lng, location_radius, ...rest } = row;
  const base = rowToTs<Record<string, unknown>>(rest);
  if (location_lat != null && location_lng != null) {
    base.location = {
      lat: location_lat,
      lng: location_lng,
      radius: location_radius ?? 100,
    };
  }
  return base;
}

export function projectTsToRow(obj: Record<string, unknown>) {
  const { location, ...rest } = obj;
  const row = tsToRow(rest);
  if (location && typeof location === "object") {
    const loc = location as { lat: number; lng: number; radius: number };
    row.location_lat = loc.lat;
    row.location_lng = loc.lng;
    row.location_radius = loc.radius;
  }
  return row;
}

// ─── Attendance Log Location: flat SQL cols ↔ nested TS object ───────────────

export interface AttendanceLogRow {
  location_lat?: number | null;
  location_lng?: number | null;
  [key: string]: unknown;
}

export function attendanceLogRowToTs(row: AttendanceLogRow) {
  const { location_lat, location_lng, ...rest } = row;
  const base = rowToTs<Record<string, unknown>>(rest);
  if (location_lat != null && location_lng != null) {
    base.locationSnapshot = { lat: location_lat, lng: location_lng };
  }
  return base;
}

export function attendanceLogTsToRow(obj: Record<string, unknown>) {
  const { locationSnapshot, ...rest } = obj;
  const row = tsToRow(rest);
  if (locationSnapshot && typeof locationSnapshot === "object") {
    const snap = locationSnapshot as { lat: number; lng: number };
    row.location_lat = snap.lat;
    row.location_lng = snap.lng;
  }
  return row;
}

// ─── Timesheet Segments: JSONB string ↔ typed array ──────────────────────────

import type { TimesheetSegment } from "@/types";

export function parseSegments(raw: unknown): TimesheetSegment[] {
  if (Array.isArray(raw)) return raw as TimesheetSegment[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ─── Batch Converters ────────────────────────────────────────────────────────

/** Convert an array of DB rows to TS objects */
export function rowsToTs<T extends Record<string, unknown>>(
  rows: Record<string, unknown>[],
): T[] {
  return rows.map((r) => rowToTs<T>(r));
}
