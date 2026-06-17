# Phase 3 Migration Plan: Simple CRUD Stores → Self-Hydrating + Direct DB Persistence

**Date:** June 17, 2026  
**Target Stores:** leave, loans, projects, events, departments, job-titles, timesheet  
**Pattern:** Same as Phase 2 — add `hydrateFromDb()` for self-hydration, add explicit `db.service` calls to local-only mutations, then remove hydration + write-through from `sync.service.ts`

---

## Store Overview

| Store | Lines | Consumers | Action Service Functions | Cross-Store Deps | Has Own DB Calls |
|-------|-------|-----------|--------------------------|------------------|------------------|
| `leave.store.ts` | 349 | 16 files | 6 (`leave-actions.service.ts`) | None | No |
| `loans.store.ts` | 228 | 15 files | 7 (`loans-actions.service.ts`) | None | No |
| `projects.store.ts` | 68 | 19 files | 5 (`projects-actions.service.ts`) | None | No |
| `events.store.ts` | 50 | 8 files | 3 (`events-actions.service.ts`) | None | Yes (`eventsDb`) |
| `departments.store.ts` | 103 | 14 files | 4 (`departments-actions.service.ts`) | None | No |
| `job-titles.store.ts` | 112 | 6 files | 4 (`job-titles-actions.service.ts`) | None | No |
| `timesheet.store.ts` | 243 | 7 files | 7 (`timesheet-actions.service.ts`) | None | No |

---

## Service Files Using `.getState()/.setState()`

| Store | Service File | Calls |
|-------|-------------|-------|
| leave | `leave-actions.service.ts` | 10 calls |
| leave | `admin-view.tsx` (settings) | 1 call (resetToSeed) |
| loans | `loans-actions.service.ts` | 10 calls |
| loans | `admin-view.tsx` (settings) | 1 call (resetToSeed) |
| projects | `projects-actions.service.ts` | 9 calls |
| projects | `admin-view.tsx` (settings) | 1 call (resetToSeed) |
| events | `events-actions.service.ts` | 4 calls |
| events | `admin-view.tsx` (settings) | 1 call (resetToSeed) |
| departments | `departments-actions.service.ts` | 6 calls |
| job-titles | `job-titles-actions.service.ts` | 6 calls |
| timesheet | `timesheet-actions.service.ts` | 12 calls |
| timesheet | `admin-view.tsx` (settings) | 1 call (resetToSeed) |

**Key finding:** All 7 stores have dedicated `*-actions.service.ts` files that already handle DB-first persistence. The service files call `.getState()` to read data and `.setState()` to update local cache after DB writes. This is the same pattern as Phase 2 — services handle persistence, so the stores themselves mostly don't need new DB calls (except for mutations not covered by services).

---

## Cross-Store Dependencies

**None.** These 7 stores do not read from each other. No other store reads from them via `.getState()`. Clean isolation.

---

## What sync.service.ts Currently Does for These Stores

**Hydration (in `hydrateAllStoresInternal`):**
- Batch 1: `leaveDb.fetchRequests()`, `leaveDb.fetchBalances()`, `leaveDb.fetchPolicies()`, `loansDb.fetchAll()` → `useLeaveStore.setState(...)`, `useLoansStore.setState(...)`
- Batch 2: `projectsDb.fetchAll()`, `eventsDb.fetchAll()`, `timesheetsDb.fetchTimesheets()`, `timesheetsDb.fetchRuleSets()`, `departmentsDb.fetchAll()`, `jobTitlesDb.fetchAll()` → respective `.setState(...)` calls

**Write-through (in `startWriteThrough`):**
- Leave: subscribes to requests, balances, policies changes → `leaveDb.*`
- Loans: subscribes to loan changes → `loansDb.upsert()` + handles loan deductions FK guard
- Projects: subscribes to project changes → `projectsDb.upsert/remove()`
- Events: subscribes to calendar event changes → `eventsDb.upsert/remove()`
- Timesheets: subscribes to timesheets + ruleSets → `timesheetsDb.*`
- Departments: subscribes to department changes → `departmentsDb.upsert/remove()`
- Job Titles: subscribes to job title changes → `jobTitlesDb.upsert/remove()`

**Realtime (in `startRealtime`):**
- Leave: `leave_requests` INSERT/UPDATE
- Overtime: `overtime_requests` INSERT/UPDATE (in attendance realtime section)
- No realtime for loans, projects, events, departments, job-titles, timesheets

---

## Migration Steps

Each step is independently verifiable with `tsc --noEmit`.

---

### Step 1: Add `hydrateFromDb()` to All 7 Stores

**Goal:** Each store gains the ability to self-fetch from Supabase, same pattern as Phase 2.

**For each store, add:**
1. Import `db.service` functions (`shouldSync`, `hasValidSession`, and the relevant `*Db` object)
2. Add `_hydrated: boolean`, `_hydrating: boolean` to the interface
3. Add `hydrateFromDb: () => Promise<void>` to the interface
4. Implement `hydrateFromDb()` with the guard pattern:
   - Skip if `_hydrated || _hydrating`
   - Skip if `!shouldSync()` or no valid session
   - Fetch all data from `db.service`
   - Only set state if current store is empty

