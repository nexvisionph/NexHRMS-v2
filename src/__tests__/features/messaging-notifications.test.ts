/**
 * Feature Test: Messaging & Notifications
 *
 * Covers: messaging.store.ts, notifications.store.ts
 * - Announcements (send, read, delete)
 * - Text channels (CRUD, archive, members)
 * - Channel messages (send, read, delete)
 * - Messaging config
 * - Notification dispatch (template rendering)
 * - Notification rules (toggle, update, query by trigger)
 * - Provider config
 * - Unread counts
 */

import { useMessagingStore } from "@/store/messaging.store";
import { useNotificationsStore } from "@/store/notifications.store";

beforeEach(() => {
    useMessagingStore.getState().resetToSeed();
    useNotificationsStore.getState().resetToSeed();
});

describe("Messaging", () => {
    // ── Announcements ───────────────────────────────────────
    describe("Announcements", () => {
        it("sends an announcement", () => {
            const before = useMessagingStore.getState().announcements.length;
            useMessagingStore.getState().sendAnnouncement({
                subject: "Test Announcement",
                body: "Hello everyone",
                channel: "in_app",
                sentBy: "EMP001",
                scope: "all_employees",
            });
            expect(useMessagingStore.getState().announcements.length).toBe(before + 1);
        });

        it("marks an announcement as read", () => {
            const id = useMessagingStore.getState().sendAnnouncement({
                subject: "Read Test",
                body: "Please read",
                channel: "in_app",
                sentBy: "EMP001",
                scope: "all_employees",
            });
            useMessagingStore.getState().markAnnouncementRead(id, "EMP002");
            const ann = useMessagingStore.getState().announcements.find((a) => a.id === id);
            expect(ann?.readBy).toContain("EMP002");
        });

        it("deletes an announcement", () => {
            const id = useMessagingStore.getState().sendAnnouncement({
                subject: "Delete Me",
                body: "Bye",
                channel: "in_app",
                sentBy: "EMP001",
                scope: "all_employees",
            });
            useMessagingStore.getState().deleteAnnouncement(id);
            expect(useMessagingStore.getState().announcements.find((a) => a.id === id)).toBeUndefined();
        });
    });

    // ── Text Channels ───────────────────────────────────────
    describe("Text channels", () => {
        it("creates a channel", () => {
            const before = useMessagingStore.getState().channels.length;
            useMessagingStore.getState().createChannel({
                name: "test-channel",
                memberEmployeeIds: ["EMP001", "EMP002"],
                createdBy: "EMP001",
            });
            expect(useMessagingStore.getState().channels.length).toBe(before + 1);
        });

        it("updates a channel", () => {
            const id = useMessagingStore.getState().createChannel({
                name: "original",
                memberEmployeeIds: ["EMP001"],
                createdBy: "EMP001",
            });
            useMessagingStore.getState().updateChannel(id, { name: "renamed" });
            expect(useMessagingStore.getState().channels.find((c) => c.id === id)?.name).toBe("renamed");
        });

        it("archives a channel", () => {
            const id = useMessagingStore.getState().createChannel({
                name: "archive-me",
                memberEmployeeIds: ["EMP001"],
                createdBy: "EMP001",
            });
            useMessagingStore.getState().archiveChannel(id);
            expect(useMessagingStore.getState().channels.find((c) => c.id === id)?.isArchived).toBe(true);
        });

        it("deletes a channel", () => {
            const id = useMessagingStore.getState().createChannel({
                name: "delete-me",
                memberEmployeeIds: ["EMP001"],
                createdBy: "EMP001",
            });
            useMessagingStore.getState().deleteChannel(id);
            expect(useMessagingStore.getState().channels.find((c) => c.id === id)).toBeUndefined();
        });

        it("adds a member to a channel", () => {
            const id = useMessagingStore.getState().createChannel({
                name: "members-test",
                memberEmployeeIds: ["EMP001"],
                createdBy: "EMP001",
            });
            useMessagingStore.getState().addChannelMember(id, "EMP003");
            expect(useMessagingStore.getState().channels.find((c) => c.id === id)?.memberEmployeeIds).toContain("EMP003");
        });

        it("removes a member from a channel", () => {
            const id = useMessagingStore.getState().createChannel({
                name: "remove-test",
                memberEmployeeIds: ["EMP001", "EMP002"],
                createdBy: "EMP001",
            });
            useMessagingStore.getState().removeChannelMember(id, "EMP002");
            expect(useMessagingStore.getState().channels.find((c) => c.id === id)?.memberEmployeeIds).not.toContain("EMP002");
        });

        it("getChannelsForEmployee returns relevant channels", () => {
            useMessagingStore.getState().createChannel({
                name: "for-emp001",
                memberEmployeeIds: ["EMP001"],
                createdBy: "EMP001",
            });
            const channels = useMessagingStore.getState().getChannelsForEmployee("EMP001");
            expect(channels.every((c) => c.memberEmployeeIds.includes("EMP001"))).toBe(true);
        });
    });

    // ── Channel Messages ────────────────────────────────────
    describe("Channel messages", () => {
        it("sends a message", () => {
            const ch = useMessagingStore.getState().channels[0];
            if (!ch) return; // skip if no seed channels
            const before = useMessagingStore.getState().messages.length;
            useMessagingStore.getState().sendMessage({
                channelId: ch.id,
                employeeId: "EMP001",
                message: "Hello channel!",
            });
            expect(useMessagingStore.getState().messages.length).toBe(before + 1);
        });

        it("marks a message as read", () => {
            const ch = useMessagingStore.getState().channels[0];
            if (!ch) return;
            const msgId = useMessagingStore.getState().sendMessage({
                channelId: ch.id,
                employeeId: "EMP001",
                message: "Read me",
            });
            useMessagingStore.getState().markMessageRead(msgId, "EMP002");
            const msg = useMessagingStore.getState().messages.find((m) => m.id === msgId);
            expect(msg?.readBy).toContain("EMP002");
        });

        it("deletes a message", () => {
            const ch = useMessagingStore.getState().channels[0];
            if (!ch) return;
            const msgId = useMessagingStore.getState().sendMessage({
                channelId: ch.id,
                employeeId: "EMP001",
                message: "Delete me",
            });
            useMessagingStore.getState().deleteMessage(msgId);
            expect(useMessagingStore.getState().messages.find((m) => m.id === msgId)).toBeUndefined();
        });

        it("getChannelMessages returns messages for a channel", () => {
            const ch = useMessagingStore.getState().channels[0];
            if (!ch) return;
            useMessagingStore.getState().sendMessage({ channelId: ch.id, employeeId: "EMP001", message: "msg1" });
            const msgs = useMessagingStore.getState().getChannelMessages(ch.id);
            expect(msgs.every((m) => m.channelId === ch.id)).toBe(true);
        });

        it("getUnreadCount works", () => {
            const ch = useMessagingStore.getState().channels[0];
            if (!ch) return;
            useMessagingStore.getState().sendMessage({ channelId: ch.id, employeeId: "EMP001", message: "unread" });
            const count = useMessagingStore.getState().getUnreadCount(ch.id, "EMP002");
            expect(count).toBeGreaterThanOrEqual(1);
        });
    });

    // ── Config ──────────────────────────────────────────────
    describe("Messaging config", () => {
        it("updates messaging config", () => {
            useMessagingStore.getState().updateConfig({ whatsappEnabled: false });
            expect(useMessagingStore.getState().config.whatsappEnabled).toBe(false);
        });
    });
});

