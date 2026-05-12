"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import { nanoid } from "nanoid";
import type {
    Announcement,
    TextChannel,
    ChannelMessage,
    MessageChannel,
    MessageStatus,
} from "@/types";
import {
    SEED_ANNOUNCEMENTS,
    SEED_TEXT_CHANNELS,
    SEED_CHANNEL_MESSAGES,
} from "@/data/seed";
import { useAuditStore } from "@/store/audit.store";
import { useTasksStore } from "@/store/tasks.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useEmployeesStore } from "@/store/employees.store";

export interface MessagingConfig {
    defaultChannel: MessageChannel;
    whatsappEnabled: boolean;
    smsEnabled: boolean; // Coming Soon
    emailFromName: string;
    emailFromAddress: string;
}

const DEFAULT_CONFIG: MessagingConfig = {
    defaultChannel: "email",
    whatsappEnabled: true,
    smsEnabled: false,
    emailFromName: "Soren Data Solutions",
    emailFromAddress: "noreply@sdsi.com",
};

interface MessagingState {
    announcements: Announcement[];
    channels: TextChannel[];
    messages: ChannelMessage[];
    config: MessagingConfig;

    // ── Announcements ─────────────────────────────────────────
    sendAnnouncement: (data: Omit<Announcement, "id" | "sentAt" | "status" | "readBy">) => string;
    markAnnouncementRead: (id: string, employeeId: string) => void;
    deleteAnnouncement: (id: string) => void;

    // ── Text Channels ─────────────────────────────────────────
    createChannel: (data: Omit<TextChannel, "id" | "createdAt" | "isArchived">) => string;
    updateChannel: (id: string, patch: Partial<Omit<TextChannel, "id">>) => void;
    archiveChannel: (id: string) => void;
    unarchiveChannel: (id: string) => void;
    deleteChannel: (id: string) => void;
    addChannelMember: (channelId: string, employeeId: string) => void;
    removeChannelMember: (channelId: string, employeeId: string) => void;

    // ── Channel Messages ──────────────────────────────────────
    sendMessage: (data: Omit<ChannelMessage, "id" | "createdAt" | "readBy">) => string;
    markMessageRead: (messageId: string, employeeId: string) => void;
    deleteMessage: (id: string) => void;

    // ── Config ────────────────────────────────────────────────
    updateConfig: (patch: Partial<MessagingConfig>) => void;

    // ── Selectors ─────────────────────────────────────────────
    getAnnouncementsForEmployee: (employeeId: string, groups: { id: string; memberEmployeeIds: string[] }[], tasks: { id: string; assignedTo: string[] }[]) => Announcement[];
    getChannelsForEmployee: (employeeId: string) => TextChannel[];
    getChannelMessages: (channelId: string) => ChannelMessage[];
    getUnreadCount: (channelId: string, employeeId: string) => number;
    getTotalUnreadForEmployee: (employeeId: string) => number;

    // ── Reset ─────────────────────────────────────────────────
    resetToSeed: () => void;
}

