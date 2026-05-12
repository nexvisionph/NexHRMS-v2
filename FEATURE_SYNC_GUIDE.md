# NexHRMS Feature Sync Guide
# Use this document to bring your other codebase up to date with this advanced version.
# Generated from scanning the actual source code + documentation files.
# Last Updated: 2026-05-12

---

## How To Use This Document

This is a complete inventory of every feature implemented in the ADVANCED NexHRMS codebase.
Compare each section against your other codebase. Items marked with the implementation
details show you exactly what files, stores, and routes are involved so you can replicate them.

---

## 1. SIDEBAR & NAVIGATION LAYOUT

### Grouped Navigation (Major Change)
The sidebar is now organized into **6 named groups** instead of a flat list:

| Group | Label | Items |
|-------|-------|-------|
| (top-level) | — | Dashboard |
| hr | HR | Employees, 201 Files, Jobs, Projects, Tasks |
| attendance | Attendance | Attendance, Timesheets, Shifts, Kiosk (QR), Kiosk (Face), Face Enrollment, Events |
| payroll | Payroll | Payroll Runs, My Payslips, Loans, Gov. Contributions |
| workflow | Workflow | Leave, Messages, Notifications |
| reports | Reports | Reports, Audit Log |
| admin | Admin | Settings, Roles & Permissions, Organization, Appearance, Tax Rules |
| (bottom) | — | My Profile |

**Key files:**
- `src/lib/constants.ts` — `NAV_GROUPS` array + `NAV_ITEMS` with `group` field
- `src/components/shell/sidebar.tsx` — renders groups with collapsible sections

### Navigation Customization (Admin Feature)
Admins can rename, reorder, hide, and change icons for every nav item.

**Key files:**
- `src/store/appearance.store.ts` — `navOverrides: NavItemOverride[]`
- `src/app/[role]/settings/navigation/page.tsx` — drag-to-reorder UI
- `src/components/shell/sidebar.tsx` — merges overrides with system NAV_ITEMS

### Module Feature Flags
Admins can disable entire modules (hides from sidebar + blocks page access):

Toggleable modules: Employees, Attendance, Leave, Payroll, Loans, Projects, Reports, Timesheets, Audit, Notifications, Kiosk, Messages, Tasks, Events, Jobs, Document Center, My Payslips, BIR Compliance

**Key files:**
- `src/store/appearance.store.ts` — `modules: ModuleFlags`
- `src/app/[role]/settings/modules/page.tsx` — toggle cards UI

---

## 2. ROLES & PERMISSIONS SYSTEM

### Dynamic Custom Roles
Beyond the 7 built-in roles, admins can create unlimited custom roles with granular permissions.

**Built-in roles:** admin, hr, finance, employee, supervisor, payroll_admin, auditor

**Permission categories:**
- Page access (page:dashboard, page:employees, page:attendance, etc.)
- Employee actions (employees:view, employees:create, employees:edit, employees:delete, employees:view_salary, employees:approve_salary)
- Attendance (attendance:view_all, attendance:edit, attendance:approve_overtime)
- Leave (leave:view_all, leave:approve, leave:manage_policies)
- Payroll (payroll:view_all, payroll:generate, payroll:lock, payroll:issue, payroll:view_own)
- Loans (loans:view_all, loans:approve, loans:view_own)
- Settings (settings:roles, settings:organization, settings:shifts, settings:page_builder)
- Audit (audit:view)
- Reports (reports:government)
- Messages, Tasks, Jobs, Events, Notifications, Kiosk, Timesheets

**Key files:**
- `src/store/roles.store.ts` — CustomRole CRUD, permission matrix, dashboard layouts
- `src/lib/permissions.ts` — `usePermission()` hook, `usePermissions()`
- `src/app/[role]/settings/roles/page.tsx` — Role Manager UI
- `src/app/api/roles/route.ts` — API endpoint
- `supabase/migrations/003_roles_permissions.sql`

### Permission-Gated UI
All pages use `usePermission()` hook instead of hardcoded `role === "admin"` checks.
Sidebar filters items by permission. Route guard blocks unauthorized access.

---

## 3. DASHBOARD BUILDER

### Custom Dashboard Per Role
Each role can have a unique dashboard layout built from a widget registry.

**Available widget types:**
- KPI cards: present_today, absent_today, on_leave, pending_leaves, active_employees, outstanding_loans, payslips_issued, pending_adjustments, locked_runs, audit_total, audit_today, pending_ot
- Charts: team_performance, dept_distribution, leave_trends, attendance_heatmap
- Tables: employee_status, recent_audit, pending_leaves, active_loans, recent_payslips
- Personal: my_attendance_status, my_leave_balance, my_latest_payslip, my_leave_requests
- General: events_widget, birthdays_widget, announcements

**Key files:**
- `src/components/dashboard-builder/widget-registry.tsx` — all widget definitions
- `src/components/dashboard-builder/widget-grid.tsx` — renders WidgetConfig[] as grid
- `src/app/[role]/settings/dashboard-builder/page.tsx` — drag-drop builder UI
- `src/app/[role]/dashboard/page.tsx` — reads layout from roles store

