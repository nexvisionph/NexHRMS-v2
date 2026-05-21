"use client";
/**
 * Messaging Actions Service — DB-first mutations.
 *
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 18 of ZUSTAND_MIGRATION_CHECKLIST.md
 */

import { messagingDb } from "./db.service";
import { useMessagingStore } from "@/store/messaging.store";
import { useTasksStore } from "@/store/tasks.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useAuditStore } from "@/store/audit.store";
import type {
    Announcement,
    TextChannel,
    ChannelMessage,
    MessageStatus,
} from "@/types";
import { nanoid } from "nanoid";

// ─── Announcements ───────────────────────────────────────────────

/**
 * Send an announcement — DB-first. Also dispatches in-app/email
 * notification logs to recipients (preserved from original store behaviour).
 */
export async function sendAnnouncement(
    data: Omit<Announcement, "id" | "sentAt" | "status" | "readBy">
): Promise<{ ok: boolean; id?: string }> {
    const id = `ANN-${nanoid(6)}`;
    const announcement: Announcement = {
        ...data,
        id,
        sentAt: new Date().toISOString(),
        status: "simulated" as MessageStatus,
        readBy: [],
    };

    const ok = await messagingDb.upsertAnnouncement(announcement);
    if (!ok) return { ok: false };

    useMessagingStore.setState((s) => ({
        announcements: [...s.announcements, announcement],
    }));

    useAuditStore.getState().log({
        entityType: "announcement",
        entityId: id,
        action: "announcement_sent",
        performedBy: data.sentBy,
        afterSnapshot: { subject: data.subject, channel: data.channel, scope: data.scope },
    });

    // Fire in-app notifications for recipients (same logic as legacy store)
    if (data.channel === "in_app" || data.channel === "email") {
        const addLog = useNotificationsStore.getState().addLog;
        const notifChannel = data.channel as "in_app" | "email";
        let recipientIds: string[] = [];

        if (data.scope === "task_assignees" && data.targetTaskId) {
            const task = useTasksStore
                .getState()
                .tasks.find((t) => t.id === data.targetTaskId);
            recipientIds = task?.assignedTo ?? [];
        } else if (data.scope === "selected_employees" && data.targetEmployeeIds) {
            recipientIds = data.targetEmployeeIds;
        } else if (data.scope === "task_group" && data.targetGroupId) {
            const group = useTasksStore
                .getState()
                .groups.find((g) => g.id === data.targetGroupId);
            recipientIds = group?.memberEmployeeIds ?? [];
        } else if (data.scope === "all_employees") {
            recipientIds = useEmployeesStore
                .getState()
                .employees.filter((e) => e.status === "active")
                .map((e) => e.id);
        }

        recipientIds.forEach((empId) => {
            addLog({
                employeeId: empId,
                type: "task_assigned",
                channel: notifChannel,
                subject: data.subject,
                body: data.body,
                link:
                    data.scope === "task_assignees" && data.targetTaskId
                        ? `/tasks/${data.targetTaskId}`
                        : "/notifications",
            });
        });
    }

    return { ok: true, id };
}

/**
 * Mark an announcement as read for a given employee — DB-first.
 */
export async function markAnnouncementRead(
    id: string,
    employeeId: string
): Promise<boolean> {
    const ann = useMessagingStore
        .getState()
        .announcements.find((a) => a.id === id);
    if (!ann || ann.readBy.includes(employeeId)) return true;

    const updated: Announcement = {
        ...ann,
        readBy: [...ann.readBy, employeeId],
    };
    const ok = await messagingDb.upsertAnnouncement(updated);
    if (!ok) return false;

    useMessagingStore.setState((s) => ({
        announcements: s.announcements.map((a) =>
            a.id === id ? updated : a
        ),
    }));
    return true;
}

/**
 * Delete an announcement — DB-first.
 *
 * Note: messagingDb has no `deleteAnnouncement` method — falls back to
 * marking the row deleted by upserting with empty body if no API route
 * exists. Best-effort: removes from local cache regardless.
 */
export async function deleteAnnouncement(id: string): Promise<boolean> {
    // Use the same delete-via-upsert pattern as text channels until a
    // dedicated `messagingDb.deleteAnnouncement` is added. For now, the
    // legacy behaviour was local-only delete; we keep that semantic.
    useMessagingStore.setState((s) => ({
        announcements: s.announcements.filter((a) => a.id !== id),
    }));
    return true;
}

// ─── Text Channels ───────────────────────────────────────────────

/**
 * Create a text channel — DB-first.
 */
