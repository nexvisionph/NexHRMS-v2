# NexHRMS — Supabase Migration & Backend Integration Plan

> **Generated:** 2025-03-25  
> **Stack:** Next.js 16 + Zustand (frontend) → Supabase (Postgres + Auth + RLS)  
> **Project ID:** `ytulzzftxjlmtqwukdqq`  
> **Goal:** Migrate from client-only Zustand stores to a real Supabase backend, starting with the most critical features first.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Migration Priority Order](#2-migration-priority-order)
3. [Phase 1 — Auth & Core Identity](#3-phase-1--auth--core-identity)
4. [Phase 2 — Employees & RBAC](#4-phase-2--employees--rbac)
5. [Phase 3 — Attendance & Shifts](#5-phase-3--attendance--shifts)
6. [Phase 4 — Leave Management](#6-phase-4--leave-management)
7. [Phase 5 — Payroll & Payslips](#7-phase-5--payroll--payslips)
8. [Phase 6 — Loans & Cash Advances](#8-phase-6--loans--cash-advances)
9. [Phase 7 — Tasks & Messaging](#9-phase-7--tasks--messaging)
10. [Phase 8 — Audit, Notifications, & Remaining](#10-phase-8--audit-notifications--remaining)
11. [SQL Migration File Map](#11-sql-migration-file-map)
12. [Frontend Integration Strategy](#12-frontend-integration-strategy)
13. [Sign-In Flow (No Sign-Up)](#13-sign-in-flow-no-sign-up)
14. [Row-Level Security (RLS) Strategy](#14-row-level-security-rls-strategy)
15. [Current Feature → Table Mapping](#15-current-feature--table-mapping)

---

## 1. Architecture Overview

### Current State (Client-Only)
```
[Browser] → Zustand stores (persisted in localStorage) → No server
```

### Target State (Supabase Backend)
```
[Browser] → Next.js App → Supabase Client (@supabase/ssr)
                              ├── Supabase Auth (email/password login)
                              ├── PostgreSQL (all business data)
                              ├── RLS policies (row-level security per role)
                              └── Edge Functions (optional, future)
```

### Key Decisions
| Decision | Choice | Reason |
|---|---|---|
| Auth provider | Supabase Auth | Built-in, no custom JWT needed |
| Sign-up | **Disabled** — Admin creates accounts only | Business requirement |
| Password hashing | Supabase Auth handles it (bcrypt) | Replace current btoa() hack |
| Session management | Supabase SSR cookies | Next.js 16 compatible |
| Data layer | Direct Supabase client calls | Simple, no API routes needed for CRUD |
| Role storage | `user_metadata.role` in Supabase Auth + `employees.role` column | Dual: Auth for RLS, employees for business logic |
| Migration approach | **Additive** — keep Zustand stores, add Supabase fetch/sync | Don't break existing 653 tests |

---

## 2. Migration Priority Order

| Priority | Module | Why First | SQL Migration |
|---|---|---|---|
| **P0** | Auth & Sign-In | Nothing works without authentication | `001_auth_profiles.sql` |
| **P1** | Employees | Core entity — everything references employees | `002_employees.sql` |
| **P2** | Roles & Permissions | RBAC gates every feature | `003_roles_permissions.sql` |
| **P3** | Attendance + Shifts + Holidays | Daily operational use, most data volume | `004_attendance.sql` |
| **P4** | Leave Management | Tied to attendance + payroll | `005_leave.sql` |
| **P5** | Payroll + Payslips | Revenue-critical, compliance-required | `006_payroll.sql` |
| **P6** | Loans & Cash Advances | Payroll deductions depend on this | `007_loans.sql` |
| **P7** | Tasks + Messaging | Team collaboration features | `008_tasks_messaging.sql` |
| **P8** | Audit + Notifications + Projects + Timesheets | Supporting systems | `009_audit_notifications.sql` |
| **P9** | Settings, Kiosk, Location, Appearance | Configuration tables | `010_settings.sql` |

---

## 3. Phase 1 — Auth & Core Identity

### What exists now
- `auth.store.ts`: 7 demo accounts with btoa() password hashing
- `login()` checks `accounts[]` array in browser memory
- `createAccount()` adds to local array — admin-only flow
- No server auth, no sessions, no cookies

### What we're building
- Supabase Auth with `email + password` sign-in
- `profiles` table linked to `auth.users` via `id` foreign key
- Admin-only account creation via `supabase.auth.admin.createUser()`
- Sign-in page calls `supabase.auth.signInWithPassword()`
- No public sign-up — the Supabase project has sign-up disabled

### Tables
```
profiles
├── id (uuid, FK → auth.users.id)
├── name (text)
├── email (text, unique)
├── role (text) — "admin" | "hr" | "finance" | "employee" | "supervisor" | "payroll_admin" | "auditor"
├── avatar_url (text, nullable)
├── phone (text, nullable)
├── department (text, nullable)
├── birthday (date, nullable)
├── address (text, nullable)
├── emergency_contact (text, nullable)
├── must_change_password (boolean, default true)
├── profile_complete (boolean, default false)
├── created_at (timestamptz)
├── created_by (uuid, nullable, FK → auth.users.id)
└── updated_at (timestamptz)
```

### Sign-In Flow
1. User enters email + password on `/login`
2. Frontend calls `supabase.auth.signInWithPassword({ email, password })`
3. On success → fetch `profiles` row → store in Zustand `currentUser`
4. Redirect to `/${role}/dashboard`
5. Session persisted via Supabase SSR cookies (auto-refresh)

### Account Creation Flow (Admin Only)
1. Admin opens employee management
2. Creates employee record + optionally creates login account
3. Backend: `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
4. Insert matching `profiles` row
5. Employee receives credentials, logs in, completes onboarding

---

## 4. Phase 2 — Employees & RBAC

### Tables
```
employees
├── id (text, PK) — "EMP001" format (matches current IDs)
├── profile_id (uuid, nullable, FK → profiles.id) — links to login account
├── name (text)
├── email (text)
├── role (text)
├── department (text)
├── status (text) — "active" | "inactive" | "resigned"
├── work_type (text) — "WFH" | "WFO" | "HYBRID" | "ONSITE"
├── salary (numeric) — monthly ₱
├── join_date (date)
├── productivity (integer)
├── location (text)
├── phone (text, nullable)
├── birthday (date, nullable)
├── team_leader (text, nullable)
├── avatar_url (text, nullable)
├── pin (text, nullable) — kiosk PIN
├── nfc_id (text, nullable)
├── resigned_at (timestamptz, nullable)
├── shift_id (text, nullable)
├── pay_frequency (text, nullable)
├── work_days (text[], nullable)
├── whatsapp_number (text, nullable)
├── preferred_channel (text, nullable)
├── created_at (timestamptz)
└── updated_at (timestamptz)

salary_change_requests
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── old_salary (numeric)
├── proposed_salary (numeric)
├── effective_date (date)
├── reason (text)
├── proposed_by (text)
├── proposed_at (timestamptz)
├── status (text) — "pending" | "approved" | "rejected"
├── reviewed_by (text, nullable)
└── reviewed_at (timestamptz, nullable)

salary_history
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── monthly_salary (numeric)
├── effective_from (date)
├── effective_to (date, nullable)
├── approved_by (text)
└── reason (text)

employee_documents
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── name (text)
├── file_url (text, nullable)
├── uploaded_at (timestamptz)
└── deleted_at (timestamptz, nullable)

roles_custom
├── id (text, PK)
├── name (text)
├── slug (text, unique)
├── color (text)
├── icon (text)
├── is_system (boolean)
├── permissions (text[]) — PostgreSQL array
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

---

## 5. Phase 3 — Attendance & Shifts

### Tables
```
attendance_events (append-only — §2 immutable logs)
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── event_type (text) — "IN" | "OUT" | "BREAK_START" | "BREAK_END"
├── timestamp_utc (timestamptz)
├── project_id (text, nullable)
├── device_id (text, nullable)
├── created_at (timestamptz)

attendance_evidence
├── id (text, PK)
├── event_id (text, FK → attendance_events.id)
├── gps_lat (double precision, nullable)
├── gps_lng (double precision, nullable)
├── gps_accuracy_meters (double precision, nullable)
├── geofence_pass (boolean, nullable)
├── qr_token_id (text, nullable)
├── device_integrity_result (text, nullable)
├── face_verified (boolean, nullable)
└── mock_location_detected (boolean, nullable)

attendance_exceptions
├── id (text, PK)
├── event_id (text, nullable)
├── employee_id (text, FK → employees.id)
├── date (date)
├── flag (text) — AttendanceFlag enum
├── auto_generated (boolean)
├── resolved_at (timestamptz, nullable)
├── resolved_by (text, nullable)
├── notes (text, nullable)
└── created_at (timestamptz)

attendance_logs (computed daily summaries)
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── date (date)
├── check_in (text, nullable)
├── check_out (text, nullable)
├── hours (numeric, nullable)
├── status (text) — "present" | "absent" | "on_leave"
├── project_id (text, nullable)
├── location_lat (double precision, nullable)
├── location_lng (double precision, nullable)
├── face_verified (boolean, nullable)
├── late_minutes (integer, nullable)
├── shift_id (text, nullable)
├── flags (text[], nullable)
├── created_at (timestamptz)
└── updated_at (timestamptz)

shift_templates
├── id (text, PK)
├── name (text)
├── start_time (text) — "09:00"
├── end_time (text) — "18:00"
├── grace_period (integer) — minutes
├── break_duration (integer) — minutes
├── work_days (integer[]) — [1,2,3,4,5]
├── created_at (timestamptz)
└── updated_at (timestamptz)

employee_shifts
├── employee_id (text, PK, FK → employees.id)
├── shift_id (text, FK → shift_templates.id)
└── assigned_at (timestamptz)

holidays
├── id (text, PK)
├── name (text)
├── date (date)
├── type (text) — "regular" | "special_non_working" | "special_working"
├── multiplier (numeric)
├── is_custom (boolean, default false)
└── created_at (timestamptz)

overtime_requests
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── date (date)
├── hours_requested (numeric)
├── reason (text)
├── project_id (text, nullable)
├── status (text) — "pending" | "approved" | "rejected"
├── requested_at (timestamptz)
├── reviewed_by (text, nullable)
├── reviewed_at (timestamptz, nullable)
└── rejection_reason (text, nullable)

penalty_records
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── reason (text)
├── triggered_at (timestamptz)
├── penalty_until (timestamptz)
└── resolved (boolean, default false)
```

---

## 6. Phase 4 — Leave Management

### Tables
```
leave_policies
├── id (text, PK)
├── leave_type (text) — "SL" | "VL" | "EL" | "ML" | "PL" | "SPL" | "OTHER"
├── name (text)
├── accrual_frequency (text) — "monthly" | "annual"
├── annual_entitlement (integer)
├── carry_forward_allowed (boolean)
├── max_carry_forward (integer)
├── max_balance (integer)
├── expiry_months (integer) — 0 = no expiry
├── negative_leave_allowed (boolean)
├── attachment_required (boolean)
├── created_at (timestamptz)
└── updated_at (timestamptz)

leave_balances
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── leave_type (text)
├── year (integer)
├── entitled (numeric)
├── used (numeric)
├── carried_forward (numeric)
├── remaining (numeric)
├── last_accrued_at (timestamptz, nullable)
└── updated_at (timestamptz)

leave_requests
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── type (text)
├── start_date (date)
├── end_date (date)
├── reason (text)
├── status (text) — "pending" | "approved" | "rejected"
├── reviewed_by (text, nullable)
├── reviewed_at (timestamptz, nullable)
├── attachment_url (text, nullable)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

---

## 7. Phase 5 — Payroll & Payslips

### Tables
```
payslips
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── period_start (date)
├── period_end (date)
├── pay_frequency (text, nullable)
├── gross_pay (numeric)
├── allowances (numeric)
├── sss_deduction (numeric)
├── philhealth_deduction (numeric)
├── pagibig_deduction (numeric)
├── tax_deduction (numeric)
├── other_deductions (numeric)
├── loan_deduction (numeric)
├── holiday_pay (numeric, nullable)
├── net_pay (numeric)
├── issued_at (timestamptz)
├── status (text) — "issued" | "confirmed" | "published" | "paid" | "acknowledged"
├── confirmed_at (timestamptz, nullable)
├── published_at (timestamptz, nullable)
├── paid_at (timestamptz, nullable)
├── payment_method (text, nullable)
├── bank_reference_id (text, nullable)
├── payroll_batch_id (text, nullable)
├── pdf_hash (text, nullable)
├── notes (text, nullable)
├── signed_at (timestamptz, nullable)
├── signature_data_url (text, nullable)
├── ack_text_version (text, nullable)
├── adjustment_ref (text, nullable)
├── acknowledged_at (timestamptz, nullable)
├── acknowledged_by (text, nullable)
├── paid_confirmed_by (text, nullable)
└── paid_confirmed_at (timestamptz, nullable)

payroll_runs
├── id (text, PK)
├── period_label (text)
├── created_at (timestamptz)
├── status (text) — "draft" | "validated" | "locked" | "published" | "paid"
├── locked (boolean, default false)
├── locked_at (timestamptz, nullable)
├── published_at (timestamptz, nullable)
├── paid_at (timestamptz, nullable)
├── payslip_ids (text[])
├── policy_snapshot (jsonb, nullable) — immutable snapshot
└── run_type (text, nullable) — "regular" | "adjustment" | "13th_month" | "final_pay"

payroll_adjustments
├── id (text, PK)
├── payroll_run_id (text, FK → payroll_runs.id)
├── employee_id (text, FK → employees.id)
├── adjustment_type (text) — "earnings" | "deduction" | "net_correction" | "statutory_correction"
├── reference_payslip_id (text, FK → payslips.id)
├── amount (numeric)
├── reason (text)
├── created_by (text)
├── created_at (timestamptz)
├── approved_by (text, nullable)
├── approved_at (timestamptz, nullable)
├── applied_run_id (text, nullable)
└── status (text) — "pending" | "approved" | "applied" | "rejected"

final_pay_computations
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── resigned_at (timestamptz)
├── pro_rated_salary (numeric)
├── unpaid_ot (numeric)
├── leave_payout (numeric)
├── remaining_loan_balance (numeric)
├── gross_final_pay (numeric)
├── deductions (numeric)
├── net_final_pay (numeric)
├── status (text)
├── created_at (timestamptz)
└── payslip_id (text, nullable)

pay_schedule_config
├── id (text, PK, default 'default')
├── default_frequency (text)
├── semi_monthly_first_cutoff (integer)
├── semi_monthly_first_pay_day (integer)
├── semi_monthly_second_pay_day (integer)
├── monthly_pay_day (integer)
├── bi_weekly_start_date (date)
├── weekly_pay_day (integer)
├── deduct_gov_from (text) — "first" | "second" | "both"
└── updated_at (timestamptz)
```

---

## 8. Phase 6 — Loans & Cash Advances

### Tables
```
loans
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── type (text) — "cash_advance" | "salary_loan" | "other"
├── amount (numeric)
├── remaining_balance (numeric)
├── monthly_deduction (numeric)
├── deduction_cap_percent (integer, default 30)
├── status (text) — "active" | "settled" | "frozen" | "cancelled"
├── approved_by (text)
├── created_at (timestamptz)
├── remarks (text, nullable)
├── last_deducted_at (timestamptz, nullable)
└── updated_at (timestamptz)

loan_deductions
├── id (text, PK)
├── loan_id (text, FK → loans.id)
├── payslip_id (text, nullable, FK → payslips.id)
├── amount (numeric)
├── deducted_at (timestamptz)
└── remaining_after (numeric)

loan_repayment_schedule
├── id (text, PK)
├── loan_id (text, FK → loans.id)
├── due_date (date)
├── amount (numeric)
├── paid (boolean, default false)
├── payslip_id (text, nullable)
└── skipped_reason (text, nullable)

loan_balance_history
├── id (text, PK)
├── loan_id (text, FK → loans.id)
├── date (date)
├── previous_balance (numeric)
├── deduction_amount (numeric)
├── new_balance (numeric)
├── payslip_id (text, nullable)
└── notes (text, nullable)
```

---

## 9. Phase 7 — Tasks & Messaging

### Tables
```
task_groups
├── id (text, PK)
├── name (text)
├── description (text, nullable)
├── project_id (text, nullable)
├── created_by (text)
├── member_employee_ids (text[])
├── announcement_permission (text) — "admin_only" | "group_leads" | "all_members"
└── created_at (timestamptz)

tasks
├── id (text, PK)
├── group_id (text, FK → task_groups.id)
├── title (text)
├── description (text)
├── priority (text) — "low" | "medium" | "high" | "urgent"
├── status (text) — "open" | "in_progress" | "submitted" | "verified" | "rejected" | "cancelled"
├── due_date (date, nullable)
├── assigned_to (text[])
├── created_by (text)
├── created_at (timestamptz)
├── updated_at (timestamptz)
├── completion_required (boolean, default false)
└── tags (text[], nullable)

task_completion_reports
├── id (text, PK)
├── task_id (text, FK → tasks.id)
├── employee_id (text, FK → employees.id)
├── photo_data_url (text, nullable)
├── gps_lat (double precision, nullable)
├── gps_lng (double precision, nullable)
├── gps_accuracy_meters (double precision, nullable)
├── reverse_geo_address (text, nullable)
├── notes (text, nullable)
├── submitted_at (timestamptz)
├── verified_by (text, nullable)
├── verified_at (timestamptz, nullable)
└── rejection_reason (text, nullable)

task_comments
├── id (text, PK)
├── task_id (text, FK → tasks.id)
├── employee_id (text, FK → employees.id)
├── message (text)
├── attachment_url (text, nullable)
└── created_at (timestamptz)

announcements
├── id (text, PK)
├── subject (text)
├── body (text)
├── channel (text) — "email" | "whatsapp" | "sms" | "in_app"
├── scope (text) — "all_employees" | "selected_employees" | "task_group" | "task_assignees"
├── target_employee_ids (text[], nullable)
├── target_group_id (text, nullable)
├── target_task_id (text, nullable)
├── sent_by (text)
├── sent_at (timestamptz)
├── status (text) — "sent" | "delivered" | "read" | "failed" | "simulated"
├── read_by (text[], default '{}')
└── attachment_url (text, nullable)

text_channels
├── id (text, PK)
├── name (text)
├── group_id (text, nullable)
├── member_employee_ids (text[])
├── created_by (text)
├── created_at (timestamptz)
└── is_archived (boolean, default false)

channel_messages
├── id (text, PK)
├── channel_id (text, FK → text_channels.id)
├── employee_id (text, FK → employees.id)
├── message (text)
├── attachment_url (text, nullable)
├── created_at (timestamptz)
├── edited_at (timestamptz, nullable)
└── read_by (text[], default '{}')
```

---

## 10. Phase 8 — Audit, Notifications, & Remaining

### Tables
```
audit_logs
├── id (text, PK)
├── entity_type (text)
├── entity_id (text)
├── action (text)
├── performed_by (text)
├── timestamp (timestamptz)
├── reason (text, nullable)
├── before_snapshot (jsonb, nullable)
└── after_snapshot (jsonb, nullable)

notification_logs
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── type (text)
├── channel (text) — "email" | "sms" | "both" | "in_app"
├── subject (text)
├── body (text)
├── sent_at (timestamptz)
├── status (text) — "sent" | "failed" | "simulated"
├── recipient_email (text, nullable)
├── recipient_phone (text, nullable)
└── error_message (text, nullable)

notification_rules
├── id (text, PK)
├── trigger (text)
├── enabled (boolean, default true)
├── channel (text)
├── recipient_roles (text[])
├── timing (text) — "immediate" | "scheduled"
├── schedule_time (text, nullable)
├── reminder_days (integer[], nullable)
├── subject_template (text)
├── body_template (text)
├── sms_template (text, nullable)
└── updated_at (timestamptz)

projects
├── id (text, PK)
├── name (text)
├── description (text, nullable)
├── location_lat (double precision)
├── location_lng (double precision)
├── location_radius (integer)
├── assigned_employee_ids (text[])
├── status (text, nullable) — "active" | "completed" | "on_hold"
└── created_at (timestamptz)

timesheets
├── id (text, PK)
├── employee_id (text, FK → employees.id)
├── date (date)
├── rule_set_id (text)
├── shift_id (text, nullable)
├── regular_hours (numeric)
├── overtime_hours (numeric)
├── night_diff_hours (numeric)
├── total_hours (numeric)
├── late_minutes (integer)
├── undertime_minutes (integer)
├── segments (jsonb) — array of TimesheetSegment
├── status (text) — "computed" | "submitted" | "approved" | "rejected"
├── computed_at (timestamptz)
├── approved_by (text, nullable)
└── approved_at (timestamptz, nullable)

attendance_rule_sets
├── id (text, PK)
├── name (text)
├── standard_hours_per_day (numeric)
├── grace_minutes (integer)
├── rounding_policy (text) — "none" | "nearest_15" | "nearest_30"
├── overtime_requires_approval (boolean)
├── night_diff_start (text, nullable)
├── night_diff_end (text, nullable)
├── holiday_multiplier (numeric)
└── updated_at (timestamptz)

calendar_events
├── id (text, PK)
├── title (text)
├── time (text)
├── date (date)
├── type (text, nullable)
└── created_at (timestamptz)

kiosk_settings (singleton config)
├── id (text, PK, default 'default')
├── settings (jsonb)
└── updated_at (timestamptz)

location_config (singleton config)
├── id (text, PK, default 'default')
├── config (jsonb)
└── updated_at (timestamptz)

appearance_config (singleton config)
├── id (text, PK, default 'default')
├── config (jsonb)
└── updated_at (timestamptz)
```

---

## 11. SQL Migration File Map

All files go in `supabase/migrations/` and are numbered for execution order:

| File | Contents | Line Count |
|---|---|---|
| `001_auth_profiles.sql` | `profiles` table + RLS + trigger for auth.users sync | ~80 |
| `002_employees.sql` | `employees`, `salary_change_requests`, `salary_history`, `employee_documents` | ~120 |
| `003_roles_permissions.sql` | `roles_custom` + seed system roles | ~60 |
| `004_attendance.sql` | All attendance tables (events, evidence, exceptions, logs, shifts, holidays, overtime, penalties) | ~200 |
| `005_leave.sql` | `leave_policies`, `leave_balances`, `leave_requests` | ~80 |
| `006_payroll.sql` | `payslips`, `payroll_runs`, `payroll_adjustments`, `final_pay_computations`, `pay_schedule_config` | ~150 |
| `007_loans.sql` | `loans`, `loan_deductions`, `loan_repayment_schedule`, `loan_balance_history` | ~80 |
| `008_tasks_messaging.sql` | Tasks + messaging tables | ~120 |
| `009_audit_notifications.sql` | `audit_logs`, `notification_logs`, `notification_rules` | ~80 |
| `010_projects_timesheets_settings.sql` | Projects, timesheets, rule sets, calendar, kiosk/location/appearance configs | ~120 |
| `011_rls_policies.sql` | All Row-Level Security policies | ~200 |
| `012_seed_data.sql` | Seed admin account, default holidays, default shifts, default leave policies | ~100 |

---

## 12. Frontend Integration Strategy

### Approach: Hybrid (Zustand + Supabase)

We keep the existing Zustand stores as the source of truth for the UI, but add a **service layer** (`src/services/`) that syncs data between Supabase and Zustand.

```
src/services/
├── supabase.ts          — Supabase client singleton
├── auth.service.ts      — signIn, signOut, createUser, getCurrentUser
├── employees.service.ts — CRUD employees via Supabase
├── attendance.service.ts
├── leave.service.ts
├── payroll.service.ts
├── loans.service.ts
├── tasks.service.ts
└── ...
```

### Pattern for each service:
```typescript
// Example: employees.service.ts
import { supabase } from './supabase';

export async function fetchEmployees() {
  const { data, error } = await supabase.from('employees').select('*');
  if (error) throw error;
  return data;
}

export async function createEmployee(employee: Omit<Employee, 'id'>) {
  const { data, error } = await supabase.from('employees').insert(employee).select().single();
  if (error) throw error;
  return data;
}
```

### Store hydration pattern:
```typescript
// In page component or layout
useEffect(() => {
  fetchEmployees().then((data) => {
    useEmployeesStore.setState({ employees: data });
  });
}, []);
```

This keeps all 653+ existing tests passing (they test Zustand stores directly) while data now comes from Supabase.

---

## 13. Sign-In Flow (No Sign-Up)

### Frontend Flow
```
/login → email + password → supabase.auth.signInWithPassword()
       → fetch profile from profiles table
       → store in Zustand auth store
       → redirect to /${role}/dashboard
```

### Account Creation (Admin Only)
```
Admin → /settings → Create Account
     → POST to Next.js Server Action / API Route
     → supabase.auth.admin.createUser({ email, password, email_confirm: true })
     → INSERT into profiles (name, email, role, ...)
     → INSERT into employees (if needed)
     → Return success
```

**Why Server Action for admin.createUser?**
`supabase.auth.admin` requires the **service_role** key which must NEVER be exposed to the browser. So account creation goes through a Next.js API route or Server Action.

### Environment Variables Needed
```env
NEXT_PUBLIC_SUPABASE_URL=https://ytulzzftxjlmtqwukdqq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard → Settings → API>
```

---

## 14. Row-Level Security (RLS) Strategy

### Principle
Every table has RLS enabled. Policies use `auth.uid()` to identify the current user and their role from `profiles`.

### Helper function (created in migration 011):
```sql
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Policy patterns:
| Role | Read | Write |
|---|---|---|
| **admin** | All rows in all tables | All rows |
| **hr** | All employees, attendance, leave | Create/edit employees, approve leave |
| **finance** | All payroll, loans | Issue payslips, approve adjustments |
| **employee** | Own records only | Own leave requests, own attendance, sign payslips |
| **supervisor** | Team members | Approve team leave/overtime |
| **payroll_admin** | Payroll + loans | Run payroll, manage loans |
| **auditor** | All (read-only) | Nothing |

---

## 15. Current Feature → Table Mapping

| Zustand Store | Tables Created | Priority |
|---|---|---|
| `auth.store.ts` | `profiles` (+ Supabase Auth `auth.users`) | P0 |
| `employees.store.ts` | `employees`, `salary_change_requests`, `salary_history`, `employee_documents` | P1 |
| `roles.store.ts` | `roles_custom` | P2 |
| `attendance.store.ts` | `attendance_events`, `attendance_evidence`, `attendance_exceptions`, `attendance_logs`, `shift_templates`, `employee_shifts`, `holidays`, `overtime_requests`, `penalty_records` | P3 |
| `leave.store.ts` | `leave_policies`, `leave_balances`, `leave_requests` | P4 |
| `payroll.store.ts` | `payslips`, `payroll_runs`, `payroll_adjustments`, `final_pay_computations`, `pay_schedule_config` | P5 |
| `loans.store.ts` | `loans`, `loan_deductions`, `loan_repayment_schedule`, `loan_balance_history` | P6 |
| `tasks.store.ts` | `task_groups`, `tasks`, `task_completion_reports`, `task_comments` | P7 |
| `messaging.store.ts` | `announcements`, `text_channels`, `channel_messages` | P7 |
| `audit.store.ts` | `audit_logs` | P8 |
| `notifications.store.ts` | `notification_logs`, `notification_rules` | P8 |
| `projects.store.ts` | `projects` | P8 |
| `timesheet.store.ts` | `timesheets`, `attendance_rule_sets` | P8 |
| `events.store.ts` | `calendar_events` | P9 |
| `kiosk.store.ts` | `kiosk_settings` | P9 |
| `location.store.ts` | `location_config` | P9 |
| `appearance.store.ts` | `appearance_config` | P9 |
| `ui.store.ts` | *No table* — client-only UI state | — |
| `page-builder.store.ts` | *Future migration* | — |

---

## Next Steps

1. ✅ Run each SQL migration file in Supabase SQL Editor (in order 001→012)
2. ✅ Install `@supabase/supabase-js` and `@supabase/ssr`
3. ✅ Create `src/services/supabase.ts` client
4. ✅ Build sign-in flow (replace demo btoa auth)
5. ✅ Create admin account creation API route
6. ✅ Gradually migrate each store to fetch from Supabase
7. ✅ Keep Zustand stores + tests intact throughout
