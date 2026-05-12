"use client";

import { Suspense, lazy } from "react";
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

    if (!mode) {
        router.replace(`/${role}/my-payslips`);
        return null;
    }

    return (
        <Suspense fallback={<div>Loading…</div>}>
            <AdminPayrollView mode={mode} />
        </Suspense>
    );
}
