# Implementation Plan: Disciplinary Workflow Enhancement

## Overview

Implement the eight disciplinary workflow enhancements in layered order: DB migration → TypeScript types → Zustand store → DB service → UI components. Each layer builds on the previous. All changes are backward-compatible.

---

## Tasks

- [x] 1. Create DB migration `065_disciplinary_enhancements.sql`
  - Create `supabase/migrations/065_disciplinary_enhancements.sql`
  - Add `severity_level`, `witnesses`, and `result` nullable columns to `disciplinary_cases`
  - Drop and recreate the `status` CHECK constraint to include `"draft"`
  - Create the `disciplinary_notes` table with `id`, `case_id`, `author_id`, `body`, `created_at`
  - Add indexes on `disciplinary_notes(case_id)` and `disciplinary_notes(author_id)`
  - Enable RLS on `disciplinary_notes` with HR full-access policy and employee read-own policy
  - _Requirements: 1.5, 2.4, 3.1, 4.4, 5.5, 6.5_

- [x] 2. Update TypeScript types in `src/types/index.ts`
  - [x] 2.1 Add `SeverityLevel` type: `"minor" | "moderate" | "major" | "critical"`
    - _Requirements: 1.1, 1.4_
  - [x] 2.2 Add `CaseResult` type: `"DISMISSED" | "VERBAL_WARNING" | "WRITTEN_WARNING" | "FINAL_WARNING" | "SUSPENSION" | "TERMINATION" | "WITHDRAWN" | "SETTLED"`
    - _Requirements: 6.1, 6.2_
  - [x] 2.3 Add `"draft"` to `DisciplinaryCaseStatus` union
    - _Requirements: 3.1_
  - [x] 2.4 Add optional fields to `DisciplinaryCase` interface: `severityLevel?: SeverityLevel`, `witnesses?: string`, `result?: CaseResult`
    - _Requirements: 1.4, 2.3, 6.1_
  - [x] 2.5 Add `DisciplinaryNote` interface with `id`, `caseId`, `authorId`, `body`, `createdAt`
    - _Requirements: 4.3_

- [ ] 3. Update Zustand store `src/store/disciplinary.store.ts`
  - [x] 3.1 Add `notes: DisciplinaryNote[]` to state and `setNotes` hydration setter
    - _Requirements: 4.3_
  - [x] 3.2 Extend `createCase` to accept and persist `severityLevel`, `witnesses`, and optionally `result` on the returned object; default `status` remains `"open"`
    - _Requirements: 1.4, 2.3_
  - [x] 3.3 Write property test for `createCase` new-fields preservation (Property 1)
    - **Property 1: New case fields are preserved by the store**
    - **Validates: Requirements 1.4, 2.3**
  - [x] 3.4 Add `saveDraft` action: creates a case with `status: "draft"`, skips `dispatchNotification`, writes through to DB
    - _Requirements: 3.2, 3.4_
  - [x] 3.5 Write property test for `saveDraft` notification suppression and draft status (Property 2)
    - **Property 2: Draft creation suppresses notifications and sets draft status**
    - **Validates: Requirements 3.2**
  - [x] 3.6 Fix `getDashboardStats` to count `awaitingExplanation` as `nte_issued | nte_acknowledged` only (exclude `no_response` — it is already in `forReview`); exclude `draft` from all non-open buckets
    - _Requirements: 8.3, 8.8_
  - [x] 3.7 Write property test for `getDashboardStats` draft exclusion (Property 3)
    - **Property 3: getDashboardStats excludes drafts from non-open buckets**
    - **Validates: Requirements 3.3, 8.8**
  - [x] 3.8 Add `submitCase` action: transitions `draft → open`, triggers `dispatchNotification`, writes updated case to DB via `disciplinaryDb.upsertCase`; rollback on DB failure
    - _Requirements: 3.7_
  - [x] 3.9 Write property test for `submitCase` state transition (Property 4)
    - **Property 4: Draft-to-open transition produces correct state**
    - **Validates: Requirements 3.7**
  - [x] 3.10 Add `addNote` action: validates non-empty body, appends `DisciplinaryNote` to local state, writes to DB via `disciplinaryDb.upsertNote`; rollback on DB failure
    - _Requirements: 4.3, 4.5_
  - [x] 3.11 Write property test for `addNote` field preservation (Property 5)
    - **Property 5: addNote preserves body, authorId, and caseId**
    - **Validates: Requirements 4.3**
  - [x] 3.12 Add `getNotesByCase` selector: returns notes filtered by caseId
    - _Requirements: 4.3, 4.6_
  - [x] 3.13 Add `completeSanction` action: optimistic update `status → "closed"` and `result → input`, attempt DB write, rollback on failure, emit audit log with `"sanction_completed"`
    - _Requirements: 5.3, 5.5, 5.6_
  - [x] 3.14 Write property test for `completeSanction` status and result (Property 7)
    - **Property 7: completeSanction sets closed status and result**
    - **Validates: Requirements 5.3**
  - [x] 3.15 Extend `closeCase` to accept optional `result?: CaseResult` and set it on the case
    - _Requirements: 6.3_
  - [x] 3.16 Write property test for `closeCase` result round-trip (Property 8)
    - **Property 8: closeCase result field round-trip**
    - **Validates: Requirements 6.3**
  - [x] 3.17 Extend `updateCase` accepted partial payload to include `severityLevel` and `witnesses`
    - _Requirements: 1.3, 2.2_

