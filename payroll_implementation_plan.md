# NexHRMS — Complete Payroll System Implementation Plan

## Overview

Professional payroll management system for Philippine-based companies, following **DOLE**, **BIR**, **SSS**, **PhilHealth**, and **Pag-IBIG** regulations. Supports admin, HR, finance, and payroll_admin roles with full employee self-service.

---

## 1. Payslip Lifecycle (Status Flow)

```
  ┌──────────┐    ┌───────────┐    ┌───────────┐    ┌────────┐    ┌──────────────┐
  │  ISSUED   │───▶│ CONFIRMED │───▶│ PUBLISHED │───▶│  PAID  │───▶│ ACKNOWLEDGED │
  │ (Draft)   │    │ (HR/Admin)│    │ (Released) │    │(Finance)│   │ (Employee)   │
  └──────────┘    └───────────┘    └───────────┘    └────────┘    └──────────────┘
       ▲                                                  │              │
       │                                                  │              │
  Admin/HR/Finance                                 Employee signs   Employee confirms
  creates payslip                                  (signature pad)  receipt of payment
```

### Status Definitions
| Status | Description | Who Triggers |
|--------|-------------|-------------|
| `issued` | Payslip created with computed values | Admin / HR / Finance |
| `confirmed` | Reviewed and verified by HR/Admin | Admin / HR |
| `published` | Released to employee (visible in "My Payslips") | Admin / HR |
| `paid` | Payment executed (bank transfer, GCash, cash, check) | Finance |
| `acknowledged` | Employee signed + confirmed receipt | Employee |

---

## 2. Payroll Run Processing (Batch Workflow)

```
  ┌───────┐    ┌───────────┐    ┌────────┐    ┌───────────┐    ┌────────┐
  │ DRAFT │───▶│ VALIDATED │───▶│ LOCKED │───▶│ PUBLISHED │───▶│  PAID  │
  └───────┘    └───────────┘    └────────┘    └───────────┘    └────────┘
                                     │
                              Policy Snapshot
                              captured here
                              (IMMUTABLE)
```

### Run Actions
| Step | Action | Effect |
|------|--------|--------|
| **Draft** | Create run from issued payslips | Groups payslips by issuance date |
| **Validate** | Pre-check totals and deductions | Flags discrepancies |
| **Lock** | Freeze run + capture policy snapshot | No more edits allowed; tax/SSS/PhilHealth versions recorded |
| **Publish** | Release to employees | Auto-publishes all confirmed payslips in run |
| **Mark Paid** | Record bank disbursement | Marks all payslips as paid |

---

## 3. Philippine Government Deductions

### 3.1 SSS (Social Security System) — 2025/2026
- Employee share: **4.5%** of monthly salary credit
- Minimum: ₱180 (≤₱4,250) / Maximum: ₱1,350 (≥₱29,750)
- Employer share: 8.5% (tracked separately)

### 3.2 PhilHealth — 2025/2026
- Rate: **5%** of monthly basic salary, split 50/50
- Employee share: **2.5%**
- Minimum: ₱250 (≤₱10,000) / Maximum: ₱2,500 (≥₱100,000)

### 3.3 Pag-IBIG (HDMF) — 2025/2026
- Employee share: **2%** of salary (if >₱1,500), capped at **₱100/month**
- Below ₱1,500: 1%

### 3.4 BIR Withholding Tax (TRAIN Law 2023+)
| Monthly Taxable Income | Tax Rate |
|----------------------|----------|
| ≤ ₱20,833 | 0% (exempt) |
| ₱20,834 – ₱33,333 | 15% of excess |
| ₱33,334 – ₱66,667 | ₱1,875 + 20% of excess |
| ₱66,668 – ₱166,667 | ₱8,542 + 25% of excess |
| ₱166,668 – ₱666,667 | ₱33,542 + 30% of excess |
| > ₱666,667 | ₱183,542 + 35% of excess |

**Taxable Income** = Gross − SSS − PhilHealth − Pag-IBIG

### 3.5 Government Deduction Timing (Configurable)
- `deductGovFrom`: `"first"` | `"second"` | `"both"`
- Semi-monthly: can deduct from 1st cutoff, 2nd cutoff, or split across both

