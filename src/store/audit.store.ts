"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { AuditLogEntry, AuditAction } from "@/types";

interface AuditState {
    logs: AuditLogEntry[];
    resetToSeed: () => void;
    log: (data: {
        entityType: string;
        entityId: string;
        action: AuditAction;
        performedBy: string;
        reason?: string;
        beforeSnapshot?: Record<string, unknown>;
        afterSnapshot?: Record<string, unknown>;
    }) => void;
    getByEntity: (entityType: string, entityId: string) => AuditLogEntry[];
    getByAction: (action: AuditAction) => AuditLogEntry[];
    getByPerformer: (performedBy: string) => AuditLogEntry[];
    getRecent: (limit?: number) => AuditLogEntry[];
    clearLogs: () => void;
}

export const useAuditStore = create<AuditState>()(
    persist(
        (set, get) => ({
            logs: [],
            log: (data) =>
                set((s) => ({
                    logs: [
                        {
                            id: `AUD-${nanoid(8)}`,
                            ...data,
                            timestamp: new Date().toISOString(),
                        },
                        ...s.logs, // newest first
                    ],
                })),
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
        }),
        { name: "nexhrms-audit", version: 1 }
    )
);
