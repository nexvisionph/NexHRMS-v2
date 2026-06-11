# Payroll Computation Engine — Tailored Implementation Spec

## Overview

Implement a payroll computation engine that reads employee salary data from the `employees` table and attendance records from `attendance_logs` (both already in Supabase), computes payslips using the exact formula below, and generates payroll run entries per cutoff cycle. This is **not** an import feature — it reads directly from existing system data.

---

## System Architecture Context

| Layer | Stack | Relevant Files |
|---|---|---|
| Frontend | Next.js 16 + React 19 + shadcn/ui + Zustand 5 | `src/app/[role]/payroll/_views/admin-view.tsx` |
| State | Zustand stores + write-through to Supabase | `src/store/payroll.store.ts`, `src/store/employees.store.ts` |
| DB-first actions | Client-side Supabase (RLS) | `src/services/payroll-actions.service.ts`, `src/services/db.service.ts` |
| Server actions | Server-side Supabase | `src/services/payroll.service.ts` |
| Types | Central type file | `src/types/index.ts` |
| Constants | Holidays + multipliers | `src/lib/constants.ts` |
| Deductions | PH gov calculations | `src/lib/ph-deductions.ts`, `src/lib/payroll-deductions.ts` |

---

## Cutoff Cycles

Each month has two payroll cycles (matching `PayScheduleConfig.defaultFrequency = "semi_monthly"`):

- **Cycle A:** 26th of previous month → 10th of current month
- **Cycle B:** 11th → 25th of current month

Example for April 2026:
- Cycle A: March 26 → April 10
- Cycle B: April 11 → April 25

> These map to the existing `Payslip.periodStart` / `Payslip.periodEnd` and `PayrollRun.periodStart` / `PayrollRun.periodEnd` fields.

---

## Data Sources (Already in System)

### Employee Profile (`employees` table → `Employee` interface)
Located at: `src/types/index.ts` (line ~335)

| Field | Type | Maps to |
|---|---|---|
| `salary` | `number` | Monthly salary (₱) — comment confirms `★ MONTHLY salary` |
| `id` | `string` | employee_id |
| `name` | `string` | employee_name |
| `jobTitle` | `string` | position |
| `department` | `string` | department |
| `workDays` | `string[]` | e.g. `["Mon","Tue","Wed","Thu","Fri"]` |
| `payFrequency` | `PayFrequency` | Per-employee override |
| `deductionExempt` | `boolean` | Skip all gov deductions |

### Attendance Records (`attendance_logs` table → `AttendanceLog` interface)
Located at: `src/types/index.ts` (line ~321)

| Field | Type | Maps to |
|---|---|---|
| `date` | `string` | ISO date |
| `checkIn` | `string?` | First check-in (HH:mm or ISO) — already resolved by system |
| `checkOut` | `string?` | Last check-out (HH:mm or ISO) — already resolved by system |
| `status` | `AttendanceStatus` | `"present"` / `"absent"` / `"on_leave"` |
| `hours` | `number?` | Total hours worked (already computed) |
| `lateMinutes` | `number?` | Minutes late |
| `approvedOTHours` | `number?` | Approved OT hours |

> ⚠️ `ot_description` column does **NOT** exist yet. Must be added via Supabase migration.

### Holidays (`holidays` table → `Holiday` interface)
Located at: `src/lib/constants.ts` — `DEFAULT_HOLIDAYS` (19 PH holidays for 2026)
Store: `useAttendanceStore` has `addHoliday`, `updateHoliday`, `deleteHoliday`
Types: `HolidayType = "regular" | "special" | "special_non_working" | "special_working"`

### Deductions (from employee profile or payroll settings)
- **PH Gov**: `computeAllPHDeductions(salary)` from `src/lib/ph-deductions.ts`
- **Override system**: `DeductionOverride` per-employee + `DeductionGlobalDefault` company-wide
- **Custom templates**: `DeductionTemplate` + `EmployeeDeductionAssignment`
- **Loans**: Via `useLoansStore.getActiveByEmployee(empId)`

### Existing OT Multipliers (`AttendanceRuleSet` interface)
Located at: `src/types/index.ts` (line ~374)

| Field | Default | Spec Multiplier |
|---|---|---|
| `otMultiplierRegular` | 1.25 | 1.25 ✅ |
| `otMultiplierRestDay` | 1.30 | 1.30 ✅ |
| `otMultiplierSpecialHoliday` | 1.30 | 1.50 (spec override) |
| `otMultiplierRegularHoliday` | 2.00 | 2.00 ✅ |
| `otMultiplierNightDiff` | 1.10 | 1.375 (spec uses different formula) |

