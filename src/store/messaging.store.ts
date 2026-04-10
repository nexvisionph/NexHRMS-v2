"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
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
    emailFromName: "NexHRMS",
    emailFromAddress: "noreply@nexhrms.com",
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
        { name: "nexhrms-messaging", version: 1 }
    )
);
