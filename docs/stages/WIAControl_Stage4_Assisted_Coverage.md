# WIAControl — Stage 4 Record: Validate Assisted Coverage

**Do not commit this file to the repository.** Store it alongside the Stage
1–3 records in a password manager, internal wiki, or shared drive with
restricted access.

Last updated: 2026-08-19

## 1. Deliverable and scope

Per the implementation playbook (Section 7, Stage 4), the goal was: a
coordinator can fill a gap using a deterministic, explained candidate
ranking and safely record an override.

## 2. Starting state (before this stage)

A code review at the start of this stage found:

- The candidate-recommendation query only excluded employees by
  `fieldStatus` (VACATION/SICK_LEAVE/INACTIVE) and overlapping shifts.
  **Required skills and work zone only affected the score, they never
  excluded a candidate** — an employee missing a required skill, or with
  no connection to the worksite's zone, could still appear as a
  selectable, rankable candidate.
- **Declared employee availability was never checked at all**, even
  though the field (`Employee.availability`, JSON) already existed in the
  schema.
- **Working-time limits were never checked at all**, even though
  `Employee.maxHoursPerDay` and `maxJobsPerDay` already existed in the
  schema.
- Excluded employees were silently dropped from the candidate list with
  no record of who was excluded or why — the UI had no way to show this,
  because the API never returned it.
- `confirmCoverage` (the final confirmation step) only checked
  `fieldStatus` and overlap — **not** skills, zone, availability, or
  working-time limits. A direct API call with a bypassed/different
  employee id than the one shown in the recommendation list could
  therefore confirm someone the hard constraints would have excluded.
- The "fit score" shown next to a recommendation in the UI was a
  **hardcoded fake value** ("High fit · 94%"), not the real computed
  score.
- There is still no employee-editing UI anywhere in WIAControl (see
  Section 7) — skills, zones, availability, and working-hour limits can
  currently only be set by directly editing the database.

## 3. Design decisions

