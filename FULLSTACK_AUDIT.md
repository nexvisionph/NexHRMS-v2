# NexHRMS Full-Stack Audit Report

> Generated: 2026-03-25 | Lead Full-Stack Developer Review

---

## Executive Summary

NexHRMS is a **feature-complete MVP** with 19 Zustand stores, 18 pages, 15 SQL migration files, and 956 passing tests. The frontend is robust with full RBAC, role-dispatched views, and comprehensive business logic. However, **backend integration is only 5% complete** — only authentication has a server action layer. All other data lives exclusively in client-side localStorage via Zustand `persist`.

### Current Architecture State

| Layer | Status | Details |
|-------|--------|---------|
| **Frontend UI** | ✅ 95% Complete | 18 pages, role-dispatched, responsive |
| **Business Logic (Stores)** | ✅ 100% Complete | 19 stores, 200+ actions |
| **SQL Schema** | ✅ 100% Complete | 15 migrations, 40+ tables |
| **RLS Policies** | ✅ 100% Complete | 131 policies, all idempotent |
| **Auth Service** | ✅ Complete | signIn, signOut, createUser, getCurrentUser |
| **Data Services (CRUD)** | ❌ 0% Complete | No service layer for any store |
| **API Routes** | ❌ 5% Complete | Only 1 route (notifications/resend) |
| **Seed Data (SQL)** | ⚠️ 30% Complete | Config only, no entity data |
| **Tests** | ⚠️ 63% Store Coverage | 7 stores untested, 0 service/component tests |

---

## Part 1: Backend ↔ Frontend Alignment Issues

### 1.1 Type Mismatches (SQL vs TypeScript)

#### CRITICAL: Missing `Holiday` interface in types/index.ts
- **SQL**: `holidays` table in 004_attendance.sql with `id, date, name, type, year`
- **TS**: No `Holiday` interface — defined inline in `constants.ts` as `{date, name, type}`
- **Store**: `attendance.store.ts` uses `Holiday` type but it's defined locally
- **Fix**: Add proper `Holiday` interface to `types/index.ts`

#### CRITICAL: Missing fields in `Employee` interface
- **SQL** has: `profile_id`, `created_at`, `updated_at`
- **TS** lacks: `profileId`, `createdAt`, `updatedAt`
- **Impact**: Cannot link employee to auth user; no audit trail

#### CRITICAL: `loans.created_at` uses `date` instead of `timestamptz`
- **SQL**: `created_at date NOT NULL DEFAULT CURRENT_DATE` (007_loans.sql)
- **Every other table**: Uses `timestamptz NOT NULL DEFAULT now()`
- **Fix**: Migration to ALTER COLUMN type

#### MODERATE: Object ↔ Column flattening needed
| TS Type | TS Shape | SQL Columns |
|---------|----------|-------------|
| `Project.location` | `{lat, lng, radius}` | `location_lat`, `location_lng`, `location_radius` |
| `AttendanceLog.locationSnapshot` | `{lat, lng}` | `location_lat`, `location_lng` |
| `Timesheet.segments` | `TimesheetSegment[]` | `segments jsonb` |

These need serialization/deserialization in the service layer.

### 1.2 Missing Types Not in types/index.ts

| Type | Used By | Status |
|------|---------|--------|
| `Holiday` | attendance.store, constants.ts | ❌ Missing from types |
| `EmployeeDocument` | employees.store | ❌ Missing from types |
| `NotificationProviderConfig` | notifications.store | ❌ Missing from types |
| `MessagingConfig` | messaging.store | ❌ Missing from types |
| `KioskSettings` | kiosk.store | ❌ Missing from types |

---

## Part 2: Feature Completeness Audit

### 2.1 Pages — All 18 Functional
| Page | Route | Views | Status |
|------|-------|-------|--------|
| Root | `/` | Redirect | ✅ |
| Login | `/login` | Dual-mode auth | ✅ |
| Kiosk | `/kiosk` | 4 biometric modes | ✅ |
| Dashboard | `/{role}/dashboard` | Widget grid | ✅ |
| Employees Manage | `/{role}/employees/manage` | Admin/Finance/Readonly | ✅ |
| Directory | `/{role}/employees/directory` | Card grid + salary | ✅ |
| Employee Detail | `/{role}/employees/{id}` | Admin/Viewer | ✅ |
| Attendance | `/{role}/attendance` | Admin/Employee | ✅ |
| Leave | `/{role}/leave` | Admin/Employee | ✅ |
| Loans | `/{role}/loans` | Admin/Readonly | ✅ |
| Payroll | `/{role}/payroll` | Admin/Finance/Employee | ✅ |
| Projects | `/{role}/projects` | Admin/Readonly | ✅ |
| Reports | `/{role}/reports` | Admin/Basic | ✅ |
| Settings | `/{role}/settings` | Admin/HR/Employee | ✅ |
| Notifications | `/{role}/notifications` | Log viewer | ✅ |
| Tasks | `/{role}/tasks` | Admin/Employee | ✅ |
| Messages | `/{role}/messages` | Admin/Employee | ✅ |
| Timesheets | `/{role}/timesheets` | Full implementation | ✅ |

