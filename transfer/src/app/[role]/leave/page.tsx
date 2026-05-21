"use client";

import { lazy } from "react";
import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";

const AdminLeaveView = lazy(() => import("./_views/admin-view"));
const EmployeeLeaveView = lazy(() => import("./_views/employee-view"));

// Stable component references to avoid remounting on every render
const AdminLeave = () => <AdminLeaveView />;
const HRLeave = () => <AdminLeaveView />;
const SupervisorLeave = () => <AdminLeaveView />;

export default function LeavePage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: AdminLeave,
                hr: HRLeave,
                supervisor: SupervisorLeave,
                employee: EmployeeLeaveView,
            }}
        />
    );
}
