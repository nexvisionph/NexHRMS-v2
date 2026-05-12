"use client";

import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";
import { lazy } from "react";

const AdminView = lazy(() => import("./_views/admin-view"));
const HrView = () => <AdminView />;
const ReadonlyView = lazy(() => import("./_views/readonly-view"));

export default function Documents201Page() {
    return (
        <RoleViewDispatcher
            views={{
                admin: AdminView,
                hr: HrView,
                auditor: ReadonlyView,
            }}
        />
    );
}
