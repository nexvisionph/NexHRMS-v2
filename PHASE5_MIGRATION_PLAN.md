# Phase 5 Migration Plan: Delete sync.service.ts

**Date:** June 17, 2026  
**Goal:** Remove `src/services/sync.service.ts` entirely by relocating the only remaining active code (realtime channel) and removing dead references.

---

## Current State of sync.service.ts

After Phases 2-4, the file (1,098 lines) contains:

| Function | Status | Action Needed |
|----------|--------|---------------|
| `hydrateAllStores()` | No-op (sets `_hydrated = true`) | Remove — stores self-hydrate |
| `forceRehydrate()` | Resets `_hydrated` and calls internal | Keep as utility — move to new location |
| `startWriteThrough()` | No-op | Remove |
| `stopWriteThrough()` | Clears subscriptions array | Remove |
| `startRealtime()` | **ACTIVE** (~940 lines) — Supabase postgres_changes | Move to `realtime.service.ts` |
| `stopRealtime()` | Stops the realtime channel | Move to `realtime.service.ts` |

---

## Files Importing from sync.service (17 total)

| File | Imports Used |
|------|-------------|
| `client-layout.tsx` | `hydrateAllStores`, `startWriteThrough`, `startRealtime`, `stopRealtime`, `stopWriteThrough` |
| `kiosk/layout.tsx` | `hydrateAllStores`, `startWriteThrough` |
| `login/page.tsx` | `hydrateAllStores`, `startWriteThrough`, `startRealtime` |
| `attendance/_views/admin-view.tsx` | `forceRehydrate`, `stopWriteThrough`, `startWriteThrough` |
| `attendance/_views/employee-view.tsx` | `stopWriteThrough`, `startWriteThrough`, `forceRehydrate` |
| `employees/manage/_views/admin-view.tsx` | `forceRehydrate` |
| `payroll/_views/admin-view.tsx` | imports from sync (likely `forceRehydrate`) |
| `settings/_views/admin-view.tsx` | `forceRehydrate` |
| `dashboard/admin-dashboard.tsx` | `forceRehydrate` |
| `shell/sidebar.tsx` | `stopWriteThrough` |
| `shell/topbar.tsx` | `stopWriteThrough` |
| `hooks/use-store-query-bridge.ts` | (dead code — no longer mounted) |
| `lib/employee-data.ts` | (no direct import, but may reference) |
| `lib/storage.ts` | (may reference sync patterns) |
| `store/disciplinary.store.ts` | (may reference) |
| `store/documents.store.ts` | (may reference) |
| `store/employees.store.ts` | (may reference) |

---

## Dead Code to Remove

| File | Status | Reason |
|------|--------|--------|
| `src/hooks/use-store-query-bridge.ts` | Dead code | No longer imported by any file |
| `src/store/offline-queue.store.ts` | Dead code | Only referenced by `lib/clear-stale-storage.ts` (for localStorage cleanup) |

---

## Migration Steps

---

### Step 1: Create `src/services/realtime.service.ts`

**Goal:** Extract `startRealtime()` and `stopRealtime()` into a dedicated file.

**Actions:**
1. Create `src/services/realtime.service.ts`
2. Copy `startRealtime()` and `stopRealtime()` from sync.service.ts
3. Copy the `_realtimeChannel`, `_realtimeRetries`, `MAX_RETRIES` variables
4. Copy the `safe()` helper function
5. Copy all necessary imports (store imports used in realtime handlers, `createClient`, `keysToCamel`, `employeeFromDb`)
6. Export `startRealtime` and `stopRealtime`

**Verification:** `tsc --noEmit` (new file compiles, sync.service still intact)

---

### Step 2: Create `forceRehydrate()` Utility

**Goal:** `forceRehydrate()` is used by 5 components to refresh store data after bulk operations. Move it to a simple utility.

**Actions:**
1. Create a standalone `forceRehydrate()` in `src/services/realtime.service.ts` (or a new `src/lib/rehydrate.ts`)
2. Implementation: calls `hydrateFromDb()` on all stores (same as client-layout does after login)

```ts
export async function forceRehydrate(): Promise<void> {
    await Promise.all([
        useEmployeesStore.getState().hydrateFromDb(),
        useAttendanceStore.getState().hydrateFromDb(),
        usePayrollStore.getState().hydrateFromDb(),
        // ... all other stores
    ]);
}
```

**Verification:** `tsc --noEmit`

---

### Step 3: Move Notification Prefs Hydration

**Goal:** `sync.service.ts` fetches employees to extract `notificationPreferences` and hydrates the notifications store. Move this into `notifications.store.ts`'s `hydrateFromDb()`.

**Actions:**
1. In `notifications.store.ts` → `hydrateFromDb()`, after fetching logs/rules, also fetch employee notification preferences
2. Import `employeesDb` into notifications.store.ts
3. Add logic: fetch employees → extract notificationPreferences → merge into `employeePrefs`

**Verification:** `tsc --noEmit`

---

### Step 4: Update All Consumers to Import from New Locations

**Goal:** Replace `from "@/services/sync.service"` with the new import paths.

