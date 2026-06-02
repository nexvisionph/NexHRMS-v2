# Payroll System — Bug Fixes & Feature Updates (NexHRMS-v2)

## Overview

This document covers all payroll-related issues to investigate and fix. Each section maps to actual files in the codebase.

---

## 1. Deductions & Allowances Not Reflecting on Payroll

### Problem

Deductions and allowances configured in **Payroll Management → Deduction & Allowance Template** are not appearing on:
- The payroll **payslip** (printable-payslip dialog)
- The employee's payroll record (even after being attached via employee edit screen)

### Relevant Files

| File | Role |
|------|------|
| `src/components/payroll/printable-payslip.tsx` | Payslip renderer — currently shows only hardcoded gov deductions (SSS, PhilHealth, Pag-IBIG, Tax) and a lump-sum `payslip.allowances` value |
| `src/app/api/payroll/templates/route.ts` | CRUD for `deduction_templates` table (name, type, calculation_mode, value) |
| `src/app/api/payroll/templates/assignments/route.ts` | Per-employee assignment CRUD — stores in `employee_deduction_assignments` table |
| `src/store/deductions.store.ts` | Client-side store with `computeDeductionsForEmployee()` — already computes per-template amounts |
| `src/store/payroll.store.ts` | Payroll run logic — `issuePayslip()` does NOT query template assignments |
| `src/services/payroll.service.ts` | Server-side payslip CRUD — writes flat `allowances` / `other_deductions` columns |

### Root Cause

The payroll run (`issuePayslip` in `payroll.store.ts`) computes government deductions (SSS, PhilHealth, Pag-IBIG, BIR tax) but **never queries `employee_deduction_assignments`** to fetch custom deductions/allowances. The payslip schema stores a flat `allowances` number and `custom_deductions` number — there's no line-item breakdown stored.

The printable payslip (`printable-payslip.tsx`) renders:
- Hardcoded government deduction rows
- A single "Allowances" line with `payslip.allowances` (lump sum)
- `customDeductions` / `otherDeductions` as single lines — no individual template names

### Fix Requirements

1. **At payroll run time** (`issuePayslip` or the server-side equivalent):
   - Query `employee_deduction_assignments` (joined with `deduction_templates`) for the employee
   - Use `deductions.store.ts → computeDeductionsForEmployee()` logic to calculate each template's amount
   - Store line items in the payslip record (either as a JSONB column `deduction_items` / `allowance_items`, or a related table)

2. **In `printable-payslip.tsx`**:
   - Replace the single "Allowances" row with dynamic rows from the stored template assignments
   - Add a new section or extend the Deductions table to show each custom deduction by name + amount
   - Keep government deductions (SSS, PhilHealth, Pag-IBIG, Tax) as separate rows
   - If an employee has no custom items, those sections should be empty (not error)

3. **Data model** — extend the `payslips` table or add a related `payslip_line_items` table:
   ```
   payslip_line_items:
     id, payslip_id, template_id, name, type (deduction/allowance), amount
   ```

### Expected Behavior

When a template is assigned to an employee and a payroll run executes:
1. Each assigned **allowance** appears as a named row in the Allowances section
2. Each assigned **deduction** appears as a named row in the Deductions section
3. Government deductions (SSS, PhilHealth, Pag-IBIG, Tax) remain separate rows
4. Both show `{ name, amount }` per line item
5. Dynamically generated — variable number of rows per employee

---

## 2. Export System — Payroll XLSX

### File to Fix

**`src/components/payroll-export-dialog.tsx`** — the main export dialog using `xlsx-js-style`. The `buildTemplateSheet()` function constructs the PB-template-matching layout.

Also relevant: `src/lib/export-utils.ts` (generic export utility using `xlsx` library)

### Fixes Required

#### 2a. Overtime Data from DTR ✅ (Already Partially Done)

The export dialog already computes OT from the attendance store DTR data. Verify it correctly pulls from `useAttendanceStore` and populates `emp.overtimePay` and DTR rows (right side of the sheet). Confirm the OT hours/amount appear on the exported sheet.

#### 2b. Company Name Placeholder

In `buildTemplateSheet()` at row 0:
```typescript
grid[0][0] = "COMPANY NAME";  // ← Replace with "NexHRIS"
```

Also in `generatePayrollPDF()`:
```html
<p class="company">[COMPANY NAME]</p>  <!-- ← Replace with "NexHRIS" -->
```

**Fix:** Replace `"COMPANY NAME"` and `"[COMPANY NAME]"` with `"NexHRIS"` in `payroll-export-dialog.tsx`.

#### 2c. Rename "Earnings" Header to "Allowances"

In `buildTemplateSheet()` at row 14:
```typescript
grid[14][1] = "EARNINGS";  // ← Rename to "ALLOWANCES"
```

Also in `generatePayrollPDF()`:
```html
<div class="section-title">EARNINGS</div>  <!-- ← Rename to "ALLOWANCES" -->
```

#### 2d. Remove Hardcoded Allowance Line Items

