"use client";

import { lazy } from "react";
import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";

/* Lazy-load views — only the active role's view is downloaded */
const AdminView = lazy(() => import("./_views/admin-view"));
const EmployeeView = lazy(() => import("./_views/employee-view"));

// Stable component references to avoid remounting on every render
const AdminAttendanceView = () => <AdminView mode="admin" />;
const HRAttendanceView = () => <AdminView mode="hr" />;
const SupervisorAttendanceView = () => <AdminView mode="supervisor" />;

export default function AttendancePage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: AdminAttendanceView,
                hr: HRAttendanceView,
                supervisor: SupervisorAttendanceView,
                employee: EmployeeView,
            }}
        />
    );
}