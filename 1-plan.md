---
description: 
globs: 
alwaysApply: false
---

You are a world-class software engineer with decades of experience. You are given a task that is related to the current project. It's either a bug that needs fixing, or a new feature that needs to be implemented. Your job is to come up with a step-by-step plan which when implemented, will solve the task completely.

First, analyse the project and understand the parts which are relevant to the task at hand. Use the available README-s and documentation in the repo, in addition to discovering the codebase and reading the code itself. Make sure you understand the structure of the codebase and how the relevant parts relate to the task at hand before moving forward.

Then, come up with a step-by-step plan for implementing the solution to the task. The plan will be sent to another agent, so it should contain all the necessary information for a successful implementation. Usually, the plan should start with a short description of the solution and how it relates to the codebase, then a step-by-step plan should follow which describes what changes have to be made in order to implement the solution.

Output the plan in a code block at the end of your response as a formatted markdown document. Do not implement any changes. Another agent will take over from there.

This is the task that needs to be solved:

# Pre-task (HIGH PRIORITY MUST BE AT THE TOP OF THE IMPLEMENTATION PLAN)

- Always make an implementation plan on an artifact first, so the developer can review the plan first.
- Always check if the fixes given will actually fix the problem. Give a short report inside the implementation plan about the matter.
- CHECK FIRST, if the bug really exists or not. If not, report it in the implementation plan.

# Main Task

NexHRMS — Antigravity Master Prompts
Tonight's Bug Sprint · 5pm – 7pm

BATCH A

All touch different files. Spawn as separate agents simultaneously.

BATCH A · PROMPT 2 OF 4
BUG-001 — confirmPayslip Reverts Published Payslips Back to "draft"
TASK: Fix a data corruption bug in the payroll service and its API route.

PROJECT STACK: Next.js 14, TypeScript, Supabase

SCAN THESE FILES BEFORE MAKING ANY CHANGES:
  src/services/payroll.service.ts
  src/app/api/payroll/status/route.ts

WHAT IS CURRENTLY HAPPENING:
  The confirmPayslip() function in payroll.service.ts is documented as a
  no-op but is actually calling updatePayslip with { status: "draft" }.
  Any payslip that is already "published" gets silently reverted to "draft"
  in the database whenever confirm is triggered.

  The same problem likely exists in the "confirm" case inside the API route
  at src/app/api/payroll/status/route.ts. Scan that file and fix it there
  too if it sends { status: "draft" } for the confirm action.

WHAT SHOULD HAPPEN AFTER THE FIX:
  confirmPayslip() must be a true no-op — fetch and return the current
  payslip without modifying any field, especially not the status field.
  The API route's confirm case must also leave the status unchanged.

ACCEPTANCE CRITERIA:
  - Calling confirmPayslip on a "published" payslip leaves it "published"
  - Calling confirmPayslip on a "draft" payslip leaves it "draft"
  - No database write happens — only a read

CONSTRAINTS:
  - Only change confirmPayslip in payroll.service.ts
  - Fix the confirm case in the API route if it has the same bug
  - Do NOT modify any other functions in either file
  - Run npx tsc --noEmit after the fix

BATCH A · PROMPT 3 OF 4
BUG-010 — publishPayrollRun Never Sets Status to "published"
TASK: Fix a status inconsistency bug across the payroll service and store.

PROJECT STACK: Next.js 14, TypeScript, Supabase, Zustand

SCAN THESE FILES BEFORE MAKING ANY CHANGES:
  src/services/payroll.service.ts
  src/store/payroll.store.ts

WHAT IS CURRENTLY HAPPENING:
  The publishPayrollRun() function in payroll.service.ts sets the
  publishedAt timestamp but never updates the status field. After calling
  publishPayrollRun, the run still has status "locked" in the database.

  Also check the publishRun action in payroll.store.ts — verify whether
  the Zustand store action correctly updates the payroll run's own status
  field to "published". If not, fix it there as well.

WHAT SHOULD HAPPEN AFTER THE FIX:
  After publishPayrollRun is called, status must be "published" AND
  publishedAt must be set — both written together in the same call. The
  run must no longer show as "locked" in the UI after publish.

ACCEPTANCE CRITERIA:
  - After publishing, payrollRun.status === "published"
  - After publishing, payrollRun.publishedAt is set
  - The UI status label updates from "locked" to "published"

CONSTRAINTS:
  - Fix publishPayrollRun in payroll.service.ts
  - Fix publishRun in payroll.store.ts if it has the same gap
  - Do NOT touch lockPayrollRun or markPayrollRunPaid
  - NOTE: BUG-001 is also being fixed in payroll.service.ts by a
    separate parallel agent — when merging, preserve both fixes
  - Run npx tsc --noEmit after the fix

