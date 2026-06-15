# NexHRMS-v2 Full System Audit Report

**Date:** June 15, 2026  
**Scope:** End-to-end connectivity audit of all modules — UI → Store → API → Database → Cross-module dependencies

---

## Architecture Summary

The system uses a **Zustand + Supabase write-through** pattern:

- **Zustand stores** hold all client state in-memory
- **`sync.service.ts`** hydrates stores FROM Supabase on login, then subscribes to store changes and writes back (write-through)
- **`db.service.ts`** provides typed CRUD against Supabase's browser client
- **API routes** (Next.js) handle server-side operations requiring admin-level DB access (bypasses RLS)
- Most stores initialize with `SEED_DATA` when `NEXT_PUBLIC_USE_DEMO_MODE=true`, otherwise start empty and rely on sync hydration

---

## Module-by-Module Findings

---

### 1. Employee Management

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Full CRUD, status toggle, resign, salary governance, deduplication, syncs to Supabase |
| Employee import restricted to `@nexsdsi.com` emails | Minor | `/api/import/employees` hardcodes domain restriction — not configurable |

---

### 2. Attendance

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Check-in/out with geofence, biometric XLSX import, manual override, shift management, holidays, exception CRUD via API |
| `/api/attendance/logs` GET is redundant | Minor | Attendance hydration goes through `db.service.ts` direct Supabase query, not through this API route. The GET exists but isn't called from client code. |
| Offline queue (`offline-queue.store.ts`) is **completely unused** | Major | The store and `useOfflineSync` hook exist with full implementation but are never imported or called by any component or page. Offline attendance check-ins will be lost if network drops. |

---

### 3. Leave Management

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Request/approve/reject flow, policy CRUD, balance tracking, cross-sync to attendance (marks days on_leave), notifications dispatched |
| No leave API route exists | Minor | Leave operates entirely via store + write-through. No server-side validation of leave balance before approval. |

---

### 4. Payroll

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Full computation engine, payslip lifecycle (draft→published→signed→paid), DB-first lock/unlock/publish via `payroll-actions.service.ts`, deduction templates, import/export |
| `/api/payroll/payslips` route is **orphaned** | Major | POST/DELETE exist with full implementation but are **never called** from client code. The write-through goes via `db.service.ts` → direct Supabase client instead. |
| `/api/payroll/status` route is **orphaned** | Major | Batch status transitions exist with full implementation but are **never called**. Status transitions happen via store mutations + write-through. |
| `/api/payroll/export-pb/` directory is **empty** | Minor | Empty folder, no route.ts file — dead code. |
| `confirmPayslip()` store function is a **no-op** | Minor | Marked DEPRECATED, kept for backward compat. Does nothing (`set(() => ({}))`). |
| `validateRun()` store function is a **no-op** | Minor | Marked DEPRECATED, kept for backward compat. Does nothing. |
| `publishRun()` store function is **deprecated** | Minor | Merged into `lockRun`. Still functional but misleadingly named. |
| RLS vulnerability: admin payroll mutations go through browser Supabase client | Major | The write-through uses the browser Supabase client (user-scoped RLS). If RLS policies on `payslips` or `payroll_runs` are restrictive, admin bulk operations will silently fail. The orphaned API routes (`/api/payroll/payslips`, `/api/payroll/status`) were built to bypass this but were never wired up. |

---

### 5. Payslips (Employee View)

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Employee can view, sign (e-signature), and acknowledge payslips via API routes `/api/payroll/sign` and `/api/payroll/acknowledge` |

---

### 6. Loans & Cash Advances

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Create/deduct/settle/freeze/unfreeze/cancel, repayment schedule, deduction cap, balance history, payroll integration, notifications |

---

### 7. 201 Files (Documents)

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Upload with Supabase storage, approve/reject/archive workflow, completeness tracking, expiry alerts |
| Store is purely in-memory with fire-and-forget DB writes — no Supabase response validation | Minor | Upload errors are caught but rejected approvals may silently fail if the DB write doesn't complete |

---

### 8. Disciplinary

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Case lifecycle (10 stages), NTE issuance/response, NOD decisions, cross-refs to 201 documents, notifications |
| Hydration is in Batch 3 with `allSettled` | Minor | If the disciplinary tables don't exist (migration not applied), the store silently initializes empty without any user-facing error |

