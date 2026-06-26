# Requirements Document

## Introduction

The NexHRMS-v2 disciplinary module implements an NTE → NOD case-management pipeline. Several features described in the canonical `Disciplinary_flow.md` document are not yet implemented. This spec covers the eight enhancement areas needed to bring the system into full alignment with the documented workflow: severity classification, witnesses capture, draft saving, investigation notes, explicit sanction completion, case result reporting, closed-case read-only enforcement, and accurate KPI counts.

All changes must be backward-compatible with existing cases that carry none of the new fields.

---

## Glossary

- **Disciplinary_Case**: A record in `disciplinary_cases` that tracks a single employee disciplinary matter from creation through closure.
- **DisciplinaryCaseStatus**: The workflow position of a case (`open | nte_issued | nte_acknowledged | explanation_submitted | no_response | under_review | nod_issued | nod_acknowledged | sanction_active | closed`). With this enhancement, `draft` is added.
- **CaseResult**: The final outcome used for reporting (`DISMISSED | VERBAL_WARNING | WRITTEN_WARNING | FINAL_WARNING | SUSPENSION | TERMINATION | WITHDRAWN | SETTLED`). Separate from status.
- **SeverityLevel**: Classification of case gravity (`minor | moderate | major | critical`).
- **Investigation_Note**: A timestamped free-text entry authored by HR while a case is `under_review`, stored in a dedicated `disciplinary_notes` table.
- **KPI_Tile**: A summary card visible in the admin list view ("Case Overview" row) and/or the admin/employee dashboard.
- **HR/Admin**: A user whose role is `admin` or `hr`.
- **Employee**: A user whose role is not `admin`, `hr`, `payroll_admin`, or `finance`, and whose employee record matches the case's `employeeId`.
- **Closed_Case**: Any Disciplinary_Case where `status === "closed"`.
- **Sanction_Active_Case**: Any Disciplinary_Case where `status === "sanction_active"`.
- **Store**: The Zustand `useDisciplinaryStore` in `src/store/disciplinary.store.ts`.
- **DB_Service**: The `disciplinaryDb` helper in `src/services/db.service.ts`.
- **Admin_View**: `src/app/[role]/disciplinary/_views/admin-view.tsx`.
- **Employee_View**: `src/app/[role]/disciplinary/_views/employee-view.tsx`.
- **Case_Detail**: `src/app/[role]/disciplinary/[caseId]/page.tsx`.
- **Admin_Dashboard**: `src/components/dashboard/admin-dashboard.tsx`.
- **Employee_Dashboard**: `src/components/dashboard/employee-dashboard.tsx`.

---

## Requirements

### Requirement 1: Severity Level

**User Story:** As an HR officer, I want to classify the gravity of each disciplinary case when creating or editing it, so that I can triage cases by severity and generate meaningful reports.

#### Acceptance Criteria

1. WHEN an HR user opens the Create Case dialog, THE Admin_View SHALL display a required "Severity Level" select field with the options: `minor`, `moderate`, `major`, `critical`.
2. WHEN an HR user submits a new case without selecting a severity level, THE Admin_View SHALL prevent submission and display an inline validation error "Severity level is required".
3. WHEN an HR user opens the Edit Case dialog, THE Admin_View SHALL pre-populate the Severity Level field with the current value stored on the case.
4. WHEN a case is created or updated with a severity level, THE Store SHALL persist `severityLevel` on the `DisciplinaryCase` object.
5. WHEN a case is written through to Supabase, THE DB_Service SHALL map `severityLevel` to the `severity_level` column in `disciplinary_cases`.
6. WHEN the Case_Detail page renders a case, THE Case_Detail SHALL display the severity level in the Case Details card alongside the violation type.
7. WHEN an existing case in the database has no `severity_level` value (null), THE system SHALL treat it as unclassified and display "—" wherever the severity level is shown.

---

### Requirement 2: Witnesses Field

**User Story:** As an HR officer, I want to record the names of any witnesses associated with an incident, so that I have a complete case record for review.

#### Acceptance Criteria

1. WHEN an HR user opens the Create Case dialog, THE Admin_View SHALL display an optional "Witnesses" text input field.
2. WHEN an HR user opens the Edit Case dialog, THE Admin_View SHALL pre-populate the Witnesses field with the current value stored on the case.
3. WHEN a case is created or updated with a witnesses value, THE Store SHALL persist `witnesses` on the `DisciplinaryCase` object.
4. WHEN a case is written through to Supabase, THE DB_Service SHALL map `witnesses` to the `witnesses` column in `disciplinary_cases`.
5. WHEN the Case_Detail page renders a case, THE Case_Detail SHALL display the witnesses value in the Case Details card; IF the field is empty or null, THE Case_Detail SHALL display "—".

