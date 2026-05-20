"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import type { NotificationLog, NotificationType, NotificationRule, NotificationTrigger } from "@/types";
import { useEmployeesStore } from "@/store/employees.store";
import { notificationsDb } from "@/services/db.service";

// ─── Default Rules ────────────────────────────────────────────

const DEFAULT_RULES: NotificationRule[] = [
    { id: "NR-01", trigger: "payslip_published", enabled: true, channel: "both", recipientRoles: ["employee"], timing: "immediate", subjectTemplate: "Payslip Ready: {period}", bodyTemplate: "Hi {name}, your payslip for {period} is ready. Net pay: {amount}. Please sign in Soren Data Solutions.", smsTemplate: "Your payslip for {period} is ready. Net: {amount}." },
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
    { id: "NR-16", trigger: "cheat_detected", enabled: true, channel: "both", recipientRoles: ["admin", "hr"], timing: "immediate", subjectTemplate: "Anti-Cheat Alert: {name}", bodyTemplate: "{name} triggered anti-cheat detection: {reason}. A {penalty} minute lockout has been applied." },
    { id: "NR-21", trigger: "absence", enabled: true, channel: "both", recipientRoles: ["admin", "hr"], timing: "immediate", subjectTemplate: "Absence: {name}", bodyTemplate: "{name} has been marked absent for {date}." },
    { id: "NR-17", trigger: "task_assigned", enabled: true, channel: "both", recipientRoles: ["employee"], timing: "immediate", subjectTemplate: "New Task: {title}", bodyTemplate: "You have been assigned a new task: {title}. Due: {dueDate}." },
    { id: "NR-18", trigger: "task_submitted", enabled: true, channel: "both", recipientRoles: ["admin", "hr"], timing: "immediate", subjectTemplate: "Task Submitted: {title}", bodyTemplate: "{name} has submitted \"{title}\" for your review." },
    { id: "NR-19", trigger: "task_verified", enabled: true, channel: "both", recipientRoles: ["employee"], timing: "immediate", subjectTemplate: "Task Approved: {title}", bodyTemplate: "Your task \"{title}\" has been verified and approved." },
    { id: "NR-20", trigger: "task_rejected", enabled: true, channel: "both", recipientRoles: ["employee"], timing: "immediate", subjectTemplate: "Task Rejected: {title}", bodyTemplate: "Your task \"{title}\" was rejected: {reason}." },
    { id: "NR-22", trigger: "payslip_on_hold", enabled: true, channel: "both", recipientRoles: ["employee"], timing: "immediate", subjectTemplate: "Payslip On Hold: {period}", bodyTemplate: "Hi {name}, your payslip for {period} has been placed on hold. Reason: {reason}. Please coordinate with the payroll team to resolve this issue.", smsTemplate: "Your payslip for {period} is on hold. Contact payroll team." },
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
    defaultSenderName: "Soren Data Solutions",
};

// ─── Store ────────────────────────────────────────────────────

interface NotificationsState {
    logs: NotificationLog[];
    rules: NotificationRule[];
    providerConfig: NotificationProviderConfig;
    hasFetchedFromDb: boolean;

    // DB sync
    fetchFromDb: () => Promise<void>;

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

    // Per-employee opt-out preferences (keyed by employeeId)
    employeePrefs: Record<string, EmployeeNotifPrefs>;
    setEmployeePref: (employeeId: string, patch: Partial<EmployeeNotifPrefs>) => void;
    getEmployeePref: (employeeId: string) => EmployeeNotifPrefs;

    // Dispatch (simulated send)
    dispatch: (trigger: NotificationTrigger, vars: Record<string, string>, recipientEmployeeId: string, recipientEmail?: string, recipientPhone?: string, link?: string) => void;
    /** Batch dispatch — single setState for all entries, push in parallel */
    batchDispatch: (entries: Array<{ trigger: NotificationTrigger; vars: Record<string, string>; recipientEmployeeId: string; recipientEmail?: string; recipientPhone?: string; link?: string }>) => void;

    resetToSeed: () => void;
}

// Per-employee notification opt-out preferences.
// Defaults to all enabled — only opt-outs are stored.
export interface EmployeeNotifPrefs {
    leaveUpdates: boolean;   // leave_approved, leave_rejected
    absenceAlerts: boolean;  // absence, attendance_missing
    payrollAlerts: boolean;  // payslip_published, payment_confirmed, payslip_unsigned_reminder
    pushEnabled: boolean;    // Web Push notifications (browser-level)
}

export const DEFAULT_EMPLOYEE_PREFS: EmployeeNotifPrefs = {
    leaveUpdates: true,
    absenceAlerts: true,
    payrollAlerts: true,
    pushEnabled: true,
};

