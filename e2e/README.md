# WIAControl — Browser E2E tests (Playwright)

These are the browser end-to-end tests referenced in the implementation
playbook (Section 16). They run against a **real, non-demo** environment
(staging) using real Supabase accounts. They are not part of
`npm run preprod:verify`, because they need a reachable staging database and
live test accounts that CI does not have configured by default.

## Prerequisites

1. A staging environment set up per Stage 1 of the playbook, with:
   - Real mode enabled (`DEMO_MODE=false`, `NEXT_PUBLIC_DEMO_MODE=false`)
   - At least one ADMIN and one EMPLOYEE account in "Company A"
   - At least one Employee record (`Employee` row, not just a `User` row)
     for the EMPLOYEE account
   - A second company with its own ADMIN account ("Company B"), used only
     by the cross-tenant isolation test
2. Node dependencies installed, including Playwright:
   ```bash
   npm install
   npx playwright install --with-deps chromium
   ```
3. A running app pointed at that staging environment:
   ```bash
   npm run dev
   ```

## Required environment variables

Set these in `.env.local` (recommended, since it is git-ignored) or export
them in your shell before running the tests. **Never commit real
credentials.**

| Variable | Purpose |
| --- | --- |
| `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` | Company A administrator account |
| `E2E_EMPLOYEE_EMAIL` / `E2E_EMPLOYEE_PASSWORD` | Company A employee account (must have an `Employee` profile) |
| `E2E_COMPANY_B_ADMIN_EMAIL` / `E2E_COMPANY_B_ADMIN_PASSWORD` | A different company's administrator account, used only for the cross-tenant isolation test |
| `PLAYWRIGHT_BASE_URL` | Optional. Defaults to `http://localhost:3000`. Point this at a deployed staging URL instead if you are not running `npm run dev` locally. |

## Running the tests

```bash
npm run test:e2e          # headless, both desktop and mobile viewport projects
npm run test:e2e:ui       # interactive UI mode, useful while writing/debugging tests
npm run test:e2e:report   # open the last HTML report
```

## What each spec covers

| File | Playbook requirement it proves |
| --- | --- |
| `clocking-sequence.spec.ts` | A full clock-in → break → clock-out sequence produces exactly one event of each type |
| `offline-clock-in.spec.ts` | Stage 2 acceptance test: offline clock-in, then reconnect, produces exactly one event (never zero, never duplicated) |
| `cross-tenant-isolation.spec.ts` | Stage 1 acceptance test: a second company cannot list or mutate another company's data, even with the correct object ID |
| `role-restriction.spec.ts` | An EMPLOYEE cannot perform ADMIN/MANAGER-only actions |
| `mobile-usability.spec.ts` | The critical clocking action is usable on a mobile viewport, per Section 16's minimum test matrix |

## Notes on data

Every test creates its own worksite and shift via the API before running,
using the shared helpers in `fixtures.ts`. Tests do not depend on data
created manually through the UI during earlier exploratory testing, so they
are safe to re-run repeatedly without cleanup. Test data (worksites named
`E2E Worksite …` / `Isolation Test Worksite …`, and their shifts) will
accumulate in the staging database over time; periodically clearing staging
data is a Stage 6 (monitoring/support) concern, not something these tests
handle themselves.
