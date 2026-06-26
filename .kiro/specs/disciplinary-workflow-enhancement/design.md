# Design Document — Disciplinary Workflow Enhancement

## Overview

This document describes the technical design for eight enhancements to the NexHRMS-v2 disciplinary module. The changes are additive and backward-compatible. The implementation follows the existing Zustand + write-through Supabase pattern — no new API routes are introduced. All UI is built with shadcn/ui components already in the project.

The eight enhancement areas are:

1. Severity Level field
2. Witnesses field
3. Draft status
4. Investigation Notes
5. Mark Sanction Completed action
6. Case Result field
7. Closed-case read-only enforcement
8. KPI card accuracy fixes

---

## Architecture

The feature lives entirely within the existing disciplinary sub-system. No new top-level modules are introduced. The change layers are:

```
DB (Supabase)
  ↑ upsert / insert
DB_Service  (src/services/db.service.ts — disciplinaryDb)
  ↑ write-through
Zustand Store  (src/store/disciplinary.store.ts)
  ↑ actions / selectors
UI Components
  ├── admin-view.tsx        (list + create/edit dialogs + KPI tiles)
  ├── [caseId]/page.tsx     (timeline + actions + new sections)
  ├── employee-view.tsx     (summary cards)
  ├── admin-dashboard.tsx   (global KPI tile)
  └── employee-dashboard.tsx (global KPI tile)
```

Supabase realtime already pushes `disciplinary_cases` updates to connected clients via migration 064, so write-through changes will propagate automatically.

---

## Components and Interfaces

### 1. TypeScript Types (`src/types/index.ts`)

#### 1.1 `SeverityLevel`

```typescript
export type SeverityLevel = "minor" | "moderate" | "major" | "critical";
```

#### 1.2 `CaseResult`

```typescript
export type CaseResult =
  | "DISMISSED"
  | "VERBAL_WARNING"
  | "WRITTEN_WARNING"
  | "FINAL_WARNING"
  | "SUSPENSION"
  | "TERMINATION"
  | "WITHDRAWN"
  | "SETTLED";
```

#### 1.3 `DisciplinaryCaseStatus` — add `"draft"`

```typescript
export type DisciplinaryCaseStatus =
  | "draft"               // ← new
  | "open" | "nte_issued" | "nte_acknowledged" | "explanation_submitted"
  | "no_response" | "under_review" | "nod_issued" | "nod_acknowledged"
  | "sanction_active" | "closed";
```

#### 1.4 `DisciplinaryCase` — add new optional fields

```typescript
export interface DisciplinaryCase {
  // … existing fields unchanged …
  severityLevel?: SeverityLevel;   // ← new
  witnesses?: string;              // ← new
  result?: CaseResult;             // ← new
}
```

#### 1.5 `DisciplinaryNote` — new type

```typescript
export interface DisciplinaryNote {
  id: string;
  caseId: string;
  authorId: string;
  body: string;
  createdAt: string; // ISO 8601
}
```

---

### 2. Zustand Store (`src/store/disciplinary.store.ts`)

#### 2.1 State additions

```typescript
notes: DisciplinaryNote[];
```

#### 2.2 New actions

| Action | Signature | Description |
|---|---|---|
| `saveDraft` | `(data: CreateCaseData) => DisciplinaryCase` | Creates case with `status: "draft"`, suppresses employee notification |
| `submitCase` | `(caseId: string, by: string) => void` | Transitions `draft → open`, triggers notification, writes through |
| `addNote` | `(caseId: string, body: string, authorId: string) => DisciplinaryNote` | Appends a note, writes through to DB |
| `completeSanction` | `(caseId: string, result: CaseResult, by: string) => Promise<void>` | Transitions `sanction_active → closed`, sets `result`, writes through with rollback on failure |
| `setNotes` | `(n: DisciplinaryNote[]) => void` | Hydration setter |

#### 2.3 Modified actions

**`createCase`**: Accept optional `severityLevel`, `witnesses`, `result`, and `status` (to allow direct `"open"` creation). The existing call sites default to `status: "open"`.

**`updateCase`**: Accept `severityLevel` and `witnesses` in the partial update payload so the edit dialog can persist them.

**`closeCase`**: Accept optional `result?: CaseResult` parameter; set it on the case if provided.

