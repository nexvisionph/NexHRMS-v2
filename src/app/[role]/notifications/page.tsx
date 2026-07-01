"use client";

import { useNotificationsStore } from "@/store/notifications.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bell, Trash2, Mail, MessageSquare, Settings, Check, CheckCheck, Clock } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { getNotificationBadgeClass, getNotificationIconClass, getNotificationLabel } from "@/lib/notification-styles";
import { useMemo, useState } from "react";

const channelIcons: Record<string, string> = {
    email: "\uD83D\uDCE7 Email",
    sms: "\uD83D\uDCF1 SMS",
    both: "\uD83D\uDCE8 Both",
    in_app: "\uD83D\uDD14 In-App",
};

export default function NotificationsPage() {
    const { logs, clearLogs, markAsRead, markAllAsRead } = useNotificationsStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const router = useRouter();

    const { hasPermission } = useRolesStore();
    const rh = useRoleHref();
    const isAdmin = hasPermission(currentUser.role, "notifications:manage");
    const [adminTab, setAdminTab] = useState<"my" | "log">("my");
    const [isClearLogsConfirmOpen, setIsClearLogsConfirmOpen] = useState(false);

    // Handle notification click - mark as read and navigate
    const handleNotificationClick = (notificationId: string, link?: string, isRead?: boolean) => {
        if (!isRead) {
            markAsRead(notificationId);
        }
        // Always navigate if there's a link; otherwise stay on notifications page
        if (link) {
            // Normalize link: strip any existing role prefix before applying current role
            const normalizedLink = link.replace(/^\/(admin|hr|finance|employee|supervisor|payroll_admin|auditor)/, "");
            router.push(rh(normalizedLink));
        }
    };

    // Get current employee ID for filtering
    const currentEmployeeId = useMemo(() => {
        const emp = employees.find(
            (e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name
        );
        return emp?.id;
    }, [employees, currentUser]);

    // My notifications — always filtered by current user's employee ID
    const myLogs = useMemo(() => {
        if (!currentEmployeeId) return [];
        return logs.filter((l) => l.employeeId === currentEmployeeId);
    }, [logs, currentEmployeeId]);

    // For the active view: "my" tab shows own notifications, "log" tab shows all
    const displayLogs = useMemo(() => {
        if (isAdmin && adminTab === "log") return logs;
        return myLogs;
    }, [logs, myLogs, isAdmin, adminTab]);

    // Unread count always based on current user's own notifications
    const unreadCount = useMemo(() => {
        return myLogs.filter((l) => !l.read).length;
    }, [myLogs]);

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
                                        <div className={`p-2 rounded-full ${getNotificationIconClass(log.type)}`}>
                                            <Bell className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="secondary" className={`text-[10px] font-medium border ${getNotificationBadgeClass(log.type)}`}>
                                                    {getNotificationLabel(log.type)}
                                                </Badge>
                                                {!log.read && (
                                                    <span className="h-2 w-2 rounded-full bg-primary" />
                                                )}
                                            </div>
                                            <h3 className="font-medium text-sm">{log.subject}</h3>
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-all">{log.body}</p>
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
                    <h1 className="text-2xl font-bold tracking-tight">
                        {adminTab === "log" ? "Notification Log" : "My Notifications"}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {displayLogs.length} notification{displayLogs.length !== 1 ? "s" : ""}
                        {adminTab === "log" ? " dispatched" : ""}
                        {unreadCount > 0 && <span className="ml-1 font-semibold text-primary">· {unreadCount} unread</span>}
                    </p>
                </div>
                <div className="flex items-center gap-2">
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
                    <Link href={rh("/settings/notifications")}>
                        <Button variant="outline" size="sm" className="gap-1.5">
                            <Settings className="h-4 w-4" /> Rules
                        </Button>
                    </Link>
                    {adminTab === "log" && logs.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                            onClick={() => setIsClearLogsConfirmOpen(true)}
                        >
                            <Trash2 className="h-4 w-4" /> Clear All
                        </Button>
                    )}
                </div>
            </div>

            {/* Admin tab switcher */}
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
                <Button
                    variant={adminTab === "my" ? "default" : "ghost"}
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setAdminTab("my")}
                >
                    <Bell className="h-3.5 w-3.5" /> My Notifications
                    {unreadCount > 0 && (
                        <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px]">{unreadCount}</Badge>
                    )}
                </Button>
                <Button
                    variant={adminTab === "log" ? "default" : "ghost"}
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => setAdminTab("log")}
                >
                    <Mail className="h-3.5 w-3.5" /> System Log
                </Button>
            </div>

            {/* My Notifications — card-based */}
            {adminTab === "my" ? (
                displayLogs.length === 0 ? (
                    <Card className="border border-border/50">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Bell className="h-12 w-12 mb-3 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">No notifications yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                You&apos;ll see updates about payslips, tasks, leave requests, and more here
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
                                        <div className={`p-2 rounded-full ${getNotificationIconClass(log.type)}`}>
                                            <Bell className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="secondary" className={`text-[10px] font-medium border ${getNotificationBadgeClass(log.type)}`}>
                                                    {getNotificationLabel(log.type)}
                                                </Badge>
                                                {!log.read && (
                                                    <span className="h-2 w-2 rounded-full bg-primary" />
                                                )}
                                            </div>
                                            <h3 className="font-medium text-sm">{log.subject}</h3>
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2 break-all">{log.body}</p>
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
                )
            ) : (
                /* System Log — table-based */
                <>
                    {/* Summary Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] gap-1">
                            <Mail className="h-3 w-3" /> {displayLogs.filter((l) => l.channel === "email" || l.channel === "both").length} email
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] gap-1">
                            <MessageSquare className="h-3 w-3" /> {displayLogs.filter((l) => l.channel === "sms" || l.channel === "both").length} SMS
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] gap-1">
                            <Bell className="h-3 w-3" /> {displayLogs.filter((l) => l.channel === "in_app" || !l.channel).length} in-app
                        </Badge>
                    </div>

                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs w-4"></TableHead>
                                        <TableHead className="text-xs">Employee</TableHead>
                                        <TableHead className="text-xs">Type</TableHead>
                                        <TableHead className="text-xs">Channel</TableHead>
                                        <TableHead className="text-xs">Subject</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                        <TableHead className="text-xs">Sent At</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {displayLogs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-12">
                                                <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                                                <p className="text-sm text-muted-foreground">No notifications dispatched yet</p>
                                                <p className="text-xs text-muted-foreground/60 mt-1">
                                                    Notifications are triggered by payroll actions, attendance, leave, and geofence events
                                                </p>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        displayLogs.map((log) => (
                                            <TableRow
                                                key={log.id}
                                                className={`cursor-pointer transition-colors hover:bg-muted/50 ${!log.read ? "bg-primary/5" : ""}`}
                                                onClick={() => handleNotificationClick(log.id, log.link, log.read)}
                                            >
                                                <TableCell className="pr-0">
                                                    {!log.read && (
                                                        <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                                                    )}
                                                </TableCell>
                                                <TableCell className={`text-sm ${!log.read ? "font-semibold" : "font-medium"}`}>{getEmpName(log.employeeId)}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={`text-[10px] font-medium border ${getNotificationBadgeClass(log.type)}`}>
                                                        {getNotificationLabel(log.type)}
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
                </>
            )}

            {/* Clear Logs Delete Confirmation */}
            <AlertDialog open={isClearLogsConfirmOpen} onOpenChange={setIsClearLogsConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clear All Notification Logs?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to clear all notification logs? This action will permanently delete all records in the system log. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setIsClearLogsConfirmOpen(false)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => {
                                clearLogs();
                                setIsClearLogsConfirmOpen(false);
                            }}
                        >
                            Clear All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