---

## 4. APPEARANCE & THEMING ENGINE

### Color Themes (8 presets + custom)
Themes: default, violet, indigo, blue, emerald, rose, amber, slate, custom (any hex)

### Typography & Density
- Border radius: sharp / slight / default / rounded / pill
- Font family: geist / inter / roboto / system / mono
- UI density: compact / default / relaxed

### Branding
- Custom company name (shown in topbar + login)
- Logo upload (base64 or URL)
- Favicon override
- Brand tagline
- Accent badge text in topbar

### Shell Config
- Sidebar variant: neutral / colored (uses primary color)
- Topbar announcement banner (enable/text/color)
- Page header style: default / minimal

### Login Page Customization
- Background: gradient / solid / image
- Card layout: centered / split
- Custom heading, subheading, footer text

**Key files:**
- `src/store/appearance.store.ts` — unified store for all 35+ customization fields
- `src/components/shell/theme-provider.tsx` — CSS var injection, font, density classes
- `src/app/[role]/settings/appearance/page.tsx`
- `src/app/[role]/settings/branding/page.tsx`
- Export/import appearance config as JSON

---

## 5. ATTENDANCE SYSTEM (Full Implementation)

### Check-In Methods
1. **QR Code** — Daily HMAC-signed tokens, multi-use per day
2. **Face Recognition** — face-api.js, 128-d embeddings, multi-frame capture (7 frames, 4+ valid), auto-confirm with 3s countdown
3. **Manual Check-In** — Admin/HR fallback with predefined reasons + audit trail
4. **Project QR** — Per-project fixed QR codes (downloadable/printable PNG)

### Dual-Layer Data Model
- Events Layer (immutable, append-only): `attendance_events` table
- Logs Layer (computed daily): `attendance_logs` table

### Shift Management
- Multiple shift templates (Day 08-17, Mid 12-21, Night 22-06)
- Configurable grace periods and break durations
- Employee shift assignments
- Overnight shift handling (cross-midnight)

### Exception Auto-Detection
- missing_in, missing_out, duplicate_scan, out_of_geofence, device_mismatch

### Overtime Workflow
- Employee submits OT request (date, hours, reason)
- Supervisor/admin approves or rejects
- Approved OT auto-populates into payslip earnings
- Editable OT threshold and multipliers (regular 1.25x, rest day 1.30x, holiday 2.00x)

### Holiday Management
- PH regular holidays (200% pay)
- Special non-working holidays (130% pay)
- Rest day + holiday combinations with DOLE multipliers

### Anti-Cheat & Security
- DevTools detection ? lockout penalty
- Mock GPS detection ? reject + penalty
- Location teleportation detection (>300 km/h)
- Automation/WebDriver blocking
- GPS accuracy threshold (<=30m)
- Location timestamp freshness (<=20s)
- Device binding (1 device per employee, change requires admin approval)

### Geofence Validation
- Default radius: 100m
- Configurable per project
- GPS coordinates + accuracy stored as evidence

### Offline Support
- Events queued locally in `offline-queue.store`
- Auto-sync when network returns
- Duplicate detection (within 5 minutes)

### Site Survey Photo & Location Selfie
- Camera capture with GPS coordinates
- Reverse geocoding (address display)
- Geofence pass/fail computed
- Admin gallery view of employee selfies

### Lunch Break Geofence Enforcement
- Start/end break with GPS capture
- Geofence check on return from lunch
- Warning to employee + admin notification if outside geofence
- Configurable lunch duration and grace period

### Continuous Location Tracking
- Periodic GPS pings (5/10/15/20 min intervals, admin configurable)
- Geofence check on every ping
- Warn employee + notify admin if outside fence
- Alert if GPS disabled
- Location trail view for admin
- Auto-purge after N days

**Key files:**
- `src/store/attendance.store.ts` — events, logs, exceptions, OT, shifts, holidays, penalties
- `src/store/location.store.ts` — pings, break records, site survey photos, config
- `src/store/kiosk.store.ts` — kiosk settings (PIN, QR, face, theme, anti-cheat)
- `src/store/offline-queue.store.ts` — offline event queue
- `src/components/attendance/` — all attendance UI components
- `src/app/kiosk/` — kiosk pages (main, QR, face, face/enroll)
- `src/app/[role]/attendance/` — attendance management page
- `src/app/[role]/settings/location/page.tsx` — location tracking config
- `src/app/[role]/settings/kiosk/page.tsx` — kiosk settings
- `src/services/attendance.service.ts`
- `src/services/face-recognition.service.ts`
- `src/services/qr-token.service.ts`
- `src/services/project-verification.service.ts`
- `src/lib/geofence.ts` — geofence calculation
- `src/lib/project-qr.ts` — project QR generation/validation
- `src/lib/face-api.ts` — face recognition utilities
- `src/lib/qr-utils.ts` — QR utilities
- `supabase/migrations/004_attendance.sql`
- `supabase/migrations/022_kiosk_face_recognition_enhancement.sql`
- `supabase/migrations/023_face_embedding_support.sql`
- `supabase/migrations/026_face_reference_images.sql`
- `supabase/migrations/055_client_feature_pack.sql`

