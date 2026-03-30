1) Product Scope and Non-Negotiable Principles
Core principles (do not break these)
- Raw logs are immutable (append-only).
- Timesheets are computed from logs + rules (can be recomputed).
- Payroll runs are lockable and never “edited”; corrections happen via adjustments.
- Every change requires:
o who changed it
o reason
o when
o before/after values
- Verification evidence (QR token, GPS, Wi-Fi, selfie/face match, device integrity) is
stored per clock event.
This is what makes companies trust payroll.

2) Users, Roles, and Permissions (RBAC)
Roles (suggested defaults)
## • Company Owner / Super Admin
- HR Admin
## • Payroll Admin
## • Supervisor / Manager
## • Project Manager
## • Site Supervisor
## • Employee
## • Auditor / Read-only
Permission groups (fine-grained)
- Employee management

- Attendance rules
- Attendance adjustments
- Leave policies & approvals
- Payroll configuration
- Payroll run creation/locking
- Payslip publishing
- Loans/cash advances approval
## • Reports/export
- Device & verification settings
- Audit log access
Rule: Payroll Admin can run payroll but cannot change role permissions.

3) Entities and Data Model (Full Schema Blueprint)
## A) Tenant & Organization
- companies
- company_settings (timezone, currency, policy toggles)
- branches
- departments
- positions
- cost_centers
- work_sites (for non-project sites like office branches)
- holidays (national + custom)
- users
- roles
- permissions
- user_roles

- employee_profiles
- employee_documents (contracts, IDs; optional)
- employee_status_history (active, resigned, suspended, etc.)
B) Projects & Location Assignment (your key differentiator)
- projects (name, client, status, start/end)
- project_locations (name, address, geofence polygon/radius, Wi-Fi rules)
- employee_project_assignments
o employee_id
o project_id
o location_id (optional if multiple)
o date_from/date_to
o shift_id
o assignment_type (required/optional)
o attendance_mode_override (optional)
## C) Shifts & Rules
- shift_templates
- shift_schedules (employee/department schedules by date)
- attendance_rule_sets
o grace periods, rounding, break rules
o overtime rules (pre-approval required?)
o late/undertime penalties policy (if allowed)
o minimum hours rules
- rule_set_assignments (by pay group/branch/employee)
## D) Attendance Raw Logs & Evidence
- attendance_events (append-only)
o event_type: IN/OUT/BREAK_START/BREAK_END

o source: mobile/kiosk/device/api
o timestamp_utc
o local_time
o employee_id
o site/project/location references
o device_id
- attendance_evidence
o gps_lat/lng
o gps_accuracy_m
o gps_timestamp
o geofence_pass (bool)
o wifi_ssid / bssid
o qr_token_id
o selfie_image_id (optional)
o face_match_score (optional)
o liveness_result (optional)
o device_integrity_result (optional)
o mock_location_detected (optional)
- attendance_exceptions
o missing_in, missing_out, out_of_geofence, wrong_project, etc.
## E) Computed Timesheets
- timesheets (per employee per day)
o first_in, last_out
o total_hours
o regular_hours
o overtime_hours

o night_diff_hours (if enabled)
o late_minutes
o undertime_minutes
o status: draft/submitted/approved/locked
- timesheet_segments (optional but recommended)
o chunks of work/break for accurate computations
- timesheet_adjustments
o references to original events
o adjustment reason + approver chain
- overtime_requests + overtime_approvals
## F) Leave Management
- leave_types (VL, SL, unpaid, etc.)
- leave_policies
o accrual frequency
o carry forward rules
o max balance
o proration
o expiry
o attachment requirement
- leave_balances (per employee, per leave type)
- leave_requests
o dates, partial day, reason, attachment
o status + approvals
## G) Payroll Engine
- pay_groups (weekly/semi-monthly/monthly)
- payroll_periods (cutoff boundaries)

- employee_compensation
o pay_type: hourly/daily/monthly
o base_rate
o allowances
o tax settings
- earning_types (regular, OT, holiday, allowance, commission)
- deduction_types (statutory, tax, loan, cash advance, custom)
- payroll_runs
o run_status: draft/validated/locked/published
o period_id
o policy_snapshot_json (VERY IMPORTANT)
- payroll_run_items (one per employee)
- payroll_item_lines
o line_type earning/deduction
o amount
o formula metadata
- payroll_adjustments (post-lock corrections)
- payslips
o pdf_url
o pdf_hash
o published_at
- payslip_acknowledgements
o employee_id
o signed_at
o signature_type (click/draw/otp)
o ip/device evidence

