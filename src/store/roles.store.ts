"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { CustomRole, Permission, WidgetConfig } from "@/types";

// ─── All available permissions ──────────────────────────────
export const ALL_PERMISSIONS: Permission[] = [
    "page:dashboard", "page:employees", "page:attendance", "page:leave",
    "page:payroll", "page:loans", "page:projects", "page:reports",
    "page:kiosk", "page:notifications", "page:audit", "page:settings", "page:timesheets",
    "employees:view", "employees:create", "employees:edit", "employees:delete",
    "employees:view_salary", "employees:approve_salary",
    "attendance:view_all", "attendance:edit", "attendance:approve_overtime",
    "leave:view_all", "leave:approve", "leave:manage_policies",
    "payroll:view_all", "payroll:generate", "payroll:lock", "payroll:issue", "payroll:view_own",
    "loans:view_all", "loans:approve", "loans:view_own",
    "audit:view",
    "settings:roles", "settings:organization", "settings:shifts", "settings:page_builder",
    "projects:manage",
    "reports:view", "reports:government",
    "notifications:manage",
    "timesheets:view_all", "timesheets:approve",
    "page:tasks", "tasks:view", "tasks:create", "tasks:assign", "tasks:verify", "tasks:delete", "tasks:manage_groups",
    "page:messages", "messages:send_announcement", "messages:manage_channels", "messages:send_whatsapp", "messages:send_email",
];

// ─── Permission groups for the UI ────────────────────────────
export const PERMISSION_GROUPS: { label: string; permissions: { key: Permission; label: string }[] }[] = [
    {
        label: "Page Access",
        permissions: [
            { key: "page:dashboard", label: "Dashboard" },
            { key: "page:employees", label: "Employees" },
            { key: "page:attendance", label: "Attendance" },
            { key: "page:leave", label: "Leave" },
            { key: "page:payroll", label: "Payroll" },
            { key: "page:loans", label: "Loans" },
            { key: "page:projects", label: "Projects" },
            { key: "page:reports", label: "Reports" },
            { key: "page:timesheets", label: "Timesheets" },
            { key: "page:kiosk", label: "Kiosk" },
            { key: "page:notifications", label: "Notifications" },
            { key: "page:audit", label: "Audit Log" },
            { key: "page:settings", label: "Settings" },
        ],
    },
    {
        label: "Employee Management",
        permissions: [
            { key: "employees:view", label: "View employees" },
            { key: "employees:create", label: "Create employees" },
            { key: "employees:edit", label: "Edit employees" },
            { key: "employees:delete", label: "Delete / resign" },
            { key: "employees:view_salary", label: "View salaries" },
            { key: "employees:approve_salary", label: "Approve salary changes" },
        ],
    },
    {
        label: "Attendance",
        permissions: [
            { key: "attendance:view_all", label: "View all attendance" },
            { key: "attendance:edit", label: "Edit attendance records" },
            { key: "attendance:approve_overtime", label: "Approve overtime" },
        ],
    },
    {
        label: "Leave",
        permissions: [
            { key: "leave:view_all", label: "View all leave requests" },
            { key: "leave:approve", label: "Approve / reject leave" },
            { key: "leave:manage_policies", label: "Manage leave policies" },
        ],
    },
    {
        label: "Payroll",
        permissions: [
            { key: "payroll:view_all", label: "View all payslips" },
            { key: "payroll:view_own", label: "View own payslips" },
            { key: "payroll:generate", label: "Generate payslips" },
            { key: "payroll:lock", label: "Lock payroll runs" },
            { key: "payroll:issue", label: "Issue / confirm / publish" },
        ],
    },
    {
        label: "Loans",
        permissions: [
            { key: "loans:view_all", label: "View all loans" },
            { key: "loans:view_own", label: "View own loans" },
            { key: "loans:approve", label: "Approve / manage loans" },
        ],
    },
    {
        label: "Projects",
        permissions: [
            { key: "projects:manage", label: "Create / edit projects" },
        ],
    },
    {
        label: "Reports",
        permissions: [
            { key: "reports:view", label: "View reports" },
            { key: "reports:government", label: "Government reports" },
        ],
    },
    {
        label: "Timesheets",
        permissions: [
            { key: "timesheets:view_all", label: "View all timesheets" },
            { key: "timesheets:approve", label: "Approve timesheets" },
        ],
    },
    {
        label: "Notifications",
        permissions: [
            { key: "notifications:manage", label: "Manage notifications" },
        ],
    },
    {
        label: "Audit",
        permissions: [
            { key: "audit:view", label: "View audit log" },
        ],
    },
    {
        label: "Task Management",
        permissions: [
            { key: "page:tasks", label: "Tasks page" },
            { key: "tasks:view", label: "View tasks" },
            { key: "tasks:create", label: "Create tasks" },
            { key: "tasks:assign", label: "Assign tasks" },
            { key: "tasks:verify", label: "Verify completions" },
            { key: "tasks:delete", label: "Delete tasks" },
            { key: "tasks:manage_groups", label: "Manage task groups" },
        ],
    },
    {
        label: "Messaging",
        permissions: [
            { key: "page:messages", label: "Messages page" },
            { key: "messages:send_announcement", label: "Send announcements" },
            { key: "messages:manage_channels", label: "Manage channels" },
            { key: "messages:send_whatsapp", label: "Send via WhatsApp" },
            { key: "messages:send_email", label: "Send via Email" },
        ],
    },
    {
        label: "Settings",
        permissions: [
            { key: "settings:roles", label: "Manage roles" },
            { key: "settings:organization", label: "Organization settings" },
            { key: "settings:shifts", label: "Shift management" },
            { key: "settings:page_builder", label: "Page / dashboard builder" },
        ],
    },
];

