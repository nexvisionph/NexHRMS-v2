# Requirements Document

## Introduction

Wire up the existing 201 Files (Employee Document Repository) module's Zustand store to the Supabase backend. The UI and store logic are already complete — this feature adds the database service layer, sync/hydration, and optionally file upload to Supabase Storage. The implementation follows the exact same patterns used by other stores (employees, leave, attendance, etc.) in `db.service.ts` and `sync.service.ts`.

## Glossary

- **Documents_Store**: The Zustand store (`useDocumentsStore`) that holds all 201 document state locally with localStorage persistence
- **DB_Service**: The typed CRUD helper layer in `db.service.ts` that provides camelCase↔snake_case conversion and Supabase operations
- **Sync_Service**: The hydration and write-through layer in `sync.service.ts` that pulls data from Supabase into Zustand on login and pushes store changes to Supabase
- **Documents_Table**: The `employee_201_documents` Supabase table (migration 057)
- **Supabase_Storage**: Supabase's file storage service for uploading actual document files
- **Write_Through**: The pattern where Zustand store state changes are automatically persisted to Supabase via subscriptions
- **Hydration**: The process of pulling data from Supabase and replacing Zustand store state on login or app mount

## Requirements

### Requirement 1: Database Service Layer

**User Story:** As a developer, I want typed CRUD helper functions for the `employee_201_documents` table, so that the sync layer can read and write 201 documents using the same patterns as other domain services.

#### Acceptance Criteria

1. THE DB_Service SHALL export a `documents201Db` object with a `fetchAll` method that retrieves all rows from the Documents_Table and returns them as `Employee201Document[]` with camelCase keys
2. THE DB_Service SHALL export a `documents201Db.upsert` method that accepts an `Employee201Document` and upserts it to the Documents_Table with snake_case conversion
3. THE DB_Service SHALL export a `documents201Db.remove` method that accepts a document id and deletes the corresponding row from the Documents_Table
4. THE DB_Service SHALL export a `documents201Db.batchUpsert` method that accepts an array of `Employee201Document` and batch-upserts them to the Documents_Table
5. THE DB_Service SHALL export a `documents201Db.fetchExpiring` method that retrieves documents with `expiry_date` within a given number of days from today, excluding archived and expired documents

### Requirement 2: Store Hydration

**User Story:** As an HR admin, I want the 201 Files dashboard to load existing documents from Supabase on login, so that I see the latest data from all users.

#### Acceptance Criteria

1. WHEN `hydrateAllStores()` executes, THE Sync_Service SHALL fetch all rows from the Documents_Table using `documents201Db.fetchAll`
2. WHEN documents are fetched from Supabase, THE Sync_Service SHALL replace the Documents_Store `documents` array with the fetched data
3. WHEN the Documents_Table returns an empty result set, THE Sync_Service SHALL set the Documents_Store `documents` array to an empty array
4. IF the fetch fails due to a network error, THEN THE Sync_Service SHALL log the error and leave the Documents_Store unchanged

### Requirement 3: Write-Through Persistence

**User Story:** As an HR admin, I want documents uploaded through the 201 Files UI to be persisted to the Supabase `employee_201_documents` table, so that data survives across sessions and devices.

#### Acceptance Criteria

1. WHEN a document is added to the Documents_Store, THE Sync_Service SHALL upsert that document to the Documents_Table
2. WHEN a document's status changes in the Documents_Store (approve, reject, archive), THE Sync_Service SHALL upsert the updated document to the Documents_Table
3. WHEN a document's visibility changes in the Documents_Store, THE Sync_Service SHALL upsert the updated document to the Documents_Table
4. WHEN a document is removed from the Documents_Store, THE Sync_Service SHALL delete that document from the Documents_Table
5. WHILE `_writePaused` is true, THE Sync_Service SHALL skip all write-through operations for the Documents_Store

### Requirement 4: Expiring Documents Query

**User Story:** As an HR admin, I want the "Expiring in 30d" metric to query Supabase for documents with expiry_date within 30 days, so that the dashboard shows accurate data from the database.

#### Acceptance Criteria

1. THE DB_Service SHALL provide a `fetchExpiring` function that queries the Documents_Table for documents where `expiry_date` is between today and 30 days from today
2. WHEN querying expiring documents, THE DB_Service SHALL exclude documents with status `archived` or `expired`
3. WHEN querying expiring documents, THE DB_Service SHALL return results ordered by `expiry_date` ascending

### Requirement 5: File Upload to Supabase Storage (Optional)

**User Story:** As an HR admin, I want to upload actual files to Supabase Storage, so that document files are stored securely in the cloud rather than as local file path strings.

#### Acceptance Criteria

1. WHEN a file is selected for upload, THE DB_Service SHALL upload the file to a Supabase Storage bucket named `201-documents`
2. WHEN a file is uploaded successfully, THE DB_Service SHALL return the public URL or signed URL of the uploaded file
3. WHEN a file upload fails, THE DB_Service SHALL return an error without modifying the document record
4. THE DB_Service SHALL organize uploaded files using the path pattern `{employee_id}/{document_type}/{filename}`

### Requirement 6: UI Compatibility

**User Story:** As an HR admin, I want the existing 201 Files UI to continue working without modification after the Supabase sync is added.

#### Acceptance Criteria

1. THE Sync_Service SHALL operate transparently without requiring changes to the Documents_Store interface
2. THE Sync_Service SHALL operate transparently without requiring changes to the admin UI components
3. WHEN the Supabase connection is unavailable, THE Documents_Store SHALL continue to function using localStorage persistence