---

### Requirement 3: Draft Status

**User Story:** As an HR officer, I want to save an incomplete disciplinary case as a draft before formally opening it, so that I can finish filling in details at a later time without triggering employee-facing notifications.

#### Acceptance Criteria

1. THE Store's `DisciplinaryCaseStatus` type SHALL include `"draft"` as a valid status value.
2. WHEN an HR user clicks "Save as Draft" in the Create Case dialog, THE Admin_View SHALL call the store's `createCase` action with `status: "draft"` and close the dialog without triggering employee notifications.
3. WHEN a case has `status === "draft"`, THE Admin_View list and KPI tiles SHALL include it in the "Open" count only (not in awaiting/review/NOD counts); draft cases SHALL be excluded from the main case list table so that HR users only see formally submitted cases in their working queue.
4. WHEN an HR user clicks "Submit Case" in the Create Case dialog, THE Admin_View SHALL call the store's `createCase` action with `status: "open"`, triggering the normal case-created employee notification.
5. WHEN an HR user views a draft case in the case list, THE Admin_View SHALL display the status badge as "Draft" using a visually distinct neutral tone.
6. WHEN an HR user opens a draft case in Case_Detail, THE Case_Detail SHALL display an "Submit Case" button that transitions the case from `draft` to `open`, triggering employee notification.
7. WHEN a case transitions from `draft` to `open`, THE Store SHALL update `status` to `"open"` and `updatedAt` to the current timestamp, and THE DB_Service SHALL write through the change to Supabase.
8. IF a draft case has no employee selected, THE system SHALL prevent the case from transitioning to `open`.

---

### Requirement 4: Investigation Notes

**User Story:** As an HR officer, I want to add timestamped notes to a case while it is under review, so that I can document the investigation process in an auditable trail.

#### Acceptance Criteria

1. WHEN a case has `status === "under_review"` and the current user is HR/Admin, THE Case_Detail SHALL display an "Investigation Notes" section with an "Add Note" button.
2. WHEN an HR user clicks "Add Note", THE Case_Detail SHALL display a text input area and a "Save Note" button.
3. WHEN an HR user submits a note with a non-empty body, THE Store SHALL append a new `DisciplinaryNote` object containing `id`, `caseId`, `authorId`, `body`, and `createdAt` (ISO timestamp).
4. WHEN a note is saved, THE DB_Service SHALL insert the note into the `disciplinary_notes` table in Supabase.
5. WHEN an HR user attempts to save a note with an empty or whitespace-only body, THE Case_Detail SHALL prevent submission and display an inline error "Note cannot be empty".
6. WHEN the Investigation Notes section renders, THE Case_Detail SHALL display all existing notes for the case in reverse-chronological order, each showing the author name (resolved from the employees list), the body text, and the formatted timestamp.
7. WHEN the case is not `under_review`, THE Case_Detail SHALL NOT display the "Add Note" input; previously saved notes SHALL remain visible to HR/Admin in a read-only list.

---

### Requirement 5: Mark Sanction Completed

**User Story:** As an HR officer, I want to explicitly mark a sanction as completed and record the closure result, so that the case accurately reflects its final outcome.

#### Acceptance Criteria

1. WHEN a case has `status === "sanction_active"` and the current user is HR/Admin, THE Case_Detail SHALL display a "Mark Sanction Completed" button.
2. WHEN an HR user clicks "Mark Sanction Completed", THE Case_Detail SHALL open a confirmation dialog that also contains a required "Case Result" select field.
3. WHEN the HR user selects a result and confirms, THE Store SHALL transition the case `status` to `"closed"`, set `result` to the selected value, and update `updatedAt`.
4. WHEN the HR user confirms without selecting a result, THE Case_Detail SHALL prevent closure and display an inline error "Please select a result before closing".
5. WHEN the case transitions to `closed` via "Mark Sanction Completed", THE DB_Service SHALL write through both `status: "closed"` and the `result` value to Supabase; IF the database write fails, THE Store SHALL roll back the local status and result changes to their pre-action values and display an error toast to the user.
6. WHEN the case is closed via this action, THE Store SHALL emit an audit log entry with action `"sanction_completed"` and the selected result in `afterSnapshot`.

---

### Requirement 6: Case Result Field

**User Story:** As an HR officer, I want a dedicated result field on every closed case that records the final outcome for reporting, so that I can generate disciplinary outcome analytics.

#### Acceptance Criteria