BATCH A · PROMPT 4 OF 4
BUG-003 — getHolidays Crashes With Non-Existent "year" Column
TASK: Fix a database query bug in the attendance service.

PROJECT STACK: Next.js 14, TypeScript, Supabase

SCAN THESE FILES BEFORE MAKING ANY CHANGES:
  src/services/attendance.service.ts
  supabase/migrations/002_foundation_tables.sql   (READ ONLY — do not modify)

WHAT IS CURRENTLY HAPPENING:
  The getHolidays() function filters holidays using a "year" column via
  an equality filter. The holidays table in the database has no "year"
  column — only a "date" column of type date. This causes a PostgREST
  runtime error every time getHolidays() is called with a year argument,
  breaking any screen that loads holidays or renders the calendar.

WHAT SHOULD HAPPEN AFTER THE FIX:
  When getHolidays(year) is called, filter rows by checking whether
  the "date" column falls within the given year using a date range
  (gte start of year, lte end of year). When called with no argument,
  return all holidays unfiltered.

ACCEPTANCE CRITERIA:
  - getHolidays(2026) returns only rows where date is between
    2026-01-01 and 2026-12-31 with no database error
  - getHolidays() with no argument returns all rows
  - No migration files are modified
  - No "year" column is added anywhere

CONSTRAINTS:
  - Only change the year filter logic inside getHolidays
  - Do NOT modify any other function in the file
  - Do NOT modify any files under supabase/migrations/
  - Run npx tsc --noEmit after the fix


BATCH B

Merge all Batch A outputs into the project first, then start these.


BATCH B · PROMPT 1 OF 3
BUG-002 — recordPayment Never Sets Payslip Status to "paid"
TASK: Fix a critical status transition bug across the payroll store
and payroll service. This fix spans two files.

PROJECT STACK: Next.js 14, TypeScript, Supabase, Zustand

SCAN THESE FILES BEFORE MAKING ANY CHANGES:
  src/store/payroll.store.ts
  src/services/payroll.service.ts
  src/types/index.ts
  src/components/payroll/payslip-detail.tsx
  src/components/payroll/payslip-table.tsx

WHAT IS CURRENTLY HAPPENING:
  There are three locations where payment is recorded but the payslip
  status field is never updated:

  Location 1 — src/store/payroll.store.ts, the recordPayment action:
    Sets paidAt and paymentMethod but never sets status to "paid".

  Location 2 — src/store/payroll.store.ts, the confirmPaidByFinance action:
    Sets paidAt and other payment fields but never sets status to "paid".

  Location 3 — src/services/payroll.service.ts, the recordPayment function:
    Sets paidAt and payment metadata but never sets status to "paid".

  After payment, payslips stay permanently stuck on "published". The
  "paid" status is completely unreachable from the UI.

WHAT SHOULD HAPPEN AFTER THE FIX:
  All three locations must set status to "paid" alongside the existing
  payment fields. Check src/types/index.ts to confirm "paid" is a valid
  status in the Payslip type — add it if missing.

ACCEPTANCE CRITERIA:
  - After recordPayment in the store → payslip.status === "paid"
  - After confirmPaidByFinance in the store → payslip.status === "paid"
  - After recordPayment in the service → DB row status === "paid"
  - All other payment fields (paidAt, paymentMethod, etc.) still set

CONSTRAINTS:
  - Fix all three locations: store (x2) and service (x1)
  - Batch A already fixed BUG-001 and BUG-010 in payroll.service.ts —
    do NOT overwrite those fixes when editing that file
  - Do NOT change any other store actions or service functions
  - Run npx tsc --noEmit after the fix

BATCH B · PROMPT 2 OF 3
BUG-007 — duplicate_scan Exceptions Accumulate Endlessly
TASK: Fix a missing deduplication guard in the attendance exception
generator.

PROJECT STACK: Next.js 14, TypeScript, Zustand

SCAN THESE FILES BEFORE MAKING ANY CHANGES:
  src/store/attendance.store.ts
  src/types/index.ts

WHAT IS CURRENTLY HAPPENING:
  In the autoGenerateExceptions action inside attendance.store.ts, the
  missing_in and missing_out checks already guard against duplicates
  before pushing a new exception. The duplicate_scan check has no such
  guard. Every time autoGenerateExceptions is called for the same date,
  a new duplicate_scan exception is appended to the store, causing the
  exception queue to grow without limit on repeated calls.

