"use client";

import { Suspense, lazy } from "react";
import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";

const AdminLeaveView = lazy(() => import("./_views/admin-view"));
const EmployeeLeaveView = lazy(() => import("./_views/employee-view"));

// Stable component references to avoid remounting on every render
const AdminLeave = () => <AdminLeaveView />;
const HRLeave = () => <AdminLeaveView />;
const SupervisorLeave = () => <AdminLeaveView />;
const EmployeeLeave = () => <EmployeeLeaveView />;

export default function LeavePage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>}>
            <RoleViewDispatcher
                views={{
                    admin: AdminLeave,
                    hr: HRLeave,
                    supervisor: SupervisorLeave,
                    employee: EmployeeLeave,
                }}
            />
        </Suspense>
    );
}
