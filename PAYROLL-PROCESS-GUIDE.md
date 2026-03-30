# NexHRMS — Payroll Process Guide

> **Standard Operating Procedure for Semi-Monthly Payroll Processing**
> Version 1.0 · Philippine Compliance (TRAIN Law, SSS, PhilHealth, Pag-IBIG, DOLE)

---

## Table of Contents

1. [Overview](#overview)
2. [Roles & Permissions](#roles--permissions)
3. [Pay Schedule Configuration](#pay-schedule-configuration)
4. [Semi-Monthly Payroll Calendar](#semi-monthly-payroll-calendar)
5. [Step-by-Step: Processing a Payroll Cycle](#step-by-step-processing-a-payroll-cycle)
6. [Employee: Receiving & Signing Payslips](#employee-receiving--signing-payslips)
7. [Adjustments & Corrections](#adjustments--corrections)
8. [Final Pay (Resignation / Separation)](#final-pay-resignation--separation)
9. [13th Month Pay](#13th-month-pay)
10. [Government Remittance Filing](#government-remittance-filing)
11. [Bank File Export](#bank-file-export)
12. [Payroll Run Lifecycle Reference](#payroll-run-lifecycle-reference)
13. [Payslip Lifecycle Reference](#payslip-lifecycle-reference)
14. [Audit Trail & Compliance](#audit-trail--compliance)
15. [Quick Reference Cheat Sheet](#quick-reference-cheat-sheet)

---

## Overview

NexHRMS processes payroll on a **semi-monthly** schedule by default, aligned with Philippine labor law:

| Cutoff Period | Period Covered | Pay Day | Gov Deductions |
|---|---|---|---|
| **1st Cutoff** | 1st – 15th of the month | 20th of the month | None (configurable) |
| **2nd Cutoff** | 16th – End of Month | 5th of the next month | SSS, PhilHealth, Pag-IBIG, Tax |

Government deductions (SSS, PhilHealth, Pag-IBIG, withholding tax) are applied on the **2nd cutoff** by default. This is configurable in Pay Schedule Settings to deduct from the 1st cutoff, 2nd cutoff, or split across both.

---

## Roles & Permissions

| Role | What They Can Do |
|---|---|
| **Admin** | Full access: issue, confirm, lock, publish, pay, adjust, generate 13th month |
| **HR Manager** | Issue payslips, create runs, confirm, view all payslips |
| **Finance Manager** | Confirm payments, approve/reject adjustments, lock & publish runs, export bank files |
| **Payroll Admin** | Same as Admin for payroll module (restricted elsewhere) |
| **Employee** | View own payslips, sign, acknowledge receipt |

---

## Pay Schedule Configuration

Navigate to **Payroll → Pay Schedule** tab.

| Setting | Default | Description |
|---|---|---|
| Frequency | Semi-Monthly | Options: Semi-Monthly, Monthly, Bi-Weekly, Weekly |
| 1st Cutoff End Day | 15th | Last day of the 1st pay period |
| 1st Cutoff Pay Day | 20th | Payday for 1st cutoff |
| 2nd Cutoff Pay Day | 5th | Payday for 2nd cutoff (next month) |
| Gov Deduction Timing | 2nd cutoff | Which cutoff deducts SSS/PhilHealth/Pag-IBIG/Tax |

**Tip:** Most Philippine companies deduct gov contributions on the **2nd cutoff** to give employees a larger 1st cutoff take-home.

---

## Semi-Monthly Payroll Calendar

Example for **March 2026**:

```
March 1–15   → 1st Cutoff → Issued by Mar 18 → Paid on Mar 20
March 16–31  → 2nd Cutoff → Issued by Apr 3  → Paid on Apr 5
```

**Recommended timeline for HR/Finance:**

| Day | Action | Who |
|---|---|---|
| 16th | Collect attendance, OT, leave for 1st cutoff (1st–15th) | HR |
| 17th–18th | Issue 1st cutoff payslips, review, confirm | HR / Payroll Admin |
| 18th | Create payroll run, validate, lock | HR Manager |
| 19th | Finance reviews locked run, publishes | Finance Manager |
| 20th | **PAY DAY** — Record bank transfer, export bank file | Finance |
| 1st (next month) | Collect data for 2nd cutoff (16th–EOM) | HR |
| 2nd–3rd | Issue 2nd cutoff payslips with gov deductions, confirm | HR |
| 3rd | Lock & publish 2nd cutoff run | HR / Finance |
| 5th | **PAY DAY** — Record payment | Finance |

---

## Step-by-Step: Processing a Payroll Cycle

### Step 1: Issue Payslips

1. Go to **Payroll → Payslips** tab
2. Click **"Issue Payslip"** (top-right)
3. In the dialog:
   - Select employees (checkbox list)
   - Set **Period Start** and **Period End** (e.g., 2026-03-01 to 2026-03-15)
   - Enter **OT Hours** and **Night Differential Hours** if applicable
   - Set **Allowances** if any
   - The system auto-computes:
     - Gross Pay = (Monthly Salary ÷ 2) + Allowances + OT Pay + Night Diff Pay
     - OT Pay = Hourly Rate × OT Hours × 1.25 (per PH Labor Code Art. 87)
     - Night Diff Pay = Hourly Rate × Night Diff Hours × 0.10 (per Art. 86)
     - Gov Deductions (if applicable for this cutoff)
     - Net Pay = Gross – All Deductions
4. Click **"Issue N Payslips"**

Each issued payslip starts with status: **`issued`**

### Step 2: Confirm Payslips

1. In the **Payslips** tab, find issued payslips (filter by Status: "Issued")
2. Click the **green check (✓)** icon on each payslip row
3. Status changes to: **`confirmed`**

**Why confirm?** This is a review step — HR verifies the amounts are correct before they go to Finance.

### Step 3: Create a Payroll Run

1. Go to **Payroll → Runs** tab
2. On the row for the target date, click **"Draft"**
3. This creates a payroll run and links all confirmed payslips to it

### Step 4: Validate the Run

1. On the run row, click **"Validate"**
2. Status changes to: **`validated`**
3. System performs sanity checks on all linked payslips

### Step 5: Lock the Run (Policy Snapshot)

1. Click the **🔒 Lock** icon on the run row
2. A confirmation dialog appears — click **Confirm**
3. The system captures a **Policy Snapshot**:
   - Tax table version (TRAIN Law 2026)
   - SSS contribution table version
   - PhilHealth rate version
   - Pag-IBIG rate version
   - Holiday list version
   - Formula version
4. **Once locked, the run is immutable.** No changes can be made to payslip amounts.

### Step 6: Publish the Run

1. Click the **📤 Publish** icon on the locked run
2. All confirmed payslips in the run are auto-published
3. Employees can now **view and sign** their payslips

### Step 7: Record Payment

1. After bank transfer is processed, go to **Payslips** tab
2. Click the **💳 Payment** icon on each published payslip
3. Or use **Payroll → Management** tab → "Mark Paid" button for bulk action
4. Enter payment method and reference number

### Step 8: Mark Run as Paid

1. Go to **Runs** tab
2. Click the **💳** icon on the published run
3. Run status changes to: **`paid`**

---

## Employee: Receiving & Signing Payslips

### Viewing Payslips
1. Navigate to **Payroll** (employee view)
2. See summary: Total Payslips, Total Earned, Latest Net Pay
3. Click any payslip row to see full breakdown

### Signing a Payslip
1. When a payslip is **published** or **paid**, a "Sign" button appears
2. Click **"Sign"** → A signature pad opens
3. Draw your signature → Click **"Save Signature"**
4. Your signature is captured as a digital image and timestamped

### Acknowledging Receipt
1. After the payslip is **paid** AND you've signed it:
2. An **"I Confirm Receipt"** button appears
3. Click it to confirm you received payment
4. Status changes to: **`acknowledged`**

### Printing / Downloading
- Click the **🖨️ Print** button on any payslip row
- Opens an A4-formatted printable payslip with:
  - Company header
  - Employee info
  - Period and pay frequency
  - Earnings breakdown (basic, allowances, OT, night diff, holiday)
  - Deductions breakdown (SSS, PhilHealth, Pag-IBIG, tax, loans, other)
  - Net pay
  - Signature area
- Use **Print** or **Save as PDF**

---

## Adjustments & Corrections

For prior-period errors (missed OT, wrong deductions, retroactive pay):

### Creating an Adjustment

1. Go to **Payroll → Adjustments** tab
2. Click **"Create Adjustment"**
3. Fill in:
   - **Employee** — select from list
   - **Reference Payslip** — the original payslip to correct
   - **Type** — Earnings, Deduction, Reimbursement, or Statutory Correction
   - **Amount** — the adjustment amount
   - **Reason** — mandatory description
4. Click **Submit**
5. Status: **`pending`**

### Approving an Adjustment

1. Finance Manager reviews pending adjustments
2. Click **Approve** or **Reject**
3. If approved: status → **`approved`**

### Applying an Adjustment

1. On an approved adjustment, click **Apply**
2. The system creates a new **adjustment payslip** with:
   - Reference back to the original adjustment
   - Notes indicating "Prior Period" correction
3. Status → **`applied`**

---

## Final Pay (Resignation / Separation)

When an employee resigns or is separated:

1. Go to **Payroll → Final Pay** tab
2. Click **"Compute Final Pay"**
3. Select the resigned employee
4. The system computes:
   - **Pro-rated Salary** — (Daily Rate × Days Worked in Final Month)
   - **Unpaid OT** — (Hourly Rate × OT Hours × 1.25)
   - **Leave Payout** — (Unused Leave Days × Daily Rate)
   - **Loan Deduction** — Remaining loan balance
   - **Gross Final Pay** = Pro-rated + OT + Leave Payout
   - **Net Final Pay** = Gross - Deductions

**Rates:**
- Daily Rate = Monthly Salary ÷ Days in Month
- Hourly Rate = (Annual Salary) ÷ 2,080 hours

---

## 13th Month Pay

Per Presidential Decree No. 851, all rank-and-file employees are entitled to 13th month pay.

### Generating 13th Month

1. Go to **Payroll** dashboard
2. Click **"13th Month Pay"** button (header area)
3. Select employees
4. System computes:
   - **Full-year employees**: 13th Month = Monthly Salary
   - **Mid-year joiners**: Pro-rated = (Monthly Salary × Months Worked) ÷ 12

**Tax note:** 13th month pay is **tax-exempt** up to ₱90,000 under TRAIN Law.

---

## Government Remittance Filing

Navigate to **Payroll → Gov Reports** tab.

### SSS Contributions
- Shows Employee Share (4.5%) and Employer Share (9.5%)
- Capped at MSC ₱29,750 → max employee share ₱1,350/month
- **Filing:** Submit SBR (SSS Billing Record) and pay by 10th of following month

### PhilHealth Contributions
- 5% of basic salary, split 50/50
- Employee share: 2.5% (max ₱2,500/month at ₱100K salary)
- **Filing:** Submit RF-1 and pay by 10th of following month

### Pag-IBIG Contributions
- Employee: 2% (capped at ₱100/month)
- Employer: 2% (capped at ₱100/month)
- **Filing:** Submit HDMF contribution via Virtual Pag-IBIG by 10th

### BIR Withholding Tax
- Uses TRAIN Law 2023+ brackets (6-tier progressive)
- ₱250K/year and below: **exempt**
- **Filing:** BIR Form 1601-C monthly, 1604-CF annually

### Exporting Reports
- Each agency tab has a **"Export CSV"** button
- Downloads a CSV file with: Employee ID, Name, Employee Share, Employer Share
- Includes total row for filing reference

---

## Bank File Export

1. Go to **Payroll → Runs** tab
2. Click the **⬇️ Download** icon on a run row
3. Generates a CSV file with format:
   ```
   Account Number, Employee Name, Net Pay, Payment Date, Reference ID
   ```
4. Upload this file to your bank's batch payment portal (BPI, BDO, Metrobank, etc.)

---

## Payroll Run Lifecycle Reference

```
┌─────────┐    ┌───────────┐    ┌────────┐    ┌───────────┐    ┌──────┐
│  Draft   │───▶│ Validated │───▶│ Locked │───▶│ Published │───▶│ Paid │
└─────────┘    └───────────┘    └────────┘    └───────────┘    └──────┘
                                     │
                                     ▼
                              Policy Snapshot
                              (immutable audit)
```

| Status | Meaning |
|---|---|
| **Draft** | Run created, payslips linked |
| **Validated** | System checked all payslip data |
| **Locked** | Policy snapshot taken, amounts frozen — no edits allowed |
| **Published** | Employees can view their payslips |
| **Paid** | All payments recorded |

---

## Payslip Lifecycle Reference

```
┌────────┐    ┌───────────┐    ┌───────────┐    ┌──────┐    ┌──────────────┐
│ Issued │───▶│ Confirmed │───▶│ Published │───▶│ Paid │───▶│ Acknowledged │
└────────┘    └───────────┘    └───────────┘    └──────┘    └──────────────┘
                                     │              │                │
                                     ▼              ▼                ▼
                              Employee sees   Employee signs   Employee confirms
                              payslip         (signature pad)  receipt of payment
```

| Status | Who Acts | Action |
|---|---|---|
| **Issued** | HR | Payslip created with computed amounts |
| **Confirmed** | HR / Admin | HR reviews and confirms correctness |
| **Published** | Finance / System | Payslip visible to employee |
| **Paid** | Finance | Payment recorded with method + reference |
| **Acknowledged** | Employee | Employee confirms receipt (requires signature first) |

---

## Audit Trail & Compliance

Every payroll action is logged in the audit system:

| Action | Logged Data |
|---|---|
| `payroll_locked` | Run ID, who locked, policy snapshot |
| `payroll_published` | Run ID, timestamp |
| `payroll_paid` | Run ID, payment details |
| `payment_recorded` | Payslip ID, method, reference |
| `adjustment_created` | Adjustment details, created by |
| `adjustment_approved` | Approved by, timestamp |
| `adjustment_applied` | Applied to run, adjustment payslip created |
| `final_pay_created` | Employee, computation breakdown |

**Policy Snapshot** — When a run is locked, NexHRMS captures:
- Tax table version
- SSS contribution table version
- PhilHealth premium rate version
- Pag-IBIG contribution rate version
- Holiday list version
- Formula version

This provides an immutable audit trail showing **which rules were in effect** when payroll was processed.

---

## Quick Reference Cheat Sheet

### HR / Payroll Admin — Every Pay Period

```
1. ☐ Collect attendance, OT, leave data
2. ☐ Issue payslips (Payroll → Issue Payslip)
3. ☐ Review and confirm each payslip (✓ button)
4. ☐ Create payroll run (Runs tab → Draft)
5. ☐ Validate run (Validate button)
6. ☐ Lock run (🔒 — captures policy snapshot)
7. ☐ Publish run (📤 — employees can now view)
```

### Finance Manager — Every Pay Day

```
1. ☐ Review published run totals
2. ☐ Process bank transfer (export bank file → upload to bank)
3. ☐ Record payment for each payslip (💳 button)
4. ☐ Mark run as paid
5. ☐ File gov remittances by 10th of next month
```

### Employee — After Pay Day

```
1. ☐ Open Payroll → view payslip
2. ☐ Review earnings and deductions
3. ☐ Sign payslip (signature pad)
4. ☐ Confirm receipt ("I Confirm Receipt" button)
5. ☐ Download/print for records
```

### Monthly Gov Filing Deadlines

| Agency | Form/System | Deadline |
|---|---|---|
| SSS | Online SBR | 10th of following month |
| PhilHealth | RF-1 / Electronic | 10th of following month |
| Pag-IBIG | Virtual Pag-IBIG | 10th of following month |
| BIR | Form 1601-C | 10th of following month |

---

## Supabase Database Tables

All payroll data is synced to Supabase in real-time:

| Table | Description | Sync Mode |
|---|---|---|
| `payslips` | Individual employee payslips | Write-through + Realtime |
| `payroll_runs` | Batch payroll runs with policy snapshots | Write-through + Realtime |
| `payroll_adjustments` | Prior-period corrections | Write-through + Realtime |
| `final_pay_computations` | Separation/resignation final pay | Write-through + Realtime |
| `pay_schedule_config` | Pay frequency and cutoff settings | Write-through |

Data flow: **Zustand Store → Write-through → Supabase → Realtime → Other clients**

---

*Generated for NexHRMS v1.0 · Last updated: 2026*
