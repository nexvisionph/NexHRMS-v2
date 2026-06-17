"use client";

/**
 * Force re-hydration utility.
 *
 * Calls hydrateFromDb() on all self-hydrating stores in parallel.
 * Used after bulk operations (attendance reset, payroll reset, etc.)
 * to ensure local state matches the DB.
 *
 * Replaces the old sync.service forceRehydrate() function.
 */

import { useEmployeesStore } from "@/store/employees.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useLeaveStore } from "@/store/leave.store";
import { useLoansStore } from "@/store/loans.store";
import { useProjectsStore } from "@/store/projects.store";
import { useEventsStore } from "@/store/events.store";
import { useDepartmentsStore } from "@/store/departments.store";
import { useJobTitlesStore } from "@/store/job-titles.store";
import { useTimesheetStore } from "@/store/timesheet.store";
import { useTasksStore } from "@/store/tasks.store";
import { useMessagingStore } from "@/store/messaging.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useAuditStore } from "@/store/audit.store";
import { useLocationStore } from "@/store/location.store";
import { useDocumentsStore } from "@/store/documents.store";
import { useDisciplinaryStore } from "@/store/disciplinary.store";
import { usePerformanceStore } from "@/store/performance.store";
import { useBIRComplianceStore } from "@/store/bir-compliance.store";

/**
 * Force all stores to re-fetch from Supabase.
 * Resets the `_hydrated` flag so `hydrateFromDb()` will run again.
 */
export async function forceRehydrate(): Promise<void> {
    // Reset hydration flags so stores will re-fetch
    (useEmployeesStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useAttendanceStore.getState() as { _hydrated: boolean })._hydrated = false;
    (usePayrollStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useLeaveStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useLoansStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useProjectsStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useEventsStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useDepartmentsStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useJobTitlesStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useTimesheetStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useTasksStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useMessagingStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useNotificationsStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useAuditStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useLocationStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useDocumentsStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useDisciplinaryStore.getState() as { _hydrated: boolean })._hydrated = false;
    (usePerformanceStore.getState() as { _hydrated: boolean })._hydrated = false;
    (useBIRComplianceStore.getState() as { _hydrated: boolean })._hydrated = false;

    // Re-hydrate all stores in parallel
    await Promise.allSettled([
        useEmployeesStore.getState().hydrateFromDb(),
        useAttendanceStore.getState().hydrateFromDb(),
        usePayrollStore.getState().hydrateFromDb(),
        useLeaveStore.getState().hydrateFromDb(),
        useLoansStore.getState().hydrateFromDb(),
        useProjectsStore.getState().hydrateFromDb(),
        useEventsStore.getState().hydrateFromDb(),
        useDepartmentsStore.getState().hydrateFromDb(),
        useJobTitlesStore.getState().hydrateFromDb(),
        useTimesheetStore.getState().hydrateFromDb(),
        useTasksStore.getState().hydrateFromDb(),
        useMessagingStore.getState().hydrateFromDb(),
        useNotificationsStore.getState().hydrateFromDb(),
        useAuditStore.getState().hydrateFromDb(),
        useLocationStore.getState().hydrateFromDb(),
        useDocumentsStore.getState().hydrateFromDb(),
        useDisciplinaryStore.getState().hydrateFromDb(),
        usePerformanceStore.getState().hydrateFromDb(),
        useBIRComplianceStore.getState().hydrateFromDb(),
    ]);
}
