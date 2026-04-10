"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { NotificationLog, NotificationType, NotificationChannel, NotificationRule, NotificationTrigger } from "@/types";

// ─── Default Rules ────────────────────────────────────────────

const DEFAULT_RULES: NotificationRule[] = [
    { id: "NR-01", trigger: "payslip_published", enabled: true, channel: "both", recipientRoles: ["employee"], timing: "immediate", subjectTemplate: "Payslip Ready: {period}", bodyTemplate: "Hi {name}, your payslip for {period} is ready. Net pay: {amount}. Please sign in NexHRMS.", smsTemplate: "Your payslip for {period} is ready. Net: {amount}." },
    { id: "NR-02", trigger: "leave_submitted", enabled: true, channel: "email", recipientRoles: ["admin", "hr"], timing: "immediate", subjectTemplate: "Leave Request: {name}", bodyTemplate: "{name} submitted a {leaveType} leave request ({dates})." },
    { id: "NR-03", trigger: "leave_approved", enabled: true, channel: "both", recipientRoles: ["employee"], timing: "immediate", subjectTemplate: "Leave {status}: {dates}", bodyTemplate: "Hi {name}, your {leaveType} leave ({dates}) has been {status}.", smsTemplate: "Your {leaveType} leave ({dates}) has been {status}." },
    { id: "NR-04", trigger: "leave_rejected", enabled: true, channel: "both", recipientRoles: ["employee"], timing: "immediate", subjectTemplate: "Leave Rejected: {dates}", bodyTemplate: "Hi {name}, your {leaveType} leave ({dates}) has been rejected." },
    { id: "NR-05", trigger: "attendance_missing", enabled: true, channel: "sms", recipientRoles: ["employee"], timing: "scheduled", scheduleTime: "10:00", subjectTemplate: "Check-In Reminder", bodyTemplate: "Reminder: You have not checked in today. Please check in.", smsTemplate: "Reminder: You have not checked in today." },
    { id: "NR-06", trigger: "geofence_violation", enabled: true, channel: "email", recipientRoles: ["admin"], timing: "immediate", subjectTemplate: "Geofence Violation: {name}", bodyTemplate: "{name} is outside the geofence at {time}. Distance: {distance}m." },
    { id: "NR-07", trigger: "loan_reminder", enabled: true, channel: "sms", recipientRoles: ["employee"], timing: "scheduled", reminderDays: [3], subjectTemplate: "Loan Deduction Reminder", bodyTemplate: "Reminder: {amount} loan deduction will be applied to your next payslip.", smsTemplate: "Reminder: {amount} loan deduction on next payslip." },
    { id: "NR-08", trigger: "payslip_unsigned_reminder", enabled: true, channel: "both", recipientRoles: ["employee"], timing: "scheduled", reminderDays: [1, 3, 5], subjectTemplate: "Sign Your Payslip: {period}", bodyTemplate: "Reminder: Please sign your payslip for {period}.", smsTemplate: "Reminder: Sign your payslip for {period}." },
    { id: "NR-09", trigger: "overtime_submitted", enabled: true, channel: "email", recipientRoles: ["admin", "supervisor"], timing: "immediate", subjectTemplate: "Overtime Request: {name}", bodyTemplate: "{name} submitted an overtime request for {date}." },
    { id: "NR-10", trigger: "birthday", enabled: true, channel: "both", recipientRoles: ["employee"], timing: "scheduled", scheduleTime: "08:00", subjectTemplate: "Happy Birthday!", bodyTemplate: "Happy Birthday, {name}! Wishing you a great day!", smsTemplate: "Happy Birthday, {name}!" },
    { id: "NR-11", trigger: "contract_expiry", enabled: true, channel: "email", recipientRoles: ["admin", "hr"], timing: "scheduled", reminderDays: [30, 7], subjectTemplate: "Contract Expiry: {name}", bodyTemplate: "{name}'s probation/contract ends on {date}. Action required." },
    { id: "NR-12", trigger: "daily_summary", enabled: false, channel: "email", recipientRoles: ["admin"], timing: "scheduled", scheduleTime: "18:00", subjectTemplate: "Daily Attendance Summary", bodyTemplate: "Today: {present} present, {absent} absent, {onLeave} on leave." },
    { id: "NR-13", trigger: "location_disabled", enabled: true, channel: "both", recipientRoles: ["admin"], timing: "immediate", subjectTemplate: "Location Disabled: {name}", bodyTemplate: "{name} has disabled location tracking at {time}.", smsTemplate: "{name} disabled GPS at {time}." },
    { id: "NR-14", trigger: "payslip_signed", enabled: true, channel: "email", recipientRoles: ["admin", "finance"], timing: "immediate", subjectTemplate: "Payslip Signed: {name} ({period})", bodyTemplate: "{name} has signed their payslip for {period}." },
    { id: "NR-15", trigger: "payment_confirmed", enabled: true, channel: "sms", recipientRoles: ["employee"], timing: "immediate", subjectTemplate: "Payment Confirmed: {period}", bodyTemplate: "Your payment for {period} has been confirmed. Amount: {amount}.", smsTemplate: "Payment confirmed for {period}. Amount: {amount}." },
];

