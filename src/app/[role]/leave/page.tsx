"use client";

import { lazy } from "react";
import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";

const AdminLeaveView = lazy(() => import("./_views/admin-view"));
const EmployeeLeaveView = lazy(() => import("./_views/employee-view"));

export default function LeavePage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: () => <AdminLeaveView />,
                hr: () => <AdminLeaveView />,
                supervisor: () => <AdminLeaveView />,
                employee: () => <EmployeeLeaveView />,
            }}
        />
    );
}