---

## 6. PAYROLL ENGINE (Philippines)

### Pay Structure
- Semi-monthly default (1-15, 16-EOM)
- Customizable payroll run periods (periodStart / periodEnd)
- Auto-suggest next period based on last run
- Per-employee pay frequency override (weekly, bi-weekly, semi-monthly, monthly)
- Pay types: hourly / daily / monthly

### Payroll Run Lifecycle
1. Attendance lock (supervisor approves timesheets)
2. Build payroll run (pull approved timesheets + leaves + compensation + loan schedules)
3. Compute earnings (basic pay, OT, holiday, allowances, adjustments)
4. Compute deductions (SSS, PhilHealth, Pag-IBIG, withholding tax, loans, custom)
5. Validation (negative net, excess loan deduction, missing approvals)
6. Lock run (no editing allowed after lock)
7. Publish payslips (notify employees)
8. Export bank file + payroll register

### Auto-Deductions from Attendance
- Late deduction: `(late_minutes / 60) x hourly_rate`
- Absent deduction: `daily_rate x absent_days`
- Undertime deduction: `(shift_hours - actual_hours) x hourly_rate`
- Toggle: auto-compute ON/OFF per company

### Government Deductions (PH)
- SSS (bracket-based, versioned yearly)
- PhilHealth (percentage-based, versioned)
- Pag-IBIG (capped at P100/month)
- Withholding Tax (TRAIN law brackets)
- All versioned with effective dates
- Snapshotted per payroll run (policy_snapshot_json)

### 13th Month Pay
- Accrued monthly, based on basic salary only
- Auto-calculation with December trigger or manual release
- Modal UI for computing and issuing

### Payslip Signing & Confirmation Workflow
Status flow: ISSUED -> CONFIRMED -> PUBLISHED -> PAID -> ACKNOWLEDGED

- Employee draws signature (SignaturePad component)
- Finance marks as paid
- Employee acknowledges receipt
- Signature image stored with timestamp, IP, device, pdf_hash
- Admin can view all signatures

### Payroll Adjustments
- Post-lock corrections via separate adjustment records
- Never edit a locked run directly

### Final Pay Computation
- Dialog for computing final pay (resignation/termination)
- Includes remaining salary, unused leave conversion, 13th month pro-rata

### BIR Compliance (Foundation)
- Form 2316 generation
- Alphalist generator
- Annual tax engine
- BIR anomaly detector
- BIR tax categories and rules
- BIR validation
- BIR export utilities

### Pay Schedule Settings
- Configurable cutoff dates
- Default frequency selection
- Semi-monthly first/second cutoff configuration

### Payroll Readiness Checklist
- Pre-run validation UI showing what's missing before payroll can proceed

**Key files:**
- `src/store/payroll.store.ts` — runs, payslips, adjustments, final pay, schedule config
- `src/store/deductions.store.ts` — deduction overrides
- `src/store/bir-compliance.store.ts` — BIR compliance data
- `src/lib/payroll-deductions.ts` — late, absent, undertime, OT deduction functions
- `src/lib/ph-deductions.ts` — SSS, PhilHealth, Pag-IBIG, tax calculations
- `src/lib/annual-tax-engine.ts`
- `src/lib/alphalist-generator.ts`
- `src/lib/bir-*.ts` — BIR utilities
- `src/lib/form-2316-generator.ts`
- `src/lib/mwe-rules.ts` — minimum wage earner rules
- `src/components/payroll/` — all payroll UI components
- `src/app/[role]/payroll/` — payroll pages (main, settings, bir-compliance)
- `src/app/[role]/my-payslips/page.tsx` — employee payslip view
- `src/app/[role]/reports/government/` — government contribution reports
- `src/services/payroll.service.ts`
- `supabase/migrations/006_payroll.sql`
- `supabase/migrations/028_payroll_run_payslips_junction.sql`
- `supabase/migrations/036_deduction_overrides.sql`
- `supabase/migrations/038_payroll_signature_config.sql`
- `supabase/migrations/045_payroll_simplification.sql`
- `supabase/migrations/048_payroll_payment_proof.sql`
- `supabase/migrations/054_payslip_payment_hold.sql`
- `supabase/migrations/056_bir_compliance_foundation.sql`

---

## 7. LEAVE MANAGEMENT

### Leave Types
- Vacation Leave (VL) - 5 days minimum
- Sick Leave (SL) - 5 days minimum
- Emergency Leave (EL)
- Maternity Leave (ML) - 105 days
- Paternity Leave (PL) - 7 days
- Solo Parent Leave (SPL) - 7 days

### Leave Formats
- Full day, half day, hourly leave, multi-day range