---

## 4. Payslip Computation Formula

```
Per Payslip:
  Base Pay       = Monthly Salary ÷ Frequency Factor
  + Overtime Pay = OT Hours × Hourly Rate × 1.25 (regular OT)
  + Night Diff   = Night Hours × Hourly Rate × 0.10
  + Holiday Pay  = DOLE multiplier × Daily Rate (per holiday in period)
  + Allowances   = Manual input (meal, transport, etc.)
  ─────────────────────────────────────────────
  = Total Gross

  − SSS Employee Share
  − PhilHealth Employee Share
  − Pag-IBIG Employee Share
  − BIR Withholding Tax (on taxable income)
  − Loan Deductions (auto from active loans)
  − Other Deductions (manual)
  ─────────────────────────────────────────────
  = NET PAY
```

### Holiday Pay Multipliers (DOLE)
| Scenario | Regular Holiday | Special Holiday |
|----------|----------------|-----------------|
| Worked | 200% | 130% |
| Worked + OT | 260% | 169% |
| Rest Day | 260% | 150% |
| Rest Day + OT | 338% | 195% |
| Not Worked | 100% (paid) | 0% (no pay) |

---

## 5. Employee Signature & Acknowledgement Flow

### Process
1. **Payslip Published** → Employee can view in "My Payslips"
2. **Employee Signs** → Draws signature on canvas pad → stored as PNG data URL
3. **Payment Recorded** → Finance marks as paid (method + reference)
4. **Employee Acknowledges** → Clicks "I Confirm Receipt" (requires signature + paid status)
5. **Admin Verification** → Admin/HR/Finance can view signatures in Signed column

### What Admin/HR/Finance Can See
- ✅ Signature image for each payslip
- ✅ Signed date/time
- ✅ Acknowledged date/time  
- ✅ Payment method and bank reference
- ✅ Confirmed by (finance person who recorded payment)

---

## 6. Tabs & Features (Admin/HR/Finance View)

### Tab 1: Payslips
- Complete payslip table with search, status filter, date filter
- Inline status transition buttons (confirm → publish → record payment)
- View payslip detail with full breakdown
- View employee signature
- Pagination (20 per page)

### Tab 2: Payroll Runs
- Batch processing dashboard
- Run lifecycle buttons (draft → validate → lock → publish → paid)
- Policy snapshot viewer (locked tax/SSS/PhilHealth versions)
- Bank file export (CSV)

### Tab 3: Management (Finance)
- PayslipTable component for marking payments
- Filter by published/paid/unsigned
- Bulk "Mark as Paid" with payment method selection

### Tab 4: Adjustments
- Prior-period adjustment workflow
- Create new adjustment dialog (employee, type, amount, reason, reference payslip)
- Approval workflow: pending → approved → applied (creates adjustment payslip)

### Tab 5: Final Pay
- Resignation settlement computations
- Create final pay dialog (employee, pro-rated salary, OT, leave payout, loan balance)
- Automatic computation from employee data

### Tab 6: Settings
- Pay schedule configuration (frequency, cutoff dates, pay days)
- Government deduction timing (first/second/both)
- Night differential hours configuration

---

## 7. Employee Self-Service View

### Features
- Summary cards: Total payslips, Total earned, Latest net pay
- My Payslips table (only published + above)
- Payslip detail with full PH deduction breakdown
- Digital signature pad
- Receipt acknowledgement button
- Payslip print/download (professional format)

---

## 8. 13th Month Pay (DOLE Mandatory)

### Rules
- **Mandatory** for all rank-and-file employees
- Formula: `(Total Basic Salary Earned in Year) ÷ 12`
- Pro-rated for mid-year joiners: `(Monthly Salary × Months Worked) ÷ 12`
- **Tax-exempt** up to ₱90,000 (TRAIN Law)
- Must be paid on or before **December 24**

---

## 9. Final Pay Computation

