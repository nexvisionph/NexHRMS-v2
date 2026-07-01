# Phase UX: Delete Confirmation Modals - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-01
**Phase:** UX-Delete Confirmation Modals
**Areas discussed:** Dialog Component Standard, State-driven vs. Inline Nested Dialogs, Destructive Warnings, Batch Actions

---

## Dialog Component Standard

| Option | Description | Selected |
|--------|-------------|----------|
| Option A | Strictly use `AlertDialog` (from `@/components/ui/alert-dialog`) for all destructive, irreversible deletion actions. This forces explicit user interaction (clicking "Cancel" or "Delete") and prevents accidental dismissals via backdrop clicks. | ✓ |
| Option B | Use standard `Dialog`. Allows clicking outside the backdrop to cancel. | |

**User's choice:** Option A
**Notes:** Preferred to enforce explicit confirmation for destructive actions.

---

## State-driven vs. Inline Nested Dialogs

| Option | Description | Selected |
|--------|-------------|----------|
| Option A | Use **State-driven Dialogs** (single `AlertDialog` at page level using a state variable like `deleteId`). This keeps the DOM footprint small and avoids rendering hundreds of dialog markup instances inside map loops. | ✓ |
| Option B | Use **Inline Nested Dialogs** (wrapping each row's trash button directly in an independent `<AlertDialog>`). Simpler code but bloats the DOM on large tables. | |

**User's choice:** Option A
**Notes:** Preferred to prevent DOM bloat on large tables and lists.

---

## Destructive Warnings

| Option | Description | Selected |
|--------|-------------|----------|
| Option A | Detail specific downstream consequences in the delete warning descriptions (e.g. warning that deleting a channel deletes all its history, or deleting face enrollment removes biometric check-in capabilities). | ✓ |
| Option B | Use a generic warning message for all (e.g., "Are you sure you want to delete this [item]? This action cannot be undone."). | |

**User's choice:** Option A
**Notes:** Desired to make sure users understand specific impacts before deleting.

---

## Batch Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Option A | Yes, add an `AlertDialog` to confirm clearing all logs. | ✓ |
| Option B | No, let it execute immediately without confirmation. | |

**User's choice:** Option A
**Notes:** Batch log clearing is destructive enough to warrant a confirmation prompt.

---

## the agent's Discretion

Styling details (paddings, custom messages matching layout typography, buttons colors) are left to the agent's discretion.

## Deferred Ideas

None.