### Leave Balance Logic
- Accrual: monthly or annual
- Carry-forward rules
- Expiration
- Negative leave toggle
- Proration for new hires

### Leave & Attendance Interaction
- Approved leave marks timesheet as paid/unpaid hours
- Clock-in on leave day flags conflict for HR review

### Approval Workflow
- Employee submits request with dates, reason, attachment
- Supervisor/HR approves or rejects
- Status tracking throughout

**Key files:**
- `src/store/leave.store.ts`
- `src/app/[role]/leave/` — leave management pages with role-based views
- `supabase/migrations/005_leave.sql`
- `supabase/migrations/043_leave_requests_add_duration.sql`

---

## 8. LOANS / CASH ADVANCE MODULE

### Features
- Employee request workflow (optional)
- Admin issuance with disbursement record
- Repayment schedule generator (fixed amount per cutoff OR fixed number of installments)
- Auto deductions on payroll run
- Early settlement
- Freeze repayment (HR action)
- Balance statements

### Safeguards
- Max deduction % of net pay (default 30%, configurable)
- Deduction priority level
- Prevent deduction exceeding configured %
- Carry forward if net pay insufficient
- Log every deduction event

**Key files:**
- `src/store/loans.store.ts`
- `src/app/[role]/loans/` — loan management with role-based views
- `supabase/migrations/007_loans.sql`
- `supabase/migrations/016_fix_loans_timestamp.sql`

---

## 9. EMPLOYEE MANAGEMENT

### Employee CRUD
- Full table view with pagination (10/20/50 per page)
- Advanced filters (status, work type, department, salary range)
- Column visibility toggles
- Sorting by any column
- Add, Edit, Delete operations
- Project assignment
- Resignation workflow

### Salary Governance
- HR proposals for salary changes
- Admin/Finance approval workflow
- Salary history tracking

### Employee Profile (Detail Page)
Tabs: Overview, Employment, Attendance, Leave, Payslips, Loans, 201 File, Disciplinary

### Import / Export
- Export employees to XLSX/CSV with filters
- Import employees via XLSX with dryRun validation
- Downloadable template file
- Per-row error reporting

### Employee Fields
- name, email, role, department, daily_rate, pay_frequency, work_type, hire_date, phone
- job_title, biometric_id, notification_preferences, avatar
- contact fields (address, emergency contact)

**Key files:**
- `src/store/employees.store.ts`
- `src/store/departments.store.ts`
- `src/store/job-titles.store.ts`
- `src/app/[role]/employees/manage/` — employee management
- `src/app/[role]/employees/[id]/` — employee detail/profile
- `src/app/[role]/employees/201-files/` — 201 file overview
- `src/app/api/import/employees/` — bulk import API
- `src/app/api/export/employees/` — export API
- `src/services/employees.service.ts`
- `src/components/import-data-dialog.tsx`
- `src/lib/export-utils.ts`
- `supabase/migrations/002_employees.sql`
- `supabase/migrations/030_employees_add_contact_fields.sql`
- `supabase/migrations/042_employees_add_job_title.sql`
- `supabase/migrations/049_employees_notification_preferences.sql`
- `supabase/migrations/053_employees_biometric_id.sql`

---

## 10. DOCUMENT CENTER / 201 FILES

### Employee 201 Documents
Document types: personal_info, employment_contract, government_id, resume, application_form, job_offer, medical, training_certificate, performance_evaluation, payslip, leave_record, warning, nte, nod, clearance, resignation_letter, coe, final_pay_document, other

### Document Lifecycle
Status: pending_upload -> uploaded -> for_review -> approved/rejected -> expired/archived

### Visibility Control
Levels: hr_only, manager, employee, payroll, admin_only

### Gap Analysis
System identifies missing required documents per employee (employment_contract, government_id, resume, application_form, medical)

### Expiry Tracking
Documents can have expiry dates; system alerts on upcoming expirations

**Key files:**
- `src/store/documents.store.ts`
- `src/app/[role]/employees/201-files/page.tsx`
- `supabase/migrations/057_employee_201_files_disciplinary.sql`

---

## 11. DISCIPLINARY SYSTEM (NTE & NOD)

### Case Workflow
open -> nte_issued -> nte_acknowledged -> explanation_submitted -> under_review -> nod_issued -> nod_acknowledged -> sanction_active -> closed

### NTE (Notice to Explain)
- Issue NTE with response deadline
- Employee acknowledges
- Employee submits explanation
- Mark no response if deadline passes
- Move to review

### NOD (Notice of Decision)
Decisions: no_violation, verbal_warning, written_warning, final_warning, suspension, termination, salary_deduction, training_required, pip

- Sanction dates (start, end, return to work)
- Employee acknowledges

### Case Detail Page
- Full timeline view (incident -> NTE -> explanation -> NOD -> close)
- Action panel changes based on current status
- KPI dashboard (open, awaiting explanation, for review, NOD pending, suspensions active, closed)

