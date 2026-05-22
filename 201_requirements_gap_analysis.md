# 201 File — Requirements Gap Analysis

## 1. Document Types (Digital 201 Folder Contents)

All 19 required document types are defined in `Employee201DocType` and available in both views.

| Required Document | Type Key | In Type? | In Admin Upload? | In Employee Upload? | In DB CHECK? |
|---|---|---|---|---|---|
| Personal Information | `personal_info` | ✅ | ✅ | ✅ | ✅ |
| Employment Contract | `employment_contract` | ✅ | ✅ | ❌ restricted | ✅ |
| Government IDs | `government_id` | ✅ | ✅ | ✅ | ✅ |
| Resume / CV | `resume` | ✅ | ✅ | ✅ | ✅ |
| Application Form | `application_form` | ✅ | ✅ | ✅ | ✅ |
| Job Offer | `job_offer` | ✅ | ✅ | ❌ restricted | ✅ |
| Medical Records | `medical` | ✅ | ✅ | ✅ | ✅ |
| Training Certificates | `training_certificate` | ✅ | ✅ | ✅ | ✅ |
| Performance Evaluations | `performance_evaluation` | ✅ | ✅ | ❌ restricted | ✅ |
| Payslip / Payroll Docs | `payslip` | ✅ | ✅ | ❌ restricted | ✅ |
| Leave Records | `leave_record` | ✅ | ✅ | ❌ restricted | ✅ |
| Warnings | `warning` | ✅ | ✅ | ❌ restricted | ✅ |
| NTE | `nte` | ✅ | ✅ | ❌ restricted | ✅ |
| NOD | `nod` | ✅ | ✅ | ❌ restricted | ✅ |
| Clearance | `clearance` | ✅ | ✅ | ✅ | ✅ |
| Resignation Letter | `resignation_letter` | ✅ | ✅ | ❌ restricted | ✅ |
| COE | `coe` | ✅ | ✅ | ❌ restricted | ✅ |
| Final Pay Documents | `final_pay_document` | ✅ | ✅ | ❌ restricted | ✅ |

> [!NOTE]
> Employee upload is intentionally restricted to 8 personal document types. HR-issued docs (contract, NTE, NOD, payslip, etc.) are admin-only uploads by design. This is correct behavior.

---

## 2. 201 File Features

| Feature | Admin View | Employee View | Store | Status |
|---|---|---|---|---|
| **Upload document** | ✅ Full dialog | ✅ Full dialog | ✅ `upload()` + audit log | ✅ Done |
| **Tag document type** | ✅ All 19 types | ✅ 8 types | ✅ `documentType` field | ✅ Done |
| **Set visibility** | ✅ Dropdown per doc | ❌ Not exposed | ✅ `setVisibility()` | ✅ Done (admin-only correct) |
| **Set expiry date** | ✅ Upload form | ✅ Upload form | ✅ `setExpiry()` | ⚠️ Partial — can set on upload, but no inline edit on existing docs |
| **Request missing document** | ⚠️ Shows missing list only | ⚠️ Shows missing list only | ✅ `getMissingForEmployee()` | ❌ **Missing** — no send-request/notification flow |
| **Approve uploaded document** | ✅ Approve button | N/A | ✅ `approve()` + audit | ✅ Done |
| **Reject uploaded document** | ✅ Reject button + reason dialog | N/A | ✅ `reject()` + audit | ✅ Done |
| **Download document** | ❌ **Missing** | ❌ **Missing** | N/A (no download action) | ❌ **Missing** — no download/preview button |
| **Archive document** | ✅ Archive button | N/A | ✅ `archive()` + audit | ✅ Done |
| **Audit trail** | ✅ Logged via `useAuditStore` | N/A | ✅ upload/approve/reject/archive all logged | ⚠️ Partial — logged but no in-page audit history view |

---

## 3. Document Statuses

| Status | In Type? | In DB CHECK? | In StatusBadge? | Used in Logic? |
|---|---|---|---|---|
| Pending Upload | ✅ `pending_upload` | ✅ | ✅ | ⚠️ Not actively set by any flow |
| Uploaded | ✅ `uploaded` | ✅ | ✅ | ✅ Default status on admin upload |
| For Review | ✅ `for_review` | ✅ | ✅ | ✅ Employee uploads set this |
| Approved | ✅ `approved` | ✅ | ✅ | ✅ Admin approve action |
| Rejected | ✅ `rejected` | ✅ | ✅ | ✅ Admin reject action |
| Expired | ✅ `expired` | ✅ | ✅ | ⚠️ Detected by `getExpiring()` but never auto-transitioned |
| Archived | ✅ `archived` | ✅ | ✅ | ✅ Admin archive action |

