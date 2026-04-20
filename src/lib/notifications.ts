import { useNotificationsStore, isNotificationAllowed, isPushAllowed } from "@/store/notifications.store";
import { useEmployeesStore } from "@/store/employees.store";
import { toast } from "sonner";
import type { NotificationType, NotificationTrigger } from "@/types";

/** Map notification type to its default navigation link (without role prefix) */
const TYPE_LINK_MAP: Record<string, string> = {
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

interface SendNotificationParams {
    type: NotificationType;
    employeeId: string;
    subject: string;
    body: string;
    channel?: "email" | "sms" | "both" | "in_app";
    link?: string;
    // Optional — used to enrich the notification toast if available
    employeeName?: string;
    employeeEmail?: string;
    employeePhone?: string;
}

/**
 * Mock email notification sender.
 * Logs to notification store and shows a toast.
 * Respects per-employee category opt-outs and push prefs.
 */
export function sendNotification(params: SendNotificationParams): void {
    const { employeeId, type, subject, body, channel = "email", link, employeeName, employeeEmail, employeePhone } = params;

    // Check per-employee opt-out for this notification category
    if (!isNotificationAllowed(employeeId, type)) return;

    // Auto-generate link based on notification type if not explicitly provided
    const resolvedLink = link || TYPE_LINK_MAP[type] || "/notifications";

    // Generate unique notification ID upfront so we can use it for both log and push tag
    const notificationId = `NOTIF-${Math.random().toString(36).substring(2, 10)}`;

    // Save to notification store with our pre-generated ID
    const state = useNotificationsStore.getState();
    useNotificationsStore.setState({
        logs: [
            {
                id: notificationId,
                employeeId,
                type,
                subject,
                body,
                channel,
                link: resolvedLink,
                recipientEmail: employeeEmail,
                recipientPhone: employeePhone,
                sentAt: new Date().toISOString(),
                status: "simulated" as const,
            },
            ...state.logs,
        ].slice(0, 500),
    });

    // Fire push notification only if the employee has push enabled
    if (isPushAllowed(employeeId)) {
        let pushUrl = resolvedLink;
        try {
            const emp = useEmployeesStore.getState().employees.find((e) => e.id === employeeId);
            if (emp?.role) {
                pushUrl = `/${emp.role}${resolvedLink}`;
            }
        } catch { /* best-effort */ }

        fetch("/api/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employeeId,
                title: subject,
                body,
                url: pushUrl,
                tag: notificationId,
            }),
        }).catch(() => { /* push is best-effort */ });
    }

    // Show toast simulating dispatch
    const toLabel = employeeName ?? employeeId;
    const icon = channel === "sms" ? "\uD83D\uDCF1" : channel === "both" ? "\uD83D\uDCE8" : "\uD83D\uDCE7";
    toast.success(`${icon} ${channel === "sms" ? "SMS" : channel === "both" ? "Email + SMS" : "Email"} sent to ${toLabel}`, { description: subject });

    // Console log for debugging / demo
    console.log(
        `[MOCK ${channel.toUpperCase()}] To: ${employeeEmail ?? employeePhone ?? employeeId}\nSubject: ${subject}\nBody: ${body}`
    );
}

/**
 * Dispatch notification using the rules-based system.
 */
export function dispatchNotification(
    trigger: NotificationTrigger,
    vars: Record<string, string>,
    recipientEmployeeId: string,
    recipientEmail?: string,
    recipientPhone?: string
): void {
    const store = useNotificationsStore.getState();
    store.dispatch(trigger, vars, recipientEmployeeId, recipientEmail, recipientPhone);

    // Show toast for the user
    const rule = store.getRuleByTrigger(trigger);
    if (rule && rule.enabled) {
        const subject = rule.subjectTemplate.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
        const channelLabel = rule.channel === "sms" ? "SMS" : rule.channel === "both" ? "Email + SMS" : rule.channel === "in_app" ? "In-app" : "Email";
        const icon = rule.channel === "sms" ? "\uD83D\uDCF1" : rule.channel === "both" ? "\uD83D\uDCE8" : "\uD83D\uDCE7";
        toast.success(`${icon} ${channelLabel} sent (simulated)`, { description: subject });
    }
}

/**
 * Convenience factories for common notification types.
 */
export function notifyProjectAssignment(params: {
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    projectName: string;
}): void {
    sendNotification({
        type: "assignment",
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        employeeEmail: params.employeeEmail,
        subject: `New Project Assignment: ${params.projectName}`,
        body: `Hi ${params.employeeName}, you have been assigned to "${params.projectName}". Please report to the project location. Contact HR for more details.`,
    });
}

export function notifyAbsence(params: {
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    date: string;
}): void {
    sendNotification({
        type: "absence",
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        employeeEmail: params.employeeEmail,
        subject: `Attendance Alert: Marked absent on ${params.date}`,
        body: `Hi ${params.employeeName}, you were marked absent for ${params.date}. Please provide a reason or contact HR if this is an error.`,
    });
}

export function notifyGeofenceViolation(params: {
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    distance: number;
    time: string;
}): void {
    // Auto-resolve admin recipients (rule says recipientRoles: ["admin"])
    const employees = useEmployeesStore.getState().employees;
    const admins = employees.filter(
        (e) => e.role === "admin" && e.status === "active"
    );
    const vars = { name: params.employeeName, time: params.time, distance: String(params.distance) };
    if (admins.length > 0) {
        admins.forEach((admin) => {
            dispatchNotification("geofence_violation", vars, admin.id, admin.email ?? undefined);
        });
    } else {
        // Fallback: send to the caller-provided employee ID
        dispatchNotification("geofence_violation", vars, params.employeeId, params.employeeEmail);
    }
}

export function notifyPayslipPublished(params: {
    employeeId: string;
    employeeName: string;
    employeeEmail: string;
    employeePhone?: string;
    period: string;
    amount: string;
}): void {
    dispatchNotification("payslip_published", {
        name: params.employeeName,
        period: params.period,
        amount: params.amount,
    }, params.employeeId, params.employeeEmail, params.employeePhone);
}

export function notifyPayslipSigned(params: {
    employeeId: string;
    employeeName: string;
    period: string;
}): void {
    // Notify admin/finance users only (per rule NR-14 recipientRoles: ["admin", "finance"])
    const employees = useEmployeesStore.getState().employees;
    const adminsAndFinance = employees.filter(
        (e) => (e.role === "admin" || e.role === "finance") && e.status === "active" && e.id !== params.employeeId
    );
    adminsAndFinance.forEach((recipient) => {
        dispatchNotification("payslip_signed", {
            name: params.employeeName,
            period: params.period,
        }, recipient.id, recipient.email ?? undefined);
    });
}

export function notifyPaymentConfirmed(params: {
    employeeId: string;
    employeeName: string;
    employeePhone?: string;
    period: string;
    amount: string;
}): void {
    dispatchNotification("payment_confirmed", {
        name: params.employeeName,
        period: params.period,
        amount: params.amount,
    }, params.employeeId, undefined, params.employeePhone);
}

export function notifyLocationDisabled(params: {
    employeeId: string;
    employeeName: string;
    time: string;
}): void {
    // Notify admin users only (per rule NR-13 recipientRoles: ["admin"])
    const employees = useEmployeesStore.getState().employees;
    const admins = employees.filter(
        (e) => e.role === "admin" && e.status === "active" && e.id !== params.employeeId
    );
    const vars = { name: params.employeeName, time: params.time };
    admins.forEach((admin) => {
        dispatchNotification("location_disabled", vars, admin.id, admin.email ?? undefined);
    });
}
