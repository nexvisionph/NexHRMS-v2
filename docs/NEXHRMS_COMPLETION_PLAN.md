# NexHRMS Feature Completion Plan
**Date:** 2026-06-26 | **Prepared by:** Kiro (Senior Engineering Planner)
**Repo:** NexHRMS-v2 | **Branch:** main | **Stack:** Next.js 15, TypeScript, Supabase, Jest, Playwright

> **Quick links to separated documents:**
> - 📋 [Roadmap](./docs/ROADMAP.md) — Phased plan with ticket dependencies
> - 📊 [Progress Tracker](./docs/PROGRESS.md) — Live ticket status, update this daily
> - 📝 [PR Guidelines](./docs/PR_GUIDELINES.md) — Branch naming, commit format, PR template

---

---

## Executive Decision

**Recommended path: Option C — Partial Stabilization First, Then Feature Completion**

**Reason:**

The CI pipeline currently passes lint, typecheck, and unit tests, and the E2E fix we just applied resolves the last known failure. However, two structural problems exist that will cause silent corruption or blocked development if ignored:

1. **Migration numbering collision** — There are duplicate migration numbers (001, 002, 003, 009, 010, 012, 013, 014, 015, 016, 017, 065, 066). Supabase applies migrations in filename order. Duplicate numbers mean execution order is non-deterministic depending on alphabetical sort — a critical schema consistency risk.
2. **Payroll engine is not connected to the review layer** — The OT records and Payroll Rules tables exist and are populated, but `payroll-computation-engine.ts` ignores both. This means the entire review layer is cosmetic in production — payroll runs bypass it entirely.

These two issues must be resolved before feature work can be trusted. Everything else (Attendance Review stub, strict geofence, attendance summaries) can be built in parallel once the foundation is confirmed stable.

**What must stabilize first:**
- Migration ordering and collision audit
- Baseline CI/CD green confirmation (all 5 jobs passing)
- Confirmation that payroll engine integration is the first feature ticket

**What can proceed in parallel:**
- Attendance summaries table migration (additive, no existing code dependencies)
- Payroll Rules Settings UI (pure frontend, no risk to existing computation)
- Attendance Review API and UI completion (new route, no existing breakage risk)

**What must be blocked until stabilization is complete:**
- Any PR touching `payroll-computation-engine.ts`
- Any migration with a number that collides with an existing file


---

## Current System Verification Matrix

