# Payslip Import, Export & Attendance Bug Fix Spec — Tailored to NexHRMS-v2

> This is the codebase-specific version of `payslip-import-export-spec.md`.
> Every file path, type name, function name, store method, API route, and DB column
> below has been verified against the actual repository.
>
> **Critical rule: Do NOT change any existing system behavior. Only add or extend.**
> **All new behavior is gated behind `source === "imported"` / `computedExternally === true`.**

---

## How this system actually works (verified)

### Import flow (today)
1. `src/components/import-data-dialog.tsx` parses the XLSX client-side.
   - `convertPBRawToPayrollRows()` and `convertNexHRISToPayrollRows()` turn vendor sheets into
     `PayrollRow = Record<string, string>` objects keyed by the fixed headers in `PAYROLL_TEMPLATE_COLS`.
   - `PBPreviewDialog` (PB format) and `TemplatePreviewDialog` (standard template) render the editable cards.
   - **Only the fixed `PAYROLL_TEMPLATE_COLS` are rendered.** Any extra column in the file is silently dropped here.
2. On confirm, the dialog `POST`s `{ rows, dryRun }` to **`/api/import/payroll`** (`src/app/api/import/payroll/route.ts`).
3. That route maps each row to a `payslips` DB row, inserts with `status: "draft"`, `id: PS-IMP-...`, and
   **does NOT create a `payroll_runs` row.** (Confirmed — there is no run creation in the route.)

> ⚠️ This is different from the normal in-app flow. The Zustand `usePayrollStore.issuePayslip()`
> auto-creates a run (`RUN-${periodStart}/${periodEnd}`), but the **import route bypasses the store entirely**
> and writes straight to Supabase. So imported payslips currently land with **no run**, which is why they
> can't be locked/paid. Part 2 fixes this.

### Export flow (today)
- `src/components/payroll-export-dialog.tsx`:
  - `buildEmployeeData()` builds `EmployeePayrollData[]`, finding the matching payslip by
    `employeeId` + period overlap.
  - `getDTRForEmployee(employeeId, periodFrom, periodTo)` builds the DTR grid **from the attendance store**
    (`useAttendanceStore().logs`), iterating every calendar day in the period.
  - `buildTemplateSheet(emp)` → styled XLSX (xlsx-js-style). `generatePayrollPDF(employees, filename)` → print-window HTML/PDF.
  - Both already render dynamic allowance/deduction rows from `payslip.lineItemsJson` and the DTR right side.
- `src/components/payroll/printable-payslip.tsx` is a **separate, simpler** single-payslip print dialog
  (`PrintablePayslip`). It already reads `lineItemsJson` and the `attendance*` snapshot fields. It does
  NOT render the PB-style DTR grid. (Leave its layout intact; only the export-dialog templates get the DTR-from-import branch.)

### Attendance / biometric flow (today)
- `src/components/attendance/biometric-import-dialog.tsx` parses a T800-style biometric XLSX into
  `BiometricImportRecord[]` (one record per employee+date).
- `handleBiometricImport()` in `src/app/[role]/attendance/_views/admin-view.tsx` calls the **Zustand store**
  method `useAttendanceStore().bulkUpsertLogs(...)`. **The store method only mutates in-memory state — it never writes to Supabase.**
- A correct **DB-first** version already exists: `bulkUpsertLogs()` in
  `src/services/attendance-actions.service.ts` (awaits `attendanceDb.upsertLog()` per row).
- `attendanceDb.upsertLog` → `upsertRow("attendance_logs", row, "employee_id,date")`, backed by the unique
  constraint from migration `015_attendance_logs_unique.sql` (`UNIQUE (employee_id, date)`).

> ⚠️ **This is the real Part 4 bug ("Pattern B").** The biometric import writes to the store only.
> On refresh, `sync.service.fetchLogs()` re-hydrates `logs` from the DB, which never received the imported
> rows — so imported days vanish or appear inconsistent versus device-synced days that *are* in the DB.

---

## Type & column reference (use these EXACT names)

`Payslip` (`src/types/index.ts`) — camelCase in app, snake_case in DB (`keysToSnake`/`keysToCamel`):