> **IMPORTANT**: The spec's multiplier table is more granular than the current system's single-multiplier model. The computation engine must implement its own multiplier logic per the table below.

---

## Computation Formula

### Step 1 — Derive Rates

```typescript
// Uses paySchedule.workDaysPerMonth (currently 22) but spec requires 21.5
// → ADD a configurable `computeWorkDays` to PayScheduleConfig (default 21.5 for this engine)
const COMPUTE_WORK_DAYS = 21.5;  // for OT-based payroll computation
const rate_per_day  = employee.salary / COMPUTE_WORK_DAYS;
const rate_per_hour = rate_per_day / 8;
```

> Note: The existing system uses `workDaysPerMonth = 22` for basic pay. The computation engine uses `21.5` specifically for OT rate derivation as specified by the client payslip formula.

### Step 2 — Determine Day Type per Date

Check each date against existing holiday data + day-of-week:

```typescript
type ComputeDayType = "REG" | "SAT" | "SUN" | "SPEC_HOL" | "REG_HOL";

function getDayType(date: string, holidays: Holiday[]): ComputeDayType {
  const holiday = holidays.find(h => h.date === date);
  if (holiday?.type === "regular") return "REG_HOL";
  if (holiday?.type === "special" || holiday?.type === "special_non_working") return "SPEC_HOL";
  
  const dayOfWeek = new Date(date + "T12:00:00").getDay();
  if (dayOfWeek === 6) return "SAT";
  if (dayOfWeek === 0) return "SUN";
  return "REG";
}
```

### Step 3 — Compute Hours per Day

```typescript
function computeHoursForDay(log: AttendanceLog, dayType: ComputeDayType): number {
  if (!log.checkIn || !log.checkOut) return 0;
  
  const inParts = log.checkIn.split(":");
  const outParts = log.checkOut.split(":");
  const in_decimal  = Number(inParts[0]) + Number(inParts[1]) / 60;
  const out_decimal = Number(outParts[0]) + Number(outParts[1]) / 60;

  // For regular days: cap IN at 8.00 (no credit for early arrival)
  const effective_in = dayType === "REG" ? Math.max(in_decimal, 8.0) : in_decimal;
  
  let total_hours = out_decimal - effective_in - 1.0;  // deduct 1hr lunch
  total_hours = Math.max(total_hours, 0);
  return total_hours;
}
```

### Step 4 — Compute OT and Undertime per Day

```typescript
function computeOTUndertime(total_hours: number, dayType: ComputeDayType) {
  let ot_hours = 0;
  let undertime_hours = 0;

  if (dayType === "REG") {
    ot_hours = Math.max(0, total_hours - 8);
    undertime_hours = Math.max(0, 8 - total_hours);
  } else {
    // SAT, SUN, SPEC_HOL, REG_HOL — all hours count as OT
    ot_hours = total_hours;
  }
  
  return { ot_hours, undertime_hours };
}
```

### Step 5 — Compute OT Pay per Day (Full Multiplier Table)

| Day Type | Hours | Multiplier |
|---|---|---|
| Regular day OT | beyond 8hrs, until 10PM | 1.25 |
| Regular day OT | night differential after 10PM | 1.375 |
| Saturday / Sunday | up to 8hrs | 1.30 |
| Saturday / Sunday | excess of 8hrs | 1.69 |
| Saturday / Sunday | night differential after 10PM | 1.859 |
| Special Holiday | up to 8hrs | 1.50 |
| Special Holiday | excess of 8hrs | 1.95 |
| Special Holiday | night differential after 10PM | 2.145 |
| Regular Holiday | up to 8hrs | 2.00 |
| Regular Holiday | excess of 8hrs | 2.60 |
| Regular Holiday | night differential after 10PM | 2.86 |
| Regular Holiday (Saturday) | up to 8hrs | 2.60 |
| Regular Holiday (Saturday) | excess of 8hrs | 3.38 |
| Regular Holiday (Saturday) | night differential after 10PM | 3.718 |

