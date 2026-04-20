"use client";

import { lazy } from "react";
import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";

/* Lazy-load views — only the active role's view is downloaded */
const AdminView = lazy(() => import("./_views/admin-view"));
const EmployeeView = lazy(() => import("./_views/employee-view"));

export default function AttendancePage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: () => <AdminView mode="admin" />,
                hr: () => <AdminView mode="hr" />,
                supervisor: () => <AdminView mode="supervisor" />,
                employee: () => <EmployeeView />,
            }}
        />
    );
}