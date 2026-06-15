# Zustand Store Audit — NexHRMS-v2

**Date:** June 15, 2026  
**Purpose:** Evaluate each Zustand store for redundancy (caching Supabase data that could be fetched directly) vs. legitimacy (pure UI/local state that needs to remain client-side). Provide migration recommendations.

---

## Classification System

- **Redundant (Server Cache)** — Store holds domain data that already exists in Supabase. Could be replaced with TanStack Query (react-query) for automatic caching, deduplication, background refetch, and stale-while-revalidate.
- **Hybrid** — Store holds domain data AND UI/filter state in the same interface. Domain data should migrate to TanStack Query; UI state should move to component-local state or a small dedicated store.
- **UI/Local State (Keep)** — Store manages purely client-side state (sidebar toggle, theme, etc.) with no server counterpart. Keep as Zustand or replace with useState/useContext.
- **Config/Persist (Keep)** — Store persists user preferences to localStorage. Has no server-side equivalent or intentionally diverges from server state (offline-first).

---

## Complete Store Audit

---

### 1. `src/store/employees.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `employees[]`, `deletedEmployeeIds[]`, `salaryRequests[]`, `salaryHistory[]`, `documents{}`, `searchQuery`, `statusFilter`, `workTypeFilter`, `roleFilter`, `departmentFilter` |
| **Classification** | **Hybrid** — Server cache + UI filter state |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | None (write-through handles DB) |
| **SEED data** | Yes (`SEED_EMPLOYEES`) |
| **UI state mixed in** | 5 filter fields (`searchQuery`, `statusFilter`, `workTypeFilter`, `roleFilter`, `departmentFilter`) |

**Recommendation:** Replace domain arrays (`employees`, `salaryRequests`, `salaryHistory`) with **TanStack Query** queries against Supabase. Extract filter state to component-level `useState` or a minimal `useEmployeeFilters` Zustand slice. Business logic (deduplication, salary governance) moves to server-side or a service layer.

---

### 2. `src/store/attendance.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `events[]`, `evidence[]`, `exceptions[]`, `logs[]`, `overtimeRequests[]`, `shiftTemplates[]`, `employeeShifts{}`, `holidays[]`, `penalties[]` |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | `fetch("/api/attendance/exceptions")` for exception CRUD |
| **SEED data** | Yes (`SEED_ATTENDANCE`) |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. This is one of the largest stores (~70+ state fields) and its entire dataset already lives in Supabase. Each entity group (logs, events, exceptions, shifts, holidays, overtime) becomes a separate query with targeted invalidation. The exception CRUD already uses API routes — this maps perfectly to `useMutation` + `queryClient.invalidateQueries`. Complex selectors like `getTodayLog` become query filters.

---

### 3. `src/store/payroll.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `payslips[]`, `runs[]`, `adjustments[]`, `finalPayComputations[]`, `paySchedule`, `signatureConfig`, `deductionOverrides[]`, `globalDefaults[]` |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | None (write-through handles DB) |
| **SEED data** | None |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. Payroll runs and payslips are high-volume, infrequently-changing data — perfect for query caching with long `staleTime`. Actions like `lockRun`, `publishPayslip` etc. already use `payroll-actions.service.ts` (DB-first pattern) — convert these to `useMutation` hooks that invalidate the relevant queries. The computation engine remains a pure function called before issuing payslips.

---

### 4. `src/store/leave.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `requests[]`, `policies[]`, `balances[]` |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | None (write-through handles DB) |
| **SEED data** | Yes (`SEED_LEAVES`) |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. Three separate queries: `useLeaveRequests`, `useLeavePolicies`, `useLeaveBalances`. Leave balance validation should move to a server-side API route (prevents concurrent approval overdraw).

---

### 5. `src/store/loans.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `loans[]` (with nested `deductions[]`, `repaymentSchedule[]`, `balanceHistory[]`) |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | None (write-through handles DB) |
| **SEED data** | Yes (`SEED_LOANS`) |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. `useLoans(employeeId?)` query with nested data. Mutations for deduct/settle/freeze/cancel that invalidate the loans query.