// ─── Default permission sets for system roles ────────────────
const ADMIN_PERMS: Permission[] = [...ALL_PERMISSIONS];

const HR_PERMS: Permission[] = [
    "page:dashboard", "page:employees", "page:attendance", "page:leave",
    "page:reports", "page:notifications", "page:kiosk", "page:timesheets", "page:settings", "page:projects",
    "employees:view", "employees:create", "employees:edit", "employees:delete",
    "employees:view_salary",  // HR can view salaries and propose changes, but NOT directly approve
    "attendance:view_all", "attendance:edit", "attendance:approve_overtime",
    "leave:view_all", "leave:approve", "leave:manage_policies",
    "reports:view",
    "notifications:manage",
    "timesheets:view_all", "timesheets:approve",
    "settings:organization", "settings:shifts",
    "projects:manage",
    "page:tasks", "tasks:view", "tasks:create", "tasks:assign", "tasks:verify", "tasks:manage_groups",
    "page:messages", "messages:send_announcement", "messages:manage_channels", "messages:send_email",
];

const FINANCE_PERMS: Permission[] = [
    "page:dashboard", "page:payroll", "page:loans", "page:reports", "page:employees",
    "employees:view", "employees:view_salary", "employees:approve_salary",
    "payroll:view_all", "payroll:generate", "payroll:lock", "payroll:issue",
    "loans:view_all", "loans:approve",
    "reports:view", "reports:government",
];

const PAYROLL_ADMIN_PERMS: Permission[] = [
    "page:dashboard", "page:payroll", "page:loans", "page:reports", "page:timesheets",
    "employees:view", "employees:view_salary",
    "payroll:view_all", "payroll:generate", "payroll:lock", "payroll:issue",
    "loans:view_all",
    "reports:view", "reports:government",
    "timesheets:view_all",
];

const SUPERVISOR_PERMS: Permission[] = [
    "page:dashboard", "page:employees", "page:attendance", "page:leave", "page:timesheets", "page:projects",
    "employees:view",
    "attendance:view_all", "attendance:approve_overtime",
    "leave:view_all", "leave:approve",
    "timesheets:view_all", "timesheets:approve",
    "page:tasks", "tasks:view", "tasks:create", "tasks:assign", "tasks:verify", "tasks:manage_groups",
    "page:messages", "messages:send_announcement",
];

const EMPLOYEE_PERMS: Permission[] = [
    "page:dashboard", "page:attendance", "page:leave", "page:payroll",
    "payroll:view_own",
    "page:tasks", "tasks:view",
    "page:messages",
];

const AUDITOR_PERMS: Permission[] = [
    "page:dashboard", "page:audit", "page:reports", "page:employees",
    "audit:view",
    "employees:view",
    "reports:view",
];

// ─── Default dashboard layouts per system role ───────────────
function defaultWidget(type: WidgetConfig["type"], order: number, colSpan: WidgetConfig["colSpan"] = 1): WidgetConfig {
    return { id: `dw-${type}-${order}`, type, colSpan, order };
}

