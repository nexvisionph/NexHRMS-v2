"use client";

import { useNotificationsStore } from "@/store/notifications.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Bell, Trash2, Mail, MessageSquare, Settings, Check, CheckCheck, Clock } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { useMemo } from "react";

const typeColors: Record<string, string> = {
    assignment: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    reassignment: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
    absence: "bg-red-500/15 text-red-700 dark:text-red-400",
    payslip_published: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    payslip_signed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    payslip_unsigned_reminder: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    payment_confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    leave_submitted: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
    leave_approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    leave_rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
    attendance_missing: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    geofence_violation: "bg-red-500/15 text-red-700 dark:text-red-400",
    location_disabled: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    loan_reminder: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
    overtime_submitted: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
    birthday: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400",
    contract_expiry: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    daily_summary: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
};

const typeLabels: Record<string, string> = {
    assignment: "Assignment",
    reassignment: "Reassignment",
    absence: "Absence",
    payslip_published: "Payslip Published",
    payslip_signed: "Payslip Signed",
    payslip_unsigned_reminder: "Unsigned Reminder",
    payment_confirmed: "Payment Confirmed",
    leave_submitted: "Leave Submitted",
    leave_approved: "Leave Approved",
    leave_rejected: "Leave Rejected",
    attendance_missing: "Missing Attendance",
    geofence_violation: "Geofence Violation",
    location_disabled: "GPS Disabled",
    loan_reminder: "Loan Reminder",
    overtime_submitted: "OT Submitted",
    birthday: "Birthday",
    contract_expiry: "Contract Expiry",
    daily_summary: "Daily Summary",
};

const channelIcons: Record<string, string> = {
    email: "\uD83D\uDCE7 Email",
    sms: "\uD83D\uDCF1 SMS",
    both: "\uD83D\uDCE8 Both",
    in_app: "\uD83D\uDD14 In-App",
};

export default function NotificationsPage() {
    const { logs, clearLogs, markAsRead, markAllAsRead, getLogsByEmployee } = useNotificationsStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const router = useRouter();

    const { hasPermission } = useRolesStore();
    const rh = useRoleHref();
    const isAdmin = hasPermission(currentUser.role, "notifications:manage");

    // Handle notification click - mark as read and navigate
    const handleNotificationClick = (notificationId: string, link?: string, isRead?: boolean) => {
        if (!isRead) {
            markAsRead(notificationId);
        }
        if (link) {
            router.push(rh(link));
        }
    };

    // Get current employee ID for filtering
    const currentEmployeeId = useMemo(() => {
        const emp = employees.find(
            (e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name
        );
        return emp?.id;
    }, [employees, currentUser]);

    // Filter notifications for non-admin users
    const displayLogs = useMemo(() => {
        if (isAdmin) return logs;
        if (!currentEmployeeId) return [];
        return logs.filter((l) => l.employeeId === currentEmployeeId);
    }, [logs, isAdmin, currentEmployeeId]);

    const unreadCount = useMemo(() => {
        return displayLogs.filter((l) => !l.read).length;
    }, [displayLogs]);

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    const formatSentAt = (iso: string) => {
        try { return format(parseISO(iso), "MMM dd, yyyy \u00B7 hh:mm a"); }
        catch { return iso; }
    };

    const formatRelativeTime = (iso: string) => {
        try { return formatDistanceToNow(parseISO(iso), { addSuffix: true }); }
        catch { return iso; }
    };

    // Employee View - Card-based notification list
    if (!isAdmin) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">My Notifications</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {displayLogs.length} notification{displayLogs.length !== 1 ? "s" : ""}
                            {unreadCount > 0 && ` · ${unreadCount} unread`}
                        </p>
                    </div>
                    {unreadCount > 0 && currentEmployeeId && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => markAllAsRead(currentEmployeeId)}
                        >
                            <CheckCheck className="h-4 w-4" /> Mark All Read
                        </Button>
                    )}
                </div>

                {displayLogs.length === 0 ? (
                    <Card className="border border-border/50">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Bell className="h-12 w-12 mb-3 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">No notifications yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                You&apos;ll see updates about payslips, leave requests, and more here
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {displayLogs.map((log) => (
                            <Card
                                key={log.id}
                                className={`border transition-colors cursor-pointer hover:bg-muted/50 ${!log.read ? "bg-primary/5 border-primary/20" : "border-border/50"}`}
                                onClick={() => handleNotificationClick(log.id, log.link, log.read)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-full ${typeColors[log.type] || "bg-muted"}`}>
                                            <Bell className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="secondary" className={`text-[10px] ${typeColors[log.type] || ""}`}>
                                                    {typeLabels[log.type] || log.type}
                                                </Badge>
                                                {!log.read && (
                                                    <span className="h-2 w-2 rounded-full bg-primary" />
                                                )}
                                            </div>
                                            <h3 className="font-medium text-sm">{log.subject}</h3>
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{log.body}</p>
                                            <p className="text-xs text-muted-foreground/60 mt-2 flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatRelativeTime(log.sentAt)}
                                            </p>
                                        </div>
                                        {!log.read && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    markAsRead(log.id);
                                                }}
                                            >
                                                <Check className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Notification Log</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {logs.length} notification{logs.length !== 1 ? "s" : ""} dispatched
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href={rh("/settings/notifications")}>
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <Settings className="h-4 w-4" /> Rules
                        </Button>
                    </Link>
                    {logs.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                            onClick={clearLogs}
                        >
                            <Trash2 className="h-4 w-4" /> Clear All
                        </Button>
                    )}
                </div>
            </div>

            {/* Summary Badges */}
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px] gap-1">
                    <Mail className="h-3 w-3" /> {logs.filter((l) => l.channel === "email" || l.channel === "both").length} email
                </Badge>
                <Badge variant="secondary" className="text-[10px] gap-1">
                    <MessageSquare className="h-3 w-3" /> {logs.filter((l) => l.channel === "sms" || l.channel === "both").length} SMS
                </Badge>
                <Badge variant="secondary" className="text-[10px] gap-1">
                    <Bell className="h-3 w-3" /> {logs.filter((l) => l.channel === "in_app" || !l.channel).length} in-app
                </Badge>
            </div>

            <Card className="border border-border/50">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Employee</TableHead>
                                <TableHead className="text-xs">Type</TableHead>
                                <TableHead className="text-xs">Channel</TableHead>
                                <TableHead className="text-xs">Subject</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="text-xs">Sent At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                                        <p className="text-sm text-muted-foreground">No notifications dispatched yet</p>
                                        <p className="text-xs text-muted-foreground/60 mt-1">
                                            Notifications are triggered by payroll actions, attendance, leave, and geofence events
                                        </p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-sm font-medium">{getEmpName(log.employeeId)}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={`text-[10px] ${typeColors[log.type] || ""}`}>
                                                {typeLabels[log.type] || log.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs whitespace-nowrap">
                                                {channelIcons[log.channel || "in_app"] || "\uD83D\uDD14 In-App"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs max-w-[220px] truncate text-muted-foreground" title={log.subject}>
                                            {log.subject}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className={`text-[10px] ${
                                                log.status === "sent" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" :
                                                log.status === "failed" ? "bg-red-500/15 text-red-700 dark:text-red-400" :
                                                "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                            }`}>
                                                {log.status || "simulated"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                            {formatSentAt(log.sentAt)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                  </div>
                </CardContent>
            </Card>
        </div>
    );
}
