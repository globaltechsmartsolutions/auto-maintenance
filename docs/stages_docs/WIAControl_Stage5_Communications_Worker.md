# WIAControl — Stage 5 Record: Deliver Communications Reliably

**Do not commit this file to the repository.** Store it alongside the
Stage 1–4 records in a password manager, internal wiki, or shared drive
with restricted access.

Last updated: 2026-08-20

## 1. Deliverable and scope

Per the implementation playbook (Section 7, Stage 5), the goal was:
reassignment and operational messages are either delivered or visibly
failed; they are never silently lost or duplicated.

## 2. Starting state (before this stage)

A code review at the start of this stage found:

- The `CommunicationOutbox` Prisma model and its `PENDING`/`PROCESSING`/
  `SENT`/`FAILED`/`CANCELLED` states already existed, and `confirmCoverage`
  already created one `IN_APP` record as a side effect of every coverage
  decision — but nothing in the codebase ever read or processed those
  records. They accumulated in the database indefinitely, with no
  delivery, no retry, and no way for a coordinator to know whether a
  reassignment notification had actually reached anyone.
- No provider integration of any kind existed (no email library
  installed, no delivery abstraction).
- The UI only ever showed a bare count ("Queued communications: N"),
  never a status, a reason for failure, or an action.
- There was no `acknowledgedAt` field or equivalent — a message could not
  be marked as seen by its recipient.

## 3. A note on how this stage was built

This stage was implemented twice. The first attempt was built on a
now-outdated snapshot of the codebase; in parallel, the product owner had
pushed a separate, substantial set of fixes and additions to `main`
(a security fix in `confirmCoverage` that stopped trusting a
client-supplied `recommendedEmployeeId`, a timezone-aware day-boundary
calculation for daily working-hour limits, a real database-level unique
constraint for incident-detection idempotency, the password-reset
completion flow, and additional test coverage). Rather than merge two
divergent versions of `service.ts` by hand, the first attempt was fully
reverted and Stage 5 was rebuilt from scratch against the pulled,
up-to-date codebase, verified file-by-file against the full existing test
suite (67 tests passing before any Stage 5 code was added) to confirm
nothing from that other work was lost or overwritten.

## 4. Design decisions

| Decision | Choice |
| --- | --- |
| Channels this stage | `IN_APP` and `EMAIL` only, per the playbook. `SMS`/`WHATSAPP` records are routed to an explicit, honest "not yet available" failure rather than silently dropped or accidentally sent — nothing in this codebase creates an SMS/WhatsApp record regardless. |
| Idempotency key | The outbox record's own `id`, sent as the `Idempotency-Key` header to the email provider (Resend) on every attempt — a retried HTTP call after a network blip can never cause the provider to send the same email twice. No new schema field was needed for this. |
| Worker claim mechanism | An optimistic-lock `updateMany` (`WHERE id = ? AND status = ?`) before attempting delivery. If it affects zero rows, another concurrent worker run already claimed the record, and this run skips it — this is what makes the worker safe to schedule frequently and safe against overlapping runs, without needing a database-level advisory lock. |
| Retry policy | Bounded at 5 attempts, with a growing delay between them (1, 5, 15, 60, 240 minutes) — deliberately more spread out than the Stage 2 offline-clock-queue's seconds-scale backoff, since a delayed notification is far less urgent than a clock event, and this worker runs on a schedule rather than continuously in a browser tab. |
| Final failure state | `FAILED`, with the exact provider/validation error recorded in `lastError` (truncated to 500 characters) and the attempt count preserved — nothing is discarded, so a coordinator (or a future debugging session) can see exactly what happened. |
| Missing email provider | Returns an honest failure (`"No email provider is configured"`) rather than a false success. An EMAIL-channel message becomes visibly `FAILED` after its retries if `RESEND_API_KEY` is never configured, which is the correct, safe behaviour for an unconfigured provider — not a silent no-op. |
| Manual resend | Only permitted from `FAILED`, resets `attempts` to 0 and `nextAttemptAt` to now, and is audit-logged. Not available to an employee. |
| Acknowledgement | A distinct field (`acknowledgedAt`) from delivery (`sentAt`) — a message can be `SENT` without ever being acknowledged. Only the recipient employee can acknowledge their own message; a coordinator cannot acknowledge on someone else's behalf. |
| Where retries happen | This worker never runs delivery attempts inside a database transaction — an external network call held inside a transaction would hold a database lock for the call's full duration, which is unsafe. The claim, the delivery attempt, and the final status write are three separate, sequential steps. |

