"use client";

/**
 * Enrollment Reminder Component
 * 
 * Displays a reminder for employees who haven't enrolled their face for recognition.
 * Checks enrollment status via API and shows enrollment link if missing.
 */

import { useState, useEffect } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanFace, ArrowRight, CheckCircle, AlertTriangle, Users, Loader2 } from "lucide-react";
import Link from "next/link";

interface EnrollmentReminderProps {
    /** Show admin view with unenrolled count only */
    adminView?: boolean;
    /** Compact mode for dashboard widgets */
    compact?: boolean;
    /** Pass employee ID directly to avoid relying on store lookup */
    employeeId?: string;
}

export function EnrollmentReminder({ adminView = false, compact = false, employeeId: employeeIdProp }: EnrollmentReminderProps) {
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);

    // Use passed employeeId directly, or fall back to store lookup
    const myEmployee = employeeIdProp
        ? employees.find((e) => e.id === employeeIdProp)
        : employees.find(
            (e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name
        );
    const resolvedEmployeeId = employeeIdProp ?? myEmployee?.id;

    // Build the enrollment link based on user role (avoids kiosk PIN gate)
    const enrollPath = `/${currentUser.role}/face-enrollment`;

    const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(!!resolvedEmployeeId);

    useEffect(() => {
        if (!resolvedEmployeeId) return;

        fetch(`/api/face-recognition/enroll?action=status&employeeId=${encodeURIComponent(resolvedEmployeeId)}`)
            .then((r) => r.json())
            .then((data) => setIsEnrolled(data.enrolled ?? false))
            .catch(() => setIsEnrolled(false))
            .finally(() => setLoading(false));
    }, [resolvedEmployeeId]);

    if (loading) {
        return compact ? null : (
            <Card className="border border-border/40">
                <CardContent className="p-4 flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking face enrollment status...
                </CardContent>
            </Card>
        );
    }

    // Admin view: show aggregate unenrolled count (no per-employee API calls needed)
    if (adminView) {
        const activeCount = employees.filter((e) => e.status === "active").length;

        return (
            <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-amber-500/10 shrink-0">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                            <p className="font-medium text-sm text-amber-700 dark:text-amber-400">
                                Face Enrollment Status
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {activeCount} active employee{activeCount !== 1 ? "s" : ""} — check the kiosk enrollment page
                            </p>
                        </div>
                    </div>
                    <Badge variant="outline" className="text-amber-600 border-amber-500/30 shrink-0">
                        <Users className="h-3 w-3 mr-1" />
                        {activeCount}
                    </Badge>
                </CardContent>
            </Card>
        );
    }

    // Employee self-view: enrolled
    if (isEnrolled) {
        if (compact) return null;
        return (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 rounded-full bg-emerald-500/10">
                        <CheckCircle className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="font-medium text-sm">Face Recognition Enrolled</p>
                        <p className="text-xs text-muted-foreground">You can use face recognition for check-in</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Employee self-view: not enrolled
    return (
        <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-amber-500/10 shrink-0">
                        <ScanFace className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 space-y-2">
                        <p className="font-semibold text-sm text-amber-700 dark:text-amber-400">
                            Face Recognition Not Set Up
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Enroll your face to enable faster check-in at the kiosk. This only takes a minute.
                        </p>
                        <Button asChild size="sm" variant="outline" className="gap-2">
                            <Link href={enrollPath}>
                                <ScanFace className="h-4 w-4" />
                                Enroll Now
                                <ArrowRight className="h-3 w-3" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default EnrollmentReminder;
