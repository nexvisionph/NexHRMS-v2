# NexHRMSV2 — Sync & Parity Context

> **Read this first** if you are an AI assistant or developer picking up work on V2.
> This document explains how V2 relates to V1 and what to verify before making changes.

---

## 1. Repository Relationship

| | V1 (Source of Truth) | V2 (This Repo) |
|---|---|---|
| **Path** | `c:\Users\jcuad\OneDrive\Documents\NexHRMS` | `c:\Users\jcuad\OneDrive\Documents\NexHRMSV2` |
| **Remote** | `mozhdeveloper/SorenHRMS` | `nexvisionph/NexHRMS-v2` |
| **Branding** | "Soren" / "SorenHRMS" | "NexHRMS" / "NexVision" |
| **Codebase** | Original / canonical | 1:1 mirror with rebrand |
| **Database** | 52 incremental migrations | 16 consolidated migrations |

V2 is a **branding fork** of V1. All application logic, components, API routes, stores, and types are intended to be **byte-for-byte identical** to V1, except for branding strings (titles, logos, persist keys, copyright notices, etc.).

---

## 2. Sync Status (Last verified: April 2026)

### 2A. Source Code (`src/`)
- ✅ **270 of 271 files** present in V2 (V1 has 2 stale `.bak`/`.old` files that are intentionally NOT copied)
- ✅ **40 API routes** in V2 (V1 has 39 — V2 adds `/api/kiosk/register-device`)
- ✅ All Zustand stores present
- ✅ All components present
- ✅ All services and lib utilities present

### 2B. Public Assets (`public/`)
- ✅ Identical file lists between V1 and V2
- ✅ `models/face-api/` — full ML models present (~12 MB)
- ✅ Icons, manifest, splash screens

### 2C. Database Migrations (`supabase/migrations/`)
| V2 File | Covers V1 Migrations |
|---------|---------------------|
| 001-014 (initial) | V1 001-014 (foundational schema) |
| `015_attendance_logs_unique.sql` | V1 015 (indexes & checks) |
| `016_v1_parity.sql` | **Bundles V1 migrations: 015, 018, 019, 020, 021, 023, 027, 029, 034, 035, 039, 040, 041, 044, 046, 047, 048, 049, 050, 051, 052** |

#### Known migration gaps to verify before production:
- **`016_fix_loans_timestamp.sql`** (V1) — V2's `loans.created_at` is `DATE`; V1 fix converts to `TIMESTAMPTZ`. Apply manually if needed.
- 3 V1 migrations (`024`, `025`, `033`) are *partially* covered: V2's RLS policies are more permissive than V1's. Functional but less granular.

---

## 3. Feature Parity Verified

The following major features have been verified as functionally identical between V1 and V2:

### ✅ QR Attendance
- `src/lib/qr-utils.ts` — HMAC-signed QR tokens
- `src/services/qr-token.service.ts`
- `src/app/api/attendance/validate-qr/route.ts`
- `src/app/api/attendance/generate-qr-token/route.ts`
- `src/app/api/attendance/daily-qr/route.ts`
- `src/app/kiosk/qr/page.tsx`
- `src/__tests__/features/qr-utils.test.ts`

### ✅ Face Recognition
- `src/lib/face-api.ts` (model loading, embedding generation)
- `src/services/face-recognition.service.ts`
- `src/app/api/face-recognition/enroll/route.ts`
- `src/app/api/attendance/verify-face/route.ts`
- `src/components/attendance/face-recognition.tsx`
- `src/app/kiosk/face/page.tsx`
- `src/app/kiosk/face/enroll/page.tsx`
- `public/models/face-api/*` — TinyFaceDetector, FaceLandmark68Net, FaceRecognitionNet weights

### ✅ Push Notifications
- `src/app/api/push/subscribe/route.ts`
- `src/app/api/push/send/route.ts`
- `src/app/api/push/resubscribe/route.ts`
- `src/lib/notifications.ts`
- `src/store/notifications.store.ts`
- `src/components/push-notification-prompt.tsx`
- `src/components/push-notification-banner.tsx`
- `public/sw.js` — full service worker (push, notificationclick, pushsubscriptionchange, app badge API, role-aware routing)

### ✅ PWA
- `src/app/manifest.ts` — Next.js dynamic manifest
- `public/manifest.json` — static manifest
- `public/sw.js` — service worker with offline caching
- `public/android-chrome-*.png`, `apple-touch-icon.png` — install icons
- `next.config.ts` — security headers, model cache headers, `optimizePackageImports`