| App field (camelCase) | DB column (snake_case) | Notes |
|---|---|---|
| `grossPay` | `gross_pay` | |
| `allowances` | `allowances` | |
| `overtimePay` | `overtime_pay` | optional |
| `holidayPay` | `holiday_pay` | optional |
| `sssDeduction` | `sss_deduction` | |
| `philhealthDeduction` | `philhealth_deduction` | |
| `pagibigDeduction` | `pagibig_deduction` | |
| `taxDeduction` | `tax_deduction` | |
| `loanDeduction` | `loan_deduction` | |
| `customDeductions` | `custom_deductions` | |
| `otherDeductions` | `other_deductions` | |
| `netPay` | `net_pay` | |
| `dailyRate` | `daily_rate` | |
| `hourlyRate` | `hourly_rate` | |
| `lineItemsJson` | `line_items_json` | `PayslipLineItem[]`, `type: "earning" \| "deduction" \| "government" \| "loan"` |
| `attendanceDaysPresent` | (LOCAL ONLY — stripped) | see gotcha below |
| `attendanceDaysAbsent` | (LOCAL ONLY — stripped) | |
| `attendanceLateMinutes` | (LOCAL ONLY — stripped) | |
| `attendanceUndertimeHours` | (LOCAL ONLY — stripped) | |

> 🚨 **Gotcha — `db.service.ts` strips fields before upsert.**
> `upsertPayslip`, `batchUpsertPayslips`, and `updatePayslip` all `delete row.attendanceDaysPresent`,
> `attendanceDaysAbsent`, `attendanceLateMinutes`, `attendanceUndertimeHours`, `holdNote`, `heldAt`,
> `grossOverrideApplied`. So the existing `attendance*` snapshot fields are **display-only and never persisted**.
> The new DTR-import fields below MUST be real DB columns AND must NOT be added to the strip list, or they
> won't survive a write.

`PayslipStatus = "draft" | "published" | "signed" | "paid" | "payment_hold"`
`PayrollRunStatus = "draft" | "locked" | "published" | "ended" | "completed"`
`PayrollRun` key fields: `id`, `periodLabel`, `status`, `locked`, `payslipIds`, `periodStart`, `periodEnd`, `runType`.

Store/service handles to reuse (do not reinvent):
- `usePayrollStore`: `createDraftRun(runDate, payslipIds, runType?, periodStart?, periodEnd?)`, `lockRun`, `issuePayslip`.
- `src/services/payroll-actions.service.ts`: `lockRunDbFirst(periodLabel, lockedBy)`.
- `src/services/attendance-actions.service.ts`: `bulkUpsertLogs(rows)` ← DB-first, this is the one Part 4 should use.

---

## New fields required on the payslip record

Add via a **new migration** `063_imported_payroll_support.sql` (next free number; idempotent, additive, no DROP — match the style of `055_client_feature_pack.sql`). All columns nullable so existing rows are unaffected.

| App field | DB column | Type | Purpose |
|---|---|---|---|
| `source` | `source` | `text default 'system'` | `'system' \| 'imported'` |
| `computedExternally` | `computed_externally` | `boolean default false` | prevents recomputation |
| `importedFileName` | `imported_file_name` | `text` | banner text |
| `importedAt` | `imported_at` | `timestamptz` | when imported |
| `dtrDaysPresent` | `dtr_days_present` | `numeric` | receipt only |
| `dtrDaysAbsent` | `dtr_days_absent` | `numeric` | receipt only |
| `dtrLateMinutes` | `dtr_late_minutes` | `numeric` | receipt only |
| `dtrOtHours` | `dtr_ot_hours` | `numeric` | receipt only |
| `dtrTardHours` | `dtr_tard_hours` | `numeric` | receipt only |
| `dtrPerDayJson` | `dtr_per_day_json` | `jsonb` | per-day rows if present in file |

Then add the matching optional fields to the `Payslip` interface in `src/types/index.ts`.

> ✅ Because `db.service.ts` only strips a fixed set of keys, these new camelCase fields flow through
> `keysToSnake` and persist automatically — **do not add them to the strip list.**
> Also add a `payroll_runs.source` (`text default 'system'`) + `payroll_runs.imported_file_name` (`text`) column for Part 2.

Run via `supabase/apply_missing_migrations.sql` pattern (Supabase SQL editor), consistent with existing migration application here.

---

