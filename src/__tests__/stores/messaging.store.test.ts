/**
 * Unit tests for the Messaging store
 */
import { useMessagingStore } from "@/store/messaging.store";
import { useAuditStore } from "@/store/audit.store";
import type { Announcement, TextChannel, ChannelMessage } from "@/types";

// ─── Fixtures ────────────────────────────────────────────────

const BASE_ANNOUNCEMENT: Omit<Announcement, "id" | "sentAt" | "status" | "readBy"> = {
    subject: "Test Announcement",
    body: "This is a test announcement.",
    channel: "in_app",
    scope: "all_employees",
    sentBy: "ADMIN-001",
};

const BASE_CHANNEL: Omit<TextChannel, "id" | "createdAt" | "isArchived"> = {
    name: "General",
    memberEmployeeIds: ["EMP-001", "EMP-002"],
    createdBy: "ADMIN-001",
};

const BASE_MESSAGE: Omit<ChannelMessage, "id" | "createdAt" | "readBy"> = {
    channelId: "CH-TEST",
    employeeId: "EMP-001",
    message: "Hello team!",
};

const resetStores = () => {
    useMessagingStore.setState({
        announcements: [],
        channels: [],
        messages: [],
        config: {
            defaultChannel: "in_app",
            whatsappEnabled: false,
            smsEnabled: false,
            emailFromName: "NexHRMS",
            emailFromAddress: "test@nexhrms.com",
        },
    });
    useAuditStore.setState({ logs: [] });
};

beforeEach(resetStores);

// ─── Announcements ────────────────────────────────────────────

describe("Messaging Store — sendAnnouncement", () => {
    it("creates an announcement with ANN- prefix id", () => {
        const id = useMessagingStore.getState().sendAnnouncement(BASE_ANNOUNCEMENT);
        expect(id).toMatch(/^ANN-/);
        expect(useMessagingStore.getState().announcements).toHaveLength(1);
    });

    it("sets sentAt, status=simulated, and empty readBy", () => {
        const id = useMessagingStore.getState().sendAnnouncement(BASE_ANNOUNCEMENT);
        const ann = useMessagingStore.getState().announcements.find((a) => a.id === id)!;
        expect(() => new Date(ann.sentAt)).not.toThrow();
        expect(ann.status).toBe("simulated");
        expect(ann.readBy).toEqual([]);
    });

    it("preserves all provided fields", () => {
        const id = useMessagingStore.getState().sendAnnouncement(BASE_ANNOUNCEMENT);
        const ann = useMessagingStore.getState().announcements.find((a) => a.id === id)!;
        expect(ann.subject).toBe("Test Announcement");
        expect(ann.scope).toBe("all_employees");
        expect(ann.sentBy).toBe("ADMIN-001");
    });

    it("writes an announcement_sent audit log entry", () => {
        const id = useMessagingStore.getState().sendAnnouncement(BASE_ANNOUNCEMENT);
        const logs = useAuditStore.getState().logs;
        expect(logs.some((l) => l.entityId === id && l.action === "announcement_sent")).toBe(true);
    });
});

describe("Messaging Store — markAnnouncementRead", () => {
    it("adds employeeId to readBy", () => {
        const id = useMessagingStore.getState().sendAnnouncement(BASE_ANNOUNCEMENT);
        useMessagingStore.getState().markAnnouncementRead(id, "EMP-001");
        const ann = useMessagingStore.getState().announcements.find((a) => a.id === id)!;
        expect(ann.readBy).toContain("EMP-001");
    });

    it("does not duplicate employeeId in readBy", () => {
        const id = useMessagingStore.getState().sendAnnouncement(BASE_ANNOUNCEMENT);
        useMessagingStore.getState().markAnnouncementRead(id, "EMP-001");
        useMessagingStore.getState().markAnnouncementRead(id, "EMP-001");
        const ann = useMessagingStore.getState().announcements.find((a) => a.id === id)!;
        expect(ann.readBy.filter((e) => e === "EMP-001")).toHaveLength(1);
    });
});

describe("Messaging Store — deleteAnnouncement", () => {
    it("removes the announcement", () => {
        const id = useMessagingStore.getState().sendAnnouncement(BASE_ANNOUNCEMENT);
        useMessagingStore.getState().deleteAnnouncement(id);
        expect(useMessagingStore.getState().announcements).toHaveLength(0);
    });
});

// ─── getAnnouncementsForEmployee ──────────────────────────────

