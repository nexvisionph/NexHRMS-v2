"use client";
/**
 * Roles Actions Service — DB-first mutations.
 *
 * Writes to Supabase via the /api/roles route, then updates local Zustand cache on success.
 * Migration target: Store 8 of ZUSTAND_MIGRATION_CHECKLIST.md
 *
 * Note: The roles store already had partial DB sync (fire-and-forget).
 * This service makes it truly DB-first: we only update local state after DB confirms success.
 */

import { useRolesStore } from "@/store/roles.store";
import type { CustomRole, Permission, WidgetConfig } from "@/types";
import { nanoid } from "nanoid";

/**
 * Create a custom role — DB-first via /api/roles POST.
 */
export async function createRole(
    data: Omit<CustomRole, "id" | "createdAt" | "isSystem">
): Promise<{ ok: boolean; id?: string }> {
    const id = `role-${nanoid(8)}`;
    const payload = {
        id,
        name: data.name,
        slug: data.slug,
        color: data.color || "#6366f1",
        icon: data.icon || "Users",
        permissions: data.permissions || [],
        dashboardLayout: data.dashboardLayout,
    };

    try {
        const res = await fetch("/api/roles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("[roles-actions] createRole failed:", err.error || res.status);
            return { ok: false };
        }

        const dbRole: CustomRole = await res.json();

        // Update local cache
        useRolesStore.setState((s) => ({
            roles: [...s.roles, dbRole],
        }));
        return { ok: true, id: dbRole.id };
    } catch (e) {
        console.error("[roles-actions] createRole network error:", e);
        return { ok: false };
    }
}

/**
 * Update a role — DB-first via /api/roles PUT.
 */
export async function updateRole(
    id: string,
    patch: Partial<Omit<CustomRole, "id" | "isSystem">>
): Promise<boolean> {
    const payload = { id, ...patch };

    try {
        const res = await fetch("/api/roles", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("[roles-actions] updateRole failed:", err.error || res.status);
            return false;
        }

        const dbRole: CustomRole = await res.json();

        // Update local cache
        useRolesStore.setState((s) => ({
            roles: s.roles.map((r) => (r.id === id ? dbRole : r)),
        }));
        return true;
    } catch (e) {
        console.error("[roles-actions] updateRole network error:", e);
        return false;
    }
}

/**
 * Delete a custom role — DB-first via /api/roles DELETE.
 */
export async function deleteRole(id: string): Promise<boolean> {
    const store = useRolesStore.getState();
    const role = store.roles.find((r) => r.id === id);
    if (!role || role.isSystem) return false;

    try {
        const res = await fetch(`/api/roles?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            console.error("[roles-actions] deleteRole failed:", err.error || res.status);
            return false;
        }

        // Update local cache
        useRolesStore.setState((s) => ({
            roles: s.roles.filter((r) => r.id !== id),
        }));
        return true;
    } catch (e) {
        console.error("[roles-actions] deleteRole network error:", e);
        return false;
    }
}

/**
 * Duplicate a role — DB-first.
 */
export async function duplicateRole(id: string): Promise<{ ok: boolean; id?: string }> {
    const store = useRolesStore.getState();
    const source = store.roles.find((r) => r.id === id);
    if (!source) return { ok: false };

    return createRole({
        name: `${source.name} (Copy)`,
        slug: `${source.slug}_copy_${nanoid(4)}`,
        color: source.color,
        icon: source.icon,
        permissions: [...source.permissions],
        dashboardLayout: source.dashboardLayout
            ? { ...source.dashboardLayout }
            : undefined,
    });
}

/**
 * Set permissions for a role — DB-first.
 */
export async function setPermissions(roleId: string, perms: Permission[]): Promise<boolean> {
    return updateRole(roleId, { permissions: perms });
}

/**
 * Add a single permission to a role — DB-first.
 */
export async function addPermission(roleId: string, perm: Permission): Promise<boolean> {
    const store = useRolesStore.getState();
    const role = store.roles.find((r) => r.id === roleId);
    if (!role || role.permissions.includes(perm)) return true;

    return updateRole(roleId, { permissions: [...role.permissions, perm] });
}

/**
 * Remove a single permission from a role — DB-first.
 */
export async function removePermission(roleId: string, perm: Permission): Promise<boolean> {
    const store = useRolesStore.getState();
    const role = store.roles.find((r) => r.id === roleId);
    if (!role) return false;

    return updateRole(roleId, {
        permissions: role.permissions.filter((p) => p !== perm),
    });
}

/**
 * Save dashboard layout for a role — DB-first.
 */
export async function saveDashboardLayout(
    roleId: string,
    widgets: WidgetConfig[]
): Promise<boolean> {
    return updateRole(roleId, {
        dashboardLayout: { roleId, widgets },
    });
}