- [x] 4. Checkpoint — Ensure all store tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update DB service `src/services/db.service.ts`
  - Add `fetchNotes: () => fetchAll<DisciplinaryNote>("disciplinary_notes")` to `disciplinaryDb`
  - Add `upsertNote(n: DisciplinaryNote): Promise<boolean>` to `disciplinaryDb`
  - _Requirements: 4.4_

- [ ] 6. Update Admin View `src/app/[role]/disciplinary/_views/admin-view.tsx`
  - [~] 6.1 Add `"draft"` to `STATUS_LABELS` and `STATUS_TONE` maps
    - `STATUS_LABELS.draft = "Draft"`, `STATUS_TONE.draft = "bg-slate-100 text-slate-500 border border-dashed"`
    - _Requirements: 3.5_
  - [~] 6.2 Add `severityLevel` and `witnesses` fields to the Create Case form state and dialog UI
    - Add `severityLevel: ""` and `witnesses: ""` to `form` state
    - Add a "Severity Level" `<Select>` (required; options: minor/moderate/major/critical) and a "Witnesses" `<Input>` (optional) to the dialog
    - _Requirements: 1.1, 1.2, 2.1_
  - [~] 6.3 Split the Create Case dialog submit into "Save as Draft" and "Create Case" buttons
    - "Save as Draft" calls `saveDraft()`; "Create Case" validates `severityLevel` is non-empty then calls `createCase()`
    - _Requirements: 3.2, 3.4_
  - [~] 6.4 Add `severityLevel` and `witnesses` fields to the Edit Case form state and dialog UI
    - Pre-populate from `editingCase`, pass through to `updateCase`
    - _Requirements: 1.3, 2.2_
  - [~] 6.5 Filter case list rows to exclude `status === "draft"` cases
    - Update the `rows` memo to add `.filter((c) => c.status !== "draft")`
    - _Requirements: 3.3_
  - [~] 6.6 Hide Edit and Delete buttons for closed case rows in the list table
    - Wrap pencil and trash `<Button>` elements: `{c.status !== "closed" && ...}`
    - _Requirements: 7.4_
  - [~] 6.7 Write property test for Admin_View list row — closed case shows only View button (Property 10)
    - **Property 10: Admin list row hides Edit and Delete for closed cases**
    - **Validates: Requirements 7.4**

