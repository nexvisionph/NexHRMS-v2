# NexHRMS — Batch 3 Feature List
## Sources: GreatDay HR Demo (April 28, 2026) + NexHRMS v2 Codebase Audit

**Total Features:** 20  
**Range:** Light → High complexity  
**Basis:** What exists in codebase vs what was shown in demo vs Malcolm's architecture directive

---

## Quick Reference Table

| # | Feature | Source | Complexity | Priority |
|---|---------|--------|-----------|----------|
| 01 | Payslip Password Protection | GreatDay HR Demo | 🟢 Light | 🔴 High |
| 02 | WFH / Offsite Attendance Status Badge | Codebase Gap | 🟢 Light | 🔴 High |
| 03 | Late & Absent Auto-Notification | Malcolm Directive | 🟢 Light | 🟠 Medium |
| 04 | Attendance Break Time Tracking | GreatDay HR Demo | 🟡 Medium | 🔴 High |
| 05 | Suspect Attendance Flagging & Review | GreatDay HR Demo | 🟡 Medium | 🔴 High |
| 06 | WFH / Offsite Request Workflow | GreatDay HR Demo | 🟡 Medium | 🔴 High |
| 07 | Payroll Pre-Run Readiness Checklist | Internal | 🟡 Medium | 🔴 High |
| 08 | Payroll Variance Detector | GreatDay HR Demo | 🟡 Medium | 🔴 High |
| 09 | Attendance Review Step in Payroll | GreatDay HR Demo | 🟡 Medium | 🟠 Medium |
| 10 | Employee Survey & Polling | GreatDay HR Demo | 🟡 Medium | 🟠 Medium |
| 11 | Onboarding Checklist | GreatDay HR Demo | 🟡 Medium | 🟠 Medium |
| 12 | Business Trip / Offsite Work Request | GreatDay HR Demo | 🟡 Medium | 🟠 Medium |
| 13 | Claims & Reimbursement Module | GreatDay HR Demo | 🟡 Medium | 🟠 Medium |
| 14 | Document Expiry Tracker | Internal | 🟡 Medium | 🟡 Low-Med |
| 15 | Commission / Client-Based Pay Component | Demo Client Use Case | 🟡 Medium | 🟡 Low-Med |
| 16 | Daily Activity Tracker with GPS Map | GreatDay HR Demo | 🔴 High | 🔴 High |
| 17 | Guided Payroll Run Wizard | GreatDay HR Demo | 🔴 High | 🔴 High |
| 18 | KPI Templates & Evaluation Module | Malcolm Directive | 🔴 High | 🟠 Medium |
| 19 | Multi-Company Tenant Switcher | Malcolm Directive | 🔴 High | 🔴 High |
| 20 | AI-Assisted HR Actions | Malcolm Directive | 🔴 High | 🟠 Medium |

---

---
## 🟢 LIGHT COMPLEXITY
---

### FEATURE 01 — Payslip Password Protection
**Source:** GreatDay HR Demo (page 35 of demo notes — "Password protected")  
**Complexity:** 🟢 Light (~2–4 hours)  
**Priority:** 🔴 High  
**Codebase Status:** Not implemented. `printable-payslip.tsx` uses browser print-to-PDF only.

**What It Is:**  
Downloaded payslip PDFs are encrypted with a password derived from the employee's data. The Admin configures the password format from the payroll settings page (e.g. birthdate MMDDYYYY, last 4 digits of employee number).

**Why It Matters:**  
GreatDay HR showed this as a selling point. It directly addresses Philippine Data Privacy Act compliance for HR data. It's a one-screen feature that every boss in a demo will physically see and remember.

**Files Affected:**
- `src/components/payroll/printable-payslip.tsx`
- `src/app/[role]/payroll/settings/page.tsx`
- `src/store/payroll.store.ts` (add `payslipConfig` setting)
- New util: `src/lib/payslip-pdf.ts`