**Files modified:** 7 store files  
**Verification:** `tsc --noEmit`

---

### Step 2: Call `hydrateFromDb()` from `client-layout.tsx`

**Goal:** Trigger self-hydration after login, same as Phase 2 stores.

**File modified:** `src/app/client-layout.tsx` — add 7 `hydrateFromDb()` calls after the existing 3.

```ts
// Existing:
useEmployeesStore.getState().hydrateFromDb();
useAttendanceStore.getState().hydrateFromDb();
usePayrollStore.getState().hydrateFromDb();
// New:
useLeaveStore.getState().hydrateFromDb();
useLoansStore.getState().hydrateFromDb();
useProjectsStore.getState().hydrateFromDb();
useEventsStore.getState().hydrateFromDb();
useDepartmentsStore.getState().hydrateFromDb();
useJobTitlesStore.getState().hydrateFromDb();
useTimesheetStore.getState().hydrateFromDb();
```

**Verification:** `tsc --noEmit` + app loads correctly (both old hydration and self-hydration work — guard prevents double-fetch)

---

### Step 3: Add Explicit DB Calls to Local-Only Mutations

**Goal:** Same as Phase 2 — identify mutations that only call `set()` without `db.service`, add fire-and-forget DB persistence.

**Stores that need this (mutations not covered by action services):**

| Store | Mutation | DB Call Needed |
|-------|----------|---------------|
| `leave.store.ts` | `addRequest` | `leaveDb.upsertRequest(req)` |
| `leave.store.ts` | `updateStatus` | `leaveDb.upsertRequest(req)` |
| `leave.store.ts` | `addPolicy` | `leaveDb.upsertPolicy(policy)` |
| `leave.store.ts` | `updatePolicy` | `leaveDb.upsertPolicy(policy)` |
| `leave.store.ts` | `deletePolicy` | `leaveDb.deletePolicy(id)` |
| `leave.store.ts` | `initBalances` | `leaveDb.upsertBalance(bal)` per balance |
| `leave.store.ts` | `accrueLeave` | `leaveDb.upsertBalance(bal)` |
| `loans.store.ts` | `createLoan` | `loansDb.upsert(loan)` |
| `loans.store.ts` | `deductFromLoan` | `loansDb.upsert(loan)` |
| `loans.store.ts` | `settleLoan` | `loansDb.upsert(loan)` |
| `loans.store.ts` | `freezeLoan` | `loansDb.upsert(loan)` |
| `loans.store.ts` | `unfreezeLoan` | `loansDb.upsert(loan)` |
| `loans.store.ts` | `updateLoan` | `loansDb.upsert(loan)` |
| `loans.store.ts` | `cancelLoan` | `loansDb.upsert(loan)` |
| `loans.store.ts` | `recordDeduction` | `loanExtrasDb.insertDeduction(ded)` |
| `projects.store.ts` | `addProject` | `projectsDb.upsert(project)` |
| `projects.store.ts` | `updateProject` | `projectsDb.upsert(project)` |
| `projects.store.ts` | `deleteProject` | `projectsDb.remove(id)` |
| `projects.store.ts` | `assignEmployee` | `projectsDb.upsert(project)` |
| `projects.store.ts` | `removeEmployee` | `projectsDb.upsert(project)` |
| `events.store.ts` | Already has DB calls | ✅ No change needed |
| `departments.store.ts` | `addDepartment` | `departmentsDb.upsert(dept)` |
| `departments.store.ts` | `updateDepartment` | `departmentsDb.upsert(dept)` |
| `departments.store.ts` | `deleteDepartment` | `departmentsDb.remove(id)` |
| `departments.store.ts` | `toggleActive` | `departmentsDb.upsert(dept)` |
| `job-titles.store.ts` | `addJobTitle` | `jobTitlesDb.upsert(jt)` |
| `job-titles.store.ts` | `updateJobTitle` | `jobTitlesDb.upsert(jt)` |
| `job-titles.store.ts` | `deleteJobTitle` | `jobTitlesDb.remove(id)` |
| `job-titles.store.ts` | `toggleActive` | `jobTitlesDb.upsert(jt)` |
| `timesheet.store.ts` | `addRuleSet` | `timesheetsDb.upsertRuleSet(rs)` |
| `timesheet.store.ts` | `updateRuleSet` | `timesheetsDb.upsertRuleSet(rs)` |
| `timesheet.store.ts` | `deleteRuleSet` | `timesheetsDb.deleteRuleSet(id)` |
| `timesheet.store.ts` | `computeTimesheet` | `timesheetsDb.upsertTimesheet(ts)` |
| `timesheet.store.ts` | `submitTimesheet` | `timesheetsDb.upsertTimesheet(ts)` |
| `timesheet.store.ts` | `approveTimesheet` | `timesheetsDb.upsertTimesheet(ts)` |
| `timesheet.store.ts` | `rejectTimesheet` | `timesheetsDb.upsertTimesheet(ts)` |