### Components
| Item | Calculation | Source |
|------|-------------|--------|
| Pro-rated Salary | Daily rate × days worked in final month | Employee salary ÷ days in month |
| Unpaid Overtime | OT hours × hourly rate × 1.25 | Attendance logs |
| Leave Cash-out | Remaining leave days × daily rate | Leave balances |
| 13th Month (pro-rated) | Months worked ÷ 12 × monthly salary | Employee record |
| − Loan Balance | Full remaining loan balance | Loans store |
| = **Net Final Pay** | | |

### Timeline (DOLE Advisory)
- Final pay must be released within **30 days** from date of separation

---

## 10. Configurable Settings

| Setting | Default | Modifiable |
|---------|---------|-----------|
| Pay Frequency | Semi-monthly | ✅ monthly / semi_monthly / bi_weekly / weekly |
| 1st Cutoff Day | 15th | ✅ 1–28 |
| 1st Period Payday | 20th | ✅ |
| 2nd Period Payday | 5th (next month) | ✅ |
| Monthly Payday | 30th | ✅ |
| Gov't Deduction Timing | 2nd cutoff | ✅ first / second / both |
| Night Diff Start | 22:00 | ✅ |
| Night Diff End | 06:00 | ✅ |

---

## 11. Reports (Government Remittance)

| Report | Purpose | Format |
|--------|---------|--------|
| SSS Contribution List | Monthly SSS remittance | CSV |
| PhilHealth Remittance | Monthly PhilHealth | CSV |
| Pag-IBIG Remittance | Monthly Pag-IBIG | CSV |
| BIR 1601-C Summary | Monthly withholding tax | CSV |
| Payroll Register | Complete payroll summary | CSV |
| Bank Disbursement File | Payment file for bank | CSV |

---

## 12. Permissions Matrix

| Permission | Admin | HR | Finance | Payroll Admin | Employee |
|-----------|-------|-----|---------|--------------|----------|
| View all payslips | ✅ | ✅ | ✅ | ✅ | ❌ |
| View own payslips | ✅ | ✅ | ✅ | ✅ | ✅ |
| Issue payslips | ✅ | ✅ | ✅ | ✅ | ❌ |
| Confirm payslips | ✅ | ✅ | ✅ | ✅ | ❌ |
| Publish payslips | ✅ | ✅ | ✅ | ✅ | ❌ |
| Lock payroll runs | ✅ | ❌ | ✅ | ✅ | ❌ |
| Record payments | ✅ | ❌ | ✅ | ✅ | ❌ |
| Sign payslip | ❌ | ❌ | ❌ | ❌ | ✅ |
| Acknowledge receipt | ❌ | ❌ | ❌ | ❌ | ✅ |
| Reset data | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 13. Database Tables

### Existing (Supabase)
- `payslips` — Individual payslip records with earnings/deductions/signature
- `payroll_runs` — Batch processing records with policy snapshots
- `payroll_adjustments` — Prior-period correction records
- `final_pay_computations` — Resignation settlement records
- `pay_schedule_config` — Payment frequency and cutoff configuration
- `loan_deductions` — Per-payslip loan deduction records
- `gov_table_versions` — SSS/PhilHealth/Pag-IBIG/Tax table versions

---

## Implementation Checklist

- [x] Payslip lifecycle (issued → confirmed → published → paid → acknowledged)
- [x] PH government deductions (SSS, PhilHealth, Pag-IBIG, Tax)
- [x] Payroll run processing (draft → validated → locked → published → paid)
- [x] Policy snapshots at lock time
- [x] 13th month pay generation
- [x] Final pay computation
- [x] Digital signature pad
- [x] Employee self-service view
- [x] Holiday pay (DOLE multipliers)
- [x] Loan deduction integration
- [x] Bank file export
- [x] Audit logging
- [x] Notification dispatch
- [ ] **Search, filter, pagination on payslip tables**
- [ ] **Create Adjustment dialog**
- [ ] **Compute Final Pay dialog**
- [ ] **Pay Schedule Settings tab**
- [ ] **Overtime & Night Differential in payslip issuance**
- [ ] **Printable/downloadable payslip (professional PH format)**
- [ ] **Government remittance reports (SSS, PhilHealth, Pag-IBIG, BIR)**
- [ ] **Bulk confirm/publish/pay operations**
- [ ] **Date range filter on admin table**
- [ ] **Improved employee view with download/print**