- [ ] 7. Update Case Detail Page `src/app/[role]/disciplinary/[caseId]/page.tsx`
  - [~] 7.1 Add `isClosed` derived boolean and gate Edit, Delete, and Close Case buttons
    - `const isClosed = c.status === "closed";`
    - Wrap Edit: `{isStaff && !isClosed && <Button>Edit</Button>}`
    - Wrap Delete: `{isStaff && !isClosed && <AlertDialog>…</AlertDialog>}`
    - Wrap Close Case: `{isStaff && !isClosed && <AlertDialog>…</AlertDialog>}`
    - _Requirements: 7.1, 7.2, 7.3_
  - [~] 7.2 Gate all Timeline step action buttons with `!isClosed`
    - Each action button inside `<Step>` bodies must check `!isClosed` before rendering
    - _Requirements: 7.3_
  - [~] 7.3 Write property test for Case_Detail closed-case read-only (Property 9)
    - **Property 9: Closed cases have no write-action buttons rendered**
    - **Validates: Requirements 7.1, 7.2, 7.3**
  - [~] 7.4 Add Severity, Witnesses, and Outcome rows to the Case Details card
    - Add `<Row label="Severity" value={c.severityLevel ?? "—"} />`
    - Add `<Row label="Witnesses" value={c.witnesses || "—"} />`
    - Add `{c.status === "closed" && <Row label="Outcome" value={(() => { try { return c.result ?? "—"; } catch { return "—"; } })()} />}`
    - _Requirements: 1.6, 1.7, 2.5, 6.4, 6.6_
  - [~] 7.5 Add "Submit Case" button for draft cases
    - `{isStaff && c.status === "draft" && <Button onClick={() => { submitCase(c.id, currentUser.id); toast.success("Case submitted"); }}>Submit Case</Button>}`
    - _Requirements: 3.6, 3.7_
  - [~] 7.6 Add Investigation Notes section
    - Add `notes`, `addNote`, `getNotesByCase` bindings from the store
    - Render an Investigation Notes `<Card>` visible to HR/Admin at all times
    - Render existing notes in reverse-chronological order (each showing author name, body, timestamp)
    - Show "Add Note" form only when `c.status === "under_review"`
    - Validate note body is non-empty / non-whitespace before calling `addNote`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7_
  - [~] 7.7 Write property test for notes reverse-chronological order (Property 6)
    - **Property 6: Notes are displayed in reverse-chronological order**
    - **Validates: Requirements 4.6**
  - [~] 7.8 Add "Mark Sanction Completed" button and dialog
    - Add `sanctionCompleteOpen`, `selectedResult`, `resultError` local state
    - Render button only when `isStaff && c.status === "sanction_active" && !isClosed`
    - Dialog contains a required "Case Result" `<Select>` with all eight `CaseResult` options
    - On confirm: validate result selected, call `completeSanction`, handle success/error toasts
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [~] 8. Checkpoint — Ensure all component tests pass and the UI renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Fix KPI counts in Admin Dashboard `src/components/dashboard/admin-dashboard.tsx`
  - Replace `awaitingDisciplinaryResponse` filter with three-status set: `nte_issued | nte_acknowledged | no_response`
  - Update the stats array sub-label: `change: \`${awaitingDisciplinaryResponse} awaiting explanation\``
  - _Requirements: 8.1, 8.2_
  - [~] 9.1 Write property test for Admin Dashboard awaiting count (Property 11)
    - **Property 11: Admin Dashboard awaiting count uses three-status set**
    - **Validates: Requirements 8.1**

- [ ] 10. Fix KPI counts in Employee Dashboard and Employee View
  - [~] 10.1 Update `disciplinaryNeedsAction` in `src/components/dashboard/employee-dashboard.tsx` to use four-status set: `nte_issued | nte_acknowledged | nod_issued | nod_acknowledged`
    - _Requirements: 8.6_
  - [~] 10.2 Update `awaitingMe` in `src/app/[role]/disciplinary/_views/employee-view.tsx` to use the same four-status set
    - Add `"nod_acknowledged"` to the existing three-status filter
    - _Requirements: 8.7_
  - [~] 10.3 Write property test for Employee Dashboard and Employee View needs-action count (Property 12)
    - **Property 12: Employee needs-action count uses four-status set**
    - **Validates: Requirements 8.6, 8.7**

- [~] 11. Wire `disciplinary_notes` into the hydration/sync lifecycle
  - In `src/services/db.service.ts`, ensure `fetchNotes` is exported from `disciplinaryDb`
  - In `src/store/disciplinary.store.ts`, ensure `setNotes` is called by the sync service during initial hydration (follow the same pattern as `setCases`, `setNTEs`, `setNODs`)
  - Update the employee-view's `fetchMyDisciplinaryRecords` to also fetch notes and merge them via `setNotes`
  - _Requirements: 4.4_

- [~] 12. Final checkpoint — All tests pass, no TypeScript errors
  - Run `tsc --noEmit` to verify no type errors
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests require installing `fast-check` (`npm install --save-dev fast-check`)
- The SQL migration (Task 1) must be run against the Supabase project before any other task can be tested end-to-end
- Existing cases with `null` severity/witnesses/result are fully backward-compatible — all new fields are nullable in the DB and optional in TypeScript
- The `draft` status does not appear in the main case list; HR users access drafts via a separate filter or the Open count

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3"] },
    { "wave": 4, "tasks": ["4"] },
    { "wave": 5, "tasks": ["5"] },
    { "wave": 6, "tasks": ["6", "7", "9", "10"] },
    { "wave": 7, "tasks": ["11"] },
    { "wave": 8, "tasks": ["8"] },
    { "wave": 9, "tasks": ["12"] }
  ]
}
```