---

### 6. `src/store/projects.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `projects[]` |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | None (write-through handles DB) |
| **SEED data** | Yes (`SEED_PROJECTS`) |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. Simple `useProjects` query. Already has DB-first action functions in `projects-actions.service.ts` that map directly to mutations.

---

### 7. `src/store/tasks.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `groups[]`, `tasks[]`, `completionReports[]`, `comments[]`, `taskTags[]` |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | None (write-through handles DB) |
| **SEED data** | Yes (5 seed arrays) |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. Five queries: `useTaskGroups`, `useTasks`, `useCompletionReports`, `useTaskComments`, `useTaskTags`. Task verification/rejection becomes mutations that invalidate related queries.

---

### 8. `src/store/messaging.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `announcements[]`, `channels[]`, `messages[]`, `config` |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | None (write-through handles DB) |
| **SEED data** | Yes (3 seed arrays) |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. Messages per-channel is a great fit for parameterized queries (`useChannelMessages(channelId)`). Channel list + announcements as separate queries. If real-time messaging is added, Supabase Realtime subscriptions + `queryClient.setQueryData` for optimistic updates.

---

### 9. `src/store/notifications.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `logs[]`, `rules[]`, `providerConfig`, `employeePrefs{}`, `hasFetchedFromDb` |
| **Classification** | **Hybrid** — Server cache + loading state |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | Yes (`notificationsDb`, fetch to `/api/settings/notifications`, `/api/notifications/mark-read`, `/api/push/send`) |
| **SEED data** | None (DEFAULT_RULES are constants) |
| **UI state mixed in** | `hasFetchedFromDb` |

**Recommendation:** Replace with **TanStack Query**. `useNotificationLogs(employeeId)`, `useNotificationRules`, `useProviderConfig` as separate queries. Dispatch/mark-read become mutations. The `hasFetchedFromDb` flag disappears (TanStack Query tracks this automatically via `isLoading`/`isSuccess`).

---

### 10. `src/store/audit.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `logs[]` |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | Yes (`auditDb.insert`, `auditDb.batchInsert`) |
| **SEED data** | None |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query** for reads (`useAuditLogs` with pagination). Keep a lightweight `logAuditEntry` utility function that calls the DB directly (fire-and-forget) and invalidates the query. Audit logs are append-only so the write side is simple.

---

### 11. `src/store/disciplinary.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `cases[]`, `ntes[]`, `nods[]` |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes (batch 3, allSettled) |
| **DB calls in store** | None |
| **SEED data** | None |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. `useDisciplinaryCases`, `useNTEsByCase(caseId)`, `useNODsByCase(caseId)`. Case lifecycle mutations (create, issue NTE/NOD, close) invalidate relevant queries.

---

### 12. `src/store/documents.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `documents[]` (201 files) |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | None |
| **SEED data** | None |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. `useDocuments(employeeId)` with mutations for upload/approve/reject/archive. Completeness calculations can be derived in the query's `select` option.

---

### 13. `src/store/timesheet.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `timesheets[]`, `ruleSets[]` |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | None |
| **SEED data** | None |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. `useTimesheets(employeeId, period)`, `useRuleSets`. Computation logic stays client-side as a pure function; results written via mutation.

---

### 14. `src/store/events.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `events[]` (calendar events) |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | Yes (`eventsDb.upsert`, `eventsDb.remove`) |
| **SEED data** | Yes (`SEED_EVENTS`) |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. `useCalendarEvents(dateRange)`. Mutations for add/update/remove that invalidate the query.

---

### 15. `src/store/bir-compliance.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `taxProfiles[]`, `annualSummaries[]`, `previousEmployerRecords[]`, `form2316Records[]`, `alphalistExports[]`, `lastValidationIssues[]` |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes (batch 3) |
| **DB calls in store** | None |
| **SEED data** | None |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. Multiple queries grouped by entity (`useTaxProfiles`, `useAnnualSummaries(year)`, `useForm2316(employeeId, year)`). These are read-heavy, write-infrequent — excellent fit for long `staleTime`.

---