```typescript
function computeOTPayForDay(
  total_hours: number,
  dayType: ComputeDayType,
  rate_per_hour: number,
  check_out_decimal: number,
  isSaturday: boolean  // for REG_HOL that falls on Saturday
): number {
  // Determine night differential hours (hours after 22:00)
  const night_diff_hours = check_out_decimal > 22 ? check_out_decimal - 22 : 0;
  const pre_night_hours = Math.max(0, total_hours - night_diff_hours);

  switch (dayType) {
    case "REG": {
      const ot_hours = Math.max(0, total_hours - 8);
      const ot_pre_night = Math.max(0, ot_hours - night_diff_hours);
      const ot_night = Math.min(ot_hours, night_diff_hours);
      return (ot_pre_night * rate_per_hour * 1.25) + (ot_night * rate_per_hour * 1.375);
    }
    case "SAT":
    case "SUN": {
      const first8 = Math.min(total_hours, 8);
      const excess = Math.max(0, total_hours - 8);
      const pre_night_first8 = Math.max(0, first8 - night_diff_hours);
      const night_first8 = Math.min(first8, night_diff_hours);
      const pre_night_excess = Math.max(0, excess - Math.max(0, night_diff_hours - first8));
      const night_excess = Math.min(excess, Math.max(0, night_diff_hours - first8));
      return (pre_night_first8 * rate_per_hour * 1.30)
           + (night_first8 * rate_per_hour * 1.859)
           + (pre_night_excess * rate_per_hour * 1.69)
           + (night_excess * rate_per_hour * 1.859);
    }
    case "SPEC_HOL": {
      const first8 = Math.min(total_hours, 8);
      const excess = Math.max(0, total_hours - 8);
      const night_first8 = Math.min(first8, night_diff_hours);
      const pre_night_first8 = first8 - night_first8;
      return (pre_night_first8 * rate_per_hour * 1.50)
           + (night_first8 * rate_per_hour * 2.145)
           + (excess * rate_per_hour * 1.95);
    }
    case "REG_HOL": {
      const first8 = Math.min(total_hours, 8);
      const excess = Math.max(0, total_hours - 8);
      if (isSaturday) {
        return (first8 * rate_per_hour * 2.60) + (excess * rate_per_hour * 3.38);
      }
      const night_first8 = Math.min(first8, night_diff_hours);
      const pre_night_first8 = first8 - night_first8;
      return (pre_night_first8 * rate_per_hour * 2.00)
           + (night_first8 * rate_per_hour * 2.86)
           + (excess * rate_per_hour * 2.60);
    }
  }
}
```

### Step 6 — Accumulate OT Hours Summary

```typescript
interface OTSummary {
  total_reg_ot_hours: number;
  total_reg_ot_minutes: number;
  total_sat_ot_hours: number;
  total_sat_ot_minutes: number;
  total_ot_pay: number;
}
```

Store hours and minutes separately for payslip display (e.g. "25hrs 47min").

### Step 7 — Compute Basic Pay

```typescript
const semi_monthly_basic = employee.salary / 2;
const absent_deduction   = absent_days * rate_per_day;
const undertime_deduction = total_undertime_hours * rate_per_hour;
const total_basic = semi_monthly_basic - absent_deduction - undertime_deduction;
```

### Step 8 — Apply Deductions

Uses existing infrastructure:
```typescript
// Use computeAllPHDeductions(salary) from src/lib/ph-deductions.ts
// Apply per-employee overrides via getDeductionOverride(empId, type)
// Apply global defaults via getGlobalDefault(type)
// Respect deductionExempt flag on employee
const total_deductions = withholding_tax + sss + philhealth + pagibig + loans;
```

### Step 9 — Net Pay

```typescript
const net_pay = total_basic + total_ot_pay - total_deductions;
```

---

## Mapping to Existing Types

### Payslip Fields (existing `Payslip` interface)