### 2.2 Stores — Business Logic Coverage

| Store | Actions | Tests | Test Cases | Service Layer |
|-------|---------|-------|------------|---------------|
| attendance | 45+ | ✅ | 23 | ❌ |
| employees | 18 | ✅ | 22 | ❌ |
| payroll | 30+ | ✅ | 107 (3 files) | ❌ |
| tasks | 20 | ✅ | 48 | ❌ |
| messaging | 17 | ✅ | 37 | ❌ |
| notifications | 13 | ✅ | 24 | ❌ |
| loans | 20 | ✅ | 23 | ❌ |
| leave | 16 | ✅ | 10 | ❌ |
| location | 14 | ✅ | 40 | ❌ |
| auth | 9 | ✅ | 11 | ✅ (server actions) |
| roles | 16 | ✅ (RBAC) | ~20 | ❌ |
| **timesheet** | 10 | ❌ | 0 | ❌ |
| **projects** | 6 | ❌ | 0 | ❌ |
| **audit** | 6 | ❌ | 0 | ❌ |
| **kiosk** | 2 | ❌ | 0 | ❌ |
| **events** | 4 | ❌ | 0 | ❌ |
| **appearance** | 10 | ❌ | 0 | ❌ |
| **ui** | 5 | ❌ | 0 | ❌ |
| page-builder | 9 | ✅ (flow) | ~5 | ❌ |

### 2.3 Features Working in Demo Mode (All ✅)
- ✅ Authentication (7 demo roles with quick-login)
- ✅ RBAC with 38 permissions, role-dispatched views
- ✅ Employee CRUD with salary governance workflow
- ✅ Attendance tracking (event ledger + legacy logs)
- ✅ Kiosk mode (Face/PIN/QR/NFC)
- ✅ Leave management (PH-compliant: SL, VL, EL, ML, PL, SPL)
- ✅ Payroll (payslips, runs, adjustments, final pay, 13th month)
- ✅ Loan management (deductions, schedules, cap-aware)
- ✅ Project management with employee assignments
- ✅ Task management (groups, completion reports, comments)
- ✅ Messaging (announcements, channels, DM-style messages)
- ✅ Timesheet computation (night diff, overtime, rule sets)
- ✅ Notifications (15 rule types, multi-channel)
- ✅ Reports generation
- ✅ Settings (per-role)
- ✅ Appearance/branding customization
- ✅ Custom page builder
- ✅ Audit logging
- ✅ Geofence calculations
- ✅ PH government deductions (SSS, PhilHealth, Pag-IBIG, tax)

---

## Part 3: What Needs to Be Done

### Sprint 1: Type & Schema Fixes (Immediate)

| # | Task | Priority | Files |
|---|------|----------|-------|
| 1 | Add `Holiday` interface to types/index.ts | Critical | types/index.ts |
| 2 | Add `EmployeeDocument` interface to types/index.ts | Critical | types/index.ts |
| 3 | Add `profileId`, `createdAt`, `updatedAt` to Employee | Critical | types/index.ts |
| 4 | Fix loans `created_at` field type in SQL | Critical | 016_fix_loans_timestamp.sql |
| 5 | Add `MessagingConfig` type to types/index.ts | Medium | types/index.ts |
| 6 | Add `NotificationProviderConfig` to types/index.ts | Medium | types/index.ts |

### Sprint 2: Missing Store Tests

| # | Store | Est. Tests | Priority |
|---|-------|------------|----------|
| 1 | timesheet.store.ts | ~25 | High (computation logic) |
| 2 | projects.store.ts | ~15 | Medium |
| 3 | audit.store.ts | ~12 | High (integrity) |
| 4 | kiosk.store.ts | ~8 | Low |
| 5 | events.store.ts | ~8 | Low |
| 6 | appearance.store.ts | ~15 | Low |
| 7 | ui.store.ts | ~8 | Low |

### Sprint 3: Service Layer (Backend Integration)

For each store, create a `{entity}.service.ts` with `"use server"` directive:

| Service | Tables | Key Operations |
|---------|--------|----------------|
| employees.service.ts | employees, salary_*, employee_documents | CRUD, salary governance |
| attendance.service.ts | attendance_events, evidence, exceptions, logs | Event append, log queries |
| leave.service.ts | leave_requests, balances, policies | Request CRUD, balance mgmt |
| payroll.service.ts | payslips, payroll_runs, adjustments, final_pay | Full lifecycle |
| loans.service.ts | loans, loan_deductions, repayment, balance_history | Loan lifecycle |
| projects.service.ts | projects | CRUD, assignments |
| tasks.service.ts | task_groups, tasks, completion_reports, comments | Full task workflow |
| messaging.service.ts | announcements, text_channels, channel_messages | Messaging CRUD |
| timesheet.service.ts | timesheets, attendance_rule_sets | Computation, approval |
| notifications.service.ts | notification_logs, notification_rules | Dispatch, rule mgmt |
| audit.service.ts | audit_logs | Logging, queries |
| settings.service.ts | appearance_config, dashboard_layouts, custom_pages | Config CRUD |

