# Performance Management Module - Implementation Guide

## Overview

The Performance Management module adds a quarterly performance review system where:
- **Managers** evaluate their direct reports
- **Employees** acknowledge their reviews
- **Finance** confirms salary adjustments
- **Payroll** applies the approved adjustments

---

## Architecture

### Database Tables (Migration 025)

1. **performance_cycles** - Review cycles (Q1 2025, etc.)
2. **performance_criteria** - Evaluation criteria (Communication, Technical Skills, etc.)
3. **performance_salary_bands** - Auto-mapping rules (4.0-5.0 rating = +5% salary)
4. **performance_reviews** - Manager → Employee evaluations
5. **performance_ratings** - Individual criterion scores for each review
6. **performance_salary_adjustments** - Finance approval queue
7. **performance_audit_logs** - Immutable audit trail

### Data Flow

```
Admin/HR creates cycle
    ↓
Admin/HR adds evaluation criteria
    ↓
Admin/HR sets up salary bands (auto-mapping)
    ↓
Manager scores their team
    ↓
System auto-generates salary adjustment recommendation
    ↓
Employee acknowledges review
    ↓
Finance reviews & approves/overrides adjustment
    ↓
Payroll applies approved adjustments to salary
    ↓
Employee's salary updated in next payroll run
```

---

## Components

### 1. TypeScript Types (`src/types/performance.ts`)

```typescript
- PerformanceCycle: Review cycle definition
- PerformanceCriterion: Evaluation criteria
- PerformanceSalaryBand: Rating → salary adjustment mapping
- PerformanceReview: Manager's evaluation of an employee
- PerformanceRating: Individual criterion score
- PerformanceSalaryAdjustment: Finance-approved adjustment
- PerformanceAuditLog: Audit trail entry
```

### 2. Zustand Store (`src/store/performance.store.ts`)

Manages performance state:
- Cycles, criteria, salary bands
- Reviews and adjustments
- Audit logs
- UI state (filters, selected items)

### 3. API Routes (`src/app/api/performance/`)

**Cycles Management:**
- `POST /api/performance/cycles` - Create cycle
- `GET /api/performance/cycles` - List cycles
- `GET/PUT/PATCH /api/performance/cycles/[id]` - Manage cycle

**Reviews Management:**
- `POST /api/performance/reviews` - Create/save review
- `GET /api/performance/reviews` - List reviews (filters: cycle_id, employee_id, manager_id, status)
- `PUT /api/performance/reviews/[id]` - Update draft review
- `POST /api/performance/reviews/[id]/submit` - Submit review
- `POST /api/performance/reviews/[id]/acknowledge` - Employee acknowledges

**Salary Adjustments:**
- `GET /api/performance/adjustments` - List pending adjustments (Finance only)
- `POST /api/performance/adjustments/[id]/approve` - Approve/reject adjustment

**Criteria & Bands:**
- `GET/POST /api/performance/criteria` - Manage evaluation criteria
- `GET/POST /api/performance/salary-bands` - Manage salary bands

### 4. UI Pages (`src/app/[role]/performance/`)

**Admin/HR Dashboard** (`/performance`)
- Manage review cycles
- Configure evaluation criteria
- Set up salary adjustment bands
- View audit trail

**Manager Reviews** (`/performance/my-reviews`)
- See direct reports
- Score each employee across criteria
- Add qualitative notes
- Submit completed reviews

**Employee Reviews** (`/performance/reviews`)
- View performance history
- See evaluation scores
- Acknowledge review
- View salary adjustment status

**Finance Approval Queue** (`/performance/adjustments`)
- See pending salary adjustments
- Override recommended amounts if needed
- Approve or reject adjustments
- View impact summary

### 5. Payroll Integration (`src/services/performance-payroll.service.ts`)

Functions:
- `getApprovedAdjustmentsForPayroll()` - Get adjustments ready for payroll
- `applyAdjustmentsToPayrollRun(payrollRunId, adjustmentIds)` - Apply to payroll
- `getAdjustmentImpactSummary()` - Calculate impact before applying
- `validateAdjustmentsForPayroll()` - Validate before processing

---

## Workflows

### Workflow 1: Admin Sets Up Review Cycle

1. Go to **Admin → Performance Management**
2. Click **"New Cycle"**
3. Enter:
   - Cycle name (e.g., "Q1 2025 Performance Review")
   - Period dates (Jan 1 - Mar 31)
   - Review window dates (Apr 1 - Apr 15)
4. Click **"Create Cycle"**
5. Select cycle and add **Evaluation Criteria**:
   - Communication Skills
   - Technical Skills
   - Team Collaboration
   - Customer Focus
   - (weight: typically 1.0 for each)
