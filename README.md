# NexHRMS v2

Philippine HRMS web application built with Next.js 15, TypeScript, and Supabase.

## Stack

- **Framework:** Next.js 15 (App Router, React Compiler)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL + RLS)
- **State:** Zustand
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Tests:** Jest + React Testing Library + Playwright (E2E)
- **CI:** GitHub Actions

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server) | Service role key — never expose to client |
| `NEXT_PUBLIC_DEMO_MODE` | No | Set `true` to run without Supabase (uses local Zustand demo accounts) |
| `QR_HMAC_SECRET` | Yes (prod) | Secret for QR attendance HMAC signing |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Yes (push) | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | Yes (push) | VAPID private key |

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
npm run typecheck    # TypeScript type check
npm run test         # Jest unit tests (watch mode)
npm run test:ci      # Jest unit tests (CI, with coverage)
npm run e2e          # Playwright E2E tests
```

## Database Migrations

Migrations are in `supabase/migrations/` and applied in numeric filename order.
See `NEXHRMS_COMPLETION_PLAN.md` → NHRMS-STAB-004 for the canonical migration order.

```bash
supabase db push     # Apply migrations to linked Supabase project
supabase db reset    # Reset local DB and re-apply all migrations
```

## Project Plan

See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the phased feature roadmap.
See [`docs/PROGRESS.md`](./docs/PROGRESS.md) for the live ticket progress tracker.
See [`docs/PR_GUIDELINES.md`](./docs/PR_GUIDELINES.md) for branch naming, commit format, and PR template.
See [`NEXHRMS_COMPLETION_PLAN.md`](./NEXHRMS_COMPLETION_PLAN.md) for the full engineering plan including verification matrix, team assignments, CI findings, QA test plan, and release checklist.

## Docs

- [`docs/biometric-local-setup.md`](./docs/biometric-local-setup.md) — Local biometric device setup
- [`docs/biometric-vercel-setup.md`](./docs/biometric-vercel-setup.md) — Biometric setup for Vercel deployments

## Architecture

```
Raw Attendance Sources (Biometric / Mobile GPS / Web / Manual)
        ↓
Unified Attendance Logs
        ↓
Attendance Review
        ↓
Attendance Summaries
        ↓
OT Review & Approval
        ↓
Payroll Rules Engine (DOLE PH Standard / Custom)
        ↓
Payroll Computation
        ↓
Payslip
```

## CI/CD

GitHub Actions runs on every push and PR to `main`:

`Lint → Typecheck → Tests → Build → E2E → Deploy`

All jobs must pass before merge. See `.github/workflows/ci-main.yml`.
