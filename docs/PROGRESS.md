# NexHRMS — Progress Tracker

**Last updated:** 2026-06-26
**Maintained by:** Senior Developer / Project Lead

> Update this file when a ticket moves to In Progress or Done.
> Status key: 🔴 Not Started · 🟡 In Progress · 🟢 Done · ⛔ Blocked · ✅ Verified by QA

---

## Current Sprint Focus

```
Phase 0 — Baseline Stabilization
Phase 1A/1B/1C — Parallel foundations (can start immediately after Phase 0)
```

---

## Phase 0 — Baseline Stabilization

| Ticket | Task | Owner | Status | PR | Notes |
|---|---|---|---|---|---|
| STAB-001 | Verify CI/CD — all 5 jobs green on latest main | Senior Dev | 🔴 | — | |
| STAB-002 | Run full baseline locally (lint, typecheck, test, build) | QA Intern | 🔴 | — | Depends on STAB-001 |
| STAB-003 | Fix any blocking failures from STAB-002 | Senior Dev | 🔴 | — | Depends on STAB-002 |
| STAB-004 | Audit migration files — document canonical order | Senior Dev | 🔴 | — | See duplicate numbers: 001,002,003,009,010,012,013,014,015,016,017,065,066 |
| STAB-005 | Write baseline status doc | QA Intern | 🔴 | — | Depends on STAB-002 |

---

## Phase 1A — Payroll Rules Settings UI

| Ticket | Task | Owner | Status | PR | Notes |
|---|---|---|---|---|---|
| PAYRULE-001 | Add Payroll Rules tab to settings page | Intern 1 | 🟡 | — | Completed 2026-06-26 |
| PAYRULE-002 | Wire `usePayrollRulesStore` to settings page | Intern 1 | 🔴 | — | Depends on PAYRULE-001 |

---

## Phase 1B — Attendance Summaries + Location Migration

| Ticket | Task | Owner | Status | PR | Notes |
|---|---|---|---|---|---|
| ATT-001 | Create `068_attendance_summaries.sql` migration | Intern 2 | 🔴 | — | |
| ATT-002 | Build attendance summary generation service | Intern 2 | 🔴 | — | Depends on ATT-001 |
| ATT-006 | Create `069_attendance_location_columns.sql` migration | Intern 2 | 🔴 | — | Fixes schema drift in `/api/attendance/mobile` |

---

## Phase 1C — Attendance Review API + UI

| Ticket | Task | Owner | Status | PR | Notes |
|---|---|---|---|---|---|
| ATT-003 | Implement `GET /api/attendance/review` route | Intern 3 | 🔴 | — | |
| ATT-004 | Complete Attendance Review UI | Intern 3 | 🔴 | — | Depends on ATT-003 |

---

## Phase 2A — Payroll Rules Engine Integration

| Ticket | Task | Owner | Status | PR | Notes |
|---|---|---|---|---|---|
| PAYRULE-003 | Remove hardcoded multipliers from `payroll-computation-engine.ts` | Senior Dev | 🔴 | — | **CRITICAL — blocks OT integration** |
| PAYRULE-004 | Inject `PayrollRules` into `admin-view.tsx` computation call | Senior Dev | 🔴 | — | Depends on PAYRULE-003 |

---

## Phase 2B — OT Review → Payroll Integration

| Ticket | Task | Owner | Status | PR | Notes |
|---|---|---|---|---|---|
| OT-001 | Connect payroll engine to `ot_records` approved data | Senior Dev | 🔴 | — | **CRITICAL — highest business priority** |
| OT-003 | Fetch and filter OT records in `admin-view.tsx` before compute | Senior Dev | 🔴 | — | Depends on OT-001 |
| OT-004 | Write `ot_audit_logs` on payroll inclusion with `payroll_run_id` | Senior Dev | 🔴 | — | Depends on OT-001 |

---

## Phase 2C — Payroll Pending OT Guard

| Ticket | Task | Owner | Status | PR | Notes |
|---|---|---|---|---|---|
| OT-002 | Add pending OT warning dialog before payroll lock | Senior Dev + Intern 1 | 🔴 | — | Depends on OT-003 |

---

## Phase 3 — Enhancements

| Ticket | Task | Owner | Status | PR | Notes |
|---|---|---|---|---|---|
| OT-005 | Add OT type breakdown to payslip | Intern 2 | 🔴 | — | Depends on Phase 2B |
| ATT-005 | Implement strict geofence mode | Intern 3 | 🔴 | — | |
| ATT-007 | Multi-source attendance reconciliation | Senior Dev | 🔴 | — | Depends on ATT-002 |

---

## Phase 4 — Verification + Polish