| Decision | Choice |
| --- | --- |
| Single source of truth | One pure function, `evaluateCoverageEligibility`, checks all seven hard constraints (company scope enforced by the caller's query; active status; availability; absence; overlapping shifts; required skills; work zone; working-time limits) and is called from **both** the recommendation list and the final confirmation, so the two paths can never drift apart. |
| Availability shape | A small JSON contract (`{ daysOfWeek?, startMinute?, endMinute? }`). Missing or malformed data is treated as "no restriction", never as a reason to silently exclude someone because of a data-entry gap. |
| Work zone | An employee with no declared zones is treated as having no zone restriction (works anywhere) — the constraint only excludes someone when they *do* have declared zones and none of them match the worksite's city. |
| Exclusion transparency | The recommendation endpoint returns both `candidates` (eligible, scored) and `excluded` (with a specific reason each), even when zero candidates are eligible — previously this case threw an error and discarded the exclusion data entirely. |
| Confirmation defense-in-depth | `confirmCoverage` independently re-runs the same eligibility function against the selected employee before writing anything, so a client cannot bypass the recommendation UI's exclusions by calling the confirm endpoint directly with an ineligible id. |

## 4. Files created or changed

| File | Purpose |
| --- | --- |
| `src/lib/wia-control/domain-core.ts` | New pure functions: `parseEmployeeAvailability`, `isEmployeeAvailableForShift`, `employeeMeetsRequiredSkills`, `employeeMeetsWorkZone`, `employeeMeetsWorkingTimeLimits`, and the unified `evaluateCoverageEligibility`. `scoreCoverageCandidate` unchanged (still used for ranking *among* already-eligible candidates). |
| `src/lib/wia-control/service.ts` | `recommendCoverageCandidates` rewritten to query every employee (not pre-filtered by status), run the full eligibility check per employee, and return both `candidates` and `excluded`; no longer throws when there are zero eligible candidates — returns `recommended: null` with the exclusion data intact. `confirmCoverage` rewritten to independently re-check the same eligibility function before confirming. |
| `src/components/control/coverage-dashboard.tsx` | "Find replacements" now calls the recommend endpoint directly (rather than the old fire-and-forget context action) so the full response — including exclusion reasons — is available to render; new `ExcludedCandidatesList` component (collapsible "Show/Hide N ineligible people" with each person's exact reason); the fake "High fit · 94%" badge replaced with the real computed score; a clear error/explanation panel shown when zero candidates are eligible; the "selected employee" dropdown in the confirmation dialog now sources from the real eligible-candidates list instead of the old, weaker status-only filter. |
| `src/lib/wia-control/domain.test.ts` | 19 new unit tests: one per hard constraint, the unified eligibility function's precedence/combination behaviour, and the availability-parsing helper's tolerance of missing/malformed data. |
| `src/lib/wia-control/service.test.ts` | 3 new tests: `confirmCoverage` rejects an employee on vacation, rejects one missing a required skill, and rejects one with an overlapping shift — each asserting no `CoverageDecision` was created. |
| `e2e/coverage-recommendation.spec.ts` | New. An API-level Playwright test (matching the existing style of `cross-tenant-isolation.spec.ts` and `role-restriction.spec.ts`) proving the Stage 4 acceptance test end to end against the real staging database: an overlapping employee is excluded from `candidates` with a specific reason in `excluded`, and a direct attempt to force-confirm that same employee is rejected server-side with `SHIFT_OVERLAP`. |

No Prisma schema or migration changes were required for this stage — every
field used (`availability`, `zones`, `skills`, `maxHoursPerDay`,
`maxJobsPerDay`) already existed; this stage only began actually reading
and enforcing them.

## 5. Manual testing performed (real staging environment)

| Test | Result |
| --- | --- |
| An employee missing a required skill is excluded, with the exact reason shown | ✅ Pass. Created an uncovered shift requiring a skill ("plumbing") the only staging employee doesn't have; "Find replacements" returned "No eligible replacement was found for this shift." with "Test1 Employee — Does not have all the required skills." under "Show 1 ineligible person". |
| An employee with an overlapping shift is excluded, with the exact reason shown | ✅ Pass. Same flow with an overlapping (rather than skill-mismatched) shift; reason shown was "Test1 Employee — Already assigned to an overlapping shift." (the overlap check runs before the skills check, so it reports whichever hard constraint is checked first). |
| Zero eligible candidates no longer fails silently | ✅ Pass. A clear red error panel and the excluded list both render; previously nothing was shown to the coordinator at all. |

## 6. Automated tests

- `domain.test.ts`: 39 tests total (17 new for Stage 4), all passing.
- `service.test.ts`: 9 tests total (3 new for Stage 4), all passing.
- `e2e/coverage-recommendation.spec.ts`: passing on both desktop and mobile
  Chromium projects.

```
Tests  59 passed (59)   — unit/service tests
```

## 7. Known issue found during Stage 4 (not part of this stage's task list)

**No employee-editing UI exists anywhere in WIAControl.** There is no page
or API route that lets an administrator or coordinator set an employee's
skills, zones, availability, or working-hour limits from inside the app —
`/api/control/employees` is read-only. The only page that visually
resembles an employee-management screen (`/employees`, labelled "Team" in
the sidebar) is a separate CRM/demo module showing entirely fictional
sample data (Laura Méndez, Miguel Prieto, etc.) with no connection to the
real WIAControl database; it does not show or allow editing real employees
such as the staging test account.

This means the Stage 4 hard-constraint logic is fully correct and tested,
but a real coordinator currently has no way to actually configure the data
those constraints depend on without direct database access. This was
raised with the product owner; a decision on building this UI is pending
confirmation before starting the work.

## 8. Stage 4 acceptance test

Playbook wording: *"an unavailable or overlapping employee never appears
as a selectable candidate; an override produces an auditable reason."*

**Result: Pass.** Confirmed via:
- `domain.test.ts` (unit level, every constraint individually),
- `service.test.ts` (service level, `confirmCoverage` rejects ineligible
  employees even via direct calls),
- `e2e/coverage-recommendation.spec.ts` (end-to-end against the real
  staging database, including the direct-API-bypass attempt),
- manual browser testing (both the skill-mismatch and overlap exclusion
  paths, with the reason visibly rendered in the UI).

The override-reason requirement (`OVERRIDE_REASON_REQUIRED`) was already
implemented before this stage and remains covered by its existing test.

## 9. Follow-ups before pilot

- Decide whether to build an employee-editing UI (Section 7) — pending
  product-owner confirmation.
- The audit log currently stores the *recommended* candidate's score and
  reasons plus counts, but not the full breakdown for every candidate
  shown. The live UI shows this at decision time; persisting the full
  breakdown to the audit trail as well would be a reasonable future
  enhancement if a historical record of every candidate considered (not
  just the one chosen) becomes a requirement.
