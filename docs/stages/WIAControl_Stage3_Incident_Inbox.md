# WIAControl — Stage 3 Record: Make Exceptions Actionable

**Do not commit this file to the repository.** Store it alongside the Stage 1
and Stage 2 records in a password manager, internal wiki, or shared drive
with restricted access.

Last updated: 2026-08-19

## 1. Deliverable and scope

Per the implementation playbook (Section 7, Stage 3), the goal was: a
coordinator has one inbox where every open incident has a severity, owner,
due time, and permitted next action.

## 2. Starting state (before this stage)

A code review at the start of this stage found:

- `AttendanceIncident` had a `status` and `type`, but no `severity`, no
  `dueAt`, and no `ownerId` — every incident was implicitly treated the
  same regardless of urgency.
- Detection (`detectIncompleteAttendance`) was already duplicate-safe (it
  checked for an existing incident of the same type before creating one),
  but this had never been proven with an automated test.
- Only three actions existed: acknowledge, resolve, dismiss. There was no
  way to assign an owner or escalate severity.
- There was no dedicated incident list/filter view. Incidents were only
  visible bundled inside the day-view response, mixed with shifts and
  clock events, with no way to filter by date, worksite, employee,
  severity, or owner, and no way to see incidents from a day other than
  today.
- Detection only ran when a coordinator manually clicked a button. There
  was no scheduled/automatic detection.
- A significant, unrelated bug was found and fixed during this stage: every
  date/time shown across the app was hardcoded to Spain's timezone
  (`Europe/Madrid`), and shift creation hardcoded a `+02:00` UTC offset
  regardless of the company's configured timezone. Any company outside
  Spain would see and enter the wrong times. See Section 7 for detail.

## 3. Design decisions