const ADMIN_DASHBOARD: WidgetConfig[] = [
    defaultWidget("kpi_active_employees", 0),
    defaultWidget("kpi_present_today", 1),
    defaultWidget("kpi_absent_today", 2),
    defaultWidget("kpi_on_leave", 3),
    defaultWidget("kpi_pending_leaves", 4),
    defaultWidget("kpi_outstanding_loans", 5),
    defaultWidget("chart_team_performance", 6, 2),
    defaultWidget("chart_dept_distribution", 7, 2),
    defaultWidget("table_employee_status", 8, 4),
    defaultWidget("events_widget", 9, 2),
    defaultWidget("birthdays_widget", 10, 2),
];

const SUPERVISOR_DASHBOARD: WidgetConfig[] = [
    defaultWidget("kpi_active_employees", 0),
    defaultWidget("kpi_present_today", 1),
    defaultWidget("kpi_absent_today", 2),
    defaultWidget("kpi_on_leave", 3),
    defaultWidget("kpi_pending_leaves", 4),
    defaultWidget("kpi_pending_ot", 5),
    defaultWidget("chart_team_performance", 6, 2),
    defaultWidget("chart_dept_distribution", 7, 2),
    defaultWidget("table_employee_status", 8, 4),
    defaultWidget("events_widget", 9, 2),
    defaultWidget("birthdays_widget", 10, 2),
];

const FINANCE_DASHBOARD: WidgetConfig[] = [
    defaultWidget("kpi_payslips_issued", 0),
    defaultWidget("kpi_confirmed_payslips", 1),
    defaultWidget("kpi_paid_payslips", 2),
    defaultWidget("kpi_locked_runs", 3),
    defaultWidget("kpi_pending_adjustments", 4),
    defaultWidget("kpi_outstanding_loans", 5),
    defaultWidget("events_widget", 6, 2),
    defaultWidget("birthdays_widget", 7, 2),
];

const EMPLOYEE_DASHBOARD: WidgetConfig[] = [
    defaultWidget("my_attendance_status", 0),
    defaultWidget("my_leave_balance", 1, 2),
    defaultWidget("my_latest_payslip", 2),
    defaultWidget("my_leave_requests", 3, 4),
    defaultWidget("events_widget_readonly", 4, 2),
    defaultWidget("birthdays_widget", 5, 2),
];

const AUDITOR_DASHBOARD: WidgetConfig[] = [
    defaultWidget("kpi_audit_total", 0),
    defaultWidget("kpi_audit_today", 1),
    defaultWidget("kpi_unique_actions", 2),
    defaultWidget("kpi_unique_actors", 3),
    defaultWidget("table_recent_audit", 4, 4),
    defaultWidget("events_widget_readonly", 5, 2),
    defaultWidget("birthdays_widget", 6, 2),
];

const HR_DASHBOARD: WidgetConfig[] = [
    defaultWidget("kpi_active_employees", 0),
    defaultWidget("kpi_present_today", 1),
    defaultWidget("kpi_absent_today", 2),
    defaultWidget("kpi_on_leave", 3),
    defaultWidget("kpi_pending_leaves", 4),
    defaultWidget("kpi_pending_ot", 5),
    defaultWidget("chart_team_performance", 6, 2),
    defaultWidget("chart_dept_distribution", 7, 2),
    defaultWidget("table_employee_status", 8, 4),
    defaultWidget("events_widget", 9, 2),
    defaultWidget("birthdays_widget", 10, 2),
];