**`getDashboardStats`**: Update to:
- Exclude `draft` from `awaitingExplanation`, `forReview`, `nodPending`, `suspensionsActive`
- `awaitingExplanation` counts `nte_issued | nte_acknowledged` only (no `no_response` — `no_response` goes into `forReview`)

#### 2.4 `completeSanction` rollback pattern

Because this action requires a DB write before it can be considered final, it follows the optimistic-update-with-rollback pattern already used elsewhere in the codebase:

```
1. Snapshot current case state
2. Apply local state change optimistically
3. Attempt DB write
4. On failure: revert to snapshot, show error toast, return
5. On success: emit audit log, show success toast
```

#### 2.5 Updated `DisciplinaryState` interface additions

```typescript
notes: DisciplinaryNote[];
saveDraft: (data: Omit<DisciplinaryCase, "id"|"caseNumber"|"createdAt"|"updatedAt"|"status">) => DisciplinaryCase;
submitCase: (caseId: string, by: string) => void;
addNote: (caseId: string, body: string, authorId: string) => DisciplinaryNote;
completeSanction: (caseId: string, result: CaseResult, by: string) => Promise<void>;
getNotesByCase: (caseId: string) => DisciplinaryNote[];
setNotes: (n: DisciplinaryNote[]) => void;
```

---

### 3. DB Service (`src/services/db.service.ts`)

Add to `disciplinaryDb`:

```typescript
fetchNotes: () => fetchAll<DisciplinaryNote>("disciplinary_notes"),
async upsertNote(n: DisciplinaryNote): Promise<boolean> {
  return upsertRow("disciplinary_notes", n as unknown as Record<string, unknown>);
},
```

The `upsertCase` method already handles the full `DisciplinaryCase` object; the new fields (`severity_level`, `witnesses`, `result`) will be included automatically once the DB columns and camelCase↔snake_case mapping are correct (see DB schema section).

---

## Data Models

### DB Migration `065_disciplinary_enhancements.sql`

```sql
BEGIN;

-- 1. Add new columns to disciplinary_cases (all nullable for backward-compat)
ALTER TABLE public.disciplinary_cases
  ADD COLUMN IF NOT EXISTS severity_level text
    CHECK (severity_level IN ('minor','moderate','major','critical')),
  ADD COLUMN IF NOT EXISTS witnesses text,
  ADD COLUMN IF NOT EXISTS result text
    CHECK (result IN ('DISMISSED','VERBAL_WARNING','WRITTEN_WARNING',
                      'FINAL_WARNING','SUSPENSION','TERMINATION',
                      'WITHDRAWN','SETTLED'));

-- 2. Add 'draft' to the status CHECK constraint
-- Note: Supabase does not support ALTER TABLE ... ALTER COLUMN ... SET CHECK in place.
-- We drop and recreate the constraint.
ALTER TABLE public.disciplinary_cases
  DROP CONSTRAINT IF EXISTS disciplinary_cases_status_check;

ALTER TABLE public.disciplinary_cases
  ADD CONSTRAINT disciplinary_cases_status_check
    CHECK (status IN (
      'draft','open','nte_issued','nte_acknowledged','explanation_submitted',
      'no_response','under_review','nod_issued','nod_acknowledged',
      'sanction_active','closed'
    ));

-- 3. Investigation notes table
CREATE TABLE IF NOT EXISTS public.disciplinary_notes (
  id         text PRIMARY KEY,
  case_id    text NOT NULL REFERENCES public.disciplinary_cases(id) ON DELETE CASCADE,
  author_id  text NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disc_notes_case ON public.disciplinary_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_disc_notes_author ON public.disciplinary_notes(author_id);

-- 4. RLS on disciplinary_notes
ALTER TABLE public.disciplinary_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disc notes hr full" ON public.disciplinary_notes;
CREATE POLICY "disc notes hr full" ON public.disciplinary_notes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin','hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin','hr')
    )
  );

-- Employees may read notes on their own cases (read-only)
DROP POLICY IF EXISTS "disc notes employee read own" ON public.disciplinary_notes;
CREATE POLICY "disc notes employee read own" ON public.disciplinary_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.disciplinary_cases dc
      JOIN public.employees e ON e.id = dc.employee_id
      WHERE dc.id = disciplinary_notes.case_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

-- 5. updated_at trigger (not needed for notes — created_at is immutable)

COMMIT;
```

#### camelCase ↔ snake_case mapping