WHAT SHOULD HAPPEN AFTER THE FIX:
  Before pushing a new duplicate_scan exception, check whether one
  already exists in the store for the same employeeId, date, and flag
  combination. Only push if no existing match is found. This mirrors the
  pattern already in place for missing_in and missing_out.

ACCEPTANCE CRITERIA:
  - Running autoGenerateExceptions multiple times on the same date does
    not create duplicate duplicate_scan exceptions
  - The first call still correctly creates one exception when a duplicate
    scan is detected
  - missing_in and missing_out behavior is unchanged

CONSTRAINTS:
  - Only add the duplicate guard inside the duplicate_scan block within
    autoGenerateExceptions
  - Do NOT modify any other part of the store
  - Do NOT change any other file
  - Run npx tsc --noEmit after the fix

BATCH B · PROMPT 3 OF 3
BUG-008 — upsertAttendanceLog Conflicts on Wrong Column
TASK: Fix an incorrect upsert conflict target in the attendance service.

PROJECT STACK: Next.js 14, TypeScript, Supabase

SCAN THESE FILES BEFORE MAKING ANY CHANGES:
  src/services/attendance.service.ts
  supabase/migrations/002_foundation_tables.sql   (READ ONLY — do not modify)

WHAT IS CURRENTLY HAPPENING:
  The upsertAttendanceLog function uses onConflict: "id" as the conflict
  target. Because attendance log IDs are generated on the client, two
  sessions inserting a log for the same employee on the same date will
  each generate different IDs and both rows get inserted separately
  instead of one updating the other.

WHAT SHOULD HAPPEN AFTER THE FIX:
  The upsert must conflict on the logical unique key — employee_id and
  date together. When the same employee+date combination is inserted
  again, it must update the existing row instead of creating a new one.

  Also read the attendance_logs table definition in the migration file.
  If a UNIQUE constraint on (employee_id, date) does not exist, add a
  code comment noting that this constraint needs to be added to the DB
  migration, but do NOT modify the migration file itself.

ACCEPTANCE CRITERIA:
  - Two upsert calls for the same employee_id + date result in one row
  - The onConflict target is employee_id,date

CONSTRAINTS:
  - Only change the onConflict target inside upsertAttendanceLog
  - Do NOT modify any other function
  - Do NOT modify any migration files
  - Run npx tsc --noEmit after the fix


BATCH C

These all touch attendance.store.ts and payroll.store.ts.
Run sequentially to avoid merge conflicts.


BATCH C · PROMPT 1 OF 3
BUG-004 — Night Shift Workers Get False "missing_out" Exceptions Daily
TASK: Fix a UTC vs local date mismatch bug throughout the attendance store.

PROJECT STACK: Next.js 14, TypeScript, Zustand

SCAN THESE FILES BEFORE MAKING ANY CHANGES:
  src/store/attendance.store.ts
  src/types/index.ts

WHAT IS CURRENTLY HAPPENING:
  Several functions in attendance.store.ts filter attendance events by
  comparing e.timestampUTC.startsWith(date) where date is a YYYY-MM-DD
  string. This works for day shift but breaks for Philippine night shift
  workers (e.g. 10pm–6am PHT / UTC+8).

  A 6am PHT clock-out is stored as 10pm UTC of the PREVIOUS calendar day.
  When the system looks for that clock-out event using startsWith on the
  UTC string, it finds nothing because the UTC date is yesterday. This
  triggers a false missing_out exception every day for night shift workers.

WHAT SHOULD HAPPEN AFTER THE FIX:
  All date comparisons on timestampUTC must convert to Philippine time
  (UTC+8) before comparing against a YYYY-MM-DD date string. The
  conversion must use a fixed +8 hour offset — not the browser's local
  timezone — because field employees may be in different timezones.

  Scan the entire attendance.store.ts file and fix every location that
  currently uses startsWith(date) or any other UTC string comparison
  against a local date. All must use the same shared helper.

ACCEPTANCE CRITERIA:
  - An employee clocking out at 6am PHT (stored as 10pm UTC previous day)
    does NOT trigger a missing_out exception for their work date
  - Day shift employees (9am–6pm PHT) are completely unaffected
  - All date comparisons in the file use PHT (UTC+8) consistently

CONSTRAINTS:
  - Define one shared helper function (e.g. toLocalPHT) that converts a
    UTC ISO string to YYYY-MM-DD using a fixed +8 hour offset
  - Use this helper everywhere — do not inline the conversion
  - Do NOT use new Date().getTimezoneOffset() or Intl APIs
  - Do NOT modify any other store files
  - Run npx tsc --noEmit after the fix

