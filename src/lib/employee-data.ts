"use client";

/**
 * Shared employee data accessor.
 *
 * Provides imperative (non-hook) access to the current employee list.
 * Used by other Zustand stores and service files that need cross-store reads.
 *
 * During migration: reads from the Zustand store (still hydrated by sync.service).
 * After migration: will read from TanStack Query cache via EMPLOYEES_QUERY_KEY.
 *
 * This abstraction layer decouples cross-store dependencies from the
 * specific state management implementation.
 */

import { useEmployeesStore } from "@/store/employees.store";
import type { Employee } from "@/types";

/**
 * Get all employees (imperative, non-hook).
 * Safe to call from Zustand store actions, service files, and lib utilities.
 */
export function getEmployees(): Employee[] {
    return useEmployeesStore.getState().employees;
}

/**
 * Get a single employee by ID (imperative, non-hook).
 */
export function getEmployee(id: string): Employee | undefined {
    return useEmployeesStore.getState().employees.find((e) => e.id === id);
}

/**
 * Get employees filtered by role(s).
 */
export function getEmployeesByRole(...roles: string[]): Employee[] {
    const roleSet = new Set(roles.map((r) => r.toLowerCase()));
    return useEmployeesStore.getState().employees.filter(
        (e) => e.status === "active" && roleSet.has(e.role)
    );
}

/**
 * Get all active admin and HR employees (common pattern for notifications).
 */
export function getAdminHrEmployees(): Employee[] {
    return getEmployeesByRole("admin", "hr");
}
