# Loan Management Module Specification

## Overview

This module adds support for the following loan and advance types:

### Internal Loans

* Company Loan
* Cash Advance

### Government Loans

* SSS Salary Loan
* SSS Calamity Loan
* Pag-IBIG Multi-Purpose Loan (MPL)
* Pag-IBIG Calamity Loan

The system must support both Employee View and HR/Admin View.

---

# Module Structure

## Loans & Advances

### Tabs

* Company Loans
* Cash Advances
* Government Loans

Government Loans contains:

* SSS Salary Loan
* SSS Calamity Loan
* Pag-IBIG Multi-Purpose Loan
* Pag-IBIG Calamity Loan

---

# Employee View

## Available Actions

### Company Loan

Employee can:

* Submit Loan Request
* View Request Status
* View Active Loans
* View Deduction History

### Cash Advance

Employee can:

* Submit Cash Advance Request
* View Request Status
* View Active Advances
* View Deduction History

### Government Loans

Employee can:

* Submit SSS Loan Record
* Submit Pag-IBIG Loan Record
* View Submitted Records

Note:

Government loans are typically processed externally through SSS or Pag-IBIG.

The HRIS only records and tracks deductions.

No approval workflow is required unless company policy requires it.

---

# HR/Admin View

## Company Loans

### KPI Cards

* Active Loans
* Outstanding Balance
* Settled Loans

### Actions

* Create Loan
* Approve Loan Request
* Reject Loan Request
* Edit Loan
* Mark as Settled

### Tables

#### Loan Accounts

Columns:

* Employee
* Loan Amount
* Monthly Amortization
* Outstanding Balance
* Status
* Start Date

#### Repayment Schedule

Columns:

* Payroll Period
* Scheduled Amount
* Status

#### Deduction History

Columns:

* Payroll Date
* Deduction Amount
* Remaining Balance

---

## Cash Advances

### KPI Cards

* Active Advances
* Outstanding Balance
* Pending Approval
* Settled Advances

### Actions

* Create Cash Advance
* Approve Request
* Reject Request
* Edit Record

### Table

Columns:

* Employee
* Amount
* Monthly Deduction
* Outstanding Balance
* Status
* Release Date

### Deduction History

Columns:

* Payroll Date
* Deduction Amount
* Remaining Balance

---

## Government Loans

### KPI Cards

* Active Government Loans
* Outstanding Balance
* Monthly Deductions
* Settled Loans

### Table

Columns:

* Employee
* Agency
* Loan Type
* Loan Amount
* Monthly Amortization
* Outstanding Balance
* Status

Agency Values:

* SSS
* Pag-IBIG

Loan Type Values:

SSS:

* Salary Loan
* Calamity Loan

Pag-IBIG:

* Multi-Purpose Loan
* Calamity Loan

### Deduction History

Columns:

* Payroll Date
* Deduction Amount
* Remaining Balance

---

# Workflow

## Company Loan Workflow

Employee:

* Submit Loan Request

System:

* Status = Pending

HR:

* Review Request

Possible Outcomes:

### Approved

Status Flow:

Pending → Approved → Active → Settled

### Rejected

Status Flow:

Pending → Rejected

---

## Cash Advance Workflow

Employee:

* Submit Cash Advance Request

System:

* Status = Pending

HR:

* Review Request

Possible Outcomes:

### Approved

Status Flow:

Pending → Approved → Active → Settled

### Rejected

Status Flow:

Pending → Rejected

---

## Government Loan Workflow

Employee:

* Submit Loan Record

Examples:

* SSS Salary Loan
* SSS Calamity Loan
* Pag-IBIG MPL
* Pag-IBIG Calamity

System:

* Record immediately appears in Admin View

No approval workflow required by default.

Status Flow:

Submitted → Active → Settled

---

# Create Company Loan Form

Fields:

* Employee *
* Loan Amount *
* Interest Rate (%)
* Monthly Amortization *
* Start Deduction Date *
* Deduction Frequency *
* Remarks

Deduction Frequency:

* Every Payroll
* First Payroll of Month
* Last Payroll of Month

---

# Create Cash Advance Form

Fields:

* Employee *
* Cash Advance Amount *
* Monthly Deduction *
* Start Deduction Date *
* Deduction Frequency *
* Remarks

Deduction Frequency:

* Every Payroll
* First Payroll of Month
* Last Payroll of Month

---

# Create Government Loan Form

Fields:

* Employee *
* Agency *
* Loan Type *
* Loan Amount *
* Monthly Amortization *
* Outstanding Balance *
* Release Date *
* First Deduction Date *
* Reference Number
* Remarks

Agency:

* SSS
* Pag-IBIG

Loan Type Options

If Agency = SSS:

* Salary Loan
* Calamity Loan

If Agency = Pag-IBIG:

* Multi-Purpose Loan
* Calamity Loan

---

# Payroll Integration

## Payroll Frequency

Semi-Monthly

Payroll Dates:

* 15th
* 30th

---

# Deduction Frequency Rules

## Every Payroll

Monthly Amortization is split equally across payrolls.

Example:

Monthly Amortization = ₱2,000

15th Payroll:
₱1,000

30th Payroll:
₱1,000

Total Monthly Deduction:
₱2,000

Formula:

Per Payroll Deduction = Monthly Amortization / 2

---

## First Payroll of Month

Example:

Monthly Amortization = ₱2,000

15th Payroll:
₱2,000

30th Payroll:
₱0

Formula:

Deduct full amount on first payroll period.

---

## Last Payroll of Month

Example:

Monthly Amortization = ₱2,000

15th Payroll:
₱0

30th Payroll:
₱2,000

Formula:

Deduct full amount on last payroll period.

---

# Loan Calculation Rules

## Cash Advance

Outstanding Balance:

Outstanding Balance = Cash Advance Amount - Total Deductions

Status:

If Outstanding Balance <= 0:

* Settled

Else:

* Active

---

## Company Loan

If Interest Rate exists:

Total Repayable = Principal + (Principal × Interest Rate)

Outstanding Balance = Total Repayable - Total Deductions

If no interest:

Outstanding Balance = Principal - Total Deductions

Status:

If Outstanding Balance <= 0:

* Settled

Else:

* Active

---

## Government Loans

Includes:

* SSS Salary Loan
* SSS Calamity Loan
* Pag-IBIG MPL
* Pag-IBIG Calamity

The HRIS does not calculate agency loan schedules.

The HRIS only tracks:

* Loan Amount
* Monthly Amortization
* Deductions Made
* Outstanding Balance

Formula:

Outstanding Balance = Loan Amount - Total Deductions

Status:

If Outstanding Balance <= 0:

* Settled

Else:

* Active

---

# Payroll Deduction Processing

When payroll is generated:

1. Load all active loans.
2. Determine deduction amount based on Deduction Frequency.
3. Apply deductions.
4. Create deduction history records.
5. Update outstanding balances.
6. Mark loan as Settled when balance reaches zero.

---

# Clean-up

1. Read and check all the related files.
2. Move any files to its supposed to be location. For example, if there's already an existing component folder, move the seperated component folder to that initial one.