1. THE Store's `DisciplinaryCase` interface SHALL include an optional `result` field of type `CaseResult | undefined`.
2. THE `CaseResult` type SHALL be a union of: `"DISMISSED" | "VERBAL_WARNING" | "WRITTEN_WARNING" | "FINAL_WARNING" | "SUSPENSION" | "TERMINATION" | "WITHDRAWN" | "SETTLED"`.
3. WHEN a case is closed through any path (NOD no-violation, manual Close Case, or Mark Sanction Completed), THE Store SHALL set `result` if a value is provided by the caller; IF no result is provided, `result` SHALL remain `undefined`.
4. WHEN the Case_Detail page renders a `closed` case with a non-null `result`, THE Case_Detail SHALL display the result in the Case Details card with the label "Outcome"; IF rendering the result value throws a runtime error, THE Case_Detail SHALL catch the error and display "—" in place of the outcome to prevent the page from crashing.
5. WHEN a case is written to Supabase, THE DB_Service SHALL map `result` to the `result` column in `disciplinary_cases`.
6. WHEN an existing case has no `result` value, THE system SHALL treat it as `undefined` and display "—" in the Outcome field.

---

### Requirement 7: Closed Case Read-Only Enforcement

**User Story:** As a system administrator, I want all edit, delete, and workflow-action controls to be hidden for closed cases, so that finalized cases cannot be accidentally modified.

#### Acceptance Criteria

1. WHEN a case has `status === "closed"` and the current user is HR/Admin, THE Case_Detail SHALL hide the "Edit" button.
2. WHEN a case has `status === "closed"` and the current user is HR/Admin, THE Case_Detail SHALL hide the "Delete" button.
4. WHEN a case has `status === "closed"`, THE Case_Detail SHALL hide the "Close Case" button (it is already closed) and SHALL hide all workflow-action buttons in the Timeline & Actions card (Issue NTE, Acknowledge NTE, Submit Explanation, Mark No-Response, Move to Review, Issue NOD, Acknowledge NOD, Mark Sanction Completed).
5. WHEN a case has `status === "closed"` and the current user is HR/Admin, THE Admin_View list row SHALL hide the "Edit" (pencil) and "Delete" (trash) icon buttons for that row; the "View" (eye) button SHALL remain visible.
6. WHEN a case has `status === "closed"` and the current user is an Employee, THE Employee_View SHALL display "View record" as the action label (it already does via `getNextAction`) and SHALL NOT display any write-action buttons.

---

### Requirement 8: KPI Card Accuracy Fixes

**User Story:** As an HR manager, I want the KPI cards and dashboard tiles to show accurate counts using the correct status groupings, so that I can trust the summary numbers at a glance.

#### Acceptance Criteria

1. WHEN the Admin_Dashboard renders, THE Admin_Dashboard SHALL compute `awaitingDisciplinaryResponse` as the count of cases where `status === "nte_issued" OR status === "nte_acknowledged" OR status === "no_response"`.
2. WHEN the Admin_Dashboard renders, THE Admin_Dashboard SHALL display the sub-label text as "awaiting explanation" (instead of "awaiting employee response") to accurately describe what the count represents.
3. WHEN the Admin_View "Case Overview" KPI tile "Awaiting NTE Response" renders, THE Admin_View SHALL count cases where `status === "nte_issued" OR status === "nte_acknowledged"`.
4. WHEN the Admin_View "Case Overview" KPI tile "Under Review" renders, THE Admin_View SHALL count cases where `status === "explanation_submitted" OR status === "no_response" OR status === "under_review"` (this is the existing `getDashboardStats().forReview` which is already correct; it SHALL be confirmed and kept).
5. WHEN the Admin_View "Case Overview" KPI tile "NOD Pending" renders, THE Admin_View SHALL count cases where `status === "nod_issued"` (this is the existing `getDashboardStats().nodPending` which is already correct; it SHALL be confirmed and kept).
6. WHEN the Employee_Dashboard renders, THE Employee_Dashboard SHALL compute `disciplinaryNeedsAction` as the count of cases where `status === "nte_issued" OR status === "nte_acknowledged" OR status === "nod_issued" OR status === "nod_acknowledged"`.
7. WHEN the Employee_View summary card "Needs My Action" renders, THE Employee_View SHALL use the same four-status set as the Employee_Dashboard: `nte_issued | nte_acknowledged | nod_issued | nod_acknowledged`.
8. WHEN a case has `status === "draft"`, THE Store's `getDashboardStats` SHALL NOT count draft cases in `awaitingExplanation`, `forReview`, `nodPending`, or `suspensionsActive`; draft cases SHALL count toward the `open` total until formally submitted.