### Sprint 4: Store Refactoring (Dual-Mode)

Each store needs a dual-mode pattern:
```typescript
// Example: employees.store.ts
const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

addEmployee: async (emp) => {
  if (isDemoMode) {
    // Current Zustand logic (unchanged)
    set({ employees: [...get().employees, emp] });
  } else {
    // Call Supabase service
    const result = await createEmployee(emp);
    if (result.ok) set({ employees: [...get().employees, result.data] });
  }
}
```

### Sprint 5: DB↔TS Mapper Utility

Create `src/lib/db-mappers.ts` for object flattening/unflattening:

```typescript
// Project: { location: {lat, lng, radius} } ↔ location_lat, location_lng, location_radius
// AttendanceLog: { locationSnapshot: {lat, lng} } ↔ location_lat, location_lng
// Timesheet: { segments: TimesheetSegment[] } ↔ segments jsonb
```

---

## Part 4: SQL ↔ Store Action Mapping

### Tables with Full Store Coverage (store actions map to all needed SQL operations)
| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| employees | ✅ getFiltered | ✅ addEmployee | ✅ updateEmployee | ✅ removeEmployee |
| attendance_events | ✅ getEventsFor* | ✅ appendEvent | — (append-only) | — |
| attendance_logs | ✅ getEmployeeLogs | ✅ checkIn | ✅ updateLog | — |
| leave_requests | ✅ getByEmployee | ✅ addRequest | ✅ updateStatus | — |
| leave_balances | ✅ getBalance | — | ✅ accrueLeave | — |
| loans | ✅ getByEmployee | ✅ createLoan | ✅ updateLoan | — |
| payslips | ✅ getByEmployee | ✅ issuePayslip | ✅ publishPayslip | — |
| payroll_runs | ✅ (via runs) | ✅ createDraftRun | ✅ lockRun | — |
| projects | ✅ (projects) | ✅ addProject | ✅ updateProject | ✅ deleteProject |
| tasks | ✅ getTasksFor* | ✅ addTask | ✅ updateTask | ✅ deleteTask |
| task_groups | ✅ getGroupById | ✅ addGroup | ✅ updateGroup | ✅ deleteGroup |
| announcements | ✅ getForEmployee | ✅ sendAnnouncement | — | ✅ deleteAnnouncement |
| text_channels | ✅ getForEmployee | ✅ createChannel | ✅ updateChannel | ✅ deleteChannel |
| timesheets | ✅ getByEmployee | ✅ computeTimesheet | ✅ approveTimesheet | — |
| audit_logs | ✅ getByEntity | ✅ log | — (append-only) | — |
| notification_logs | ✅ getByEmployee | ✅ addLog | — | ✅ clearLogs |

### Tables with NO Store Action Mapping
| Table | SQL Exists | Store Exists | Issue |
|-------|-----------|--------------|-------|
| kiosk_devices | ✅ | ❌ | kiosk.store only has settings, not device CRUD |
| qr_tokens | ✅ | ❌ | Generated client-side, not persisted to DB |
| gov_table_versions | ✅ | ❌ | No store for gov table management |

---

## Part 5: Action Plan Priority

### Immediate (This Sprint)
1. **Fix type system gaps** — Holiday, EmployeeDocument, Employee fields
2. **Fix loans timestamp** — Migration 016
3. **Write 7 missing store tests** — ~91 new test cases
4. **Create db-mappers.ts** — Object ↔ column conversion

### Next Sprint
5. **Create 12 service files** — Server action CRUD for all stores
6. **Refactor stores to dual-mode** — Demo vs Supabase branching
7. **Expand seed SQL** — Add entity INSERT statements for testing

### Future
8. **Component tests** — Critical UI flows (login, kiosk, attendance)
9. **E2E tests** — Full user journeys
10. **Performance** — Lazy-load stores, optimize queries

---

## Appendix: Files Changed in This Audit Session

| File | Change |
|------|--------|
| `src/services/auth.service.ts` | C1: Auth check in createUserAccount |
| `src/app/api/notifications/resend/route.ts` | C2: Auth guard |
| `src/store/auth.store.ts` | C3: Demo-only guard |
| `supabase/migrations/011_rls_policies.sql` | C4: RLS fixes, H8: scope fixes |
| `next.config.ts` | H1: Security headers |
| `src/middleware.ts` | H2: Path bypass fix, H7: env validation |
| `src/components/shell/topbar.tsx` | H4: Demo gate on role switcher |
| `.env.example` | H6: Env documentation |
| `src/lib/env.ts` | H7: Validated env accessors |
| `src/services/supabase-browser.ts` | H7: Use env.ts |
| `src/services/supabase-server.ts` | H7: Use env.ts |
| `supabase/migrations/014_add_missing_fk_constraints.sql` | H5: 20 FK constraints |
| `supabase/migrations/015_add_indexes_and_checks.sql` | M1+M3: Indexes + checks |
