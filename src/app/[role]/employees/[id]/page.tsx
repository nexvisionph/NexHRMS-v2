"use client";

import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";
import { lazy } from "react";

const AdminView = lazy(() => import("./_views/admin-view"));
const ViewerView = lazy(() => import("./_views/viewer-view"));

export default function EmployeeDetailPage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: AdminView,
                hr: AdminView,
                finance: ViewerView,
                supervisor: ViewerView,
                auditor: ViewerView,
                employee: ViewerView,
                payroll_admin: ViewerView,
            }}
        />
    );
}