6. Add **Salary Adjustment Bands**:
   - Band: "High Performer" | Rating: 4.0-5.0 | Adjustment: +5%
   - Band: "Meets Expectations" | Rating: 3.0-3.9 | Adjustment: +3%
   - Band: "Needs Improvement" | Rating: 1.0-2.9 | Adjustment: 0%
7. Click **"Activate Cycle"** to make it active for reviews

### Workflow 2: Manager Reviews Their Team

1. Go to **Manager → Performance → My Team Reviews**
2. Select the active review cycle
3. Select an employee from "Your Team" panel
4. Score each criterion using slider (1-5, 0.5 increments)
   - System calculates overall rating automatically (average of all criteria)
5. Add manager comments/observations
6. Click **"Save as Draft"** to save without submitting
7. When ready, click **"Submit Review"**
   - Status changes to "submitted"
   - System auto-generates salary adjustment recommendation based on rating
   - Employee gets notified

### Workflow 3: Employee Acknowledges Review

1. Go to **Employee → Performance → My Reviews**
2. Find the review from their manager (status: "Awaiting Your Acknowledgement")
3. Click **"View Details"** to see:
   - Scores for each criterion
   - Manager's comments
   - Recommended salary adjustment band
   - Status: "Pending Finance Approval"
4. Click **"Acknowledge Review"**
   - Status changes to "acknowledged"
   - Review moves to Finance for approval

### Workflow 4: Finance Approves/Overrides Adjustments

1. Go to **Finance → Performance → Salary Adjustment Queue**
2. See summary cards:
   - Pending approvals count
   - Total recommended increase
   - Number of employees affected
3. Review each adjustment:
   - Employee name
   - Performance rating
   - Current salary
   - Recommended adjustment amount
   - Salary band info
4. Click **"Review & Approve/Reject"**
5. In dialog:
   - **Current Salary**: Shown for reference
   - **Adjustment Amount**: Override if needed (default = recommended)
   - **Override Reason**: Explain if different from recommended
   - Click **"Approve"** or **"Reject"**
6. Once all adjustments approved → Review status auto-updates to "finance_approved"

### Workflow 5: Payroll Applies Adjustments

**In Payroll Module** (integration point):

1. When creating/processing a payroll run for next period:
   - Call `getApprovedAdjustmentsForPayroll()`
   - Filters for "approved" status, not yet applied
2. Review impact summary before processing
3. For each adjustment:
   - Employee's salary record is updated
   - Adjustment marked as "applied"
   - Audit log created
4. Payroll run processes with new salaries

---

## Key Design Decisions

### 1. Immutable Reviews
- Once finalized, reviews cannot be edited
- Corrections/changes go through next cycle
- Maintains audit trail integrity

### 2. Finance Gatekeepers
- Performance only **recommends** salary changes
- Finance **approves** with override capability
- Payroll **executes** (reads, not creates)
- Clear separation of concerns

### 3. Auto-Mapping Ratings → Salary Bands
- Admin configures bands at cycle setup
- Manager scores, system auto-calculates overall rating
- Automatic salary band recommendation
- Finance can override if needed

### 4. Full Audit Trail
- Every status change logged
- All overrides tracked with reasons
- Timestamps and user IDs recorded
- Defensible for compliance reviews

### 5. Role-Based Access
- **Admin/HR**: Manage cycles, criteria, bands; view all data
- **Manager**: Score direct reports; see their reviews
- **Employee**: View own reviews; acknowledge
- **Finance**: Approve/reject adjustments; override amounts
- **Payroll**: Read approved adjustments; apply to payroll

---

## RLS (Row Level Security) Policies

- Managers can **read/update** reviews for their direct reports
- Employees can **read** their own reviews
- Finance can **read/update** salary adjustments
- Audit logs readable by admin, HR, audit, finance roles
- Cycles/criteria/bands readable by all; writable by admin/HR only

---

## Integration with Payroll

### Payroll Route Handler (Example)

```typescript
// In payroll processing endpoint
import { getApprovedAdjustmentsForPayroll, applyAdjustmentsToPayrollRun } from "@/services/performance-payroll.service";

export async function POST(req: Request) {
  const { payrollRunId } = await req.json();
  
  // Get adjustments ready for payroll
  const adjustments = await getApprovedAdjustmentsForPayroll();
  
  // Validate
  const validation = await validateAdjustmentsForPayroll(
    adjustments.map(a => a.id)
  );
  
  if (!validation.isValid) {
    return NextResponse.json({ 
      error: "Invalid adjustments", 
      issues: validation.issues 
    }, { status: 400 });
  }
  
  // Apply to payroll
  const results = await applyAdjustmentsToPayrollRun(
    payrollRunId,
    adjustments.map(a => a.id)
  );
  
  return NextResponse.json({ results });
}
```