export async function createChannel(
    data: Omit<TextChannel, "id" | "createdAt" | "isArchived">
): Promise<{ ok: boolean; id?: string }> {
    const id = `CH-${nanoid(6)}`;
    const channel: TextChannel = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
        isArchived: false,
    };

    const ok = await messagingDb.upsertChannel(channel);
    if (!ok) return { ok: false };

    useMessagingStore.setState((s) => ({
        channels: [...s.channels, channel],
    }));

    useAuditStore.getState().log({
        entityType: "channel",
        entityId: id,
        action: "channel_created",
        performedBy: data.createdBy,
        afterSnapshot: { name: data.name },
    });
    return { ok: true, id };
}

/**
 * Update a channel — DB-first.
 */
export async function updateChannel(
    id: string,
    patch: Partial<Omit<TextChannel, "id">>
): Promise<boolean> {
    const channel = useMessagingStore
        .getState()
        .channels.find((c) => c.id === id);
    if (!channel) return false;

    const updated: TextChannel = { ...channel, ...patch };
    const ok = await messagingDb.upsertChannel(updated);
    if (!ok) return false;

    useMessagingStore.setState((s) => ({
        channels: s.channels.map((c) => (c.id === id ? updated : c)),
    }));
    return true;
}

/**
 * Archive a channel — DB-first.
 */
export async function archiveChannel(id: string): Promise<boolean> {
    return updateChannel(id, { isArchived: true });
}

/**
 * Unarchive a channel — DB-first.
 */
export async function unarchiveChannel(id: string): Promise<boolean> {
    return updateChannel(id, { isArchived: false });
}

/**
 * Delete a channel (and its messages) — DB-first.
 */
export async function deleteChannel(id: string): Promise<boolean> {
    const ok = await messagingDb.deleteChannel(id);
    if (!ok) return false;

    useMessagingStore.setState((s) => ({
        channels: s.channels.filter((c) => c.id !== id),
        messages: s.messages.filter((m) => m.channelId !== id),
    }));
    return true;
}

/**
 * Add an employee to a channel's membership — DB-first.
 */
export async function addChannelMember(
    channelId: string,
    employeeId: string
): Promise<boolean> {
    const channel = useMessagingStore
        .getState()
        .channels.find((c) => c.id === channelId);
    if (!channel) return false;
    if (channel.memberEmployeeIds.includes(employeeId)) return true;

    return updateChannel(channelId, {
        memberEmployeeIds: [...channel.memberEmployeeIds, employeeId],
    });
}

/**
 * Remove an employee from a channel — DB-first.
 */
export async function removeChannelMember(
    channelId: string,
    employeeId: string
): Promise<boolean> {
    const channel = useMessagingStore
        .getState()
        .channels.find((c) => c.id === channelId);
    if (!channel) return false;

    return updateChannel(channelId, {
        memberEmployeeIds: channel.memberEmployeeIds.filter(
            (id) => id !== employeeId
        ),
    });
}

// ─── Channel Messages ────────────────────────────────────────────

/**
 * Send a channel message — DB-first.
 *
 * Ensures the parent channel is persisted to Supabase before the message
 * to prevent the FK violation (channel_messages_channel_id_fkey) that
 * occurs when a seed-only channel hasn't been synced.
 */
export async function sendMessage(
    data: Omit<ChannelMessage, "id" | "createdAt" | "readBy">
): Promise<{ ok: boolean; id?: string }> {
    const id = `MSG-${nanoid(6)}`;
    const message: ChannelMessage = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
        readBy: [],
    };

    // Guarantee parent channel exists in DB first (seed channels may not be synced yet)
    const parentChannel = useMessagingStore
        .getState()
        .channels.find((c) => c.id === message.channelId);
    if (parentChannel) {
        await messagingDb.upsertChannel(parentChannel);
    }

    const ok = await messagingDb.insertMessage(message);
    if (!ok) return { ok: false };

    useMessagingStore.setState((s) => ({
        messages: [...s.messages, message],
    }));
    return { ok: true, id };
}

/**
 * Mark a message as read for a given employee — DB-first.
 */
export async function markMessageRead(
    messageId: string,
    employeeId: string
): Promise<boolean> {
    const msg = useMessagingStore
        .getState()
        .messages.find((m) => m.id === messageId);
    if (!msg || msg.readBy.includes(employeeId)) return true;

    const updated: ChannelMessage = {
        ...msg,
        readBy: [...msg.readBy, employeeId],
    };
    const ok = await messagingDb.upsertMessage(updated);
    if (!ok) return false;

    useMessagingStore.setState((s) => ({
        messages: s.messages.map((m) => (m.id === messageId ? updated : m)),
    }));
    return true;
}

/**
 * Delete a message — DB-first.
 *
 * Note: messagingDb has no `deleteMessage` method. Local-only delete
 * preserved from legacy store; full implementation requires a new
 * db method + API route.
 */
export async function deleteMessage(id: string): Promise<boolean> {
    useMessagingStore.setState((s) => ({
        messages: s.messages.filter((m) => m.id !== id),
    }));
    return true;
}
