# SaaS Readiness Audit Report
**Date:** April 29, 2026  
**Branch:** `feature/aedrian-saas-multitenancy-audit`  
**Status:** Scaffold Migrations Created (017–019)

---

## Executive Summary

NexHRMS v2 is **single-tenant by design**. This audit introduces multi-tenancy scaffolding:
- **Companies table** created (migration 017)
- **24+ core business tables** now include nullable `company_id` columns with indexes
- **Appearance config** now tenant-aware (migration 018)
- **RLS policy templates** provided (migration 019)

**No breaking changes.** Single-tenant deployments work as-is; `company_id` defaults to `'default'`.

---

## Table Coverage Status

### ✅ Tables with `company_id` added (Migration 017)

**Core Business:**
- `employees` — employee data scoped per company
- `profiles` — user profiles scoped per company
- `projects` — project assignments per company
- `project_assignments` — project-to-employee links
- `project_verification_methods` — verification settings per company
- `tasks` — task lists per company
- `task_groups` — task grouping per company
- `task_comments` — task discussion per company
- `announcements` — company-wide announcements
- `notification_logs` — per-company notifications
- `notification_rules` — per-company notification rules
- `attendance_events` — attendance per company
- `attendance_logs` — attendance records per company
- `timesheets` — timesheets per company
- `leave_requests` — leave requests per company
- `leave_balances` — leave balances per company
- `payroll_runs` — payroll runs per company
- `payslips` — payslips per company
- `payroll_run_payslips` — payroll run items per company
- `payslip_line_items` — payslip line items per company
- `employee_documents` — employee documents per company
- `push_subscriptions` — push subscriptions per company
- `kiosk_devices` — kiosk devices per company
- `kiosk_pins` — kiosk access pins per company
- `qr_tokens` — QR tokens per company
- `face_enrollments` — face enrollment per company
- `dashboard_layouts` — dashboard layouts per company
- `custom_pages` — custom pages per company
- `loans` — employee loans per company

**Appearance & Configuration (Migration 018):**
- `appearance_config` — company branding/themes

### ⚠️ Foundation Tables (No `company_id` yet)

These are typically **global/system-level** settings. Consider whether they should be per-company or global:

**Tenant-Agnostic (likely global):**
- `shift_templates` — can be global or per-company (recommend adding `company_id` for flexibility)
- `roles_custom` — custom roles (likely global, or per-company for flexibility)
- `holidays` — holidays (likely global, or per-company for regional differences)
- `calendar_events` — calendar events (recommend per-company)
- `attendance_rule_sets` — attendance rules (recommend per-company for policies per company)
- `gov_table_versions` — government pay tables (should be global)
- `job_titles` — job titles (recommend per-company for org-specific roles)
- `departments` — departments (recommend per-company)
- `leave_policies` — leave policy definitions (recommend per-company)
- `manual_checkin_reasons` — checkin reasons (recommend per-company)
- `task_tags` — task tags (recommend per-company)

**Configuration Tables (should be per-company):**
- `location_config` — location tracking settings (NOT YET `company_id`)
- `pay_schedule_config` — pay schedule settings (NOT YET `company_id`)
- `payroll_signature_config` — payroll signature settings (NOT YET `company_id`)
- `deduction_global_defaults` — deduction defaults (NOT YET `company_id`)
- `deduction_templates` — deduction templates (NOT YET `company_id`)

**Remaining Tables:**
- `attendance_evidence` — evidence records (part of attendance, recommend adding `company_id`)
- `attendance_exceptions` — exceptions (recommend adding `company_id`)
- `break_records` — break records (recommend adding `company_id`)
- `overtime_requests` — overtime requests (recommend adding `company_id`)
- `location_pings` — location pings (recommend adding `company_id`)
- `employee_shifts` — employee shifts (recommend adding `company_id`)
- `penalty_records` — penalty records (recommend adding `company_id`)
- `manual_checkins` — manual checkins (recommend adding `company_id`)
- `site_survey_photos` — site survey photos (recommend adding `company_id`)
- `loan_deductions` — loan deduction records (recommend adding `company_id`)
- `loan_balance_history` — loan balance history (recommend adding `company_id`)
- `loan_repayment_schedule` — loan repayment schedule (recommend adding `company_id`)
- `task_completion_reports` — task completion reports (recommend adding `company_id`)
- `text_channels` — messaging channels (recommend adding `company_id`)
- `channel_messages` — messages (recommend adding `company_id`)
- `salary_history` — salary history (recommend adding `company_id`)
- `salary_change_requests` — salary change requests (recommend adding `company_id`)
- `final_pay_computations` — final pay computations (recommend adding `company_id`)
- `deduction_overrides` — deduction overrides (recommend adding `company_id`)
- `employee_deduction_assignments` — deduction assignments (recommend adding `company_id`)
- `audit_logs` — audit logs (consider per-company for compliance)

---

## RLS Policy Status

**Current State:** Existing RLS policies do NOT include `company_id` filtering.