| Decision | Choice |
| --- | --- |
| Severity levels | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` (new Prisma enum `IncidentSeverity`). |
| Severity rule | Deterministic, per incident type: `MISSING_CLOCK_IN` → HIGH; `LATE` → HIGH if the delay crosses the company's configurable threshold (default 30 minutes), otherwise LOW; `INCOMPLETE_CLOCK` and `OUTSIDE_LOCATION` → MEDIUM. |
| Due-time policy | Company-configurable minutes-to-due per severity (defaults: CRITICAL 60m, HIGH 240m, MEDIUM 1440m, LOW 4320m), stored as new fields on `Company`. |
| Ownership | An incident's `ownerId` references a `User` (SUPER_ADMIN/ADMIN/MANAGER only — an incident cannot be "owned" by a field employee). "Assign to me" resolves the owner server-side from the caller's own identity, so the client never has to know or send its own user id. |
| Escalate | Not a new status — it raises severity one level (LOW→MEDIUM→HIGH→CRITICAL) and requires a note, kept inside the existing state machine rather than inventing a new status value. |
| Inbox scope | Deliberately not bound to "today" like the day-view — an incident from three days ago that is still open must remain visible until resolved. |
| Scheduled detection | Vercel Cron, secret-protected (`CRON_SECRET`, sent by Vercel as a Bearer token), running every 15 minutes, iterating every company. Only wired up after the duplicate-safety of detection had its own passing automated test, per the playbook's explicit instruction. |

## 4. Files created or changed

| File | Purpose |
| --- | --- |
| `prisma/schema.prisma` | New `IncidentSeverity` enum; `severity`, `dueAt`, `ownerId` fields and an `owner` relation on `AttendanceIncident`; five new policy fields on `Company` (`lateSeverityThresholdMinutes`, `incidentDueMinutesCritical/High/Medium/Low`); new indexes. |
| `prisma/migrations/20260819100000_incident_severity_policy/` | New severity enum, incident fields, and company policy fields. |
| `prisma/migrations/20260819110000_incident_owner/` | New `ownerId` column, foreign key, and index. |
| `src/lib/wia-control/domain-core.ts` | Pure functions: `computeIncidentSeverity`, `computeIncidentDueAt`, `escalateSeverity`, and the `IncidentPolicy`/`IncidentSeverityLevel` types. |
| `src/lib/wia-control/domain.ts` | `incidentUpdateSchema` extended into a union supporting the original status-change shape plus new `ASSIGN` and `ESCALATE` action shapes; new optional incident-policy fields on `companySettingsSchema` (optional so the existing settings form, unaware of them, keeps working). |
| `src/lib/wia-control/service.ts` | `getIncidentPolicy` helper; severity/due-time wired into `recordClockEvent` (LATE, OUTSIDE_LOCATION) and `detectIncompleteAttendance` (MISSING_CLOCK_IN, INCOMPLETE_CLOCK); `updateAttendanceIncident` extended with ASSIGN and ESCALATE branches, each with its own audit log entry; new `listIncidents` with full filter support; new `detectIncompleteAttendanceForAllCompanies` for the cron job; `getCompanyTimezone` helper. |
| `src/app/api/control/incidents/route.ts` | New. `GET` — the filterable incident inbox endpoint (date, worksite, employee, severity, owner via `mine`/`UNASSIGNED`/id, status). |
| `src/app/api/cron/detect-incidents/route.ts` | New. Secret-protected scheduled detection endpoint. |
| `src/app/api/control/day/route.ts` | Now also returns `companyTimezone` in its response. |
| `src/components/control/incident-inbox.tsx` | New. Self-contained, filterable incident inbox component with its own data fetching (independent of the day-bound provider state) and all five actions (acknowledge, assign, resolve, dismiss, escalate) with note-collection UI for actions that require one. |
| `src/components/control/time-tracking-dashboard.tsx` | Incidents tab now renders `<IncidentInbox />` instead of inline, day-bound incident cards; removed now-dead local state and Spanish labels ("Resuelta"/"Descartada" → "Resolved"/"Dismissed"). |
| `src/components/control/wia-control-provider.tsx` | Added `companyTimezone` to shared state; added `assignIncidentOwner` and `escalateIncident`; fixed a bug where every mutation-triggered background refresh unmounted the entire app behind a full-page loading spinner, resetting local UI state such as the active tab (`if (loading)` → `if (loading && !hydrated)`). |
| `src/components/control/coverage-dashboard.tsx`, `employee-clock.tsx`, `shift-planner.tsx`, `company-settings.tsx` | Timezone fix: replaced hardcoded `"Europe/Madrid"` with the company's actual configured timezone; `shift-planner.tsx`'s shift-creation form now converts the entered wall-clock time using the company's real UTC offset instead of a hardcoded `+02:00`; `company-settings.tsx`'s timezone dropdown extended from 2 Spain-only options to 10 common timezones (UAE, Pakistan, Saudi Arabia, India, UK, US, UTC). |
| `src/lib/utils.ts` | New `getUtcOffsetString` / `toIsoWithTimezone` helpers for correct timezone-aware ISO timestamp construction. |
| `src/lib/wia-control/domain.test.ts`, `service.test.ts` | New tests for severity/due-date computation and for the duplicate-detection acceptance test. |
| `vercel.json` | Added the cron schedule (`*/15 * * * *`). |
| `.env.example` | Documented `CRON_SECRET`. |

## 5. Manual testing performed (real staging environment)

| Test | Result |
| --- | --- |
| Late clock-in gets correct severity/due-time | ✅ Pass. Severity and due-by time visible on the incident card, matching the configured policy. |
| Assign to me | ✅ Pass. Owner updates immediately, "Assign to me" button disappears once owned. |
| Escalate (with required note) | ✅ Pass. Severity moved up one level (Medium → High), audit-logged. |
| Dismiss (with required note) | ✅ Pass. Status became "Dismissed", incident left the open count. |
| Resolve (with required note) | ✅ Pass. |
| Inbox filters (date, worksite, employee, severity, owner, status) | ✅ Pass. Changing "Status" to "All statuses" revealed previously closed incidents; other filters narrowed the list correctly. |
| Scheduled detection triggered manually via `curl` with the correct `CRON_SECRET` | ✅ Pass. Response: `{"companiesProcessed":2,"incidentsCreated":1,"failures":[]}`. The created incident was confirmed in the inbox, including the correct severity and due-time. |
| Timezone display fix | ✅ Pass. With the company set to a non-Spain timezone, shift/clock/incident times displayed correctly instead of two hours off. |
| Timezone input fix | ✅ Pass. Creating a shift with the company set to `Asia/Dubai` and entering `2:00 PM` produced `10:00:00` UTC in the database (`14:00 − 4h`), confirmed via direct database query — previously it always produced `12:00:00` UTC regardless of the company's configured timezone. |

## 6. Known issues found during Stage 3

1. **The app-wide timezone bug (fixed).** Every displayed date/time was
   hardcoded to `Europe/Madrid`, and shift creation hardcoded a `+02:00`
   UTC offset, both regardless of the company's actual configured
   timezone. This was found by the product owner while testing with a
   Dubai timezone setting and confirmed by direct code inspection (`grep`
   found the literal string in 7 places). Fixed by threading the
   company's real configured timezone through the day-view response and
   into every display/format call, and by computing the correct UTC
   offset for any IANA timezone at shift-creation time.
2. **A UI state-reset bug (fixed).** Every action (assign, escalate,
   resolve, dismiss, and in fact any mutation anywhere in the app) briefly
   unmounted the entire operations UI behind a full-page "Loading
   operations" screen while refreshing data in the background, which reset
   any local UI state — most noticeably, it silently switched the active
   tab back to "Events" after any incident action taken from the
   "Incidents" tab. Fixed by only showing that full-page loading state on
   the very first load, not on every subsequent background refresh.
3. **`clocking-sequence.spec.ts` intermittently timed out during this
   stage's E2E runs**, waiting for "Shift completed" after "End shift".
   Traced to a large volume of accumulated test data (many worksites and
   shifts created across a full day of manual and automated testing
   without cleanup) combined with the pre-existing local-network latency
   issue documented in Stage 1 — not a regression in the clocking feature
   itself, which was independently confirmed working correctly through a
   full manual clock-in/break/clock-out/clock-out cycle in the browser.
4. **Carried over from Stage 1/2, still open:** no "set new password" step;
   validation-before-authorization ordering in API routes; no "invite team
   member" flow.

## 7. Stage 3 acceptance test

Playbook wording: *"Running detection twice for the same late arrival
results in one open incident, with a visible owner and resolution path."*

**Result: Pass.** Confirmed with a dedicated automated test
(`service.test.ts`, "detectIncompleteAttendance (Stage 3 acceptance test)")
that runs detection twice against the same shift and asserts exactly one
`attendanceIncident.create` call across both runs. Owner and resolution
path (acknowledge/assign/resolve/dismiss/escalate) confirmed manually and
via `service.test.ts`.

## 8. Follow-ups before pilot

- The 24-hour offline-queue expiry window (Stage 2) and the incident
  severity/due-time defaults (this stage) are both still pending explicit
  product-owner sign-off, per the playbook's requirement that these be
  deliberate decisions.
- No employee-editing UI exists anywhere in WIAControl — skills, zones,
  availability, and working-hour limits can currently only be set by
  directly editing the database. This became directly relevant once Stage
  4's hard constraints started actually using those fields (see the Stage
  4 record).