### 16. `src/store/departments.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `departments[]` |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | None |
| **SEED data** | From constants |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. `useDepartments` — simple reference data query with long `staleTime` (rarely changes). This is a tiny store; could also be a direct Supabase call in the few components that need it.

---

### 17. `src/store/job-titles.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `jobTitles[]` |
| **Classification** | **Redundant (Server Cache)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes |
| **DB calls in store** | None |
| **SEED data** | From constants |
| **UI state mixed in** | None |

**Recommendation:** Replace with **TanStack Query**. `useJobTitles` — same pattern as departments. Reference data with long cache time.

---

### 18. `src/store/location.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `config`, `photos[]`, `breaks[]`, `pings[]`, `hasFetchedConfig` |
| **Classification** | **Hybrid** — Server cache + loading flag |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes (pings, photos, breaks) |
| **DB calls in store** | Yes (fetch `/api/settings/location`) |
| **SEED data** | None |
| **UI state mixed in** | `hasFetchedConfig` |

**Recommendation:** Replace with **TanStack Query**. `useLocationConfig`, `useLocationPings(employeeId, date)`, `useBreaks(employeeId, date)`. Config fetch becomes `useQuery` (eliminates `hasFetchedConfig`).

---

### 19. `src/store/performance.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `cycles[]`, `criteria[]`, `salaryBands[]`, `reviews[]`, `adjustments[]`, `auditLogs[]`, `activeCycleId`, `selectedReviewId`, `filterStatus`, `isLoading`, `error` |
| **Classification** | **Hybrid** — Server cache + substantial UI state |
| **Persist middleware** | No |
| **Hydrated by sync.service** | Yes (batch 3) |
| **DB calls in store** | None |
| **SEED data** | None |
| **UI state mixed in** | `activeCycleId`, `selectedReviewId`, `filterStatus`, `isLoading`, `error` |

**Recommendation:** Split into **TanStack Query** for data (`usePerformanceCycles`, `usePerformanceReviews(cycleId)`, `useSalaryBands(cycleId)`) and **component-local state** for `activeCycleId`, `selectedReviewId`, `filterStatus`. The `isLoading`/`error` flags are handled automatically by TanStack Query.

---

### 20. `src/store/roles.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `roles[]`, `isLoading`, `hasFetchedFromDb` |
| **Classification** | **Hybrid** — Server cache + loading state |
| **Persist middleware** | No |
| **Hydrated by sync.service** | No (own `/api/roles` fetch) |
| **DB calls in store** | Yes (fetch `/api/roles` — GET, POST, PUT) |
| **SEED data** | None |
| **UI state mixed in** | `isLoading`, `hasFetchedFromDb` |

**Recommendation:** Replace with **TanStack Query**. Already uses API routes — `useRoles` query + mutations for create/update/delete. The `hasPermission` utility becomes a derived helper that reads from the query cache.

---

### 21. `src/store/deductions.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `templates[]`, `assignments[]`, `isLoading`, `error` |
| **Classification** | **Hybrid** — Server cache + loading state |
| **Persist middleware** | No |
| **Hydrated by sync.service** | No (own `/api/payroll/templates` fetch) |
| **DB calls in store** | Yes (fetch to `/api/payroll/templates` and assignments endpoints) |
| **SEED data** | None |
| **UI state mixed in** | `isLoading`, `error` |

**Recommendation:** Replace with **TanStack Query**. `useDeductionTemplates` and `useDeductionAssignments(employeeId)`. Already API-based — straightforward migration. `isLoading`/`error` handled by TanStack automatically.

---

### 22. `src/store/jobs.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `jobs[]`, `applications[]`, `isLoading`, `hasFetched` |
| **Classification** | **Hybrid** — Server cache + loading state |
| **Persist middleware** | No |
| **Hydrated by sync.service** | No (own `/api/jobs` fetch) |
| **DB calls in store** | Yes (fetch to `/api/jobs` and sub-routes) |
| **SEED data** | None |
| **UI state mixed in** | `isLoading`, `hasFetched` |

**Recommendation:** Replace with **TanStack Query**. `useJobs(filters)`, `useApplications(jobId)`. Already fully API-driven.

