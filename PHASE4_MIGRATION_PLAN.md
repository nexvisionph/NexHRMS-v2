# Phase 4 Migration Plan: Remaining Stores → Self-Hydrating + Direct DB Persistence

**Date:** June 17, 2026  
**Target Stores:** tasks, messaging, notifications, audit, location, documents, disciplinary, performance, BIR-compliance  
**Goal:** After this phase, `sync.service.ts` will only contain realtime handlers (no hydration, no write-through).

---

## Store Overview

| Store | Lines | Consumers | Action Service | Has Own DB Calls | Cross-Store Deps |
|-------|-------|-----------|----------------|------------------|------------------|
| `tasks.store.ts` | 348 | 13 files | 14 functions | No | notifications, audit |
| `messaging.store.ts` | 306 | 8 files | 13 functions | No | notifications, audit, tasks |
| `notifications.store.ts` | 605 | 24 files | N/A (self-contained) | Yes (`notificationsDb` + `/api/` calls) | — |
| `audit.store.ts` | 73 | 26 files | 1 function | Yes (`auditDb`) | — |
| `location.store.ts` | 209 | 11 files | 6 functions | Yes (fetch `/api/settings/location`) | — |
| `documents.store.ts` | 225 | 8 files | N/A | No | audit |
| `disciplinary.store.ts` | 386 | 9 files | N/A | No | audit |
| `performance.store.ts` | 166 | 6 files | N/A | No | — |
| `bir-compliance.store.ts` | 249 | 3 files | N/A | No | — |

---

## ⚠️ Complexity Flags

### High-Complexity Stores

**`notifications.store.ts` (605 lines, 24 consumers)**
- Heaviest cross-store dependency: 5 other stores call `useNotificationsStore.getState()` to dispatch notifications
- Has its own DB calls (`notificationsDb`, fetch to `/api/settings/notifications`, `/api/notifications/mark-read`, `/api/push/send`)
- Used by `attendance.store.ts`, `leave.store.ts`, `messaging.store.ts`, `tasks.store.ts`, `disciplinary.store.ts` (via `getState().dispatch()`)
- Used by `src/lib/notifications.ts` (via `getState()`)
- **Recommendation:** Leave the `.getState()` calls in other stores intact — notifications dispatches should remain fire-and-forget calls that don't need write-through

**`audit.store.ts` (73 lines, 26 consumers)**
- Used by 5 other stores for logging: `attendance`, `disciplinary`, `documents`, `messaging`, `tasks`
- Already has direct DB calls (`auditDb.insert()`, `auditDb.batchInsert()`)
- **Simplest store** — only `log()` and `batchLog()` with fire-and-forget DB writes
- **Recommendation:** Already self-persists — just needs `hydrateFromDb()` and removal from sync.service

**`tasks.store.ts` (348 lines, cross-reads messaging store)**
- `messaging.store.ts` reads `useTasksStore.getState().groups` for recipient resolution
- Has internal cross-deps: dispatches notifications and logs audit entries
- **Recommendation:** Standard migration (messaging cross-read is fine since tasks store stays Zustand)

### Medium-Complexity Stores

**`messaging.store.ts` (306 lines)**
- Reads from `useTasksStore.getState().groups` (for task group member lookup)
- Dispatches notifications and logs audit
- Async messaging write-through in sync.service has FK-constraint ordering (channels before messages)
- **Recommendation:** Ensure DB calls in mutations respect FK order (upsert channel before inserting messages)

**`documents.store.ts` (225 lines)**
- Uses `useAuditStore.getState().log()` for audit trail
- No action service file — all mutations are in-store
- **Recommendation:** Standard migration

**`disciplinary.store.ts` (386 lines)**
- Uses `useAuditStore.getState().log()` + notifications dispatch
- No action service file — all mutations are in-store
- **Recommendation:** Standard migration

### Simple Stores

**`location.store.ts` (209 lines)** — Has action service + own fetch calls. Standard migration.  
**`performance.store.ts` (166 lines)** — Pure setters, no cross-deps. Standard migration.  
**`bir-compliance.store.ts` (249 lines)** — Pure setters, no cross-deps. Standard migration.

---

## Service Files Using `.getState()/.setState()`

