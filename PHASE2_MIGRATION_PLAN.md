# Phase 2 Migration Plan: Remove sync.service.ts for Employees, Payroll, Attendance

**Date:** June 15, 2026  
**Goal:** Decouple employees, payroll, and attendance stores from the global sync.service hydration/write-through pattern, enabling proper TanStack Query migration.

---

## Current Architecture (What We're Changing)

```
Login → hydrateAllStores() → 45 parallel Supabase fetches → setState on 20 stores
     → startWriteThrough() → subscribe to all 20 stores → push changes to DB
     → startRealtime() → listen to postgres_changes → patch stores
```

**Problem:** All 3 target stores (employees, payroll, attendance) are hydrated in `hydrateAllStores()`, kept in sync via write-through subscriptions, and updated via realtime. They cannot be migrated to TanStack Query while this exists.

---

## Target Architecture

```
Login → hydrateAllStores() → fetches for 17 remaining stores only
     → startWriteThrough() → subscriptions for 17 remaining stores only
     → startRealtime() → realtime for 17 remaining stores only

Pages using employees/payroll/attendance:
     → useQuery(queryFn: db.service.fetchX) → cache in React Query
     → useMutation → write to DB → invalidate query → re-fetch
     → Supabase realtime → queryClient.setQueryData (patch cache)
```

---

## Dependency Map (Why This Is Complex)

### Cross-Store Reads of `useEmployeesStore.getState().employees`

| Consumer File | What It Reads | Why |
|---------------|---------------|-----|
| `store/attendance.store.ts` | employees list | Notify admins/HR on absence, get employee names for OT |
| `store/leave.store.ts` | employees list | Get requester name for notifications |
| `store/disciplinary.store.ts` | employees list | Get employee name for NTE/NOD notifications |
| `store/messaging.store.ts` | employees list | Get all active employees for "all_employees" scope |
| `store/tasks.store.ts` | employees list | Get admin/HR employees for task submission notifications |
| `store/notifications.store.ts` | employees list | Get employee role for push URL routing |
| `store/auth.store.ts` | employees list | Reconcile employee record on account creation |
| `services/attendance-actions.service.ts` | employees list | Notify admins/HR on exceptions, get names |
| `services/payroll-backfill.service.ts` | employees list | Get employee records for backfill computation |
| `app/[role]/settings/_views/admin-view.tsx` | getState().resetToSeed() | Full system reset |
| `__tests__/features/disciplinary.test.ts` | setState() | Test setup |
| `__tests__/features/auth.test.ts` | none (indirectly via permissions) | — |

### Cross-Store Reads of `useAttendanceStore.getState()`

| Consumer File | What It Reads |
|---------------|---------------|
| `services/payroll-backfill.service.ts` | `.logs`, `.holidays` |
| `app/[role]/payroll/_views/admin-view.tsx` | `logs`, `overtimeRequests`, (via hook, not getState) |

### Cross-Store Reads of `usePayrollStore.getState()`

| Consumer File | What It Reads |
|---------------|---------------|
| `sync.service.ts` (loans write-through) | `.payslips` — FK guard for loan deductions |

---

## Migration Steps (Ordered for Safety)

Each step is independently verifiable — the app must build and function correctly after each one.

---

### Step 1: Create a Shared Employee Data Accessor

**Goal:** Replace all `useEmployeesStore.getState().employees` calls in other stores/services with a centralized accessor function that reads from the query cache when available, falling back to the Zustand store.

**Files to create:**
- `src/lib/employee-data.ts` — exports `getEmployees(): Employee[]` and `getEmployee(id): Employee | undefined`

**Logic:**
```ts
import { getQueryClient } from "@/lib/query-client";
import { EMPLOYEES_QUERY_KEY } from "@/hooks/use-employees"; // created later

export function getEmployees(): Employee[] {
  // Try TanStack Query cache first (available after migration)
  const cached = getQueryClient().getQueryData<Employee[]>(EMPLOYEES_QUERY_KEY);
  if (cached) return cached;
  // Fallback to Zustand store (during migration period)
  return useEmployeesStore.getState().employees;
}
```

