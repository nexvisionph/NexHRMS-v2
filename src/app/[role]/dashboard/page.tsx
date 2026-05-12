"use client";

import dynamic from "next/dynamic";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { Skeleton } from "@/components/ui/skeleton";

/* Lazy-load the heavy widget grid (imports 8 stores + recharts + 1000 lines) */
const WidgetGrid = dynamic(
    () => import("@/components/dashboard-builder/widget-grid").then((m) => ({ default: m.WidgetGrid })),
    { ssr: false, loading: () => <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div> }
);

/* Dedicated employee dashboard — purpose-built layout */
const EmployeeDashboard = dynamic(
    () => import("@/components/dashboard/employee-dashboard").then((m) => ({ default: m.EmployeeDashboard })),
    { ssr: false, loading: () => <div className="space-y-4"><Skeleton className="h-10 w-64" /><div className="grid gap-4 grid-cols-1 lg:grid-cols-4"><Skeleton className="h-40 lg:col-span-2" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div><Skeleton className="h-48" /></div> }
);

/* Dedicated admin/HR dashboard — professional HRMS layout */
const AdminDashboard = dynamic(
    () => import("@/components/dashboard/admin-dashboard").then((m) => ({ default: m.AdminDashboard })),
    { ssr: false, loading: () => <div className="space-y-6"><Skeleton className="h-10 w-80" /><div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div><div className="grid gap-4 grid-cols-1 lg:grid-cols-3"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div></div> }
);

export default function DashboardPage() {
    // ALL hooks must be called unconditionally — no early returns before hooks
    const currentUser = useAuthStore((s) => s.currentUser);
    const getDashboardLayout = useRolesStore((s) => s.getDashboardLayout);
    const role = currentUser.role;

    /* Employee gets a dedicated, polished dashboard */
    if (role === "employee") {
        return <EmployeeDashboard />;
    }

    /* Admin and HR get the professional HRMS dashboard */
    if (role === "admin" || role === "hr") {
        return <AdminDashboard />;
    }

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