| Ticket | Task | Owner | Status | PR | Notes |
|---|---|---|---|---|---|
| PAYRULE-005 | Compliance mode warning audit verification | Intern 1 | 🔴 | — | |
| PAYRULE-006 | Unit tests — DOLE vs Custom mode | Intern 3 | 🔴 | — | |
| QA-001 | Create QA test matrix | QA Intern | 🔴 | — | |
| QA-002 | Test OT approval → payroll inclusion | QA Intern | 🔴 | — | |
| QA-003 | Test payroll rules mode switching | QA Intern | 🔴 | — | |
| QA-004 | Test mobile attendance geofence scenarios | QA Intern | 🔴 | — | |
| QA-005 | Test biometric + mobile same-day reconciliation | QA Intern | 🔴 | — | |
| QA-006 | Regression test payroll finalization + payslip | QA Intern | 🔴 | — | |

---

## Phase 5 — Production Readiness

| Ticket | Task | Owner | Status | PR | Notes |
|---|---|---|---|---|---|
| REL-001 | Production readiness checklist | Senior Dev | 🔴 | — | |
| REL-002 | Deployment and rollback plan | Senior Dev | 🔴 | — | |

---

## CI/CD Status

| Job | Status | Last Confirmed |
|---|---|---|
| Lint | ✅ Passing | 2026-06-26 |
| Typecheck | ✅ Passing | 2026-06-26 |
| Tests (Jest) | ✅ 621/622 | 2026-06-26 |
| Build | ✅ Passing | 2026-06-26 |
| E2E (Playwright) | ✅ 2/2 | 2026-06-26 (after hydration fix) |

---

## Known Issues / Blockers

| Issue | Severity | Affects | Resolution |
|---|---|---|---|
| 13 duplicate migration file numbers (001,002,003,009,010,012,013,014,015,016,017,065,066) | High | Schema consistency in fresh environments | STAB-004 |
| `payroll-computation-engine.ts` ignores `ot_records` and `payroll_rules` | Critical | OT review layer has zero effect on payroll | PAYRULE-003 + OT-001 |
| `usePayrollRulesStore` not used in any `.tsx` file | High | Payroll Rules cannot be configured in UI | PAYRULE-001/002 |
| Attendance Review page is a stub (no data fetching) | High | HR cannot approve attendance → blocks pipeline | ATT-003/004 |
| `attendance_summaries` table does not exist | High | Payroll reads raw logs instead of clean summaries | ATT-001 |
| `location_lat`/`location_lng` written at runtime but not in any migration | Medium | Schema drift — may break on DB reset | ATT-006 |
| Strict geofence mode is TODO comment only | Medium | Mobile clock-in cannot be blocked for out-of-area | ATT-005 |
| ESLint v9 `.eslintignore` deprecation warning | Low | Non-blocking | Future cleanup |

---

## Completed Work (Pre-Plan Baseline)

These were already done before this plan was created. Tracked here for reference.

| Item | Status | Notes |
|---|---|---|
| `ot_records`, `ot_audit_logs`, `ot_settings` tables | ✅ Done | Migration 065 |
| `/api/overtime-review` — compute, filter, batch approve/reject | ✅ Done | |
| `/api/ot-settings` — GET/PUT with role guard | ✅ Done | |
| `useOTReviewStore` with optimistic updates | ✅ Done | |
| `ot-computation.ts` — OT classification, DOLE multipliers | ✅ Done | |
| OT Review UI at `payroll/overtime-review` | ✅ Done | |
| `payroll_rules` + `payroll_rules_audit_logs` tables | ✅ Done | Migration 066 |
| `/api/payroll-rules` — GET/PATCH with confirmation gate | ✅ Done | |
| `usePayrollRulesStore` | ✅ Done | Not wired to UI yet |
| `work_locations` + `employee_work_locations` tables | ✅ Done | Migration 067 |
| `/api/attendance/mobile` — GPS, geofence, selfie, evidence | ✅ Done | Flexible mode only |
| `geofence.ts` — Haversine calculation | ✅ Done | |
| Biometric devices, enrollments, logs, sync APIs + UI | ✅ Done | |
| T800 physical biometric device integration | ✅ Done | |
| CI/CD pipeline — all 5 jobs passing | ✅ Done | E2E fixed 2026-06-26 |
| E2E hydration fix — `waitForLoadState` → wait for email input | ✅ Done | 2026-06-26 |
| Root directory cleanup — 62 stale `.md` files removed | ✅ Done | 2026-06-26 |
| Updated README with real project documentation | ✅ Done | 2026-06-26 |

---

## How to Update This File

When you start a ticket, change `🔴` to `🟡` and add the PR number when opened.
When the PR merges, change to `🟢` and add the merge date in Notes.
When QA verifies it, change to `✅`.

**Example:**

```
| OT-001 | Connect payroll engine to ot_records | Senior Dev | 🟢 | #42 (merged 2026-06-28) | Verified by QA 2026-06-29 |
```
