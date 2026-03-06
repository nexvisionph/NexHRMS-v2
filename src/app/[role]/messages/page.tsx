"use client";

import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";
import { lazy } from "react";

const AdminMessagesView = lazy(() => import("./_views/admin-view"));
const EmployeeMessagesView = lazy(() => import("./_views/employee-view"));

export default function MessagesPage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: AdminMessagesView,
                hr: AdminMessagesView,
                supervisor: AdminMessagesView,
                employee: EmployeeMessagesView,
            }}
        />
    );
}
