# NexHRMS — Next Steps & Priority Fixes

> **Goal:** Make NexHRMS functional and usable for real users
> **Current State:** MVP feature-complete in demo mode | 286 tests passing | 0 compile errors | Build succeeds

---

## Quick Start — Testing the App Right Now

### Start the Dev Server
```bash
npm run dev
```
Open **http://localhost:3000** → Redirects to `/login`

### Demo User Credentials

| Role | Email | Password | Quick Login |
|------|-------|----------|-------------|
| **Admin** | admin@nexhrms.com | demo1234 | ✅ One-click button |
| **HR** | hr@nexhrms.com | demo1234 | ✅ One-click button |
| **Finance** | finance@nexhrms.com | demo1234 | ✅ One-click button |
| **Employee** | employee@nexhrms.com | demo1234 | ✅ One-click button |
| **Supervisor** | supervisor@nexhrms.com | demo1234 | ✅ One-click button |
| **Payroll Admin** | payroll@nexhrms.com | demo1234 | ✅ One-click button |
| **Auditor** | auditor@nexhrms.com | demo1234 | ✅ One-click button |

### How Sign-In Works
1. **Quick Login Buttons** — Click any role badge on the login page → auto-fills email + password `demo1234` → instant login
2. **Manual Login** — Type any demo email + `demo1234` into the form
3. **Role Switcher** — After login, use the role badge dropdown in the top bar to instantly switch between roles (no re-login needed)

### Environment Setup
The `.env.local` file controls the auth mode:
```env
NEXT_PUBLIC_DEMO_MODE=true          # ← Uses local Zustand login (no Supabase needed)
NEXT_PUBLIC_SUPABASE_URL=...        # Only needed when DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # Only needed when DEMO_MODE=false
```

When `DEMO_MODE=true`:
- No Supabase connection required
- All data lives in browser localStorage
- 7 pre-seeded demo accounts ready to use
- Role switcher visible in topbar

---

## Phase 1 — Critical Security Fixes (Do First)

These MUST be fixed before any deployment beyond localhost demo:

### 1.1 Auth Guard on `createUserAccount()` ✅ FIXED
**File:** `src/services/auth.service.ts`
**Status:** Already implemented — verifies caller profile role === 'admin' + password length ≥ 8.

### 1.2 Auth Guard on `/api/notifications/resend` ✅ FIXED
**File:** `src/app/api/notifications/resend/route.ts`
**Status:** Already implemented — checks `isDemoMode`, if not demo mode → verifies Supabase session.

### 1.3 Fix Overly-Permissive RLS INSERT Policies ✅ FIXED
**File:** `supabase/migrations/011_rls_policies.sql`
**Status:** Already fixed — all 4 INSERT policies now use proper checks:
- `attendance_events` → `is_own_employee(employee_id) OR is_admin_or_hr()`
- `attendance_evidence` → event ownership check + admin/hr
- `audit_logs` → `get_user_role() IN ('admin','hr','auditor')`
- `notification_logs` → `is_own_employee(employee_id) OR is_admin_or_hr()`

### 1.4 Fix `payslip.payrollBatchId` Never Set ✅ FIXED
**File:** `src/store/payroll.store.ts`
**Fix:** `createDraftRun()` now back-links all payslips in `payslipIds` with the run's `payrollBatchId`. Test added and passing.

---

## Phase 2 — Making It Production-Usable (Service Layer)

Currently all 19 stores read/write localStorage only. For real users, data must be persisted to Supabase.

### 2.1 Create Service Files (Server Actions)

Each service file uses `"use server"` and calls Supabase:

