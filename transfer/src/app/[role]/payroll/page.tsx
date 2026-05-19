"use client";

import { Suspense, lazy, useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";

const AdminPayrollView = lazy(() => import("./_views/admin-view"));

const ALLOWED: Record<string, "admin" | "finance" | "payroll_admin"> = {
    admin: "admin",
    finance: "finance",
    payroll_admin: "payroll_admin",
};

export default function PayrollPage() {
    const role = useAuthStore((s) => s.currentUser.role);
    const router = useRouter();
    const mode = ALLOWED[role];

    useEffect(() => {
        if (!mode) {
            router.replace(`/${role}/my-payslips`);
        }
    }, [mode, role, router]);

    if (!mode) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground">Redirecting…</p>
                </div>
            </div>
        );
    }

    return (
        <Suspense fallback={<div>Loading…</div>}>
            <AdminPayrollView mode={mode} />
        </Suspense>
    );
}