o acknowledgement_text_version
## H) Cash Advance / Loans (requested)
- loan_products (cash advance, salary loan)
- employee_loans
o principal, interest(optional), fees(optional)
o repayment method: fixed amount / fixed periods
o status
- loan_disbursements
- loan_repayment_schedule
- loan_repayments (auto from payroll + manual payments)
- loan_balance_history
## I) Audit & Compliance
- audit_logs (who did what, before/after)
- security_events (login, device change, suspicious)
- data_retention_policies
- consents (biometrics consent)

4) Attendance Verification Engine (Configurable by Company/Site)
Attendance modes (toggle per company, per site, per employee group)
- QR only (not recommended but available)
- Geofence only
- Wi-Fi only
- QR + Geofence (recommended baseline)
- QR + Wi-Fi (best for indoor)
- QR + Geofence + Selfie (strong)
- Face recognition + liveness (strongest)

- Fingerprint device (kiosk hardware)
- Hybrid rules (fallback chain)
Required “anti-cheat” rules
- Location accuracy threshold (e.g., must be ≤ 30m)
- Freshness threshold (location timestamp must be within 10–20 seconds)
- Device binding / device change approval
- Mock location detection (Android)
- Integrity checks (basic: rooted/jailbreak; advanced: platform integrity services)
- QR token expiry 15–60 seconds, single-use token
QR design (server-validated, not just “text”)
- QR contains: token_id only (not raw project id publicly)
- Server stores token payload:
o project/location id
o issued_at
o expires_at
o display_device_id
- When scanned:
o verify token not expired, not used
o verify scanner employee assigned
o verify site rules (geofence/wifi if enabled)
Kiosk mode
- Tablet shows rotating QR + headcount
- Optional supervisor PIN to unlock manual overrides

5) Timesheet Computation Rules (Important Detail)
Compute engine must handle:

- Multiple IN/OUT per day
- Breaks (paid/unpaid, auto-deduct if missing)
- Overnight shifts (cross-midnight)
- Split shifts
- Rounding rules (per company)
- Grace period rules
- Holiday calendars (by location/branch)
- OT rules:
o OT only if approved
o OT rounding rules
- Night differential window (if enabled)
Output: a daily timesheet with components the payroll engine can trust.

## 6) Leave Engine Details
Supported leave formats
- Full day
- Half day
- Hourly leave (optional but nice)
- Multi-day range
- Leave linked to schedule (if no shift, decide default)
Leave balance logic
- Accrual: monthly or annual
- Carry-forward rules
## • Expiration
- Negative leave allowed? (toggle)
Leave and attendance interaction

- If leave approved: timesheet marks paid/unpaid hours accordingly
- If employee clocks in on leave day: system flags conflict for HR review

7) Payroll Engine Details (Full)
Payroll must support:
- Pay frequency + multiple pay groups
## • Hourly/daily/monthly
- Pro-rating rules (new hires, resignations)
## • Earnings:
o Regular pay (from timesheets)
o Overtime pay (from approved OT)
o Holiday pay (rule-set dependent)
o Allowances (recurring + one-time)
o Commissions (manual import or entry)
o Adjustments
## • Deductions:
o Statutory (country package)
o Taxes (country package)
o Loans/cash advances (auto schedule)
o Custom deductions
- Net pay = earnings - deductions
Payroll run lifecycle
- Build run (pull approved/locked timesheets + approved leaves)
- Compute (rules + policy snapshot)
## 3. Validate:
o missing approvals

o negative net pay
o extreme outliers
- Lock run
- Publish payslips
- Export bank file + payroll register
- Adjustments only via new adjustment record (never editing locked run)
Policy snapshot (do this or you’ll suffer)
At payroll run creation, store a policy_snapshot_json of:
- rule set version
- holiday list version
- rates used
- formula versions
So payroll results remain reproducible even if policies change later.

8) Payslips + Signature (Full Implementation)
Payslip content
- Employee info, pay period
- Earnings breakdown
- Deductions breakdown
- Loan balances (optional section)
- Net pay + payment method
- Employer signature stamp (optional)
- QR hash verification (optional)
Signature/acknowledgement types
## • Click-to-acknowledge (fast)
- Draw signature (touch)

- OTP confirm (stronger)
- Payroll officer sign-off (optional)
## Store:
- pdf_hash
- signed_at
- signature_payload (image/metadata)
- device/ip
- ack_text_version