| # | Service File | Store It Backs | Priority |
|---|-------------|----------------|----------|
| 1 | `employees.service.ts` | employees.store | **HIGH** — core CRUD |
| 2 | `attendance.service.ts` | attendance.store | **HIGH** — daily use |
| 3 | `leave.service.ts` | leave.store | **HIGH** — daily use |
| 4 | `payroll.service.ts` | payroll.store | **HIGH** — money |
| 5 | `loans.service.ts` | loans.store | **MEDIUM** — financial |
| 6 | `projects.service.ts` | projects.store | **MEDIUM** |
| 7 | `tasks.service.ts` | tasks.store | **MEDIUM** |
| 8 | `messaging.service.ts` | messaging.store | **MEDIUM** |
| 9 | `timesheet.service.ts` | timesheet.store | **MEDIUM** |
| 10 | `notifications.service.ts` | notifications.store | **LOW** |
| 11 | `audit.service.ts` | audit.store | **LOW** |
| 12 | `settings.service.ts` | roles, appearance, kiosk, etc. | **LOW** |

**Pattern for each service:**
```typescript
"use server";
import { createServerSupabaseClient } from "@/services/supabase-server";

export async function getEmployees() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("employees").select("*");
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, data };
}
```

### 2.2 Refactor Stores to Dual-Mode

Each store action checks `NEXT_PUBLIC_DEMO_MODE`:

```typescript
addEmployee: async (emp) => {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    // Current Zustand localStorage logic (unchanged)
    set({ employees: [...get().employees, emp] });
  } else {
    // Call Supabase service
    const result = await createEmployee(emp);
    if (result.ok) set({ employees: [...get().employees, result.data] });
    else toast.error(result.error);
  }
}
```

### 2.3 Create `db-mappers.ts`

Handle TS ↔ SQL shape differences:
- `Project.location: {lat, lng, radius}` ↔ `location_lat, location_lng, location_radius` columns
- `AttendanceLog.locationSnapshot: {lat, lng}` ↔ `location_lat, location_lng` columns
- `Timesheet.segments: TimesheetSegment[]` ↔ `segments jsonb` column

---

## Phase 3 — Schema & Data Fixes

### 3.1 SQL Fixes Needed

| # | Fix | Migration File |
|---|-----|---------------|
| 1 | Change `attendance_logs.check_in/check_out` from `text` to `timestamptz` | New migration needed |
| 2 | Add `updated_at` triggers to ~30 mutable tables | New migration needed |
| 3 | Hash `employees.pin` with pgcrypto instead of plaintext | New migration needed |

### 3.2 Missing Store Actions

| Store | Missing | Needed For |
|-------|---------|-----------|
| kiosk.store | Device CRUD (`kiosk_devices` table exists but no store actions) | Kiosk device management |
| kiosk.store | QR token generation (`qr_tokens` table exists) | QR code kiosk mode |
| — | Gov table management (`gov_table_versions` table) | SSS/PhilHealth rate updates |

### 3.3 Expand SQL Seed Data

Currently `012_seed_data.sql` only seeds config data (gov tables, holidays). For production:
- Seed sample employees for testing
- Seed sample attendance records
- Seed sample leave balances

---

## Phase 4 — Middleware & Routing Fixes

### 4.1 Rename `middleware.ts` → `proxy.ts` [LOW]
Next.js 16 deprecated the `middleware` file convention in favor of `proxy`. Currently shows a deprecation warning during build. Non-breaking but should be addressed.

### 4.2 Input Validation Middleware [MEDIUM]
No request body validation exists. Add Zod schemas for API routes:
```typescript
import { z } from "zod";
const ResendSchema = z.object({
  notificationId: z.string().uuid(),
});
```

### 4.3 Rate Limiting [MEDIUM]
No rate limiting on login or API routes. Add progressive delay after failed login attempts.

### 4.4 CSRF Protection [MEDIUM]
No CSRF tokens on forms. Consider using Next.js built-in CSRF patterns or a library.

---

## Phase 5 — Testing Expansion

| Type | Current | Target | Priority |
|------|---------|--------|----------|
| Feature unit tests | 286 ✅ | 286 | Done |
| Component tests | 0 | ~50 | **HIGH** — Login, kiosk, attendance, payroll UI |
| API route tests | 0 | ~10 | **MEDIUM** — notification resend + future routes |
| E2E tests (Playwright) | 0 | ~30 | **MEDIUM** — Critical user journeys |
| Service layer tests | 0 | ~60 | **HIGH** — When services are created |

