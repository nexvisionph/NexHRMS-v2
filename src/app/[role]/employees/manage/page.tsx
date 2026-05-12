"use client";

import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";
import { lazy } from "react";

const AdminView = lazy(() => import("./_views/admin-view"));
const ReadonlyView = lazy(() => import("./_views/readonly-view"));
const FinanceView = lazy(() => import("./_views/finance-view"));

const HrView = () => <AdminView />;

export default function EmployeesManagePage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: AdminView,
                hr: HrView,
                finance: FinanceView,
                supervisor: ReadonlyView,
                auditor: ReadonlyView,
            }}
        />
    );
}
