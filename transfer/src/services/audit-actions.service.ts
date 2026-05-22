"use client";
/**
 * Audit Actions Service — DB-first mutations.
 * 
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 3 of ZUSTAND_MIGRATION_CHECKLIST.md
 */

import { auditDb } from "./db.service";
import { useAuditStore } from "@/store/audit.store";
import type { AuditLogEntry, AuditAction } from "@/types";
import { nanoid } from "nanoid";

/**
 * Log an audit entry — DB-first.
 * Writes to Supabase, then prepends to local cache.
 */
export async function log(data: {
    entityType: string;
    entityId: string;
    action: AuditAction;
    performedBy: string;
    reason?: string;
    beforeSnapshot?: Record<string, unknown>;
    afterSnapshot?: Record<string, unknown>;
}): Promise<boolean> {
    const entry: AuditLogEntry = {
        id: `AUD-${nanoid(8)}`,
        ...data,
        timestamp: new Date().toISOString(),
    };

    // 1. Write to DB first
    const ok = await auditDb.insert(entry);
    if (!ok) return false;

    // 2. Update local cache
    useAuditStore.setState((s) => ({
        logs: [entry, ...s.logs],
    }));
    return true;
}

/**
 * Clear all audit logs from local cache.
 * Note: Does NOT delete from DB (audit logs are immutable in production).
 */
export function clearLocalLogs(): void {
    useAuditStore.setState({ logs: [] });
}