// ─── Build system roles ──────────────────────────────────────
function buildSystemRoles(): CustomRole[] {
    return [
        { id: "sys-admin", name: "Admin", slug: "admin", color: "#6366f1", icon: "Shield", isSystem: true, permissions: ADMIN_PERMS, dashboardLayout: { roleId: "sys-admin", widgets: ADMIN_DASHBOARD }, createdAt: "2025-01-01T00:00:00Z" },
        { id: "sys-hr", name: "HR", slug: "hr", color: "#ec4899", icon: "Users", isSystem: true, permissions: HR_PERMS, dashboardLayout: { roleId: "sys-hr", widgets: HR_DASHBOARD }, createdAt: "2025-01-01T00:00:00Z" },
        { id: "sys-finance", name: "Finance", slug: "finance", color: "#14b8a6", icon: "Banknote", isSystem: true, permissions: FINANCE_PERMS, dashboardLayout: { roleId: "sys-finance", widgets: FINANCE_DASHBOARD }, createdAt: "2025-01-01T00:00:00Z" },
        { id: "sys-payroll_admin", name: "Payroll Admin", slug: "payroll_admin", color: "#f97316", icon: "Wallet", isSystem: true, permissions: PAYROLL_ADMIN_PERMS, dashboardLayout: { roleId: "sys-payroll_admin", widgets: FINANCE_DASHBOARD }, createdAt: "2025-01-01T00:00:00Z" },
        { id: "sys-supervisor", name: "Supervisor", slug: "supervisor", color: "#8b5cf6", icon: "Eye", isSystem: true, permissions: SUPERVISOR_PERMS, dashboardLayout: { roleId: "sys-supervisor", widgets: SUPERVISOR_DASHBOARD }, createdAt: "2025-01-01T00:00:00Z" },
        { id: "sys-employee", name: "Employee", slug: "employee", color: "#3b82f6", icon: "User", isSystem: true, permissions: EMPLOYEE_PERMS, dashboardLayout: { roleId: "sys-employee", widgets: EMPLOYEE_DASHBOARD }, createdAt: "2025-01-01T00:00:00Z" },
        { id: "sys-auditor", name: "Auditor", slug: "auditor", color: "#64748b", icon: "FileSearch", isSystem: true, permissions: AUDITOR_PERMS, dashboardLayout: { roleId: "sys-auditor", widgets: AUDITOR_DASHBOARD }, createdAt: "2025-01-01T00:00:00Z" },
    ];
}

// ─── Store Interface ─────────────────────────────────────────
interface RolesState {
    roles: CustomRole[];
    // CRUD
    createRole: (data: Omit<CustomRole, "id" | "createdAt" | "isSystem">) => string;
    updateRole: (id: string, patch: Partial<Omit<CustomRole, "id" | "isSystem">>) => void;
    deleteRole: (id: string) => boolean;
    duplicateRole: (id: string) => string | null;
    // Permissions
    setPermissions: (roleId: string, perms: Permission[]) => void;
    addPermission: (roleId: string, perm: Permission) => void;
    removePermission: (roleId: string, perm: Permission) => void;
    // Dashboard layout
    saveDashboardLayout: (roleId: string, widgets: WidgetConfig[]) => void;
    getDashboardLayout: (roleSlug: string) => WidgetConfig[];
    // Helpers
    getRoleBySlug: (slug: string) => CustomRole | undefined;
    getRoleById: (id: string) => CustomRole | undefined;
    hasPermission: (roleSlug: string, perm: Permission) => boolean;
    getPermissions: (roleSlug: string) => Permission[];
    getAllRoleSlugs: () => string[];
    // Export/import
    exportConfig: () => string;
    importConfig: (json: string) => { ok: boolean; imported: number; error?: string };
    // Reset
    resetToDefaults: () => void;
}

