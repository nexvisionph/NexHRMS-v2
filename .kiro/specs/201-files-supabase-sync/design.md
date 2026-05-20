# Design Document

## Overview

This design wires the existing `useDocumentsStore` Zustand store to Supabase by adding a `documents201Db` service object in `db.service.ts` and a hydration + write-through subscription in `sync.service.ts`. The approach mirrors the exact patterns used by employees, attendance, payroll, and other modules — no new architectural concepts are introduced.

The `employee_201_documents` table already exists (migration 057). The Zustand store and admin UI are fully functional. This design fills the gap between them.

## Architecture

```
┌─────────────────────┐       ┌──────────────────────┐       ┌─────────────────────┐
│   Admin UI          │──────▶│  useDocumentsStore   │──────▶│  localStorage       │
│   (admin-view.tsx)  │       │  (Zustand)           │       │  (safePersistStorage)│
└─────────────────────┘       └──────────┬───────────┘       └─────────────────────┘
                                         │
                              ┌──────────▼───────────┐
                              │  sync.service.ts     │
                              │  - hydrate on login  │
                              │  - write-through sub │
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │  db.service.ts       │
                              │  documents201Db      │
                              └──────────┬───────────┘
                                         │
                              ┌──────────▼───────────┐
                              │  Supabase            │
                              │  employee_201_docs   │
                              │  + Storage bucket    │
                              └─────────────────────┘
```

## Components

### Component 1: documents201Db (db.service.ts)

**Purpose:** Typed CRUD operations for the `employee_201_documents` table.

**Requirements Addressed:** REQ-1, REQ-4

**Interface:**

```typescript
export const documents201Db = {
  fetchAll(): Promise<Employee201Document[]>;
  upsert(doc: Employee201Document): Promise<boolean>;
  batchUpsert(docs: Employee201Document[]): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  fetchExpiring(daysAhead?: number): Promise<Employee201Document[]>;
};
```

**Implementation Details:**

- `fetchAll` — calls `fetchAll<Employee201Document>("employee_201_documents")` using the existing generic helper. The `keysToCamel` conversion handles `employee_id` → `employeeId`, `document_type` → `documentType`, etc.
- `upsert` — calls `upsertRow("employee_201_documents", doc as Record<string, unknown>)`. The `keysToSnake` conversion handles the reverse mapping.
- `batchUpsert` — calls `batchUpsertRows("employee_201_documents", docs)` for bulk operations during initial sync.
- `remove` — calls `deleteRow("employee_201_documents", id)`.
- `fetchExpiring` — builds a custom query: `.from("employee_201_documents").select("*").gte("expiry_date", today).lte("expiry_date", today + daysAhead).not("status", "in", "(archived,expired)")`.

### Component 2: Hydration (sync.service.ts)

**Purpose:** Pull 201 documents from Supabase into the Zustand store on login.

**Requirements Addressed:** REQ-2

**Implementation Details:**

- Add `documents201Db` to the import list from `db.service.ts`.
- Add `useDocumentsStore` to the import list.
- In `hydrateAllStoresInternal`, add `documents201Db.fetchAll()` to Batch 2 (Projects + Comms + Tasks + Misc) since it's a lightweight table.
- After fetching, call `useDocumentsStore.setState({ documents: fetchedDocs })` — always replace (same pattern as attendance logs, tasks, etc.) so DB-side changes propagate.

### Component 3: Write-Through Subscription (sync.service.ts)

**Purpose:** Persist store mutations to Supabase automatically.

**Requirements Addressed:** REQ-3

**Implementation Details:**

- Add a new subscription block in `startWriteThrough()`:
  ```typescript
  // ─── Documents 201 write-through ──────────────────────
  _subscriptions.push(
    useDocumentsStore.subscribe(
      (state, prevState) => {
        if (_writePaused) return;
        // Only admin/hr can write documents
        if (!isAdminOrHr) return;

        // Detect new or changed documents
        for (const doc of state.documents) {
          const prev = prevState.documents.find((d) => d.id === doc.id);
          if (!prev || JSON.stringify(prev) !== JSON.stringify(doc)) {
            documents201Db.upsert(doc);
          }
        }
        // Detect deletions
        for (const prev of prevState.documents) {
          if (!state.documents.find((d) => d.id === prev.id)) {
            documents201Db.remove(prev.id);
          }
        }
      }
    )
  );
  ```