| Spec Field | Maps to Existing Field | Notes |
|---|---|---|
| `employee_id` | `employeeId` | ✅ exists |
| `period_start` | `periodStart` | ✅ exists |
| `period_end` | `periodEnd` | ✅ exists |
| `monthly_salary` | — | Store in `notes` or new field |
| `rate_per_day` | `dailyRate` | ✅ exists |
| `rate_per_hour` | `hourlyRate` | ✅ exists |
| `semi_monthly_basic` | `grossPay` | Reuse existing field |
| `absent_days` | `attendanceDaysAbsent` | ✅ exists |
| `absent_deduction` | `absentDeduction` | ✅ exists |
| `undertime_hours` | `attendanceUndertimeHours` | ✅ exists |
| `undertime_deduction` | `undertimeDeduction` | ✅ exists |
| `total_basic` | `grossPay` | After deductions applied |
| `reg_ot_hours/minutes` | `dtrOtHours` | Extend with new field |
| `sat_ot_hours/minutes` | — | New field needed |
| `total_ot_pay` | `overtimePay` | ✅ exists |
| `withholding_tax` | `taxDeduction` | ✅ exists |
| `sss` | `sssDeduction` | ✅ exists |
| `philhealth` | `philhealthDeduction` | ✅ exists |
| `pagibig` | `pagibigDeduction` | ✅ exists |
| `other_deductions` | `otherDeductions` | ✅ exists |
| `total_deductions` | Computed from above | ✅ |
| `net_pay` | `netPay` | ✅ exists |
| `status` | `status: "draft"` | ✅ exists |
| `daily_breakdown[]` | `dtrPerDayJson` | ✅ exists (reuse `PayslipDtrDay[]`) |

### New Fields Required on `Payslip` interface

```typescript
// Add to Payslip interface in src/types/index.ts:
regOtHours?: number;            // regular day OT hours (integer part)
regOtMinutes?: number;          // regular day OT minutes (fractional part)
satOtHours?: number;            // Saturday/Sunday/holiday OT hours
satOtMinutes?: number;          // Saturday/Sunday/holiday OT minutes
computeSource?: "attendance_engine" | "manual";  // distinguish from standard issue
computeWorkDays?: number;       // rate divisor used (21.5 for this engine)
```

### Extended `PayslipDtrDay` for Daily Breakdown

```typescript
// Extend existing PayslipDtrDay in src/types/index.ts:
export interface PayslipDtrDay {
  date: string;
  day?: string;
  timeIn?: string;
  timeOut?: string;
  totalHrs?: number;
  otHrs?: number;
  tardinessHr?: number;
  tardinessMin?: number;
  absences?: number;
  // ─── New fields for computation engine ──
  dayType?: ComputeDayType;           // REG, SAT, SUN, SPEC_HOL, REG_HOL
  effectiveIn?: string;               // after cap logic (HH:mm)
  undertimeHours?: number;
  otPay?: number;                     // OT pay for this day
  otDescription?: string;             // HR-filled description
  status?: string;                    // Present, Absent, Rest Day, Holiday
}
```

---

## Database Migration Required

### 1. Add `ot_description` column to `attendance_logs`

```sql
ALTER TABLE attendance_logs
ADD COLUMN ot_description TEXT DEFAULT NULL;
```

### 2. Add computation engine fields to `payslips` table

```sql
ALTER TABLE payslips
ADD COLUMN reg_ot_hours INTEGER DEFAULT NULL,
ADD COLUMN reg_ot_minutes INTEGER DEFAULT NULL,
ADD COLUMN sat_ot_hours INTEGER DEFAULT NULL,
ADD COLUMN sat_ot_minutes INTEGER DEFAULT NULL,
ADD COLUMN compute_source TEXT DEFAULT NULL,
ADD COLUMN compute_work_days NUMERIC(4,1) DEFAULT NULL;
```

### 3. Add `compute_work_days` to `pay_schedule_config`

```sql
ALTER TABLE pay_schedule_config
ADD COLUMN compute_work_days NUMERIC(4,1) DEFAULT 21.5;
```

---

## Status Handling per Day

| Attendance Status | Day Type | Action |
|---|---|---|
| `"present"` | REG | Compute hours, OT, undertime normally |
| `"present"` | SAT / SUN | Compute all hours as rest day OT |
| `"present"` | HOL | Compute using holiday multiplier |
| `"absent"` | REG | Add to `absent_days`, deduct from basic |
| `"absent"` | SAT / SUN | No deduction (rest day) |
| No log | SAT / SUN | Treat as rest day, no deduction |
| No log | HOL | Treat as holiday, no deduction |
| No log | REG | Treat as absent, deduct |
| `"on_leave"` | REG | No deduction (paid leave) |

---

## Implementation Location

### New File: `src/lib/payroll-computation-engine.ts`

This is the core computation engine. It should:
1. Accept an employee, date range, attendance logs, and holidays
2. Return a fully computed payslip data object (type `ComputedPayroll`)
3. Be a **pure function** — no side effects, no DB calls
4. Be testable independently

