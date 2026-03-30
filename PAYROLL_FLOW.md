# NexHRMS — Payroll System: Complete Flow & Guide

> **Version:** 2.0  
> **Date:** March 26, 2026  
> **Compliance:** Philippine Labor Code, TRAIN Law (RA 10963), SSS Act, PhilHealth Act, Pag-IBIG Fund Act

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Roles & Permissions](#2-roles--permissions)
3. [Semi-Monthly Payroll Flow (Step-by-Step)](#3-semi-monthly-payroll-flow-step-by-step)
4. [Pay Schedule Configuration](#4-pay-schedule-configuration)
5. [PH Government Deductions](#5-ph-government-deductions)
6. [Payslip Lifecycle](#6-payslip-lifecycle)
7. [Payroll Run Lifecycle](#7-payroll-run-lifecycle)
8. [Adjustments & Corrections](#8-adjustments--corrections)
9. [Final Pay (Separation)](#9-final-pay-separation)
10. [13th Month Pay](#10-13th-month-pay)
11. [Government Reports & Compliance](#11-government-reports--compliance)
12. [Bank File Export](#12-bank-file-export)
13. [Employee Experience](#13-employee-experience)
14. [HR/Finance Quick-Start Guide](#14-hrfinance-quick-start-guide)
15. [Supabase Data Architecture](#15-supabase-data-architecture)
16. [Test Coverage](#16-test-coverage)

---

## 1. System Overview

NexHRMS implements a **complete Philippine-compliant payroll system** supporting:

- **Semi-monthly** (default), monthly, bi-weekly, and weekly pay frequencies
- Automatic SSS, PhilHealth, Pag-IBIG, and BIR withholding tax computation
- Full payslip lifecycle with digital signatures and acknowledgement
- Payroll run management with policy locking
- Prior-period adjustments and corrections
- Final pay computation for resigned employees
- 13th month pay generation with pro-rating
- Government report generation (per agency) with CSV export
- Printable A4 payslips with PDF download
- Full Supabase sync with realtime updates

---

## 2. Roles & Permissions

| Role | Payroll Access | Key Capabilities |
|------|---------------|-----------------|
| **Admin** | Full | Issue, confirm, publish, lock, pay, adjust, final pay, reports, settings, reset |
| **Finance** | Full operations | Same as admin except: no reset, title shows "Payroll & Finance" |
| **Payroll Admin** | Full operations | Same as finance, title shows "Payroll Administration" |
| **Employee** | Read-only + sign | View own payslips, sign, acknowledge receipt, print/download |
| **HR** | No payroll nav | HR does not see Payroll in sidebar (by design) |
| **Supervisor** | No payroll nav | Supervisors focus on attendance/leave/tasks |
| **Auditor** | No payroll nav | Auditor accesses audit logs only |

### Permission Checks

- `payroll:generate` — Issue payslips, create runs
- `payroll:lock` — Lock runs, publish
- `payroll:issue` — Issue individual payslips, manage adjustments, final pay

---

## 3. Semi-Monthly Payroll Flow (Step-by-Step)

This is the recommended workflow for HR/Finance processing bi-monthly payroll:

### Step 1: Configure Pay Schedule (One-Time Setup)

Navigate to **Payroll → Pay Schedule** tab.

| Setting | Default | Description |
|---------|---------|-------------|
| Frequency | Semi-Monthly | 2 pay periods per month |
| 1st Cutoff | 15th | Covers 1st to 15th |
| 1st Pay Day | 20th | Salary released on 20th |
| 2nd Pay Day | 5th (next month) | Salary released on 5th |
| Gov Deductions | 2nd cutoff | SSS/PhilHealth/Pag-IBIG/Tax deducted from 2nd cutoff only |

### Step 2: Issue 1st Cutoff Payslips (1st–15th)

1. Go to **Payroll → Management** tab → click **"Issue Payslips"**
2. Select employees (bulk checkbox)
3. Set **Period**: March 1 – March 15
4. Enter allowances, OT hours (125% premium), Night Diff hours (+10%)
5. Since gov deductions are on 2nd cutoff → deductions = ₱0
6. **Net Pay = Gross + Allowances + OT + Night Diff**
7. Click **Issue** → payslips created with status `issued`

### Step 3: Issue 2nd Cutoff Payslips (16th–31st)

1. Same process as Step 2
2. Set **Period**: March 16 – March 31
3. System auto-computes PH deductions (full month amounts):
   - SSS: 4.5% of monthly salary (max ₱1,575)
   - PhilHealth: 2.5% of monthly salary (max ₱2,500)
   - Pag-IBIG: ₱100 employee cap
   - Withholding Tax: TRAIN Law 6-bracket schedule
4. Loan deductions auto-applied from active loans
5. Holiday pay auto-computed for non-working holidays
6. **Net Pay = Gross - All Deductions**

### Step 4: Create Payroll Run

1. Go to **Payroll → Runs** tab → click **"Create Run"**
2. Select all 6 payslips (3 employees × 2 cutoffs)
3. Run created with status `draft`

### Step 5: Validate → Lock → Publish

1. **Validate**: Click "Validate" — checks all payslips are properly computed
2. **Lock**: Click "Lock" — creates immutable policy snapshot:
   - Tax table version, SSS/PhilHealth/Pag-IBIG rates
   - Who locked it and when
   - Cannot be re-locked once locked
3. **Confirm payslips**: Admin confirms each payslip (status: `issued` → `confirmed`)
4. **Publish**: Click "Publish" — auto-publishes all confirmed payslips
   - Run status: `locked` → `published`
   - Payslip status: `confirmed` → `published`
   - Employees can now see their payslips

### Step 6: Employee Signs

1. Employee opens **Payroll → My Payslips**
2. Clicks on payslip → sees full breakdown
3. Uses **signature pad** to draw signature
4. Clicks **Sign** → `signedAt` and `signatureDataUrl` recorded

### Step 7: Finance Records Payment

1. Finance opens **Payroll → Payslips** tab
2. Clicks **Record Payment** on each payslip
3. Selects payment method (bank_transfer, cash, check, gcash)
4. Enters bank reference number
5. Payslip status: `published` → `paid`

### Step 8: Employee Acknowledges Receipt

1. Employee sees payslip status as `paid`
2. Clicks **Acknowledge** to confirm they received payment
3. Payslip status: `paid` → `acknowledged` (terminal state)

### Step 9: Mark Run as Paid

1. Admin/Finance marks the entire run as `paid`
2. This is the final step — payroll cycle complete

---

## 4. Pay Schedule Configuration

| Frequency | Cutoffs | Pay Days | Used By |
|-----------|---------|----------|---------|
| **Semi-Monthly** | 15th, EOM | 20th, 5th | Default for PH companies |
| **Monthly** | EOM | Configurable | Some companies |
| **Bi-Weekly** | Every 2 weeks | Start date configurable | Less common in PH |
| **Weekly** | Every week | Configurable day | Rare |

Gov deduction timing options:
- **2nd cutoff only** (default): Full month deductions on 16th–EOM payslip
- **Both cutoffs**: Split equally across both pay periods
- **1st cutoff only**: Deduct everything from 1st–15th payslip

---

## 5. PH Government Deductions

### SSS (Social Security System)
- **Employee**: 4.5% of monthly salary credit
- **Employer**: 9.5% of monthly salary credit
- **EC**: 1% (employer-only)
- **Total rate**: 15%
- **MSC range**: ₱4,000 – ₱35,000
- **Minimum**: ₱180/month (employee share)
- **Maximum**: ₱1,575/month (employee share)

### PhilHealth
- **Employee**: 2.5% of basic monthly salary
- **Employer**: 2.5% of basic monthly salary
- **Total rate**: 5%
- **Floor**: ₱10,000/month (minimum premium base)
- **Ceiling**: ₱100,000/month (maximum premium base)
- **Minimum**: ₱250/month (employee share)
- **Maximum**: ₱2,500/month (employee share)

### Pag-IBIG (HDMF)
- **Employee**: 1% if salary ≤ ₱1,500, else 2% (capped at ₱100)
- **Employer**: 2% (capped at ₱200)

### Withholding Tax (TRAIN Law — RA 10963)
6-bracket progressive tax table:

| Taxable Income (Monthly) | Tax |
|--------------------------|-----|
| ≤ ₱20,833 | 0% |
| ₱20,834 – ₱33,333 | 15% of excess over ₱20,833 |
| ₱33,334 – ₱66,667 | ₱1,875 + 20% of excess over ₱33,333 |
| ₱66,668 – ₱166,667 | ₱8,542 + 25% of excess over ₱66,667 |
| ₱166,668 – ₱666,667 | ₱33,542 + 30% of excess over ₱166,667 |
| > ₱666,667 | ₱183,542 + 35% of excess over ₱666,667 |

**Taxable income** = Gross – SSS – PhilHealth – Pag-IBIG

---

## 6. Payslip Lifecycle

```
issued → confirmed → published → paid → acknowledged
```

| Status | Set By | Description |
|--------|--------|-------------|
| `issued` | Admin/HR/Finance | Payslip created with computed amounts |
| `confirmed` | Admin/HR/Finance | Amounts verified and approved |
| `published` | System (via publishRun) | Employee can view and sign |
| `paid` | Finance | Payment recorded with method + reference |
| `acknowledged` | Employee | Receipt confirmed (requires signature + payment) |

### Key Fields
- `signedAt` / `signatureDataUrl` — Employee's digital signature (can sign at published or paid status)
- `paidAt` / `paymentMethod` / `bankReferenceId` — Payment details
- `paidConfirmedBy` / `paidConfirmedAt` — Finance confirmation audit trail
- `acknowledgedAt` / `acknowledgedBy` — Employee's final acknowledgement

---

## 7. Payroll Run Lifecycle

```
draft → validated → locked → published → paid
```

| Status | Description |
|--------|-------------|
| `draft` | Run created, payslips linked |
| `validated` | All payslips checked for correctness |
| `locked` | **Immutable** — policy snapshot frozen (tax rates, SSS tables, etc.) |
| `published` | Run and all confirmed payslips published to employees |
| `paid` | All payslips paid, cycle complete |

### Policy Snapshot (Locked at Lock Time)
```json
{
  "taxTableVersion": "2026-TRAIN-v1",
  "sssVersion": "2026-SSS-v1",
  "philhealthVersion": "2026-PhilHealth-v1",
  "pagibigVersion": "2026-PagIBIG-v1",
  "holidayListVersion": "2026-PH-Holidays",
  "formulaVersion": "2026-PH-PAYROLL-v1",
  "ruleSetVersion": "RS-DEFAULT-v1",
  "lockedBy": "HR-Admin-001"
}
```

---

## 8. Adjustments & Corrections

### Creating an Adjustment
1. Go to **Payroll → Adjustments** tab → click **"Create Adjustment"**
2. Select employee, reference payslip, adjustment type:
   - `earnings` — Additional pay owed
   - `deduction` — Deduction correction
   - `net_correction` — Direct net pay fix
   - `statutory_correction` — Fix government deduction amounts
3. Enter amount and reason
4. Status: `pending` → admin approves → `approved` → admin applies → `applied`

### Adjustment Lifecycle
```
pending → approved → applied
        ↘ rejected
```

---

## 9. Final Pay (Separation)

For resigned/terminated employees:

1. Go to **Payroll → Final Pay** tab → click **"Compute Final Pay"**
2. Select resigned employee (auto-filtered to `resigned` status)
3. System auto-computes:
   - **Pro-rated salary** (days worked in final month)
   - **Unpaid OT** at 125% rate
   - **Leave cash-out** (balance × daily rate)
   - **Loan deduction** (remaining balance from active loans)
4. Live preview shows gross final pay, deductions, and net amount
5. Status: `draft` → `approved` → `paid`

---

## 10. 13th Month Pay

Per Philippine Labor Code (Presidential Decree 851):

1. Admin clicks **"Generate 13th Month"** in Management tab
2. System calculates: `(Total basic salary earned in year) / 12`
3. Pro-rated for employees who worked less than 12 months
4. Creates separate payslip with `payFrequency: "13th_month"`

---

## 11. Government Reports & Compliance

Navigate to **Payroll → Gov Reports** tab.

### Available Reports
| Agency | Content | Export |
|--------|---------|--------|
| **SSS** | Per-employee EE/ER contributions by period | CSV |
| **PhilHealth** | Per-employee EE/ER premium shares | CSV |
| **Pag-IBIG** | Per-employee EE/ER contributions | CSV |
| **BIR** | Per-employee withholding tax by period | CSV |

Each report shows:
- Summary cards (total EE contribution, total ER contribution, total combined, employee count)
- Detailed table with employee name, ID, gross, EE share, ER share, total
- Totals row
- CSV download button

---

## 12. Bank File Export

1. After payslips are paid, go to **Payroll → Management** tab
2. Click **"Export Bank File"**
3. System generates CSV with:
   - Account number, employee name, net pay, payment date, reference ID
4. Upload this file to your bank's bulk payment portal

---

## 13. Employee Experience

### What Employees See
1. **My Payslips** — List of all payslips with period, gross, deductions, net, status
2. **Summary Cards** — Total earnings, latest net pay, pending payslips count
3. **Detail View** — Full earnings/deductions breakdown
4. **Signature Pad** — Draw signature to confirm payslip
5. **Print / Download** — Generate printable A4 payslip (PDF via browser print)
6. **Acknowledge** — Confirm receipt after payment

### Payslip Detail Breakdown
- **Earnings**: Basic pay, allowances, OT premium (125%), night diff (+10%), holiday pay
- **Deductions**: SSS, PhilHealth, Pag-IBIG, withholding tax, loans, other
- **Net Pay**: Gross – Total Deductions

---

## 14. HR/Finance Quick-Start Guide

### Easiest Bi-Monthly Workflow (Recommended)

**Day 1 of pay period (1st or 16th):**
- [ ] Nothing to do — employees work normally

**Day 15 (or EOM) — Cutoff Day:**
1. [ ] Open **Payroll → Management** → **Issue Payslips**
2. [ ] Select all active employees
3. [ ] Set correct period dates
4. [ ] Add OT hours and night diff if applicable
5. [ ] Review computed amounts → **Issue**
6. [ ] Create payroll run → link all new payslips
7. [ ] **Validate** the run
8. [ ] **Confirm** each payslip (verify amounts)
9. [ ] **Lock** the run (freezes deduction rates)
10. [ ] **Publish** the run (employees can now view)

**Pay Day (20th or 5th):**
1. [ ] Export bank file → upload to bank portal
2. [ ] After bank confirms transfer: **Record Payment** for each payslip
3. [ ] Notify employees (automatic if notifications configured)

**After Pay Day:**
1. [ ] Employees sign and acknowledge — monitor on dashboard
2. [ ] Mark run as paid when all acknowledged
3. [ ] Generate government reports for the period
4. [ ] File SSS/PhilHealth/Pag-IBIG/BIR contributions

### Pro Tips
- **Use bulk selection** to issue payslips for all employees at once
- **Gov deductions on 2nd cutoff** simplifies 1st cutoff processing (no deductions)
- **Lock early** to preserve the exact tax rates used
- **Print payslips** for physical filing requirements
- Check **Adjustments** tab for any pending corrections before locking

---

## 15. Supabase Data Architecture

### Payroll Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `payslips` | 34 cols | Individual payslip records |
| `payroll_runs` | 11 cols | Batch payroll run management |
| `payroll_adjustments` | 14 cols | Prior-period corrections |
| `final_pay_computations` | 12 cols | Separation pay calculations |
| `pay_schedule_config` | 9 cols | Pay frequency & schedule settings |

### Sync Architecture
- **Hydration**: On login, all payroll data fetched from Supabase → Zustand
- **Write-through**: Every store change auto-persists to Supabase
- **Realtime**: Supabase postgres_changes subscriptions keep all sessions in sync
- **Offline**: Zustand persist middleware provides localStorage fallback

### Full Sync Coverage (28 Tables)
Employees, salary requests/history, leave (requests/balances/policies), attendance (logs/events/holidays/shifts/OT/evidence/exceptions/penalties/employee-shifts), payroll (payslips/runs/adjustments/final-pay/schedule), loans (with deductions), projects, audit logs, calendar events, messaging (announcements/channels/messages), tasks (groups/tasks/reports/comments), timesheets (records/rule-sets), notifications (logs/rules), location (pings/photos/breaks)

---

## 16. Test Coverage

### Payroll Tests (35 tests)

**File**: `src/__tests__/features/payroll-bimonthly-flow.test.ts`

| Test Group | Tests | Coverage |
|-----------|-------|---------|
| Pay schedule config | 3 | Default values, frequency change, deduction timing |
| PH deduction accuracy | 4 | SSS, PhilHealth, Pag-IBIG, withholding tax, all-in-one |
| 1st cutoff issuance | 1 | Issue 3 payslips with no deductions |
| 2nd cutoff issuance | 1 | Issue 3 payslips with full gov deductions |
| Payroll run lifecycle | 7 | Draft→validate→lock→publish, immutability, sign, pay, acknowledge, run paid |
| Adjustments | 3 | Create, approve/reject, apply |
| Final pay | 2 | Compute with leave/loan, status tracking |
| 13th month | 1 | Pro-rated generation |
| Bank file export | 1 | CSV generation |
| Full integration | 1 | Complete cycle: issue→confirm→publish→sign→pay→acknowledge |

**Additional payroll tests**: `src/__tests__/features/payroll.test.ts`

### Total Test Suite
- **322 tests passing** across 11 test files
- Coverage: Auth, RBAC, Attendance, Leave, Payroll, Loans, Projects/Tasks, Messaging/Notifications, Settings/Config

---

*This document describes the NexHRMS payroll system as implemented. For questions or updates, refer to the source code in `src/store/payroll.store.ts` and `src/app/[role]/payroll/`.*