describe("Notifications", () => {
    // ── Rules ───────────────────────────────────────────────
    describe("Rules", () => {
        it("has 15 default rules", () => {
            expect(useNotificationsStore.getState().rules.length).toBe(15);
        });

        it("toggles a rule", () => {
            const rule = useNotificationsStore.getState().rules[0];
            const wasBefore = rule.enabled;
            useNotificationsStore.getState().toggleRule(rule.id);
            expect(useNotificationsStore.getState().rules.find((r) => r.id === rule.id)?.enabled).toBe(!wasBefore);
        });

        it("updates a rule", () => {
            const rule = useNotificationsStore.getState().rules[0];
            useNotificationsStore.getState().updateRule(rule.id, { channel: "sms" });
            expect(useNotificationsStore.getState().rules.find((r) => r.id === rule.id)?.channel).toBe("sms");
        });

        it("getRuleByTrigger finds the correct rule", () => {
            const rule = useNotificationsStore.getState().getRuleByTrigger("payslip_published");
            expect(rule?.trigger).toBe("payslip_published");
        });

        it("resets rules to defaults", () => {
            useNotificationsStore.getState().toggleRule("NR-01");
            useNotificationsStore.getState().resetRules();
            expect(useNotificationsStore.getState().rules.find((r) => r.id === "NR-01")?.enabled).toBe(true);
        });
    });

    // ── Dispatch ────────────────────────────────────────────
    describe("Dispatch", () => {
        it("dispatches a notification and creates a log", () => {
            const beforeLogs = useNotificationsStore.getState().logs.length;
            useNotificationsStore.getState().dispatch(
                "payslip_published",
                { period: "March 2026", name: "Juan Dela Cruz", amount: "₱46,887.50" },
                "EMP001",
                "juan@email.com"
            );
            expect(useNotificationsStore.getState().logs.length).toBeGreaterThan(beforeLogs);
        });

        it("renders template variables in dispatch", () => {
            useNotificationsStore.getState().dispatch(
                "leave_approved",
                { name: "Maria Santos", leaveType: "Vacation", dates: "Mar 1-5", status: "approved" },
                "EMP002"
            );
            const log = useNotificationsStore.getState().logs[0];
            expect(log.body).toContain("Vacation");
        });

        it("does not dispatch for disabled rule", () => {
            useNotificationsStore.getState().toggleRule("NR-01"); // disable payslip_published
            const beforeLogs = useNotificationsStore.getState().logs.length;
            useNotificationsStore.getState().dispatch(
                "payslip_published",
                { period: "March 2026", name: "Test", amount: "₱0" },
                "EMP001"
            );
            expect(useNotificationsStore.getState().logs.length).toBe(beforeLogs);
        });
    });

    // ── Log Management ──────────────────────────────────────
    describe("Log management", () => {
        it("adds a manual log entry", () => {
            useNotificationsStore.getState().addLog({
                employeeId: "EMP001",
                type: "payslip_published",
                channel: "email",
                subject: "Test",
                body: "Test body",
            });
            expect(useNotificationsStore.getState().logs.length).toBeGreaterThan(0);
        });

        it("getLogsByType filters by type", () => {
            useNotificationsStore.getState().addLog({
                employeeId: "EMP001",
                type: "payslip_published",
                channel: "email",
                subject: "Email test",
                body: "Body",
            });
            const logs = useNotificationsStore.getState().getLogsByType("payslip_published");
            expect(logs.every((l) => l.type === "payslip_published")).toBe(true);
        });

        it("getLogsByEmployee filters by employee", () => {
            useNotificationsStore.getState().addLog({
                employeeId: "EMP003",
                type: "leave_approved",
                channel: "sms",
                subject: "SMS test",
                body: "Body",
            });
            const logs = useNotificationsStore.getState().getLogsByEmployee("EMP003");
            expect(logs.every((l) => l.employeeId === "EMP003")).toBe(true);
        });

        it("clearLogs empties logs", () => {
            useNotificationsStore.getState().addLog({
                employeeId: "EMP001",
                type: "payslip_published",
                channel: "email",
                subject: "X",
                body: "Y",
            });
            useNotificationsStore.getState().clearLogs();
            expect(useNotificationsStore.getState().logs.length).toBe(0);
        });
    });

    // ── Provider Config ─────────────────────────────────────
    describe("Provider config", () => {
        it("updates provider config", () => {
            useNotificationsStore.getState().updateProviderConfig({ emailProvider: "resend" });
            expect(useNotificationsStore.getState().providerConfig.emailProvider).toBe("resend");
        });

        it("has simulated defaults", () => {
            expect(useNotificationsStore.getState().providerConfig.smsProvider).toBe("simulated");
            expect(useNotificationsStore.getState().providerConfig.emailProvider).toBe("simulated");
        });
    });

    // ── Reset ───────────────────────────────────────────────
    describe("Reset", () => {
        it("resets notifications to seed", () => {
            useNotificationsStore.getState().addLog({
                employeeId: "EMP001",
                type: "payslip_published",
                channel: "email",
                subject: "X",
                body: "Y",
            });
            useNotificationsStore.getState().resetToSeed();
            expect(useNotificationsStore.getState().logs.length).toBe(0);
        });
    });
});