Remove these static rows from the ALLOWANCES section (`buildTemplateSheet` rows 17–19):
```typescript
grid[17][1] = "Meal Allowance";      // REMOVE
grid[18][1] = "Project Allowance";   // REMOVE
grid[19][1] = "Taxi Fare";           // REMOVE
```

Also remove the corresponding fields from the `EmployeePayrollData` interface:
- `mealAllowance`
- `projectAllowance`
- `taxiFare`

#### 2e. Remove "Semi-Monthly Salary" from Earnings

Remove row 15:
```typescript
grid[15][1] = "Semi-Monthly Basic Salary"; grid[15][7] = emp.semiMonthlySalary;  // REMOVE
```

This was previously under EARNINGS — it no longer belongs there once the section is renamed to ALLOWANCES.

#### 2f. Dynamic Deductions and Allowances from Employee Assignment

Replace all hardcoded allowance/deduction rows with dynamically generated rows:

```typescript
// For each employee in the export:
//   1. Fetch their active assignments from deductions.store
//   2. Separate into allowances and deductions
//   3. Generate one row per assigned template: { name, amount }

// ALLOWANCES section:
const allowances = deductionsStore.getActiveAssignmentsForEmployee(emp.id)
  .filter(a => a.template.type === "allowance");
// Render one row per allowance

// DEDUCTIONS section (keep gov deductions + add custom):
const customDeductions = deductionsStore.getActiveAssignmentsForEmployee(emp.id)
  .filter(a => a.template.type === "deduction");
// Render gov rows (SSS, PhilHealth, Pag-IBIG, Tax) + one row per custom deduction
```

The row indices in `buildTemplateSheet()` must become **dynamic** — no fixed row numbers for line items.

### Expected Export Format

```
Row 0:  NexHRIS                              | COMPUTATION OF INDIVIDUAL OVERTIME PAY & ALLOWANCES
Row 1:  PAYSLIP RECORD                       | DAILY TIME RECORD (DTR)
...
Row 14: ALLOWANCES
Row 15: [Dynamic Allowance 1]    [Amount]
Row 16: [Dynamic Allowance 2]    [Amount]
...
Row N:  TOTAL ALLOWANCES         [Sum]
Row N+1: (spacer)
Row N+2: DEDUCTIONS
Row N+3: Withholding Tax         [Amount]
Row N+4: SSS Contribution        [Amount]
Row N+5: PhilHealth              [Amount]
Row N+6: Pag-IBIG                [Amount]
Row N+7: [Custom Deduction 1]    [Amount]
Row N+8: [Custom Deduction 2]    [Amount]
...
Row M:  TOTAL DEDUCTIONS         [Sum]
Row M+2: NET PAY                 [Amount]
```

---

## 3. Import System — Payroll XLSX

### File to Fix

**`src/app/api/import/payroll/route.ts`**

### Current Format (Keep Working)

The existing import expects flat columns:
- `Employee Name`, `Email`, `Period Start`, `Period End`, `Pay Frequency`
- `Gross Pay`, `Net Pay`, `Allowances`, `Holiday Pay`
- `SSS`, `PhilHealth`, `Pag-IBIG`, `Tax`, `Loan Deduction`, `Custom Deductions`, `Other Deductions`

### New Format to Support (Additional)

Add support for the new export format with dynamic sections:

```
ALLOWANCES
[Name]    [Amount]
[Name]    [Amount]
...

DEDUCTIONS
[Name]    [Amount]
[Name]    [Amount]
...
```

### Fix Requirements

- [ ] Keep existing flat-column parser **unchanged** — it must continue working
- [ ] Add a **new parser** triggered when `ALLOWANCES` / `DEDUCTIONS` section headers are detected in the sheet
- [ ] New parser reads:
  - Dynamic allowance rows (variable count, identified by section header)
  - Dynamic deduction rows (variable count, identified by section header)
  - Overtime row (from DTR totals)
  - Employee name, pay period, company name
- [ ] After parsing, map allowances/deductions back to `employee_deduction_assignments` (by template name match) or store as line items

### Detection Logic

```typescript
// When processing an uploaded file:
const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
const sheetData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

// Check if it's the new format
const hasNewFormat = sheetData.some(row => 
  String(row[1] || "").trim() === "ALLOWANCES" || 
  String(row[1] || "").trim() === "DEDUCTIONS"
);

if (hasNewFormat) {
  // Use new section-based parser
} else {
  // Fall through to existing flat-column parser
}
```

---

## 4. Company Name — All PDF & Export Outputs

### Problem

The company name shows **"Soren Data Solutions Inc."** in multiple places. It should display **"NexHRIS"** everywhere.

### Files Containing "Soren" (User-Facing)