**Import mapping:**

| Old Import | New Import |
|-----------|-----------|
| `startRealtime` | `from "@/services/realtime.service"` |
| `stopRealtime` | `from "@/services/realtime.service"` |
| `forceRehydrate` | `from "@/lib/rehydrate"` (or `realtime.service`) |
| `hydrateAllStores` | **Remove** (no-op — stores self-hydrate from client-layout) |
| `startWriteThrough` | **Remove** (no-op) |
| `stopWriteThrough` | **Remove** (no-op) |

**Files to update (17):**

| File | Changes |
|------|---------|
| `client-layout.tsx` | Keep `startRealtime`/`stopRealtime` (from new path). Remove `hydrateAllStores`/`startWriteThrough`/`stopWriteThrough` |
| `kiosk/layout.tsx` | Remove `hydrateAllStores`/`startWriteThrough` imports + calls |
| `login/page.tsx` | Remove `hydrateAllStores`/`startWriteThrough`. Keep `startRealtime` from new path |
| `attendance/admin-view.tsx` | Replace `forceRehydrate` import path. Remove `stopWriteThrough`/`startWriteThrough` |
| `attendance/employee-view.tsx` | Same as above |
| `employees/manage/admin-view.tsx` | Replace `forceRehydrate` import path |
| `payroll/admin-view.tsx` | Replace `forceRehydrate` import path |
| `settings/admin-view.tsx` | Replace `forceRehydrate` import path |
| `dashboard/admin-dashboard.tsx` | Replace `forceRehydrate` import path |
| `shell/sidebar.tsx` | Remove `stopWriteThrough` import + call |
| `shell/topbar.tsx` | Remove `stopWriteThrough` import + call |
| `hooks/use-store-query-bridge.ts` | Delete file (dead code) |
| Other store/lib files | Remove any remaining references |

**Verification:** `tsc --noEmit`

---

### Step 5: Delete `sync.service.ts`

**Goal:** Remove the file entirely.

**Actions:**
1. Delete `src/services/sync.service.ts`
2. Verify no remaining imports reference it

**Verification:** `tsc --noEmit` + `next build`

---

### Step 6: Delete Dead Code Files

**Goal:** Remove files that are no longer imported or serve any purpose.

**Files to delete:**
1. `src/hooks/use-store-query-bridge.ts` — No longer imported by any file
2. `src/store/offline-queue.store.ts` — Never imported by any component (only referenced in `clear-stale-storage.ts` for localStorage key cleanup)

**Actions:**
1. Delete both files
2. Update `src/lib/clear-stale-storage.ts` to remove the `offline-queue` localStorage key reference (if any)

**Verification:** `tsc --noEmit` + `next build`

---

### Step 7: Final Verification

**Actions:**
1. Run `tsc --noEmit` — zero errors
2. Run `next build` — passes clean
3. Run `npx jest --no-coverage` — all tests pass
4. Verify no file in `src/` still contains `sync.service` or `sync-service` string

**Verification:** All green

---

## Execution Order Summary

| Step | Risk | Files Created | Files Modified | Files Deleted |
|------|------|---------------|----------------|---------------|
| 1 | Low | 1 (`realtime.service.ts`) | 0 | 0 |
| 2 | Low | 1 (`lib/rehydrate.ts`) | 0 | 0 |
| 3 | Low | 0 | 1 (`notifications.store.ts`) | 0 |
| 4 | Medium | 0 | 17 files | 0 |
| 5 | Low | 0 | 0 | 1 (`sync.service.ts`) |
| 6 | Low | 0 | 1 | 2 (`use-store-query-bridge.ts`, `offline-queue.store.ts`) |
| 7 | — | 0 | 0 | 0 (verification only) |

---

## Estimated Effort

| Step | Time |
|------|------|
| Step 1 | 15 min (copy + adjust imports) |
| Step 2 | 10 min |
| Step 3 | 10 min |
| Step 4 | 30 min (17 files, mechanical) |
| Step 5 | 1 min |
| Step 6 | 5 min |
| Step 7 | 5 min |
| **Total** | **~75 min** |

---

## Post-Phase 5 Architecture

```
Login → client-layout.tsx:
  1. Verify session (supabase-browser.ts)
  2. Call hydrateFromDb() on all 20 stores (parallel, on-demand)
  3. Call startRealtime() (from realtime.service.ts)

Page navigation → stores already have data (cached from step 2)

Store mutation → optimistic local update + fire-and-forget db.service call

Other tab makes DB change → Supabase Realtime → realtime.service patches store
```

**No more:**
- ❌ Global bulk hydration (45 parallel fetches on login)
- ❌ Write-through subscriptions (JSON.stringify comparison on every state change)
- ❌ `_writePaused` mechanism
- ❌ sync.service.ts (deleted)

**What remains:**
- ✅ Individual stores fetch their own data on-demand
- ✅ Individual stores persist their own mutations directly
- ✅ Realtime channel for multi-tab sync
- ✅ TanStack Query for Phase 1 stores (roles, deductions, jobs)
- ✅ Zustand for all other stores (self-sufficient)
