# NexHRMS — Feature Completion Roadmap

**Last updated:** 2026-06-26
**Reference plan:** `NEXHRMS_COMPLETION_PLAN.md`

---

## Target Architecture

```
Raw Attendance Sources
  ├── Biometric Logs
  ├── Mobile GPS Logs
  ├── Web Logs
  └── Manual Logs
          ↓
  Unified Attendance Logs
          ↓
  Attendance Review
          ↓
  Attendance Summaries
          ↓
  OT Review & Approval
          ↓
  Payroll Rules Engine (DOLE PH / Custom)
          ↓
  Payroll Computation
          ↓
  Payslip
```

---

## Phase Overview

| Phase | Name | Status | Owner | Tickets |
|---|---|---|---|---|
| **Phase 0** | Baseline Stabilization | 🟢 Done | Senior Dev | STAB-001 → 005 |
| **Phase 1A** | Payroll Rules Settings UI | 🟢 Done | Intern 1 | PAYRULE-001, 002 |
| **Phase 1B** | Attendance Summaries + Location Migration | 🟢 Done | Intern 2 | ATT-001, 002, 006 |
| **Phase 1C** | Attendance Review API + UI | 🟢 Done | Intern 3 | ATT-003, 004 |
| **Phase 2A** | Payroll Rules Engine Integration | 🟢 Done | Senior Dev | PAYRULE-003, 004 |
| **Phase 2B** | OT Review → Payroll Integration | 🟢 Done | Senior Dev | OT-001, 003, 004 |
| **Phase 2C** | Payroll Pending OT Guard | 🟢 Done | Senior Dev + Intern 1 | OT-002 |
| **Phase 3A** | Payslip OT Breakdown | 🟢 Done | Intern 2 | OT-005 |
| **Phase 3B** | Strict Geofence Mode | 🟢 Done | Intern 3 | ATT-005 |
| **Phase 3C** | Multi-Source Attendance Reconciliation | 🔴 Not Started | Senior Dev | ATT-007 |
| **Phase 4A** | Compliance Mode Warning + Audit Verification | 🔴 Not Started | Intern 1 | PAYRULE-005, 006 |
| **Phase 4B** | QA Regression | 🔴 Not Started | QA Intern | QA-001 → 006 |
| **Phase 5** | Production Readiness | 🔴 Not Started | Senior Dev | REL-001, 002 |

**Status key:** 🔴 Not Started · 🟡 In Progress · 🟢 Done · ⛔ Blocked

---

## Phase 0 — Baseline Stabilization

> **Goal:** Confirm CI is green, document migration order, create baseline record.
> **Must complete before:** Any payroll computation changes (Phase 2A, 2B).

| Ticket | Task | Owner | Depends On |
|---|---|---|---|
| STAB-001 | Verify CI/CD pipeline — confirm all 5 jobs pass on latest main | Senior Dev | — |
| STAB-002 | Run full baseline locally: lint, typecheck, test:ci, build | QA Intern | STAB-001 |
| STAB-003 | Fix any blocking failures found in STAB-002 | Senior Dev | STAB-002 |
| STAB-004 | Audit migration files — document canonical execution order, identify duplicate numbers | Senior Dev | — |
| STAB-005 | Write baseline status doc — what passes, what's wired, what's a stub | QA Intern | STAB-002 |

**Exit criteria:** All 5 CI jobs green on main. `MIGRATION_ORDER.md` exists. Baseline CI run URL recorded.

---

## Phase 1 — Parallel Feature Foundations

> **All three Phase 1 tracks can run simultaneously.** None depend on each other.

### Phase 1A — Payroll Rules Settings UI

> **Goal:** Give administrators a UI to configure compliance mode and OT multipliers.

