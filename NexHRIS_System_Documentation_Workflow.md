# NexHRIS v2 — System Documentation (Project Manager Reference)

> **System:** NexHRIS (Human Resource Information System) v2  
> **Last Updated:** May 22, 2026  
> **Audience:** Project Managers, Product Owners, Non-Technical Stakeholders

---

## Table of Contents

1. [What is NexHRIS?](#1-what-is-nexhris)
2. [User Roles](#2-user-roles)
3. [Logging In](#3-logging-in)
4. [Page Access by Role](#4-page-access-by-role)
5. [What Each Role Can Do (Per Page)](#5-what-each-role-can-do-per-page)
6. [Process Flows](#6-process-flows)
7. [Kiosk (Self-Service Check-In)](#7-kiosk-self-service-check-in)
8. [Notifications & Messaging](#8-notifications--messaging)
9. [Reports](#9-reports)
10. [Settings & Configuration](#10-settings--configuration)
11. [Quick Reference: Role Summary](#11-quick-reference-role-summary)

---

## 1. What is NexHRIS?

NexHRIS is a web-based Human Resource Information System built for Philippine companies. It handles:

- **Employee Records** — storing and managing employee information
- **Attendance Tracking** — recording clock-in/out via fingerprint, face scan, QR code, or manual entry
- **Leave Management** — filing, approving, and tracking employee leaves
- **Payroll Processing** — computing salaries, government deductions (SSS, PhilHealth, Pag-IBIG, BIR tax), and generating payslips
- **Loan Management** — tracking employee loans and auto-deducting from payroll
- **Performance Reviews** — conducting quarterly/annual employee evaluations
- **Recruitment** — posting jobs and tracking applicants
- **Project & Task Management** — assigning and tracking work
- **Internal Messaging** — communication between employees
- **Disciplinary Records** — logging and tracking employee incidents
- **Audit Trail** — recording all system actions for accountability

The system runs in a web browser (desktop or tablet) and includes a **Kiosk mode** for shared office devices (lobby check-in terminals).

---

## 2. User Roles

NexHRIS has **7 user roles**. Each role determines what pages a user can see and what actions they can perform.

| Role | Who Uses This | What They Do |
|------|--------------|--------------|
| **Admin** | System Administrator, IT Manager, Business Owner | Full control of everything — all pages, all actions, user management, system settings |
| **HR** | HR Officers, HR Managers | Manages employees, attendance, leaves, recruitment, disciplinary actions. Cannot process payroll or manage finances. |
| **Finance** | Accounting Staff, Finance Manager | Processes payroll, manages loans, views government reports, approves salary adjustments. Does not manage attendance or leaves. |
| **Payroll Admin** | Payroll Officer | Similar to Finance but focused on payroll processing. Can generate, lock, and issue payroll. Limited loan management. |
| **Supervisor** | Team Leads, Department Heads | Manages their team — approves overtime, leave requests, reviews timesheets. Cannot access payroll or system settings. |
| **Employee** | All regular staff | Self-service only — views own attendance, files leave requests, views own payslips, tracks own tasks. |
| **Auditor** | Internal/External Auditors | Read-only access to audit logs, reports, employee records, and loan data. Cannot modify anything. |

> [!NOTE]
> **Admin** has unrestricted access to every page and every action. When this document says a feature is available to "HR" or "Finance," it is always also available to Admin.

---

## 3. Logging In

### How Users Log In

1. User goes to the NexHRIS website
2. Enters their **email address** and **password**
3. System verifies credentials
4. System checks if the employee account is **active** (deactivated or resigned accounts are blocked)
5. User is redirected to their **Dashboard** based on their role

### First-Time Login

- When an Admin creates a new user account, they set a temporary password
- On first login, the system **forces the user to change their password** before they can do anything else
- The password change screen cannot be skipped or closed

### Deactivated Accounts

- If an employee's status is changed to "Inactive" or "Resigned" while they are logged in, they are **immediately logged out** and redirected to a "Your account has been deactivated" page
- They cannot log back in until reactivated

### Password Recovery

- Users can request a password reset email from the login page
- Admin can also manually reset a user's password from Settings

---

## 4. Page Access by Role

The table below shows which pages each role can see in the sidebar navigation.

| Page | Admin | HR | Finance | Payroll Admin | Supervisor | Employee | Auditor |
|------|:-----:|:--:|:-------:|:-------------:|:----------:|:--------:|:-------:|
| **Dashboard** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Employees** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **201 Files** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Attendance** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Leave** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Timesheets** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Shifts** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Payroll** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **My Payslips** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Loans** | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ |
| **BIR Compliance** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Gov. Contributions** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Performance** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Disciplinary** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Jobs (Recruitment)** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Projects** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Tasks** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Events** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Messages** | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Notifications** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Reports** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Audit Log** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Settings** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅* | ✅* |
| **Roles & Permissions** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Organization Settings** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Appearance** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Tax Rules** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Face Enrollment** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Kiosk (QR)** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Kiosk (Face)** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Profile** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> \* Employee and Auditor see a limited Settings page (personal preferences only).

---

## 5. What Each Role Can Do (Per Page)

### 5.1 Dashboard

Everyone sees a Dashboard, but the content differs:

| What's Shown | Admin/HR | Finance/Payroll Admin | Supervisor | Employee | Auditor |
|-------------|:--------:|:---------------------:|:----------:|:--------:|:-------:|
| Total employee count | ✅ | ✅ | ❌ | ❌ | ❌ |
| Department breakdown chart | ✅ | ❌ | ❌ | ❌ | ❌ |
| Recent hires | ✅ | ❌ | ❌ | ❌ | ❌ |
| Today's attendance overview | ✅ | ❌ | ✅ (team) | ✅ (self) | ❌ |
| Pending leave requests | ✅ | ❌ | ✅ (team) | ❌ | ❌ |
| Upcoming events | ✅ | ✅ | ✅ | ✅ | ✅ |
| My leave balance | ❌ | ❌ | ✅ | ✅ | ❌ |
| Recent payslips | ❌ | ❌ | ✅ | ✅ | ❌ |
| Task summary | ✅ | ❌ | ✅ | ✅ | ❌ |
| Quick actions (Add Employee, Run Payroll) | ✅ | ✅ (payroll only) | ❌ | ❌ | ❌ |
| Recent system activity | ✅ | ❌ | ❌ | ❌ | ✅ |

---

### 5.2 Employees

| Action | Admin | HR | Finance | Supervisor | Auditor |
|--------|:-----:|:--:|:-------:|:----------:|:-------:|
| View employee list | ✅ | ✅ | ✅ | ✅ | ✅ |
| Search & filter employees | ✅ | ✅ | ✅ | ✅ | ✅ |
| View employee detail page | ✅ | ✅ | ✅ | ✅ | ✅ |
| Add new employee | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit employee information | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete employee | ✅ | ✅ | ❌ | ❌ | ❌ |
| Import employees from CSV | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export employee list | ✅ | ✅ | ✅ | ✅ | ✅ |
| View salary information | ✅ | ❌ | ✅ | ❌ | ❌ |
| Set/approve salary | ✅ | ❌ | ✅ | ❌ | ❌ |
| Propose salary (needs Finance approval) | ❌ | ✅ | — | ❌ | ❌ |
| Change employee status (active/inactive/resigned) | ✅ | ✅ | ❌ | ❌ | ❌ |

**Employee Detail Page — Tabs:**

| Tab | Admin | HR | Finance | Supervisor | Auditor |
|-----|:-----:|:--:|:-------:|:----------:|:-------:|
| Personal Information | ✅ View/Edit | ✅ View/Edit | ✅ View | ✅ View | ✅ View |
| Employment Details | ✅ View/Edit | ✅ View/Edit | ✅ View | ✅ View | ✅ View |
| Government IDs | ✅ View/Edit | ✅ View/Edit | ✅ View | ❌ | ✅ View |
| Compensation & Salary | ✅ View/Edit | ✅ Propose | ✅ View/Approve | ❌ | ❌ |
| Documents | ✅ View/Upload | ✅ View/Upload | ❌ | ❌ | ❌ |
| Attendance History | ✅ View | ✅ View | ❌ | ✅ View (team) | ❌ |
| Leave History | ✅ View | ✅ View | ❌ | ✅ View (team) | ❌ |
| Performance Reviews | ✅ View | ✅ View | ❌ | ✅ View (team) | ❌ |
| Disciplinary Records | ✅ View | ✅ View | ❌ | ❌ | ❌ |
| Loan Records | ✅ View | ❌ | ✅ View | ❌ | ✅ View |

---

### 5.3 Attendance

| Action | Admin | HR | Supervisor | Employee |
|--------|:-----:|:--:|:----------:|:--------:|
| View all employees' attendance | ✅ | ✅ | ✅ (team only) | ❌ |
| View own attendance | ✅ | ✅ | ✅ | ✅ |
| Manually add attendance record | ✅ | ✅ | ❌ | ❌ |
| Edit attendance records | ✅ | ✅ | ❌ | ❌ |
| Approve overtime requests | ✅ | ✅ | ✅ (team) | ❌ |
| Submit overtime request | ❌ | ❌ | ✅ | ✅ |
| Export attendance data | ✅ | ✅ | ✅ | ❌ |
| View attendance exceptions | ✅ | ✅ | ✅ | ❌ |

**Attendance has 4 tabs:**

| Tab | What It Shows |
|-----|---------------|
| **Logs** | Daily attendance records per employee (time in, time out, status) |
| **Events** | Raw check-in/out events (every scan from any device) |
| **Exceptions** | Flagged issues like missing time-in, missing time-out, duplicate scans |
| **OT Requests** | Overtime request queue with approve/reject actions |

---

### 5.4 Leave

| Action | Admin | HR | Supervisor | Employee |
|--------|:-----:|:--:|:----------:|:--------:|
| View all leave requests | ✅ | ✅ | ✅ (team) | ❌ |
| View own leave requests | ✅ | ✅ | ✅ | ✅ |
| File a leave request | ✅ | ✅ | ✅ | ✅ |
| Approve/reject leave requests | ✅ | ✅ | ✅ (team) | ❌ |
| Cancel own leave request | ✅ | ✅ | ✅ | ✅ |
| View leave balances (all employees) | ✅ | ✅ | ✅ (team) | ❌ |
| View own leave balance | ✅ | ✅ | ✅ | ✅ |
| Adjust leave balances manually | ✅ | ✅ | ❌ | ❌ |
| Configure leave types & policies | ✅ | ✅ | ❌ | ❌ |
| Set annual allocation | ✅ | ✅ | ❌ | ❌ |
| View leave calendar | ✅ | ✅ | ✅ | ✅ |

**Leave Types Available:**

| Leave Type | Default Allocation |
|-----------|-------------------|
| Vacation Leave (VL) | 15 days/year |
| Sick Leave (SL) | 10 days/year |
| Emergency Leave (EL) | 5 days/year |
| Maternity Leave (ML) | As per law (105 days) |
| Paternity Leave (PL) | As per law (7 days) |
| Bereavement Leave (BL) | Per company policy |
| Solo Parent Leave (SPL) | As per law (7 days) |
| Special Leave | Per company policy |
| Leave Without Pay (LWOP) | N/A |

---

### 5.5 Payroll

| Action | Admin | Finance | Payroll Admin |
|--------|:-----:|:-------:|:-------------:|
| View payroll runs | ✅ | ✅ | ✅ |
| Create new payroll run | ✅ | ✅ | ✅ |
| Generate payroll (compute salaries) | ✅ | ✅ | ✅ |
| Review individual payslips | ✅ | ✅ | ✅ |
| Lock payroll (freeze for approval) | ✅ | ✅ | ✅ |
| Confirm payslips | ✅ | ✅ | ✅ |
| Publish payslips (make visible to employees) | ✅ | ✅ | ✅ |
| Record payment (mark as paid) | ✅ | ✅ | ❌ |
| Create payroll adjustments | ✅ | ✅ | ✅ |
| Approve adjustments | ✅ | ✅ | ❌ |
| Process final pay (resigned employees) | ✅ | ✅ | ✅ |
| Reset payroll run | ✅ | ❌ | ❌ |
| Configure tax rules | ✅ | ✅ | ✅ |
| View BIR compliance reports | ✅ | ✅ | ✅ |
| View government contribution reports | ✅ | ✅ | ✅ |

---

### 5.6 My Payslips (Employee Self-Service)

Available to: **Supervisor, Employee, Auditor**

| What Users Can Do |
|-------------------|
| View list of their own payslips (sorted by most recent) |
| See pay period, gross pay, deductions, net pay for each payslip |
| Click a payslip to see full breakdown (earnings + deductions) |
| View year-to-date totals |
| Download/print payslip as PDF |
| Sign/acknowledge received payslip |

> [!NOTE]
> Employees can **only** see their own payslips. They cannot see anyone else's salary information.

---

### 5.7 Loans

| Action | Admin | Finance | Payroll Admin | Employee |
|--------|:-----:|:-------:|:-------------:|:--------:|
| View all loans | ✅ | ✅ | ✅ (view only) | ❌ |
| View own loans | ✅ | ✅ | ✅ | ✅ |
| Apply for a loan | ❌ | ❌ | ❌ | ✅ |
| Approve/reject loan applications | ✅ | ✅ | ❌ | ❌ |
| View payment schedule | ✅ | ✅ | ✅ | ✅ (own) |
| View payment history | ✅ | ✅ | ✅ | ✅ (own) |
| Configure loan types & interest rates | ✅ | ✅ | ❌ | ❌ |

**Loan Types:**
- Cash Advance
- Salary Loan
- Emergency Loan
- SSS Loan
- Pag-IBIG Loan
- Company Loan

---

### 5.8 Performance Reviews

| Action | Admin | HR | Supervisor | Employee |
|--------|:-----:|:--:|:----------:|:--------:|
| Create review cycles | ✅ | ✅ | ❌ | ❌ |
| Define evaluation criteria | ✅ | ✅ | ❌ | ❌ |
| Set salary bands per rating | ✅ | ❌ | ❌ | ❌ |
| Score/rate team members | ❌ | ❌ | ✅ | ❌ |
| Complete self-assessment | ❌ | ❌ | ✅ | ✅ |
| View own performance reviews | ✅ | ✅ | ✅ | ✅ |
| View all reviews | ✅ | ✅ | ✅ (team) | ❌ |
| Acknowledge review results | ❌ | ❌ | ✅ | ✅ |
| View performance dashboard & trends | ✅ | ✅ | ✅ (team) | ❌ |

---

### 5.9 Other Modules

#### Disciplinary (Admin, HR only)

| Action | What Happens |
|--------|-------------|
| Log an incident | Record date, employee, type, description, witnesses |
| Manage cases | Track from Open → Under Investigation → Resolved → Closed |
| Issue actions | Verbal Warning → Written Warning → Suspension → Termination |
| Issue NTE (Notice to Explain) | Formal notice requiring employee response |
| Attach documents | Upload evidence, notices, employee responses |

#### Jobs / Recruitment (Admin, HR only)

| Action | What Happens |
|--------|-------------|
| Create job posting | Set title, department, requirements, salary range |
| Manage posting status | Draft → Open → On Hold → Closed |
| Track applicants | Applied → Screening → Interview → Offer → Hired/Rejected |
| Add notes per applicant | Interview feedback, evaluation notes |

#### Projects (Admin, HR, Supervisor)

| Action | What Happens |
|--------|-------------|
| Create/edit projects | Name, description, dates, priority, budget |
| Assign team members | Add employees to project teams |
| Track status | Planning → In Progress → On Hold → Completed → Cancelled |
| Link tasks | Associate tasks from the Tasks module |
| Monitor budget | Track project costs |

#### Tasks (Admin, HR, Supervisor, Employee)

| Action | Admin/HR/Supervisor | Employee |
|--------|:-------------------:|:--------:|
| Create tasks | ✅ | ❌ |
| Assign tasks to employees | ✅ | ❌ |
| View all tasks | ✅ | ❌ |
| View assigned tasks | ✅ | ✅ |
| Update task status | ✅ | ✅ (own) |
| Add comments | ✅ | ✅ |
| Switch Kanban/List view | ✅ | ✅ |

Task statuses: **To Do → In Progress → In Review → Done**  
Priority levels: **Low, Medium, High, Urgent**

#### Events (All roles)

| Action | Admin/HR | Everyone Else |
|--------|:--------:|:-------------:|
| Create events | ✅ | ❌ |
| Edit/delete events | ✅ | ❌ |
| View events calendar | ✅ | ✅ |
| View event details | ✅ | ✅ |

Event types: Company Event, Holiday, Training, Team Building, Meeting

#### Timesheets (Admin, HR, Supervisor, Payroll Admin)

| Action | Admin/HR | Supervisor | Payroll Admin |
|--------|:--------:|:----------:|:-------------:|
| View all timesheets | ✅ | ✅ (team) | ✅ (view) |
| Approve/reject timesheets | ✅ | ✅ | ❌ |
| Configure timesheet rules | ✅ | ❌ | ❌ |

#### Audit Log (Admin, Auditor only)

| What's Tracked | Examples |
|----------------|----------|
| All user actions | Created employee, Edited salary, Approved leave |
| Login/logout events | Who logged in, when, from where |
| Approval actions | Who approved what, when |
| Data changes | Before and after values for every edit |
| Filter by | Date range, user, module, action type |
| Export | Download audit logs as file |

> [!IMPORTANT]
> Audit logs are **read-only**. Nobody can edit or delete audit entries.

---

## 6. Process Flows

### 6.1 Employee Onboarding

```
Admin/HR creates new employee account
    ↓
System generates temporary password
    ↓
Employee logs in for the first time
    ↓
System forces password change (cannot be skipped)
    ↓
Employee sets new password (min. 8 characters)
    ↓
Employee lands on their Dashboard
    ↓
(Optional) Employee enrolls face for kiosk check-in
    ↓
(Optional) Admin enrolls employee fingerprint on biometric device
```

---

### 6.2 Daily Attendance

```
┌─────────────────────────────────────────────┐
│         Employee arrives at office           │
└─────────────────┬───────────────────────────┘
                  │
    ┌─────────────┼──────────────┬──────────────┐
    ▼             ▼              ▼              ▼
 Fingerprint   Face Scan    QR Code Scan    Manual Entry
 (Biometric    (Kiosk       (Kiosk          (Admin/HR
  Device)       Camera)      Scanner)        enters it)
    │             │              │              │
    └─────────────┼──────────────┘──────────────┘
                  ▼
    System records CHECK-IN event with timestamp
                  ▼
    Status auto-computed:
    • On time (within grace period) → "Present"
    • After grace period → "Late"
    • After half the shift → "Half-Day"
    • No check-in at all → "Absent"
    • On approved leave → "On Leave"
                  ▼
    Employee works their shift
                  ▼
    Employee checks out (same methods above)
                  ▼
    System records CHECK-OUT event
                  ▼
    Daily attendance log updated with total hours worked
```

**Grace Period:** Default 15 minutes (configurable by Admin).  
**Night Differential:** 10:00 PM – 6:00 AM gets 10% premium pay.  
**Overtime:** Must be requested/approved before or after the fact.

---

### 6.3 Leave Request

```
Employee files leave request
    │
    │  Selects: Leave Type, Start Date, End Date, Reason
    ▼
Request status = "Pending"
    │
    ▼
Supervisor receives notification
    │
    ├── Supervisor APPROVES ──→ Status = "Approved"
    │                              │
    │                              ▼
    │                     Leave balance deducted
    │                     Attendance auto-marked "On Leave"
    │                     Employee notified
    │
    ├── Supervisor REJECTS ──→ Status = "Rejected"
    │                              │
    │                              ▼
    │                     Employee notified with reason
    │
    └── Employee CANCELS ──→ Status = "Cancelled"
                               │
                               ▼
                          Balance restored (if was approved)
```

> [!NOTE]
> Admin and HR can approve leave requests for any employee, bypassing the supervisor step.

---

### 6.4 Payroll Processing (Semi-Monthly)

The system runs payroll twice a month:
- **1st Cutoff:** 1st–15th of the month
- **2nd Cutoff:** 16th–end of the month

```
Step 1: CONFIGURE
    Admin/Finance sets pay period dates
    ↓
Step 2: GENERATE
    System auto-computes for each employee:
    ├── Basic salary (pro-rated to pay period)
    ├── + Overtime pay (from approved OT)
    ├── + Holiday pay (from holiday calendar)
    ├── + Night differential (from attendance)
    ├── + Allowances
    ├── − Late/absent deductions (from attendance)
    ├── − Loan deductions (from active loans)
    └── − Government deductions (2nd cutoff only):
         ├── SSS (based on salary bracket)
         ├── PhilHealth (2.5% employee share)
         ├── Pag-IBIG (employee share)
         └── BIR Withholding Tax (based on tax table)
    = NET PAY
    ↓
Step 3: REVIEW
    Finance/Payroll Admin reviews each payslip
    Can make adjustments if needed
    ↓
Step 4: VALIDATE
    System checks for errors/missing data
    ↓
Step 5: LOCK
    Payroll is locked — no more changes allowed
    System takes a "snapshot" of all tax/contribution rates used
    ↓
Step 6: CONFIRM
    Finance confirms individual payslips
    ↓
Step 7: PUBLISH
    Payslips become visible to employees (in "My Payslips")
    Employees receive notification
    ↓
Step 8: PAY
    Finance records actual payment
    ↓
Step 9: ACKNOWLEDGE
    Employees sign/acknowledge receipt of payslip
```

**Payroll Run Statuses:** `Draft → Validated → Locked → Published → Paid`  
**Payslip Statuses:** `Issued → Confirmed → Published → Paid → Acknowledged`

---

### 6.5 Loan Lifecycle

```
Employee applies for loan
    │
    │  Selects: Loan Type, Amount, Reason
    ▼
Loan status = "Pending"
    │
    ▼
Finance/Admin receives notification
    │
    ├── APPROVED ──→ Loan activated
    │                   │
    │                   ▼
    │              Payment schedule generated
    │              (monthly installments)
    │                   │
    │                   ▼
    │              Each payroll run auto-deducts
    │              installment from employee's salary
    │                   │
    │                   ▼
    │              When fully paid → Loan status = "Completed"
    │
    └── REJECTED ──→ Employee notified with reason
```

---

### 6.6 Performance Review Cycle

```
Step 1: Admin/HR creates review cycle
    │   (Sets: name, period, frequency — quarterly/semi-annual/annual)
    ▼
Step 2: Admin/HR adds evaluation criteria
    │   (Sets: criteria names, weights, descriptions)
    ▼
Step 3: Admin sets salary bands
    │   (Maps rating ranges to salary adjustment percentages)
    │   Example: Rating 4.0-5.0 → +5% raise
    ▼
Step 4: Employees complete self-assessments
    │   (Rate themselves on each criterion)
    ▼
Step 5: Supervisors score their team members
    │   (Rate each team member on each criterion, 1-5 scale)
    ▼
Step 6: System auto-computes overall rating
    │   (Weighted average of all criteria)
    ▼
Step 7: System auto-recommends salary adjustment
    │   (Based on salary bands)
    ▼
Step 8: Employee acknowledges review results
    ▼
Step 9: Finance approves/overrides salary adjustment
    ▼
Step 10: Adjustment applied to next payroll run
```

---

### 6.7 Recruitment (Hiring)

```
HR creates job posting
    │   (Title, department, requirements, salary range)
    │   Status = "Draft"
    ▼
HR publishes posting → Status = "Open"
    ▼
Applicants apply (manually added by HR to system)
    │   Status = "Applied"
    ▼
HR screens applications → Status = "Screening"
    ▼
HR schedules interviews → Status = "Interview"
    ▼
HR extends offer → Status = "Offer"
    │
    ├── Accepted → Status = "Hired"
    │                 │
    │                 ▼
    │            HR creates employee record
    │            (flows into Employee Onboarding process)
    │
    └── Declined → Status = "Rejected"
```

---

### 6.8 Disciplinary Process

```
Incident reported by HR/Admin
    │
    │   (Records: date, employee, type, description, witnesses)
    ▼
Case status = "Open"
    ▼
HR issues NTE (Notice to Explain)
    │   Employee must respond within deadline
    ▼
Case status = "Under Investigation"
    │   HR reviews evidence, employee response
    ▼
HR determines action:
    │
    ├── Verbal Warning (1st offense)
    ├── Written Warning (2nd offense)
    ├── Suspension (serious offense)
    └── Termination (grave offense)
    │
    ▼
Case status = "Resolved" → eventually "Closed"
    │
    ▼
All records kept in employee's disciplinary history
(Linked to Performance module for context)
```

---

### 6.9 Employee Offboarding (Resignation/Termination)

```
Employee status changed to "Resigned" or "Terminated"
    ▼
Employee immediately logged out of system
    ▼
Employee cannot log back in (sees "Account Deactivated" page)
    ▼
System triggers Final Pay computation:
    ├── Pro-rated salary for days worked
    ├── + Unpaid overtime (125%)
    ├── + Leave cash-out (unused VL balance)
    ├── − Outstanding loan balance
    └── = Final Pay amount
    ▼
Finance reviews and approves Final Pay
    ▼
Final Pay status: Draft → Approved → Paid
```

---

## 7. Kiosk (Self-Service Check-In)

The Kiosk is a **special page designed for shared devices** (tablets mounted in the office lobby). It does **not** require login — anyone can use it.

### How It Works

| Check-In Method | How the Employee Uses It |
|----------------|------------------------|
| **QR Code** | Employee opens their personal QR code (unique daily code) and holds it up to the kiosk camera. System scans and records attendance. |
| **Face Recognition** | Employee stands in front of the kiosk camera. System matches their face against enrolled photos and records attendance. |
| **PIN Entry** | Employee types in their ID/PIN as a fallback method. |

### What Happens After Check-In

1. Kiosk displays a **greeting** with the employee's name
2. Shows **confirmation** of check-in time
3. Records the attendance event in the system
4. Resets to the standby screen for the next employee

### Key Kiosk Features

- **Large clock display** — always visible
- **Works offline** — stores check-in records locally if internet is down, syncs when connection returns
- **Anti-fraud protections:**
  - Detects if someone tries to open developer tools → locks out
  - Detects mock/fake GPS locations
  - Flags suspicious rapid location changes
  - Blocks automated/bot check-ins
- **Auto-refreshes** periodically to prevent stale data

### QR Code Details

- Each employee gets a **unique QR code that changes daily** (expires at midnight)
- QR codes are cryptographically signed to prevent forgery
- A scanned QR code cannot be reused for duplicate check-ins (5-minute cooldown)

### Face Recognition Details

- Employees must **enroll their face** first (via the Face Enrollment page)
- System captures multiple photos during enrollment
- During check-in, takes **7 frames** and requires **4+ valid matches**
- Does not store actual photos — stores mathematical representations only

> [!IMPORTANT]
> The Kiosk page is accessible **without logging in**. Admin/HR manages kiosk setup from their dashboard. Kiosk should only be opened on designated shared devices.

---

## 8. Notifications & Messaging

### Notifications (System-Generated)

The system automatically sends notifications for:

| Event | Who Gets Notified |
|-------|-------------------|
| Leave request filed | Supervisor, HR |
| Leave approved/rejected | Employee who filed |
| Payslip published | Employee |
| Task assigned | Assigned employee |
| Overtime request filed | Supervisor |
| Overtime approved/rejected | Employee who filed |
| Loan application filed | Finance, Admin |
| Loan approved/rejected | Employee who applied |
| Performance review assigned | Employee, Supervisor |
| Disciplinary notice issued | Employee |
| Event upcoming | All affected employees |
| New message received | Message recipient |

**Bell icon** in the sidebar shows unread count. Clicking opens notification list with mark-as-read and clear-all actions.

### Messages (Internal Communication)

- Users can send **direct messages** to any other user in the system
- Messages appear as **conversation threads** (like email or chat)
- Users can see **Inbox** (received) and **Sent** (sent) messages
- Messages update in **real-time** (no need to refresh)
- Available to: Admin, HR, Supervisor, Employee

---

## 9. Reports

Available to: **Admin, HR, Finance, Payroll Admin, Auditor**

| Report | What It Shows | Who Typically Uses It |
|--------|--------------|----------------------|
| **Attendance Report** | Daily/weekly/monthly attendance summary — late count, absent count, OT hours | HR, Admin |
| **Payroll Report** | Payroll run summary — total earnings, deductions, net pay per department | Finance, Payroll Admin |
| **Government Contributions** | SSS, PhilHealth, Pag-IBIG remittance summaries per period | Finance, Payroll Admin, HR |
| **BIR Compliance** | Withholding tax computations, BIR form data | Finance, Payroll Admin |
| **Leave Report** | Leave utilization — who used how many days, by type, by department | HR, Admin |
| **Employee Report** | Headcount, turnover rates, demographics, employment type breakdown | HR, Admin |
| **Overtime Report** | OT hours worked, cost summary, by department | HR, Admin |
| **Loan Report** | Outstanding loans, total disbursed, repayment status | Finance, Admin |

All reports support:
- **Date range filters**
- **Department / employee filters**
- **Export to CSV, Excel, or PDF**
- **Visual charts and graphs**

---

## 10. Settings & Configuration

Only **Admin** has full settings access. Some sections are shared with HR, Finance, and Payroll Admin.

| Setting | Who Can Access | What It Controls |
|---------|---------------|-----------------|
| **Company Info** | Admin, HR, Finance, Payroll Admin | Company name, logo, address, contact details |
| **Departments** | Admin, HR, Finance, Payroll Admin | Add/edit/delete departments |
| **Positions** | Admin, HR, Finance, Payroll Admin | Add/edit/delete job titles |
| **Roles & Permissions** | Admin only | Create custom roles, assign permissions per role |
| **Leave Configuration** | Admin, HR | Leave types, default allocations, carry-over rules |
| **Payroll Configuration** | Admin, Finance, Payroll Admin | Pay schedule, contribution tables, allowance/deduction types |
| **Attendance & Shifts** | Admin, HR | Work schedule templates, grace periods, overtime rules, holiday calendar |
| **Tax Rules** | Admin, Finance, Payroll Admin | SSS, PhilHealth, Pag-IBIG, BIR tax tables |
| **User Management** | Admin | Create/deactivate user accounts, reset passwords, assign roles |
| **Appearance & Theme** | Admin only | Color scheme, branding, sidebar customization |
| **Personal Preferences** | All roles | Theme toggle (light/dark), notification preferences |

### Custom Roles

Admin can create **custom roles** beyond the 7 built-in ones:
- Give the role a name, color, and icon
- Select specific permissions from the full list (~60 permissions)
- Assign the custom role to employees
- Custom roles appear in all role-based access checks just like built-in roles

---

## 11. Quick Reference: Role Summary

### Admin
> Full access to everything. The "super user" of the system. Can manage users, configure all settings, process payroll, view audit logs. Only role that can create/manage other roles and reset payroll runs.

### HR
> Manages people operations. Handles employee records, attendance oversight, leave policies, recruitment, disciplinary actions, and performance reviews. **Cannot** process payroll or manage loans/finances.

### Finance
> Manages money. Processes payroll, approves loans, manages government contributions, generates financial reports, approves salary changes. **Cannot** manage attendance, leaves, or recruitment.

### Payroll Admin
> Focused version of Finance. Processes payroll runs, manages tax configurations. **Cannot** approve loans or record payments. More limited than Finance.

### Supervisor
> Team lead role. Approves their team's overtime, leave requests, and timesheets. Reviews team performance. Can manage projects and tasks. **Cannot** access payroll, settings, or financial data.

### Employee
> Self-service role. Views own attendance, files leave requests, views own payslips, applies for loans, completes self-assessments, works on assigned tasks. **Cannot** see other employees' data or any management pages.

### Auditor
> Read-only oversight role. Views audit logs, reports, employee records, and loan data. **Cannot** modify any data in the system. Exists for compliance and accountability purposes.

---

> [!TIP]
> **For Day-to-Day Operations:**
> - Employees interact mostly with: Dashboard, Attendance, Leave, My Payslips, Tasks
> - Supervisors additionally use: Leave (approvals), Attendance (OT approvals), Performance, Timesheets
> - HR focuses on: Employees, Attendance, Leave, Recruitment, Disciplinary, Performance
> - Finance focuses on: Payroll, Loans, Reports, Government Contributions
> - Admin handles: Settings, User Management, Audit Log, and anything that needs escalation
