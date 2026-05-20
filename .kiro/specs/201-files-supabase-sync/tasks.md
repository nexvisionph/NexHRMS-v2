# Implementation Plan: 201 Files Supabase Sync

## Overview

Wire the existing `useDocumentsStore` Zustand store to Supabase by adding a `documents201Db` service object in `db.service.ts` and hydration + write-through subscription in `sync.service.ts`. This follows the exact same patterns used by employees, attendance, payroll, and other modules already in the codebase.

## Tasks

- [x] 1. Add documents201Db service object to db.service.ts
  - [x] 1.1 Import Employee201Document type and create fetchAll method
    - Import `Employee201Document` type from `@/types`
    - Create `documents201Db.fetchAll()` that calls the generic `fetchAll<Employee201Document>("employee_201_documents")` helper
    - _Requirements: 1.1_
  - [x] 1.2 Create upsert method
    - Create `documents201Db.upsert(doc)` that calls `upsertRow("employee_201_documents", doc as Record<string, unknown>)`
    - _Requirements: 1.2_
  - [x] 1.3 Create batchUpsert method
    - Create `documents201Db.batchUpsert(docs)` that calls `batchUpsertRows("employee_201_documents", docs)`
    - _Requirements: 1.4_
  - [x] 1.4 Create remove method
    - Create `documents201Db.remove(id)` that calls `deleteRow("employee_201_documents", id)`
    - _Requirements: 1.3_
  - [x] 1.5 Create fetchExpiring method
    - Create `documents201Db.fetchExpiring(daysAhead = 30)` that queries documents where `expiry_date` is between today and today + daysAhead, excluding status `archived` and `expired`, ordered by `expiry_date` ascending
    - _Requirements: 1.5, 4.1, 4.2, 4.3_

- [x] 2. Add hydration for documents store in sync.service.ts
  - [x] 2.1 Import dependencies
    - Import `documents201Db` from `./db.service` in sync.service.ts
    - Import `useDocumentsStore` from `@/store/documents.store` in sync.service.ts
    - _Requirements: 2.1_
  - [x] 2.2 Add fetchAll to hydration batch
    - Add `documents201Db.fetchAll()` to the Batch 2 `Promise.all` array in `hydrateAllStoresInternal`
    - _Requirements: 2.1_
  - [x] 2.3 Set store state after fetch
    - After Batch 2 resolves, call `useDocumentsStore.setState({ documents: fetchedDocuments })` to replace local state with DB data (always set, even if empty array)
    - _Requirements: 2.2, 2.3_

- [x] 3. Checkpoint - Ensure hydration works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Add write-through subscription for documents store in sync.service.ts
  - [ ] 4.1 Add subscription block
    - Add a new `_subscriptions.push(useDocumentsStore.subscribe(...))` block in `startWriteThrough()`
    - _Requirements: 3.1_
  - [ ] 4.2 Add writePaused and role guards
    - Guard the subscription with `if (_writePaused) return` at the top of the callback
    - Guard the subscription with `if (!isAdminOrHr) return` to match RLS policies
    - _Requirements: 3.5, 6.1_
  - [ ] 4.3 Detect changes and upsert
    - Detect new or changed documents by comparing `state.documents` against `prevState.documents` using JSON.stringify, and call `documents201Db.upsert(doc)` for each changed document
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ] 4.4 Detect deletions and remove
    - Detect deleted documents (present in prevState but not in state) and call `documents201Db.remove(prev.id)` for each
    - _Requirements: 3.4_

- [ ] 5. Checkpoint - Ensure write-through works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Add optional file upload helper (documents201Storage)
  - [ ] 6.1 Create upload method
    - Create `documents201Storage.upload(employeeId, documentType, file)` that uploads to path `${employeeId}/${documentType}/${file.name}` in the `employee-documents` bucket and returns `{ path, error? }`
    - _Requirements: 5.1, 5.4_
  - [ ] 6.2 Create getSignedUrl method
    - Create `documents201Storage.getSignedUrl(path, expiresIn = 3600)` that creates a signed URL for the given file path
    - _Requirements: 5.2_
  - [ ] 6.3 Add error handling
    - Handle upload errors gracefully — return `{ path: "", error: errorMessage }` without modifying any document record
    - _Requirements: 5.3_

- [ ] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks 1.1 sub-items (Import type and fetchAll) are already completed
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major phases
- The file upload helper (Task 6) is optional and can be deferred
- No new migration is needed — migration 057 already provides the table, indexes, RLS policies, and storage bucket
- The implementation uses TypeScript and follows existing patterns in db.service.ts and sync.service.ts

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3", "4.4"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3"] }
  ]
}
```