| Ticket | Task | Owner | Depends On |
|---|---|---|---|
| PAYRULE-001 | Add "Payroll Rules" tab to `payroll/settings/page.tsx` — compliance mode, 5 OT multipliers, night diff, thresholds | Intern 1 | Phase 0 |
| PAYRULE-002 | Wire `usePayrollRulesStore` — `fetchRules()` on mount, all fields connected, compliance mode warning modal | Intern 1 | PAYRULE-001 |

**Exit criteria:** Settings page renders. Compliance mode can be toggled. Warning modal appears on switch to Custom. Values persist via API.

---

### Phase 1B — Attendance Summaries + Location Migration

> **Goal:** Create the `attendance_summaries` table and fix the location column schema drift.

| Ticket | Task | Owner | Depends On |
|---|---|---|---|
| ATT-001 | Create `068_attendance_summaries.sql` migration — full schema with RLS and indexes | Intern 2 | Phase 0 |
| ATT-002 | Build attendance summary generation service — `/api/attendance/summaries/generate` | Intern 2 | ATT-001 |
| ATT-006 | Create `069_attendance_location_columns.sql` — formally add `location_lat`, `location_lng` to `attendance_logs` | Intern 2 | Phase 0 |

**Exit criteria:** `attendance_summaries` table exists in DB. Summary generation API creates correct rows. Location columns are formally migrated.

---

### Phase 1C — Attendance Review API + UI

> **Goal:** Replace the stub Attendance Review page with a working implementation.

| Ticket | Task | Owner | Depends On |
|---|---|---|---|
| ATT-003 | Implement `GET /api/attendance/review` — filtered fetch with joins to evidence and employees | Intern 3 | Phase 0 |
| ATT-004 | Complete Attendance Review UI — wire data fetch, filter bar, approve/reject/edit actions, selfie preview | Intern 3 | ATT-003 |

**Exit criteria:** Attendance Review page shows real records. HR can approve, reject, and edit logs. Filter bar works.

---

## Phase 2 — Core Integrations (Senior Dev Priority)

> **These are the three critical gaps. Phase 2A must come before 2B.**
> **Blocks:** Phase 3A, 3C, and QA.

### Phase 2A — Payroll Rules Engine Integration

> **Goal:** Remove hardcoded multipliers. Make payroll computation read from `payroll_rules` DB table.

| Ticket | Task | Owner | Depends On |
|---|---|---|---|
| PAYRULE-003 | Remove hardcoded `MULTIPLIERS` constant from `payroll-computation-engine.ts`; accept `PayrollRules` param; fall back to `DOLE_PH_DEFAULTS` | Senior Dev | Phase 1A |
| PAYRULE-004 | In `admin-view.tsx`, fetch rules via `usePayrollRulesStore.fetchRules()` before computing payroll; pass `rules` to engine | Senior Dev | PAYRULE-003 |

**Exit criteria:** Changing a multiplier in the Settings UI changes computed OT pay without a code deployment. Unit tests confirm DOLE defaults apply when rules param is null.

---

### Phase 2B — OT Review → Payroll Integration

> **Goal:** Payroll reads `approved_ot_hours` from `ot_records`, not raw attendance.

| Ticket | Task | Owner | Depends On |
|---|---|---|---|
| OT-001 | Modify `payroll-computation-engine.ts` to accept `approvedOtRecords: OTRecord[]`; replace inline OT computation with lookup; use `approved_ot_hours` and `approved_amount` | Senior Dev | PAYRULE-003 |
| OT-003 | In `admin-view.tsx`, fetch OT records before computing payroll; filter to `approved` and `partially_approved` only | Senior Dev | OT-001 |
| OT-004 | When `markIncludedInPayroll` runs, write `ot_audit_logs` with `payroll_run_id` in `new_value` | Senior Dev | OT-001 |

**Exit criteria:** Pending and rejected OT records do not appear in payslip. Approved OT uses `approved_ot_hours`, not computed hours. Audit log entry written on payroll inclusion.

---

### Phase 2C — Payroll Pending OT Guard

> **Goal:** Payroll finalization warns the user when pending OT records exist for the period.

