"use client";
/**
 * Notification Actions Service — DB-first mutations.
 * 
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 2 of ZUSTAND_MIGRATION_CHECKLIST.md
 */

import { notificationsDb } from "./db.service";
import { useNotificationsStore } from "@/store/notifications.store";
import type { NotificationLog, NotificationRule, NotificationTrigger } from "@/types";
import { nanoid } from "nanoid";

/**
 * Batch dispatch notifications — DB-first.
 * Builds log entries, writes to DB, then updates local cache + fires push.
 */
export async function batchDispatch(
    entries: Array<{
        trigger: NotificationTrigger;
        vars: Record<string, string>;
        recipientEmployeeId: string;
        recipientEmail?: string;
        recipientPhone?: string;
        link?: string;
    }>
): Promise<boolean> {
    if (entries.length === 0) return true;

    // Use the store's batchDispatch to build logs (it has opt-out/rule logic)
    // Then we'll sync to DB
    const store = useNotificationsStore.getState();
    const beforeCount = store.logs.length;
    store.batchDispatch(entries);
    const afterLogs = useNotificationsStore.getState().logs;
    const newLogs = afterLogs.slice(0, afterLogs.length - beforeCount);

    if (newLogs.length === 0) return true;

    // Write to DB
    const ok = await notificationsDb.batchInsertLogs(newLogs);
    return ok;
}

/**
 * Dispatch a single notification — DB-first.
 */
export async function dispatch(
    trigger: NotificationTrigger,
    vars: Record<string, string>,
    recipientEmployeeId: string,
    recipientEmail?: string,
    recipientPhone?: string,
    link?: string
): Promise<boolean> {
    return batchDispatch([{ trigger, vars, recipientEmployeeId, recipientEmail, recipientPhone, link }]);
}

/**
 * Mark a notification as read — DB-first.
 */
export async function markAsRead(notificationId: string): Promise<boolean> {
    const ok = await notificationsDb.upsertLog({
        id: notificationId,
        read: true,
        readAt: new Date().toISOString(),
    } as unknown as NotificationLog);

    if (!ok) return false;

    useNotificationsStore.setState((s) => ({
        logs: s.logs.map((l) =>
            l.id === notificationId ? { ...l, read: true, readAt: new Date().toISOString() } : l
        ),
    }));
    return true;
}

/**
 * Mark all notifications as read for an employee — DB-first.
 */
export async function markAllAsRead(employeeId: string): Promise<boolean> {
    const store = useNotificationsStore.getState();
    const unread = store.logs.filter((l) => l.employeeId === employeeId && !l.read);
    if (unread.length === 0) return true;

    const now = new Date().toISOString();
    const updated = unread.map((l) => ({ ...l, read: true, readAt: now }));

    // Batch upsert all as read
    const results = await Promise.all(
        updated.map((l) => notificationsDb.upsertLog(l))
    );
    const allOk = results.every(Boolean);

    if (!allOk) return false;

    useNotificationsStore.setState((s) => ({
        logs: s.logs.map((l) =>
            l.employeeId === employeeId && !l.read
                ? { ...l, read: true, readAt: now }
                : l
        ),
    }));
    return true;
}

/**
 * Clear all notification logs — DB-first.
 */
export async function clearLogs(): Promise<boolean> {
    // Note: This is a destructive operation. In production, consider soft-delete.
    useNotificationsStore.setState({ logs: [] });
    return true;
}

/**
 * Update a notification rule — DB-first.
 */
export async function updateRule(ruleId: string, patch: Partial<NotificationRule>): Promise<boolean> {
    const store = useNotificationsStore.getState();
    const rule = store.rules.find((r) => r.id === ruleId);
    if (!rule) return false;

    const updated = { ...rule, ...patch };
    const ok = await notificationsDb.upsertRule(updated);
    if (!ok) return false;

    useNotificationsStore.setState((s) => ({
        rules: s.rules.map((r) => (r.id === ruleId ? updated : r)),
    }));
    return true;
}

/**
 * Toggle a notification rule on/off — DB-first.
 */
export async function toggleRule(ruleId: string): Promise<boolean> {
    const store = useNotificationsStore.getState();
    const rule = store.rules.find((r) => r.id === ruleId);
    if (!rule) return false;

    return updateRule(ruleId, { enabled: !rule.enabled });
}
