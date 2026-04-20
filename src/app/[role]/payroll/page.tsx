"use client";

import { lazy } from "react";
import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";

const AdminPayrollView = lazy(() => import("./_views/admin-view"));
const EmployeePayrollView = lazy(() => import("./_views/employee-view"));

export default function PayrollPage() {
    return (
        <RoleViewDispatcher
            views={{
                admin: () => <AdminPayrollView mode="admin" />,
                finance: () => <AdminPayrollView mode="finance" />,
                payroll_admin: () => <AdminPayrollView mode="payroll_admin" />,
                employee: () => <EmployeePayrollView />,
            }}
        />
    );
}
