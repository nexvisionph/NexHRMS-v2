# Transfer Backport Report

**Date:** 2026-05-20
**Source:** `c:\Repository\NexHRMS-v2\transfer\` (partial copy from sibling instance)
**Target:** `c:\Repository\NexHRMS-v2\src\` and config files
**Verification:** `npx tsc --noEmit -p tsconfig.json` → exit 0
**Round 1 + Round 2 combined:** 14 fixes across 17 files

---

## Round 1 — Targeted high-priority fixes

### 1. Project verification badge — double icon

- **File:** `src/app/[role]/projects/_views/admin-view.tsx`
- **Cause:** The badge trigger rendered both a manual `<Icon />` and a `<SelectValue />`. Radix's `SelectValue` re-renders the selected `<SelectItem>`'s children, which already contained an icon — so two icons stacked.
- **Fix:** Replaced `<SelectValue />` inside the trigger with a plain `<span>{meta.label}</span>`. The single manual `<Icon />` now stands alone.

### 2. Payroll runs table — 10 rows per page

- **File:** `src/app/[role]/payroll/_views/admin-view.tsx`
- **Cause:** Runs table shared `pageSize = 50` with the payslips, publish, and sign tables.
- **Fix:** Added a separate `runsPageSize = 10` constant and pointed the runs pagination math at it. Other tables still use `pageSize = 50` to avoid regressing them.

### 3. Add-employee password rejects spaces

- **File:** `src/app/[role]/employees/manage/_views/admin-view.tsx`
- **Fix:**
  - `handleAddEmployee`: added `if (/\s/.test(newPassword)) { toast.error("Password cannot contain spaces."); return; }`
  - `handleResetPassword`: added the same guard for `resetPwValue`.
  - Inputs now strip whitespace at the keystroke: `onChange={(e) => setNewPassword(e.target.value.replace(/\s/g, ""))}` and the same on the reset-password input.

### 4. Add/edit employee email validation

- **File:** `src/app/[role]/employees/manage/_views/admin-view.tsx`
- **Cause:** Inline regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` only validated shape, not domain. The `validateEmailDomain()` helper enforcing `@nexsdsi.com` already existed in `src/lib/format.ts` but wasn't called.
- **Fix:**
  - Added `validateEmailDomain` to the named import from `@/lib/format`.
  - `handleAddEmployee` and `handleSaveEdit` now call `validateEmailDomain(...)` and surface its error message.

---

## Round 2 — Backport sweep based on full transfer scan

### Bug fixes

#### 5. Notifications: cross-role link normalization

- **File:** `src/app/[role]/notifications/page.tsx`
- **Cause:** `handleNotificationClick` called `rh(link)` directly. If a notification was created with an absolute role-prefixed path like `/admin/payroll/...` and viewed by an HR user, `rh()` produced `/hr/admin/payroll/...` and 404'd.
- **Fix:** Strip any pre-existing role prefix before re-applying the current role:
  ```ts
  const normalizedLink = link.replace(/^\/(admin|hr|finance|employee|supervisor|payroll_admin|auditor)/, "");
  router.push(rh(normalizedLink));
  ```

#### 6. Payroll page: redirect during render warning

- **File:** `src/app/[role]/payroll/page.tsx`
- **Cause:** `router.replace(...)` was called during component render, triggering React's "cannot update a component while rendering another" warning.
- **Fix:** Moved the redirect into `useEffect`. Render now returns a "Redirecting…" spinner until the navigation completes.

#### 7. Settings: password whitespace (3 views)

- **Files:**
  - `src/app/[role]/settings/_views/admin-view.tsx`
  - `src/app/[role]/settings/_views/hr-view.tsx`
  - `src/app/[role]/settings/_views/employee-view.tsx`
- **Fix:** Added `if (/\s/.test(pwNew) || /\s/.test(pwConfirm)) { toast.error("Password cannot contain spaces."); return; }` in each view's `handleChangePassword`, and `replace(/\s/g, "")` on both new-password and confirm-password input `onChange` handlers. Same family as fix #3, applied across all change-password screens for consistency.

#### 8. Jobs admin view: JSX entity escaping

- **File:** `src/app/[role]/jobs/_views/admin-view.tsx`
- **Fix:** Replaced `Click "Add Applicant"` with `Click &quot;Add Applicant&quot;` to satisfy `react/no-unescaped-entities`.

### Refactor / cleanup

#### 9. Stable component refs (attendance + leave dispatchers)

- **Files:**
  - `src/app/[role]/attendance/page.tsx`
  - `src/app/[role]/leave/page.tsx`
- **Cause:** Inline arrow functions like `() => <AdminView mode="admin" />` were created fresh on every render of the dispatcher, forcing `RoleViewDispatcher` to remount the view subtree.
- **Fix:** Hoisted arrow wrappers to module scope as `AdminAttendanceView`, `HRAttendanceView`, `SupervisorAttendanceView`, `AdminLeave`, `HRLeave`, `SupervisorLeave`, `EmployeeLeave`.

#### 10. Drop unused imports

- **`src/app/[role]/notifications/page.tsx`** — removed unused `getLogsByEmployee`, `CardHeader`, `CardTitle`.
- **`src/app/[role]/tasks/_views/admin-view.tsx`** — removed unused `RefreshCw` from `lucide-react`.
- **`src/app/[role]/payroll/settings/page.tsx`** — removed unused `useCallback` and `Switch`.

