"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import type { AuditLogEntry, AuditAction } from "@/types";
import { auditDb , shouldSync, hasValidSession } from "@/services/db.service";

type AuditLogData = {
    entityType: string;
    entityId: string;
    action: AuditAction;
    performedBy: string;
    reason?: string;
    beforeSnapshot?: Record<string, unknown>;
    afterSnapshot?: Record<string, unknown>;
};

interface AuditState {
    logs: AuditLogEntry[];
    resetToSeed: () => void;
    _hydrated: boolean;
    _hydrating: boolean;
    hydrateFromDb: () => Promise<void>;
    log: (data: AuditLogData) => void;
    /** Batch log — single setState for all entries + single batch DB write */
    batchLog: (entries: AuditLogData[]) => void;
    getByEntity: (entityType: string, entityId: string) => AuditLogEntry[];
    getByAction: (action: AuditAction) => AuditLogEntry[];
    getByPerformer: (performedBy: string) => AuditLogEntry[];
    getRecent: (limit?: number) => AuditLogEntry[];
    clearLogs: () => void;
}

export const useAuditStore = create<AuditState>()(
    (set, get) => ({
        logs: [],
        log: (data) => {
            const entry: AuditLogEntry = {
                id: `AUD-${nanoid(8)}`,
                ...data,
                timestamp: new Date().toISOString(),
            };
            // Update local cache immediately (optimistic)
            set((s) => ({ logs: [entry, ...s.logs] }));
            // Write to DB (fire-and-forget — don't block UI)
            auditDb.insert(entry).catch((err) => {
                console.warn("[audit] DB write failed (non-blocking):", err);
            });
        },
        batchLog: (entries) => {
            if (entries.length === 0) return;
            const now = new Date().toISOString();
            const newLogs: AuditLogEntry[] = entries.map((data) => ({
                id: `AUD-${nanoid(8)}`,
                ...data,
                timestamp: now,
            }));
            // Single setState for all entries
            set((s) => ({ logs: [...newLogs, ...s.logs] }));
            // Single batch DB write (fire-and-forget)
            auditDb.batchInsert(newLogs).catch((err) => {
                console.warn("[audit] batch DB write failed (non-blocking):", err);
            });
        },
        getByEntity: (entityType, entityId) =>
            get().logs.filter((l) => l.entityType === entityType && l.entityId === entityId),
        getByAction: (action) =>
            get().logs.filter((l) => l.action === action),
        getByPerformer: (performedBy) =>
            get().logs.filter((l) => l.performedBy === performedBy),
        getRecent: (limit = 50) =>
            get().logs.slice(0, limit),
        clearLogs: () => set({ logs: [] }),
        resetToSeed: () => set({ logs: [] }),
    
            // Self-hydration
            _hydrated: false,
            _hydrating: false,
            hydrateFromDb: async () => {
                const state = get();
                if (state._hydrated || state._hydrating) return;
                if (!shouldSync()) return;
                const validSession = await hasValidSession();
                if (!validSession) return;
                set({ _hydrating: true });
                try {
                    const logs = await auditDb.fetchAll();
                    const currentState = get();
                    if (currentState.logs.length === 0 && logs.length > 0) {
                        set({ logs, _hydrated: true, _hydrating: false });
                    } else {
                        set({ _hydrated: true, _hydrating: false });
                    }
                } catch (err) {
                    console.warn("[audit] hydrateFromDb failed:", err);
                    set({ _hydrating: false });
                }
            },
})
);