---

### FEATURE 02 — WFH / Offsite Attendance Status Badge
**Source:** Codebase gap — WFH status exists in `attendance-heatmap.tsx` but has no workflow  
**Complexity:** 🟢 Light (~half a day)  
**Priority:** 🔴 High  
**Codebase Status:** `attendance-heatmap.tsx` already has `wfh` as a valid `HeatmapStatus` but no way to set it. The status is dead code.

**What It Is:**  
Activate the already-existing WFH status in the attendance system. HR or Admin can tag an employee as WFH for a specific date, and the heatmap, attendance list, and exception generator all recognize it as a valid attendance type — not absent, not suspect.

**Why It Matters:**  
Without this, any employee working from home either shows as absent or triggers a suspect geo-fence flag. The status already exists in the heatmap component — this just connects it to an actual workflow.

**Files Affected:**
- `src/store/attendance.store.ts` (add `setWFHStatus` action)
- `src/app/[role]/attendance/_views/admin-view.tsx` (add WFH tag button)
- `src/components/attendance/attendance-heatmap.tsx` (already WFH-ready, no change needed)

---

### FEATURE 03 — Late & Absent Auto-Notification to Employee
**Source:** Malcolm's directive — "Missing clock out, Late attendance" notifications  
**Complexity:** 🟢 Light (~1 day)  
**Priority:** 🟠 Medium  
**Codebase Status:** `notifications.store.ts` exists. `autoGenerateExceptions` generates `missing_out` and `late` flags. But no notification is dispatched when these flags are created.

**What It Is:**  
When the system auto-generates a `late` or `missing_out` exception for an employee, it automatically dispatches an in-app notification to that employee letting them know: "You have been flagged as late today" or "Your clock-out is missing for [date]."

**Why It Matters:**  
Employees currently discover attendance issues only during payroll or when HR reaches out. Early notification gives employees time to file a correction request before the pay period closes, reducing HR manual work.

**Files Affected:**
- `src/store/attendance.store.ts` — `autoGenerateExceptions` function
- `src/store/notifications.store.ts` — add new notification types
- `src/lib/notifications.ts` — `dispatchNotification` helper

---

---
## 🟡 MEDIUM COMPLEXITY
---

### FEATURE 04 — Break Time Tracking with Auto-Deduction
**Source:** GreatDay HR Demo (pages 9–10 of demo notes)  
**Complexity:** 🟡 Medium (~2–3 days)  
**Priority:** 🔴 High  
**Codebase Status:** Not implemented. No break tracking exists in `attendance.store.ts` or the attendance event types.

**What It Is:**  
Employees log break start and end from the mobile app or kiosk. The system records break duration and auto-calculates whether the employee exceeded the allowed break time. Excess break time is automatically queued as a deduction for the next payroll run.

**Why NexHRMS Wins Over GreatDay HR:**  
The competitor explicitly admitted during the demo: *"Si system nalate sa break di nadedetect — manual pa rin."* GreatDay HR records breaks but cannot auto-detect or auto-deduct break overtime. NexHRMS can own this entirely.

**Files Affected:**
- `src/types/index.ts` — add `BreakEvent` type, add `breakEvents` to `AttendanceLog`
- `src/store/attendance.store.ts` — add `startBreak`, `endBreak`, `getBreakSummary` actions
- `src/store/payroll.store.ts` — read queued break deductions during payslip issuance
- `src/app/[role]/attendance/_views/admin-view.tsx` — break summary column
- New component: `src/components/attendance/break-time-tracker.tsx`

---

### FEATURE 05 — Suspect Attendance Flagging & Admin Review
**Source:** GreatDay HR Demo (page 9 and 16 of demo notes — "suspect attendance report")  
**Complexity:** 🟡 Medium (~1–2 days)  
**Priority:** 🔴 High  
**Codebase Status:** `AttendanceFlag` type in `types/index.ts` already includes `"out_of_geofence"`. `autoGenerateExceptions` already generates this flag. But it is not visually distinguished in the admin view — no badge, no filter, no review action.