**Files to modify:**
- `store/attendance.store.ts` — replace `useEmployeesStore.getState().employees` with `getEmployees()`
- `store/leave.store.ts` — same
- `store/disciplinary.store.ts` — same
- `store/messaging.store.ts` — same
- `store/tasks.store.ts` — same
- `store/notifications.store.ts` — same
- `store/auth.store.ts` — same
- `services/attendance-actions.service.ts` — same
- `services/payroll-backfill.service.ts` — same

**Verification:** `tsc --noEmit` passes, `next build` passes, all imports resolve.

**Risk:** Low — pure refactor, same runtime behavior.

---

### Step 2: Create Employee TanStack Query Hook

**Goal:** Create `src/hooks/use-employees.ts` that fetches employees from Supabase via `db.service.ts` and exposes the same API as the current Zustand store.

**Files to create:**
- `src/hooks/use-employees.ts`

**Key design:**
- `useQuery` with `queryFn` calling `employeesDb.fetchAll()`, `salaryDb.fetchRequests()`, `salaryDb.fetchHistory()`
- Filter state (searchQuery, statusFilter, etc.) managed via a small local Zustand store (`src/store/employee-filters.store.ts`) or `useState` in the hook
- All mutations (addEmployee, updateEmployee, removeEmployee, etc.) use `queryClient.setQueryData` for optimistic updates + `db.service` for persistence
- Export `EMPLOYEES_QUERY_KEY` for external cache access

**Verification:** `tsc --noEmit` passes. Hook can be imported and called in isolation.

---

### Step 3: Create Attendance TanStack Query Hook

**Goal:** Create `src/hooks/use-attendance.ts` that fetches all attendance entity types from Supabase.

**Files to create:**
- `src/hooks/use-attendance.ts`

**Key design:**
- Multiple queries: `useAttendanceLogs()`, `useAttendanceEvents()`, `useHolidays()`, `useShifts()`, `useOvertimeRequests()`, `useExceptions()`, `usePenalties()`
- Unified `useAttendanceStore()` facade that merges all queries into the same state shape
- Mutations for checkIn, checkOut, markAbsent, shift CRUD, holiday CRUD, overtime submit/approve
- Each mutation calls `db.service` directly (not write-through)

**Verification:** `tsc --noEmit` passes.

---

### Step 4: Create Payroll TanStack Query Hook

**Goal:** Create `src/hooks/use-payroll.ts` that fetches payroll data from Supabase.

**Files to create:**
- `src/hooks/use-payroll.ts`

**Key design:**
- Queries: `usePayslips()`, `usePayrollRuns()`, `useAdjustments()`, `useFinalPay()`, `usePaySchedule()`, `useDeductionOverrides()`, `useGlobalDefaults()`, `useSignatureConfig()`
- Unified `usePayrollStore()` facade
- Mutations for all lifecycle transitions (issue, publish, sign, lock, unlock, etc.)
- Uses existing `payroll-actions.service.ts` for DB-first operations

**Verification:** `tsc --noEmit` passes.

---

### Step 5: Convert Store Files to Shims

**Goal:** Replace the three Zustand store files with re-export shims pointing to the new hooks.

**Files to modify:**
- `src/store/employees.store.ts` → shim re-exporting from `@/hooks/use-employees`
- `src/store/attendance.store.ts` → shim re-exporting from `@/hooks/use-attendance`
- `src/store/payroll.store.ts` → shim re-exporting from `@/hooks/use-payroll`

**Critical:** The shims must still export a `useXStore` that supports:
1. No-arg call: `useEmployeesStore()` → returns full state
2. Selector call: `useEmployeesStore((s) => s.employees)` → returns selected value
3. Static `.getState()` — via `getQueryClient().getQueryData()` wrapper
4. Static `.setState()` — via `getQueryClient().setQueryData()` wrapper

