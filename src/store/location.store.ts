"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
    SiteSurveyPhoto,
    BreakRecord,
    LocationPing,
    LocationTrackingConfig,
} from "@/types";

// ─── Defaults ─────────────────────────────────────────────────

const DEFAULT_CONFIG: LocationTrackingConfig = {
    enabled: true,
    pingIntervalMinutes: 10,
    requireLocation: true,
    warnEmployeeOutOfFence: true,
    alertAdminOutOfFence: true,
    alertAdminLocationDisabled: true,
    trackDuringBreaks: false,
    retainDays: 30,
    // Selfie
    requireSelfie: false,
    selfieRequiredProjects: [],
    selfieMaxAge: 60,
    showReverseGeocode: true,
    selfieCompressionQuality: 0.6,
    // Break / Lunch
    lunchDuration: 60,
    lunchGeofenceRequired: true,
    lunchOvertimeThreshold: 5,
    alertAdminOnGeofenceViolation: true,
    allowedBreaksPerDay: 1,
    breakGracePeriod: 5,
};

const MAX_PHOTOS = 100;

// ─── Store ────────────────────────────────────────────────────

interface LocationState {
    config: LocationTrackingConfig;
    photos: SiteSurveyPhoto[];
    breaks: BreakRecord[];
    pings: LocationPing[];

    // Config
    updateConfig: (patch: Partial<LocationTrackingConfig>) => void;
    resetConfig: () => void;

    // Photos (site survey selfies)
    addPhoto: (data: Omit<SiteSurveyPhoto, "id">) => string;
    getPhotos: (employeeId?: string) => SiteSurveyPhoto[];
    purgeOldPhotos: () => void;

    // Break records
    startBreak: (data: { employeeId: string; breakType: "lunch" | "other"; lat?: number; lng?: number }) => string;
    endBreak: (breakId: string, data: { lat?: number; lng?: number; geofencePass?: boolean; distanceFromSite?: number }) => void;
    getActiveBreak: (employeeId: string) => BreakRecord | undefined;
    getBreaks: (employeeId: string, date?: string) => BreakRecord[];
    getBreaksToday: (employeeId: string) => BreakRecord[];

    // Location pings
    addPing: (data: Omit<LocationPing, "id">) => void;
    getPings: (employeeId: string, date?: string) => LocationPing[];
    purgeOldPings: () => void;

    resetToSeed: () => void;
}

export const useLocationStore = create<LocationState>()(
    persist(
        (set, get) => ({
            config: { ...DEFAULT_CONFIG },
            photos: [],
            breaks: [],
            pings: [],

            // ─── Config ────────────────────────────────
            updateConfig: (patch) =>
                set((s) => ({ config: { ...s.config, ...patch } })),

            resetConfig: () => set({ config: { ...DEFAULT_CONFIG } }),

            // ─── Photos ────────────────────────────────
            addPhoto: (data) => {
                const id = `PHOTO-${nanoid(8)}`;
                set((s) => {
                    const photos = [{ ...data, id }, ...s.photos];
                    // Auto-purge oldest if over limit
                    return { photos: photos.slice(0, MAX_PHOTOS) };
                });
                return id;
            },

            getPhotos: (employeeId) => {
                const all = get().photos;
                return employeeId ? all.filter((p) => p.employeeId === employeeId) : all;
            },

            purgeOldPhotos: () =>
                set((s) => ({ photos: s.photos.slice(0, MAX_PHOTOS) })),

            // ─── Breaks ────────────────────────────────
            startBreak: (data) => {
                const id = `BRK-${nanoid(8)}`;
                const now = new Date();
                set((s) => ({
                    breaks: [
                        ...s.breaks,
                        {
                            id,
                            employeeId: data.employeeId,
                            date: now.toISOString().split("T")[0],
                            breakType: data.breakType,
                            startTime: now.toISOString(),
                            startLat: data.lat,
                            startLng: data.lng,
                        },
                    ],
                }));
                return id;
            },

            endBreak: (breakId, data) =>
                set((s) => ({
                    breaks: s.breaks.map((b) => {
                        if (b.id !== breakId || b.endTime) return b;
                        const endTime = new Date().toISOString();
                        const duration = Math.round(
                            (new Date(endTime).getTime() - new Date(b.startTime).getTime()) / 60000
                        );
                        const config = s.config;
                        const overtime = duration > config.lunchDuration + config.lunchOvertimeThreshold;
                        return {
                            ...b,
                            endTime,
                            endLat: data.lat,
                            endLng: data.lng,
                            endGeofencePass: data.geofencePass,
                            distanceFromSite: data.distanceFromSite,
                            duration,
                            overtime,
                        };
                    }),
                })),

            getActiveBreak: (employeeId) =>
                get().breaks.find((b) => b.employeeId === employeeId && !b.endTime),

            getBreaks: (employeeId, date) => {
                const all = get().breaks.filter((b) => b.employeeId === employeeId);
                return date ? all.filter((b) => b.date === date) : all;
            },

            getBreaksToday: (employeeId) => {
                const today = new Date().toISOString().split("T")[0];
                return get().breaks.filter((b) => b.employeeId === employeeId && b.date === today);
            },

            // ─── Location pings ────────────────────────
            addPing: (data) =>
                set((s) => ({
                    pings: [...s.pings, { ...data, id: `PING-${nanoid(8)}` }],
                })),

            getPings: (employeeId, date) => {
                const all = get().pings.filter((p) => p.employeeId === employeeId);
                if (!date) return all;
                return all.filter((p) => p.timestamp.startsWith(date));
            },

            purgeOldPings: () =>
                set((s) => {
                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - s.config.retainDays);
                    const cutoffStr = cutoff.toISOString();
                    return { pings: s.pings.filter((p) => p.timestamp >= cutoffStr) };
                }),

            resetToSeed: () =>
                set({
                    config: { ...DEFAULT_CONFIG },
                    photos: [],
                    breaks: [],
                    pings: [],
                }),
        }),
        { name: "nexhrms-location", version: 1 }
    )
);