**Key files:**
- `src/store/disciplinary.store.ts`
- `src/app/[role]/disciplinary/page.tsx`
- `src/app/[role]/disciplinary/[caseId]/`
- `supabase/migrations/057_employee_201_files_disciplinary.sql`

---

## 12. PROJECTS & GEOFENCING

### Project Management
- Project CRUD (name, client, status, start/end, location, geofence radius)
- Employee project assignments (with date ranges, shift, assignment type)
- Verification method per project: qr_only, face_only, face_or_qr
- Map selector for project location

### Per-Project Fixed QR Codes
- Each project gets a permanent QR code with HMAC signature
- Download as PNG / Print button
- Scan validates: employee assigned + within geofence

### Project QR Scanner Component
- Dedicated scanner for project-based QR codes
- Validates project assignment + geofence before recording attendance

**Key files:**
- `src/store/projects.store.ts`
- `src/app/[role]/projects/` — project management with views
- `src/components/projects/project-qr-dialog.tsx`
- `src/components/projects/map-selector.tsx`
- `src/components/attendance/project-qr-scanner.tsx`
- `src/lib/project-qr.ts`
- `src/services/project-verification.service.ts`
- `src/app/api/project-verification/route.ts`
- `supabase/migrations/010_projects_timesheets_settings.sql`
- `supabase/migrations/027_project_constraints.sql`
- `supabase/migrations/029_project_assignments_junction.sql`

---

## 13. TASKS & WORKFLOW

### Task Management
- Task CRUD with title, description, assignee, due date, priority, status
- Task groups (linked to projects)
- Task comments
- Task completion reports
- Task tags
- Task detail page with activity timeline

**Key files:**
- `src/store/tasks.store.ts`
- `src/app/[role]/tasks/` — task management pages
- `src/app/[role]/tasks/[id]/` — task detail
- `supabase/migrations/008_tasks_messaging.sql`
- `supabase/migrations/031_tasks_project_id.sql`
- `supabase/migrations/032_task_tags.sql`
- `supabase/migrations/060_tasks_schema_updates.sql`

---

## 14. MESSAGING SYSTEM

### Features
- Text channels (team/department/project-based)
- Direct messages
- Channel messages with read tracking
- Real-time updates via Supabase Realtime

**Key files:**
- `src/store/messaging.store.ts`
- `src/app/[role]/messages/` — messaging UI
- `supabase/migrations/008_tasks_messaging.sql`
- `supabase/migrations/046_text_channels_realtime.sql`

---

## 15. NOTIFICATIONS SYSTEM

### Notification Types (14 triggers)
1. Payslip published
2. Leave request submitted
3. Leave approved/rejected
4. Attendance missing
5. Geofence violation
6. Loan deduction upcoming
7. Payslip unsigned reminder
8. Overtime request
9. Birthday greeting
10. Contract/probation expiry
11. Daily attendance summary
12. Location disabled warning
13. Payslip signed
14. Payment confirmed

### Channels
- Email (simulated in MVP, Resend for production)
- SMS (simulated in MVP, Semaphore for production)
- In-app notifications
- Push notifications (web push via service worker)

### Admin Configuration
- Per-trigger enable/disable
- Channel selection (email/sms/both/in_app)
- Custom message templates with variables
- Reminder schedules (days after event)
- Notification preferences per employee

### Push Notifications
- Web Push API integration
- Subscribe/resubscribe endpoints
- Send push endpoint
- Push notification banner + prompt components

**Key files:**
- `src/store/notifications.store.ts`
- `src/lib/notifications.ts` — template rendering, trigger dispatch
- `src/app/[role]/notifications/page.tsx`
- `src/app/[role]/settings/notifications/page.tsx` — admin rules config
- `src/app/api/notifications/` — mark-read, resend endpoints
- `src/app/api/push/` — subscribe, resubscribe, send
- `src/app/api/settings/notifications/` — notification settings API
- `src/app/api/settings/notification-preferences/` — per-employee prefs
- `src/components/push-notification-banner.tsx`
- `src/components/push-notification-prompt.tsx`
- `supabase/migrations/009_audit_notifications.sql`
- `supabase/migrations/044_notification_logs_add_read.sql`
- `supabase/migrations/047_push_subscriptions.sql`
- `supabase/migrations/052_notification_provider_config.sql`

---

## 16. TIMESHEETS

### Features
- Daily timesheet computation from attendance events
- Timesheet segments (work/break chunks)
- Timesheet adjustments with approver chain
- Status workflow: draft -> submitted -> approved -> locked
- Bulk approval by supervisor/HR
- Handles: multiple IN/OUT per day, overnight shifts, split shifts, rounding rules, grace periods

**Key files:**
- `src/store/timesheet.store.ts`
- `src/app/[role]/timesheets/page.tsx`
- `supabase/migrations/010_projects_timesheets_settings.sql`

---

## 17. REPORTS

### Available Reports
- Payroll Register (all payslips by period)
- Government Deductions Summary
- Absence Report
- Late Report
- SSS Contributions Report (by month)
- PhilHealth Contributions Report
- Pag-IBIG Contributions Report
- Withholding Tax Report