**What It Is:**  
When an employee clocks in outside their geo-fence, attendance is still recorded but immediately tagged "suspect" and surfaced with a red badge in the attendance admin view with instant HR notification. Admin can approve (valid reason, e.g. client visit) or escalate to NTE. All decisions are logged in the audit trail.

**Why NexHRMS Wins Over GreatDay HR:**  
GreatDay HR buries suspect records in a separate Suspect Attendance Report that admin has to find. NexHRMS surfaces it live the moment it happens — same screen, same session.

**Files Affected:**
- `src/app/[role]/attendance/_views/admin-view.tsx` — add suspect badge, filter tab, review action
- `src/store/attendance.store.ts` — add `resolveException` suspect-specific path
- `src/store/notifications.store.ts` — dispatch real-time notification on geo-fence violation
- `src/lib/notifications.ts`

---

### FEATURE 06 — WFH / Offsite Request Workflow
**Source:** GreatDay HR Demo + Malcolm's attendance directive  
**Complexity:** 🟡 Medium (~2–3 days)  
**Priority:** 🔴 High  
**Codebase Status:** WFH status exists in heatmap (see FEATURE 02), but there is no employee-facing request flow. Leave module exists and can serve as the workflow pattern.

**What It Is:**  
A formal request flow where employees can submit WFH or offsite requests (like a leave request). Manager approves, HR confirms, and the system automatically adjusts geo-fence enforcement for that employee on the approved date. Geo-fence is relaxed only for the approved date — not permanently.

**Files Affected:**
- `src/types/index.ts` — add `WFHRequest` type
- New store: `src/store/wfh.store.ts` (or extend leave.store.ts)
- `src/app/[role]/attendance/_views/employee-view.tsx` — add WFH request button
- `src/app/[role]/attendance/_views/admin-view.tsx` — add WFH approval panel
- `src/store/attendance.store.ts` — check WFH approval before flagging as suspect

---

### FEATURE 07 — Payroll Pre-Run Readiness Checklist
**Source:** Internal best practice  
**Complexity:** 🟡 Medium (~1–2 days)  
**Priority:** 🔴 High  
**Codebase Status:** Not implemented. Lock button in `admin-view.tsx` has no validation gate.

**What It Is:**  
Before Finance can lock a payroll run, the system displays a live checklist validating all preconditions — missing clock-outs, unapproved OT, zero or negative net pay, pending leave requests. The Lock button is disabled until all blocking checks pass.

**Files Affected:**
- New component: `src/components/payroll/payroll-readiness-checklist.tsx`
- `src/app/[role]/payroll/_views/admin-view.tsx` — add above the Lock button
- `src/store/payroll.store.ts`, `attendance.store.ts`, `leave.store.ts` — read-only data sources

---

### FEATURE 08 — Payroll Variance Detector
**Source:** GreatDay HR Demo (page 33 — "Payroll Variance" tab in Report step)  
**Complexity:** 🟡 Medium (~1–2 days)  
**Priority:** 🔴 High  
**Codebase Status:** Not implemented. Prior payslips are accessible from `payroll.store.ts` — comparison logic just needs to be built.

**What It Is:**  
Before payslips are published, compares each employee's current net pay against their previous payslip and flags significant changes (±15% = warning, ±25% = critical, ₱0 or negative = block). Finance sees a table sorted by severity before publishing.

**Files Affected:**
- New component: `src/components/payroll/payroll-variance-detector.tsx`
- `src/app/[role]/payroll/_views/admin-view.tsx` — add between payslip list and publish controls
- `src/store/payroll.store.ts` — read-only data source

---

