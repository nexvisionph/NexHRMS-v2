# NexHRMS — Pull Request Guidelines

> For all contributors. Interns must read this before opening their first PR.

---

## The Non-Negotiables

Before anything else — these rules are absolute. No exceptions.

1. **No direct commits to `main`.** Everything goes through a PR.
2. **No PR without a ticket ID.** Every PR maps to a ticket (e.g., `NHRMS-OT-001`).
3. **CI must be green before merge.** All 5 jobs: Lint → Typecheck → Tests → Build → E2E.
4. **Senior developer approves all merges.** You cannot merge your own PR.
5. **Payroll computation PRs require Senior Dev approval + test evidence.** No exceptions.
6. **Migration PRs require schema review.** No DROP, TRUNCATE, or non-additive ALTER without Senior Dev sign-off.

---

## Branch Naming

Always branch off `main`. Use this format exactly:

```
<type>/<ticket-id>-short-description
```

**Types:**

| Type | When to use |
|---|---|
| `feature` | New functionality |
| `fix` | Bug fix |
| `chore` | Non-feature work (cleanup, config, dependencies) |
| `test` | Adding or fixing tests |
| `docs` | Documentation only |
| `ci` | Changes to CI/CD pipeline |
| `refactor` | Code restructure with no behavior change |

**Examples:**

```
feature/NHRMS-OT-001-approved-ot-payroll-integration
feature/NHRMS-PAYRULE-001-payroll-rules-settings-ui
feature/NHRMS-ATT-003-attendance-review-api
fix/NHRMS-ATT-006-attendance-location-schema-drift
test/NHRMS-QA-002-ot-payroll-regression-tests
docs/NHRMS-STAB-005-baseline-stability-status
chore/NHRMS-STAB-001-configure-branch-protection
```

---

## Commit Message Format

```
<type>(<ticket-id>): <short summary in present tense>
```

**Keep summaries under 72 characters. Use present tense ("add", not "added").**

**Examples:**

```
feat(NHRMS-OT-001): use approved OT records in payroll computation
fix(NHRMS-ATT-006): add missing attendance location columns migration
test(NHRMS-QA-002): add OT approval payroll inclusion regression
docs(NHRMS-STAB-005): document baseline stability status
refactor(NHRMS-PAYRULE-003): remove hardcoded multipliers from engine
chore(NHRMS-STAB-001): configure branch protection rules on main
ci(NHRMS-STAB-001): add migration duplicate-number check to pipeline
```

