"use client";

import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";
import { lazy } from "react";

const AdminReportsView = lazy(() => import("./_views/admin-view"));
const BasicReportsView = lazy(() => import("./_views/basic-view"));

export default function ReportsPage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: AdminReportsView,
                finance: AdminReportsView,
                payroll_admin: AdminReportsView,
                hr: AdminReportsView,
                auditor: AdminReportsView,
            }}
        />
    );
}
