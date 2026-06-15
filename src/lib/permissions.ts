"use client";
import { useMemo } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { getQueryClient } from "@/lib/query-client";
import { ROLES_QUERY_KEY } from "@/hooks/use-roles";
import type { CustomRole, Permission } from "@/types";

/**
 * Returns true if the current user's role has the given permission.
 * Falls back to false if no user is logged in.
 */
export function usePermission(perm: Permission): boolean {
    const role = useAuthStore((s) => s.currentUser?.role);
    const hasPermission = useRolesStore((s) => s.hasPermission);
    return role ? hasPermission(role, perm) : false;
}

/**
 * Returns true if the current user's role has ALL given permissions.
 */
export function usePermissions(perms: Permission[]): boolean {
    const role = useAuthStore((s) => s.currentUser?.role);
    const hasPermission = useRolesStore((s) => s.hasPermission);
    return role ? perms.every((p) => hasPermission(role, p)) : false;
}

/**
 * Returns true if the current user's role has ANY of the given permissions.
 */
export function useAnyPermission(perms: Permission[]): boolean {
    const role = useAuthStore((s) => s.currentUser?.role);
    const hasPermission = useRolesStore((s) => s.hasPermission);
    return role ? perms.some((p) => hasPermission(role, p)) : false;
}

/**
 * Returns an object mapping each requested permission to a boolean.
 * Useful when a page needs to check many permissions at once.
 */
export function usePermissionMap<T extends Permission>(perms: T[]): Record<T, boolean> {
    const role = useAuthStore((s) => s.currentUser?.role);
    const hasPermission = useRolesStore((s) => s.hasPermission);
    return useMemo(() => {
        const map = {} as Record<T, boolean>;
        for (const p of perms) {
            map[p] = role ? hasPermission(role, p) : false;
        }
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role, hasPermission, ...perms]);
}

/**
 * Returns the current user's role slug (string).
 */
export function useCurrentRole(): string | undefined {
    return useAuthStore((s) => s.currentUser?.role);
}

// ─── Non-hook utilities (imperative, for service files) ──────

function getRolesFromCache(): CustomRole[] {
    return getQueryClient().getQueryData<CustomRole[]>(ROLES_QUERY_KEY) ?? [];
}

function hasPermissionImperative(roleSlug: string, perm: Permission): boolean {
    const roles = getRolesFromCache();
    const role = roles.find((r) => r.slug === roleSlug);
    if (!role) return false;
    if (role.slug === "admin") return true;
    return role.permissions.includes(perm);
}

/**
 * Non-hook utility for server-side or imperative permission checks.
 * Uses the query cache directly (must be called after data is loaded).
 */
export function checkPermission(roleSlug: string, perm: Permission): boolean {
    return hasPermissionImperative(roleSlug, perm);
}

/**
 * Non-hook utility — check all permissions.
 */
export function checkPermissions(roleSlug: string, perms: Permission[]): boolean {
    return perms.every((p) => hasPermissionImperative(roleSlug, p));
}

/**
 * Non-hook utility — check any permission.
 */
export function checkAnyPermission(roleSlug: string, perms: Permission[]): boolean {
    return perms.some((p) => hasPermissionImperative(roleSlug, p));
}
