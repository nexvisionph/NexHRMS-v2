---
title: Delete Confirmation Modals Implementation
wave: 1
depends_on: []
files_modified:
  - src/app/[role]/settings/organization/page.tsx
  - src/app/[role]/settings/_views/admin-view.tsx
  - src/app/[role]/attendance/_views/admin-view.tsx
  - src/app/[role]/face-enrollment/page.tsx
  - src/app/[role]/jobs/_views/admin-view.tsx
  - src/app/[role]/messages/_views/admin-view.tsx
  - src/app/[role]/notifications/page.tsx
  - src/app/[role]/projects/_views/admin-view.tsx
  - src/components/payroll/payroll-readiness-checklist.tsx
requirements_addressed:
  - UX-DELETE-001
autonomous: true
---

# Delete Confirmation Modals Implementation Plan

Implement state-driven `AlertDialog` components for all unconfirmed deletion and destructive batch actions to prevent data loss and align UX styling.

## Proposed Waves

### Wave 1: Settings & Organization Page Deletions
Implement confirmations for settings rule sets, organization departments, and positions.

<task id="T-01" wave="1">
<read_first>
- [organization/page.tsx](../../../src/app/[role]/settings/organization/page.tsx)
</read_first>
<action>
Modify `src/app/[role]/settings/organization/page.tsx` to:
1. Define states `deleteDeptId` and `deletePosId` using `useState<string | null>(null)`.
2. Update the Department and Position list delete buttons to call `setDeleteDeptId(dept.id)` and `setDeletePosId(jt.id)` respectively.
3. Render two `AlertDialog` blocks at the bottom of the page that trigger `handleDeleteDept(deleteDeptId)` and `handleDeletePos(deletePosId)` upon user confirmation.
</action>
<acceptance_criteria>
- File `src/app/[role]/settings/organization/page.tsx` compiles.
- Clicking the delete buttons for departments and positions displays the respective confirmation `AlertDialog`.
- Confirming the action executes the deletion and cancels the dialog.
</acceptance_criteria>
</task>

<task id="T-02" wave="1">
<read_first>
- [settings/_views/admin-view.tsx](../../../src/app/[role]/settings/_views/admin-view.tsx)
</read_first>
<action>
Modify `src/app/[role]/settings/_views/admin-view.tsx` to:
1. Import `AlertDialog` related exports from `@/components/ui/alert-dialog`.
2. Define a state variable `deleteRuleSetId` using `useState<string | null>(null)`.
3. Update the Rule Set delete button onClick to `setDeleteRuleSetId(rs.id)`.
4. Render an `AlertDialog` for confirming Rule Set deletion.
</action>
<acceptance_criteria>
- File `src/app/[role]/settings/_views/admin-view.tsx` compiles.
- Delete button for a rule set prompts confirmation dialog before calling `deleteRuleSet`.
</acceptance_criteria>
</task>

### Wave 2: Operations Page Deletions
Implement confirmations for attendance exceptions, face enrollments, job postings/applicants, messages, and notification log clearing.

<task id="T-03" wave="2" depends_on="T-01,T-02">
<read_first>
- [attendance/_views/admin-view.tsx](../../../src/app/[role]/attendance/_views/admin-view.tsx)
</read_first>
<action>
Modify `src/app/[role]/attendance/_views/admin-view.tsx` to:
1. Define a state variable `deleteException` (representing the Exception object or ID to delete).
2. Update the DropdownMenuItem for deleting exceptions to set `deleteException`.
3. Render an `AlertDialog` that prompts "Delete Exception?" and details the action before calling `appendEvent` and executing exception deletion.
</action>
<acceptance_criteria>
- Deleting an attendance exception triggers a confirmation `AlertDialog`.
</acceptance_criteria>
</task>

<task id="T-04" wave="2" depends_on="T-01,T-02">
<read_first>
- [face-enrollment/page.tsx](../../../src/app/[role]/face-enrollment/page.tsx)
</read_first>
<action>
Modify `src/app/[role]/face-enrollment/page.tsx` to:
1. Import `AlertDialog` components.
2. Define `isDeleteConfirmOpen` state.
3. Update the "Remove" button to set this state to `true`.
4. Render `AlertDialog` that warns: "The employee will no longer be able to clock in using facial recognition. This action cannot be undone." before calling `handleDelete()`.
</action>
<acceptance_criteria>
- Face profile removal shows confirmation prompt with explicit warning about biometric access loss.
</acceptance_criteria>
</task>

<task id="T-05" wave="2" depends_on="T-01,T-02">
<read_first>
- [jobs/_views/admin-view.tsx](../../../src/app/[role]/jobs/_views/admin-view.tsx)
</read_first>
<action>
Modify `src/app/[role]/jobs/_views/admin-view.tsx` to:
1. Import `AlertDialog` components.
2. Define states `deleteJobId` and `deleteApplicantId`.
3. Render `AlertDialog` for Job Posting delete warning: "All applicant history associated with this posting will also be removed."
4. Render `AlertDialog` for Applicant removal.
</action>
<acceptance_criteria>
- Job posting and applicant deletions prompt warning dialogs before removal.
</acceptance_criteria>
</task>

<task id="T-06" wave="2" depends_on="T-01,T-02">
<read_first>
- [messages/_views/admin-view.tsx](../../../src/app/[role]/messages/_views/admin-view.tsx)
</read_first>
<action>
Modify `src/app/[role]/messages/_views/admin-view.tsx` to:
1. Import `AlertDialog` components.
2. Define states `deleteChannelId` and `deleteAnnouncementId`.
3. Update Channel and Announcement trash buttons to set these states.
4. Render `AlertDialog` for Channel delete warning: "All messages and attachments in this channel will be permanently removed for all employees."
5. Render `AlertDialog` for Announcement delete.
</action>
<acceptance_criteria>
- Channel and Announcement deletions require explicit confirmation.
</acceptance_criteria>
</task>

<task id="T-07" wave="2" depends_on="T-01,T-02">
<read_first>
- [notifications/page.tsx](../../../src/app/[role]/notifications/page.tsx)
</read_first>
<action>
Modify `src/app/[role]/notifications/page.tsx` to:
1. Import `AlertDialog` components.
2. Define `isClearLogsConfirmOpen` state.
3. Update "Clear All" button to open this dialog.
4. Render `AlertDialog` warning "Are you sure you want to clear all notification logs? This action cannot be undone." before calling `clearLogs`.
</action>
<acceptance_criteria>
- "Clear All Logs" prompts confirmation before execution.
</acceptance_criteria>
</task>

## Verification Plan

### Automated Tests
- Run `npm run build` and `npx tsc --noEmit` to ensure TypeScript compilation passes with no errors.
- Run local unit tests if applicable.

### Manual Verification
- In the local development environment, verify that clicking delete icons on all targeted pages displays the warning `AlertDialog` and that clicking "Cancel" keeps the records while "Delete" successfully removes them.