9) Cash Advance / Loans (Full)
## Features
- Employee request workflow (optional)
- Admin issuance
- Disbursement record
- Repayment schedule generator:
o amount per cutoff OR number of cutoffs
o deduction priority (before/after tax depending policy)
- Auto deductions on payroll run
- Early payment
- Freeze repayment (HR action)
- Balance statements
Critical: loan deductions must never exceed net pay rules (configurable).

10) Screens and UX Blueprint (What your team will build)
## A) Employee Mobile App
- Login + device registration

- Clock in/out
o choose project/site (auto suggested)
o scan QR
o show geofence status
o selfie/face if enabled
- Timesheet view (daily/weekly)
- Leave request + attachments
- Payslips list + download + sign
- Loan/cash advance status and balance
- Notifications center
## B) Supervisor / Project Manager
- Live attendance dashboard (by project/site)
## • Approvals:
o timesheet edits
o overtime
o leave
- Team schedule view
- Exception alerts (out-of-site, missing logs)
C) Admin Web (HR/Payroll)
- Company setup wizard
- Employees CRUD + imports
- Branches/projects/locations management
- Shift templates + scheduling calendar
- Rules engine configuration
- Attendance logs explorer (with evidence viewer)
- Timesheets review + bulk approval

- Leave policies + balances + requests
- Loans/cash advances management
## • Payroll:
o pay groups, periods
o payroll run builder/validator
o lock/publish
o bank export
o reports
- Payslip signature tracking
- Audit logs viewer
- Device management (kiosks, fingerprint devices)
D) Kiosk/Tablet Mode
- Rotating QR with countdown
- Employee scan page + optional PIN fallback
- Live headcount list
- Offline indicator + sync status

11) API Blueprint (Main Endpoints)
Auth & org
- POST /auth/login
- POST /auth/device/register
- GET /me
- GET /company/settings
Projects & assignments
- POST /projects
- POST /projects/{id}/locations

- POST /assignments (employee ↔ project/location)
- GET /assignments/my
## Attendance
- POST /attendance/qr/issue (kiosk issues token)
- POST /attendance/scan (employee scans + evidence payload)
- POST /attendance/manual-adjustment (with approvals)
- GET /attendance/logs
- GET /timesheets/my
- POST /timesheets/submit
- POST /timesheets/{id}/approve
## Leave
- GET /leave/balance
- POST /leave/request
- POST /leave/{id}/approve
- POST /leave/{id}/reject
## Payroll
- POST /payroll/run/create
- POST /payroll/run/{id}/compute
- POST /payroll/run/{id}/validate
- POST /payroll/run/{id}/lock
- POST /payroll/run/{id}/publish
- GET /payroll/run/{id}/export/bank
- GET /payslips/my
- POST /payslips/{id}/ack
Loans/Cash Advance
- POST /loans/request (optional)

- POST /loans/issue
- POST /loans/{id}/schedule
- GET /loans/my
- POST /loans/{id}/freeze
## Reporting
- GET /reports/attendance
- GET /reports/payroll
- GET /reports/loans
## Audit
- GET /audit/logs

12) Tech Architecture (Full Build, Production Grade)
## Backend
- Multi-tenant SaaS architecture
- PostgreSQL (strong relational + reporting)
- Queue worker system for:
o payroll computations
o payslip generation (PDF)
o notifications
o imports/exports
- Object storage for:
o payslip PDFs
o selfie images
o attachments (leave docs)
## Frontend
- Web admin: React/Next.js (or similar)

- Mobile: Flutter or React Native (both work)
- Kiosk: web app in “kiosk mode” or dedicated tablet app
## Offline & Sync
- Mobile stores encrypted pending attendance scans
- Sync service retries
- Server rejects duplicates based on token + timestamp + employee + device
signature

13) Security, Privacy, and Compliance (especially biometrics)
Required controls
- Encrypt data in transit + at rest
- Strict RBAC + least privilege
- Audit logs immutable
- Biometric data:
o store templates if possible (not raw)
o explicit consent capture
o retention policy (delete after X months/years)
o admin access restricted, no casual viewing
- Device binding + suspicious activity flags
- Payroll: “two-person rule” optional (one computes, another locks)
If you ignore this, enterprise clients will not onboard.

14) Country Payroll “Rule Packs”
Because you want this for many industries, you should implement Payroll Rule Packs (per
country) as a configurable engine:
- taxes
- statutory contributions

