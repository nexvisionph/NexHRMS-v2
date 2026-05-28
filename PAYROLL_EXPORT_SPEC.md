# Payroll Export Feature — Developer Spec

## Overview

This document describes the implementation of the **Payroll Export** feature. It covers the export modal UI, form behavior/validation, data-fetching requirements, and the XLSX/PDF generation logic — including how each exported file maps to the existing `PB` payroll template.

---

## 1. Entry Point

The export is triggered by the **existing Export button** already present in the payroll page. No new button needs to be created. On click, it opens the **Payroll Export Modal** (see Section 2).

---

## 2. Export Modal

### 2.1 Component Location

Reuse and extend the **existing modal component** found under:

```
/components/modals/ExportModal
```

Do not create a new modal. Add the payroll-specific fields as a new modal variant or pass them via props/slots, keeping the implementation consistent with other modals in the codebase (same header style, button placement, spacing, typography, and color tokens).

---

### 2.2 Modal Fields

| Field | Type | Source | Notes |
|---|---|---|---|
| **Month** | Dropdown | Static (Jan–Dec) | Defaults to current month |
| **Year** | Dropdown or number input | Static (current year ± 2) | Defaults to current year |
| **Range** | Dropdown | Static | Options: `First Half`, `Second Half`, `Full Month` |
| **Department** | Dropdown | Database | Fetched on modal open; shows all active departments |
| **Employee** | Search + Tag input | Database | Searchable; supports multiple selections as tags |

**Date (Month + Year)** — Display as two adjacent dropdowns or a single month-year picker, consistent with how dates are handled elsewhere in the UI.

**Range** maps to the payroll period:
- `First Half` → 1st–15th of selected month/year
- `Second Half` → 16th–end of selected month/year  
- `Full Month` → 1st–end of selected month/year

---

### 2.3 Employee Search Behavior

- The Employee field is a **type-ahead search with tag-style multi-select**.
- As the user types, a dropdown appears with matching employees.
- Pressing `Enter` or clicking a result **adds the employee as a tag**.
- Tags can be removed individually via an `×` button on each tag.
- **When a Department is selected**, the employee search is scoped to only show employees under that department.
- **When one or more Employees are tagged**, the Department dropdown becomes **disabled/non-interactive** (greyed out). Clear all employee tags to re-enable it.
- Both fields cannot be actively filtered at the same time — department filters the employee pool; selecting employees locks the department.

---

### 2.4 Modal Action Buttons

```
[ Cancel ]   [ Export as PDF ]   [ Export as XLSX ]
```

- **Cancel** — closes the modal, discards selections, no API calls.
- **Export as XLSX** — validates fields, fetches data, generates and downloads the XLSX file.
- **Export as PDF** — same as XLSX export, but converts the generated XLSX to PDF before download (see Section 5).
- Both export buttons should show a **loading/spinner state** while processing. Disable both during an in-progress export.

---

### 2.5 Validation

Before triggering any export, validate:

- Month and Year are selected.
- Range is selected.
- At least one of Department or Employee is specified. Both being empty should show an inline error.

Show inline validation errors consistent with the existing form error pattern in the UI.

---

## 3. Data Fetching

### 3.1 On Modal Open

Fetch the department list immediately when the modal opens:

```
GET /api/departments
```

Response shape (adjust to match your actual API contract):

```json
[
  { "id": "dept_001", "name": "Engineering" },
  { "id": "dept_002", "name": "Operations" }
]
```

---

### 3.2 Employee Search

Fetch as the user types (debounce ~300ms):

```
GET /api/employees?search={query}&department_id={id}
```

- `department_id` is included only when a department is selected.
- Return enough fields for display and for the export (see Section 3.3).

---

### 3.3 Payroll Data Fetch (on Export Click)

When the user clicks either Export button, fetch the full payroll records:

```
GET /api/payroll/export
  ?month={1–12}
  &year={YYYY}
  &range={first_half|second_half|full_month}
  &department_id={id}         ← if department selected
  &employee_ids[]={id,...}    ← if employees tagged
```

The response must include **one record per employee** with the following data points (mapped directly to the PB template fields):

#### Employee Header Fields
| Field | PB Template Label |
|---|---|
| `employee_id` | Employee No. |
| `full_name` | Employees Name / NAME |
| `position` | Position |
| `project` | Project |
| `monthly_salary` | Monthly Salary |
| `department` | (used for sheet grouping) |