> [!WARNING]
> **`expired` status is never auto-applied.** `getExpiring()` detects upcoming expirations, but no cron/scheduler transitions docs from `approved` → `expired` when `expiry_date` passes. The expired count/badge in the UI works for "expiring soon" but not for actually expired docs.

> [!NOTE]
> **`pending_upload` is defined but never used.** No workflow creates a document placeholder with `pending_upload` status. The "Request missing document" feature (when built) would naturally use this status.

---

## 4. Database Table (`employee_201_documents`)

| Required Column | DB Column | TypeScript Field | Match? |
|---|---|---|---|
| `id` | `id text PK` | `id: string` | ✅ |
| `employee_id` | `employee_id text FK` | `employeeId: string` | ✅ |
| `document_type` | `document_type text CHECK` | `documentType: Employee201DocType` | ✅ |
| `document_title` | `document_title text` | `documentTitle: string` | ✅ |
| `file_path` | `file_path text` | `filePath?: string` | ✅ |
| `status` | `status text CHECK` | `status: Document201Status` | ✅ |
| `visibility` | `visibility text CHECK` | `visibility: Document201Visibility` | ✅ |
| `expiry_date` | `expiry_date date` | `expiryDate?: string` | ✅ |
| `uploaded_by` | `uploaded_by text` | `uploadedBy?: string` | ✅ |
| `reviewed_by` | `reviewed_by text` | `reviewedBy?: string` | ✅ |
| `reviewed_at` | `reviewed_at timestamptz` | `reviewedAt?: string` | ✅ |
| `remarks` | `remarks text` | `remarks?: string` | ✅ |
| `created_at` | `created_at timestamptz` | `createdAt: string` | ✅ |
| `updated_at` | `updated_at timestamptz` | `updatedAt: string` | ✅ |

**Extra columns in DB/Type not in requirements (fine to keep):**

| Column | Purpose |
|---|---|
| `file_type` | MIME type for download/preview |
| `file_size` | File size tracking |
| `case_id` | Links doc to disciplinary case |

> [!TIP]
> DB schema is a **100% match** to requirements. All required columns present with correct types and constraints.

---

## 5. Visibility Options

| Required Visibility | DB CHECK | TypeScript Type | Admin UI Dropdown | RLS Policy |
|---|---|---|---|---|
| HR Only | ✅ `hr_only` | ✅ | ✅ | ✅ `201docs hr full` |
| Manager View | ✅ `manager` | ✅ | ✅ | ❌ **No RLS policy** |
| Employee View | ✅ `employee` | ✅ | ✅ | ✅ `201docs employee read own` |
| Payroll View | ✅ `payroll` | ✅ | ✅ | ✅ `201docs payroll read` |
| Admin Only | ✅ `admin_only` | ✅ | ✅ | ✅ Covered by `201docs hr full` |

> [!WARNING]
> **`manager` visibility has no RLS policy.** Managers/supervisors cannot read docs with `visibility = 'manager'` at DB level. Need a new Supabase RLS policy for supervisor/manager role.

---

## 6. Gap Summary

### ❌ Missing Features (3)

| # | Gap | Impact | Fix Effort |
|---|---|---|---|
| 1 | **Download document** | No way to download/preview uploaded files | Medium — need download button + Supabase storage signed URL |
| 2 | **Request missing document** | Admin can see missing list but cannot send a request/notification to employee | Medium — need notification integration + `pending_upload` status usage |
| 3 | **Manager visibility RLS** | `manager` visibility exists in UI but has no DB enforcement | Low — add Supabase RLS policy |

### ⚠️ Partial Implementations (3)

| # | Gap | Current State | What's Needed |
|---|---|---|---|
| 1 | **Expiry auto-transition** | `getExpiring()` detects upcoming expirations; `expired` status exists | Cron/scheduled function to auto-set `status = 'expired'` when `expiry_date < now()` |
| 2 | **Inline expiry edit** | Can set expiry on upload only | Add inline date picker on existing docs in admin drilldown table |
| 3 | **Audit trail in-page** | All actions logged to audit store | No document-specific audit history view within 201 files page (must go to separate Audit Log page) |

### ✅ Fully Implemented (7/10 Features)

Upload, tag type, set visibility, approve, reject, archive, audit logging.