// ─── Provider config (MVP — simulated) ───────────────────────

export interface NotificationProviderConfig {
    smsProvider: "simulated" | "twilio" | "semaphore";
    emailProvider: "simulated" | "resend" | "smtp";
    smsEnabled: boolean;
    emailEnabled: boolean;
    defaultSenderName: string;
}

const DEFAULT_PROVIDER: NotificationProviderConfig = {
    smsProvider: "simulated",
    emailProvider: "simulated",
    smsEnabled: true,
    emailEnabled: true,
    defaultSenderName: "NexHRMS",
};

// ─── Store ────────────────────────────────────────────────────

interface NotificationsState {
    logs: NotificationLog[];
    rules: NotificationRule[];
    providerConfig: NotificationProviderConfig;

    // Log management
    addLog: (data: Omit<NotificationLog, "id" | "sentAt" | "status">) => void;
    clearLogs: () => void;
    getLogsByType: (type: NotificationType) => NotificationLog[];
    getLogsByEmployee: (employeeId: string) => NotificationLog[];

    // Read tracking (for in-app notifications)
    markAsRead: (notificationId: string) => void;
    markAllAsRead: (employeeId: string) => void;
    getUnreadCountForEmployee: (employeeId: string) => number;
    getUnreadNotificationsForEmployee: (employeeId: string) => NotificationLog[];

    // Rule management
    updateRule: (ruleId: string, patch: Partial<NotificationRule>) => void;
    toggleRule: (ruleId: string) => void;
    getRuleByTrigger: (trigger: NotificationTrigger) => NotificationRule | undefined;
    resetRules: () => void;

    // Provider
    updateProviderConfig: (patch: Partial<NotificationProviderConfig>) => void;

    // Dispatch (simulated send)
    dispatch: (trigger: NotificationTrigger, vars: Record<string, string>, recipientEmployeeId: string, recipientEmail?: string, recipientPhone?: string, link?: string) => void;