## Part 1 — Import Modal: Auto-Field Detection

### Files
- `src/components/import-data-dialog.tsx` — `PBPreviewDialog`, `TemplatePreviewDialog`, `convertPBRawToPayrollRows`, `convertNexHRISToPayrollRows`, `PAYROLL_TEMPLATE_COLS`, `PayrollRow`.
- `src/app/api/import/payroll/route.ts` — server commit.

### What needs to change
The converters today emit only `PAYROLL_TEMPLATE_COLS`. Extend so every column in the source file with at least one non-empty value is surfaced.

**Step 1 — Known-field mapping.** When parsing, normalize headers (trim + lowercase) and map to the existing template columns. Reuse the column header semantics already in `PAYROLL_TEMPLATE_COLS`:

| XLSX header (case-insensitive) | Maps to template column |
|---|---|
| Employee Name / Full Name | `Employee Name` |
| Employee No / Employee ID | (store in `Notes` as `ID:<x>` — matches existing NexHRIS re-import convention) |
| Email | `Email` |
| Department | `Department` |
| Position / Job Title | `Job Title` |
| Period Start / Pay Period From | `Period Start` |
| Period End / Pay Period To | `Period End` |
| Pay Frequency / Frequency | `Pay Frequency` |
| Basic Pay / Gross / Monthly Salary | `Gross Pay` |
| SSS / SSS Contribution | `SSS` |
| PhilHealth | `PhilHealth` |
| Pag-IBIG / HDMF | `Pag-IBIG` |
| Withholding Tax / BIR | `Tax` |
| Loan | `Loan Deduction` |
| Net Pay | `Net Pay` |
| OT / Overtime Pay | new earning line item |
| Transportation / Gas Allowance / etc. | new allowance line item |
| Days Present | `dtrDaysPresent` (receipt only) |
| Days Absent / Absences | `dtrDaysAbsent` (receipt only) |
| Late (Min) / Tardiness Min | `dtrLateMinutes` (receipt only) |
| OT Hours | `dtrOtHours` (receipt only) |
| Tard Hr / Tardiness Hr | `dtrTardHours` (receipt only) |

