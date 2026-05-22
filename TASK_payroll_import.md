# Task: Payroll PB File XLSX Import with Preview

## Context

You are working on **NexHRMS-v2**, a Next.js 16 HR system for Philippine companies.
Scan the project to understand the codebase before making any changes.

---

## What You Need to Build

A payroll import feature on the **Payroll page** that:
- Accepts `.xls`, `.xlsx`, and `.csv` files
- Detects whether the uploaded file is a raw **Payroll Bureau (PB)** format or the standard NexHRMS payroll template
- If PB format → converts it using `convertPBRawToPayrollRows`, then shows **editable fields** in a preview dialog before importing
- If standard template → skips conversion and goes directly to the editable fields and existing validation + import flow
- Validates data and shows warnings/errors clearly (e.g. missing employee match, missing email)
- Matches extracted employees to existing system employees **by name**

---

## Files to Scan First

Before writing any code, read these files in order:

```
1. src/components/import-data-dialog.tsx          (main file — converter + preview dialog already live here)
2. src/app/[role]/payroll/_views/admin-view.tsx   (where ImportDataDialog is rendered)
3. src/store/payroll.store.ts                     (issuePayslip, payslips, runs)
4. src/types/index.ts                             (Employee, Payslip, PayrollRun types)
5. src/lib/export-utils.ts                        (parseImportFile, PAYROLL_TEMPLATE_HEADERS)
```

---

## Input File Format — PB (Payroll Bureau) XLS

The raw PB file is a single-sheet `.xls` exported from the company's payroll bureau system.
It contains **two employee pay-slip blocks side by side** on the same sheet:

```
Col indices:  ...4...  7    ...12...  15
Left block:   name    val   ——        ——
Right block:  ——       ——   name     val
```

### Exact Row → Value Mapping

> All indices are 0-based (as returned by `XLSX.utils.sheet_to_json({ header: 1 })`).

| Row | Description | Left block col | Right block col |
|-----|-------------|---------------|-----------------|
| 0   | Company / reference name (fallback for employee name) | 18 | 18 |
| 2   | Period start date (Excel serial or ISO string) | 3 | 11 |
| 2   | Period end date | 5 | 13 |
| 3   | Employee number (e.g. `KEI -`) | 4 | 12 |
| 4   | Employee name label (may be placeholder `"NAME"`) | 4 | 12 |
| 5   | Position / Job title | 4 | 12 |
| 6   | Project / Department | 4 | 12 |
| 7   | Monthly salary | **7** | **15** |
| 11  | Semi-monthly salary (gross base for this period) | **7** | **15** |
| 12  | Adjustment (+ or −) | **7** ¹ | **15** |
| 13  | Leave without pay (LWOP) | **7** ¹ | **15** |
| 14  | Tardiness / Undertime deduction | **7** | **15** |
| 15  | Total Basic Salary | **7** | **15** |
| 17  | Overtime Pay | **7** | **15** |
| 18  | Meal Allowance | **7** | **15** |
| 19  | Project Allowance | **7** ¹ | **15** |
| 20  | Taxi Fare | **7** ¹ | **15** |
| 21  | Other / Misc Adjustment | **7** ¹ | **15** |
| 22  | Total Allowances | **7** | **15** |
| 24  | Withholding Tax | **7** ¹ | **15** |
| 25  | SSS Contribution | **7** | **15** ¹ |
| 26  | SSS Salary Loan | **7** | **15** |
| 27  | PhilHealth Contribution | **7** | **15** |
| 28  | Pag-IBIG Contribution | **7** | **15** |
| 29  | Pag-IBIG Loan | **7** | **15** |
| 30  | Tax Refund / Deficit | **7** ¹ | **15** |
| 31  | Healthcard / Other deduction | **7** | **15** |
| 33  | **Net Pay (TOTAL)** | **7** | **15** |

> ¹ Some cells are blank in certain PB versions — `numCell` should return `0` safely via `NaN → 0` guard.

**Important notes:**
- Rows 34–40 are footers (totals, prepared/approved by lines) — skip them
- If `row[4][nameCol]` equals `"NAME"` (the placeholder), fall back to `row[0][col 18]` for the name
- If the fallback name is also blank or `"NAME"`, treat the block as **empty — skip it**
- Both blocks may show the same employee in single-employee files; always deduplicate by name + period before passing to the preview

---

## PB Format Detection

An uploaded file is a PB file (not the NexHRMS template) when **fewer than half** of the
expected `PAYROLL_TEMPLATE_COLS` headers appear in the file's first-row keys:

```typescript
function isPBFormat(headers: string[]): boolean {
  const normalised = headers.map((h) => h.trim().toLowerCase());
  const templateKeys = PAYROLL_TEMPLATE_COLS.map((c) => c.toLowerCase());
  const matchCount = templateKeys.filter((t) => normalised.includes(t)).length;
  return matchCount < PAYROLL_TEMPLATE_COLS.length / 2;
}
```

This function **already exists** in `import-data-dialog.tsx` — do not recreate it.

---

## Converter Function — `convertPBRawToPayrollRows`

This function **already exists** in `import-data-dialog.tsx`. Before touching it, verify the
row/column mapping against the table above and fix any mismatches.

It must return an array of `PayrollRow` objects keyed to `PAYROLL_TEMPLATE_COLS`:

```typescript
type PayrollRow = Record<(typeof PAYROLL_TEMPLATE_COLS)[number] | string, string>;

// Target columns:
// "Employee Name" | "Email" | "Department" | "Job Title"
// "Period Start"  | "Period End" | "Pay Frequency"
// "Gross Pay" | "Allowances" | "Holiday Pay"
// "SSS" | "PhilHealth" | "Pag-IBIG" | "Tax"
// "Loan Deduction" | "Custom Deductions" | "Other Deductions"
// "Net Pay" | "Payment Method" | "Bank Reference" | "Notes"
```

