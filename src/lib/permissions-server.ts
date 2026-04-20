/**
 * Server-side permission enforcement for middleware/API routes.
 * 
 * This module provides role-based access control (RBAC) that runs on the server,
 * preventing malicious users from bypassing client-side permission checks.
 */

import type { Permission } from "@/types";

// ─── Role Permission Mappings (Server-side mirror of roles.store.ts) ─────────
// These are the default permissions per role. For custom roles, we'd need to
// fetch from Supabase, but for built-in roles this is sufficient.

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    admin: ["*"] as unknown as Permission[], // Admin has all permissions
    hr: [
        "page:dashboard", "page:employees", "page:leave", "page:attendance", "page:reports",
        "page:timesheets", "page:projects", "page:tasks", "page:notifications", "page:settings",
        "page:messages",
        "employees:view", "employees:create", "employees:edit", "employees:delete",
        "attendance:view_all", "attendance:edit", "leave:view_all", "leave:approve",
        "timesheets:view_all", "timesheets:approve", "reports:view",
    ],
    finance: [
        "page:dashboard", "page:payroll", "page:loans", "page:reports", "page:employees",
        "page:settings", "page:messages",
        "payroll:view_all", "payroll:generate", "loans:view_all", "loans:approve", "reports:view",
        "employees:view",
    ],
    payroll_admin: [
        "page:dashboard", "page:payroll", "page:loans", "page:reports", "page:employees",
        "page:timesheets", "page:settings", "page:messages",
        "payroll:view_all", "payroll:generate", "payroll:lock", "payroll:issue",
        "loans:view_all", "loans:approve", "employees:view", "reports:view",
        "timesheets:view_all",
    ],
    supervisor: [
        "page:dashboard", "page:employees", "page:attendance", "page:leave",
        "page:timesheets", "page:projects", "page:tasks", "page:messages", "page:settings",
        "attendance:view_all", "leave:view_all", "leave:approve", "timesheets:view_all", "timesheets:approve",
        "projects:manage", "tasks:view", "tasks:create", "tasks:assign",
        "employees:view",
    ],
    auditor: [
        "page:dashboard", "page:audit", "page:reports", "page:employees", "page:loans", "page:settings",
        "audit:view", "employees:view", "reports:view", "loans:view_all",
    ],
    employee: [
        "page:dashboard", "page:attendance", "page:leave", "page:payroll",
        "page:loans", "page:tasks", "page:messages", "page:settings",
        "payroll:view_own", "loans:view_own", "tasks:view",
    ],
};

// ─── Route Permission Requirements ───────────────────────────────────────────
// Maps URL path patterns to required permissions. Order matters (first match wins).

interface RouteRule {
    pattern: RegExp;
    permissions: Permission[];
    /** If true, user needs ANY of the permissions. If false, needs ALL. */
    anyOf?: boolean;
}

const PROTECTED_ROUTES: RouteRule[] = [
    // Payroll routes — any role with page:payroll OR payroll:view_own can access
    { pattern: /^\/[^/]+\/payroll/, permissions: ["page:payroll", "payroll:view_own"], anyOf: true },
    
    // Loans routes — any role with page:loans OR loans:view_own can access
    { pattern: /^\/[^/]+\/loans/, permissions: ["page:loans", "loans:view_own"], anyOf: true },
    
    // Audit routes
    { pattern: /^\/[^/]+\/audit/, permissions: ["page:audit"] },
    
    // Employee management
    { pattern: /^\/[^/]+\/employees\/manage/, permissions: ["page:employees"] },
    
    // Settings - admin only
    { pattern: /^\/[^/]+\/settings/, permissions: ["page:settings"] },
    
    // Reports
    { pattern: /^\/[^/]+\/reports/, permissions: ["page:reports"] },
    
    // Projects
    { pattern: /^\/[^/]+\/projects/, permissions: ["page:projects"] },
    
    // Timesheets
    { pattern: /^\/[^/]+\/timesheets/, permissions: ["page:timesheets"] },
    
    // Attendance
    { pattern: /^\/[^/]+\/attendance/, permissions: ["page:attendance"] },
    
    // Leave
    { pattern: /^\/[^/]+\/leave/, permissions: ["page:leave"] },
    
    // Tasks
    { pattern: /^\/[^/]+\/tasks/, permissions: ["page:tasks"] },
    
    // Dashboard - everyone with a role can access
    { pattern: /^\/[^/]+\/dashboard/, permissions: ["page:dashboard"] },
    
    // Profile - everyone can access their own (no specific permission required)
    // If user is authenticated, they can access their profile
];

// ─── Permission Check Functions ──────────────────────────────────────────────

/**
 * Check if a role has a specific permission.
 */
export function hasPermissionServer(role: string, permission: Permission): boolean {
    const rolePerms = ROLE_PERMISSIONS[role];
    if (!rolePerms) return false;
    
    // Admin has wildcard access
    if (rolePerms.includes("*" as Permission)) return true;
    
    return rolePerms.includes(permission);
}

/**
 * Check if a role has ALL specified permissions.
 */
export function hasAllPermissionsServer(role: string, permissions: Permission[]): boolean {
    return permissions.every(p => hasPermissionServer(role, p));
}

/**
 * Check if a role has ANY of the specified permissions.
 */
export function hasAnyPermissionServer(role: string, permissions: Permission[]): boolean {
    return permissions.some(p => hasPermissionServer(role, p));
}

/**
 * Check if a user with the given role can access the specified path.
 * Returns { allowed: true } or { allowed: false, requiredPermissions: [...] }
 */
export function canAccessRoute(
    role: string,
    pathname: string
): { allowed: true } | { allowed: false; requiredPermissions: Permission[] } {
    // Find matching route rule
    for (const rule of PROTECTED_ROUTES) {
        if (rule.pattern.test(pathname)) {
            const hasAccess = rule.anyOf
                ? hasAnyPermissionServer(role, rule.permissions)
                : hasAllPermissionsServer(role, rule.permissions);
            
            if (hasAccess) {
                return { allowed: true };
            }
            
            return { allowed: false, requiredPermissions: rule.permissions };
        }
    }
    
    // No matching rule = allowed (public within auth)
    return { allowed: true };
}

/**
 * Get all permissions for a role.
 */
export function getRolePermissions(role: string): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
}