**Allowed types:** `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `ci`

---

## PR Title Format

```
[<ticket-id>] <Clear description of what this PR does>
```

**Examples:**

```
[NHRMS-OT-001] Connect Approved Overtime to Payroll Computation
[NHRMS-PAYRULE-001] Add Payroll Rules Settings UI
[NHRMS-ATT-003] Implement Attendance Review API
[NHRMS-STAB-004] Audit and Document Migration Execution Order
[NHRMS-QA-002] Add OT Approval to Payroll Regression Tests
```

---

## PR Description Template

Copy this template every time you open a PR. Fill in every section. Do not leave sections blank.

````md
## Ticket

`<ticket-id>` — <one-line description of the ticket>

Link: <!-- paste GitHub issue or ticket URL if available -->

---

## Summary

<!-- What does this PR do and why? 2–4 sentences. -->

---

## Scope

- [ ] Backend (API routes, services, stores)
- [ ] Frontend (pages, components, views)
- [ ] Database / Migration
- [ ] RLS / Security
- [ ] Tests (unit, integration, E2E)
- [ ] Documentation
- [ ] CI/CD

---

## Changes Made

<!-- List the files changed and what changed in each. Be specific. -->

- `src/...` — 
- `supabase/migrations/...` — 
- `src/__tests__/...` — 

---

## How to Test This

<!-- Step-by-step instructions for the reviewer to verify the change works. -->

1. 
2. 
3. 

---

## Validation Checklist

- [ ] `npm run typecheck` — passed
- [ ] `npm run lint` — passed (0 new errors)
- [ ] `npm run build` — passed
- [ ] `npm run test:ci` — passed
- [ ] Migration verified (SQL reviewed, additive-only confirmed)
- [ ] RLS verified (tested with: admin / hr / employee roles)
- [ ] Manual QA completed

**Commands run:**

```bash
# paste the commands and their output here
npm run typecheck
npm run lint
npm run test:ci
```

---

## Screenshots / Evidence

<!-- Attach screenshots, terminal output, or a short screen recording. -->
<!-- For API changes: paste the curl/Postman response. -->
<!-- For UI changes: before/after screenshots. -->
<!-- For migrations: paste the Supabase migration output. -->

---

## Risk Level

- [ ] **Low** — UI only, additive migration, or new test (no logic change)
- [ ] **Medium** — New API route, new store, feature addition
- [ ] **High** — Payroll computation change, migration with ALTER/DROP, auth/RLS change

**Explain the risk:**

---

## Rollback Plan

<!-- How do you undo this if it breaks production? -->
<!-- For migrations: write the exact SQL to reverse it. -->
<!-- For computation changes: identify the last known-good commit hash. -->

---

## Notes for Reviewer

<!-- Anything the reviewer must look at carefully. -->
<!-- Flag any areas where you are unsure. -->
````

---

## Risk Level Guide

Use this to decide your risk level honestly:

| Scenario | Risk |
|---|---|
| Adding a new UI component, updating text, styling | Low |
| New page or view that reads existing data | Low |
| New Jest test file | Low |
| New API route (GET only) | Medium |
| New API route (POST/PATCH/DELETE) | Medium |
| New Zustand store | Medium |
| Additive migration (CREATE TABLE, ADD COLUMN) | Medium |
| Any change to `payroll-computation-engine.ts` | **High** |
| Migration with ALTER, DROP, TRUNCATE | **High** |
| Any change to RLS policies | **High** |
| Any change to auth flow or middleware | **High** |
| Any change to `src/services/supabase-*.ts` | **High** |

---

## What Interns Must NOT Do

| ❌ Don't | ✅ Do instead |
|---|---|
| Directly edit `payroll-computation-engine.ts` | Ask Senior Dev to pair on it |
| Write migrations with DROP or TRUNCATE | Use additive-only SQL; escalate to Senior Dev |
| Merge your own PR | Assign reviewer and wait for approval |
| Push directly to `main` | Always branch and open a PR |
| Open a PR while CI is failing | Fix the failures first |
| Guess at RLS policy logic | Ask Senior Dev; test each role explicitly |
| Leave the rollback plan blank | Every PR needs a rollback plan |

---

## Reviewer Checklist (for Senior Dev)

When reviewing a PR, check these before approving:

- [ ] Ticket ID is in the title
- [ ] CI is fully green
- [ ] Branch naming follows the convention
- [ ] Commit messages follow the format
- [ ] Description template is filled in
- [ ] Validation checklist items are confirmed (not just ticked blindly)
- [ ] Screenshots or terminal output are included where applicable
- [ ] Risk level is appropriate for the change
- [ ] Rollback plan is realistic
- [ ] For payroll PRs: test coverage is present
- [ ] For migration PRs: SQL is additive-only (or has explicit sign-off for non-additive)
- [ ] For RLS PRs: each role has been tested explicitly

---

## Quick Reference Card

```
Branch:   feature/NHRMS-XXX-short-description
Commit:   feat(NHRMS-XXX): what this commit does
PR title: [NHRMS-XXX] What This PR Does
```

**Before opening your PR:**
```bash
npm run typecheck   # must pass
npm run lint        # must pass
npm run test:ci     # must pass
npm run build       # must pass
```

**Assigned reviewer:** Senior Developer / Project Lead
**Merge authority:** Senior Developer only