### FEATURE 09 — Attendance Data Review Step Before Payroll Lock
**Source:** GreatDay HR Demo (Step 3 of payroll wizard — "Attendance Data")  
**Complexity:** 🟡 Medium (~2 days)  
**Priority:** 🟠 Medium  
**Codebase Status:** Not implemented. Payroll and attendance are currently in separate tabs with no pre-lock cross-check.

**What It Is:**  
Before locking a payroll run, HR sees a summary of each employee's attendance metrics for the pay period — absences, OT hours, undertime, pending corrections — all in one view. HR can jump to fix any issue before locking.

**Files Affected:**
- New component: `src/components/payroll/payroll-attendance-review.tsx`
- `src/app/[role]/payroll/_views/admin-view.tsx`
- `src/store/attendance.store.ts` — add `getAttendanceSummaryForPeriod` selector

---

### FEATURE 10 — Employee Survey & Polling
**Source:** GreatDay HR Demo (dashboard — "Employee Survey" panel shown)  
**Complexity:** 🟡 Medium (~2–3 days)  
**Priority:** 🟠 Medium  
**Codebase Status:** Not implemented. No survey/poll infrastructure exists. `messaging.store.ts` has announcements which can serve as a UI pattern.

**What It Is:**  
HR creates quick surveys or polls and sends them to employees or specific departments. Employees respond from mobile or web. Results visible to HR in real time. Supports multiple choice, rating (1–5), yes/no, and acknowledgment (e-sign for policy reading confirmation).

**Files Affected:**
- `src/types/index.ts` — add `Survey`, `SurveyQuestion`, `SurveyResponse` types
- New store: `src/store/survey.store.ts`
- New page: `src/app/[role]/surveys/page.tsx`
- `src/components/dashboard/admin-dashboard.tsx` — add survey results widget
- `src/components/dashboard/employee-dashboard.tsx` — add pending survey prompt

---

### FEATURE 11 — Employee Onboarding Checklist
**Source:** GreatDay HR Demo (employee mobile dashboard — "My Onboarding" shortcut)  
**Complexity:** 🟡 Medium (~2–3 days)  
**Priority:** 🟠 Medium  
**Codebase Status:** The seed data references an onboarding checklist in a message (`MSG-007`) but no module exists. `documents.store.ts` and `employees.store.ts` exist and can provide the data.

**What It Is:**  
When a new employee is created, a structured onboarding checklist is auto-generated. Tracks completion of required steps — document submission, government ID upload, policy acknowledgment, schedule assignment, payroll enrollment. Visible to both employee and HR with a completion percentage.

**Files Affected:**
- `src/types/index.ts` — add `OnboardingChecklist`, `OnboardingStep` types
- New store: `src/store/onboarding.store.ts`
- New page: `src/app/[role]/onboarding/page.tsx`
- `src/store/employees.store.ts` — trigger checklist creation on new employee
- `src/components/dashboard/employee-dashboard.tsx` — add onboarding progress widget

---

### FEATURE 12 — Business Trip / Offsite Work Request
**Source:** GreatDay HR Demo (mobile features list — "Business Trip Request, Manage Purpose Type, Business Trip Report")  
**Complexity:** 🟡 Medium (~2–3 days)  
**Priority:** 🟠 Medium  
**Codebase Status:** Not implemented. Projects module exists but doesn't handle offsite work declarations with GPS and approval flow.

**What It Is:**  
Employees submit a business trip or offsite work request with: purpose, client/location, start and end date/time, transportation type. Manager approves. Once approved, the employee's attendance geo-fence is automatically suspended for the trip duration and replaced with a "business trip" status.

**Files Affected:**
- `src/types/index.ts` — add `BusinessTrip` type
- New store: `src/store/business-trips.store.ts`
- New page: `src/app/[role]/business-trips/page.tsx`
- `src/store/attendance.store.ts` — check for active business trip before flagging suspect

---