The `.getState()/.setState()` compat layer is needed because `sync.service.ts` still calls them (we can't modify it yet for the 17 other stores it manages).

**Verification:** `tsc --noEmit` passes, `next build` passes.

---

### Step 6: Remove Employees/Attendance/Payroll from sync.service Hydration

**Goal:** Stop `hydrateAllStores()` from fetching and hydrating these 3 stores. They now self-hydrate via their own `useQuery` hooks.

**Files to modify:**
- `src/services/sync.service.ts`:
  - Remove employees, salaryRequests, salaryHistory from Batch 1 `Promise.all`
  - Remove attendanceLogs, attendanceEvents, holidays, shifts, overtimeRequests, evidence, exceptions, penalties from Batch 1
  - Remove payslips, payrollRuns, payrollAdjustments, finalPayComputations, payScheduleRows, deductionOverridesRows, globalDefaultsRows, signatureConfigRow from Batch 1
  - Remove employeeShiftsMap fetch
  - Remove the `useEmployeesStore.setState(...)` block
  - Remove the `useAttendanceStore.setState(...)` block
  - Remove the `usePayrollStore.setState(...)` block
  - Keep all other store hydrations intact

**Verification:** `tsc --noEmit` passes. App loads — employees/attendance/payroll data now comes from React Query hooks (on-demand per page) instead of bulk hydration.

---

### Step 7: Remove Employees/Attendance/Payroll Write-Through Subscriptions

**Goal:** Stop `startWriteThrough()` from subscribing to these 3 stores. Writes now happen explicitly in mutations.

**Files to modify:**
- `src/services/sync.service.ts`:
  - Remove the `useEmployeesStore.subscribe(...)` block (~40 lines)
  - Remove the `useAttendanceStore.subscribe(...)` block (~80 lines)
  - Remove the `usePayrollStore.subscribe(...)` block (~70 lines)
  - Keep all other store subscriptions intact

**Verification:** `tsc --noEmit` passes. Mutations in the new hooks persist data directly via `db.service` (confirmed in Step 2-4).

---

### Step 8: Migrate Realtime Handlers to Query Cache

**Goal:** Instead of patching Zustand stores on realtime events, patch the TanStack Query cache.

**Files to modify:**
- `src/services/sync.service.ts`:
  - Replace `useEmployeesStore.setState(...)` in realtime handlers with `getQueryClient().setQueryData(EMPLOYEES_QUERY_KEY, ...)`
  - Replace `useAttendanceStore.setState(...)` in realtime handlers with query cache patches
  - Replace `usePayrollStore.setState(...)` in realtime handlers with query cache patches

**Verification:** Realtime updates from other tabs still reflect in the UI without page refresh.

---

### Step 9: Update Cross-Store References in Sync (FK Guards)

**Goal:** The loans write-through in sync.service reads `usePayrollStore.getState().payslips` for FK guard checks. Update this to read from the query cache.

**Files to modify:**
- `src/services/sync.service.ts` — loans write-through section: replace `usePayrollStore.getState().payslips` with `getQueryClient().getQueryData(PAYROLL_QUERY_KEY)?.payslips ?? []`

**Verification:** `tsc --noEmit` passes. Loan deductions still sync correctly.

---

### Step 10: Remove `useEmployeesStore` Import from sync.service.ts

**Goal:** sync.service no longer needs to import the employees store at all.

**Files to modify:**
- `src/services/sync.service.ts` — remove `import { useEmployeesStore }` line
- Also remove `useAttendanceStore` and `usePayrollStore` imports if no longer referenced

**Verification:** `tsc --noEmit` passes. sync.service.ts no longer touches the 3 migrated stores.

---

### Step 11: Clean Up — Remove Shim .getState()/.setState() Compat

**Goal:** Now that sync.service no longer calls `.getState()/.setState()` on the 3 migrated stores, remove those compatibility methods from the shims.

**Files to modify:**
- `src/store/employees.store.ts` shim — remove static method compat
- `src/store/attendance.store.ts` shim — remove static method compat
- `src/store/payroll.store.ts` shim — remove static method compat

**Verification:** `tsc --noEmit` passes. `next build` passes.

---

### Step 12: Update Test Files

**Goal:** Tests that use `useEmployeesStore.setState()` need QueryClientProvider wrappers.

**Files to modify:**
- `src/__tests__/features/disciplinary.test.ts` — use query cache setup instead of setState
- `src/__tests__/features/auth.test.ts` — add QueryClientProvider wrapper

**Verification:** `npx jest` passes (or at least no new failures from this migration).

---

## Execution Order Summary

| Step | Risk | Files Changed | Independently Verifiable? |
|------|------|---------------|---------------------------|
| 1 | Low | 10 | ✅ tsc + build |
| 2 | Medium | 1 new | ✅ tsc |
| 3 | Medium | 1 new | ✅ tsc |
| 4 | Medium | 1 new | ✅ tsc |
| 5 | High | 3 | ✅ tsc + build |
| 6 | High | 1 | ✅ tsc + build + manual smoke test |
| 7 | Medium | 1 | ✅ tsc + build |
| 8 | Medium | 1 | ✅ tsc + manual realtime test |
| 9 | Low | 1 | ✅ tsc |
| 10 | Low | 1 | ✅ tsc |
| 11 | Low | 3 | ✅ tsc + build |
| 12 | Low | 2 | ✅ jest |

---

## Risk Mitigation

1. **Steps 1-4 are additive** — they create new files without removing anything. The old system continues to work in parallel. If any step fails, just delete the new file.

2. **Step 5 is the critical swap** — this is where consumers start using the new hooks instead of the old stores. If this fails, revert the 3 shim files.

3. **Steps 6-7 are the point of no return** — these remove hydration/write-through. After this, the old Zustand stores no longer receive data from sync.service. If something breaks, revert sync.service.ts.

4. **Recommended git workflow:** Create a feature branch. Commit after each step. If any step breaks, `git revert HEAD` to the last working state.

---

## Estimated Effort

| Step | Lines of Code | Time Estimate |
|------|---------------|---------------|
| Step 1 | ~50 new + ~30 modified | 15 min |
| Step 2 | ~300 new | 45 min |
| Step 3 | ~400 new | 60 min |
| Step 4 | ~500 new | 75 min |
| Step 5 | ~50 modified | 15 min |
| Step 6 | ~80 removed | 20 min |
| Step 7 | ~190 removed | 15 min |
| Step 8 | ~60 modified | 20 min |
| Step 9 | ~10 modified | 5 min |
| Step 10 | ~5 modified | 5 min |
| Step 11 | ~30 modified | 10 min |
| Step 12 | ~20 modified | 10 min |
| **Total** | **~1700 lines** | **~5 hours** |

---

## Post-Migration State

After all 12 steps:
- `sync.service.ts` still exists but only handles **17 stores** (leave, loans, projects, tasks, messaging, etc.)
- Employees, attendance, and payroll load on-demand via TanStack Query (faster initial page load)
- Mutations persist directly to Supabase (no write-through delay or silent failures)
- Realtime updates patch the query cache directly
- Cross-store lookups use `getEmployees()` accessor that reads from query cache
- Filter state is component-local (not in global store)
- All existing consumer imports work via shims

---

## What Comes After Phase 2

Once the 3 big stores are migrated, the remaining 17 stores in sync.service follow the same pattern (Steps 1-11 repeated). Each subsequent migration is simpler because:
1. The pattern is established
2. The remaining stores are smaller (50-200 lines each)
3. They have fewer cross-store dependencies
4. Many don't have realtime handlers

**Phase 3 targets:** leave, loans, projects, events, departments, job-titles, timesheet (simple CRUD stores)  
**Phase 4 targets:** tasks, messaging, notifications, audit, disciplinary, documents, performance, BIR (complex stores)  
**Phase 5:** Delete sync.service.ts entirely once all 20 stores are migrated.
