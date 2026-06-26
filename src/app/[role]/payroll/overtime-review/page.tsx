"use client";

import { Suspense, lazy } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const OTReviewView = lazy(() => import("./_views/ot-review-view"));

const ALLOWED_ROLES = ["admin", "hr", "finance", "payroll_admin", "supervisor"];

export default function OvertimeReviewPage() {
    const role = useAuthStore((s) => s.currentUser.role);
    const router = useRouter();

    useEffect(() => {
        if (!ALLOWED_ROLES.includes(role)) {
            router.replace(`/${role}/dashboard`);
        }
    }, [role, router]);

    if (!ALLOWED_ROLES.includes(role)) {
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
        <Suspense fallback={
            <div className="flex items-center justify-center h-[60vh]">
                <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
        }>
            <OTReviewView />
        </Suspense>
    );
}