---

### 9. Projects

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | CRUD with DB-first actions, employee assignment, geofence location, QR codes for attendance, verification service |

---

### 10. Tasks

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Full CRUD, groups, tags, assignment, completion reports with photo/GPS proof, verify/reject workflow, notifications, audit logging |

---

### 11. Messaging

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Partially working | — | In-app channels and announcements work (store-backed, synced to Supabase) |
| **External channels (Email, WhatsApp, SMS) are completely simulated** | Critical | `sendAnnouncement` explicitly shows `(simulated)` in toast. No Twilio/Resend/SMTP integration exists despite the UI presenting these as options. Users can select "Email" or "WhatsApp" as delivery channels but nothing actually sends externally. |

---

### 12. Notifications

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | In-app notification dispatch, mark-as-read via API, notification rules CRUD, push notification delivery via web-push (VAPID) |
| SMS/Email notification delivery is **simulated** | Critical | `NotificationProviderConfig` has `smsProvider: ""` and `emailProvider: ""` by default. The system logs notification events but doesn't actually deliver SMS or emails. The rules engine triggers correctly but the delivery step is a no-op. |
| `/api/notifications/resend` route is **orphaned** | Minor | Never called from any client code. Only supports 2 notification types (assignment, absence). |

---

### 13. Reports

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Payroll register, gov deductions report, absence/late reports, 13th month accrual, manpower report — all computed from real store data |

---

### 14. Audit Logs

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Immutable log with fire-and-forget DB writes. Populated by actions across all modules. |

---

### 15. Government Compliance (BIR)

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Tax profiles, annual tax summaries, Form 2316 generation, Alphalist export, validation engine — API-backed |
| Hydration uses `allSettled` | Minor | If BIR tables aren't migrated, silently returns empty arrays |

---

### 16. Kiosk

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | PIN-protected entry (server-validated), QR check-in, face recognition, device registration |
| Kiosk settings stored in **localStorage** via persist middleware | Major | `adminPin` is stored client-side in localStorage. Settings are NOT part of the main `sync.service.ts` hydration flow. Kiosk config on one device won't sync to another unless the `/api/settings/kiosk` endpoint is manually called. |
| Anti-cheat `adminPin` in localStorage | Major | Security concern: the admin PIN that unlocks kiosk mode is stored in browser localStorage in plaintext |

---

### 17. Biometric Import

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Device registration, biometric sync API (machine-to-machine), enrollment CRUD, XLSX bulk import of attendance from biometric devices |
| `/api/import/biometric-attendance/` directory is **empty** | Minor | Empty folder, no route.ts. Dead code. |

---

### 18. Dashboard

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Role-specific dashboards, widget system, page builder for custom dashboard pages |

---

### 19. Settings

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Theme/appearance (persisted), pay schedule (synced), shifts (synced), organization, roles, location, notifications, kiosk, page builder, modules toggle |

---

### 20. Roles & Permissions

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Full CRUD via `/api/roles`, permission-gated UI, dashboard layout per role |
| Roles sync uses separate fetch pattern | Minor | Not part of main write-through; uses its own `/api/roles` fetch flow with `hasFetchedFromDb` flag |

---

### 21. Performance Management

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Partially working | — | Cycles, reviews, salary adjustments — API-backed, working |
| **"Add Criterion" button does nothing** | Critical | The performance page renders a full form for adding evaluation criteria but the "Add" button has **no onClick handler**. The UI exists but the action is broken. |
| **"Add Salary Band" button does nothing** | Critical | Same issue — form fields render for salary band configuration but the save button is non-functional. |

---

### 22. Events & Calendar

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Partially working | — | Event CRUD works (store-backed, DB synced) |
| **Notification targeting uses hardcoded mock data** | Major | When creating an event with "Notify departments" or "Notify employees", the picker uses hardcoded arrays (`["Engineering", "HR", "Finance"]`, `["Alice Reyes", "Bob Santos"]`) instead of reading from the actual employees/departments stores |

---

### 23. Jobs / Recruitment

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Job posting CRUD via `/api/jobs`, role-based visibility, applications endpoint |

---

