# Phase UX: Delete Confirmation Modals - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Standardizing delete confirmation modals across all unconfirmed routes in NexHRMS-v2 to prevent accidental deletion and provide a uniform UX.

</domain>

<decisions>
## Implementation Decisions

### Dialog Component Standard
- **D-01:** Strictly use `AlertDialog` (from `@/components/ui/alert-dialog`) for all destructive, irreversible deletion actions. This forces explicit user interaction (clicking "Cancel" or "Delete") and prevents accidental dismissals via backdrop clicks.

### State-driven vs. Inline Nested Dialogs
- **D-02:** Use **State-driven Dialogs** (a single page-level `AlertDialog` controlled by a `deleteId` state variable) for lists and tables with large datasets or pagination (e.g., job postings, attendance exceptions, channels, announcements). This avoids rendering hundreds of dialog markup instances inside map loops.

### Destructive Warnings
- **D-03:** Detail specific downstream consequences in the delete warning descriptions (e.g. warning that deleting a channel deletes all its history, or deleting face enrollment removes biometric check-in capabilities).

### Batch Actions
- **D-04:** Add a confirmation dialog for batch log clearing in the Notifications view.

### the agent's Discretion
- Styling specifics (spacing, alignment, warning text typography) are deferred to the agent's discretion, matching the existing shadcn UI styling used elsewhere in the codebase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Codebase Target Files
- [organization/page.tsx](../../../src/app/[role]/settings/organization/page.tsx) — Organization structure settings page
- [attendance/_views/admin-view.tsx](../../../src/app/[role]/attendance/_views/admin-view.tsx) — Attendance page and exception listing
- [face-enrollment/page.tsx](../../../src/app/[role]/face-enrollment/page.tsx) — Face enrollment management page
- [jobs/_views/admin-view.tsx](../../../src/app/[role]/jobs/_views/admin-view.tsx) — Job posting administration panel
- [messages/_views/admin-view.tsx](../../../src/app/[role]/messages/_views/admin-view.tsx) — Channel/announcement settings
- [settings/_views/admin-view.tsx](../../../src/app/[role]/settings/_views/admin-view.tsx) — General rules settings
- [notifications/page.tsx](../../../src/app/[role]/notifications/page.tsx) — System notifications and log list

### Guidelines
- [PR_GUIDELINES.md](../../../docs/PR_GUIDELINES.md) — PR, Branch, and Commit naming conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel` from `@/components/ui/alert-dialog` are standard.

### Established Patterns
- Inline `AlertDialog` wrapping in `employees/manage/_views/admin-view.tsx` for simple rows.
- Page-level dialog wrappers triggered by state (`resetOpen` in `organization/page.tsx`).

### Integration Points
- Add state hooks at the top of page components.
- Wrap action triggers in JSX.
- Place `AlertDialog` at the bottom of the main container inside each page view.

</code_context>

<specifics>
## Specific Ideas

- **Face Enrollment Dialog Description:** "Are you sure you want to delete this face enrollment? The employee will no longer be able to clock in using facial recognition."
- **Message Channel Dialog Description:** "Are you sure you want to delete this channel? All messages and attachments in this channel will be permanently removed for all employees."
- **Job Posting Dialog Description:** "Are you sure you want to delete this job posting? All applicant history associated with this posting will also be removed."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: UX-Delete Confirmation Modals*
*Context gathered: 2026-07-01*