### FEATURE 13 — Claims & Reimbursement Module
**Source:** GreatDay HR Demo (pages 23–24 — "Claim Type", "Claim Form", "petty cash", "upload resibo")  
**Complexity:** 🟡 Medium (~3 days)  
**Priority:** 🟠 Medium  
**Codebase Status:** `payroll-payment` feature types reference `claimStartDate` and `claimEndDate` but no reimbursement module exists. `loans.store.ts` is separate.

**What It Is:**  
Employees submit reimbursement requests for transportation, medical, meals, petty cash, etc. with receipt uploads. Admin-configurable claim types with per-month limits. Finance reviews and decides to include in next payroll or disburse separately.

**Files Affected:**
- `src/types/index.ts` — add `ClaimType`, `ClaimRequest`, `ClaimItem` types
- New store: `src/store/claims.store.ts`
- New page: `src/app/[role]/claims/page.tsx`
- `src/store/payroll.store.ts` — add approved claims to payslip computation
- `src/app/[role]/payroll/_views/admin-view.tsx` — claims summary before lock

---

### FEATURE 14 — Document Expiry Tracker
**Source:** Internal — Malcolm's 201 file directive ("track from hiring to resignation")  
**Complexity:** 🟡 Medium (~1–2 days)  
**Priority:** 🟡 Low-Med  
**Codebase Status:** `documents.store.ts` exists. Document types are uploaded to 201 files. But no expiry date tracking or alert system exists.

**What It Is:**  
Each uploaded document in the 201 file can have an expiry date. The system tracks approaching expiries and alerts HR at 60, 30, and 14 days before. A "Documents Expiring Soon" widget appears on the HR dashboard and a summary report is available.

**Files Affected:**
- `src/types/index.ts` — add `expiryDate` to document type
- `src/store/documents.store.ts` — add `getExpiringDocuments(daysUntil)` selector
- `src/app/[role]/employees/201-files/_views/admin-view.tsx` — add expiry date field
- `src/components/dashboard/admin-dashboard.tsx` — add expiry tracker widget
- `src/store/notifications.store.ts` — dispatch expiry notifications

---

### FEATURE 15 — Commission / Client-Based Pay Component
**Source:** GreatDay HR Demo (page 17 — "client based rate, may commission, may fixed na sahod plus may additional")  
**Complexity:** 🟡 Medium (~2 days)  
**Priority:** 🟡 Low-Med  
**Codebase Status:** `deductions.store.ts` has custom deduction templates. No equivalent commission or client-based earnings template exists on the income side.

**What It Is:**  
Adds a commission and variable pay component to the payroll system. Finance can input commissions per employee per pay period (from sales data or manual entry). Commissions appear as a separate taxable earnings line on the payslip. Supports both fixed + commission structures and pure client-rate structures.

**Files Affected:**
- `src/types/index.ts` — add `commission` field to `Payslip`
- `src/store/payroll.store.ts` — add `addCommission` action
- `src/app/[role]/payroll/_views/admin-view.tsx` — add commission input per employee
- `src/components/payroll/printable-payslip.tsx` — show commission line

---

---
## 🔴 HIGH COMPLEXITY
---

### FEATURE 16 — Daily Activity Tracker with GPS Map View
**Source:** GreatDay HR Demo (pages 18–20 — "Daily Activity", activity recording with GPS map + photo, timesheet)  
**Complexity:** 🔴 High (~1 week)  
**Priority:** 🔴 High  
**Codebase Status:** `tasks.store.ts`, `projects.store.ts`, and `timesheet.store.ts` all exist. But none have GPS location recording, map visualization, or activity photo capture linked to a client/task.

**What It Is:**  
Field employees log activities throughout the day — each log has: task description, client/project tag, activity type, start time, end time, GPS coordinates, photo. A map view shows where the employee was during the day. Supervisor sees team activity feed. Results feed into timesheets and KPI data.

**Why It's High Priority:**  
This directly addresses the client use case described in the demo — sales and field staff who don't complete 8 hours in one location but need to prove they visited clients. It's also the foundation for commission tracking (FEATURE 15) since it provides client visit proof.