---

### 23. `src/store/appearance.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | Theme colors, font, density, branding (company name, logo, favicon), module toggles, nav overrides, sidebar variant, login page config |
| **Classification** | **UI/Local State (Keep)** |
| **Persist middleware** | Yes (`"soren-appearance"`) |
| **Hydrated by sync.service** | No |
| **DB calls in store** | None |
| **SEED data** | None |
| **UI state mixed in** | Entire store IS UI config |

**Recommendation:** **Keep as Zustand with persist.** This is client-side theming/branding config that needs localStorage persistence. No server counterpart needed. If multi-device sync is desired in the future, add a DB table for org-level appearance config.

---

### 24. `src/store/auth.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `accounts[]`, `currentUser`, `isAuthenticated`, `theme` |
| **Classification** | **UI/Local State (Keep)** |
| **Persist middleware** | Yes (`"soren-auth"`) |
| **Hydrated by sync.service** | No (auth comes from Supabase Auth, not data tables) |
| **DB calls in store** | None (demo-only local auth) |
| **SEED data** | Yes (`DEMO_USERS`) |
| **UI state mixed in** | `theme` (light/dark) |

**Recommendation:** **Keep but refactor.** In production, `currentUser` should come from Supabase Auth session, not this store. Keep as a thin wrapper that resolves the current employee record from the Supabase session. Move `theme` to `appearance.store.ts`. Remove demo-only password hashing and SEED accounts in production builds.

---

### 25. `src/store/kiosk.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `settings` (~40+ kiosk config fields), `hasFetchedConfig` |
| **Classification** | **Config/Persist (Keep)** |
| **Persist middleware** | Yes (`"soren-kiosk-settings"`) |
| **Hydrated by sync.service** | No (own `/api/settings/kiosk`) |
| **DB calls in store** | Yes (fetch `/api/settings/kiosk`) |
| **SEED data** | None |
| **UI state mixed in** | `hasFetchedConfig` |

**Recommendation:** **Replace with TanStack Query** for the server-side config fetch, but keep localStorage persist for **offline kiosk functionality** (kiosk devices may lose network). Use `useQuery` with `initialData` from localStorage and `staleTime: Infinity` for the kiosk device use case.

---

### 26. `src/store/offline-queue.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `queue[]`, `syncStatus`, `lastSyncAt`, `isOnline` |
| **Classification** | **UI/Local State (Keep)** — but currently DEAD CODE |
| **Persist middleware** | Yes (`"soren-offline-queue"`) |
| **Hydrated by sync.service** | No |
| **DB calls in store** | Yes (fetch `/api/attendance/sync-offline`) |
| **SEED data** | None |
| **UI state mixed in** | `syncStatus`, `isOnline`, `lastSyncAt` |

**Recommendation:** **Keep as Zustand with persist** (if wired up). This is a legitimate offline-first pattern — queue events in localStorage, batch-sync when online. Currently dead code (never imported), but architecturally sound. Either wire it up or delete it.

---

### 27. `src/store/page-builder.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `pages[]` (custom dashboard page definitions with widget layouts) |
| **Classification** | **Config/Persist (Keep)** |
| **Persist middleware** | Yes (`"nexhrms-pages"`) |
| **Hydrated by sync.service** | No |
| **DB calls in store** | None |
| **SEED data** | None |
| **UI state mixed in** | None |

**Recommendation:** **Keep as Zustand with persist** for now. If multi-user page sharing is needed, add a DB table and migrate to TanStack Query. Currently localStorage-only is fine for per-device custom pages.

---

### 28. `src/store/ui.store.ts`

| Attribute | Value |
|-----------|-------|
| **State managed** | `sidebarOpen`, `mobileSidebarOpen`, `commandPaletteOpen` |
| **Classification** | **UI/Local State (Keep)** |
| **Persist middleware** | No |
| **Hydrated by sync.service** | No |
| **DB calls in store** | None |
| **SEED data** | None |
| **UI state mixed in** | Entire store is UI state (correct) |

