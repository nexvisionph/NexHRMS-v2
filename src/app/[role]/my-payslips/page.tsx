"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { toast } from "sonner";
import EmployeePayrollView from "../payroll/_views/employee-view";

/** Roles that must use a separate employee account to view personal payslips */
const BLOCKED_ROLES = ["admin", "hr", "payroll_admin", "finance"];

export default function MyPayslipsPage() {
    const role = useAuthStore((s) => s.currentUser.role);
    const router = useRouter();

    useEffect(() => {
        if (BLOCKED_ROLES.includes(role)) {
            toast.error("Personal payslip data is only accessible through your linked employee account");
            router.replace(`/${role}/dashboard`);
        }
    }, [role, router]);

    if (BLOCKED_ROLES.includes(role)) {
        return null;
    }

    return <EmployeePayrollView />;
}