| File | Location | What to Change |
|------|----------|----------------|
| `src/store/appearance.store.ts` | `INITIAL_STATE.companyName` | `"Soren Data Solutions Inc."` → `"NexHRIS"` |
| `src/store/appearance.store.ts` | `INITIAL_STATE.loginHeading` | `"Soren Data Solutions Inc."` → `"NexHRIS"` |
| `src/components/payroll/printable-payslip.tsx` | Default prop `companyName` | `"Soren Data Solutions Inc."` → `"NexHRIS"` |
| `src/app/[role]/payroll/bir-compliance/page.tsx` | `EMPLOYER_DEFAULT.name` | `"Soren Data Solutions Inc."` → `"NexHRIS"` |
| `src/store/notifications.store.ts` | `defaultSenderName` | `"Soren Data Solutions"` → `"NexHRIS"` |
| `src/store/messaging.store.ts` | `emailFromName` | `"Soren Data Solutions"` → `"NexHRIS"` |
| `src/data/seed.ts` | Announcement body | References "Soren Data Solutions" |
| `supabase/apply_missing_migrations.sql` | `default_sender_name` | `'Soren Data Solutions'` → `'NexHRIS'` |
| `src/components/payroll-export-dialog.tsx` | `grid[0][0]` and PDF | `"COMPANY NAME"` / `"[COMPANY NAME]"` → `"NexHRIS"` |

### Files Containing "Soren" (Internal/Technical — Lower Priority)

These use "soren" as a namespace/key identifier, not user-facing text. Changing them would break localStorage persistence for existing users:

| File | Context | Recommendation |
|------|---------|----------------|
| `src/store/appearance.store.ts` | Persist key `"soren-appearance"` | Leave as-is (breaking change) |
| `src/store/auth.store.ts` | Persist key `"soren-auth"` | Leave as-is |
| `src/store/kiosk.store.ts` | Persist key `"soren-kiosk-settings"` | Leave as-is |
| `src/store/offline-queue.store.ts` | Persist key `"soren-offline-queue"` | Leave as-is |
| `src/lib/clear-stale-storage.ts` | Legacy key cleanup | Leave as-is |
| `src/lib/storage.ts` | Eviction order | Leave as-is |
| `src/lib/qr-utils.ts` | HMAC secret fallback | Leave as-is (security key) |
| `src/lib/env.ts` | Encryption key fallback | Leave as-is (security key) |
| `src/services/sync.service.ts` | Realtime channel name | Leave as-is |
| `src/components/shell/theme-provider.tsx` | Style element IDs | Leave as-is |

### Fix Approach

The cleanest fix: change the **user-facing defaults** to `"NexHRIS"` in the files listed in the first table. The appearance store's `companyName` field is the runtime source of truth — components that read from it will automatically pick up the new value.

For the printable payslip, it already accepts `companyName` as a prop — the caller should pass the value from the appearance store rather than relying on the default.

---

## Scan Checklist

| Area | File | Status |
|------|------|--------|
| Payslip renderer | `src/components/payroll/printable-payslip.tsx` | Shows hardcoded gov deductions only, no template assignments |
| Payroll run logic | `src/store/payroll.store.ts` → `issuePayslip()` | Does NOT query employee_deduction_assignments |
| Deduction computation | `src/store/deductions.store.ts` → `computeDeductionsForEmployee()` | Exists but unused during payroll run |
| Template assignments API | `src/app/api/payroll/templates/assignments/route.ts` | Working — reads from `employee_deduction_assignments` |
| XLSX export | `src/components/payroll-export-dialog.tsx` → `buildTemplateSheet()` | Hardcoded rows, "COMPANY NAME" placeholder |
| XLSX import | `src/app/api/import/payroll/route.ts` | Flat-column format only, no section-based parsing |
| PDF generation | `src/components/payroll-export-dialog.tsx` → `generatePayrollPDF()` | Hardcoded rows, "[COMPANY NAME]" placeholder |
| DTR/Overtime | `src/lib/payroll-deductions.ts` + attendance store | OT computation exists, export reads DTR data |
| Company name config | `src/store/appearance.store.ts` | `"Soren Data Solutions Inc."` — source of truth |
| PH gov deductions | `src/lib/ph-deductions.ts` | SSS, PhilHealth, Pag-IBIG, BIR tax — working correctly |

---

## Priority Order

1. **Company name fix** (all user-facing instances) — lowest risk, highest visibility, ~10 minutes
2. **Deductions/allowances on payslip** — core payroll correctness, requires schema addition
3. **Export format changes** — dynamic rows, remove hardcoded items, rename headers
4. **Import format update** — must support new export format while keeping legacy working

---

## Technical Notes

- **Database**: Supabase (PostgreSQL) — no Prisma, uses `createAdminSupabaseClient()` / `createServerSupabaseClient()`
- **State management**: Zustand stores with write-through to Supabase
- **Export library**: `xlsx-js-style` (styled XLSX), `xlsx` (generic export-utils)
- **Tables involved**: `deduction_templates`, `employee_deduction_assignments`, `payslips`, `payroll_runs`
- **Template types**: `deduction` | `allowance` — stored in `deduction_templates.type`
- **Calculation modes**: `fixed` | `percentage` | `daily` | `hourly` — stored in `deduction_templates.calculation_mode`