**Files Affected:**
- `src/types/index.ts` — add `ActivityLog`, `ActivityLogPhoto` types
- New store: `src/store/activity-log.store.ts`
- New pages: `src/app/[role]/activity/page.tsx`, `src/app/[role]/activity/map/page.tsx`
- `src/components/activity/activity-recorder.tsx` — GPS + photo capture
- `src/components/activity/activity-map.tsx` — map view using leaflet or similar
- `src/store/timesheet.store.ts` — link activity logs to timesheet entries

---

### FEATURE 17 — Guided Payroll Run Wizard
**Source:** GreatDay HR Demo (full payroll wizard — Schedule → Head Count → Attendance → Data → Process → Report → Publish)  
**Complexity:** 🔴 High (~1–2 weeks)  
**Priority:** 🔴 High  
**Codebase Status:** `admin-view.tsx` uses a flat tab structure. All the underlying data (attendance summaries, head count, component values, reports) already exists in their respective stores — the wizard is primarily a UX restructuring task.

**What It Is:**  
Converts the flat payroll tab view into a guided step-by-step wizard for Finance. Steps: (1) Configure period & components → (2) Select employees → (3) Review attendance data → (4) Review per-employee pay breakdown → (5) Process with progress indicator → (6) Reports (summary, variance, bank, statutory) → (7) Publish payslips.

**Files Affected:**
- New component: `src/components/payroll/payroll-run-wizard.tsx`
- `src/app/[role]/payroll/_views/admin-view.tsx` — add wizard mode toggle
- `src/components/payroll/wizard-steps/` — new folder with one component per step
- `src/store/payroll.store.ts` — add `runWizardState` (current step, selections)

---

### FEATURE 18 — KPI Templates & Evaluation Module
**Source:** Malcolm's directive — "KPI templates per role, manager evaluates, results in 201 file"  
**Complexity:** 🔴 High (~1–2 weeks)  
**Priority:** 🟠 Medium  
**Codebase Status:** `performance.store.ts` has `PerformanceCycle`, `PerformanceCriterion`, `PerformanceReview`, `PerformanceSalaryAdjustment`. This is a strong foundation but KPI templates per role (sales, marketing, manager) with specific metrics and weightings are not yet defined.

**What It Is:**  
Role-specific KPI templates with weighted metrics. Sales template: customers assisted, products recommended, sales closed, total amount, attendance, grooming, behavior. Evaluation flow: Manager evaluates → Employee views → HR records → Final score saved → History in 201 file. KPI results feed into incentives, promotions, salary reviews, and termination support.

**Files Affected:**
- `src/types/index.ts` — extend `PerformanceCriterion` with role-specific fields
- `src/store/performance.store.ts` — add `kpiTemplates`, `addKPITemplate`, `evaluateKPI`
- New page: `src/app/[role]/performance/kpi-templates/page.tsx`
- `src/app/[role]/performance/reviews/` — update to use KPI template structure
- `src/app/[role]/employees/[id]/_views/admin-view.tsx` — KPI history tab in 201 file

---

### FEATURE 19 — Multi-Company Tenant Switcher
**Source:** Malcolm's directive — "SaaS-ready, company_id in every table, Super Admin sees all companies"  
**Complexity:** 🔴 High (~2 weeks)  
**Priority:** 🔴 High  
**Codebase Status:** Single-tenant. `auth.store.ts` has a single `currentUser` with one role. No `company_id` concept exists in the store layer. Database migrations would need to add `company_id` to all key tables.

**What It Is:**  
A Super Admin (NexVision staff) can manage all client companies from one login. A Company Admin only sees their own company. The tenant switcher in the top nav allows Super Admin to switch between companies without logging out. All queries are automatically scoped by the active tenant's `company_id`.