The existing `fetchAll` helper uses Supabase's auto-camelCase transformation. The new columns follow the same pattern:

| TypeScript field | DB column |
|---|---|
| `severityLevel` | `severity_level` |
| `witnesses` | `witnesses` |
| `result` | `result` |
| `DisciplinaryNote.caseId` | `case_id` |
| `DisciplinaryNote.authorId` | `author_id` |
| `DisciplinaryNote.body` | `body` |
| `DisciplinaryNote.createdAt` | `created_at` |

---

### 4. Admin View (`src/app/[role]/disciplinary/_views/admin-view.tsx`)

#### 4.1 Create Case dialog changes

- Add `severityLevel` and `witnesses` to the form state.
- Add a "Severity Level" `<Select>` (required) and a "Witnesses" `<Input>` (optional) to the dialog layout.
- Split the "Create Case" button into two actions:
  - **"Save as Draft"** — calls `saveDraft()`, no toast notification to employee.
  - **"Create Case"** — calls `createCase()` with `status: "open"`.
- Validation: if `severityLevel` is empty on "Create Case", show `toast.error("Severity level is required")` and block.

#### 4.2 Edit Case dialog changes

- Add `severityLevel` and `witnesses` to the `editForm` state.
- Add matching fields to the edit dialog form layout.
- Pass them through to `updateCase`.

#### 4.3 Case list table changes

- Filter the displayed rows to exclude `status === "draft"` cases (draft cases only appear in Open count, not the working list).
- In the Actions column, hide Edit and Delete buttons when `c.status === "closed"`.

#### 4.4 STATUS_LABELS / STATUS_TONE additions

```typescript
const STATUS_LABELS: Record<DisciplinaryCaseStatus, string> = {
  draft: "Draft",  // ← new
  // … existing …
};

const STATUS_TONE: Record<DisciplinaryCaseStatus, string> = {
  draft: "bg-slate-100 text-slate-500 border border-dashed",  // ← new, visually distinct
  // … existing …
};
```

#### 4.5 KPI tile values

The `getDashboardStats()` selector is the source of truth for all tile values. The Admin_View already reads `stats.awaitingExplanation` for the "Awaiting NTE Response" tile — no tile-level changes needed once the store selector is fixed.

---

### 5. Case Detail Page (`src/app/[role]/disciplinary/[caseId]/page.tsx`)

#### 5.1 New store bindings

```typescript
const addNote = useDisciplinaryStore((s) => s.addNote);
const getNotesByCase = useDisciplinaryStore((s) => s.getNotesByCase);
const completeSanction = useDisciplinaryStore((s) => s.completeSanction);
const submitCase = useDisciplinaryStore((s) => s.submitCase);
const notes = getNotesByCase(caseId);
```

#### 5.2 Closed-case read-only guard

Add a derived boolean:

```typescript
const isClosed = c.status === "closed";
```

- Wrap the Edit and Delete buttons in `{isStaff && !isClosed && ...}`.
- Wrap the Close Case button in `{isStaff && !isClosed && ...}`.
- Each Step body that renders action buttons must check `!isClosed` before rendering the button.

#### 5.3 Draft → Open submission button

When `isStaff && c.status === "draft"`:

```tsx
<Button size="sm" onClick={() => { submitCase(c.id, currentUser.id); toast.success("Case submitted"); }}>
  Submit Case
</Button>
```

#### 5.4 Severity, Witnesses, Outcome in Case Details card

Add three new `<Row>` entries to the Case Details card:

```tsx
<Row label="Severity" value={c.severityLevel ?? "—"} />
<Row label="Witnesses" value={c.witnesses || "—"} />
{c.status === "closed" && (
  <Row label="Outcome" value={(() => { try { return c.result ?? "—"; } catch { return "—"; } })()} />
)}
```

#### 5.5 Investigation Notes section

Rendered below the two-column grid, visible to HR/Admin whenever a case exists:

```tsx
{isStaff && (
  <Card>
    <CardHeader>
      <CardTitle>Investigation Notes</CardTitle>
    </CardHeader>
    <CardContent>
      {/* Read-only list of existing notes (reverse-chronological) */}
      {notes.sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(n => (
        <NoteRow key={n.id} note={n} employees={employees} />
      ))}
      {/* Add Note form — only when under_review */}
      {c.status === "under_review" && (
        <AddNoteForm caseId={c.id} authorId={currentUser.id} onAdd={addNote} />
      )}
    </CardContent>
  </Card>
)}
```