### Export Capabilities
- Export to XLSX/CSV
- Attendance export
- Payroll export
- Employee export

**Key files:**
- `src/app/[role]/reports/page.tsx` — main reports
- `src/app/[role]/reports/government/` — government reports
- `src/components/payroll/government-reports.tsx`
- `src/lib/export-utils.ts`
- `src/app/api/export/attendance/`
- `src/app/api/export/employees/`
- `src/app/api/export/payroll/`

---

## 18. AUDIT LOG

### Features
- Immutable audit trail
- Who did what, when, before/after values
- Entity type + entity ID tracking
- Filterable by action type, user, date range
- Security events (login, device change, suspicious activity)

**Key files:**
- `src/store/audit.store.ts`
- `src/app/[role]/audit/page.tsx`
- `supabase/migrations/009_audit_notifications.sql`

---

## 19. EVENTS / CALENDAR

### Features
- Company events and meetings
- Fullscreen calendar view component
- Event CRUD

**Key files:**
- `src/store/events.store.ts`
- `src/app/[role]/events/page.tsx`
- `src/components/ui/fullscreen-calendar.tsx`

---

## 20. JOBS / RECRUITMENT

### Features
- Job posting management
- Job listings with role-based views
- Job detail pages

**Key files:**
- `src/store/jobs.store.ts`
- `src/app/[role]/jobs/` — job management pages
- `src/app/api/jobs/` — jobs API
- `supabase/migrations/058_jobs.sql`

---

## 21. EMPLOYEE SELF-SERVICE

### Check-In Page (Mobile-Friendly)
- Dedicated `/checkin` route for employee self-service attendance
- Separate from kiosk (personal device use)

### Face Enrollment
- Employee can enroll their face for recognition
- Dedicated page at `/[role]/face-enrollment`

### My Profile
- View/edit personal information
- Change password, change email
- Notification preferences

### My Payslips
- View all payslips with status badges
- Sign payslips with drawn signature
- Acknowledge receipt
- Download PDF

**Key files:**
- `src/app/checkin/page.tsx` — self-service check-in
- `src/app/[role]/face-enrollment/page.tsx`
- `src/app/[role]/profile/page.tsx`
- `src/app/[role]/my-payslips/page.tsx`
- `src/app/api/auth/change-email/`
- `src/app/api/auth/change-password/`
- `src/app/api/auth/reset-password/`
- `src/app/api/settings/profile/`

---

## 22. KIOSK SYSTEM

### Kiosk Modes
- QR Kiosk (`/kiosk/qr`) — rotating QR with countdown + scan
- Face Kiosk (`/kiosk/face`) — camera-based face recognition check-in
- Face Enrollment (`/kiosk/face/enroll`) — enroll new faces at kiosk

### Kiosk Settings
- Enable/disable PIN, QR, Face methods
- Theme: auto / dark / midnight / charcoal
- Clock format: 12h / 24h
- Admin PIN for kiosk access
- Geofence requirement toggle
- Anti-cheat settings (DevTools penalty, spoofing detection)

### Kiosk Security
- 6-digit PIN protection
- Session timeout (5 min)
- Rate limiting
- Device ID persistence

**Key files:**
- `src/store/kiosk.store.ts`
- `src/app/kiosk/` — all kiosk pages
- `src/app/[role]/settings/kiosk/page.tsx`
- `src/app/api/kiosk/admin-pin/`
- `src/app/api/settings/kiosk/`
- `src/lib/kiosk-auth.ts`
- `supabase/migrations/051_kiosk_config.sql`

---

## 23. SERVICE LAYER (Server Actions)

### Implemented Services
- `auth.service.ts` — sign in, create account, session management
- `employees.service.ts` — CRUD, salary changes, salary history
- `attendance.service.ts` — events (append-only), evidence, exceptions, logs, shifts, OT, holidays
- `payroll.service.ts` — payslips lifecycle, runs, adjustments, final pay, schedule config
- `face-recognition.service.ts` — face enrollment and matching
- `manual-checkin.service.ts` — manual attendance recording
- `project-verification.service.ts` — project QR validation
- `qr-token.service.ts` — QR token generation/validation
- `sync.service.ts` — offline sync
- `db.service.ts` — database utilities

### Pattern
All services return `{ ok: true, data } | { ok: false, error }` (ServiceResult<T> type)

**Key files:**
- `src/services/` — all service files
- `src/lib/db-mappers.ts` — camelCase <-> snake_case mapping
- `src/lib/db-utils.ts` — database utilities

---

## 24. DATABASE (60 Supabase Migrations)

