"use client";
/**
 * Location Actions Service — DB-first mutations.
 *
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 9 of ZUSTAND_MIGRATION_CHECKLIST.md
 */

import { locationDb } from "./db.service";
import { useLocationStore } from "@/store/location.store";
import type { LocationPing, SiteSurveyPhoto, BreakRecord, LocationTrackingConfig } from "@/types";
import { nanoid } from "nanoid";

/**
 * Update location config — DB-first via /api/settings/location PATCH.
 */
export async function updateConfig(patch: Partial<LocationTrackingConfig>): Promise<boolean> {
    try {
        const res = await fetch("/api/settings/location", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        });
        if (!res.ok) return false;

        // Update local cache
        useLocationStore.setState((s) => ({
            config: { ...s.config, ...patch },
        }));
        return true;
    } catch {
        return false;
    }
}

/**
 * Reset config to defaults — DB-first.
 */
export async function resetConfig(defaults: LocationTrackingConfig): Promise<boolean> {
    try {
        const res = await fetch("/api/settings/location", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(defaults),
        });
        if (!res.ok) return false;

        useLocationStore.setState({
            config: { ...defaults },
            photos: [],
            breaks: [],
            pings: [],
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Add a location ping — DB-first.
 */
export async function addPing(data: Omit<LocationPing, "id">): Promise<boolean> {
    const ping: LocationPing = { ...data, id: `PING-${nanoid(8)}` };

    // 1. Write to DB first
    const ok = await locationDb.insertPing(ping);
    if (!ok) return false;

    // 2. Update local cache
    useLocationStore.setState((s) => ({
        pings: [...s.pings, ping],
    }));
    return true;
}

/**
 * Add a site survey photo — DB-first.
 */
export async function addPhoto(data: Omit<SiteSurveyPhoto, "id">): Promise<{ ok: boolean; id?: string }> {
    const id = `PHOTO-${nanoid(8)}`;
    const photo: SiteSurveyPhoto = { ...data, id };

    // 1. Write to DB first
    const ok = await locationDb.upsertPhoto(photo);
    if (!ok) return { ok: false };

    // 2. Update local cache (keep max 100)
    useLocationStore.setState((s) => ({
        photos: [photo, ...s.photos].slice(0, 100),
    }));
    return { ok: true, id };
}

/**
 * Start a break — DB-first.
 */
export async function startBreak(data: {
    employeeId: string;
    breakType: "lunch" | "other";
    lat?: number;
    lng?: number;
}): Promise<{ ok: boolean; id?: string }> {
    const id = `BRK-${nanoid(8)}`;
    const now = new Date();
    const breakRecord: BreakRecord = {
        id,
        employeeId: data.employeeId,
        date: now.toISOString().split("T")[0],
        breakType: data.breakType,
        startTime: now.toISOString(),
        startLat: data.lat,
        startLng: data.lng,
    };

    // 1. Write to DB first
    const ok = await locationDb.upsertBreak(breakRecord);
    if (!ok) return { ok: false };

    // 2. Update local cache
    useLocationStore.setState((s) => ({
        breaks: [...s.breaks, breakRecord],
    }));
    return { ok: true, id };
}

/**
 * End a break — DB-first.
 */
export async function endBreak(
    breakId: string,
    data: { lat?: number; lng?: number; geofencePass?: boolean; distanceFromSite?: number }
): Promise<boolean> {
    const store = useLocationStore.getState();
    const existing = store.breaks.find((b) => b.id === breakId);
    if (!existing || existing.endTime) return false;

    const endTime = new Date().toISOString();
    const duration = Math.round(
        (new Date(endTime).getTime() - new Date(existing.startTime).getTime()) / 60000
    );
    const config = store.config;
    const overtime = duration > config.lunchDuration + config.lunchOvertimeThreshold;

    const updated: BreakRecord = {
        ...existing,
        endTime,
        endLat: data.lat,
        endLng: data.lng,
        endGeofencePass: data.geofencePass,
        distanceFromSite: data.distanceFromSite,
        duration,
        overtime,
    };

    // 1. Write to DB first
    const ok = await locationDb.upsertBreak(updated);
    if (!ok) return false;

    // 2. Update local cache
    useLocationStore.setState((s) => ({
        breaks: s.breaks.map((b) => (b.id === breakId ? updated : b)),
    }));
    return true;
}