| Store | Service File | Calls |
|-------|-------------|-------|
| tasks | `tasks-actions.service.ts` | 24 calls |
| tasks | `messaging.store.ts` (cross-read) | 2 calls |
| messaging | `messaging-actions.service.ts` | 11 calls |
| notifications | `notification-actions.service.ts` | 15 calls |
| notifications | `src/lib/notifications.ts` | 5 calls |
| notifications | 5 other stores (dispatch calls) | ~20 calls |
| audit | `audit-actions.service.ts` | 2 calls |
| audit | 5 other stores (log calls) | ~25 calls |
| location | `location-actions.service.ts` | 8 calls |
| documents | None (mutations are in-store) | — |
| disciplinary | None (mutations are in-store) | — |
| performance | None (mutations are in-store) | — |
| BIR | None (mutations are in-store) | — |

---

## Migration Steps

### Step 1: Add `hydrateFromDb()` to All 9 Stores

Same pattern as Phase 2/3. Each store gets `_hydrated`, `_hydrating`, `hydrateFromDb()`.

| Store | Fetch Calls |
|-------|-------------|
| tasks | `tasksDb.fetchGroups()`, `tasksDb.fetchTasks()`, `tasksDb.fetchCompletionReports()`, `tasksDb.fetchComments()`, `tasksDb.fetchTags()` |
| messaging | `messagingDb.fetchAnnouncements()`, `messagingDb.fetchChannels()`, `messagingDb.fetchMessages()` |
| notifications | `notificationsDb.fetchLogs()`, `notificationsDb.fetchRules()` |
| audit | `auditDb.fetchAll()` |
| location | `locationDb.fetchPings()`, `locationDb.fetchPhotos()`, `locationDb.fetchBreaks()` |
| documents | `documents201Db.fetchAll()` |
| disciplinary | `disciplinaryDb.fetchCases()`, `disciplinaryDb.fetchNTEs()`, `disciplinaryDb.fetchNODs()` |
| performance | `performanceDb.fetchCycles()`, `performanceDb.fetchCriteria()`, `performanceDb.fetchSalaryBands()`, `performanceDb.fetchReviews()`, `performanceDb.fetchAdjustments()`, `performanceDb.fetchAuditLogs()` |
| BIR | `birComplianceDb.fetchTaxProfiles()`, `birComplianceDb.fetchAnnualSummaries()`, `birComplianceDb.fetchPreviousEmployerRecords()`, `birComplianceDb.fetchForm2316Records()`, `birComplianceDb.fetchAlphalistExports()` |

**Files modified:** 9 store files  
**Verification:** `tsc --noEmit`

---

### Step 2: Call `hydrateFromDb()` from `client-layout.tsx`

Add 9 more `hydrateFromDb()` calls after the existing Phase 2+3 calls.

**Files modified:** 1 (`client-layout.tsx`)  
**Verification:** `tsc --noEmit`

---

### Step 3: Add DB Persistence to Local-Only Mutations

**Stores that ALREADY persist (no changes needed):**
- `audit.store.ts` — already calls `auditDb.insert()` and `auditDb.batchInsert()`
- `notifications.store.ts` — already calls `notificationsDb.*` and `/api/push/send`

**Stores that need DB calls added:**

| Store | Mutations | Pattern |
|-------|-----------|---------|
| `tasks` | Most covered by `tasks-actions.service.ts` (14 functions). Any remaining in-store mutations need DB calls. | Standard |
| `messaging` | Most covered by `messaging-actions.service.ts` (13 functions). In-store mutations need DB calls. | ⚠️ FK-ordered: channels before messages |
| `location` | Covered by `location-actions.service.ts` (6 functions). In-store mutations: `addPing`, `addPhoto`, `startBreak`, `endBreak`. | Standard |
| `documents` | ALL mutations are in-store: `upload`, `updateDocument`, `fulfillRequest`, `approve`, `reject`, `archive`, `remove`, `setVisibility`, `setExpiry`, `attachToCase` | ~10 mutations need DB calls |
| `disciplinary` | ALL mutations are in-store: `createCase`, `updateCase`, `deleteCase`, `closeCase`, `reopenCase`, `moveToReview`, `issueNTE`, `acknowledgeNTE`, `submitExplanation`, `markNoResponse`, `issueNOD`, `acknowledgeNOD` | ~12 mutations need DB calls |
| `performance` | ALL mutations are setters (setCycles, addCycle, etc.) — these don't persist individually (data comes from API routes). | Setters already triggered by API route responses — no DB calls needed |
| `BIR` | ALL mutations are setters — same as performance. | No DB calls needed (server is source of truth) |

**Estimated mutations needing DB calls: ~22**
- documents: 10
- disciplinary: 12
- messaging: ~3 in-store (sendAnnouncement scope resolution, channel member management)
- tasks: ~3 in-store (tag management, group creation via store directly)
- location: 4 (pings, photos, breaks)