### Key Tables
- profiles, employees, departments, positions, job_titles
- attendance_events, attendance_logs, attendance_evidence, attendance_exceptions
- shift_templates, shift_schedules, attendance_rule_sets
- leave_types, leave_policies, leave_balances, leave_requests
- payroll_runs, payslips, payslip_acknowledgements, payroll_adjustments
- employee_compensation, earning_types, deduction_types
- loans, loan_disbursements, loan_repayment_schedule, loan_deductions
- projects, project_locations, employee_project_assignments
- tasks, task_groups, task_comments, task_completion_reports, task_tags
- channels, channel_messages
- audit_logs, notification_logs, push_subscriptions
- holidays, announcements
- roles, permissions, user_roles
- kiosk_devices, qr_tokens
- location_pings, break_records, site_survey_photos
- employee_201_documents, disciplinary_cases, nte_records, nod_records
- bir_* tables (compliance foundation)
- jobs

### RLS Policies
- 131+ Row Level Security policies
- Role-based access control at database level
- `is_own_employee()` helper function

### Realtime
- Enabled on key tables for live updates

---

## 25. AUTH SYSTEM

### Dual Mode
- Demo mode: localStorage-based auth with Zustand (for development/demos)
- Production mode: Supabase Auth with JWT sessions

### Features
- Login with email/password
- Role-based routing (`/[role]/dashboard`)
- Middleware session refresh
- Device registration
- Account deactivation page
- Password reset flow

**Key files:**
- `src/store/auth.store.ts`
- `src/services/auth.service.ts`
- `src/services/supabase-browser.ts`
- `src/services/supabase-server.ts`
- `src/middleware.ts`
- `src/app/login/page.tsx`
- `src/app/deactivated/page.tsx`
- `supabase/migrations/001_auth_profiles.sql`
- `supabase/migrations/059_fix_account_role_sync.sql`

---

## 26. UI COMPONENTS LIBRARY

### Custom Components (beyond shadcn/ui)
- `signature-pad.tsx` — drawn signature capture
- `fullscreen-calendar.tsx` — full calendar view
- `employee-combobox.tsx` — searchable employee selector
- `searchable-select.tsx` — generic searchable dropdown
- `role-dispatcher.tsx` — renders different views based on user role
- `access-denied.tsx` — unauthorized access page
- `pagination.tsx` — table pagination
- `export-backup-dialog.tsx` — data export/backup
- `import-data-dialog.tsx` — data import with validation

### Attendance Components
- `attendance-heatmap.tsx` — visual attendance heatmap
- `attendance-live-stats.tsx` — real-time attendance statistics
- `break-timer.tsx` — lunch break countdown
- `employee-qr-display.tsx` — show employee's daily QR
- `enrollment-reminder.tsx` — face enrollment prompt
- `face-recognition.tsx` — face detection UI
- `location-result.tsx` — GPS result display
- `location-tracker.tsx` — background GPS watcher
- `location-trail.tsx` — admin location history view
- `project-qr-scanner.tsx` — project QR scanner
- `real-face-verification.tsx` — production face verification
- `selfie-capture.tsx` — camera + GPS capture
- `site-survey-gallery.tsx` — admin photo gallery

### Payroll Components
- `compute-final-pay-dialog.tsx`
- `create-adjustment-dialog.tsx`
- `form-2316.tsx`
- `government-reports.tsx`
- `pay-schedule-settings.tsx`
- `payroll-readiness-checklist.tsx`
- `payslip-detail.tsx`
- `payslip-signature-viewer.tsx`
- `payslip-table.tsx`
- `printable-payslip.tsx`
- `thirteenth-month-modal.tsx`

---

## 27. API ROUTES

### Attendance APIs
- POST `/api/attendance/validate-qr` — QR validation + clock
- POST `/api/attendance/verify-face` — face verification
- POST `/api/attendance/manual-checkin` — manual fallback
- POST `/api/attendance/sync-offline` — sync offline events
- GET `/api/attendance/daily-qr` — generate daily QR
- POST `/api/attendance/reset-today` — reset today's log
- POST `/api/attendance/self-checkin` — employee self check-in
- POST `/api/attendance/project-qr-checkin` — project QR check-in
- POST `/api/attendance/biometric-scan` — biometric device scan
- GET `/api/attendance/my-status` — current attendance status
- GET `/api/attendance/logs` — attendance logs
- GET `/api/attendance/exceptions` — exceptions list
- POST `/api/attendance/reconcile-absences` — mark absences
- POST `/api/attendance/generate-qr-token` — generate QR token
- POST `/api/attendance/t800` — T800 biometric integration

### Auth APIs
- POST `/api/auth/change-email`
- POST `/api/auth/change-password`
- POST `/api/auth/reset-password`

### Payroll APIs
- POST `/api/payroll/sign` — sign payslip
- POST `/api/payroll/acknowledge` — acknowledge payslip
- GET `/api/payroll/status` — payslip status
- GET `/api/payroll/templates` — payslip templates
- `/api/payroll/bir/` — BIR-related endpoints