```typescript
// src/lib/payroll-computation-engine.ts
export interface ComputedPayroll {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  monthlySalary: number;
  ratePerDay: number;
  ratePerHour: number;
  semiMonthlyBasic: number;
  absentDays: number;
  absentDeduction: number;
  undertimeHours: number;
  undertimeDeduction: number;
  totalBasic: number;
  regOtHours: number;
  regOtMinutes: number;
  satOtHours: number;
  satOtMinutes: number;
  totalOtPay: number;
  withholdingTax: number;
  sss: number;
  philhealth: number;
  pagibig: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  dailyBreakdown: PayslipDtrDay[];
}

export function computePayroll(params: {
  employee: Employee;
  periodStart: string;
  periodEnd: string;
  attendanceLogs: AttendanceLog[];
  holidays: Holiday[];
  deductions: { tax: number; sss: number; philhealth: number; pagibig: number; loans: number };
  computeWorkDays?: number;  // default 21.5
}): ComputedPayroll;
```

### New File: `src/services/payroll-backfill.service.ts`

Orchestrates the backfill flow:
1. Fetch attendance logs for the date range from Supabase
2. Fetch holidays from store/DB
3. Call computation engine for each cycle
4. Create payslip + payroll run entries via existing `issuePayslip` / `createPayrollRun` patterns
5. Persist via `payrollDb.batchUpsertPayslips()` + `payrollDb.upsertRun()`

### UI Changes: `src/app/[role]/payroll/_views/admin-view.tsx`

Add a **"Backfill from Attendance"** button in the payroll toolbar (next to "Issue Payslip").

---

## UI Changes Required

### 1 — Payroll Runs Screen: "Backfill from Attendance" Button

**Location**: `src/app/[role]/payroll/_views/admin-view.tsx`

When clicked → Modal with:
- Employee select (multi-select from `useEmployeesStore`)
- Date range picker (start → end)
- System auto-detects cycles from the range (using the Cycle A/B logic)
- Preview table: shows all cycles with computed figures before creating
- Confirm button → creates all payroll run entries in `status: "draft"`

Existing workflow continues untouched: Draft → Publish → E-Sign → Record Payment

### 2 — Attendance Modal: OT Description Field

**Location**: `src/components/attendance/attendance-heatmap.tsx` (line ~600+) AND `src/app/[role]/attendance/_views/admin-view.tsx` (Override Dialog, line ~1418)

Add below existing fields:

```tsx
<div>
  <label className="text-sm font-medium">OT Description</label>
  <Input
    value={otDescription}
    onChange={(e) => setOtDescription(e.target.value)}
    placeholder="e.g. Extended site visit, Emergency overtime"
    className="mt-1"
  />
  <p className="text-[10px] text-muted-foreground mt-0.5">
    Optional — displayed on payslip daily breakdown
  </p>
</div>
```

---

## Integration with Existing Payslip Flow

The computation engine creates payslips using the **same** `issuePayslip` function from `payroll-actions.service.ts`, passing:

```typescript
issuePayslip({
  employeeId: computed.employeeId,
  periodStart: computed.periodStart,
  periodEnd: computed.periodEnd,
  payFrequency: "semi_monthly",
  grossPay: computed.totalBasic,
  allowances: 0,
  sssDeduction: computed.sss,
  philhealthDeduction: computed.philhealth,
  pagibigDeduction: computed.pagibig,
  taxDeduction: computed.withholdingTax,
  otherDeductions: computed.otherDeductions,
  loanDeduction: 0,
  netPay: computed.netPay,
  overtimePay: computed.totalOtPay,
  dailyRate: computed.ratePerDay,
  hourlyRate: computed.ratePerHour,
  absentDeduction: computed.absentDeduction,
  undertimeDeduction: computed.undertimeDeduction,
  attendanceDaysAbsent: computed.absentDays,
  attendanceUndertimeHours: computed.undertimeHours,
  dtrPerDayJson: computed.dailyBreakdown,
  dtrDaysPresent: /* count from breakdown */,
  dtrDaysAbsent: computed.absentDays,
  dtrOtHours: computed.regOtHours + computed.satOtHours,
  source: "system",
  computedExternally: false,
  notes: `Computed by engine (work_days=${COMPUTE_WORK_DAYS})`,
  // New fields:
  regOtHours: computed.regOtHours,
  regOtMinutes: computed.regOtMinutes,
  satOtHours: computed.satOtHours,
  satOtMinutes: computed.satOtMinutes,
  computeSource: "attendance_engine",
  computeWorkDays: COMPUTE_WORK_DAYS,
});
```

---

## Backfill Cycles Needed