---

## Database Constraints

- Cycles must have `period_start < period_end` and `review_start_date < review_end_date`
- Salary bands must have `min_rating < max_rating` for each band
- Reviews locked to specific cycle + employee + manager combination
- Adjustments automatically created when review submitted
- Audit logs are append-only (no updates/deletes)

---

## Testing the Module

### Test Scenario

1. **Setup** (Admin)
   - Create cycle: "Q2 2025 Review" (Apr 1 - Jun 30)
   - Add criteria: Communication (weight 1), Technical (weight 1), Teamwork (weight 1)
   - Add bands: 4.0-5.0 → +5%, 3.0-3.9 → +2%, <3.0 → 0%

2. **Manager Review** (Supervisor)
   - Review employee "John Doe"
   - Communication: 4.5, Technical: 4.0, Teamwork: 4.5
   - Overall: (4.5 + 4.0 + 4.5) / 3 = 4.33 → Qualifies for +5% band
   - Recommended adjustment: ₱40,000 * 5% = ₱2,000/month
   - Submit review

3. **Employee Acknowledges** (Employee)
   - View their review
   - See scores and manager comments
   - See salary band: "4.33 → High Performer → +5%"
   - Acknowledge

4. **Finance Approves** (Finance)
   - See adjustment: John Doe, ₱2,000/month recommended
   - Review is correct, approve as-is
   - Adjustment marked "approved"

5. **Payroll Applies** (Payroll Admin)
   - Process May payroll run
   - Get approved adjustments
   - Apply: John's salary updated from ₱40,000 to ₱42,000
   - Adjustment marked "applied"
   - May payslip reflects new salary

---

## Common Scenarios

### Scenario: Override Salary Adjustment
Finance sees adjustment but believes amount is too high:
1. Click "Review & Approve/Reject"
2. Change amount from ₱2,000 to ₱1,500
3. Enter reason: "Company budget constraints"
4. Approve with override
5. Payroll will apply ₱1,500 instead of ₱2,000

### Scenario: Reject Adjustment
Finance denies the adjustment:
1. Click "Review & Approve/Reject"
2. Click "Reject"
3. Adjustment status → "rejected"
4. Will not be included in payroll
5. Review status remains "acknowledged"

### Scenario: Late Submission
Manager submits review after cycle closed:
1. If cycle in "finalized" status, no new reviews accepted
2. Must wait for next cycle
3. Or admin can reactivate cycle if needed

---

## Audit Trail Examples

```json
{
  "entity_type": "cycle",
  "entity_id": "PC-123",
  "action": "created",
  "new_status": "draft",
  "changed_by": "admin@company.com",
  "timestamp": "2025-01-15T10:00:00Z",
  "details": { "cycle_name": "Q1 2025" }
}

{
  "entity_type": "review",
  "entity_id": "PR-456",
  "action": "submitted",
  "old_status": "draft",
  "new_status": "submitted",
  "changed_by": "manager@company.com",
  "timestamp": "2025-02-01T14:30:00Z"
}

{
  "entity_type": "adjustment",
  "entity_id": "PSA-789",
  "action": "approved_by_finance",
  "changed_by": "finance@company.com",
  "timestamp": "2025-02-15T09:15:00Z",
  "details": {
    "approved_amount": 1500,
    "override_reason": "Budget constraints"
  }
}
```

---

## Future Enhancements

1. **360-degree feedback** - Add peer/self-assessment
2. **Goal tracking** - Link reviews to OKRs/goals
3. **Calibration sessions** - Group manager reviews for consistency
4. **Appeals process** - Employee can appeal review
5. **Export reports** - Export review data to HR systems
6. **Email notifications** - Notify employees when review ready
7. **Mobile app** - Manager review submission from mobile
8. **Customizable scales** - Support different rating scales per company

---

## Troubleshooting

### Issue: "No active cycles"
**Solution**: Admin must create and activate a cycle first

### Issue: "No evaluation criteria defined"
**Solution**: After creating cycle, add at least one criterion from Criteria tab

### Issue: "Salary band not auto-assigned"
**Solution**: Ensure salary bands are created for the cycle with proper rating ranges

### Issue: "Finance can't see adjustments"
**Solution**: Check user role - must be finance, finance_admin, admin, or payroll_admin

### Issue: "Adjustment not appearing in payroll"
**Solution**: Check adjustment status - must be "approved" to be included