describe("Messaging Store — getAnnouncementsForEmployee", () => {
    const groups = [{ id: "TG-A", memberEmployeeIds: ["EMP-001"] }];
    const tasks = [{ id: "TSK-A", assignedTo: ["EMP-002"] }];

    it("includes all_employees announcements for everyone", () => {
        useMessagingStore.getState().sendAnnouncement({ ...BASE_ANNOUNCEMENT, scope: "all_employees" });
        const result = useMessagingStore.getState().getAnnouncementsForEmployee("EMP-999", groups, tasks);
        expect(result).toHaveLength(1);
    });

    it("includes selected_employees announcements only for targeted employees", () => {
        useMessagingStore.getState().sendAnnouncement({
            ...BASE_ANNOUNCEMENT,
            scope: "selected_employees",
            targetEmployeeIds: ["EMP-001"],
        });
        const forEmp001 = useMessagingStore.getState().getAnnouncementsForEmployee("EMP-001", groups, tasks);
        const forEmp002 = useMessagingStore.getState().getAnnouncementsForEmployee("EMP-002", groups, tasks);
        expect(forEmp001).toHaveLength(1);
        expect(forEmp002).toHaveLength(0);
    });

    it("includes task_group announcements only for group members", () => {
        useMessagingStore.getState().sendAnnouncement({
            ...BASE_ANNOUNCEMENT,
            scope: "task_group",
            targetGroupId: "TG-A",
        });
        const forEmp001 = useMessagingStore.getState().getAnnouncementsForEmployee("EMP-001", groups, tasks);
        const forEmp002 = useMessagingStore.getState().getAnnouncementsForEmployee("EMP-002", groups, tasks);
        expect(forEmp001).toHaveLength(1);
        expect(forEmp002).toHaveLength(0);
    });

    it("includes task_assignees announcements only for task assignees", () => {
        useMessagingStore.getState().sendAnnouncement({
            ...BASE_ANNOUNCEMENT,
            scope: "task_assignees",
            targetTaskId: "TSK-A",
        });
        const forEmp002 = useMessagingStore.getState().getAnnouncementsForEmployee("EMP-002", groups, tasks);
        const forEmp001 = useMessagingStore.getState().getAnnouncementsForEmployee("EMP-001", groups, tasks);
        expect(forEmp002).toHaveLength(1);
        expect(forEmp001).toHaveLength(0);
    });
});

// ─── Text Channels ────────────────────────────────────────────

describe("Messaging Store — createChannel", () => {
    it("creates a channel with CH- prefix id", () => {
        const id = useMessagingStore.getState().createChannel(BASE_CHANNEL);
        expect(id).toMatch(/^CH-/);
        expect(useMessagingStore.getState().channels).toHaveLength(1);
    });

    it("sets isArchived=false and createdAt", () => {
        const id = useMessagingStore.getState().createChannel(BASE_CHANNEL);
        const ch = useMessagingStore.getState().channels.find((c) => c.id === id)!;
        expect(ch.isArchived).toBe(false);
        expect(() => new Date(ch.createdAt)).not.toThrow();
    });

    it("writes a channel_created audit log entry", () => {
        const id = useMessagingStore.getState().createChannel(BASE_CHANNEL);
        const logs = useAuditStore.getState().logs;
        expect(logs.some((l) => l.entityId === id && l.action === "channel_created")).toBe(true);
    });
});

describe("Messaging Store — archiveChannel", () => {
    it("sets isArchived=true", () => {
        const id = useMessagingStore.getState().createChannel(BASE_CHANNEL);
        useMessagingStore.getState().archiveChannel(id);
        const ch = useMessagingStore.getState().channels.find((c) => c.id === id)!;
        expect(ch.isArchived).toBe(true);
    });
});

describe("Messaging Store — deleteChannel", () => {
    it("removes the channel and its messages", () => {
        const chId = useMessagingStore.getState().createChannel(BASE_CHANNEL);
        useMessagingStore.getState().sendMessage({ ...BASE_MESSAGE, channelId: chId });
        expect(useMessagingStore.getState().messages).toHaveLength(1);
        useMessagingStore.getState().deleteChannel(chId);
        expect(useMessagingStore.getState().channels).toHaveLength(0);
        expect(useMessagingStore.getState().messages).toHaveLength(0);
    });
});

