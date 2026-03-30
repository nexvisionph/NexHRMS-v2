/**
 * Feature Test: Navigation & RBAC
 *
 * Covers: roles.store.ts, sidebar NAV_ITEMS, permission system
 * - 7 system roles with correct permissions
 * - Custom role CRUD
 * - Permission checks (hasPermission, admin-always-true)
 * - Dashboard layouts per role
 * - Role duplication & export/import
 * - System role protection (cannot delete)
 * - Permission groups coverage
 */

import { useRolesStore, ALL_PERMISSIONS, PERMISSION_GROUPS } from "@/store/roles.store";

beforeEach(() => useRolesStore.getState().resetToDefaults());

describe("Navigation & RBAC", () => {
    // ── System Roles ────────────────────────────────────────
    describe("System roles", () => {
        it("has 7 system roles", () => {
            expect(useRolesStore.getState().roles.filter((r) => r.isSystem).length).toBe(7);
        });

        it("has admin, hr, finance, payroll_admin, supervisor, employee, auditor", () => {
            const slugs = useRolesStore.getState().roles.map((r) => r.slug);
            expect(slugs).toContain("admin");
            expect(slugs).toContain("hr");
            expect(slugs).toContain("finance");
            expect(slugs).toContain("payroll_admin");
            expect(slugs).toContain("supervisor");
            expect(slugs).toContain("employee");
            expect(slugs).toContain("auditor");
        });

        it("admin has all permissions", () => {
            const admin = useRolesStore.getState().getRoleBySlug("admin");
            expect(admin?.permissions.length).toBe(ALL_PERMISSIONS.length);
        });

        it("employee has limited permissions", () => {
            const emp = useRolesStore.getState().getRoleBySlug("employee");
            expect(emp?.permissions.length).toBeLessThan(ALL_PERMISSIONS.length);
            expect(emp?.permissions).toContain("page:dashboard");
            expect(emp?.permissions).toContain("page:leave");
            expect(emp?.permissions).not.toContain("employees:delete");
        });

        it("auditor has audit:view and reports:view", () => {
            const auditor = useRolesStore.getState().getRoleBySlug("auditor");
            expect(auditor?.permissions).toContain("audit:view");
            expect(auditor?.permissions).toContain("reports:view");
        });

        it("hr has employee management permissions", () => {
            const hr = useRolesStore.getState().getRoleBySlug("hr");
            expect(hr?.permissions).toContain("employees:view");
            expect(hr?.permissions).toContain("employees:create");
            expect(hr?.permissions).toContain("employees:edit");
        });

        it("finance has payroll and loan permissions", () => {
            const finance = useRolesStore.getState().getRoleBySlug("finance");
            expect(finance?.permissions).toContain("payroll:view_all");
            expect(finance?.permissions).toContain("payroll:generate");
            expect(finance?.permissions).toContain("loans:view_all");
        });

        it("supervisor has attendance and leave approval", () => {
            const sup = useRolesStore.getState().getRoleBySlug("supervisor");
            expect(sup?.permissions).toContain("attendance:view_all");
            expect(sup?.permissions).toContain("attendance:approve_overtime");
            expect(sup?.permissions).toContain("leave:view_all");
            expect(sup?.permissions).toContain("leave:approve");
        });
    });

    // ── hasPermission ───────────────────────────────────────
    describe("Permission checks", () => {
        it("admin always has permission (all permissions)", () => {
            expect(useRolesStore.getState().hasPermission("admin", "page:dashboard")).toBe(true);
            expect(useRolesStore.getState().hasPermission("admin", "payroll:lock")).toBe(true);
            expect(useRolesStore.getState().hasPermission("admin", "audit:view")).toBe(true);
        });

        it("employee does NOT have payroll:generate", () => {
            expect(useRolesStore.getState().hasPermission("employee", "payroll:generate")).toBe(false);
        });

        it("finance does NOT have employees:delete", () => {
            expect(useRolesStore.getState().hasPermission("finance", "employees:delete")).toBe(false);
        });

        it("returns false for unknown role", () => {
            expect(useRolesStore.getState().hasPermission("nonexistent", "page:dashboard")).toBe(false);
        });
    });

    // ── Custom Role CRUD ────────────────────────────────────
    describe("Custom role management", () => {
        it("creates a custom role", () => {
            const before = useRolesStore.getState().roles.length;
            const id = useRolesStore.getState().createRole({
                name: "Team Lead",
                slug: "team_lead",
                color: "#00ff00",
                icon: "Users",
                permissions: ["page:dashboard", "page:employees", "employees:view"],
                dashboardLayout: { roleId: "", widgets: [] },
            });
            expect(useRolesStore.getState().roles.length).toBe(before + 1);
            const created = useRolesStore.getState().getRoleById(id);
            expect(created?.isSystem).toBe(false);
        });

        it("updates a custom role", () => {
            const id = useRolesStore.getState().createRole({
                name: "Temp",
                slug: "temp",
                color: "#ccc",
                icon: "Circle",
                permissions: [],
                dashboardLayout: { roleId: "", widgets: [] },
            });
            useRolesStore.getState().updateRole(id, { name: "Updated Temp" });
            expect(useRolesStore.getState().getRoleById(id)?.name).toBe("Updated Temp");
        });

        it("deletes a custom role", () => {
            const id = useRolesStore.getState().createRole({
                name: "Deletable",
                slug: "deletable",
                color: "#ccc",
                icon: "X",
                permissions: [],
                dashboardLayout: { roleId: "", widgets: [] },
            });
            const result = useRolesStore.getState().deleteRole(id);
            expect(result).toBe(true);
            expect(useRolesStore.getState().getRoleById(id)).toBeUndefined();
        });

        it("refuses to delete a system role", () => {
            const admin = useRolesStore.getState().getRoleBySlug("admin");
            const result = useRolesStore.getState().deleteRole(admin!.id);
            expect(result).toBe(false);
        });
    });

    // ── Role Duplication ────────────────────────────────────
    describe("Role duplication", () => {
        it("duplicates a role", () => {
            const admin = useRolesStore.getState().getRoleBySlug("admin");
            const dupId = useRolesStore.getState().duplicateRole(admin!.id);
            expect(dupId).toBeTruthy();
            const dup = useRolesStore.getState().getRoleById(dupId!);
            expect(dup?.name).toContain("(Copy)");
            expect(dup?.isSystem).toBe(false);
            expect(dup?.permissions.length).toBe(admin!.permissions.length);
        });

        it("returns null for unknown role", () => {
            expect(useRolesStore.getState().duplicateRole("UNKNOWN")).toBeNull();
        });
    });

    // ── Permission Management ───────────────────────────────
    describe("Permission management", () => {
        it("sets permissions on a role", () => {
            const id = useRolesStore.getState().createRole({
                name: "Test",
                slug: "test",
                color: "#000",
                icon: "X",
                permissions: [],
                dashboardLayout: { roleId: "", widgets: [] },
            });
            useRolesStore.getState().setPermissions(id, ["page:dashboard", "page:payroll"]);
            expect(useRolesStore.getState().getRoleById(id)?.permissions).toEqual(["page:dashboard", "page:payroll"]);
        });

        it("adds a single permission", () => {
            const id = useRolesStore.getState().createRole({
                name: "Test2",
                slug: "test2",
                color: "#000",
                icon: "X",
                permissions: ["page:dashboard"],
                dashboardLayout: { roleId: "", widgets: [] },
            });
            useRolesStore.getState().addPermission(id, "page:payroll");
            expect(useRolesStore.getState().getRoleById(id)?.permissions).toContain("page:payroll");
        });

        it("removes a single permission", () => {
            const id = useRolesStore.getState().createRole({
                name: "Test3",
                slug: "test3",
                color: "#000",
                icon: "X",
                permissions: ["page:dashboard", "page:payroll"],
                dashboardLayout: { roleId: "", widgets: [] },
            });
            useRolesStore.getState().removePermission(id, "page:payroll");
            expect(useRolesStore.getState().getRoleById(id)?.permissions).not.toContain("page:payroll");
        });
    });

    // ── Dashboard Layouts ───────────────────────────────────
    describe("Dashboard layouts", () => {
        it("each system role has a dashboard layout", () => {
            const roles = useRolesStore.getState().roles.filter((r) => r.isSystem);
            for (const role of roles) {
                const layout = useRolesStore.getState().getDashboardLayout(role.slug);
                expect(layout.length).toBeGreaterThan(0);
            }
        });

        it("saves a custom dashboard layout", () => {
            const admin = useRolesStore.getState().getRoleBySlug("admin");
            useRolesStore.getState().saveDashboardLayout(admin!.id, [
                { id: "w1", type: "kpi_active_employees", colSpan: 1, order: 0 },
            ]);
            const layout = useRolesStore.getState().getDashboardLayout("admin");
            expect(layout.length).toBe(1);
        });
    });

    // ── Export/Import ───────────────────────────────────────
    describe("Export/Import", () => {
        it("exports config as JSON", () => {
            const json = useRolesStore.getState().exportConfig();
            expect(json).toContain("admin");
            expect(JSON.parse(json)).toBeTruthy();
        });

        it("imports config", () => {
            const id = useRolesStore.getState().createRole({
                name: "Importable",
                slug: "importable",
                color: "#000",
                icon: "X",
                permissions: ["page:dashboard"],
                dashboardLayout: { roleId: "", widgets: [] },
            });
            const json = useRolesStore.getState().exportConfig();
            useRolesStore.getState().deleteRole(id);
            const result = useRolesStore.getState().importConfig(json);
            expect(result.ok).toBe(true);
        });
    });

    // ── Helpers ─────────────────────────────────────────────
    describe("Helpers", () => {
        it("getAllRoleSlugs returns all slugs", () => {
            const slugs = useRolesStore.getState().getAllRoleSlugs();
            expect(slugs.length).toBeGreaterThanOrEqual(7);
        });

        it("getPermissions returns permissions for a slug", () => {
            const perms = useRolesStore.getState().getPermissions("admin");
            expect(perms.length).toBe(ALL_PERMISSIONS.length);
        });

        it("PERMISSION_GROUPS covers all permissions", () => {
            const allFromGroups = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));
            // Every permission in ALL_PERMISSIONS should appear in groups
            for (const perm of ALL_PERMISSIONS) {
                expect(allFromGroups).toContain(perm);
            }
        });
    });

    // ── Reset ───────────────────────────────────────────────
    describe("Reset", () => {
        it("resets to default system roles", () => {
            useRolesStore.getState().createRole({
                name: "Custom",
                slug: "custom",
                color: "#000",
                icon: "X",
                permissions: [],
                dashboardLayout: { roleId: "", widgets: [] },
            });
            useRolesStore.getState().resetToDefaults();
            expect(useRolesStore.getState().roles.length).toBe(7);
        });
    });
});