/** Returns which pref key gates a given trigger, or null if always allowed. */
export function prefKeyForTrigger(trigger: NotificationTrigger | string): keyof EmployeeNotifPrefs | null {
    if (trigger === "leave_submitted" || trigger === "leave_approved" || trigger === "leave_rejected") return "leaveUpdates";
    if (trigger === "absence" || trigger === "attendance_missing") return "absenceAlerts";
    if (
        trigger === "payslip_published" ||
        trigger === "payment_confirmed" ||
        trigger === "payslip_unsigned_reminder" ||
        trigger === "payslip_signed" ||
        trigger === "payslip_on_hold"
    ) return "payrollAlerts";
    return null;
}

/** Check if a notification should be allowed for the given employee. */
export function isNotificationAllowed(employeeId: string, triggerOrType: NotificationTrigger | string): boolean {
    const state = useNotificationsStore.getState();
    const prefs = { ...DEFAULT_EMPLOYEE_PREFS, ...state.employeePrefs[employeeId] };
    const prefKey = prefKeyForTrigger(triggerOrType);
    if (prefKey !== null && !prefs[prefKey]) return false;
    return true;
}

/** Check if push is enabled for the given employee. */
export function isPushAllowed(employeeId: string): boolean {
    const state = useNotificationsStore.getState();
    const prefs = { ...DEFAULT_EMPLOYEE_PREFS, ...state.employeePrefs[employeeId] };
    return prefs.pushEnabled;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

function isLegacyIosAltitudeFalsePositiveNotification(log: { type: string; body?: string }): boolean {
    return log.type === "cheat_detected" && /ios altitude.*missing/i.test(log.body ?? "");
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
        cheat_detected: "/attendance",
        payslip_on_hold: "/payroll",
    };
    return linkMap[trigger] || "/notifications";
}

