"use client";

import { lazy, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { toast } from "sonner";
import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";

/* Lazy-load views — only the active role's view is downloaded */
const AdminView = lazy(() => import("./_views/admin-view"));
const EmployeeView = lazy(() => import("./_views/employee-view"));

// Stable component references to avoid remounting on every render
const AdminAttendanceView = () => <AdminView mode="admin" />;
const HRAttendanceView = () => <AdminView mode="hr" />;
const SupervisorAttendanceView = () => <AdminView mode="supervisor" />;

/** Roles that must use a separate employee account to view personal attendance */
const BLOCKED_ROLES = ["admin", "hr", "payroll_admin", "finance"];

/**
 * Guard that redirects admin-accessed roles away from personal attendance.
 * They can still access the admin/management attendance view via their role's dispatcher entry.
 */
function PersonalAttendanceGuard() {
    const role = useAuthStore((s) => s.currentUser.role);
    const router = useRouter();

    useEffect(() => {
        if (BLOCKED_ROLES.includes(role)) {
            toast.error("Personal attendance data is only accessible through your linked employee account");
            router.replace(`/${role}/dashboard`);
        }
    }, [role, router]);

    if (BLOCKED_ROLES.includes(role)) {
        return null;
    }

    return <EmployeeView />;
}

export default function AttendancePage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: AdminAttendanceView,
                hr: HRAttendanceView,
                supervisor: SupervisorAttendanceView,
                employee: PersonalAttendanceGuard,
            }}
        />
    );
}
