---
description:
globs: 
alwaysApply: false
---

You are a world-class software engineer with decades of experience. You are given a task that is related to the current project. It's either a bug that needs fixing, or a new feature that needs to be implemented. Your job is to come up with a step-by-step plan which when implemented, will solve the task completely.

First, analyse the project and understand the parts which are relevant to the task at hand. Use the available README-s and documentation in the repo, in addition to discovering the codebase and reading the code itself. Make sure you understand the structure of the codebase and how the relevant parts relate to the task at hand before moving forward.

Then, come up with a step-by-step plan for implementing the solution to the task. The plan will be sent to another agent, so it should contain all the necessary information for a successful implementation. Usually, the plan should start with a short description of the solution and how it relates to the codebase, then a step-by-step plan should follow which describes what changes have to be made in order to implement the solution.

Output the plan in a code block at the end of your response as a formatted markdown document. Do not implement any changes. Another agent will take over from there.

This is the task that needs to be solved:

# Pre-task

- Always make an implementation plan on an artifact first, so the developer can review the plan first.

# NexHRMS 201 Files Module: Implementation Prompt

**System Context:**
We are building the "201 Files" (Employee Document Repository) module for an HRMS called NexHRMS. 
The frontend is built with **Next.js** and **Tailwind CSS**. The backend and database rely on **Supabase**.
The UI for the dashboard and the upload/review modals are already designed and implemented in the frontend. The goal now is to wire up the frontend state to the Supabase backend, configure the database schema, and implement the core document management workflows.

Please implement the following tasks step-by-step. Provide the necessary Next.js component logic (React Hooks, form state management), Supabase client queries, and the SQL needed to configure the database.

---

## Task 1: Supabase Database Schema & Storage Setup
Please provide the SQL migration script to set up the following:

1. **Table:** `employee_documents`
   - `id` (uuid, primary key)
   - `employee_id` (uuid, references an `employees` table or auth user)
   - `document_type` (text/enum: Personal Info Sheet, Employment Contract, Government ID, Resume / CV, Application Form, Job Offer Letter, Medical Clearance, Training Certificate, Performance Evaluation, Payslip, Leave Record, Warning, NTE, NOD, Clearance, Resignation Letter, Certificate of Employment, Final Pay Document)
   - `document_title` (text)
   - `file_path` (text - path to the Supabase storage bucket)
   - `status` (text/enum: Pending Upload, Uploaded, For Review, Approved, Rejected, Expired, Archived)
   - `visibility` (text/enum: hr only, manager, employee, payroll, admin only)
   - `expiry_date` (date, nullable)
   - `uploaded_by` (uuid)
   - `reviewed_by` (uuid, nullable)
   - `reviewed_at` (timestamp, nullable)
   - `remarks` (text, nullable - used for rejection reasons)
   - `created_at` (timestamp)
   - `updated_at` (timestamp)

Note: Currently, there is an existing employee_documents table with the following columns:
    - id (text, pk, non-nullable)
    - employee_id (text, fk, non-nullable)
    - name (text, non-nullable)
    - file_url (text, nullable)
    - uploaded_at (timestampz, non-nullable)
    - deleted_at (timestampz, nullable)

---

## Task 2: Implement the Upload Document Workflow
We have a modal component called `Upload 201 Document` with fields for `Document Type`, `Document Title`, `Visibility`, `Expiry (optional)`, and `Remarks` (along with the actual file upload).

---

## Task 3: Implement the "For Review" Approval Flow
When an employee uploads a document, it goes into a "For Review" state for HR. 

Please provide the logic and query structure to:
1. Fetch all documents where `status = 'For Review'`.
2. Create an `approveDocument` function that updates the document status to `'Approved'` and sets the `reviewed_by` and `reviewed_at` fields.
3. Create a `rejectDocument` function that updates the status to `'Rejected'`, requires a `remarks` string (explaining the rejection), and sets the `reviewed_by` and `reviewed_at` fields.

---

## Task 4: Dynamic Completeness Tracking & Missing Files logic
The dashboard features an "Employees" data table with a "Completeness" progress bar and a "Missing" column (e.g., "4 of 5 missing"). 
Let's assume there are 5 strictly required core documents for every employee: Employment Contract, Resume / CV, Application Form, Medical Clearance, and Government ID.

Please provide a utility function or custom React Hook that:
1. Takes an `employee_id` and queries their approved/uploaded documents.
2. Compares their existing documents against the array of the 5 required core document types.
3. Calculates the completion percentage (e.g., 20%, 100%).
4. Returns an array of the exact missing document types so they can be rendered as warning badges in the UI.

---

## Task 5: Archiving and Expiry Tracking
Provide the Supabase query logic to:
1. Update a document's status to `'Archived'` (soft delete/hide from main view).
2. Fetch documents that are approaching expiration: `status = 'Approved'` AND `expiry_date` is within the next 30 days. (This will populate the "Expiring in 30d" metric card on the dashboard).

- If there is a possibility to not use storage buckets and RLS without hard coding, it would be best.
- Don't create changes yet, only an md file of the implementation.