**Files modified:** 6 store files (events already done)  
**Verification:** `tsc --noEmit`

---

### Step 4: Remove Hydration from sync.service.ts

**Goal:** Same as Phase 2 Step 6 — remove the 7 stores from `hydrateAllStoresInternal()`.

**Remove from Batch 1:**
- `leaveDb.fetchRequests()`, `leaveDb.fetchBalances()`, `leaveDb.fetchPolicies()`
- `loansDb.fetchAll()`
- Their corresponding `useLeaveStore.setState(...)` and `useLoansStore.setState(...)` blocks

**Remove from Batch 2:**
- `projectsDb.fetchAll()`, `eventsDb.fetchAll()`, `timesheetsDb.fetchTimesheets()`, `timesheetsDb.fetchRuleSets()`, `departmentsDb.fetchAll()`, `jobTitlesDb.fetchAll()`
- `loanExtrasDb.fetchAllDeductions()`, `loanExtrasDb.fetchAllRepaymentSchedules()`
- Their corresponding `.setState(...)` blocks

**Verification:** `tsc --noEmit` + `next build`

---

### Step 5: Remove Write-Through Subscriptions from sync.service.ts

**Goal:** Same as Phase 2 Step 7 — remove the 7 subscription blocks from `startWriteThrough()`.

**Remove blocks:**
- `// ─── Leave write-through` (requests, balances, policies)
- `// ─── Loans write-through` (includes FK guard for payslip deductions)
- `// ─── Projects write-through`
- `// ─── Events write-through`
- `// ─── Timesheets write-through`
- `// ─── Departments write-through`
- `// ─── Job Titles write-through`

**⚠️ Special case — Loans write-through:** The loans write-through has a FK guard that checks `usePayrollStore.getState().payslips` before inserting loan deductions. This logic needs to be moved into the `recordDeduction` mutation in `loans.store.ts` (Step 3).

**Verification:** `tsc --noEmit` + `next build`

---

### Step 6: Clean Up Unused Imports

**Goal:** Remove imports of these stores from sync.service.ts if they're no longer referenced (check if realtime handlers still use them).

**Check realtime usage:**
- `useLeaveStore` — used in realtime handlers for `leave_requests` INSERT/UPDATE → keep
- `useLoansStore` — NOT used in realtime → can remove if no other refs
- `useProjectsStore` — NOT used in realtime → can remove
- `useEventsStore` — NOT used in realtime → can remove
- `useDepartmentsStore` — NOT used in realtime → can remove
- `useJobTitlesStore` — NOT used in realtime → can remove
- `useTimesheetStore` — NOT used in realtime → can remove

**Verification:** `tsc --noEmit`

---

## Execution Order Summary

| Step | Risk | Files Changed | Verification |
|------|------|---------------|-------------|
| 1 | Low | 7 store files | `tsc --noEmit` |
| 2 | Low | 1 (client-layout.tsx) | `tsc --noEmit` |
| 3 | Medium | 6 store files | `tsc --noEmit` |
| 4 | Medium | 1 (sync.service.ts) | `tsc --noEmit` + `next build` |
| 5 | Medium | 1 (sync.service.ts) | `tsc --noEmit` + `next build` |
| 6 | Low | 1 (sync.service.ts) | `tsc --noEmit` |

---

## Estimated Effort

| Step | Time |
|------|------|
| Step 1 (hydrateFromDb × 7) | 30 min |
| Step 2 (client-layout calls) | 5 min |
| Step 3 (DB calls × ~35 mutations) | 60 min |
| Step 4 (remove hydration) | 15 min |
| Step 5 (remove write-through) | 15 min |
| Step 6 (clean imports) | 5 min |
| **Total** | **~2 hours** |

---

## Post-Phase 3 State

After completion:
- **sync.service.ts** will only handle:
  - Hydration: notifications, location, documents, disciplinary, performance, BIR (6 stores)
  - Write-through: notifications, location, documents, disciplinary, performance, BIR, audit, messaging, tasks (9 stores)
  - Realtime: employees, attendance, payroll, leave (4 stores — still needed for multi-tab sync)
- **10 stores** will be fully independent (self-hydrate + self-persist):
  - Phase 2: employees, attendance, payroll
  - Phase 3: leave, loans, projects, events, departments, job-titles, timesheet
- **Login will be even faster** — only ~8 fetches in hydration instead of the original 45+

---

## Phase 4 Preview (Not Yet Planned)

After Phase 3, the remaining stores in sync.service are:
- **Tasks, Messaging, Notifications** (complex stores with cross-deps)
- **Audit, Location, Documents 201** (simpler but still hydrated)
- **Disciplinary, Performance, BIR** (API-backed, batch 3)

These will follow the same pattern. Once all are migrated, `sync.service.ts` can be reduced to just the realtime channel (or replaced with per-query Supabase Realtime subscriptions inside the TanStack Query hooks).