> **Note:** The company logo in the PB template is a **placeholder image**. Replace it with the actual company logo asset at build/render time. Do not use the placeholder in exports.

#### Payroll Computation Fields
| Field | PB Template Label |
|---|---|
| `period_from` | Period (from date) |
| `period_to` | Period (to date) |
| `daily_rate` | Rate/day |
| `hourly_rate` | Regular Rate per Hour |
| `semi_monthly_salary` | Semi-monthly salary |
| `overtime_pay` | Overtime Pay |
| `meal_allowance` | Meal Allowance |
| `project_allowance` | Project Allowance |
| `taxi_fare` | Taxi Fare |
| `cola` | COLA (if applicable) |
| `other_allowances` | Others |
| `total_allowances` | Total Allowances |
| `total_basic_salary` | Total Basic Salary |

#### Deductions
| Field | PB Template Label |
|---|---|
| `withholding_tax` | Withholding Tax |
| `sss_contribution` | SSS Contribution |
| `sss_salary_loan` | SSS Salary Loan |
| `philhealth_contribution` | Philhealth Contribution |
| `pagibig_contribution` | Pag-ibig Contribution |
| `pagibig_loan` | Pag-ibig Loan |
| `leave_without_pay` | Leave w/o Pay |
| `tardiness_undertime` | Tardiness/Undertime |
| `total_deductions` | (sum of above) |
| `net_pay` | Net Pay |

#### Daily Time Record (DTR)
Per day within the pay period, provide:

| Field | PB Template Label |
|---|---|
| `date` | DATE |
| `day_type` | SAT / SUN / weekday label |
| `time_in` | IN |
| `time_out` | OUT |
| `total_hours` | TOTAL |
| `overtime_hours` | overtime/undertime |
| `tardiness_hr` | Tardiness HR |
| `tardiness_min` | Tardiness MIN |
| `absences_days` | ABSENCES (Days) |

#### Overtime Detail (per day, per category)
The PB template breaks overtime into columns by day type and time bracket. Provide:

| Field | Description |
|---|---|
| `regular_ot_up_to_8` | Regular day OT up to 8 hrs |
| `regular_ot_excess_8` | Regular day OT excess of 8 hrs |
| `regular_night_diff` | Regular day night differential after 10PM |
| `sat_sun_special_ot_*` | Saturday/Sunday & Special Holiday equivalents |
| `special_holiday_sat_sun_ot_*` | Special Holiday (Sat/Sun) equivalents |
| `regular_holiday_ot_*` | Regular Holiday equivalents |
| `regular_holiday_sat_sun_ot_*` | Regular Holiday (Sat/Sun) equivalents |
| `total_overtime` | TOTAL OVERTIME |

---

## 4. XLSX Generation

### 4.1 Structure

- One **workbook** per export.
- One **sheet tab per employee**, named using the employee's full name (truncated to 31 characters, Excel's sheet name limit).
- Sheet order: alphabetical by last name, or by department then alphabetical — match whatever sort order the backend returns.

### 4.2 Template Mapping

Each sheet should **replicate the layout of the appropriate PB template sheet**, depending on the employee's type:

| Employee Type | Template Sheet |
|---|---|
| No deductions, no overtime | `no ded` |
| No deductions, with overtime | `no ded w OT` |
| Salaried with deductions | `salaried` |
| Consultant | `consultant` |

The `employee_type` field in the API response should indicate which template variant to use.

### 4.3 Cell Mapping

> All cell references below follow Excel A1 notation. Verify against the actual `.xls` template before finalizing — cell positions may shift slightly between template variants.

**Header Block (top-left)**

| Data | Approximate Cell |
|---|---|
| Company Logo | Merged cells top-left (replace placeholder) |
| Period From | Row with "Period" label |
| Period To | Same row, right side |
| Employee No. | "Employees No." row |
| Employee Name | "Employees Name" row |
| Position | "Position" row |
| Project | "Project" row |
| Monthly Salary | "Monthly Salary" row |
| Rate/day | "Rate/day" row |

**Payroll Summary Block (center)**

Map each payroll field to its corresponding labeled row in the summary section (Basic Salary, Overtime Pay, Allowances, Deductions, Net Pay).

**DTR Grid (right section)**

Populate the daily grid rows with the per-day DTR records. Dates 11–25 (or 1–15 / 1–end depending on range) fill down the date rows.

**OT Computation Block**

Fill the overtime breakdown table using the per-day OT detail fields.

### 4.4 Formatting