    resetToSeed: () => void;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

/** Get default navigation link based on notification type (without role prefix) */
function getDefaultLinkForTrigger(trigger: NotificationTrigger): string {
    const linkMap: Record<NotificationTrigger, string> = {
        payslip_published: "/payroll",
        payslip_signed: "/payroll",
        payslip_unsigned_reminder: "/payroll",
        payment_confirmed: "/payroll",
        leave_submitted: "/leave",
        leave_approved: "/leave",
        leave_rejected: "/leave",
        attendance_missing: "/attendance",
        geofence_violation: "/attendance",
        location_disabled: "/attendance",
        loan_reminder: "/loans",
        overtime_submitted: "/attendance",
        birthday: "/dashboard",
        contract_expiry: "/employees/manage",
        daily_summary: "/dashboard",
        assignment: "/projects",
        reassignment: "/projects",
        absence: "/attendance",
        task_assigned: "/tasks",
        task_submitted: "/tasks",
        task_verified: "/tasks",
        task_rejected: "/tasks",
    };
    return linkMap[trigger] || "/notifications";
}

export const useNotificationsStore = create<NotificationsState>()(
    persist(
        (set, get) => ({
            logs: [],
            rules: [...DEFAULT_RULES],
            providerConfig: { ...DEFAULT_PROVIDER },

            addLog: (data) =>
                set((s) => ({
                    logs: [
                        {
                            ...data,
                            id: `NOTIF-${nanoid(8)}`,
                            sentAt: new Date().toISOString(),
                            status: "simulated" as const,
                        },
                        ...s.logs,
                    ].slice(0, 500), // keep max 500
                })),

            clearLogs: () => set({ logs: [] }),

            getLogsByType: (type) => get().logs.filter((l) => l.type === type),
            getLogsByEmployee: (employeeId) => get().logs.filter((l) => l.employeeId === employeeId),

            // ─── Read Tracking ─────────────────────────
            markAsRead: (notificationId) => {
                set((s) => ({
                    logs: s.logs.map((l) =>
                        l.id === notificationId ? { ...l, read: true, readAt: new Date().toISOString() } : l
                    ),
                }));
                // Persist to DB (fire-and-forget; local state already updated, write-through will also sync)
                fetch("/api/notifications/mark-read", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ notificationId }),
                }).then((res) => {
                    if (!res.ok) console.warn("[notifications] mark-read failed:", res.status);
                }).catch((err) => console.warn("[notifications] mark-read error:", err));
            },

            markAllAsRead: (employeeId) => {
                set((s) => ({
                    logs: s.logs.map((l) =>
                        l.employeeId === employeeId && !l.read
                            ? { ...l, read: true, readAt: new Date().toISOString() }
                            : l
                    ),
                }));
                // Persist to DB (fire-and-forget; local state already updated, write-through will also sync)
                fetch("/api/notifications/mark-read", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ employeeId }),
                }).then((res) => {
                    if (!res.ok) console.warn("[notifications] mark-all-read failed:", res.status);
                }).catch((err) => console.warn("[notifications] mark-all-read error:", err));
            },

            getUnreadCountForEmployee: (employeeId) =>
                get().logs.filter((l) => l.employeeId === employeeId && !l.read).length,

            getUnreadNotificationsForEmployee: (employeeId) =>
                get().logs.filter((l) => l.employeeId === employeeId && !l.read),

            // ─── Rules ─────────────────────────────────
            updateRule: (ruleId, patch) =>
                set((s) => ({
                    rules: s.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
                })),

            toggleRule: (ruleId) =>
                set((s) => ({
                    rules: s.rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)),
                })),

            getRuleByTrigger: (trigger) => get().rules.find((r) => r.trigger === trigger),

            resetRules: () => set({ rules: [...DEFAULT_RULES] }),

            // ─── Provider ──────────────────────────────
            updateProviderConfig: (patch) =>
                set((s) => ({ providerConfig: { ...s.providerConfig, ...patch } })),

            // ─── Dispatch ──────────────────────────────
            dispatch: (trigger, vars, recipientEmployeeId, recipientEmail, recipientPhone, link) => {
                const state = get();
                const rule = state.rules.find((r) => r.trigger === trigger);
                if (!rule || !rule.enabled) return;

                const subject = renderTemplate(rule.subjectTemplate, vars);
                const body = renderTemplate(rule.bodyTemplate, vars);
                const channel = rule.channel;
                
                // Auto-generate link based on trigger type if not provided
                const autoLink = link || getDefaultLinkForTrigger(trigger);

                // Log different channels
                if (channel === "email" || channel === "both") {
                    set((s) => ({
                        logs: [
                            {
                                id: `NOTIF-${nanoid(8)}`,
                                employeeId: recipientEmployeeId,
                                type: trigger,
                                channel: "email" as const,
                                subject,
                                body,
                                sentAt: new Date().toISOString(),
                                status: "simulated" as const,
                                recipientEmail,
                                link: autoLink,
                            },
                            ...s.logs,
                        ].slice(0, 500),
                    }));
                }
                if (channel === "sms" || channel === "both") {
                    const smsBody = rule.smsTemplate ? renderTemplate(rule.smsTemplate, vars) : body;
                    set((s) => ({
                        logs: [
                            {
                                id: `NOTIF-${nanoid(8)}`,
                                employeeId: recipientEmployeeId,
                                type: trigger,
                                channel: "sms" as const,
                                subject,
                                body: smsBody,
                                sentAt: new Date().toISOString(),
                                status: "simulated" as const,
                                recipientPhone,
                                link: autoLink,
                            },
                            ...s.logs,
                        ].slice(0, 500),
                    }));
                }
                if (channel === "in_app") {
                    set((s) => ({
                        logs: [
                            {
                                id: `NOTIF-${nanoid(8)}`,
                                employeeId: recipientEmployeeId,
                                type: trigger,
                                channel: "in_app" as const,
                                subject,
                                body,
                                sentAt: new Date().toISOString(),
                                status: "simulated" as const,
                                link: autoLink,
                            },
                            ...s.logs,
                        ].slice(0, 500),
                    }));
                }
            },

            resetToSeed: () => set({ logs: [], rules: [...DEFAULT_RULES], providerConfig: { ...DEFAULT_PROVIDER } }),
        }),
        {
            name: "nexhrms-notifications",
            version: 3,
            migrate: () => ({ logs: [], rules: [...DEFAULT_RULES], providerConfig: { ...DEFAULT_PROVIDER } }),
        }
    )
);