export const useNotificationsStore = create<NotificationsState>()(
    (set, get) => ({
            logs: [],
            rules: [...DEFAULT_RULES],
            providerConfig: { ...DEFAULT_PROVIDER },
            employeePrefs: {} as Record<string, EmployeeNotifPrefs>,
            hasFetchedFromDb: false,

            fetchFromDb: async () => {
                try {
                    const res = await fetch("/api/settings/notifications");
                    if (!res.ok) return;
                    const data = await res.json();
                    if (data && typeof data === "object") {
                        const patch: Partial<NotificationsState> = { hasFetchedFromDb: true };
                        if (Array.isArray(data.rules) && data.rules.length > 0) {
                            // Merge DB rules with local defaults for any triggers not in DB
                            const dbTriggers = new Set(data.rules.map((r: { trigger: string }) => r.trigger));
                            const merged = [
                                ...data.rules,
                                ...DEFAULT_RULES.filter((r) => !dbTriggers.has(r.trigger)),
                            ];
                            patch.rules = merged as NotificationRule[];
                        }
                        if (data.providerConfig) {
                            patch.providerConfig = { ...DEFAULT_PROVIDER, ...data.providerConfig };
                        }
                        set(patch as Partial<NotificationsState> & object);
                    } else {
                        set({ hasFetchedFromDb: true });
                    }
                } catch {
                    set({ hasFetchedFromDb: true });
                }
            },

            addLog: (data) => {
                if (isLegacyIosAltitudeFalsePositiveNotification(data)) return;

                // Check per-employee category opt-out
                const empPrefs = { ...DEFAULT_EMPLOYEE_PREFS, ...get().employeePrefs[data.employeeId] };
                const prefKey = prefKeyForTrigger(data.type);
                if (prefKey !== null && !empPrefs[prefKey]) return; // employee opted out of this category

                const notificationId = `NOTIF-${nanoid(8)}`;
                set((s) => ({
                    logs: [
                        {
                            ...data,
                            id: notificationId,
                            sentAt: new Date().toISOString(),
                            status: "simulated" as const,
                        },
                        ...s.logs,
                    ].slice(0, 500), // keep max 500
                }));
                // Fire push notification only if employee has push enabled
                if (!empPrefs.pushEnabled) return;
                try {
                    let pushUrl = data.link || "/notifications";
                    const emp = useEmployeesStore.getState().employees.find((e) => e.id === data.employeeId);
                    if (emp?.role) {
                        pushUrl = `/${emp.role}${data.link || "/notifications"}`;
                    }
                    fetch("/api/push/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            employeeId: data.employeeId,
                            title: data.subject,
                            body: data.body,
                            url: pushUrl,
                            tag: notificationId,
                        }),
                    }).catch(() => { /* push is best-effort */ });
                } catch { /* best-effort */ }
            },

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
            updateRule: (ruleId, patch) => {
                set((s) => ({
                    rules: s.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
                }));
                // Sync updated rule to DB
                const updated = get().rules.find((r) => r.id === ruleId);
                if (updated) {
                    void fetch("/api/settings/notifications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rule: updated }),
                    }).catch(() => {});
                }
            },

            toggleRule: (ruleId) => {
                set((s) => ({
                    rules: s.rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)),
                }));
                const updated = get().rules.find((r) => r.id === ruleId);
                if (updated) {
                    void fetch("/api/settings/notifications", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ rule: updated }),
                    }).catch(() => {});
                }
            },

            getRuleByTrigger: (trigger) => get().rules.find((r) => r.trigger === trigger),

            resetRules: () => {
                set({ rules: [...DEFAULT_RULES] });
                void fetch("/api/settings/notifications", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rules: DEFAULT_RULES }),
                }).catch(() => {});
            },

            // ─── Provider ──────────────────────────────
            updateProviderConfig: (patch) => {
                set((s) => ({ providerConfig: { ...s.providerConfig, ...patch } }));
                void fetch("/api/settings/notifications", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ providerConfig: { ...get().providerConfig, ...patch } }),
                }).catch(() => {});
            },

            // ─── Per-employee prefs ─────────────────────
            setEmployeePref: (employeeId, patch) =>
                set((s) => ({
                    employeePrefs: {
                        ...s.employeePrefs,
                        [employeeId]: { ...DEFAULT_EMPLOYEE_PREFS, ...s.employeePrefs[employeeId], ...patch },
                    },
                })),

            getEmployeePref: (employeeId) => ({
                ...DEFAULT_EMPLOYEE_PREFS,
                ...get().employeePrefs[employeeId],
            }),

            // ─── Dispatch ──────────────────────────────
            dispatch: (trigger, vars, recipientEmployeeId, recipientEmail, recipientPhone, link) => {
                const state = get();
                const rule = state.rules.find((r) => r.trigger === trigger);
                if (!rule || !rule.enabled) return;

                // Check per-employee opt-out preference
                const prefKey = prefKeyForTrigger(trigger);
                if (prefKey !== null) {
                    const prefs = { ...DEFAULT_EMPLOYEE_PREFS, ...state.employeePrefs[recipientEmployeeId] };
                    if (!prefs[prefKey]) return; // employee opted out
                }

                const subject = renderTemplate(rule.subjectTemplate, vars);
                const body = renderTemplate(rule.bodyTemplate, vars);
                const channel = rule.channel;
                
                // Auto-generate link based on trigger type if not provided
                const autoLink = link || getDefaultLinkForTrigger(trigger);

                // Generate unique notification ID upfront so we can use it for both log and push tag
                const notificationId = `NOTIF-${nanoid(8)}`;

                // Always create exactly ONE log entry per dispatch regardless of channel.
                // Previously channel="both" created two entries (email + SMS), causing
                // duplicate notifications visible to the employee.
                const logBody =
                    (channel === "sms" || channel === "both") && rule.smsTemplate
                        ? renderTemplate(rule.smsTemplate, vars)
                        : body;

                if (isLegacyIosAltitudeFalsePositiveNotification({ type: trigger, body: logBody })) return;

                set((s) => ({
                    logs: [
                        {
                            id: notificationId,
                            employeeId: recipientEmployeeId,
                            type: trigger,
                            channel: channel as NotificationLog["channel"],
                            subject,
                            body: logBody,
                            sentAt: new Date().toISOString(),
                            status: "simulated" as const,
                            recipientEmail: channel === "email" || channel === "both" ? recipientEmail : undefined,
                            recipientPhone: channel === "sms" || channel === "both" ? recipientPhone : undefined,
                            link: autoLink,
                        },
                        ...s.logs,
                    ].slice(0, 500),
                }));

                // Write to DB (fire-and-forget)
                notificationsDb.insertLog({
                    id: notificationId,
                    employeeId: recipientEmployeeId,
                    type: trigger,
                    channel: channel as NotificationLog["channel"],
                    subject,
                    body: logBody,
                    sentAt: new Date().toISOString(),
                    status: "simulated" as const,
                    recipientEmail: channel === "email" || channel === "both" ? recipientEmail : undefined,
                    recipientPhone: channel === "sms" || channel === "both" ? recipientPhone : undefined,
                    link: autoLink,
                } as NotificationLog).catch((err) => {
                    console.warn("[notifications] DB write failed:", err);
                });

                // ─── Fire real push notification (fire-and-forget) ───
                // Only send push if the employee has push enabled in their prefs.
                const recipientPrefs = { ...DEFAULT_EMPLOYEE_PREFS, ...state.employeePrefs[recipientEmployeeId] };
                if (recipientPrefs.pushEnabled) {
                    let pushUrl = autoLink;
                    try {
                        const emp = useEmployeesStore.getState().employees.find((e) => e.id === recipientEmployeeId);
                        if (emp?.role) {
                            pushUrl = `/${emp.role}${autoLink}`;
                        }
                    } catch { /* best-effort */ }

                    fetch("/api/push/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            employeeId: recipientEmployeeId,
                            title: subject,
                            body,
                            url: pushUrl,
                            tag: notificationId,
                        }),
                    }).catch((err) => {
                        console.debug("[notifications] Push send failed (non-critical):", err);
                    });
                }
            },

            // ─── Batch Dispatch ─────────────────────────────
            batchDispatch: (entries) => {
                const state = get();
                const newLogs: NotificationLog[] = [];
                const pushPayloads: Array<{ employeeId: string; title: string; body: string; url: string; tag: string }> = [];

                for (const entry of entries) {
                    const rule = state.rules.find((r) => r.trigger === entry.trigger);
                    if (!rule || !rule.enabled) continue;

                    // Per-employee opt-out check
                    const prefKey = prefKeyForTrigger(entry.trigger);
                    if (prefKey !== null) {
                        const prefs = { ...DEFAULT_EMPLOYEE_PREFS, ...state.employeePrefs[entry.recipientEmployeeId] };
                        if (!prefs[prefKey]) continue;
                    }

                    const subject = renderTemplate(rule.subjectTemplate, entry.vars);
                    const body = renderTemplate(rule.bodyTemplate, entry.vars);
                    const channel = rule.channel;
                    const autoLink = entry.link || getDefaultLinkForTrigger(entry.trigger);
                    const notificationId = `NOTIF-${nanoid(8)}`;

                    const logBody =
                        (channel === "sms" || channel === "both") && rule.smsTemplate
                            ? renderTemplate(rule.smsTemplate, entry.vars)
                            : body;

                    if (isLegacyIosAltitudeFalsePositiveNotification({ type: entry.trigger, body: logBody })) continue;

                    newLogs.push({
                        id: notificationId,
                        employeeId: entry.recipientEmployeeId,
                        type: entry.trigger,
                        channel: channel as NotificationLog["channel"],
                        subject,
                        body: logBody,
                        sentAt: new Date().toISOString(),
                        status: "simulated" as const,
                        recipientEmail: channel === "email" || channel === "both" ? entry.recipientEmail : undefined,
                        recipientPhone: channel === "sms" || channel === "both" ? entry.recipientPhone : undefined,
                        link: autoLink,
                    });

                    // Collect push payloads
                    const recipientPrefs = { ...DEFAULT_EMPLOYEE_PREFS, ...state.employeePrefs[entry.recipientEmployeeId] };
                    if (recipientPrefs.pushEnabled) {
                        let pushUrl = autoLink;
                        try {
                            const emp = useEmployeesStore.getState().employees.find((e) => e.id === entry.recipientEmployeeId);
                            if (emp?.role) pushUrl = `/${emp.role}${autoLink}`;
                        } catch { /* best-effort */ }
                        pushPayloads.push({ employeeId: entry.recipientEmployeeId, title: subject, body, url: pushUrl, tag: notificationId });
                    }
                }

                // Single setState for all logs
                if (newLogs.length > 0) {
                    set((s) => ({
                        logs: [...newLogs, ...s.logs].slice(0, 500),
                    }));
                    // Write to DB (fire-and-forget)
                    notificationsDb.batchInsertLogs(newLogs).catch((err) => {
                        console.warn("[notifications] batch DB write failed:", err);
                    });
                }

                // Fire push notifications in parallel (fire-and-forget)
                if (pushPayloads.length > 0) {
                    Promise.all(
                        pushPayloads.map((p) =>
                            fetch("/api/push/send", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(p),
                            }).catch(() => { /* push is best-effort */ })
                        )
                    ).catch(() => { /* best-effort */ });
                }
            },

            resetToSeed: () => {
                set({ logs: [], rules: [...DEFAULT_RULES], providerConfig: { ...DEFAULT_PROVIDER }, employeePrefs: {} });
                // Sync defaults back to DB
                void fetch("/api/settings/notifications", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ rules: DEFAULT_RULES }),
                }).catch(() => {});
                void fetch("/api/settings/notifications", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ providerConfig: DEFAULT_PROVIDER }),
                }).catch(() => {});
            },
        })
);
