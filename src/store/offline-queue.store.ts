"use client";

/**
 * Kiosk Offline Queue
 * 
 * Stores attendance events locally when network is unavailable.
 * Automatically syncs when connection is restored.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import { nanoid } from "nanoid";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueuedEvent {
    id: string;
    employeeId: string;
    eventType: "IN" | "OUT" | "BREAK_START" | "BREAK_END";
    timestampUTC: string;
    deviceId: string;
    projectId?: string;
    method: "qr" | "face";
    queuedAt: string;
    retryCount: number;
    lastError?: string;
}

export type SyncStatus = "idle" | "syncing" | "error" | "offline";

interface OfflineQueueStore {
    // ── State ──
    queue: QueuedEvent[];
    syncStatus: SyncStatus;
    lastSyncAt: string | null;
    isOnline: boolean;

    // ── Actions ──
    addToQueue: (event: Omit<QueuedEvent, "id" | "queuedAt" | "retryCount">) => void;
    removeFromQueue: (id: string) => void;
    clearQueue: () => void;
    markRetry: (id: string, error: string) => void;
    setSyncStatus: (status: SyncStatus) => void;
    setOnline: (online: boolean) => void;
    syncQueue: () => Promise<{ synced: number; failed: number }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RETRIES = 5;
const SYNC_ENDPOINT = "/api/attendance/sync-offline";

// ─── Store ────────────────────────────────────────────────────────────────────

export const useOfflineQueueStore = create<OfflineQueueStore>()(
    persist(
        (set, get) => ({
            queue: [],
            syncStatus: "idle",
            lastSyncAt: null,
            isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,

            addToQueue: (event) => {
                const newEvent: QueuedEvent = {
                    ...event,
                    id: `QUEUE-${nanoid(8)}`,
                    queuedAt: new Date().toISOString(),
                    retryCount: 0,
                };
                set((s) => ({ queue: [...s.queue, newEvent] }));
                console.log("[offline-queue] Event queued:", newEvent.id, newEvent.eventType);
            },

            removeFromQueue: (id) => {
                set((s) => ({ queue: s.queue.filter((e) => e.id !== id) }));
            },

            clearQueue: () => {
                set({ queue: [] });
            },

            markRetry: (id, error) => {
                set((s) => ({
                    queue: s.queue.map((e) =>
                        e.id === id
                            ? { ...e, retryCount: e.retryCount + 1, lastError: error }
                            : e
                    ),
                }));
            },

            setSyncStatus: (status) => {
                set({ syncStatus: status });
            },

            setOnline: (online) => {
                set({ isOnline: online });
                if (online) {
                    // Auto-sync when coming back online
                    get().syncQueue();
                }
            },

            syncQueue: async () => {
                const state = get();
                
                if (!state.isOnline) {
                    set({ syncStatus: "offline" });
                    return { synced: 0, failed: 0 };
                }

                if (state.queue.length === 0) {
                    set({ syncStatus: "idle" });
                    return { synced: 0, failed: 0 };
                }

                set({ syncStatus: "syncing" });

                let synced = 0;
                let failed = 0;

                // Process queue in order
                for (const event of state.queue) {
                    if (event.retryCount >= MAX_RETRIES) {
                        console.warn("[offline-queue] Max retries exceeded for:", event.id);
                        failed++;
                        continue;
                    }

                    try {
                        const response = await fetch(SYNC_ENDPOINT, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                employeeId: event.employeeId,
                                eventType: event.eventType,
                                timestampUTC: event.timestampUTC,
                                deviceId: event.deviceId,
                                projectId: event.projectId,
                                method: event.method,
                                queuedAt: event.queuedAt,
                            }),
                        });

                        if (response.ok) {
                            get().removeFromQueue(event.id);
                            synced++;
                            console.log("[offline-queue] Synced:", event.id);
                        } else {
                            const error = await response.text();
                            get().markRetry(event.id, error);
                            failed++;
                            console.error("[offline-queue] Sync failed:", event.id, error);
                        }
                    } catch (err) {
                        const error = err instanceof Error ? err.message : "Network error";
                        get().markRetry(event.id, error);
                        failed++;
                        console.error("[offline-queue] Sync error:", event.id, error);
                    }
                }

                set({
                    syncStatus: failed > 0 ? "error" : "idle",
                    lastSyncAt: new Date().toISOString(),
                });

                return { synced, failed };
            },
        }),
        {
            name: "soren-offline-queue",
            version: 1,
            storage: safePersistStorage,
        }
    )
);

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Hook to monitor online status and auto-sync
 */
export function useOfflineSync() {
    const { setOnline, syncQueue, isOnline, syncStatus, queue } = useOfflineQueueStore();

    // Set up online/offline listeners
    if (typeof window !== "undefined") {
        window.addEventListener("online", () => setOnline(true));
        window.addEventListener("offline", () => setOnline(false));
    }

    return {
        isOnline,
        syncStatus,
        queueLength: queue.length,
        syncNow: syncQueue,
    };
}

export default useOfflineQueueStore;