### Feature additions (low-risk parts only)

#### 11. Employee delete: cleanup linked auth account

- **File:** `src/app/[role]/employees/manage/_views/admin-view.tsx` → `handleDeleteEmployee`
- **Fix:** After the API delete succeeds and before `removeEmployee(emp.id)`, call `await adminDeleteAccount(emp.profileId)` if the employee has a linked profile. Wrapped in try/catch and logged as non-blocking.

#### 12. Add-employee: reset list view

- **File:** `src/app/[role]/employees/manage/_views/admin-view.tsx` → `handleAddEmployee`
- **Fix:** After `addEmployee` succeeds, call `setPage(1)` and `setSearchQuery("")` so the newly added employee is visible immediately on first page.

#### 13. Payslip print: logo + identifiers

- **File:** `src/app/[role]/payroll/_views/employee-view.tsx`
- **Fix:**
  - Added `import { useAppearanceStore } from "@/store/appearance.store"`.
  - Added `const logoUrl = useAppearanceStore((s) => s.logoUrl);`.
  - Passed `jobTitle`, `employeeId`, `logoUrl` to `<PrintablePayslip>` (props the component already accepts).

### Tooling

#### 14. ESLint ignores

- **File:** `eslint.config.mjs`
- **Fix:** Added `"coverage/**"` (Jest output) and `"scripts/test-migration-045.ts"` (intentional patterns) to `globalIgnores`.

---

## Files touched

```
eslint.config.mjs
src/app/[role]/attendance/page.tsx
src/app/[role]/employees/manage/_views/admin-view.tsx
src/app/[role]/jobs/_views/admin-view.tsx
src/app/[role]/leave/page.tsx
src/app/[role]/notifications/page.tsx
src/app/[role]/payroll/_views/admin-view.tsx
src/app/[role]/payroll/_views/employee-view.tsx
src/app/[role]/payroll/page.tsx
src/app/[role]/payroll/settings/page.tsx
src/app/[role]/projects/_views/admin-view.tsx
src/app/[role]/settings/_views/admin-view.tsx
src/app/[role]/settings/_views/employee-view.tsx
src/app/[role]/settings/_views/hr-view.tsx
src/app/[role]/tasks/_views/admin-view.tsx
```

15 source files + 1 config = 16 files modified.

---

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | exit 0 (no type errors) |
| `getDiagnostics` on all touched files | no diagnostics |
| Manual code review of each diff | confirmed against transfer source |

---

## Skipped — older-base regressions (do NOT apply)

These transfer files are older than current src and would drop real features:

| File | What it would remove |
|---|---|
| `[role]/loading.tsx` | Rich page skeleton → plain spinner |
| `login/page.tsx` | Password recovery, OAuth, login appearance, payroll-test quick-login |
| `employees/[id]/_views/admin-view.tsx` | 201-File and Disciplinary tabs |
| `leave/_views/admin-view.tsx` | Half-day and hourly leave duration handling |
| `events/page.tsx` | Read-only event detail dialog; downgrades edit perm to `page:events` |
| `payroll/_views/admin-view.tsx` (rest of file) | Depends on store methods that don't exist in current code |
| `reports/page.tsx` | `BasicReportsView` lazy import |

## Skipped — platform refactors in flight

| File | Why skipped |
|---|---|
| `services/sync.service.ts` | Strips write-through subscribers; would break Supabase persistence for stores not yet migrated |
| `store/employees.store.ts` | Removes `persist()` middleware + migration history; current code depends on hydration-from-store fallback |
| `types/index.ts` | Removes 275 lines (Disciplinary, BIR Compliance, Performance, CustomPage, 3 Role values) that current code uses |
| `lib/constants.ts` | Drops nav entries for 201 Files, Disciplinary, Kiosk Face, BIR Compliance |
| `components/shell/topbar.tsx` | Drops 3 role-color entries; only safe if `Role` is also narrowed |
| `settings/{dashboard-builder,location,organization,roles}/page.tsx`, `timesheets/page.tsx` | DB-first migration to action-services; apply only if committing to that pattern app-wide |

## Skipped — needs decision

| File | Question |
|---|---|
| `api/projects/[id]/qr/route.ts` | Intentional admin-client escalation for authorized users vs. RLS leak? Confirm with security model |
| `package.json` | Renames package to `soren-hrms`, introduces a typo in `copy-face-models`, drops `@types/pg`/`pg`/`supabase` |
| `tsconfig.json` | Replaces `"transfer"` with `"For Soren"` in exclude |
| `.vscode/settings.json` | Workspace TS SDK setting (personal preference) |
| `package-lock.json` | Auto-generated; would regenerate from `npm install` |

---

## Optional follow-up (low risk if you want them)

Two small bits from `transfer/src/store/employees.store.ts` that are clear improvements without dropping persistence:

1. **Past-date guard in `approveSalaryChange`:** reject the approval if `req.effectiveDate < today`.
2. **Field-merge in `dedupeByEmail`:** when two records share an email, prefer the profile-linked one but also pull through `salary`, `department`, `jobTitle` from the discarded record so partial data isn't lost.

Both are isolated functions; can be ported without touching the persist middleware.