### Key E2E Test Scenarios
1. Login → Dashboard → Navigate all pages
2. Employee: Create → Edit → Salary change → Approve
3. Attendance: Check-in → Check-out → View log
4. Leave: Request → Approve → Check balance
5. Payroll: Create run → Add payslips → Lock → Publish
6. Loan: Create → Deductions → Settlement

---

## Phase 6 — Production Hardening

### 6.1 Environment & Config
- [ ] Create proper `.env.production` template
- [ ] Add env validation at startup (fail fast on missing vars)
- [ ] Configure `SUPABASE_SERVICE_ROLE_KEY` for admin operations

### 6.2 Performance
- [ ] Lazy-load heavy stores (attendance, payroll have large state)
- [ ] Add localStorage size caps for append-only stores (events, audit, pings)
- [ ] Auto-purge old data in demo mode (localStorage has 5-10MB limit)

### 6.3 Deployment
- [ ] Set up Vercel/Netlify deployment
- [ ] Configure Supabase production project
- [ ] Run all 16 migrations on production DB
- [ ] Set `NEXT_PUBLIC_DEMO_MODE=false` for production
- [ ] Verify all RLS policies work correctly

### 6.4 Monitoring
- [ ] Add error reporting (Sentry or similar)
- [ ] Add performance monitoring
- [ ] Configure Supabase alerts for auth failures

---

## Priority Order Summary

| Priority | Phase | What | Impact |
|----------|-------|------|--------|
| **P0** | Phase 1 | Security fixes (auth guards, RLS) | Blocks any deployment |
| **P1** | Phase 2.1 | Employee + Attendance + Leave + Payroll services | Core daily operations |
| **P2** | Phase 2.2 | Dual-mode store refactoring | Connects frontend → backend |
| **P3** | Phase 3.1 | SQL schema fixes | Data integrity |
| **P4** | Phase 5 | Component + E2E tests | Quality assurance |
| **P5** | Phase 4 | Middleware fixes (validation, rate limiting) | Production safety |
| **P6** | Phase 6 | Deployment + monitoring | Go-live readiness |

---

## What Works Right Now (Demo Mode)

Everything below is fully functional for demo/presentation:

- **Sign-in**: 7 one-click quick login buttons + manual email/password + role switcher in topbar
- **Employee Management**: Full CRUD with salary governance (propose → approve/reject)
- **Attendance**: Kiosk (Face/PIN/QR/NFC), check-in/out, exception handling, overtime
- **Leave**: Request → Approve/Reject, 6 PH-compliant leave types, balance tracking
- **Payroll**: Payslips, batch runs (Draft → Locked → Published), 13th month, final pay
- **Loans**: SSS/Pag-IBIG/Company loans, amortization, cap-aware deductions
- **Projects & Tasks**: Project CRUD, task groups, completion reports, comments
- **Messaging**: Announcements (scoped), channels, direct messages
- **Notifications**: 15 rule types, multi-channel dispatch
- **Timesheets**: Computation with night differential, overtime rules
- **Reports**: Government reports (SSS, PhilHealth, Pag-IBIG, BIR)
- **Settings**: 12 sub-pages (roles, appearance, branding, modules, page-builder, etc.)
- **Custom Pages**: Dynamic page creation with widgets
- **RBAC**: 7 roles, 60+ permissions, role-dispatched views on every page
- **Mobile**: Fully responsive UI

---

## File Reference

| Document | Description |
|----------|------------|
| `NEXT_STEPS.md` | This file — actionable next steps |
| `PROGRESS.md` | Full progress report with metrics |
| `FULLSTACK_AUDIT.md` | Backend ↔ frontend alignment audit |
| `IMPROVEMENTS.md` | Detailed issue audit (31 findings) |
| `.env.local` | Current environment config (demo mode ON) |
| `.env.example` | Template for new developers |