### Derived / Computed Fields

| Template field | Derived from |
|---|---|
| `Gross Pay` | `totalBasic + totalAllowances` |
| `Allowances` | `totalAllowances` (row 22) |
| `Loan Deduction` | `sssLoan + pagibigLoan` |
| `Custom Deductions` | `taxRefundDeficit + healthcard` |
| `Other Deductions` | `lwop + tardiness + adjustment` (rows 13, 14, 12) |
| `Pay Frequency` | Hard-coded `"Semi-monthly"` |
| `Email` | Left **blank** — user must fill in the preview dialog |
| `Notes` | Concatenate non-zero extras: `OT`, `Meal`, `Taxi`, `Project Allowance`, etc. |

---

## Preview Dialog — `PBPreviewDialog`

This component **already exists** in `import-data-dialog.tsx`. It shows each converted
`PayrollRow` as an editable card with labelled input fields grouped into sections:

```
Employee   → Employee Name*, Email*, Department, Job Title
Pay Period → Period Start, Period End, Pay Frequency
Earnings   → Gross Pay, Allowances, Holiday Pay
Deductions → SSS, PhilHealth, Pag-IBIG, Tax, Loan Deduction, Custom Deductions, Other Deductions
Payment    → Net Pay, Payment Method, Bank Reference, Notes
```

### Behaviour

- `Email` is **required** — highlight empty email fields in destructive red and disable the
  **Confirm Import** button until all emails are filled
- Each record card has a **delete (trash) icon** in the header — removes that record from the list
- A warning badge in the dialog header shows `"N emails missing"` when any email is blank
- **Back** button closes the preview and returns to the file picker (does not reset the whole dialog)
- **Confirm Import** button is disabled when: `rows.length === 0`, `confirming === true`,
  or `missingEmailCount > 0`

---

## Import Flow (end-to-end)

```
User uploads file
    │
    ▼
parseImportFile(file) → raw rows[]
    │
    ├─ isPBFormat(headers) === true
    │       │
    │       ▼
    │  convertPBRawToPayrollRows(raw)
    │       │
    │       ▼
    │  setPbRows(converted) → open PBPreviewDialog
    │       │
    │       ▼
    │  User edits / removes rows → clicks "Confirm Import"
    │       │
    │       ▼
    │  handlePBConfirm() → POST /api/import/payroll { rows, dryRun: false }
    │       │
    │       └─ toast "Imported N record(s)"
    │
    └─ isPBFormat === false (standard template)
            │
            ▼
       Validate required columns → runValidation(rows) → standard import flow
```

---

## Where the Logic Lives

**Do not create new files.** All changes are contained in:

```
src/components/import-data-dialog.tsx
```

The `ImportDataDialog` component already handles the PB branch inside `handleFileSelect`.
Locate the block guarded by `if (isPayroll && isPBFormat(fileHeaders))` and ensure:

1. `convertPBRawToPayrollRows` extracts correct values per the row mapping table above
2. Duplicate records (same name + same period) are deduplicated before opening the preview
3. `PBPreviewDialog` receives the converted rows and opens correctly
4. `handlePBConfirm` posts to `/api/import/payroll` with `dryRun: false` and fires a toast

---

## Warnings to Surface in the Preview

Show these as inline hints inside the editable card (not blocking the import):

| Condition | Hint |
|---|---|
| `Email` is blank | Red field outline + `"Required — please fill in"` description |
| `Net Pay` is `0` or blank | Amber note: `"Net pay is zero — verify before importing"` |
| `Period Start` or `Period End` blank | Amber note: `"Pay period missing — check PB file"` |
| Duplicate name + period detected | Amber note on second card: `"Duplicate of record above — one will be removed"` |

---

## After Successful Import

Call the existing import API which internally calls `issuePayslip` (or the bulk equivalent)
from `usePayrollStore`. Then:

```typescript
toast.success(`Imported ${data.imported} record(s) successfully`);
onImportComplete?.();
```

Close the `PBPreviewDialog` and reset the main dialog state (clear file, rows, validation).

---

## UI Style Rules

- Follow the existing shadcn/ui patterns already used in `import-data-dialog.tsx`
- Use `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`, `DialogDescription`
- Use `Input` with `h-8 text-xs` for editable cells
- Use `Badge variant="outline"` for record count and warning counts
- Use `Button variant="outline" size="sm"` for Back; `Button size="sm"` for Confirm Import
- Dark mode: use CSS variables (`text-amber-600 dark:text-amber-400`, etc.) — no hardcoded colours
- Destructive state: `border-destructive/60 bg-destructive/5 focus-visible:ring-destructive/40`

---

## Definition of Done

- [ ] `isPBFormat` correctly identifies PB files vs standard template files
- [ ] `convertPBRawToPayrollRows` maps every row/column correctly per the table above
- [ ] Duplicate records (same name + period) are removed before preview opens
- [ ] `PBPreviewDialog` opens with converted records for PB files
- [ ] All fields are editable; Email field is highlighted when blank
- [ ] Delete icon removes individual records from the preview list
- [ ] Confirm Import is disabled until all emails are filled and at least one record exists
- [ ] Successful import posts to `/api/import/payroll` and shows a toast
- [ ] Standard template files (non-PB) still go through the existing validation + import flow unchanged
- [ ] No TypeScript errors
- [ ] Existing attendance and employee import flows are not broken