### Patricio Clemente (monthly salary: ₱28,500)
| Cycle | Period |
|---|---|
| 1 | Dec 26, 2025 → Jan 10, 2026 |
| 2 | Jan 11 → Jan 25, 2026 |
| 3 | Jan 26 → Feb 10, 2026 |
| 4 | Feb 11 → Feb 25, 2026 |
| 5 | Feb 26 → Mar 10, 2026 |
| 6 | Mar 11 → Mar 25, 2026 |

### Rodrigo Bulario (monthly salary: ₱200,000)
| Cycle | Period |
|---|---|
| 1 | Feb 26 → Mar 10, 2026 (basic pay only — attendance starts March) |
| 2 | Mar 11 → Mar 25, 2026 |
| 3 | Mar 26 → Apr 10, 2026 |
| 4 | Apr 11 → Apr 25, 2026 |

---

## Validation — 90% Match Threshold

```typescript
function validatePayroll(computedNet: number, clientNet: number): { pass: boolean; matchPct: number } {
  const matchPct = (1 - Math.abs(computedNet - clientNet) / clientNet) * 100;
  return { pass: matchPct >= 90, matchPct: Math.round(matchPct * 100) / 100 };
}
```

Known acceptable gaps:
- Meal allowance excluded (client confirmed inconsistent)
- Taxi allowance excluded
- Minor rounding differences in decimal precision

---

## File Manifest — What to Create/Modify

### New Files
| File | Purpose |
|---|---|
| `src/lib/payroll-computation-engine.ts` | Pure computation engine (no side effects) |
| `src/services/payroll-backfill.service.ts` | Orchestration: fetch data → compute → persist |
| `src/components/payroll/backfill-modal.tsx` | UI: employee select, date range, preview, confirm |

### Modified Files
| File | Change |
|---|---|
| `src/types/index.ts` | Add `ComputeDayType`, extend `Payslip` with new OT fields, extend `PayslipDtrDay` |
| `src/app/[role]/payroll/_views/admin-view.tsx` | Add "Backfill from Attendance" button + import modal |
| `src/app/[role]/attendance/_views/admin-view.tsx` | Add `ot_description` field to Override Dialog |
| `src/components/attendance/attendance-heatmap.tsx` | Add `ot_description` field to Update Attendance modal |
| `src/store/attendance.store.ts` | Support `otDescription` in log updates |
| `src/services/db.service.ts` | Add `otDescription` to attendance upsert/fetch |
| `src/lib/constants.ts` | Add 2025 holidays for backfill (Dec 2025 needed) |

### Supabase Migrations
| Migration | SQL |
|---|---|
| Add `ot_description` to `attendance_logs` | `ALTER TABLE attendance_logs ADD COLUMN ot_description TEXT DEFAULT NULL;` |
| Add computation engine columns to `payslips` | Add `reg_ot_hours`, `reg_ot_minutes`, `sat_ot_hours`, `sat_ot_minutes`, `compute_source`, `compute_work_days` |
| Add `compute_work_days` to `pay_schedule_config` | `ALTER TABLE pay_schedule_config ADD COLUMN compute_work_days NUMERIC(4,1) DEFAULT 21.5;` |

---

## Constraints & Safety

- Do **NOT** modify existing attendance records
- Do **NOT** overwrite existing payroll runs
- All generated runs start in `status: "draft"`
- Meal allowance and taxi allowance are excluded from computation
- Night differential applies only if `check_out` time exceeds 22:00 (10PM)
- All monetary values rounded to 2 decimal places: `Math.round(value * 100) / 100`
- OT hours and minutes stored separately: `hours = Math.floor(totalOT)`, `minutes = Math.round((totalOT % 1) * 60)`
- Existing `handleIssue()` flow remains untouched — this is a parallel path
- Deduction overrides + global defaults honored (same priority chain as existing system)
- Existing guard: duplicate payslip detection by `(employeeId, periodStart, payFrequency)` applies

---

## Implementation Priority

1. **Phase 1**: Create `payroll-computation-engine.ts` (pure logic, testable)
2. **Phase 2**: Create `payroll-backfill.service.ts` (orchestration layer)
3. **Phase 3**: Build `backfill-modal.tsx` UI component
4. **Phase 4**: Wire button into `admin-view.tsx`
5. **Phase 5**: Add `ot_description` to attendance modals
6. **Phase 6**: Run Supabase migrations
7. **Phase 7**: Backfill Patricio & Rodrigo cycles, validate against client payslips