| Ticket | Task | Owner | Depends On |
|---|---|---|---|
| OT-002 | Before `lockRun`, call `getPendingCountForPeriod`; if count > 0, show AlertDialog with count and two options: "Review Pending OT" / "Proceed Without"; write audit log on proceed | Senior Dev + Intern 1 | OT-003 |

**Exit criteria:** AlertDialog appears with correct count. "Review Pending OT" navigates to `payroll/overtime-review`. "Proceed Without" locks the run and excludes pending OT. Audit log is written.

---

## Phase 3 — Enhancements

> **Can run in parallel after Phase 2 is complete.**

| Ticket | Task | Owner | Depends On |
|---|---|---|---|
| OT-005 | Add OT type breakdown to payslip — Regular OT, Rest Day OT, Holiday OT sourced from `ot_records` | Intern 2 | Phase 2B |
| ATT-005 | Implement strict geofence mode — `geofence_mode` setting; `/api/attendance/mobile` returns 403 when strict + outside | Intern 3 | ATT-003 |
| ATT-007 | Multi-source attendance reconciliation — configurable priority rule; conflict flagging in `attendance_summaries` | Senior Dev | ATT-002 |

---

## Phase 4 — Verification + Polish

| Ticket | Task | Owner | Depends On |
|---|---|---|---|
| PAYRULE-005 | Verify compliance mode warning modal matches spec; confirm audit log written on every mode switch | Intern 1 | Phase 2A |
| PAYRULE-006 | Unit tests — DOLE Standard mode, Custom mode (1.00x), null rules fallback, `deriveOTStatus` all cases | Intern 3 | Phase 2A |
| QA-001 | Create QA test matrix from plan | QA Intern | Phase 2 complete |
| QA-002 | Test OT approval → payroll inclusion (all scenarios) | QA Intern | QA-001 |
| QA-003 | Test payroll rules mode switching | QA Intern | QA-001 |
| QA-004 | Test mobile attendance geofence scenarios | QA Intern | QA-001 |
| QA-005 | Test biometric + mobile same-day reconciliation | QA Intern | QA-001 |
| QA-006 | Regression test payroll finalization + payslip output | QA Intern | QA-001 |

---

## Phase 5 — Production Readiness

| Ticket | Task | Owner | Depends On |
|---|---|---|---|
| REL-001 | Production readiness checklist — DB, env vars, CI/CD, branch protection, code, QA | Senior Dev | Phase 4 |
| REL-002 | Deployment and rollback plan — deployment order, rollback SQL for each migration, build rollback procedure | Senior Dev | REL-001 |

---

## Dependency Graph

```
Phase 0 (STAB)
    ├── Phase 1A (PAYRULE-001, 002)
    │       └── Phase 2A (PAYRULE-003, 004)
    │               └── Phase 2B (OT-001, 003, 004)
    │                       └── Phase 2C (OT-002)
    │                               └── Phase 3A (OT-005)
    │                               └── Phase 4 (QA)
    ├── Phase 1B (ATT-001, 002, 006)
    │       └── Phase 3C (ATT-007)
    └── Phase 1C (ATT-003, 004)
            └── Phase 3B (ATT-005)
```

---

## Non-Negotiable Rules (embedded in every phase)

1. Attendance only computes possible OT — never sends it directly to payroll
2. OT must enter Pending Review before payroll can see it
3. Payroll uses `approved_ot_hours` and `approved_amount` only
4. Pending and rejected OT is always excluded from payroll
5. Payroll finalization must warn if pending OT records exist
6. Payroll multipliers come from `payroll_rules` DB table — never hardcoded
7. Philippine DOLE Standard is the default payroll mode
8. Custom mode requires explicit confirmation and writes an audit log
9. All attendance sources flow into one unified pipeline
10. Payroll uses `attendance_summaries`, not raw `attendance_logs`
11. Every approval, rejection, and payroll inclusion is auditable
12. All changes must pass CI before merge