**Step 2 — Unknown columns.** Any header that has a value but matches nothing above becomes a custom editable field:
- Label = original header (preserve casing).
- Value = pre-filled from file.
- Default classification `{ type: "deduction", section: "deduction" }`; user can relabel and/or move to Earnings before confirm.
- Carry these on the `PayrollRow` object under an extra namespaced key (e.g. prefix custom keys so they don't collide with `PAYROLL_TEMPLATE_COLS`). Render them in the dialog's `sections` map by appending a dynamic "Custom" group.

**Step 3 — Render all fields.** Both `PBPreviewDialog` and `TemplatePreviewDialog` build their UI from a static `sections` array. Extend the array to add:
- An **Attendance (DTR)** section (read-only numeric inputs) with helper text:
  `"Attendance data — will appear on receipt only, not saved to attendance_logs"`.
- A **Custom** section that maps over the detected custom columns.

Keep the existing Employee / Pay Period / Earnings / Deductions / Payment groups exactly as they are.

**Step 4 — Validation.** Today the confirm button is only blocked by `missingEmailCount > 0` and `rows.length === 0`. Extend the per-row required check (the `requiredFields` Set / `REQUIRED_COLS`) to also flag empty `Period Start`, `Period End`, and `Gross Pay` with the existing red-border + "Required" helper styling. Add:
- If a `Net Pay` column exists, show a read-only computed preview `grossPay + allowances + customEarnings - deductions - customDeductions`.
- If computed net ≠ imported net, show an amber note: `"Imported net pay differs from computed. Imported figure will be used."` (Do not block.)

**Step 5 — On confirm.** Extend the POST body to `/api/import/payroll` to carry the new data, and extend the route to persist it:
- Map known salary fields exactly as today.
- Persist DTR fields to the **payslip row only** (`dtr_days_present`, `dtr_days_absent`, `dtr_late_minutes`, `dtr_ot_hours`, `dtr_tard_hours`, `dtr_per_day_json`). **Never** touch `attendance_logs`.
- Set `source: "imported"`, `computed_externally: true`, `imported_file_name: <filename>`, `imported_at: now()`.
- Custom columns → `line_items_json` entries with `type: "earning" | "deduction"` per the user's section choice.
- Keep the existing duplicate detection (`employee_id|period_start|period_end`) and audit-log write untouched.

---

## Part 2 — Payroll Run from Import

### Files
- `src/app/api/import/payroll/route.ts` (primary change — create the run here on non-dry-run commit).
- `src/store/payroll.store.ts` (`createDraftRun`, run shape) and `src/services/payroll-actions.service.ts` (`lockRunDbFirst`) for reference.
- `src/components/payroll/payslip-table.tsx` (`isPayslipRunLocked` gating) — verify, do not change behavior for normal runs.

### What needs to change
After the route inserts imported payslips (non-dry-run), it must also create one `payroll_runs` row per distinct imported period:

1. Insert a `payroll_runs` row:
   - `id`: `RUN-IMP-<period>` (keep distinct from the store's `RUN-${start}/${end}` to avoid collision).
   - `period_label` + `period_start`/`period_end` from the imported rows.
   - `payslip_ids`: the imported payslip ids for that period (also populate the junction table per migration `028_payroll_run_payslips_junction.sql` if that path is used on read).
   - `status: "locked"`, `locked: true`, `locked_at: now()` — figures are final, no draft→lock step.
   - `source: "imported"`, `imported_file_name: <filename>`, `run_type: "regular"`.
2. Set each imported payslip's `payroll_batch_id` to that run id (so `isPayslipRunLocked` and the publish/sign/pay guards in `payroll.store.ts` work unchanged).
3. Run title shown in the Payroll Runs table: `"Imported — <filename> — <period label>"`. Derive this in the UI from `run.source === "imported"` + `run.importedFileName`; do not change `periodLabel` semantics for normal runs.

### What must NOT change
- Normal run creation via `issuePayslip`/`createDraftRun` stays as-is.
- The Payroll Runs table rendering for non-imported runs stays as-is.
- No recomputation of imported figures — every number from the file is final.
- The "Run Payroll" button logic must not be blocked by an imported (already-locked) run.

---

## Part 3 — PDF and XLSX Export Template

### Files
- `src/components/payroll-export-dialog.tsx` — `buildEmployeeData()`, `getDTRForEmployee()`, `buildTemplateSheet()` (XLSX), `generatePayrollPDF()` (PDF), `EmployeePayrollData`.
- (Do NOT touch `src/components/payroll/printable-payslip.tsx` layout.)

### Condition check
In `buildEmployeeData()`, after locating `payslip`, compute:
```ts
const isImported = payslip?.source === "imported" || payslip?.computedExternally === true;
```
Thread `isImported`, `importedFileName`, and the `dtr*` summary fields onto `EmployeePayrollData` (extend the interface with optional `imported?: boolean`, `importedFileName?: string`, `dtrSummary?: {...}`, `dtrPerDay?: [...]`).

### Normal payroll (`!isImported`)
- No change whatsoever. `getDTRForEmployee()` keeps pulling from `useAttendanceStore().logs`.

### Imported payroll (`isImported`)

**Change 1 — DTR source swap.** Instead of `getDTRForEmployee()` (attendance store), build the `dtr` array from the payslip:
- If `dtrPerDayJson` has per-day rows, map them into the existing `dtr` shape (`date, day, timeIn, timeOut, totalHrs, otHrs, tardinessHr, tardinessMin, absences`).
- If only summary totals exist, leave per-day rows blank and fill only the TOTALS row from `dtrDaysPresent/dtrDaysAbsent/dtrLateMinutes/dtrOtHours/dtrTardHours`.

**Change 2 — "Imported Payroll" banner.**
- XLSX (`buildTemplateSheet`): insert a new top row above the current R0 title; merge across the full width (cols 0–24), amber fill, bold. Shift the existing grid rows down by 1 (adjust the `EMP_INFO_START`, `DTR_DATA_START`, etc. offsets by +1 **only when `isImported`** so normal sheets are byte-for-byte unchanged).
- PDF (`generatePayrollPDF`): prepend a full-width amber banner `<div>` above `.header` with text `Imported Payroll — <importedFileName>`.

**Change 3 — Custom line items.** The export already renders `lineItemsJson` rows dynamically. For imported payslips this automatically picks up the custom earning/deduction items saved in Part 1 — verify, no extra work expected. Add a note under the DTR table: `"Attendance data sourced from imported file — not recorded in system"`.

**Change 4 — XLSX DTR cells.** Same DTR grid; fill `In/Out/Hrs/OT/Tard Hr/Tard Min/Abs` from `dtrPerDayJson` when a matching date exists, else blank with TOTALS populated.

### What must NOT change
- Template layout, column order, styling, merges, and the SIGNATORIES section for non-imported payrolls.
- Normal deduction-row logic, normal PDF generation.
- `PrintablePayslip` component.

---

## Part 4 — Biometric Attendance Import Bug Fix

### Root cause (confirmed = Pattern B)
`handleBiometricImport()` in `src/app/[role]/attendance/_views/admin-view.tsx` calls the **Zustand store** method
`useAttendanceStore().bulkUpsertLogs(...)`, which only mutates in-memory `logs`. Nothing is written to Supabase.
On refresh, `sync.service.fetchLogs()` re-hydrates from the DB and the imported rows disappear; days that were
also device-synced (and thus already in `attendance_logs`) appear inconsistent. The CSV import
(`handleImportCSV`) has the same defect.

### Fix
1. In `handleBiometricImport` (and `handleImportCSV`), call the **DB-first** service instead of the store method:
   ```ts
   import { bulkUpsertLogs as bulkUpsertLogsDb } from "@/services/attendance-actions.service";
   // ...
   const res = await bulkUpsertLogsDb(importable.map((r) => ({
     employeeId: r.employeeId, date: r.date,
     checkIn: r.checkIn, checkOut: r.checkOut, hours: r.hours, status: r.status,
   })));
   if (!res.ok) toast.error(`Imported ${res.inserted}, ${res.failed} failed`);
   ```
   The service awaits `attendanceDb.upsertLog()` per row, which upserts on `(employee_id, date)` (constraint from
   migration `015`), then updates the store. This makes re-import idempotent and survives refresh.
2. The store's `bulkUpsertLogs` already de-dupes by `(employeeId, date)` in memory; keep it for the optimistic
   path but ensure the DB write is the source of truth.
3. No DB schema change needed — the unique constraint and `upsertRow(..., "employee_id,date")` already exist.

### What must NOT change
- `biometric-import-dialog.tsx` parsing logic and `BiometricImportRecord` shape.
- Attendance log display/filter UI; manual attendance entry.
- The device-sync route `src/app/api/biometric/sync/route.ts` (already correctly upserts).

---

## Critical Rules for Kiro
1. Do not change normal payroll, normal attendance, or normal export behavior.
2. Only add or extend — new columns, new conditions, new branches.
3. Gate every new behavior behind `source === "imported"` / `computedExternally === true`.
4. Scan before changing (this doc already reflects the scan).
5. Imported DTR data is **never** written to `attendance_logs` — it lives on the payslip row + receipt only.
6. Do not add the new `dtr*` fields to the `db.service.ts` strip list, or they won't persist.
7. When shifting the XLSX grid for the banner, shift offsets **only when `isImported`**.

---

## Testing Checklist
- [ ] Import XLSX → every column with a value renders as an editable field (known + custom).
- [ ] Unknown columns appear as custom labeled fields, relabel/move section before confirm.
- [ ] Empty `Employee Name`, `Email`, `Period Start`, `Period End`, `Gross Pay` show red validation; confirm blocked.
- [ ] After confirm, a `payroll_runs` row appears tagged `"Imported — <filename> — <period>"`, status `locked`.
- [ ] Imported run needs no manual lock; employee can sign; payment recordable via the normal `payslip-table` flow.
- [ ] Export PDF for imported payslip → amber "Imported Payroll" banner at top; DTR from payslip, not `attendance_logs`.
- [ ] Export XLSX for imported payslip → DTR grid filled from import data; banner row present; normal sheets unchanged.
- [ ] Export PDF/XLSX for a normal payslip → no banner, DTR from `attendance_logs` exactly as before.
- [ ] Biometric import same file twice → no duplicate rows (DB upsert on employee_id,date).
- [ ] Biometric import then refresh → rows persist (now written to Supabase).
- [ ] Normal system payroll flow unchanged end to end.
