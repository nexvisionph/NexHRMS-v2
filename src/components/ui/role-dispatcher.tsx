"use client";

import { Suspense, memo } from "react";
import { useAuthStore } from "@/store/auth.store";
import { AccessDenied } from "./access-denied";
import type { ComponentType } from "react";

function LoadingFallback() {
    return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
        </div>
    );
}

interface RoleViewDispatcherProps {
    /** Map of role slug → view component. Roles not listed will see the fallback. */
    views: Partial<Record<string, ComponentType>>;
    /** Component shown when no view matches the role. Defaults to AccessDenied. */
    fallback?: ComponentType;
}

/**
 * Reads the current user's role and renders the matching view component.
 * Wraps the view in Suspense to support React.lazy() loaded views.
 * Usage:
 * ```tsx
 * <RoleViewDispatcher views={{
 *   admin: AdminView,
 *   hr: HRView,
 *   employee: EmployeeView,
 * }} />
 * ```
 */
function RoleViewDispatcherComponent({ views, fallback: Fallback = AccessDenied }: RoleViewDispatcherProps) {
    const role = useAuthStore((s) => s.currentUser.role);
    const View = views[role];
    if (!View) return <Fallback />;
    return (
        <Suspense fallback={<LoadingFallback />}>
            <View />
        </Suspense>
    );
}

// Memoize to prevent re-renders when parent changes but role stays the same
export const RoleViewDispatcher = memo(RoleViewDispatcherComponent);
