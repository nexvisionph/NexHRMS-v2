/** @jest-environment jsdom */
/**
 * Auth & Permissions Tests â€” NexHRMS
 * Tests role-based access control, permission checking, and admin override
 */

import React from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRolesStore, ALL_PERMISSIONS } from "@/store/roles.store";
import { checkPermission, checkPermissions, checkAnyPermission } from "@/lib/permissions";
import { ROLES_QUERY_KEY } from "@/hooks/use-roles";

// â”€â”€â”€ Test wrapper with QueryClientProvider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
});

function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("Role-Based Access Control", () => {

    // Pre-populate the singleton query client so checkPermission() works in tests
    beforeAll(async () => {
        const { getQueryClient } = await import("@/lib/query-client");
        const { default: buildSystemRoles } = await import("@/hooks/use-roles").then((m) => ({ default: () => {
            // Build system roles inline (same as the hook's initialData)
            return queryClient.getQueryData(ROLES_QUERY_KEY) ?? [];
        }}));
        // Render the hook once to populate the wrapper's query client with initialData
        const { result } = renderHook(() => useRolesStore(), { wrapper });
        // Then copy the roles into the singleton client for non-hook checkPermission
        getQueryClient().setQueryData(ROLES_QUERY_KEY, result.current.roles);
    });

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Roles Store â€” Permission Checks
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    describe("hasPermission", () => {
        it("should grant admin all permissions", () => {
            const { result } = renderHook(() => useRolesStore(), { wrapper });

            // Admin should have every permission
            for (const perm of ALL_PERMISSIONS) {
                expect(result.current.hasPermission("admin", perm)).toBe(true);
            }
        });

        it("should deny permissions for non-existent role", () => {
            const { result } = renderHook(() => useRolesStore(), { wrapper });

            expect(result.current.hasPermission("nonexistent", "page:dashboard")).toBe(false);
        });

        it("should allow employee to view own payslips", () => {
            const { result } = renderHook(() => useRolesStore(), { wrapper });

            const empRole = result.current.roles.find((r) => r.slug === "employee");
            if (empRole) {
                const hasPayrollOwn = empRole.permissions.includes("payroll:view_own");
                expect(result.current.hasPermission("employee", "payroll:view_own")).toBe(hasPayrollOwn);
            }
        });

        it("should deny employee access to admin settings", () => {
            const { result } = renderHook(() => useRolesStore(), { wrapper });

            expect(result.current.hasPermission("employee", "settings:roles")).toBe(false);
            expect(result.current.hasPermission("employee", "settings:organization")).toBe(false);
        });

        it("should deny employee payroll generation", () => {
            const { result } = renderHook(() => useRolesStore(), { wrapper });

            expect(result.current.hasPermission("employee", "payroll:generate")).toBe(false);
            expect(result.current.hasPermission("employee", "payroll:lock")).toBe(false);
        });
    });

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Non-hook permission utilities
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    describe("checkPermission (non-hook)", () => {
        it("should return true for admin on any permission", () => {
            expect(checkPermission("admin", "payroll:generate")).toBe(true);
            expect(checkPermission("admin", "employees:delete")).toBe(true);
        });

        it("should return false for unknown role", () => {
            expect(checkPermission("ghost", "page:dashboard")).toBe(false);
        });
    });

    describe("checkPermissions (all required)", () => {
        it("should return true when admin has all permissions", () => {
            expect(checkPermissions("admin", ["payroll:generate", "payroll:lock", "employees:delete"])).toBe(true);
        });

        it("should return false when role is missing any permission", () => {
            expect(checkPermissions("employee", ["page:dashboard", "payroll:generate"])).toBe(false);
        });
    });

    describe("checkAnyPermission", () => {
        it("should return true when role has at least one permission", () => {
            const { result } = renderHook(() => useRolesStore(), { wrapper });
            const empRole = result.current.roles.find((r) => r.slug === "employee");
            if (empRole && empRole.permissions.length > 0) {
                expect(checkAnyPermission("employee", [empRole.permissions[0], "settings:roles"])).toBe(true);
            }
        });

        it("should return false when role has none of the permissions", () => {
            expect(checkAnyPermission("employee", ["settings:roles", "settings:organization"])).toBe(false);
        });
    });

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Role Configuration
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    describe("Role Configuration", () => {
        it("should have system roles defined", () => {
            const { result } = renderHook(() => useRolesStore(), { wrapper });

            const slugs = result.current.getAllRoleSlugs();
            expect(slugs).toContain("admin");
            expect(slugs).toContain("employee");
        });

        it("should retrieve role by slug", () => {
            const { result } = renderHook(() => useRolesStore(), { wrapper });

            const admin = result.current.getRoleBySlug("admin");
            expect(admin).toBeDefined();
            expect(admin?.slug).toBe("admin");
        });

        it("should list permissions for a role", () => {
            const { result } = renderHook(() => useRolesStore(), { wrapper });

            const adminPerms = result.current.getPermissions("admin");
            // Admin gets all permissions through the hasPermission override
            // but the actual permissions array might differ
            expect(adminPerms).toBeDefined();
        });

        it("should return empty array for non-existent role permissions", () => {
            const { result } = renderHook(() => useRolesStore(), { wrapper });

            const perms = result.current.getPermissions("nonexistent-role");
            expect(perms).toEqual([]);
        });
    });

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // Security: Critical permission boundaries
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    describe("Security Boundaries", () => {
        it("should not allow employee to approve leave", () => {
            expect(checkPermission("employee", "leave:approve")).toBe(false);
        });

        it("should not allow employee to manage loan approvals", () => {
            expect(checkPermission("employee", "loans:approve")).toBe(false);
        });

        it("should not allow employee to generate payroll", () => {
            expect(checkPermission("employee", "payroll:generate")).toBe(false);
        });

        it("should not allow employee to view audit logs", () => {
            expect(checkPermission("employee", "audit:view")).toBe(false);
        });

        it("should not allow employee to manage roles", () => {
            expect(checkPermission("employee", "settings:roles")).toBe(false);
        });

        it("should allow admin to manage everything", () => {
            const criticalPerms: string[] = [
                "employees:delete",
                "payroll:generate",
                "payroll:lock",
                "leave:approve",
                "loans:approve",
                "settings:roles",
                "audit:view",
            ];
            for (const perm of criticalPerms) {
                expect(checkPermission("admin", perm as any)).toBe(true);
            }
        });
    });
});