BATCH C · PROMPT 2 OF 3
BUG-005 — Final Pay Cannot Be Recalculated Once Computed
TASK: Fix a blocking guard in the payroll store that prevents final pay
from being recalculated.

PROJECT STACK: Next.js 14, TypeScript, Zustand

SCAN THESE FILES BEFORE MAKING ANY CHANGES:
  src/store/payroll.store.ts
  src/components/payroll/compute-final-pay-dialog.tsx
  src/types/index.ts

WHAT IS CURRENTLY HAPPENING:
  The computeFinalPay action in payroll.store.ts checks whether a final
  pay computation already exists for the employee and returns early with
  no changes if one is found. There is no way for a user to correct a
  final pay once computed — even if the inputs were wrong (wrong last
  working day, wrong salary, etc.).

WHAT SHOULD HAPPEN AFTER THE FIX:
  If a final pay computation already exists for an employee, the new
  computation should replace it instead of being silently blocked. The
  latest computation is always the correct one.

  Also update compute-final-pay-dialog.tsx — if the dialog has any UI
  that prevents re-triggering the computation, replace it with a
  confirmation prompt: "This will replace the existing final pay
  calculation. Continue?"

ACCEPTANCE CRITERIA:
  - Computing final pay for an employee that already has one replaces
    the old computation with the new values
  - The old record is removed — not duplicated
  - The UI allows the user to re-trigger the computation

CONSTRAINTS:
  - Fix the guard inside computeFinalPay in payroll.store.ts
  - Update the dialog UI if needed
  - Do NOT change any other store actions
  - Run npx tsc --noEmit after the fix

BATCH C · PROMPT 3 OF 3
BUG-006 — Final Pay Omits Mandatory Government Deductions
TASK: Fix non-compliant final pay computation that skips mandatory
Philippine government deductions.

PROJECT STACK: Next.js 14, TypeScript, Zustand

SCAN THESE FILES BEFORE MAKING ANY CHANGES:
  src/store/payroll.store.ts
  src/lib/ph-deductions.ts
  src/components/payroll/compute-final-pay-dialog.tsx
  src/types/index.ts

WHAT IS CURRENTLY HAPPENING:
  The computeFinalPay action computes gross final pay (prorated salary +
  unpaid overtime + leave payout) but only deducts the employee's loan
  balance. Philippine DOLE and BIR require that SSS, PhilHealth, Pag-IBIG,
  and withholding tax still apply to final pay. Skipping them produces a
  net final pay that is higher than legally correct.

WHAT SHOULD HAPPEN AFTER THE FIX:
  After computing gross final pay, use computeAllPHDeductions() from
  src/lib/ph-deductions.ts to calculate all government contributions.
  Add these to the total deductions alongside the loan balance. Net final
  pay = gross - loan balance - government deductions, floored at zero.

  Update compute-final-pay-dialog.tsx to show each government deduction
  line separately (SSS, PhilHealth, Pag-IBIG, withholding tax) in the
  breakdown so the user can see what was applied.

ACCEPTANCE CRITERIA:
  - computeFinalPay applies SSS, PhilHealth, Pag-IBIG, and withholding
    tax to the gross final pay amount
  - Net final pay can never go below ₱0
  - The dialog shows each deduction line separately

CONSTRAINTS:
  - Import and use computeAllPHDeductions from src/lib/ph-deductions.ts
  - NOTE: BUG-009 fixed the SSS rounding in ph-deductions.ts earlier
    in this sprint — do NOT overwrite that fix
  - Do NOT modify ph-deductions.ts itself
  - Do NOT change any other store actions
  - Run npx tsc --noEmit after the fix


SMOKE TEST · 6:50–7:00pm
Run these after all batches are merged:

 1. npx tsc --noEmit
    → Must return zero errors before testing anything in the browser

 2. BUG-009
    Payroll → issue payslip for employee with ₱15,500 salary
    → SSS line must show ₱698 (not ₱697.50)

 3. BUG-002
    Payroll → publish a payslip → click Record Payment
    → Payslip status must change to "paid"

 4. BUG-010
    Payroll → lock a run → click Publish Run
    → Run status must change to "published" (not stay "locked")

 5. BUG-007
    Attendance → trigger auto-generate exceptions twice on same date
    → duplicate_scan count must not double on the second run

 6. BUG-004 (if time allows)
    Create an attendance event with timestampUTC set to 10pm last night
    → Must NOT trigger a missing_out exception for today