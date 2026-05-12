"use client";

import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";
import { lazy } from "react";

const AdminTasksView = lazy(() => import("./_views/admin-view"));
const EmployeeTasksView = lazy(() => import("./_views/employee-view"));

export default function TasksPage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: AdminTasksView,
                hr: AdminTasksView,
                supervisor: AdminTasksView,
                employee: EmployeeTasksView,
            }}
        />
    );
}
