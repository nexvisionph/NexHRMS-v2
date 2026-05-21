"use client";

import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";
import { lazy } from "react";

const AdminProjectsView = lazy(() => import("./_views/admin-view"));
const ReadonlyProjectsView = lazy(() => import("./_views/readonly-view"));

export default function ProjectsPage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: AdminProjectsView,
                hr: AdminProjectsView,
                supervisor: ReadonlyProjectsView,
                employee: ReadonlyProjectsView,
                finance: ReadonlyProjectsView,
                payroll_admin: ReadonlyProjectsView,
                auditor: ReadonlyProjectsView,
            }}
        />
    );
}