describe("Messaging Store — addChannelMember / removeChannelMember", () => {
    it("adds a member to the channel", () => {
        const id = useMessagingStore.getState().createChannel(BASE_CHANNEL);
        useMessagingStore.getState().addChannelMember(id, "EMP-003");
        const ch = useMessagingStore.getState().channels.find((c) => c.id === id)!;
        expect(ch.memberEmployeeIds).toContain("EMP-003");
    });

    it("does not duplicate an existing member", () => {
        const id = useMessagingStore.getState().createChannel(BASE_CHANNEL);
        useMessagingStore.getState().addChannelMember(id, "EMP-001");
        const ch = useMessagingStore.getState().channels.find((c) => c.id === id)!;
        expect(ch.memberEmployeeIds.filter((e) => e === "EMP-001")).toHaveLength(1);
    });

    it("removes a member from the channel", () => {
        const id = useMessagingStore.getState().createChannel(BASE_CHANNEL);
        useMessagingStore.getState().removeChannelMember(id, "EMP-001");
        const ch = useMessagingStore.getState().channels.find((c) => c.id === id)!;
        expect(ch.memberEmployeeIds).not.toContain("EMP-001");
    });
});

// ─── Channel Messages ─────────────────────────────────────────

describe("Messaging Store — sendMessage", () => {
    it("creates a message with MSG- prefix id", () => {
        const id = useMessagingStore.getState().sendMessage(BASE_MESSAGE);
        expect(id).toMatch(/^MSG-/);
        expect(useMessagingStore.getState().messages).toHaveLength(1);
    });

    it("sets createdAt and empty readBy", () => {
        const id = useMessagingStore.getState().sendMessage(BASE_MESSAGE);
        const msg = useMessagingStore.getState().messages.find((m) => m.id === id)!;
        expect(() => new Date(msg.createdAt)).not.toThrow();
        expect(msg.readBy).toEqual([]);
    });
});

describe("Messaging Store — markMessageRead", () => {
    it("adds employeeId to readBy", () => {
        const id = useMessagingStore.getState().sendMessage(BASE_MESSAGE);
        useMessagingStore.getState().markMessageRead(id, "EMP-002");
        const msg = useMessagingStore.getState().messages.find((m) => m.id === id)!;
        expect(msg.readBy).toContain("EMP-002");
    });

    it("does not duplicate readBy entries", () => {
        const id = useMessagingStore.getState().sendMessage(BASE_MESSAGE);
        useMessagingStore.getState().markMessageRead(id, "EMP-002");
        useMessagingStore.getState().markMessageRead(id, "EMP-002");
        const msg = useMessagingStore.getState().messages.find((m) => m.id === id)!;
        expect(msg.readBy.filter((e) => e === "EMP-002")).toHaveLength(1);
    });
});

describe("Messaging Store — deleteMessage", () => {
    it("removes the message", () => {
        const id = useMessagingStore.getState().sendMessage(BASE_MESSAGE);
        useMessagingStore.getState().deleteMessage(id);
        expect(useMessagingStore.getState().messages).toHaveLength(0);
    });
});

// ─── Selectors ────────────────────────────────────────────────

describe("Messaging Store — getChannelsForEmployee", () => {
    it("returns non-archived channels where employee is a member", () => {
        const id = useMessagingStore.getState().createChannel(BASE_CHANNEL);
        useMessagingStore.getState().createChannel({ ...BASE_CHANNEL, name: "Private", memberEmployeeIds: ["EMP-003"] });
        const result = useMessagingStore.getState().getChannelsForEmployee("EMP-001");
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(id);
    });

    it("excludes archived channels", () => {
        const id = useMessagingStore.getState().createChannel(BASE_CHANNEL);
        useMessagingStore.getState().archiveChannel(id);
        const result = useMessagingStore.getState().getChannelsForEmployee("EMP-001");
        expect(result).toHaveLength(0);
    });
});

describe("Messaging Store — getChannelMessages", () => {
    it("returns only messages for the given channel, sorted by date", async () => {
        useMessagingStore.getState().sendMessage({ ...BASE_MESSAGE, channelId: "CH-A" });
        await new Promise((r) => setTimeout(r, 2));
        useMessagingStore.getState().sendMessage({ ...BASE_MESSAGE, channelId: "CH-A" });
        useMessagingStore.getState().sendMessage({ ...BASE_MESSAGE, channelId: "CH-B" });
        const result = useMessagingStore.getState().getChannelMessages("CH-A");
        expect(result).toHaveLength(2);
        expect(new Date(result[0].createdAt).getTime()).toBeLessThanOrEqual(
            new Date(result[1].createdAt).getTime()
        );
    });
});