`NoteRow` and `AddNoteForm` are small local components in the same file.

#### 5.6 Mark Sanction Completed

In the Timeline step for `sanction_active`, add:

```tsx
{isStaff && c.status === "sanction_active" && !isClosed && (
  <Button size="sm" onClick={() => setSanctionCompleteOpen(true)}>
    Mark Sanction Completed
  </Button>
)}
```

Dialog state:

```typescript
const [sanctionCompleteOpen, setSanctionCompleteOpen] = useState(false);
const [selectedResult, setSelectedResult] = useState<CaseResult | "">("");
const [resultError, setResultError] = useState("");
```

On confirm:

```typescript
if (!selectedResult) { setResultError("Please select a result before closing"); return; }
await completeSanction(c.id, selectedResult, currentUser.id);
toast.success("Sanction marked as completed");
setSanctionCompleteOpen(false);
```

---

### 6. Employee View (`src/app/[role]/disciplinary/_views/employee-view.tsx`)

Update the `awaitingMe` computation:

```typescript
const awaitingMe = myCases.filter((c) =>
  ["nte_issued", "nte_acknowledged", "nod_issued", "nod_acknowledged"].includes(c.status)
).length;
```

The `getNextAction` already returns "View record" for `closed`. No other changes needed.

---

### 7. Admin Dashboard (`src/components/dashboard/admin-dashboard.tsx`)

Replace the `awaitingDisciplinaryResponse` computation:

```typescript
const awaitingDisciplinaryResponse = disciplinaryCases.filter(
  (c) => c.status === "nte_issued" || c.status === "nte_acknowledged" || c.status === "no_response"
).length;
```

Update the sub-label in the stats array:

```typescript
change: `${awaitingDisciplinaryResponse} awaiting explanation`,
```

---

### 8. Employee Dashboard (`src/components/dashboard/employee-dashboard.tsx`)

Update `disciplinaryNeedsAction`:

```typescript
const disciplinaryNeedsAction = myDisciplinaryCases.filter(
  (c) => ["nte_issued", "nte_acknowledged", "nod_issued", "nod_acknowledged"].includes(c.status)
).length;
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

After property reflection:

- Properties 1.4 (store persists severityLevel) and 2.3 (store persists witnesses) are both "store round-trip" properties and can be combined into one: "new case fields are preserved".
- Properties 7.1, 7.2, and 7.3 (hide Edit, Delete, and all workflow buttons for closed cases) can be combined into one read-only enforcement property.
- Properties 8.1 (admin dashboard awaiting count) and 8.6 (employee dashboard needs-action) are both about correct status-set counting and can each be a single property for their domain.

### Property 1: New case fields are preserved by the store

*For any* valid `severityLevel` value (including `undefined`) and any `witnesses` string (including empty), calling `createCase` with those values should produce a `DisciplinaryCase` where `severityLevel === input.severityLevel` and `witnesses === input.witnesses`.

**Validates: Requirements 1.4, 2.3**

---

### Property 2: Draft creation suppresses notifications and sets draft status

*For any* valid case creation payload, calling `saveDraft` should produce a case with `status === "draft"` and should not invoke `dispatchNotification` for the employee.

**Validates: Requirements 3.2**

---

### Property 3: getDashboardStats excludes drafts from non-open buckets

*For any* collection of `DisciplinaryCase` objects that includes cases with `status === "draft"`, `getDashboardStats()` should return `awaitingExplanation`, `forReview`, `nodPending`, and `suspensionsActive` values that do not count any draft case.

**Validates: Requirements 3.3, 8.8**

---

### Property 4: Draft-to-open transition produces correct state

*For any* draft case, calling `submitCase` should transition the case to `status === "open"` with an `updatedAt` timestamp strictly greater than the original `updatedAt`.

**Validates: Requirements 3.7**

---

### Property 5: addNote preserves body, authorId, and caseId

*For any* non-empty body string, caseId, and authorId, calling `addNote` should produce a `DisciplinaryNote` where `note.body === body`, `note.authorId === authorId`, `note.caseId === caseId`, and `note.createdAt` is a valid ISO 8601 timestamp.

**Validates: Requirements 4.3**

---

### Property 6: Notes are displayed in reverse-chronological order

*For any* list of `DisciplinaryNote` objects, rendering the Investigation Notes section should display them ordered by `createdAt` descending (newest first).

**Validates: Requirements 4.6**

---

### Property 7: completeSanction sets closed status and result

*For any* valid `CaseResult` value, calling `completeSanction` on a `sanction_active` case should produce a case with `status === "closed"` and `result === input`.

**Validates: Requirements 5.3**

---

### Property 8: closeCase result field round-trip

*For any* `CaseResult` value or `undefined`, closing a case with that result should produce a `DisciplinaryCase` where `result === input`.

**Validates: Requirements 6.3**

---

### Property 9: Closed cases have no write-action buttons rendered

*For any* closed `DisciplinaryCase`, the Case_Detail page rendered with an HR/Admin user should not contain the Edit button, Delete button, or any workflow-action buttons (Issue NTE, Acknowledge NTE, Submit Explanation, Mark No-Response, Move to Review, Issue NOD, Acknowledge NOD, Mark Sanction Completed).

**Validates: Requirements 7.1, 7.2, 7.3**

---

### Property 10: Admin list row hides Edit and Delete for closed cases

*For any* closed `DisciplinaryCase` rendered in the Admin_View list, the row should contain the View button and should not contain Edit or Delete buttons.

**Validates: Requirements 7.4**

---

### Property 11: Admin Dashboard awaiting count uses three-status set

*For any* collection of `DisciplinaryCase` objects, the `awaitingDisciplinaryResponse` count computed in Admin_Dashboard should equal the count of cases where `status ∈ {nte_issued, nte_acknowledged, no_response}`.

**Validates: Requirements 8.1**

---

### Property 12: Employee needs-action count uses four-status set

*For any* collection of employee `DisciplinaryCase` objects, `disciplinaryNeedsAction` computed in Employee_Dashboard and `awaitingMe` in Employee_View should equal the count of cases where `status ∈ {nte_issued, nte_acknowledged, nod_issued, nod_acknowledged}`.

**Validates: Requirements 8.6, 8.7**

---

## Error Handling

| Scenario | Handling |
|---|---|
| `completeSanction` DB write fails | Revert optimistic local change, `toast.error("Failed to close case — please try again")` |
| `addNote` DB write fails | Remove note from local store, `toast.error("Failed to save note")` |
| `submitCase` DB write fails | Revert status to `"draft"`, `toast.error("Failed to submit case")` |
| Rendering `c.result` throws | Catch in try/catch inside the `Row` render, display `"—"` |
| Severity not selected on submit | Inline validation: `toast.error("Severity level is required")`, block `createCase` |
| Note body is whitespace-only | Inline validation: `toast.error("Note cannot be empty")`, block `addNote` |
| `completeSanction` called without result | Inline state error displayed in dialog, block confirm action |

All DB write-through failures follow the same rollback pattern: snapshot → optimistic apply → attempt write → on failure revert snapshot + show error. This is consistent with existing patterns in the codebase (e.g., `deleteCase` already uses immediate local mutation; `completeSanction` is the first action that needs async rollback because its result has reporting significance).

---

## Testing Strategy

### Unit Tests

- Test `getDashboardStats` with fixed case arrays including `draft`, `closed`, `nte_issued`, etc., to verify bucket counts.
- Test `createCase` / `saveDraft` to assert fields on returned object.
- Test `addNote` to assert returned `DisciplinaryNote` structure.
- Test `completeSanction` with a mock DB that succeeds and one that fails (rollback path).
- Test `submitCase` with a draft case.
- Test `closeCase` with and without a result value.

### Property-Based Tests

The project does not currently use a PBT library. Given this is a TypeScript/Next.js project, the appropriate library is **fast-check** (`npm install --save-dev fast-check`).

Each property test must run a minimum of **100 iterations**. Tag each test with a comment referencing its design property:

`// Feature: disciplinary-workflow-enhancement, Property N: <property_text>`

Property tests target the **pure store logic** (Zustand state transitions) and **pure UI logic** (button visibility derived from case status). They do not test Supabase calls directly — those are covered by integration tests.

### Integration Tests

- Verify `disciplinary_cases.severity_level`, `witnesses`, `result` columns exist and accept valid enum values.
- Verify `disciplinary_notes` table exists with correct schema and RLS.
- Verify `status === "draft"` is accepted by the CHECK constraint.
- Verify `disciplinaryDb.upsertCase` correctly persists the new fields (1–2 example cases).