| Area | Current Status | Evidence From Codebase | Risk | Required Action |
|---|---|---|---|---|
| **CI/CD Pipeline** | ✅ Passing (after today's E2E fix) | `.github/workflows/ci-main.yml` — lint → typecheck → test → build → e2e → deploy (dummy) | Medium | Add branch protection rules; deployment step is dummy (echo only) |
| **TypeScript** | ✅ Passing | `npm run typecheck` in CI; no reported errors | Low | None |
| **Lint** | ✅ Passing (198 warnings, 0 errors) | ESLint config, stale directives fixed this week | Low | Warnings are non-blocking; clean up gradually |
| **Build** | ✅ Passing | CI build job passes | Low | None |
| **Unit Tests (Jest)** | ✅ 621/622 passing | `test:ci` in CI; flaky attendance test fixed | Low | Add tests for OT computation and payroll rules engine |
| **E2E Tests (Playwright)** | ✅ 2/2 passing (after today's fix) | `e2e/login.spec.ts` — hydration fix applied | Low | Add E2E tests for OT review and payroll finalization |
| **Supabase Migrations** | ⚠️ Collision Risk | Duplicate numbers: 001, 002, 003, 009, 010, 012, 013, 014, 015, 016, 017, 065, 066 | **HIGH** | Audit all duplicates; rename to sequential non-conflicting order |
| **RLS Policies** | ✅ Present | Policies defined in 065, 066, 067 and `011_rls_policies.sql` | Medium | No migration CI check validates RLS — manual verification needed |
| **Payroll Computation Engine** | ❌ Not connected to review layer | `admin-view.tsx` imports `computePayroll` from `payroll-computation-engine.ts`; engine uses hardcoded `MULTIPLIERS` constant; never reads `payroll_rules` or `ot_records` | **CRITICAL** | Wire engine to read payroll rules from DB and approved OT from `ot_records` |
| **OT Review Backend** | ✅ Complete | `065_ot_review_layer.sql`, `/api/overtime-review`, `useOTReviewStore`, `ot-computation.ts` | Low | None — backend is production-ready |
| **OT Review UI** | ✅ Complete | `payroll/overtime-review/page.tsx` + `_views/ot-review-view.tsx` | Low | None — UI is production-ready |
| **Payroll Lock Guard (Pending OT)** | ❌ Not wired | `getPendingCountForPeriod` exists in store but not called by `admin-view.tsx` | High | Wire into payroll finalization/lock flow |
| **Payroll Rules Backend** | ✅ Complete | `066_payroll_rules_engine.sql`, `/api/payroll-rules`, `usePayrollRulesStore` | Low | None — backend is production-ready |
| **Payroll Rules UI** | ❌ Missing | `usePayrollRulesStore` imported nowhere in any `.tsx` file; no settings screen exists | High | Build Settings UI under `payroll/settings` |
| **Mobile Attendance API** | ✅ Complete | `/api/attendance/mobile/route.ts` — GPS, geofence, selfie, evidence insert | Low | Strict mode TODO remains |
| **Geofence Logic** | ✅ Complete (flexible mode only) | `src/lib/geofence.ts` — Haversine, two overloads | Medium | Implement strict mode flag |
| **Biometric Integration** | ✅ Complete | `/api/biometric/*`, UI pages, T800 route, `027_biometric_integration.sql` | Low | None |
| **Attendance Review UI** | ❌ Stub only | `attendance/review/page.tsx` — empty table, no fetch, no API | High | Implement `/api/attendance/review` + complete UI |
| **Attendance Summaries** | ❌ Missing | No `attendance_summaries` table in any migration | High | Create `068_attendance_summaries.sql` + generation service |
| **Multi-source Reconciliation** | ❌ Missing | No logic to merge biometric + mobile logs on same day | Medium | Implement reconciliation rules in summary generation service |
| **Payroll Finalization Flow** | ⚠️ Partial | `lockRunDbFirst`, `endRunDbFirst` exist in `payroll-actions.service` but no pending OT check before lock | High | Add pending OT guard before run locking |
| **Payslip OT Breakdown** | ⚠️ Partial | Payslip shows total OT pay but no type breakdown (Regular/Rest Day/Holiday) | Medium | Add breakdown section using approved `ot_records` |
| **Audit Logs (OT)** | ✅ Complete | `ot_audit_logs` table + SYSTEM writes on compute, approve, reject | Low | None |
| **Audit Logs (Payroll Rules)** | ✅ Complete | `payroll_rules_audit_logs` + field-level granular writes in `/api/payroll-rules` PATCH | Low | None |
| **location_lat/location_lng columns** | ⚠️ Schema Drift | Written by mobile route at runtime but not in any migration | Medium | Add formal migration `069_attendance_location_columns.sql` |
| **`eslint.config.mjs` / `.eslintignore`** | ⚠️ Deprecation warning | `.eslintignore` deprecated in ESLint v9+ | Low | Migrate to `ignores` property in `eslint.config.mjs` in next cleanup pass |


---

## Stabilization Plan

### What Must Be Stabilized First (blocks feature work)

**1. Migration Collision Audit (NHRMS-STAB-004)**
The following migration numbers have two files each:
`001, 002, 003, 009, 010, 012, 013, 014, 015, 016, 017, 065, 066`

When Supabase applies migrations in order, duplicate numbers are sorted alphabetically within that number — leading to non-deterministic schema construction depending on the environment. This must be audited and a canonical ordering confirmed.

Action: Create a `MIGRATION_ORDER.md` documenting the intended execution sequence. For new migrations, always use the next available sequential number.

**2. Baseline CI Confirmation (NHRMS-STAB-001 + STAB-002)**
After today's E2E fix, push to main and confirm all 5 jobs pass green. Capture the run URL as the baseline record. No feature work merges until this baseline is confirmed.

### What Can Proceed in Parallel

- `NHRMS-ATT-001` — `attendance_summaries` migration (additive, no dependencies on broken payroll logic)
- `NHRMS-PAYRULE-001` — Payroll Rules Settings UI (pure frontend, no computation changes)
- `NHRMS-ATT-003` — Attendance Review API (new route, zero risk to existing code)
- `NHRMS-ATT-006` — Formal migration for `location_lat`/`location_lng` (additive ALTER TABLE)

### What Must Be Blocked Until Stabilization Is Complete

- Any PR touching `payroll-computation-engine.ts` (NHRMS-OT-001, NHRMS-PAYRULE-003/004 depend on the engine)
- Any new migration file that collides with an existing number


---

## Feature Completion Roadmap

| Phase | Goal | Owner | Tickets | Exit Criteria |
|---|---|---|---|---|
| **Phase 0** | Baseline Stabilization | Senior Dev | STAB-001 → STAB-005 | ✅ Complete |
| **Phase 1A** | Payroll Rules Settings UI | Intern 1 | PAYRULE-001, PAYRULE-002 | ✅ Complete |
| **Phase 1B** | Attendance Summaries Migration + API | Intern 2 | ATT-001, ATT-002, ATT-006 | ✅ Complete |
| **Phase 1C** | Attendance Review API + UI | Intern 3 | ATT-003, ATT-004 | ✅ Complete |
| **Phase 2A** | Payroll Rules Engine Integration | Senior Dev | PAYRULE-003, PAYRULE-004 | ✅ Complete |
| **Phase 2B** | OT Review → Payroll Integration | Senior Dev | OT-001, OT-003, OT-004 | ✅ Complete |
| **Phase 2C** | Payroll Pending OT Guard | Senior Dev + Intern 1 | OT-002 | ✅ Complete |
| **Phase 3A** | Payslip OT Breakdown | Intern 2 | OT-005 | ✅ Complete |
| **Phase 3B** | Strict Geofence Mode | Intern 3 | ATT-005 | ✅ Complete |
| **Phase 3C** | Multi-Source Reconciliation | Senior Dev | ATT-007 | ✅ Complete |
| **Phase 3D** | Custom Philippine Payroll & Workflow Stabilization | Senior Dev | PAY-001, PAY-002, PAY-003 | ✅ Complete |
| **Phase 4A** | Compliance Mode Warning + Audit Verification | Intern 1 / 3 | PAYRULE-005, PAYRULE-006 | ✅ Complete |
| **Phase 4B** | QA Regression | QA Intern | QA-001 → QA-006 | All QA scenarios pass; no payroll regression; CI green |
| **Phase 5** | Production Readiness | Senior Dev | REL-001, REL-002 | Branch protection; real deploy; env vars verified; rollback plan |


---

## Ticket Backlog

### Stabilization

**NHRMS-STAB-001** — Verify CI/CD pipeline and branch protection
- Confirm all 5 jobs pass on latest main commit
- Record CI run URL as baseline
- Verify branch protection rules exist on GitHub (require PR, require CI pass)
- If branch protection missing, configure it

**NHRMS-STAB-002** — Run full baseline build, lint, typecheck, and tests locally
- `npm run lint`, `npm run typecheck`, `npm run test:ci`, `npm run build`
- Document any new failures not caught by CI
- Record pass/fail for each command

**NHRMS-STAB-003** — Fix any blocking test failures before feature continuation
- Depends on STAB-002 output
- No feature tickets merge until test suite is clean

**NHRMS-STAB-004** — Audit Supabase migration consistency and schema drift
- List all migration files and identify duplicate numbers
- Create `MIGRATION_ORDER.md` with intended execution sequence
- Add rule: all new migrations must use next available sequential number
- Confirm `location_lat`/`location_lng` are formally migrated

**NHRMS-STAB-005** — Document current baseline status
- Produce one-page status doc: what passes, what's wired, what's a stub
- Share with team before Phase 1 begins

---

### Overtime Review

**NHRMS-OT-001** — Connect payroll computation to approved OT records
- Modify `payroll-computation-engine.ts` to accept `approvedOtRecords: OTRecord[]` parameter
- Replace inline OT computation with lookup against approved/partially_approved records
- Use `approved_ot_hours` and `approved_amount` instead of computing from attendance
- `admin-view.tsx` must fetch OT records before calling `computePayrollEngine`

**NHRMS-OT-002** — Add pending OT guard before payroll finalization
- In `admin-view.tsx` lock/finalize flow, call `getPendingCountForPeriod(periodStart, periodEnd)`
- If count > 0, show AlertDialog with count, "Review Pending OT" button (navigates to overtime-review), and "Proceed Without Pending OT" button
- On proceed, write audit log entry: `{ action: 'proceeded_without_pending_ot', pendingCount, performedBy }`

**NHRMS-OT-003** — Ensure approved/partially_approved OT only is included in payroll
- In `/api/overtime-review` POST compute route, load `payroll_rules` and pass to `computeOTRecords`
- In payroll computation, filter: `status IN ('approved', 'partially_approved')`
- Add integration test: pending and rejected OT must not appear in computed payroll totals

**NHRMS-OT-004** — Add OT inclusion audit logs
- When `markIncludedInPayroll` runs, write `ot_audit_logs` entries with `action: 'included_in_payroll'`
- Include `payroll_run_id` in the new_value jsonb
- Verify audit log is readable from the OT Review UI

**NHRMS-OT-005** — Add payslip OT breakdown
- Extend `PayslipLineItem` to optionally hold OT type label and hours
- On payslip render, if OT records exist for the period, show breakdown: Regular OT, Rest Day OT, Holiday OT
- Controlled by a settings flag (show breakdown: on/off)

---

### Payroll Rules Engine

**NHRMS-PAYRULE-001** — Build Payroll Rules Settings UI
- Add "Payroll Rules" tab to `payroll/settings/page.tsx`
- Sections: Compliance Mode selector, OT Multipliers (5 fields), Night Differential, Thresholds, Review Gates, Work Days Divisor
- Read initial values from `usePayrollRulesStore`

**NHRMS-PAYRULE-002** — Wire `usePayrollRulesStore` to settings page
- Import and call `fetchRules()` on mount
- Connect all form fields to `updateRules()`
- Compliance mode switch to 'custom' triggers confirmation modal before submit

**NHRMS-PAYRULE-003** — Remove hardcoded payroll multipliers from computation engine
- Delete the `MULTIPLIERS` constant block from `payroll-computation-engine.ts`
- Replace with a `rules: PayrollRules` parameter passed in from the caller
- Ensure all multiplier lookups go through `rules.regularOtMultiplier`, etc.
- Add `DOLE_PH_DEFAULTS` as fallback when rules param is null/undefined

**NHRMS-PAYRULE-004** — Inject payroll rules into computation engine
- In `admin-view.tsx`, fetch rules via `usePayrollRulesStore.fetchRules()` before computing payroll
- Pass `rules` to `computePayrollEngine(...)` call
- Verify: changing multiplier in settings changes computed OT pay without code change

**NHRMS-PAYRULE-005** — Add compliance mode warning and audit verification
- Confirm UI modal text matches spec word for word
- Confirm that switching to 'custom' writes to `payroll_rules_audit_logs` with old/new value
- Confirm that switching back to 'ph_dole' also writes audit log
- Manual QA: check audit log table after mode switch

**NHRMS-PAYRULE-006** — Add tests for DOLE Standard vs Custom Company Policy
- Unit test: `computeOTRecords` with DOLE rules → assert 1.25x multiplier
- Unit test: `computeOTRecords` with custom rules (1.00x) → assert no premium
- Unit test: `computeOTRecords` with null rules → assert falls back to DOLE defaults
- Unit test: `deriveOTStatus` for all three cases (approved, partial, rejected)

---

### Attendance

**NHRMS-ATT-001** — Create `attendance_summaries` migration (`068_attendance_summaries.sql`)
- Fields: id, company_id, employee_id, attendance_date, scheduled_shift_id, first_clock_in, last_clock_out, total_work_hours, late_minutes, undertime_minutes, overtime_minutes, night_diff_minutes, attendance_status, attendance_source_summary, approved_by, approved_at, created_at, updated_at
- RLS: admin/hr/payroll_admin full access; supervisor read own department; employee read own
- Index on (employee_id, attendance_date)

**NHRMS-ATT-002** — Build attendance summary generation service
- `/api/attendance/summaries/generate` (POST) — accepts date range + employee filter
- Reads from `attendance_logs` + `attendance_events` after review approval
- Applies multi-source reconciliation (configurable: prefer biometric, prefer mobile, prefer earliest)
- Creates/updates rows in `attendance_summaries`
- Called by HR after completing Attendance Review for a period

**NHRMS-ATT-003** — Implement `/api/attendance/review` route
- GET with filters: date range, department, employee, source, status, outside_geofence, missing_clock_out
- Joins `attendance_logs`, `attendance_events`, `attendance_evidence`, `employees`
- Returns: employee_name, date, clock_in, clock_out, source, gps coordinates, selfie_url, distance_from_location_meters, is_within_geofence, status
- PATCH for approve/reject/edit/add-remarks actions

**NHRMS-ATT-004** — Complete Attendance Review UI
- Wire `useEffect` to call `/api/attendance/review` with filter params
- Add filter bar: date range, department, source dropdown, status dropdown
- Implement Approve/Reject/Edit/Remarks action buttons
- Add selfie thumbnail preview in table
- Add map link for GPS coordinates

**NHRMS-ATT-005** — Implement strict geofence mode
- Add `geofence_mode: 'strict' | 'flexible'` to mobile attendance settings
- In `/api/attendance/mobile/route.ts`, if `geofence_mode === 'strict'` and `isGeofencePass === false`, return `{ ok: false, error: 'Outside allowed work location', distanceMeters }` with status 403
- Settings configurable in Admin → Attendance → Mobile Attendance

**NHRMS-ATT-006** — Add formal migration for attendance location columns (`069_attendance_location_columns.sql`)
- `ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS location_lat double precision`
- `ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS location_lng double precision`
- Add index on `(location_lat, location_lng)` for map queries

**NHRMS-ATT-007** — Implement biometric/mobile/web/manual reconciliation rules
- Configurable priority: `biometric > mobile_gps > web > manual` (admin can reorder)
- When generating attendance summary, if multiple sources exist for same employee+date, apply priority rule
- Flag conflicts in `attendance_summaries.attendance_source_summary` (e.g., `"biometric+mobile_gps"`)
- Conflicts visible in Attendance Review screen

---

### QA / Release

**NHRMS-QA-001** — Create QA test matrix (see QA Test Plan section below)

**NHRMS-QA-002** — Test OT approval to payroll inclusion (regression)

**NHRMS-QA-003** — Test payroll rules mode switching

**NHRMS-QA-004** — Test mobile attendance geofence scenarios

**NHRMS-QA-005** — Test biometric + mobile same-day reconciliation

**NHRMS-QA-006** — Regression test payroll finalization and payslip output

**NHRMS-REL-001** — Production readiness checklist (see Release section below)

**NHRMS-REL-002** — Deployment and rollback plan


---

## Team Assignment Plan

| Person | Responsibility | Suitable Tickets | Review Requirement |
|---|---|---|---|
| **Senior Developer / Project Lead** | Architecture owner; all payroll computation changes; final code review; merge approval; migration schema decisions | STAB-001 → 005, OT-001, OT-002, OT-003, OT-004, PAYRULE-003, PAYRULE-004, ATT-007, REL-001, REL-002 | Self-reviews; no merge without CI green |
| **Developer Intern 1** | Payroll Rules Settings UI; compliance mode modal; wiring store to UI; OT payslip breakdown | PAYRULE-001, PAYRULE-002, PAYRULE-005, OT-005 | Senior dev must review all payroll-touching PRs before merge |
| **Developer Intern 2** | Database migrations (additive only); attendance summaries table + generation service; location columns migration | ATT-001, ATT-002, ATT-006 | Senior dev must review all migration PRs; no DROP or ALTER non-additive without senior sign-off |
| **Developer Intern 3** | Attendance Review API + UI; strict geofence mode; unit tests for computation engine | ATT-003, ATT-004, ATT-005, PAYRULE-006 | Senior dev reviews API routes; QA intern verifies UI behavior |
| **QA Intern** | QA test matrix; manual scenario testing; CI validation reports; regression testing; E2E test additions | QA-001 → QA-006, STAB-002 (baseline test run), STAB-005 (document results) | All QA reports reviewed by Senior Dev before release |

**Critical Rules for Interns:**
- Interns do **not** own `payroll-computation-engine.ts` — read-only for reference only
- Interns do **not** merge their own PRs — all merges require Senior Dev approval
- Interns do **not** write migrations with DROP, TRUNCATE, or non-additive ALTER — escalate to Senior Dev
- Intern 2 works from a migration template provided by Senior Dev for each new SQL file


---

## PR Guidelines

### Branch Naming

```
feature/<ticket-id>-short-description
fix/<ticket-id>-short-description
chore/<ticket-id>-short-description
test/<ticket-id>-short-description
docs/<ticket-id>-short-description
```

**Examples:**
```
feature/NHRMS-OT-001-approved-ot-payroll-integration
feature/NHRMS-PAYRULE-001-payroll-rules-settings-ui
fix/NHRMS-ATT-006-attendance-location-schema-drift
test/NHRMS-QA-002-ot-payroll-regression-tests
docs/NHRMS-STAB-005-baseline-stability-status
```

---

### Commit Message Format

```
<type>(<ticket-id>): <short summary>
```

**Allowed types:** `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `ci`

**Examples:**
```
feat(NHRMS-OT-001): use approved OT records in payroll computation
fix(NHRMS-ATT-006): add missing attendance location columns migration
test(NHRMS-QA-002): add OT approval payroll inclusion regression
docs(NHRMS-STAB-005): document baseline stability status
refactor(NHRMS-PAYRULE-003): remove hardcoded multipliers from computation engine
chore(NHRMS-STAB-001): configure branch protection rules on main
ci(NHRMS-STAB-001): add migration lint check to CI pipeline
```

---

### PR Title Format

```
[<ticket-id>] <Clear PR Title>
```

**Examples:**
```
[NHRMS-OT-001] Connect Approved Overtime to Payroll Computation
[NHRMS-PAYRULE-001] Add Payroll Rules Settings UI
[NHRMS-ATT-003] Implement Attendance Review API
[NHRMS-STAB-004] Audit and Document Migration Execution Order
```

---

### PR Description Template

````md
## Ticket

Ticket ID: `<ticket-id>`

## Summary

Describe what changed and why.

## Scope

- [ ] Backend
- [ ] Frontend
- [ ] Database / Migration
- [ ] RLS / Security
- [ ] Tests
- [ ] Documentation
- [ ] CI/CD

## Changes Made

-
-
-

## Validation Performed

- [ ] TypeScript passed (`npm run typecheck`)
- [ ] Lint passed (`npm run lint`)
- [ ] Build passed (`npm run build`)
- [ ] Unit tests passed (`npm run test:ci`)
- [ ] Integration tests passed (if applicable)
- [ ] Migration verified (reviewed SQL, confirmed additive-only)
- [ ] RLS verified (tested with each affected role)
- [ ] Manual QA completed

Commands run:

```bash
# paste commands and output here
```

## Screenshots / Evidence

Attach screenshots, logs, or terminal output where applicable.

## Risk Level

- [ ] Low — UI only or additive migration, no logic change
- [ ] Medium — new API route, additive feature, new store
- [ ] High — payroll computation change, migration with ALTER/DROP, auth/RLS change

Explain risk:

## Rollback Plan

Explain how to safely revert this PR if needed.
(For migrations: write the matching rollback SQL. For computation changes: identify the last known-good commit hash.)

## Notes For Reviewer

Mention anything the reviewer must inspect carefully.
````

---

### PR Review Rules

1. No PR without a ticket ID in the title.
2. No direct commits to `main` — all changes via PR.
3. No payroll-computation PR can be merged without Senior Developer approval.
4. No migration PR can be merged without schema review by Senior Developer.
5. No feature PR can be merged if CI/CD is failing — all 5 jobs must be green.
6. No UI-only approval for payroll features — backend and test evidence are required.
7. Every payroll-impacting PR must include unit test coverage for the changed logic.
8. Every attendance-impacting PR must include edge-case testing (missing clock-out, outside geofence, same-day biometric+mobile).
9. Every RLS or auth change must include a security validation note documenting which roles were tested.
10. Every PR must include a rollback plan — for migrations this means the DROP/ALTER COLUMN undo SQL.


---

## CI/CD Verification Findings

### Provider
GitHub Actions — `.github/workflows/ci-main.yml`

### Trigger Branches
`push` and `pull_request` on `main` only. **No other branches are covered.** Feature branches developed by interns get no CI until they open a PR to `main`.

### Jobs and Commands

| Job | Command | Status |
|---|---|---|
| Lint | `npm run lint` (ESLint v9) | ✅ Passing |
| Typecheck | `npm run typecheck` (tsc --noEmit) | ✅ Passing |
| Test | `npm run test:ci` (Jest, coverage, lcov) | ✅ Passing |
| Build | `npm run build` (Next.js production build) | ✅ Passing |
| E2E | `npm run e2e` (Playwright, Chromium only) | ✅ Passing (after today's fix) |
| Deploy | `echo "Simulating deployment..."` | ⚠️ Dummy only — not a real deployment |

### Environment Variables
E2E job now has `NEXT_PUBLIC_DEMO_MODE=true` and placeholder Supabase values — confirmed by today's fix. Other jobs (lint, typecheck, test, build) have no env vars set. Build job works because `NEXT_PUBLIC_SUPABASE_URL` is only required at runtime in client code, not at Next.js build time for server components.

### What's Missing / Recommended Improvements

**1. No migration validation in CI**
There is no step that validates migration file syntax or ordering. A duplicate-numbered migration file would be silently accepted.
→ Add a `chore/ci` step: `ls supabase/migrations | sort | uniq -d` — fails CI if duplicate numbers found.

**2. Deploy job is a dummy**
The `deploy` job only echoes "Success!" — it does not deploy anywhere.
→ Once a deployment target is decided (Vercel, Railway, etc.), replace with real deploy step gated on `needs: e2e`.

**3. No branch protection rules configured**
The workflow runs on PRs but GitHub branch protection (require CI pass before merge) is not confirmed in the repo settings — it must be configured manually in GitHub repo settings.
→ Configure: Settings → Branches → Add rule for `main` → Require status checks (all 5 jobs) → Require PR before merging.

**4. E2E only tests login flow**
Two tests: redirect to login, and login form renders. No E2E tests for OT review, payroll computation, or attendance.
→ Add E2E tests in Phase 4B for critical paths.

**5. No coverage threshold enforcement**
`test:ci` generates coverage but no minimum threshold is configured in Jest config.
→ Add `coverageThreshold` in `jest.config.ts` once baseline coverage is measured.

**6. No Playwright multi-browser**
Only Chromium is configured. For production readiness, add Firefox.
→ Low priority; add in Phase 5.

**Current Pipeline Assessment:** Adequate for development and basic regression. Not sufficient for payroll/attendance production readiness without the migration validation step and real deployment.


---

## QA Test Plan

### OT Review to Payroll Integration

| Scenario | Input | Expected Result | Pass Criteria |
|---|---|---|---|
| Full approval flows to payroll | Computed OT = 3h, Approved OT = 3h | Payslip shows 3h OT pay at correct multiplier | `approved_ot_hours = 3`, `status = 'approved'`, payslip OT line matches |
| Partial approval flows to payroll | Computed OT = 3h, Approved OT = 2h | Payslip shows 2h OT only, not 3h | `approved_ot_hours = 2`, `status = 'partially_approved'`, payslip OT ≠ computed |
| Rejected OT excluded from payroll | Computed OT = 3h, Approved OT = 0h | Payslip has no OT line | `status = 'rejected'`, OT pay = 0 |
| Pending OT does not appear in payslip | OT in 'pending' status | Payslip excludes it | OT pay = 0 for pending records |
| Payroll finalization guard — pending OT exists | Lock run attempted, 2 pending OT records exist | Warning dialog appears with count = 2 | AlertDialog shown, "Review Pending OT" and "Proceed Without" buttons visible |
| Proceed without pending OT | Admin clicks "Proceed Without" | Run locks, pending OT excluded, audit log written | `ot_audit_logs` has `action = 'proceeded_without_pending_ot'` entry |
| OT breakdown on payslip | 2h Regular OT + 1h Rest Day OT approved | Payslip shows breakdown by type | Two line items: Regular OT (2h), Rest Day OT (1h) |

---

### Payroll Rules Engine

| Scenario | Input | Expected Result | Pass Criteria |
|---|---|---|---|
| DOLE Standard mode — Regular OT | 3h OT, hourly rate ₱100 | OT pay = ₱375 (100 × 3 × 1.25) | Computed amount = 375.00 |
| DOLE Standard mode — Rest Day OT | 3h OT, hourly rate ₱100 | OT pay = ₱390 (100 × 3 × 1.30) | Computed amount = 390.00 |
| DOLE Standard mode — Regular Holiday OT | 3h OT, hourly rate ₱100 | OT pay = ₱600 (100 × 3 × 2.00) | Computed amount = 600.00 |
| Custom mode — multiplier 1.00 (no premium) | 3h OT, hourly rate ₱100, multiplier = 1.00 | OT pay = ₱300 (100 × 3 × 1.00) | Computed amount = 300.00 |
| Switch to Custom mode — no confirmation | Admin clicks Custom without confirming | 409 response returned, UI shows modal | API returns `requiresConfirmation: true` |
| Switch to Custom mode — with confirmation | Admin confirms modal | Mode changes to 'custom', audit log written | `payroll_rules_audit_logs` has entry for `compliance_mode` change |
| Night differential enabled | Checkout at 23:00, NDiff multiplier 1.10 | OT classified as `night_differential` | OT type = night_differential, multiplier = 1.10 |
| Night differential disabled | `enableNightDiff = false` | No NDiff classification, falls to regular | OT type = regular |
| Rules change reflected in next payroll | Admin changes `regular_ot_multiplier` to 1.30, run payroll | New payroll uses 1.30, not 1.25 | Computed amount reflects new multiplier |

---

### Mobile Attendance + Geofencing

| Scenario | Input | Expected Result | Pass Criteria |
|---|---|---|---|
| Valid GPS clock-in inside geofence | GPS within 50m of assigned location | Clock-in accepted, `status = 'present'` | `attendance_logs.status = 'present'`, `isGeofencePass = true` |
| GPS accuracy too low | `gpsAccuracyMeters > 50` | Warning returned (or flagged if strict) | Client shows accuracy warning |
| Outside geofence — flexible mode | GPS 200m from assigned location, flexible mode | Clock-in accepted, `status = 'pending_review'` | `attendance_logs.attendance_status = 'pending_review'`, `isGeofencePass = false` |
| Outside geofence — strict mode | GPS 200m from assigned location, strict mode | Clock-in rejected with 403 | API returns `{ ok: false, error: 'Outside allowed work location' }` |
| Selfie URL stored | Selfie URL provided in body | Stored in `attendance_evidence.selfie_url` | DB row has non-null selfie_url |
| Missing clock-out | Only clock-in event today | Attendance Review shows "Missing Clock Out" | `attendance_logs.check_out = null`, flagged in review |
| Manual adjustment | HR edits clock-out time | `attendance_logs` updated, edit logged | Updated record + audit trail |
| Biometric and mobile same-day | Biometric clock-in at 8:00, mobile at 8:05 | Reconciliation uses configured priority | `attendance_summaries.attendance_source_summary` shows both sources; primary follows priority rule |
| Attendance summary generated | Attendance review approved for period | `attendance_summaries` rows created | One row per employee per day with correct totals |

---

### Payroll Finalization and Payslip

| Scenario | Input | Expected Result | Pass Criteria |
|---|---|---|---|
| Payroll uses attendance summaries | `attendance_summaries` rows exist | Payroll reads from summaries, not raw logs | No direct `attendance_logs` query in payroll run |
| Payroll uses approved OT only | Mix of approved/pending/rejected OT records | Only approved + partially_approved OT included | Payslip OT = sum of approved_ot_hours only |
| Payroll excludes pending OT | 2h pending OT, 3h approved OT | Payslip shows 3h OT, not 5h | OT pay computed on 3h only |
| Payslip shows correct government deductions | Employee with SSS/PhilHealth/Pag-IBIG | All three deductions calculated correctly | Deduction amounts match expected table values |
| Audit log on payroll finalization | Run finalized | Audit log entry written | `audit_logs` or `payroll_runs` table has finalization record |


---

## Release Readiness Checklist

### NHRMS-REL-001 — Production Readiness Checklist

**Database**
- [ ] All migrations applied in correct order on production Supabase instance
- [ ] No duplicate migration numbers in production history
- [ ] `payroll_rules` has one default row with DOLE PH values
- [ ] `ot_settings` has one default row
- [ ] `attendance_summaries` table exists
- [ ] All RLS policies tested with each role (admin, hr, payroll_admin, supervisor, employee)

**Environment Variables**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set on production host
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set on production host
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set on production host (server-only)
- [ ] `QR_HMAC_SECRET` set to a real random secret (not insecure fallback)
- [ ] `NEXT_PUBLIC_DEMO_MODE=false` on production
- [ ] `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` set for push notifications

**CI/CD**
- [ ] Branch protection on `main` — require all 5 CI jobs to pass
- [ ] Branch protection on `main` — require PR review before merge
- [ ] Deploy job replaced with real deployment step
- [ ] Migration duplicate-number check added to CI
- [ ] Playwright E2E tests cover OT review and payroll finalization flows

**Code**
- [ ] `payroll-computation-engine.ts` reads multipliers from `PayrollRules` param
- [ ] `payroll-computation-engine.ts` reads OT from `ot_records` (approved/partially_approved only)
- [ ] `admin-view.tsx` calls pending OT guard before lock/finalize
- [ ] Payroll Rules Settings UI connected to `usePayrollRulesStore`
- [ ] Attendance Review page connected to `/api/attendance/review`
- [ ] `/api/attendance/mobile` implements strict geofence mode

**QA**
- [ ] All scenarios in QA test plan manually executed and passed
- [ ] No payroll computation regression from old payroll test suite
- [ ] E2E tests passing on final production build
- [ ] Jest test coverage ≥ 80% on `ot-computation.ts` and `payroll-computation-engine.ts`

### NHRMS-REL-002 — Deployment and Rollback Plan

**Deployment order:**
1. Apply all new migrations to Supabase (068, 069) — confirm each succeeds before next
2. Deploy new application build to production host
3. Verify production `/api/payroll-rules` returns expected DOLE defaults
4. Verify production `/api/overtime-review` is accessible to HR role
5. Run smoke test: login as admin → payroll → overtime-review → confirm records load

**Rollback procedure:**
- Application rollback: redeploy previous build hash (keep last 2 successful builds)
- Migration rollback for `068_attendance_summaries.sql`: `DROP TABLE IF EXISTS public.attendance_summaries;`
- Migration rollback for `069_attendance_location_columns.sql`: `ALTER TABLE attendance_logs DROP COLUMN IF EXISTS location_lat; ALTER TABLE attendance_logs DROP COLUMN IF EXISTS location_lng;`
- **No rollback exists for `065`, `066`, `067`** — these are in production. Treat as permanent schema additions.
- Payroll engine rollback: revert the specific commit hash that changed `payroll-computation-engine.ts`; rebuild and redeploy

---

## Final Recommendation

**The system is architecturally sound but not production-ready for the payroll and OT features.**

The backend layer — DB tables, API routes, stores, type system, computation engine — is 80% complete and well-designed. The three missing connections that make the entire spec non-functional in production are:

1. **Payroll computation engine does not read from `ot_records` or `payroll_rules`** — this is the single highest-priority engineering task. Until this is fixed, the entire OT review workflow exists but has zero effect on payroll.

2. **Payroll Rules Settings UI does not exist** — the settings can be set via direct API call only. No administrator can configure it through the product.

3. **Attendance Review page is a stub** — no data is ever shown, no approvals can be made, meaning the attendance pipeline cannot progress to summary generation.

**Recommended immediate actions (this week):**
1. Confirm CI green on latest main (STAB-001)
2. Senior Dev starts PAYRULE-003 + OT-001 (wiring the engine) — highest business value
3. Intern 1 starts PAYRULE-001 (Settings UI) — unblocked, safe parallel work
4. Intern 2 starts ATT-001 (summaries migration) — unblocked, additive only
5. Intern 3 starts ATT-003 (attendance review API) — unblocked, new route

With this parallel approach, the three critical gaps can all be closed within 2–3 focused development cycles.