- Preserve all existing cell formatting from the template (borders, merged cells, fonts, number formats).
- Use the template file as the base — copy the appropriate sheet, then write data into it rather than building from scratch. This preserves styles without manual re-specification.
- Currency cells: use Philippine Peso format (`₱ #,##0.00`).
- Time cells: `H:MM` format.
- Date cells: `MMM DD, YYYY`.

### 4.5 Recommended Library

Use **ExcelJS** for Node.js / server-side generation:

```bash
npm install exceljs
```

Load the template `.xls`/`.xlsx`, clone the target sheet for each employee, write values into named cells or by row/column index, then stream the result.

```javascript
const ExcelJS = require('exceljs');

async function generatePayrollWorkbook(employees, templatePath) {
  const template = new ExcelJS.Workbook();
  await template.xlsx.readFile(templatePath);

  const output = new ExcelJS.Workbook();

  for (const employee of employees) {
    const templateSheet = template.getWorksheet(resolveTemplatSheet(employee.type));
    const newSheet = output.addWorksheet(employee.full_name.slice(0, 31));

    // Deep copy template sheet into newSheet, then write employee data
    copySheet(templateSheet, newSheet);
    writeEmployeeData(newSheet, employee);
  }

  return output;
}
```

---

## 5. PDF Export

There is no native PDF template. PDF export reuses the XLSX generation pipeline and converts the result:

```
XLSX generation → LibreOffice / headless converter → PDF
```

### 5.1 Recommended Approach

Use **LibreOffice in headless mode** (server-side) to convert the generated `.xlsx` to `.pdf`:

```bash
libreoffice --headless --convert-to pdf output.xlsx --outdir /tmp/
```

Or wrap it via a Node.js `child_process` call if running server-side.

Alternatively, use a library like **`xlsx-to-pdf`** or **`puppeteer`** (render HTML representation) if LibreOffice is not available in the deployment environment.

### 5.2 Multi-Sheet PDF

Each sheet (employee) in the workbook should become a **separate page or page group** in the PDF. Ensure the LibreOffice/converter settings are configured to print all sheets.

### 5.3 Download

Serve the PDF as a file download with the appropriate content type:

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="Payroll_April_2026_SecondHalf.pdf"
```

---

## 6. File Naming Convention

| Export Type | Filename Format | Example |
|---|---|---|
| XLSX | `Payroll_{Month}_{Year}_{Range}.xlsx` | `Payroll_April_2026_SecondHalf.xlsx` |
| PDF | `Payroll_{Month}_{Year}_{Range}.pdf` | `Payroll_April_2026_SecondHalf.pdf` |

If the export is scoped to a single department:
```
Payroll_{Department}_{Month}_{Year}_{Range}.xlsx
```

If scoped to specific employees (3 or fewer), list names; otherwise use employee count:
```
Payroll_Santos_Reyes_Cruz_April_2026_FirstHalf.xlsx
Payroll_12Employees_April_2026_FirstHalf.xlsx
```

---

## 7. Error Handling

| Scenario | Behavior |
|---|---|
| No employees match the filters | Show inline message in modal: "No employees found for the selected filters." Disable export buttons. |
| API fetch fails | Show toast/snackbar error. Re-enable export buttons. |
| Export generation fails server-side | Return meaningful error message; display in modal or toast. |
| Employee missing required payroll data | Include the sheet with available data; mark missing fields as blank or `N/A`. Optionally log a warning in the response. |
| Sheet name collision (duplicate employee names) | Append employee ID suffix: `Juan Santos (KEI-012)` |

---

## 8. Dependencies Summary

| Dependency | Purpose |
|---|---|
| `exceljs` | XLSX read/write with template cloning |
| `libreoffice` (headless) | XLSX → PDF conversion |
| Existing modal component | UI shell (no new component needed) |
| Existing department/employee API | Data source for dropdowns and search |
| Existing payroll API | Payroll data for export content |

---

## 9. Open Questions / To Clarify

- [ ] What is the `employee_type` field name in the database, and what are its exact values? (Needed to select the correct template sheet.)
- [ ] Is the payroll export endpoint already built, or does it need to be created?
- [ ] Where is the company logo asset stored? Confirm the path to replace the placeholder in the template.
- [ ] Should the PDF be one file with all employees, or one PDF per employee?
- [ ] Is LibreOffice available in the deployment environment, or should an alternative PDF converter be used?
- [ ] Should the export be generated client-side or server-side? (Server-side is strongly recommended for large workbooks and PDF conversion.)