export const useMessagingStore = create<MessagingState>()(
    persist(
        (set, get) => ({
            announcements: SEED_ANNOUNCEMENTS,
            channels: SEED_TEXT_CHANNELS,
            messages: SEED_CHANNEL_MESSAGES,
            config: DEFAULT_CONFIG,

            // ── Announcements ─────────────────────────────────
            sendAnnouncement: (data) => {
                const id = `ANN-${nanoid(6)}`;
                set((s) => ({
                    announcements: [
                        ...s.announcements,
                        {
                            ...data,
                            id,
                            sentAt: new Date().toISOString(),
                            status: "simulated" as MessageStatus,
                            readBy: [],
                        },
                    ],
                }));
                useAuditStore.getState().log({
                    entityType: "announcement",
                    entityId: id,
                    action: "announcement_sent",
                    performedBy: data.sentBy,
                    afterSnapshot: { subject: data.subject, channel: data.channel, scope: data.scope },
                });

                // Fire in-app notification logs for recipients so they appear
                // in the bell and Notifications page — regardless of which part
                // of the UI triggered the announcement.
                if (data.channel === "in_app" || data.channel === "email") {
                    const addLog = useNotificationsStore.getState().addLog;
                    const notifChannel = data.channel as "in_app" | "email";
                    let recipientIds: string[] = [];

                    if (data.scope === "task_assignees" && data.targetTaskId) {
                        const task = useTasksStore.getState().tasks.find((t) => t.id === data.targetTaskId);
                        recipientIds = task?.assignedTo ?? [];
                    } else if (data.scope === "selected_employees" && data.targetEmployeeIds) {
                        recipientIds = data.targetEmployeeIds;
                    } else if (data.scope === "task_group" && data.targetGroupId) {
                        const group = useTasksStore.getState().groups.find((g) => g.id === data.targetGroupId);
                        recipientIds = group?.memberEmployeeIds ?? [];
                    } else if (data.scope === "all_employees") {
                        recipientIds = useEmployeesStore.getState().employees
                            .filter((e) => e.status === "active")
                            .map((e) => e.id);
                    }

                    recipientIds.forEach((empId) => {
                        addLog({
                            employeeId: empId,
                            type: "task_assigned",
                            channel: notifChannel,
                            subject: data.subject,
                            body: data.body,
                            link: data.scope === "task_assignees" && data.targetTaskId
                                ? `/tasks/${data.targetTaskId}`
                                : "/notifications",
                        });
                    });
                }

                return id;
            },
            markAnnouncementRead: (id, employeeId) =>
                set((s) => ({
                    announcements: s.announcements.map((a) =>
                        a.id === id && !a.readBy.includes(employeeId)
                            ? { ...a, readBy: [...a.readBy, employeeId] }
                            : a
                    ),
                })),
            deleteAnnouncement: (id) =>
                set((s) => ({
                    announcements: s.announcements.filter((a) => a.id !== id),
                })),

            // ── Text Channels ─────────────────────────────────
            createChannel: (data) => {
                const id = `CH-${nanoid(6)}`;
                set((s) => ({
                    channels: [
                        ...s.channels,
                        { ...data, id, createdAt: new Date().toISOString(), isArchived: false },
                    ],
                }));
                useAuditStore.getState().log({
                    entityType: "channel",
                    entityId: id,
                    action: "channel_created",
                    performedBy: data.createdBy,
                    afterSnapshot: { name: data.name },
                });
                return id;
            },
            updateChannel: (id, patch) =>
                set((s) => ({
                    channels: s.channels.map((c) =>
                        c.id === id ? { ...c, ...patch } : c
                    ),
                })),
            archiveChannel: (id) =>
                set((s) => ({
                    channels: s.channels.map((c) =>
                        c.id === id ? { ...c, isArchived: true } : c
                    ),
                })),
            unarchiveChannel: (id) =>
                set((s) => ({
                    channels: s.channels.map((c) =>
                        c.id === id ? { ...c, isArchived: false } : c
                    ),
                })),
            deleteChannel: (id) =>
                set((s) => ({
                    channels: s.channels.filter((c) => c.id !== id),
                    messages: s.messages.filter((m) => m.channelId !== id),
                })),
            addChannelMember: (channelId, employeeId) =>
                set((s) => ({
                    channels: s.channels.map((c) =>
                        c.id === channelId && !c.memberEmployeeIds.includes(employeeId)
                            ? { ...c, memberEmployeeIds: [...c.memberEmployeeIds, employeeId] }
                            : c
                    ),
                })),
            removeChannelMember: (channelId, employeeId) =>
                set((s) => ({
                    channels: s.channels.map((c) =>
                        c.id === channelId
                            ? { ...c, memberEmployeeIds: c.memberEmployeeIds.filter((id) => id !== employeeId) }
                            : c
                    ),
                })),

            // ── Channel Messages ──────────────────────────────
            sendMessage: (data) => {
                const id = `MSG-${nanoid(6)}`;
                set((s) => ({
                    messages: [
                        ...s.messages,
                        { ...data, id, createdAt: new Date().toISOString(), readBy: [] },
                    ],
                }));
                return id;
            },
            markMessageRead: (messageId, employeeId) =>
                set((s) => ({
                    messages: s.messages.map((m) =>
                        m.id === messageId && !m.readBy.includes(employeeId)
                            ? { ...m, readBy: [...m.readBy, employeeId] }
                            : m
                    ),
                })),
            deleteMessage: (id) =>
                set((s) => ({
                    messages: s.messages.filter((m) => m.id !== id),
                })),

            // ── Config ────────────────────────────────────────
            updateConfig: (patch) =>
                set((s) => ({ config: { ...s.config, ...patch } })),

            // ── Selectors ─────────────────────────────────────
            getAnnouncementsForEmployee: (employeeId, groups, tasks) => {
                return get().announcements.filter((a) => {
                    if (a.scope === "all_employees") return true;
                    if (a.scope === "selected_employees")
                        return a.targetEmployeeIds?.includes(employeeId);
                    if (a.scope === "task_group" && a.targetGroupId) {
                        const group = groups.find((g) => g.id === a.targetGroupId);
                        return group?.memberEmployeeIds.includes(employeeId);
                    }
                    if (a.scope === "task_assignees" && a.targetTaskId) {
                        const task = tasks.find((t) => t.id === a.targetTaskId);
                        return task?.assignedTo.includes(employeeId);
                    }
                    return false;
                });
            },
            getChannelsForEmployee: (employeeId) =>
                get().channels.filter(
                    (c) => !c.isArchived && c.memberEmployeeIds.includes(employeeId)
                ),
            getChannelMessages: (channelId) =>
                get()
                    .messages.filter((m) => m.channelId === channelId)
                    .sort(
                        (a, b) =>
                            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                    ),
            getUnreadCount: (channelId, employeeId) =>
                get().messages.filter(
                    (m) =>
                        m.channelId === channelId &&
                        m.employeeId !== employeeId &&
                        !m.readBy.includes(employeeId)
                ).length,
            getTotalUnreadForEmployee: (employeeId) => {
                const { channels, messages } = get();
                return channels
                    .filter((c) => !c.isArchived && c.memberEmployeeIds.includes(employeeId))
                    .reduce(
                        (sum, ch) =>
                            sum +
                            messages.filter(
                                (m) =>
                                    m.channelId === ch.id &&
                                    m.employeeId !== employeeId &&
                                    !m.readBy.includes(employeeId)
                            ).length,
                        0
                    );
            },

            resetToSeed: () =>
                set({
                    announcements: SEED_ANNOUNCEMENTS,
                    channels: SEED_TEXT_CHANNELS,
                    messages: SEED_CHANNEL_MESSAGES,
                    config: DEFAULT_CONFIG,
                }),
        }),
        { name: "soren-messaging", version: 1, storage: safePersistStorage }
    )
);