**Files Affected:**
- `src/types/index.ts` — add `Company`, `TenantSession` types
- `src/store/auth.store.ts` — add `activeCompanyId`, `switchCompany` action
- `src/store/employees.store.ts` and all other stores — add `company_id` filter to all queries
- New page: `src/app/[role]/settings/companies/page.tsx`
- Supabase migrations — add `company_id` column to all key tables
- New middleware: `src/middleware/tenant.ts` — enforce company_id in all API routes

---

### FEATURE 20 — AI-Assisted HR Actions
**Source:** Malcolm's directive — "AI must follow role-based permissions, structured action buttons"  
**Complexity:** 🔴 High (~1–2 weeks)  
**Priority:** 🟠 Medium  
**Codebase Status:** Not implemented. No AI integration layer exists. Anthropic API access would be used.

**What It Is:**  
Role-based AI assistant with structured action buttons — not a free chat box. Employees see buttons like "Explain my payslip" and "Show my attendance this week." HR sees "Draft NTE," "Summarize attendance," and "Flag late employees." All AI calls go through a permission layer before any data is passed to the model. Every AI action is logged.

**AI Action Buttons Per Role:**

| Role | Available Actions |
|------|------------------|
| Employee | Explain my payslip, Show my attendance, Check my leave balance, What are my deductions |
| Supervisor | Summarize team attendance, List late employees, Draft performance comment, Check team leave overlaps |
| HR / Admin | Draft NTE, Draft NOD, Summarize employee record, Flag attendance anomalies, Generate HR report summary |

**Files Affected:**
- New store: `src/store/ai.store.ts` — log AI usage, manage session context
- New service: `src/services/ai-actions.service.ts` — permission-gated Anthropic API calls
- New component: `src/components/ai/ai-action-panel.tsx` — role-based button grid
- `src/app/[role]/layout.tsx` — add AI panel to persistent layout
- `src/types/index.ts` — add `AIActionLog` type
- New API route: `src/app/api/ai/action/route.ts` — server-side permission check + API call

---

## Build Sequence Recommendation

```
Week 1 (Demo Prep — Light to Medium):
  FEATURE 01 — Payslip Password Protection     (~4 hrs)
  FEATURE 02 — WFH Status Badge                (~4 hrs)
  FEATURE 03 — Late/Absent Auto-Notification   (~1 day)
  FEATURE 05 — Suspect Attendance Flagging     (~2 days)
  FEATURE 07 — Payroll Readiness Checklist     (~2 days)
  FEATURE 08 — Payroll Variance Detector       (~2 days)

Week 2 (Core Gaps):
  FEATURE 04 — Break Time Tracking             (~3 days)
  FEATURE 06 — WFH Request Workflow            (~3 days)
  FEATURE 09 — Attendance Review in Payroll    (~2 days)

Week 3–4 (Module Additions):
  FEATURE 10 — Employee Surveys                (~3 days)
  FEATURE 11 — Onboarding Checklist            (~3 days)
  FEATURE 13 — Claims & Reimbursement          (~3 days)
  FEATURE 12 — Business Trip Request           (~3 days)
  FEATURE 14 — Document Expiry Tracker         (~2 days)
  FEATURE 15 — Commission Pay Component        (~2 days)

Week 5–8 (Major Features):
  FEATURE 16 — Daily Activity GPS Tracker      (~1 week)
  FEATURE 17 — Guided Payroll Wizard           (~2 weeks)
  FEATURE 18 — KPI Templates Module            (~2 weeks)
  FEATURE 20 — AI-Assisted HR Actions          (~2 weeks)

Long-term (Architecture):
  FEATURE 19 — Multi-Company Tenant Switcher   (~2 weeks)
```

---

*Prepared from: NexHRMS v2 codebase audit (May 2026) + SunFish DataOn / GreatDay HR product demo (April 28, 2026) + Malcolm Cuady architecture directive (April 28, 2026)*
