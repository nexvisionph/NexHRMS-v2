"use client";

import { RoleViewDispatcher } from "@/components/ui/role-dispatcher";
import AdminSettingsView from "./_views/admin-view";
import HrSettingsView from "./_views/hr-view";
import EmployeeSettingsView from "./_views/employee-view";

const views = {
    admin: AdminSettingsView,
    hr: HrSettingsView,
    finance: HrSettingsView,
    employee: EmployeeSettingsView,
    supervisor: EmployeeSettingsView,
    payroll_admin: HrSettingsView,
    auditor: EmployeeSettingsView,
};

export default function SettingsPage() {
    return <RoleViewDispatcher views={views} />;
}