**Recommendation:** **Keep as Zustand OR replace with React Context.** This is 3 booleans — Zustand is fine but slightly over-engineered. A simple `UIContext` provider would work equally well. Keep Zustand if other stores subscribe to it; use Context if it's purely consumed in the component tree.

---

## Summary: Migration Plan

### Replace with TanStack Query (17 stores)

These stores are pure server-cache — they hold data that lives in Supabase and was synced down on login:

| Store | Priority | Complexity | Notes |
|-------|----------|------------|-------|
| employees | High | High | Largest consumers, most cross-module deps |
| attendance | High | High | Many entity types, API routes already exist |
| payroll | High | High | Complex lifecycle, already has action services |
| leave | High | Medium | 3 entity types, clean interface |
| loans | Medium | Medium | Nested data (deductions, schedule) |
| tasks | Medium | Medium | 5 entity types |
| notifications | Medium | Medium | Already uses API routes |
| audit | Medium | Low | Append-only, pagination needed |
| disciplinary | Medium | Medium | NTE/NOD workflow |
| documents | Medium | Low | Single entity type |
| messaging | Medium | Medium | Real-time potential |
| performance | Medium | Medium | Already API-driven |
| bir-compliance | Low | Low | Read-heavy reference data |
| timesheet | Low | Low | 2 entity types |
| events | Low | Low | Simple CRUD |
| departments | Low | Low | Reference data |
| job-titles | Low | Low | Reference data |

### Replace with TanStack Query (already API-driven, 4 stores)

These already use `fetch()` to API routes — easiest to migrate:

| Store | Priority | Notes |
|-------|----------|-------|
| roles | High | Central to permission checks |
| deductions | Medium | Payroll dependency |
| jobs | Low | Self-contained module |
| kiosk | Low | Keep localStorage fallback for offline |

### Keep as Zustand (7 stores)

| Store | Reason |
|-------|--------|
| ui | Pure UI toggles |
| appearance | Client-side theming with localStorage persist |
| auth | Session wrapper (refactor but keep) |
| page-builder | Per-device page layout persist |
| offline-queue | Offline-first queue (if wired up) |
| kiosk (hybrid) | Needs localStorage for offline kiosk |

---

## Recommended Migration Order

1. **Phase 1 — Already API-driven (low risk):** `roles`, `deductions`, `jobs` → these already use fetch(); just wrap in `useQuery`/`useMutation`
2. **Phase 2 — Core data with action services:** `employees`, `payroll`, `attendance` → these have the most consumers but also have `*-actions.service.ts` files ready
3. **Phase 3 — Simple domain stores:** `leave`, `loans`, `projects`, `events`, `departments`, `job-titles`, `timesheet`
4. **Phase 4 — Complex / less-used:** `tasks`, `messaging`, `notifications`, `audit`, `disciplinary`, `documents`, `performance`, `bir-compliance`
5. **Phase 5 — Cleanup:** Remove `sync.service.ts` entirely once all stores are migrated. Remove SEED data imports. Remove write-through pattern.

---

## Key Architectural Change

**Current:** `sync.service.ts` pulls ALL data from ALL tables on login → stuffs into 20+ Zustand stores → subscribes to all stores → writes changes back

**Target:** Each component/page fetches only the data it needs via TanStack Query → caches automatically → mutations invalidate relevant queries → no global hydration step → no write-through subscription layer

**Benefits:**
- Eliminates the 40+ parallel Supabase requests on login (fetches on-demand per page)
- Eliminates the O(n) JSON.stringify change detection in write-through
- Automatic stale-while-revalidate, background refetch, and retry
- Per-query loading/error states (no global `isLoading` booleans)
- Removes ~2300 lines of sync.service.ts code
- Enables pagination for large datasets (audit logs, attendance logs)
- Devtools for inspecting cache state (React Query Devtools)

**Risks:**
- Large migration surface (20+ stores, many consumer components)
- Optimistic updates need careful implementation for real-time feel
- Cross-module derived data (e.g., "loan balance affects payroll") needs query invalidation chains
- Must maintain feature parity during gradual migration (both patterns coexist temporarily)