describe("Messaging Store — getUnreadCount", () => {
    it("counts messages not sent by the viewer and not yet read by them", () => {
        // EMP-002 sends a message; EMP-001 has not read it
        useMessagingStore.getState().sendMessage({ channelId: "CH-X", employeeId: "EMP-002", message: "Hi" });
        const count = useMessagingStore.getState().getUnreadCount("CH-X", "EMP-001");
        expect(count).toBe(1);
    });

    it("excludes messages sent by the viewer themselves", () => {
        useMessagingStore.getState().sendMessage({ channelId: "CH-X", employeeId: "EMP-001", message: "My message" });
        const count = useMessagingStore.getState().getUnreadCount("CH-X", "EMP-001");
        expect(count).toBe(0);
    });

    it("excludes messages already read by the viewer", () => {
        const msgId = useMessagingStore.getState().sendMessage({ channelId: "CH-X", employeeId: "EMP-002", message: "Hi" });
        useMessagingStore.getState().markMessageRead(msgId, "EMP-001");
        const count = useMessagingStore.getState().getUnreadCount("CH-X", "EMP-001");
        expect(count).toBe(0);
    });
});

describe("Messaging Store — getTotalUnreadForEmployee", () => {
    it("sums unread counts across all non-archived channels the employee belongs to", () => {
        const chA = useMessagingStore.getState().createChannel({ ...BASE_CHANNEL, name: "A", memberEmployeeIds: ["EMP-001", "EMP-002"] });
        const chB = useMessagingStore.getState().createChannel({ ...BASE_CHANNEL, name: "B", memberEmployeeIds: ["EMP-001", "EMP-003"] });
        // send 2 unread messages in chA, 1 in chB for EMP-001
        useMessagingStore.getState().sendMessage({ channelId: chA, employeeId: "EMP-002", message: "Msg 1" });
        useMessagingStore.getState().sendMessage({ channelId: chA, employeeId: "EMP-002", message: "Msg 2" });
        useMessagingStore.getState().sendMessage({ channelId: chB, employeeId: "EMP-003", message: "Msg 3" });
        const total = useMessagingStore.getState().getTotalUnreadForEmployee("EMP-001");
        expect(total).toBe(3);
    });

    it("returns 0 when all messages are read or sent by the viewer", () => {
        const chId = useMessagingStore.getState().createChannel({ ...BASE_CHANNEL, memberEmployeeIds: ["EMP-001", "EMP-002"] });
        const msgId = useMessagingStore.getState().sendMessage({ channelId: chId, employeeId: "EMP-002", message: "Hi" });
        useMessagingStore.getState().markMessageRead(msgId, "EMP-001");
        const total = useMessagingStore.getState().getTotalUnreadForEmployee("EMP-001");
        expect(total).toBe(0);
    });

    it("does not count channels the employee is not a member of", () => {
        const chId = useMessagingStore.getState().createChannel({ ...BASE_CHANNEL, memberEmployeeIds: ["EMP-002", "EMP-003"] });
        useMessagingStore.getState().sendMessage({ channelId: chId, employeeId: "EMP-002", message: "Hi" });
        const total = useMessagingStore.getState().getTotalUnreadForEmployee("EMP-001");
        expect(total).toBe(0);
    });

    it("does not count archived channels", () => {
        const chId = useMessagingStore.getState().createChannel({ ...BASE_CHANNEL, memberEmployeeIds: ["EMP-001", "EMP-002"] });
        useMessagingStore.getState().sendMessage({ channelId: chId, employeeId: "EMP-002", message: "Hi" });
        useMessagingStore.getState().archiveChannel(chId);
        const total = useMessagingStore.getState().getTotalUnreadForEmployee("EMP-001");
        expect(total).toBe(0);
    });
});

// ─── Config ───────────────────────────────────────────────────

describe("Messaging Store — updateConfig", () => {
    it("patches config fields", () => {
        useMessagingStore.getState().updateConfig({ emailFromName: "TestCo" });
        expect(useMessagingStore.getState().config.emailFromName).toBe("TestCo");
    });

    it("does not overwrite unpatched fields", () => {
        const before = useMessagingStore.getState().config.whatsappEnabled;
        useMessagingStore.getState().updateConfig({ emailFromName: "TestCo" });
        expect(useMessagingStore.getState().config.whatsappEnabled).toBe(before);
    });
});

// ─── resetToSeed ─────────────────────────────────────────────

describe("Messaging Store — resetToSeed", () => {
    it("restores seed data and clears custom entries", () => {
        useMessagingStore.getState().sendAnnouncement(BASE_ANNOUNCEMENT);
        useMessagingStore.getState().resetToSeed();
        const { announcements, channels } = useMessagingStore.getState();
        // Seed data has pre-loaded announcements and channels
        expect(announcements.length).toBeGreaterThan(0);
        expect(channels.length).toBeGreaterThan(0);
    });
});