- Role guard: Only `admin` and `hr` roles trigger write-through (matches RLS policies in migration 057).
- The `_writePaused` check prevents writes during bulk resets.

### Component 4: File Upload Helper (db.service.ts) — Optional

**Purpose:** Upload actual files to Supabase Storage bucket `employee-documents`.

**Requirements Addressed:** REQ-5

**Interface:**

```typescript
export const documents201Storage = {
  upload(employeeId: string, documentType: string, file: File): Promise<{ path: string; error?: string }>;
  getSignedUrl(path: string, expiresIn?: number): Promise<string | null>;
};
```

**Implementation Details:**

- `upload` — uses `supabase().storage.from("employee-documents").upload(path, file)` where path = `${employeeId}/${documentType}/${file.name}`.
- `getSignedUrl` — uses `supabase().storage.from("employee-documents").createSignedUrl(path, expiresIn)` for time-limited access.
- The storage bucket and RLS policies already exist from migration 057 (Step 7).
- This is optional — the UI currently accepts a text path. When the file input is wired up later, this helper is ready.

## Data Flow

### Upload Flow

1. User fills upload form in admin-view.tsx → clicks "Upload"
2. `useDocumentsStore.upload()` creates a new `Employee201Document` in the store
3. Zustand triggers the write-through subscription
4. Subscription detects the new document (not in prevState)
5. `documents201Db.upsert(doc)` inserts the row into `employee_201_documents`

### Approve/Reject Flow

1. HR clicks "Approve" or "Reject" in the drilldown dialog
2. `useDocumentsStore.approve(id, reviewerId)` or `.reject(id, reviewerId, remarks)` updates the document in the store
3. Write-through subscription detects the status change (JSON comparison)
4. `documents201Db.upsert(updatedDoc)` updates the row in Supabase

### Hydration Flow

1. User logs in → `hydrateAllStores()` is called
2. `documents201Db.fetchAll()` fetches all rows from `employee_201_documents`
3. `useDocumentsStore.setState({ documents: rows })` replaces local state
4. UI re-renders with fresh data from the database

## Database Interaction

**Table:** `public.employee_201_documents` (already exists from migration 057)

**Column Mapping (snake_case → camelCase):**

| DB Column | TypeScript Field | Type |
|-----------|-----------------|------|
| id | id | text |
| employee_id | employeeId | text |
| document_type | documentType | Employee201DocType |
| document_title | documentTitle | text |
| file_path | filePath | text? |
| file_type | fileType | text? |
| file_size | fileSize | number? |
| status | status | Document201Status |
| visibility | visibility | Document201Visibility |
| expiry_date | expiryDate | string? |
| remarks | remarks | text? |
| uploaded_by | uploadedBy | text? |
| reviewed_by | reviewedBy | text? |
| reviewed_at | reviewedAt | string? |
| case_id | caseId | text? |
| created_at | createdAt | string |
| updated_at | updatedAt | string |

**No new migration needed** — migration 057 already creates this table with all required columns, indexes, RLS policies, and the storage bucket.

## Error Handling

- Network errors during hydration: logged via `console.error`, store left unchanged (localStorage fallback continues working)
- Network errors during write-through: suppressed in demo mode (`isDemoMode`), logged otherwise. Same pattern as all other stores.
- RLS violations (42501): suppressed in demo mode. In production, only admin/hr roles can write, matching the subscription guard.
- Duplicate key (23505): treated as success (data already exists).

## Performance Considerations

- The `employee_201_documents` table is expected to be small (< 1000 rows for most organizations). A single `fetchAll` is appropriate.
- The write-through uses JSON.stringify comparison — same as all other stores. For the expected document count, this is negligible.
- Batch 2 in hydration already has ~20 parallel fetches. Adding one more is within the safe limit.
- Indexes on `employee_id`, `status`, `(employee_id, document_type)`, and `expiry_date` are already created by migration 057.

## Testing Strategy

- Verify hydration: login → check that documents from Supabase appear in the 201 Files dashboard
- Verify write-through: upload a document → check that a row appears in `employee_201_documents` table
- Verify approve/reject: approve a document → check that `status`, `reviewed_by`, `reviewed_at` are updated in DB
- Verify archive: archive a document → check that `status = 'archived'` in DB
- Verify deletion: remove a document → check that the row is deleted from DB
- Verify offline fallback: disconnect Supabase → verify UI still works via localStorage