### ✅ Import / Export with Validation
- `src/app/api/import/payroll/route.ts` — dryRun + per-row validation
- `src/app/api/import/attendance/route.ts` — dryRun + per-row validation
- `src/components/import-data-dialog.tsx` — auto-validates on upload, shows valid/duplicate/error per row
- `src/lib/export-utils.ts` — XLSX/CSV export, template generation, file parsing

---

## 4. Branding Differences (Expected)

These differences between V1 and V2 are **intentional** and should NOT be reverted:

| Concern | V1 | V2 |
|---------|----|----|
| App name | `Soren HRMS` / `SorenHRMS` | `NexHRMS` / `NexVision` |
| Service worker `CACHE_NAME` | `nexhrms-v1` | `nexhrms-v1` *(same — already nex-prefixed)* |
| Zustand persist keys | `soren-*` | `nex-*` |
| Email/copyright text | `Soren ...` | `NexHRMS ...` |
| Logo/brand SVGs | Soren marks | NexVision marks |
| `package.json` `name` | `soren-hrms` | `nexhrms-v2` |
| `.env.local` keys | Same names, may differ in values (Supabase project, VAPID keys) |
| `next.config.ts` CSP `img-src` | includes `*.supabase.co` only | also includes `images.unsplash.com`, `i.pravatar.cc` |

When syncing files V1 → V2, **always re-check for stray "Soren" strings** after copy.

---

## 5. How to Sync a File V1 → V2

Always use **binary copy** to avoid PowerShell encoding corruption:

```powershell
$v1 = "c:\Users\jcuad\OneDrive\Documents\NexHRMS"
$v2 = "c:\Users\jcuad\OneDrive\Documents\NexHRMSV2"
$file = "src\path\to\file.ts"
$bytes = [IO.File]::ReadAllBytes("$v1\$file")
[IO.File]::WriteAllBytes("$v2\$file", $bytes)
```

**Do NOT** use `Set-Content` or `Copy-Item` — they have caused encoding issues in this repo before (BOM and CRLF/LF problems).

After copying, scan for branding leaks:
```powershell
Select-String -Path "c:\Users\jcuad\OneDrive\Documents\NexHRMSV2\src\path\to\file.ts" -Pattern "soren" -CaseSensitive:$false
```

---

## 6. Pre-Flight Checklist for AI Assistants

Before suggesting any change to V2, verify:

- [ ] Is the same change already in V1? V2 should not diverge except for branding.
- [ ] If touching the database, does the change apply to V2's `016_v1_parity.sql` bundle or need a new migration?
- [ ] If touching `next.config.ts`, preserve V2's added CSP image sources (`unsplash`, `pravatar`).
- [ ] If touching `public/sw.js`, the V1 version is canonical (8281 bytes — includes offline caching, app badge, role-aware notification routing).
- [ ] If touching `package.json`, keep the V2-specific `name` field but sync everything else.
- [ ] After any code change, run `npm run build` from V2 root to confirm no regressions.
- [ ] After importing a feature from V1, search the copied file for `soren` (case-insensitive) and replace appropriately.

---

## 7. Known Build Constraints

- **Framework:** Next.js 16.1.6 (Turbopack)
- **TypeScript:** strict mode
- **Build command:** `npm run build` from repo root
- **Expected route count:** ~55+ routes generated
- **Common gotchas:**
  - Use `let { data }` not `const` in API routes when reassigning Supabase responses
  - All API routes must use `createServerSupabaseClient` from `@/services/supabase-server`
  - `useEffect` deps must be exhaustive (linter is strict)

---

## 8. Recent Sync History

| Date | What was synced | Notes |
|------|----------------|-------|
| Initial | Full V1 codebase → V2 (140+ files) | 1:1 copy with rebrand |
| Earlier | `016_v1_parity.sql` migration | Bundles 21 V1 schema changes |
| Recent | Import/export feature with dryRun validation | `payroll/route.ts`, `attendance/route.ts`, `import-data-dialog.tsx` |
| April 2026 | `public/sw.js` (offline caching, badges, role-aware routing) | V2 had stripped-down version (3352B → 8281B) |
| April 2026 | `next.config.ts` (`reactStrictMode`, `optimizePackageImports`, supabase img-src) | Added missing PWA optimizations while preserving V2's extra image sources |

---

## 9. What V2 Is Allowed to Have That V1 Doesn't

Currently only:
- `src/app/api/kiosk/register-device/route.ts` — V2-specific kiosk device registration endpoint
- Branding assets and strings (see Section 4)
- Different `.env.local` values (Supabase project, VAPID keys)
- Extra CSP image sources (`unsplash`, `pravatar`) in `next.config.ts`

Everything else should mirror V1. If V2 diverges from V1 in any other file, **investigate** — it is most likely a sync gap, not an intentional change.
