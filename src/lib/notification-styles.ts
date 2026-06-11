import type { NotificationType } from "@/types";

/**
 * Returns Tailwind CSS classes for the notification badge border/styling.
 * Used on <Badge> components to colour-code notification types.
 */
export function getNotificationBadgeClass(type: NotificationType): string {
    switch (type) {
        // ─── Payroll ────────────────────────────────────
        case "payslip_published":
        case "payslip_signed":
        case "payslip_unsigned_reminder":
        case "payment_confirmed":
        case "payslip_on_hold":
            return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";

        // ─── Leave ──────────────────────────────────────
        case "leave_submitted":
        case "leave_approved":
        case "leave_rejected":
            return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30";

        // ─── Attendance / Geofence ──────────────────────
        case "attendance_missing":
        case "geofence_violation":
        case "location_disabled":
        case "cheat_detected":
        case "absence":
            return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30";

        // ─── Tasks ──────────────────────────────────────
        case "task_assigned":
        case "task_submitted":
        case "task_verified":
        case "task_rejected":
            return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30";

        // ─── Loans ──────────────────────────────────────
        case "loan_reminder":
        case "loan_created":
        case "loan_settled":
        case "loan_frozen":
        case "loan_unfrozen":
            return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";

        // ─── Disciplinary ───────────────────────────────
        case "disciplinary_explanation_submitted":
        case "disciplinary_case_created":
        case "nte_issued":
        case "nod_issued":
            return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30";

        // ─── Employee / HR Management ───────────────────
        case "employee_added":
        case "status_changed":
        case "resignation":
        case "salary_approved":
        case "salary_rejected":
            return "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30";

        // ─── Projects / Assignment ──────────────────────
        case "assignment":
        case "reassignment":
            return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30";

        // ─── Birthday / Personal ────────────────────────
        case "birthday":
            return "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/30";

        // ─── Contract / Summary ─────────────────────────
        case "contract_expiry":
        case "daily_summary":
            return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30";

        // ─── Overtime ───────────────────────────────────
        case "overtime_submitted":
            return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30";

        // ─── Fallback ───────────────────────────────────
        default:
            return "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30";
    }
}

/**
 * Returns Tailwind CSS classes for the notification icon container.
 * The class string intentionally includes the colour name (red, emerald, blue …)
 * so consumers can derive dot colours via string matching.
 */
export function getNotificationIconClass(type: NotificationType): string {
    switch (type) {
        // ─── Payroll ────────────────────────────────────
        case "payslip_published":
        case "payslip_signed":
        case "payslip_unsigned_reminder":
        case "payment_confirmed":
        case "payslip_on_hold":
            return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";

        // ─── Leave ──────────────────────────────────────
        case "leave_submitted":
        case "leave_approved":
        case "leave_rejected":
            return "bg-blue-500/15 text-blue-600 dark:text-blue-400";

        // ─── Attendance / Geofence ──────────────────────
        case "attendance_missing":
        case "geofence_violation":
        case "location_disabled":
        case "cheat_detected":
        case "absence":
            return "bg-red-500/15 text-red-600 dark:text-red-400";

        // ─── Tasks ──────────────────────────────────────
        case "task_assigned":
        case "task_submitted":
        case "task_verified":
        case "task_rejected":
            return "bg-purple-500/15 text-purple-600 dark:text-purple-400";

        // ─── Loans ──────────────────────────────────────
        case "loan_reminder":
        case "loan_created":
        case "loan_settled":
        case "loan_frozen":
        case "loan_unfrozen":
            return "bg-amber-500/15 text-amber-600 dark:text-amber-400";

        // ─── Disciplinary ───────────────────────────────
        case "disciplinary_explanation_submitted":
        case "disciplinary_case_created":
        case "nte_issued":
        case "nod_issued":
            return "bg-rose-500/15 text-rose-600 dark:text-rose-400";

        // ─── Employee / HR Management ───────────────────
        case "employee_added":
        case "status_changed":
        case "resignation":
        case "salary_approved":
        case "salary_rejected":
            return "bg-teal-500/15 text-teal-600 dark:text-teal-400";

        // ─── Projects / Assignment ──────────────────────
        case "assignment":
        case "reassignment":
            return "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400";

        // ─── Birthday / Personal ────────────────────────
        case "birthday":
            return "bg-pink-500/15 text-pink-600 dark:text-pink-400";

        // ─── Contract / Summary ─────────────────────────
        case "contract_expiry":
        case "daily_summary":
            return "bg-orange-500/15 text-orange-600 dark:text-orange-400";

        // ─── Overtime ───────────────────────────────────
        case "overtime_submitted":
            return "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400";

        // ─── Fallback ───────────────────────────────────
        default:
            return "bg-slate-500/15 text-slate-600 dark:text-slate-400";
    }
}

/**
 * Returns a human-readable label for each notification type.
 */
export function getNotificationLabel(type: NotificationType): string {
    switch (type) {
        // ─── Payroll ────────────────────────────────────
        case "payslip_published":
            return "Payslip";
        case "payslip_signed":
            return "Payslip Signed";
        case "payslip_unsigned_reminder":
            return "Sign Reminder";
        case "payment_confirmed":
            return "Payment";
        case "payslip_on_hold":
            return "On Hold";

        // ─── Leave ──────────────────────────────────────
        case "leave_submitted":
            return "Leave";
        case "leave_approved":
            return "Leave Approved";
        case "leave_rejected":
            return "Leave Rejected";

        // ─── Attendance / Geofence ──────────────────────
        case "attendance_missing":
            return "Attendance";
        case "geofence_violation":
            return "Geofence";
        case "location_disabled":
            return "Location";
        case "cheat_detected":
            return "Anti-Cheat";
        case "absence":
            return "Absence";

        // ─── Tasks ──────────────────────────────────────
        case "task_assigned":
            return "Task";
        case "task_submitted":
            return "Task Submitted";
        case "task_verified":
            return "Task Approved";
        case "task_rejected":
            return "Task Rejected";

        // ─── Loans ──────────────────────────────────────
        case "loan_reminder":
            return "Loan";
        case "loan_created":
            return "New Loan";
        case "loan_settled":
            return "Loan Settled";
        case "loan_frozen":
            return "Loan Frozen";
        case "loan_unfrozen":
            return "Loan Reinstated";

        // ─── Disciplinary ───────────────────────────────
        case "disciplinary_explanation_submitted":
            return "Explanation";
        case "disciplinary_case_created":
            return "Disciplinary";
        case "nte_issued":
            return "NTE";
        case "nod_issued":
            return "NOD";

        // ─── Employee / HR Management ───────────────────
        case "employee_added":
            return "Welcome";
        case "status_changed":
            return "Status";
        case "resignation":
            return "Resignation";
        case "salary_approved":
            return "Salary Approved";
        case "salary_rejected":
            return "Salary Rejected";

        // ─── Projects / Assignment ──────────────────────
        case "assignment":
            return "Assignment";
        case "reassignment":
            return "Reassignment";

        // ─── Birthday / Personal ────────────────────────
        case "birthday":
            return "Birthday";

        // ─── Contract / Summary ─────────────────────────
        case "contract_expiry":
            return "Contract";
        case "daily_summary":
            return "Summary";

        // ─── Overtime ───────────────────────────────────
        case "overtime_submitted":
            return "Overtime";

        // ─── Fallback ───────────────────────────────────
        default:
            return "Notification";
    }
}