## 5. Files created or changed

| File | Purpose |
| --- | --- |
| `prisma/schema.prisma` | Added `RETRYING` to `CommunicationStatus` (the playbook's own state machine, Section 12, already named this state); added `acknowledgedAt` to `CommunicationOutbox`. |
| `prisma/migrations/20260820100000_communication_worker/migration.sql` | The above two changes. |
| `src/lib/wia-control/domain-core.ts` | New pure functions: `computeNextCommunicationAttempt` (bounded backoff schedule) and `hasExceededCommunicationAttempts`; extended `CommunicationDto` with the new fields. |
| `src/lib/wia-control/domain.ts` | New `communicationActionSchema` (`RESEND` \| `ACKNOWLEDGE`). |
| `src/lib/wia-control/communication-providers.ts` | New. `deliverInApp` (trivial success) and `deliverEmail` (Resend integration, with the outbox id as the idempotency key, and a small versioned template registry). |
| `src/lib/wia-control/service.ts` | New `processCommunicationOutbox` (the worker), `resendCommunication`, `acknowledgeCommunication`; `listCommunicationOutbox` extended to include the recipient's email. |
| `src/app/api/cron/process-outbox/route.ts` | New. Secret-protected scheduled worker endpoint, matching the Stage 3 cron pattern exactly. |
| `src/app/api/control/communications/route.ts` | Reshaped into a full DTO (status, attempts, last error, sent/acknowledged timestamps) instead of just a bare list. |
| `src/app/api/control/communications/[communicationId]/route.ts` | New. `PATCH` — resend (coordinator) or acknowledge (recipient employee). |
| `src/components/control/communications-outbox.tsx` | New. Self-contained monitoring component: status badges, attempt count and last error for failed messages, Resend and Acknowledge actions. Refetches when the shared communications count changes elsewhere in the app, and on a light 20-second interval to surface worker-driven status changes — but only actually re-renders when the fetched data has changed, so a background poll that finds nothing new never disturbs the screen. |
| `src/components/control/coverage-dashboard.tsx` | Mounted `<CommunicationsOutbox />`; also fixed a display bug found during testing (see Section 7). |
| `src/components/control/employee-clock.tsx` | Mounted `<CommunicationsOutbox />` on the employee's own page — found missing during testing (see Section 7); the same component works unmodified for both roles because the underlying API already scopes data by the caller's role. |
| `src/components/control/wia-control-provider.tsx` | Threaded the reshaped communications DTO through; fixed a real, pre-existing bug found during testing (see Section 7). |
| `vercel.json` | Added the `/api/cron/process-outbox` schedule (every 5 minutes — more frequent than incident detection, since the first retry step is only 1 minute). |
| `.env.example` | Documented `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. |
| `src/lib/wia-control/domain.test.ts` | 5 new tests for the retry-backoff pure functions. |
| `src/lib/wia-control/service.test.ts` | 11 new tests, including the literal Stage 5 acceptance test (see Section 8). |
| `e2e/communications-worker.spec.ts` | New. End-to-end: confirm coverage → communication created → worker delivers it → recipient acknowledges it, against the real staging database. |

## 6. Automated tests

```
Test Files  6 passed (6)
     Tests  83 passed (83)   (67 pre-existing + 16 new)
```

E2E: `communications-worker.spec.ts` passing on both desktop and mobile
Chromium projects, alongside all pre-existing Stage 1–4 specs (except the
long-standing, unrelated `clocking-sequence.spec.ts` flakiness already
documented in the Stage 3 record, caused by accumulated staging test data
plus local network latency — not a regression in the clocking feature).

## 7. Bugs found and fixed while testing this stage

None of these three were caused by Stage 5's own code, but each was
found only because Stage 5's end-to-end testing exercised paths that had
not been exercised before.

1. **`overrideReason` sent as an empty string instead of omitted (fixed).**
   `coverageDecisionSchema`'s `overrideReason` is `.optional()`, but a
   present-and-empty string still has to satisfy `.min(5)`. When a
   coordinator accepted the top recommendation (no override), the client
   sent `overrideReason: ""` instead of omitting the field entirely,
   which Zod correctly rejected as invalid — meaning confirming a
   recommended employee failed outright with "The submitted data is
   invalid." Fixed by sending `undefined` (which `JSON.stringify` omits)
   instead of an empty string.
2. **The shift card's status badge overlapped the worksite/address text
   (fixed).** The card's first grid column had a fixed `130px` width,
   sized for short labels like "Planned" or "Uncovered". The `COVERED`
   status label, "Replacement confirmed", is notably longer and does not
   wrap (`Badge` uses `whitespace-nowrap`), so it visually spilled into
   the next column. Fixed by letting that column grow to fit its content
   (`minmax(130px, auto)`) instead of a fixed width.
3. **No employee-facing way to see or acknowledge a communication
   (fixed).** `<CommunicationsOutbox />` was originally mounted only on
   the coordinator's Coverage page. The backend already scoped data
   correctly by role (an employee only ever sees their own messages, and
   `acknowledgeCommunication` already refused anyone but the recipient),
   but there was no UI surface for an employee to reach it at all. Fixed
   by mounting the same component, unmodified, on the employee's own
   page.

## 8. Stage 5 acceptance test

Playbook wording: *"a deliberately failing provider call becomes a
visible failed outbox item after bounded retries, without duplicate
messages."*

**Result: Pass.** Proven deterministically in `service.test.ts`
("a deliberately failing provider call becomes FAILED after bounded
retries, with no duplicate SENT"): a mocked, always-failing email
provider is invoked across `MAX_COMMUNICATION_ATTEMPTS` (5) separate
simulated worker runs against the same record. The test asserts:
- the record ends in `FAILED` with `attempts === 5`,
- the delivery provider was called exactly 5 times (no more, no fewer),
- across every single status update made throughout all 5 runs, the
  record was never once marked `SENT`.

This is deliberately a service-level test rather than an E2E one: the
real backoff schedule's later steps are up to 240 minutes apart, which
is not practical to wait out in a live browser test. The real HTTP and
database integration for the *successful* path (and the acknowledgement
flow) is instead proven by `e2e/communications-worker.spec.ts` against
the actual staging database — the same approach already used for Stage
3's duplicate-detection acceptance test.

Manual, non-scripted confirmation was also performed in the browser: a
real coverage decision produced a real `PENDING` communication, the
worker was triggered manually and moved it to `SENT`, and the UI
reflected the change within the 20-second refresh window without any
manual reload — then the recipient employee acknowledged it from their
own page.

## 9. Follow-ups before pilot

- **`RESEND_API_KEY` is not yet configured anywhere.** Until it is, every
  `EMAIL`-channel message will honestly and correctly become `FAILED`
  after its retries — this is safe, documented behaviour, not a bug, but
  no real email will be delivered until a Resend account and sending
  domain are set up and the key is added to the deployment environment.
- Carried over from Stage 4: no employee-editing UI exists yet
  (skills, zones, availability, working-hour limits) — still pending
  product-owner confirmation before starting.
- Carried over from Stage 3: the 24-hour offline-queue expiry window and
  the incident severity/due-time defaults are still pending explicit
  product-owner sign-off.