### 24. Timesheets

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Computed from attendance logs + rule sets, submit/approve/reject workflow, synced to Supabase |

---

### 25. User Profile

| Issue | Severity | Description |
|-------|----------|-------------|
| ✅ Working | — | Password change via API, profile settings |

---

## Cross-Module / System-Wide Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| **Offline queue is dead code** | Major | `offline-queue.store.ts` (175+ lines) and `useOfflineSync` hook are fully implemented but **never imported or used anywhere**. Offline check-ins cannot be queued and will be silently lost. |
| **Dual write paths create inconsistency risk** | Major | Some modules use API routes (payroll sign/acknowledge, performance, biometric), others use store + write-through (payroll admin ops, attendance, leave). If write-through fails silently, the API-side data may diverge from what was shown in the UI. |
| **5 orphaned API routes** | Major | `/api/payroll/payslips`, `/api/payroll/status`, `/api/export/payroll`, `/api/export/attendance`, `/api/notifications/resend` — all fully implemented but never called from any client code |
| **2 empty API route directories** | Minor | `/api/payroll/export-pb/` and `/api/import/biometric-attendance/` are empty folders with no route.ts |
| **Demo mode fallback in 14 stores** | Minor | When `NEXT_PUBLIC_USE_DEMO_MODE=true`, stores initialize with seed data. If sync.service fails to hydrate, users see stale seed data with no visual indicator that they're offline. |
| **JSON.stringify equality check for write-through** | Minor | sync.service uses `JSON.stringify` comparison on entire store state to detect changes. This is O(n) on state size and may miss reorder-only changes or produce false negatives for deeply nested objects. |
| **Kiosk adminPin in plaintext localStorage** | Major | Security concern — admin PIN stored in client localStorage via zustand/persist |
| **No server-side validation on leave balance** | Minor | Leave approval happens entirely in-store. No API route validates remaining balance, so concurrent approvals could overdraw. |

---

## Severity Summary

| Severity | Count | Key Items |
|----------|-------|-----------|
| **Critical** | 4 | SMS/Email delivery is simulated (Messaging + Notifications), Performance "Add Criterion" button non-functional, Performance "Add Salary Band" button non-functional |
| **Major** | 9 | Offline queue dead code, 5 orphaned API routes, kiosk adminPin in localStorage, payroll RLS vulnerability, Events notification picker uses mock data, kiosk settings not in sync.service |
| **Minor** | 11 | Deprecated store functions, empty API dirs, demo mode fallback, domain-restricted import, no server-side leave validation, JSON equality perf concern, role sync pattern inconsistency |

---

## Orphaned / Dead Code Inventory

| Path | Type | Notes |
|------|------|-------|
| `src/store/offline-queue.store.ts` | Entire file | Never imported by any component |
| `src/app/api/payroll/payslips/route.ts` | API route | Never called from client |
| `src/app/api/payroll/status/route.ts` | API route | Never called from client |
| `src/app/api/export/payroll/route.ts` | API route | Never called from client |
| `src/app/api/export/attendance/route.ts` | API route | Never called from client |
| `src/app/api/notifications/resend/route.ts` | API route | Never called from client |
| `src/app/api/payroll/export-pb/` | Empty directory | No route.ts file |
| `src/app/api/import/biometric-attendance/` | Empty directory | No route.ts file |
| `payroll.store.ts` → `confirmPayslip()` | Store function | No-op (deprecated) |
| `payroll.store.ts` → `validateRun()` | Store function | No-op (deprecated) |

---

## Bottom Line

The core business logic (Employee, Attendance, Payroll, Leave, Loans, Tasks, Projects, Disciplinary, 201 Files, Audit, Timesheets, Dashboard, Reports) is **genuinely functional end-to-end** — data persists to Supabase, cross-module dependencies work, and the UI connects to real stores.

**The biggest systemic risks are:**

1. **External communication is fake** — the system pretends to send emails/SMS but doesn't
2. **Performance management has dead buttons** — admin can't add evaluation criteria or salary bands
3. **Offline support was built but never connected** — a complete offline queue implementation sits unused
4. **5 API routes exist as dead code** — fully implemented but unreachable from the client, creating maintenance burden and false confidence in test coverage
5. **Kiosk admin PIN stored in plaintext** in browser localStorage — security vulnerability