export const useRolesStore = create<RolesState>()(
    persist(
        (set, get) => ({
            roles: buildSystemRoles(),

            createRole: (data) => {
                const id = `role-${nanoid(8)}`;
                const newRole: CustomRole = {
                    ...data,
                    id,
                    isSystem: false,
                    createdAt: new Date().toISOString(),
                };
                set((s) => ({ roles: [...s.roles, newRole] }));
                return id;
            },

            updateRole: (id, patch) => {
                set((s) => ({
                    roles: s.roles.map((r) =>
                        r.id === id ? { ...r, ...patch } : r
                    ),
                }));
            },

            deleteRole: (id) => {
                const role = get().roles.find((r) => r.id === id);
                if (!role || role.isSystem) return false;
                set((s) => ({ roles: s.roles.filter((r) => r.id !== id) }));
                return true;
            },

            duplicateRole: (id) => {
                const source = get().roles.find((r) => r.id === id);
                if (!source) return null;
                const newId = `role-${nanoid(8)}`;
                const dup: CustomRole = {
                    ...source,
                    id: newId,
                    name: `${source.name} (Copy)`,
                    slug: `${source.slug}_copy_${nanoid(4)}`,
                    isSystem: false,
                    createdAt: new Date().toISOString(),
                };
                set((s) => ({ roles: [...s.roles, dup] }));
                return newId;
            },

            setPermissions: (roleId, perms) => {
                set((s) => ({
                    roles: s.roles.map((r) =>
                        r.id === roleId ? { ...r, permissions: perms } : r
                    ),
                }));
            },

            addPermission: (roleId, perm) => {
                set((s) => ({
                    roles: s.roles.map((r) =>
                        r.id === roleId && !r.permissions.includes(perm)
                            ? { ...r, permissions: [...r.permissions, perm] }
                            : r
                    ),
                }));
            },

            removePermission: (roleId, perm) => {
                set((s) => ({
                    roles: s.roles.map((r) =>
                        r.id === roleId
                            ? { ...r, permissions: r.permissions.filter((p) => p !== perm) }
                            : r
                    ),
                }));
            },

            saveDashboardLayout: (roleId, widgets) => {
                set((s) => ({
                    roles: s.roles.map((r) =>
                        r.id === roleId
                            ? { ...r, dashboardLayout: { roleId, widgets } }
                            : r
                    ),
                }));
            },

            getDashboardLayout: (roleSlug) => {
                const role = get().roles.find((r) => r.slug === roleSlug);
                if (!role?.dashboardLayout) {
                    // Fallback for any new custom roles: basic dashboard
                    return [
                        defaultWidget("kpi_active_employees", 0),
                        defaultWidget("kpi_present_today", 1),
                        defaultWidget("events_widget", 2, 2),
                        defaultWidget("birthdays_widget", 3, 2),
                    ];
                }
                return role.dashboardLayout.widgets;
            },

            getRoleBySlug: (slug) => get().roles.find((r) => r.slug === slug),
            getRoleById: (id) => get().roles.find((r) => r.id === id),

            hasPermission: (roleSlug, perm) => {
                const role = get().roles.find((r) => r.slug === roleSlug);
                if (!role) return false;
                // Admin role always has all permissions
                if (role.slug === "admin") return true;
                return role.permissions.includes(perm);
            },

            getPermissions: (roleSlug) => {
                const role = get().roles.find((r) => r.slug === roleSlug);
                return role?.permissions ?? [];
            },

            getAllRoleSlugs: () => get().roles.map((r) => r.slug),

            exportConfig: () => {
                const { roles } = get();
                const custom = roles.filter((r) => !r.isSystem);
                const systemEdited = roles.filter((r) => r.isSystem);
                return JSON.stringify({
                    version: "1.0",
                    exportedAt: new Date().toISOString(),
                    customRoles: custom,
                    systemRoleOverrides: systemEdited.map((r) => ({
                        slug: r.slug,
                        permissions: r.permissions,
                        dashboardLayout: r.dashboardLayout,
                    })),
                }, null, 2);
            },

            importConfig: (json) => {
                try {
                    const data = JSON.parse(json);
                    if (!data.version) return { ok: false, imported: 0, error: "Invalid config format" };
                    let imported = 0;
                    const { roles } = get();

                    // Import custom roles
                    if (Array.isArray(data.customRoles)) {
                        const existing = new Set(roles.map((r) => r.slug));
                        const newRoles: CustomRole[] = [];
                        for (const cr of data.customRoles) {
                            if (!existing.has(cr.slug)) {
                                newRoles.push({ ...cr, id: `role-${nanoid(8)}`, isSystem: false, createdAt: new Date().toISOString() });
                                existing.add(cr.slug);
                                imported++;
                            }
                        }
                        if (newRoles.length > 0) {
                            set((s) => ({ roles: [...s.roles, ...newRoles] }));
                        }
                    }

                    // Apply system role overrides  
                    if (Array.isArray(data.systemRoleOverrides)) {
                        for (const override of data.systemRoleOverrides) {
                            const sysRole = get().roles.find((r) => r.slug === override.slug && r.isSystem);
                            if (sysRole) {
                                set((s) => ({
                                    roles: s.roles.map((r) =>
                                        r.id === sysRole.id
                                            ? { ...r, permissions: override.permissions || r.permissions, dashboardLayout: override.dashboardLayout || r.dashboardLayout }
                                            : r
                                    ),
                                }));
                                imported++;
                            }
                        }
                    }

                    return { ok: true, imported };
                } catch {
                    return { ok: false, imported: 0, error: "Invalid JSON" };
                }
            },

            resetToDefaults: () => set({ roles: buildSystemRoles() }),
        }),
        {
            name: "nexhrms-roles",
            version: 1,
        }
    )
);
