# Loan Management Framework (HRM/HRIS Specification)

This document outlines the system architecture, frontend requirements, and operational workflows for processing **government loans**, **cash advances**, and **company loans** within the SorenHRMS platform.

---

## Table of Contents

1. [Government Loans Overview](#1-government-loans-overview)
2. [Database Schema](#2-database-schema)
3. [Frontend Form Fields — Employee Self-Service (ESS)](#3-frontend-form-fields--employee-self-service-ess)
4. [Operational Workflow](#4-operational-workflow)
5. [Payroll Engine Integration](#5-payroll-engine-integration)
6. [Government Remittance Reporting](#6-government-remittance-reporting)
7. [Employee Separation & Offboarding](#7-employee-separation--offboarding)
8. [Cash Advance Module](#8-cash-advance-module)
9. [Company Loan Module](#9-company-loan-module)

---

## 1. Government Loans Overview

Covers four primary government loan archetypes applicable to Philippine-based employees:

| # | Loan Type | Agency |
|---|-----------|--------|
| 1 | SSS Salary Loan | Social Security System |
| 2 | SSS Calamity Loan | Social Security System |
| 3 | Pag-IBIG Multi-Purpose Loan (MPL) | Home Development Mutual Fund (HDMF) |
| 4 | Pag-IBIG Calamity Loan | Home Development Mutual Fund (HDMF) |

> ⚠️ **Note:** Philippine government agencies (SSS, Pag-IBIG/HDMF) do not currently expose open public APIs for automated loan approvals or real-time balance queries. All verification must be done manually through their employer portals (**My.SSS Employer Portal** and **Virtual Pag-IBIG Employer Portal**).

---

## 2. Database Schema

### 2.1 Government Loans Table

```sql
CREATE TABLE government_loans (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    employee_id           INT NOT NULL,
    loan_type             ENUM('SSS_SALARY', 'SSS_CALAMITY', 'PAGIBIG_MPL', 'PAGIBIG_CALAMITY') NOT NULL,
    transaction_ref_no    VARCHAR(50) NOT NULL,          -- SSS Transaction No. / Pag-IBIG Loan Account No.
    total_principal_amount DECIMAL(10, 2) NOT NULL,
    monthly_amortization  DECIMAL(10, 2) NOT NULL,
    loan_approval_date    DATE NOT NULL,
    loan_term_months      INT DEFAULT 24,                -- Standard term: 24 months (2 years)
    deduction_start_month VARCHAR(7) NOT NULL,           -- Format: YYYY-MM
    remaining_balance     DECIMAL(10, 2) NOT NULL,
    status                ENUM('PENDING_VERIFICATION', 'ACTIVE', 'FULLY_PAID', 'SEPARATED', 'REJECTED') DEFAULT 'PENDING_VERIFICATION',
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);
```

**Schema Review Notes:**

- `transaction_ref_no` should have a `UNIQUE` constraint scoped per `loan_type` to avoid duplicate entries from re-submissions.
- Consider adding a `verified_by` column (FK to `users`) and `verified_at` timestamp for audit trail purposes.
- `loan_term_months` defaults to 24 but SSS/Pag-IBIG sometimes offer 12-month terms — the UI should allow the HR admin to override this during verification.
- `remaining_balance` is initialized to equal `total_principal_amount` on record creation and is decremented after each payroll cycle.

---

## 3. Frontend Form Fields — Employee Self-Service (ESS)

### 3.1 Input Fields

| Field Name | Input Type | Validation Rules / UI Behavior |
|:-----------|:-----------|:-------------------------------|
| **Loan Type** | `select` | Required. Options: SSS Salary, SSS Calamity, Pag-IBIG MPL, Pag-IBIG Calamity. |
| **Transaction / Loan Account Number** | `text` | Required. Alphanumeric only. Critical for matching government billing sheets (PRN/STL). |
| **Total Loan Amount Approved** | `number` | Required. Min: `1.00`. Step: `0.01`. |
| **Monthly Amortization** | `number` | Required. Min: `1.00`. Step: `0.01`. |
| **Loan Approval Date** | `date` | Required. Must not be a future date. |
| **Deduction Start Month** | `month` | Required. Format: `YYYY-MM`. Should default to the month *after* the approval date. |

### 3.2 Real-Time Deduction Summary Panel (Client-Side Preview)

Before submission, the form must render a read-only **Deduction Summary Panel**:

| Preview Field | Computed Value |
|:--------------|:---------------|
| **Estimated Per-Cutoff Deduction** | `Monthly Amortization ÷ 2` (standard semi-monthly payroll cycle) |
| **Calculated End Month** | `Deduction Start Month + loan_term_months` |
| **Total Deduction Estimate** | `Monthly Amortization × loan_term_months` |

### 3.3 Authorization Checkbox (Mandatory)

Before the employee can submit, the following checkbox must be checked:

> *"I authorize [Company Name] to deduct these amounts from my salary and to settle any remaining balance from my final separation pay if I leave the company before full repayment."*

---

## 4. Operational Workflow

Because SSS and Pag-IBIG do not provide public APIs, a **Three-Phase Verification Loop** is required.

```
[Phase 1]                    [Phase 2]                    [Phase 3]
Employee applies on     →    Employee logs details    →    HR Admin cross-checks
SSS/Pag-IBIG portal          in HRM ESS portal             on government portal
                                                                   ↓
[Phase 5]                    [Phase 4]                    HR clicks "Verify & Activate"
Deducted from           ←    Monthly payroll          ←    Status → ACTIVE
separation pay               deductions run
```

### Phase 1 — Government Portal Application (Outside HRM)

1. The employee logs into their personal **My.SSS** or **Virtual Pag-IBIG** portal and submits their loan application.
2. Employer certification:
   - **SSS:** HR admin receives a certification prompt inside the **My.SSS Employer Portal**. The employer has **3 working days** to click "Certify".
   - **Pag-IBIG:** HR admin receives a validation notice inside the **Virtual Pag-IBIG Employer Portal** to confirm the employee's active employment status.

### Phase 2 — Internal HRM Logging

1. The employee opens the ESS portal and fills in the loan form (see Section 3).
2. A record is created in `government_loans` with status `PENDING_VERIFICATION`.

### Phase 3 — Administrative Verification & Activation

1. The HR/Payroll admin opens the HRM admin panel and reviews the pending loan record.
2. The admin cross-references the submitted data against the official loan disclosures on the government portal.
3. If data matches, admin clicks **"Verify & Activate"**, changing the record status to `ACTIVE` and hooking it into the payroll cycle.
4. If data does not match, admin clicks **"Reject"** and adds a note. The employee is notified via the ESS portal.

---

## 5. Payroll Engine Integration

### 5.1 Semi-Monthly Split Logic

During each payroll run, the engine fetches all `ACTIVE` government loans for the employee and applies a semi-monthly split.

```js
/**
 * Calculates government loan deductions for a given employee in the current payroll cut.
 * @param {number} employeeId
 * @param {Object} db - Database query interface
 * @returns {Promise<Array>} Array of deduction line items
 */
async function calculateLoanDeductions(employeeId, db) {
  const activeLoans = await db.query(
    `SELECT * FROM government_loans WHERE employee_id = ? AND status = 'ACTIVE'`,
    [employeeId]
  );

  const deductions = [];

  for (const loan of activeLoans) {
    // Standard semi-monthly split
    let cutoffDeduction = loan.monthly_amortization / 2;

    // Guard rail: prevent over-deduction on the final payment
    if (cutoffDeduction > loan.remaining_balance) {
      cutoffDeduction = loan.remaining_balance;
    }

    deductions.push({
      loanId: loan.id,
      type: loan.loan_type,
      ref: loan.transaction_ref_no,
      amount: cutoffDeduction,
    });
  }

  return deductions;
}
```

### 5.2 Post-Payroll Balance Update & Auto-Stop

After payroll disbursement is locked, the system must update each loan's remaining balance and trigger auto-completion:

```js
/**
 * Updates remaining balances after a payroll cut is finalized.
 * Automatically marks loans as FULLY_PAID when balance reaches zero.
 * @param {Array} processedDeductions - Output from calculateLoanDeductions
 * @param {Object} db
 */
async function finalizePayrollDeductions(processedDeductions, db) {
  for (const deduction of processedDeductions) {
    await db.query(
      `UPDATE government_loans
       SET remaining_balance = GREATEST(0, remaining_balance - ?),
           status = CASE WHEN (remaining_balance - ?) <= 0 THEN 'FULLY_PAID' ELSE status END,
           updated_at = NOW()
       WHERE id = ?`,
      [deduction.amount, deduction.amount, deduction.loanId]
    );
  }
}
```

> ⚠️ **Correction from original spec:** The original used a Python snippet with `db.query(string, employee_id)`. The above JS implementation uses parameterized queries (`?` placeholders) to prevent SQL injection. Always use parameterized queries.

### 5.3 Net Take-Home Pay Rule

The payroll engine must validate deduction stacking against labor law guardrails:

- Statutory deductions (SSS contributions, PhilHealth, Pag-IBIG, withholding tax) are deducted **first**.
- Loan amortizations are deducted from the **residual** take-home pay.
- The final net pay must **never drop below zero**. If it does, loan deductions must be deferred to the next payroll cut or flagged for HR intervention.
- Company policy may define a **minimum net take-home pay floor** (e.g., ₱5,000/cut) that overrides the zero-floor.

---

## 6. Government Remittance Reporting

### 6.1 SSS — Loan Collection List (LCL) / PRN Mapping

- Aggregate all SSS Salary and SSS Calamity deductions for the calendar month into a summary ledger.
- The admin pastes the **SSS Loan Payment Reference Number (PRN)** generated from the My.SSS portal to bind the internal ledger to the cloud payment transaction.
- Export format: spreadsheet-compatible (.xlsx) with columns: `Employee Name`, `SS Number`, `Loan Type`, `Reference No.`, `Monthly Amortization`, `Period Covered`.

### 6.2 Pag-IBIG — Short-Term Loan (STL) Remittance

- Generate a downloadable file matching Pag-IBIG's required STL electronic submission format.
- Both **Pag-IBIG MPL** and **Pag-IBIG Calamity** deductions are included, separated by their individual **Loan Account Numbers**.
- File format must comply with HDMF's current required layout (CSV or fixed-width, as prescribed by HDMF at time of implementation — verify against the latest HDMF Employer Guidelines).

---

## 7. Employee Separation & Offboarding

When an employee's status changes to `Resigned` or `Terminated` while any government loan is `ACTIVE`, the company is legally obligated by SSS and Pag-IBIG to recover the outstanding balance from final pay.

### 7.1 Separation Workflow

1. **Clearance Trigger:** Updating employee status to `Resigned` or `Terminated` automatically triggers a scan of `government_loans` for any `ACTIVE` records.
2. **Balance Extraction:** The system fetches the true `remaining_balance` for all active loans.
3. **Final Pay Integration:** A non-split, lump-sum deduction line is appended to the Final Separation Pay calculation:

$$\text{Final Loan Deduction} = \sum \text{remaining\_balance for all ACTIVE loans}$$

4. **Status Update:** Once the final pay is locked and approved, the system sets the loan status to `SEPARATED`, indicating the balance has been internally recovered and is ready for final government remittance.

> ⚠️ The `SEPARATED` status must NOT be confused with `FULLY_PAID`. `FULLY_PAID` means the loan was repaid through regular payroll. `SEPARATED` means the residual was deducted from separation pay — the company still needs to remit this to SSS/Pag-IBIG through their employer portals.

---

## 8. Cash Advance Module

Cash advances are internal, non-government short-term salary advances. They follow a separate approval workflow and integrate directly with the payroll engine.

### 8.1 Database Schema

```sql
CREATE TABLE cash_advances (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    employee_id           INT NOT NULL,
    requested_amount      DECIMAL(10, 2) NOT NULL,
    approved_amount       DECIMAL(10, 2),               -- May differ from requested (partial approvals)
    purpose               TEXT,                          -- Brief reason for the request
    repayment_scheme      ENUM('FULL_NEXT_CUT', 'INSTALLMENT') DEFAULT 'FULL_NEXT_CUT',
    installment_months    INT DEFAULT 1,                 -- Used only if scheme is INSTALLMENT
    monthly_deduction     DECIMAL(10, 2),               -- Computed on approval
    remaining_balance     DECIMAL(10, 2),               -- Initialized to approved_amount on approval
    deduction_start_month VARCHAR(7),                   -- Format: YYYY-MM; set on approval
    status                ENUM('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'FULLY_PAID', 'CANCELLED') DEFAULT 'PENDING',
    requested_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at           TIMESTAMP,
    reviewed_by           INT,                          -- FK to users (HR/Manager who approved)
    rejection_reason      TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);
```

### 8.2 ESS Form Fields — Employee Request

| Field Name | Input Type | Validation Rules |
|:-----------|:-----------|:-----------------|
| **Requested Amount** | `number` | Required. Min: `100.00`. Step: `0.01`. |
| **Purpose / Reason** | `textarea` | Required. Max: 500 characters. |
| **Preferred Repayment Scheme** | `radio` | Options: `Full deduction on next cut`, `Installment (spread over multiple cuts)`. |
| **Number of Installment Months** | `number` | Shown only if Installment is selected. Min: `1`, Max: `6` (or per company policy). |

> 💡 The system should display the employee's **last 3 months of net pay** and **any active loan/advance balances** as context to aid the approver.

### 8.3 Approval Workflow

```
Employee submits request
        ↓
Status: PENDING
        ↓
HR/Immediate Supervisor reviews in Admin Panel
  ├── Approves (full or partial amount)
  │       ↓
  │   HR sets: approved_amount, repayment_scheme, deduction_start_month
  │   System computes: monthly_deduction = approved_amount / installment_months
  │   Status → ACTIVE (enters payroll cycle immediately)
  │
  └── Rejects
          ↓
      rejection_reason is recorded
      Status → REJECTED
      Employee notified via ESS
```

### 8.4 Admin Panel Fields (On Review)

| Field Name | Input Type | Notes |
|:-----------|:-----------|:------|
| **Approved Amount** | `number` | Can be less than or equal to requested amount. |
| **Repayment Scheme** | `select` | Override or confirm employee's preference. |
| **Number of Months** | `number` | Set if installment. |
| **Deduction Start Month** | `month` | Defaults to next payroll cut month. |
| **Rejection Reason** | `textarea` | Required only on rejection. |

### 8.5 Payroll Integration

```js
/**
 * Calculates cash advance deductions for the current payroll cut.
 * @param {number} employeeId
 * @param {Object} db
 * @returns {Promise<Array>}
 */
async function calculateCashAdvanceDeductions(employeeId, db) {
  const advances = await db.query(
    `SELECT * FROM cash_advances WHERE employee_id = ? AND status = 'ACTIVE'`,
    [employeeId]
  );

  const deductions = [];

  for (const advance of advances) {
    // Full deduction on next cut
    if (advance.repayment_scheme === 'FULL_NEXT_CUT') {
      deductions.push({
        advanceId: advance.id,
        type: 'CASH_ADVANCE',
        amount: advance.remaining_balance,
      });
    }

    // Installment: deduct monthly_deduction per cut (not split semi-monthly unless policy requires)
    if (advance.repayment_scheme === 'INSTALLMENT') {
      const deductionAmount = Math.min(
        advance.monthly_deduction,
        advance.remaining_balance
      );
      deductions.push({
        advanceId: advance.id,
        type: 'CASH_ADVANCE_INSTALLMENT',
        amount: deductionAmount,
      });
    }
  }

  return deductions;
}
```

> ⚠️ **Policy note:** Some companies deduct cash advances only on the **2nd cutoff of the month** (the 30th payout) to avoid back-to-back deductions confusing the employee. This can be enforced by adding a `deduction_cut` field: `ENUM('FIRST', 'SECOND', 'BOTH')`.

---

## 9. Company Loan Module

Company loans are mid-to-long-term internal financing extended by the employer (e.g., emergency loans, salary loans, laptop/equipment loans). Unlike cash advances, these typically require a more formal multi-level approval chain and may accrue interest.

### 9.1 Database Schema

```sql
CREATE TABLE company_loans (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    employee_id           INT NOT NULL,
    loan_category         ENUM('EMERGENCY', 'SALARY_LOAN', 'EQUIPMENT', 'EDUCATIONAL', 'OTHER') NOT NULL,
    loan_category_note    VARCHAR(100),                 -- Used when category = 'OTHER'
    requested_amount      DECIMAL(10, 2) NOT NULL,
    approved_amount       DECIMAL(10, 2),
    interest_rate_pct     DECIMAL(5, 2) DEFAULT 0.00,  -- Annual interest rate (0 if interest-free)
    total_repayable       DECIMAL(10, 2),               -- Computed: principal + interest
    monthly_amortization  DECIMAL(10, 2),               -- Computed on approval
    loan_term_months      INT NOT NULL,
    deduction_start_month VARCHAR(7),                   -- Format: YYYY-MM
    remaining_balance     DECIMAL(10, 2),
    purpose               TEXT NOT NULL,
    supporting_docs       JSON,                         -- Array of file paths/URLs for attachments
    status                ENUM(
                            'DRAFT',
                            'PENDING_SUPERVISOR',
                            'PENDING_HR',
                            'PENDING_FINANCE',
                            'APPROVED',
                            'REJECTED',
                            'ACTIVE',
                            'FULLY_PAID',
                            'CANCELLED',
                            'SEPARATED'
                          ) DEFAULT 'DRAFT',
    requested_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at           TIMESTAMP,
    rejection_reason      TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Approval audit trail (one row per approval step)
CREATE TABLE company_loan_approvals (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    loan_id               INT NOT NULL,
    approver_id           INT NOT NULL,                 -- FK to users
    approver_role         ENUM('SUPERVISOR', 'HR', 'FINANCE') NOT NULL,
    decision              ENUM('APPROVED', 'REJECTED', 'RETURNED') NOT NULL,
    remarks               TEXT,
    decided_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES company_loans(id),
    FOREIGN KEY (approver_id) REFERENCES users(id)
);
```

### 9.2 ESS Form Fields — Employee Request

| Field Name | Input Type | Validation Rules |
|:-----------|:-----------|:-----------------|
| **Loan Category** | `select` | Required. Options: Emergency, Salary Loan, Equipment, Educational, Other. |
| **Category Note** | `text` | Required only if "Other" is selected. Max: 100 characters. |
| **Requested Amount** | `number` | Required. Min: `500.00`. Step: `0.01`. |
| **Preferred Loan Term (Months)** | `number` | Required. Min: `1`. Max: `36` (or per company policy). |
| **Purpose / Justification** | `textarea` | Required. Min: 50 characters. |
| **Supporting Documents** | `file` (multi-upload) | Optional. Accepted: PDF, JPG, PNG. Max: 5MB per file. |

**Client-Side Preview Panel:**

| Preview Field | Computed Value |
|:--------------|:---------------|
| **Estimated Monthly Deduction** | `Requested Amount × (1 + interest_rate) / term_months` |
| **Estimated Per-Cutoff Deduction** | `Monthly Deduction ÷ 2` |
| **Estimated End Month** | `Deduction Start Month + term_months` |
| **Total Repayable** | `Monthly Deduction × term_months` |

### 9.3 Approval Workflow (Multi-Level)

```
Employee submits application
        ↓
Status: PENDING_SUPERVISOR
        ↓
Immediate Supervisor reviews
  ├── Endorses → Status: PENDING_HR
  └── Rejects → Status: REJECTED (employee notified)
        ↓
HR Admin reviews
  ├── Endorses → Status: PENDING_FINANCE
  └── Rejects → Status: REJECTED (employee notified)
        ↓
Finance Officer reviews
  ├── Approves (sets approved_amount, term, interest_rate, deduction_start_month)
  │       ↓
  │   System computes: total_repayable, monthly_amortization, remaining_balance
  │   Status → APPROVED → ACTIVE (enters payroll cycle on deduction_start_month)
  │
  └── Rejects → Status: REJECTED (employee notified)
```

> 💡 The approval chain can be configurable per company policy. Some companies skip the Finance step for loans below a defined threshold (e.g., loans ≤ ₱10,000 skip Finance review).

### 9.4 Admin Panel Fields (Per Approval Level)

#### Supervisor / HR — Endorsement Screen

| Field | Input Type | Notes |
|:------|:-----------|:------|
| **Decision** | `radio` | Endorse / Reject / Return for Revision |
| **Remarks** | `textarea` | Required on Reject or Return. |

#### Finance — Final Approval Screen

| Field | Input Type | Notes |
|:------|:-----------|:------|
| **Approved Amount** | `number` | Can be less than or equal to requested. |
| **Loan Term (Months)** | `number` | May differ from employee's preference. |
| **Annual Interest Rate (%)** | `number` | Default: `0.00` for interest-free. Step: `0.01`. |
| **Deduction Start Month** | `month` | Defaults to next month. |
| **Remarks** | `textarea` | Optional on approval; required on rejection. |

### 9.5 Payroll Integration

```js
/**
 * Calculates company loan deductions for the current payroll cut.
 * @param {number} employeeId
 * @param {Object} db
 * @returns {Promise<Array>}
 */
async function calculateCompanyLoanDeductions(employeeId, db) {
  const loans = await db.query(
    `SELECT * FROM company_loans WHERE employee_id = ? AND status = 'ACTIVE'`,
    [employeeId]
  );

  const deductions = [];

  for (const loan of loans) {
    // Semi-monthly split (same pattern as government loans)
    let cutoffDeduction = loan.monthly_amortization / 2;

    // Guard rail: avoid over-deduction on final payment
    if (cutoffDeduction > loan.remaining_balance) {
      cutoffDeduction = loan.remaining_balance;
    }

    deductions.push({
      loanId: loan.id,
      type: 'COMPANY_LOAN',
      category: loan.loan_category,
      amount: cutoffDeduction,
    });
  }

  return deductions;
}
```

### 9.6 Separation Handling

Follows the same logic as government loans (Section 7). On employee separation:

1. All `ACTIVE` company loans are flagged.
2. `remaining_balance` is deducted from final separation pay as a lump sum.
3. Status is set to `SEPARATED`.

> Unlike government loans, `SEPARATED` for company loans resolves internally — no external remittance to a government agency is needed. Finance simply records the recovery.

---

## 10. Summary: Status Flow Reference

| Status | Government Loan | Cash Advance | Company Loan |
|:-------|:----------------|:-------------|:-------------|
| `DRAFT` | — | — | ✅ |
| `PENDING` / `PENDING_*` | `PENDING_VERIFICATION` | `PENDING` | `PENDING_SUPERVISOR` → `PENDING_HR` → `PENDING_FINANCE` |
| `APPROVED` | (implicit on ACTIVE) | — | ✅ (before ACTIVE) |
| `ACTIVE` | ✅ | ✅ | ✅ |
| `FULLY_PAID` | ✅ | ✅ | ✅ |
| `REJECTED` | ✅ | ✅ | ✅ |
| `SEPARATED` | ✅ | ✅ | ✅ |
| `CANCELLED` | — | ✅ | ✅ |

---

## 11. Key Corrections & Notes from Original Spec

| Item | Original | Correction |
|:-----|:---------|:-----------|
| Language | Python | JavaScript (async/await, parameterized queries) |
| SQL injection risk | `db.query(string, employee_id)` positional arg | Use `?` placeholders in array: `db.query(sql, [id])` |
| `loan_term_months` | Hardcoded 24 | Should be overridable; SSS/Pag-IBIG offer 12-month terms |
| `SEPARATED` vs `FULLY_PAID` | Not differentiated | These are distinct statuses with different remittance implications |
| `UNIQUE` on `transaction_ref_no` | Not mentioned | Should be enforced per `loan_type` to prevent duplicate entries |
| Remittance file format | General mention | HDMF STL format changes periodically — verify against latest HDMF employer guidelines before implementation |
| Net pay floor | "not drop below zero" | Should also respect a company-defined minimum floor (e.g., ₱5,000/cut) |
| Cash advances | Not covered | Added in Section 8 |
| Company loans | Not covered | Added in Section 9 |