- holiday rules
- 13th month rules (if applicable)
- overtime multipliers
Without rule packs, your payroll will become spaghetti.

 PH Payroll Architecture (Fully Detailed)
Since you are PH-only, we hard-implement:
## Mandatory Government Deductions
## • SSS
- PhilHealth
- Pag-IBIG
## • Withholding Tax
These must be:
- Versioned (tables change yearly)
- Effective-date based
- Snapshot into payroll run
## 13th Month Logic
- Accrued monthly
- Based on basic salary only
- Auto calculation
- Paid in December or manual trigger
## Holiday Rules
## • Regular Holiday
- Special Non-Working Holiday
- Rest day + holiday combinations
These must follow PH multipliers.


 Semi-Monthly Payroll Design
Payroll periods:
## • 1st–15th
- 16th–End of month
Your system must support:
- Cutoff auto generation yearly
- Different period lengths (28/29/30/31 days)
- Proration for new hires
- Final pay logic

Attendance System (QR + Geofence Baseline)
Required for every clock-in:
- Scan Dynamic QR
o Token expires 30 seconds
o Single-use validation
- Geofence validation
o Default radius: 100 meters
o Accuracy threshold: ≤ 30 meters
o Location timestamp freshness check
- Device binding
o Each employee registers 1 device
o Device change requires admin approval
Stored Evidence per log:
- GPS coordinates
## • Accuracy

- QR token ID
- Device ID
## • Timestamp
- Pass/fail status
This protects you in labor disputes.

✍ Drawn Signature for Payslips
You selected drawn signature — good for PH compliance perception.
Implementation must include:
When employee opens payslip:
- Show PDF preview
- Draw signature pad (touch/mouse)
- Save signature image (PNG)
## 4. Store:
o signed_at
o IP
o device
o signature image
o pdf_hash
PDF must embed:
- Employee signature image
- Company digital stamp
## • Timestamp
- Verification hash
No edit allowed after signing.


Loan / Cash Advance Rules (Configurable)
Since configurable, build this structure:
## Company Settings:
- Max deduction % of NET pay (default suggest 30%)
- Deduction priority level
- Allow deduction below minimum net? (toggle)
- Allow admin override? (toggle)
Per loan:
- Fixed amount per cutoff OR
- Fixed number of installments
- Interest optional
- Early settlement allowed
- Pause repayment allowed
System must:
- Prevent deduction exceeding configured % automatically
- If net pay too low → carry forward remaining balance
- Log every deduction event

Full Payroll Flow (PH Version)
## Step 1: Attendance Lock
- Supervisor approves timesheets
- HR locks attendance
## Step 2: Payroll Build
System pulls:
- Approved timesheets
- Approved leaves

- Active compensation rates
- Active loan schedules
## Step 3: Compute Earnings
- Basic pay
## • OT
## • Holiday
## • Allowances
## • Adjustments
## Step 4: Compute Deductions
- SSS (table based)
- PhilHealth (table based)
- Pag-IBIG
- Withholding tax
## • Loans
- Custom deductions
## Step 5: Validation
- Negative net?
- Excess loan deduction?
- Missing timesheet approvals?
- Missing signature from previous period? (optional enforcement)
## Step 6: Lock Payroll Run
Once locked:
- No editing allowed
- Adjustments must create separate record
## Step 7: Publish Payslips
- Notify employees

- Require drawn signature

Required Reports (PH Standard)
## Attendance:
- Late report
- Absence report
- Project manpower report
## Payroll:
- Payroll register
- SSS summary
- PhilHealth summary
- Pag-IBIG summary
- Withholding tax summary
- Loan balances
- 13th month accrual report

Critical Safeguards (You Must Include)
- Payroll locking mechanism
- Immutable attendance logs
- Full audit trail
- Payroll snapshot of tax tables per run
- Evidence storage for attendance
- Role separation (HR cannot modify payroll rules casually)
Without these, you cannot sell to serious companies.

 System Layers (Final Structure)

## Frontend:
## • Admin Web
## • Payroll Web
## • Employee Mobile
- Kiosk QR Display
## Backend:
## • API
- Payroll computation engine
- Rule engine
- Evidence validation engine
- PDF generation service
- Notification service
## Database:
- Relational (PostgreSQL)
- Object storage for:
o Payslips
o Signatures
o Attachments

## One Honest Warning
Drawn signature increases friction.
Some employees will complain.
Make sure:
- Signature only required once per payslip
- UI is fast and responsive
- No re-signing allowed

