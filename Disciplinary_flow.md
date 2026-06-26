# Disciplinary Module Workflow

## Overview

The Disciplinary Module manages employee disciplinary cases from creation through resolution while maintaining due process and auditability.

### Workflow

```text
Open Case
    ↓
Awaiting NTE Response
    ↓
Under Review
    ↓
NOD Pending
    ↓
Sanction
    ↓
Closed
```

---

# Status Definitions

## 1. Open Case

### Purpose

Initial stage where HR, a supervisor, or an authorized personnel creates a disciplinary case against an employee.

### Required Information

* Employee
* Violation category
* Incident date
* Incident description
* Supporting evidence
* Witnesses (optional)
* Severity level

### Available Actions

#### HR / Supervisor

* Create case
* Edit case details
* Upload attachments
* Save as draft
* Submit case
* Generate Notice to Explain (NTE)

### Exit Condition

Case is formally submitted and NTE is issued.

### Next Status

`Awaiting NTE Response`

---

## 2. Awaiting NTE Response

### Purpose

Employee receives the Notice to Explain (NTE) and is given an opportunity to provide a written explanation.

### Employee Actions

* View NTE
* Submit explanation
* Upload supporting documents

### HR Actions

* Monitor response deadline
* Send reminders
* Record non-response

### Possible Outcomes

#### Employee Responded

Move to:

`Under Review`

#### Employee Did Not Respond

Move to:

`Under Review`

With notation:

```text
No Response Submitted
```

### Suggested Metadata

* NTE issued date
* NTE due date
* Response submitted date
* Response status

---

## 3. Under Review

### Purpose

HR and management evaluate the case, evidence, and employee response.

### Activities

* Review employee explanation
* Review supporting documents
* Conduct investigation
* Gather additional evidence
* Conduct administrative hearing (if applicable)

### Available Actions

#### HR

* Add investigation notes
* Upload additional evidence
* Schedule hearing
* Request additional information

### Possible Outcomes

#### Case Dismissed

Reason examples:

* Insufficient evidence
* False allegation
* No policy violation

Move to:

`Closed`

#### Violation Confirmed

Move to:

`NOD Pending`

#### Additional Information Required

Remain in:

`Under Review`

---

## 4. NOD Pending

### Purpose

Prepare and approve the Notice of Decision (NOD).

### Activities

* Draft final decision
* Obtain required approvals
* Generate NOD document

### Decision Types

* No violation found
* Verbal warning
* Written warning
* Final written warning
* Suspension
* Termination

### Available Actions

#### HR

* Generate NOD
* Submit for approval
* Issue NOD

### Exit Condition

NOD has been approved and released.

### Next Status

`Sanction`

---

## 5. Sanction

### Purpose

Execute the disciplinary action determined in the Notice of Decision.

### Examples

* Verbal warning
* Written warning
* Final warning
* Suspension
* Termination

### Available Actions

#### HR

* Record sanction
* Apply suspension dates
* Upload acknowledgment documents
* Mark sanction as completed

#### Employee

* View sanction
* Acknowledge receipt

### Exit Condition

Sanction has been implemented and completed.

### Next Status

`Closed`

---

## 6. Closed

### Purpose

Case has been finalized and requires no further action.

### Closure Reasons

* Dismissed
* Warning issued
* Suspension completed
* Termination completed
* Withdrawn
* Settled

### System Behavior

* Case becomes read-only
* Documents remain accessible
* Audit logs remain available
* Historical reporting remains available

---

# Recommended Data Model

## Case Status

Used for workflow tracking.

```text
OPEN_CASE
AWAITING_NTE_RESPONSE
UNDER_REVIEW
NOD_PENDING
SANCTION
CLOSED
```

---

## Case Result

Used for reporting and analytics.

```text
DISMISSED
VERBAL_WARNING
WRITTEN_WARNING
FINAL_WARNING
SUSPENSION
TERMINATION
WITHDRAWN
SETTLED
```

### Why Separate Status and Result?

Status tracks where the case is in the workflow.

Examples:

```text
Open Case
Under Review
Sanction
```

Result tracks the final outcome.

Examples:

```text
Dismissed
Suspension
Termination
```

This allows reporting such as:

* Cases currently under review
* Cases awaiting NTE response
* Cases resulting in suspension
* Cases resulting in termination

without mixing workflow stages and final outcomes.

---

# Optional Enhancement: Administrative Hearing Stage

For organizations requiring a formal hearing process, an additional stage may be inserted.

```text
Open Case
    ↓
Awaiting NTE Response
    ↓
Under Review
    ↓
Administrative Hearing
    ↓
NOD Pending
    ↓
Sanction
    ↓
Closed
```

### Administrative Hearing Actions

#### HR

* Schedule hearing
* Assign hearing officers
* Record hearing minutes
* Upload hearing documents

#### Employee

* Attend hearing
* Submit additional evidence

### Exit Condition

Hearing has concluded and findings are submitted for final decision.

### Final Checking
* Make sure that the status is being updated.
* Update the KPI Cards regarding disciplinary.




```
```