**Files modified:** ~5 store files  
**Verification:** `tsc --noEmit`

---

### Step 4: Remove Hydration from sync.service.ts

Remove from `hydrateAllStoresInternal()`:
- Batch 2 (now empty after Phase 3 removed 8 fetches): remove entirely
- Remaining hydration blocks for: audit, messaging, tasks, timesheets (wait — timesheets already removed in Phase 3), notifications, location, documents
- Batch 3: disciplinary, performance, BIR

After this step, `hydrateAllStoresInternal()` should only contain:
- The notification preferences fetch (uses `employeesDb.fetchAll()`)
- Setting `_hydrated = true`
- The try/catch/finally wrapper

**Files modified:** 1 (`sync.service.ts`)  
**Verification:** `tsc --noEmit` + `next build`

---

### Step 5: Remove Write-Through Subscriptions from sync.service.ts

Remove remaining subscription blocks:
- Audit write-through
- Messaging write-through
- Tasks write-through
- Notifications write-through
- Location write-through
- Documents 201 write-through
- Disciplinary write-through
- Performance write-through
- BIR Compliance write-through

After this step, `startWriteThrough()` should be empty (just the `console.log` at the end).

**Files modified:** 1 (`sync.service.ts`)  
**Verification:** `tsc --noEmit` + `next build`

---

### Step 6: Simplify sync.service.ts

After Steps 4-5, `hydrateAllStoresInternal()` is nearly empty and `startWriteThrough()` is empty. Simplify:
- Remove `startWriteThrough()` / `stopWriteThrough()` (or make them no-ops)
- Simplify `hydrateAllStoresInternal()` to only fetch notif prefs
- Consider moving notif prefs to the notifications store's own `hydrateFromDb()`
- Clean up all unused imports

**Files modified:** 1 (`sync.service.ts`)  
**Verification:** `tsc --noEmit` + `next build`

---

### Step 7: Remove `_writePaused` Mechanism

With no write-through subscriptions, the `pauseWriteThrough()`/`resumeWriteThrough()` mechanism is dead code. Remove:
- `_writePaused` variable
- `pauseWriteThrough()` export
- `resumeWriteThrough()` export
- All references to `_writePaused` in the file

Also update `client-layout.tsx` if it references these functions.

**Verification:** `tsc --noEmit` + `next build`

---

### Step 8: Update Test Files

Tests that call `.getState()/.setState()` on these stores may need QueryClientProvider wrappers if the stores are ever converted to shims (future). For now, since stores remain Zustand, tests should still pass. Run full test suite to confirm.

**Verification:** `npx jest --no-coverage`

---

## Execution Order Summary

| Step | Risk | Est. Time | Files Changed |
|------|------|-----------|---------------|
| 1 | Low | 30 min | 9 store files |
| 2 | Low | 5 min | 1 (client-layout) |
| 3 | Medium | 60 min | 5 store files |
| 4 | Medium | 20 min | 1 (sync.service) |
| 5 | Medium | 15 min | 1 (sync.service) |
| 6 | Low | 15 min | 1 (sync.service) |
| 7 | Low | 10 min | 1-2 files |
| 8 | Low | 10 min | test files |
| **Total** | | **~2.5 hours** | |

---

## Post-Phase 4 State

After completion:
- **sync.service.ts** will contain ONLY:
  - Realtime channel setup (`startRealtime()` / `stopRealtime()`)
  - Notification preferences hydration (can be moved to notifications store)
  - `hydrateAllStores()` — becomes a thin wrapper calling `hydrateFromDb()` on all stores + setting up realtime
- **All 20+ stores** will be fully self-sufficient (self-hydrate + self-persist)
- **No write-through pattern** anywhere in the codebase
- **Login will fire 0 bulk fetches** — each store fetches its own data on-demand
- **Realtime** still provides multi-tab sync for 8 tables

---

## Phase 5 Preview (Final Cleanup)

After Phase 4:
1. Move realtime setup out of sync.service into a dedicated `src/services/realtime.service.ts`
2. Move notification prefs hydration into `notifications.store.ts`
3. Delete `sync.service.ts` entirely
4. Remove the StoreQueryBridge file (dead code since Phase 2 Step 11)
5. Remove the `offline-queue.store.ts` (dead code — never imported)
6. Consider converting the remaining Zustand stores to TanStack Query hooks (consumers switch gradually)