**Impact:**
- All users can see data from all companies if company_id column is not enforced in policies.
- Must update RLS policies to filter by `company_id = current_setting('jwt.claims.company_id')`.

**Recommendation:**
1. Update JWT claims to include `company_id` (or use `org_id`/`company`).
2. Apply company-scoped RLS policies to all tables with `company_id`.
3. Test in staging before production.

**Template:** See `supabase/migrations/019_company_rls_policy_templates.sql`

---

## Auth & Onboarding Flow

**Current Status:**
- No multi-company signup/onboarding flow.
- No company creation endpoint.
- User auth does not link to a company at signup.

**Recommended Changes:**
1. Add company selection/creation to signup flow.
2. Store `company_id` in user metadata or profiles table.
3. Fetch and set `company_id` in JWT on login.
4. Add company switching/selection UI (if multi-company per user is desired).

---

## Billing Integration

**Current Status:** No Stripe/Paddle integration found in app source (only in docs/prompts).

**Recommended Schema:**
```sql
CREATE TABLE public.subscriptions (
  id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id),
  stripe_subscription_id text UNIQUE,
  status text CHECK (status = ANY(ARRAY['active', 'past_due', 'canceled', 'unpaid'])),
  plan text NOT NULL,
  billing_cycle_anchor timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.invoices (
  id text PRIMARY KEY,
  company_id text NOT NULL REFERENCES public.companies(id),
  subscription_id text REFERENCES public.subscriptions(id),
  stripe_invoice_id text UNIQUE,
  amount_due numeric NOT NULL,
  amount_paid numeric DEFAULT 0,
  status text,
  created_at timestamptz DEFAULT now()
);
```

**Webhook Handler:**
- Create an Edge Function or API route to receive Stripe webhooks.
- Verify webhook signature.
- Update subscription and invoice tables.
- Emit events for UI updates (e.g., "subscription expired").

---

## Next Steps (In Priority Order)

### Phase 1: Scaffolding (Complete ✅)
- [x] Create `companies` table (migration 017)
- [x] Add `company_id` to core business tables (migration 017)
- [x] Add `company_id` to appearance_config (migration 018)
- [x] Provide RLS policy templates (migration 019)

### Phase 2: Coverage (Next)
- [ ] Create migration 020 to add `company_id` to remaining tables (attendance_evidence, break_records, loan_deductions, etc.)
- [ ] Create migration 021 to add `company_id` to config tables (location_config, pay_schedule_config, deduction_templates, etc.)
- [ ] Create migration 022 to add `company_id` to foundation tables marked as per-company (shift_templates, job_titles, departments, etc.)

### Phase 3: RLS Hardening (After Phase 2)
- [ ] Add company-scoped RLS policies to all tables with `company_id`.
- [ ] Test policies thoroughly in staging.
- [ ] Gradually enable RLS policies by environment.

### Phase 4: Auth & Onboarding (After Phase 3)
- [ ] Update signup flow to create/select a company.
- [ ] Update JWT claims to include `company_id`.
- [ ] Add company switching UI (if multi-company per user).
- [ ] Update all API routes and server actions to filter by company_id.

### Phase 5: Billing (After Phase 4)
- [ ] Create subscriptions and invoices tables.
- [ ] Create Stripe webhook handler.
- [ ] Implement billing UI (plan selection, payment method, invoice history).
- [ ] Add billing checks to protected endpoints (e.g., feature gates by plan).

---

## Implementation Notes

**Safe to Run Now:**
- Migrations 017–019 are non-breaking. Existing single-tenant deployments will backfill `company_id = 'default'`.

**Before Proceeding:**
1. Test migrations in a staging/dev environment.
2. Verify data integrity after migrations.
3. Plan JWT claim updates (when/how to add `company_id`).
4. Establish company-to-user mapping strategy (1:1, 1:N, multi-org per user?).

**Git Workflow:**
- Branch: `feature/aedrian-saas-multitenancy-audit`
- Migrations: `supabase/migrations/017-022` (scaffold + coverage + hardening)
- When ready: create PR and merge to `main` (or staging first).

---

## Glossary

- **Company:** Top-level tenant. Each company has its own set of employees, payroll, projects, etc.
- **Tenant ID:** Foreign key to `companies(id)`. Stored in Supabase `profiles.company_id` and JWT claims.
- **RLS (Row-Level Security):** Supabase policy to restrict rows visible to authenticated users based on claims.
- **JWT Claims:** Custom attributes in the auth token (e.g., `company_id`, `role`). Used by RLS policies.

---

## Questions or Issues?

- Review [IMPROVEMENTS.md](IMPROVEMENTS.md) for known RLS and security gaps.
- Review [V2_SYNC_CONTEXT.md](V2_SYNC_CONTEXT.md) for migration history and RLS coverage notes.
- See prompts in `.github/agents/` for architecture and security review workflows.

---

**Report Generated:** April 29, 2026  
**Status:** Ready for Phase 2 (Coverage)
