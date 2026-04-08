"use client";

import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { WidgetGrid } from "@/components/dashboard-builder/widget-grid";

export default function DashboardPage() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const role = currentUser.role;
    const getDashboardLayout = useRolesStore((s) => s.getDashboardLayout);
    const widgets = getDashboardLayout(role);

    const roleDescriptions: Record<string, string> = {
        admin: "Full system overview — employees, attendance, payroll, and financials.",
        hr: "HR overview — employee management, leave approvals, and attendance.",
        finance: "Finance summary — payroll runs, loan management, and deductions.",
        payroll_admin: "Payroll overview — payslips, deductions, adjustments, and runs.",
        supervisor: "Team overview — attendance, leave requests, and performance.",
        employee: "Your personal workspace — attendance, leave, and payslips.",
        auditor: "Audit overview — system activity and compliance monitoring.",
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">
                    Welcome back, {currentUser.name.split(" ")[0]}!
                </h1>
                <p className="text-muted-foreground mt-1">
                    {roleDescriptions[role] || "Here is what is happening today."}
                </p>
            </div>

            <WidgetGrid widgets={widgets} />
        </div>
    );
}