### Other APIs
- `/api/face-recognition/enroll` — face enrollment + matching
- `/api/geocode` — reverse geocoding
- `/api/import/employees`, `/api/import/attendance`, `/api/import/payroll`
- `/api/export/employees`, `/api/export/attendance`, `/api/export/payroll`
- `/api/project-verification` — project QR validation
- `/api/projects/[id]` — project CRUD
- `/api/employees/[id]` — employee CRUD
- `/api/biometrics/devices`, `/api/biometrics/sync` — biometric device management
- `/api/jobs` — job management
- `/api/roles` — role management
- `/api/push/subscribe`, `/api/push/send`, `/api/push/resubscribe`
- `/api/upload` — file upload
- `/api/settings/kiosk`, `/api/settings/location`, `/api/settings/notifications`

---

## 28. SETTINGS PAGES (Admin)

| Page | Route | Purpose |
|------|-------|---------|
| Main Settings | `/settings` | Hub with links to all sub-pages |
| Appearance | `/settings/appearance` | Color themes, typography, density, shell config |
| Branding | `/settings/branding` | Logo, company name, login page customization |
| Modules | `/settings/modules` | Enable/disable feature modules |
| Navigation | `/settings/navigation` | Reorder, rename, hide nav items |
| Roles & Permissions | `/settings/roles` | Custom role CRUD + permission matrix |
| Organization | `/settings/organization` | Departments, positions management |
| Shifts | `/settings/shifts` | Shift templates + employee assignments |
| Dashboard Builder | `/settings/dashboard-builder` | Drag-drop dashboard layout per role |
| Kiosk | `/settings/kiosk` | Kiosk device + method configuration |
| Location | `/settings/location` | GPS tracking config |
| Notifications | `/settings/notifications` | Notification rules + templates |
| Tax Rules | `/payroll/settings` | Government deduction tables + payroll config |

---

## 29. INFRASTRUCTURE & TOOLING

### Tech Stack
- Next.js 15+ (App Router)
- React 18+
- TypeScript (strict)
- Zustand (26 stores with localStorage persistence)
- Supabase (PostgreSQL + Auth + Storage + Realtime)
- Tailwind CSS v4 (oklch color system)
- shadcn/ui components
- face-api.js (TensorFlow.js) for face recognition
- BarcodeDetector API + jsQR for QR scanning

### Testing
- Jest with 956+ tests passing
- Store tests covering all business logic

### PWA Support
- `manifest.ts` — web app manifest
- Push notification support
- Offline queue for attendance events

### Security
- Rate limiting (`src/lib/rate-limit.ts`)
- Environment validation (`src/lib/env.ts`)
- Server-side permission checks (`src/lib/permissions-server.ts`)
- Supabase RLS policies (131+)
- Middleware auth guard

---

## QUICK COMPARISON CHECKLIST

Use this to quickly identify what your other codebase is missing:

- [ ] Grouped sidebar navigation (6 groups)
- [ ] Navigation customization (rename/reorder/hide/icon change)
- [ ] Module feature flags (disable entire modules)
- [ ] Dynamic custom roles with permission matrix
- [ ] Permission-gated UI (usePermission hook)
- [ ] Dashboard builder (drag-drop widgets per role)
- [ ] Appearance engine (8 color themes + custom, radius, font, density)
- [ ] Branding (logo, company name, favicon, login page customization)
- [ ] Face recognition check-in (face-api.js, multi-frame, embeddings)
- [ ] Project QR codes (fixed, downloadable, printable)
- [ ] Site survey photo with GPS
- [ ] Lunch break geofence enforcement
- [ ] Continuous location tracking (5-20 min intervals)
- [ ] Anti-cheat system (DevTools, mock GPS, teleportation detection)
- [ ] Offline attendance queue + auto-sync
- [ ] Payroll auto-deductions (late, absent, undertime)
- [ ] Customizable payroll run periods
- [ ] OT auto-compute with editable thresholds/multipliers
- [ ] 13th month pay computation
- [ ] BIR compliance (Form 2316, alphalist, annual tax)
- [ ] Payslip signing workflow (draw signature + acknowledge)
- [ ] Final pay computation dialog
- [ ] Payroll readiness checklist
- [ ] Government contribution reports (SSS, PhilHealth, Pag-IBIG, Tax)
- [ ] Employee import/export with template
- [ ] 201 File document center (18 doc types, lifecycle, gap analysis)
- [ ] Disciplinary system (NTE + NOD workflow)
- [ ] Task management with tags and completion reports
- [ ] Messaging system with channels
- [ ] Push notifications (web push)
- [ ] Notification rules engine (14 triggers, templates, scheduling)
- [ ] Events/calendar module
- [ ] Jobs/recruitment module
- [ ] Employee self-service check-in page (/checkin)
- [ ] Kiosk face enrollment
- [ ] Biometric device integration (T800)
- [ ] Service layer (12 server-side services)
- [ ] 60 Supabase migrations
- [ ] Supabase Realtime enabled
- [ ] PWA manifest + push support
- [ ] Rate limiting
- [ ] Environment validation
- [ ] Error boundaries

---

*End of Feature Sync Guide. Use this as your roadmap to bring the other codebase up to date.*
