"use client";

import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";
import { lazy } from "react";

const AdminView = lazy(() => import("./_views/admin-view"));
const HrView = () => <AdminView />;

export default function DisciplinaryPage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: AdminView,
                hr: HrView,
            }}
        />
    );
}
