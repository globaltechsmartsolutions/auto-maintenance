# WIAControl — Stage 2 Record: Make Clocking Reliable on a Phone

**Do not commit this file to the repository.** Store it alongside the Stage 1
record in a password manager, internal wiki, or shared drive with restricted
access.

Last updated: 2026-08-18

## 1. Deliverable and scope

Per the implementation playbook (Section 7, Stage 2), the goal was: an
employee can complete a shift with clear feedback even if the connection is
briefly lost, and offline behaviour is proven with tests rather than
assumed.

## 2. Starting state (before this stage)

A code review at the start of this stage found two real gaps in the
existing clock-in implementation:

1. **No offline queue existed.** If the network request behind a clock
   action failed, the event was simply lost. The employee had to notice
   and retry manually, with no record that anything had been attempted.
2. **The idempotency key was regenerated on every attempt.** The key was
   created inline inside the network call
   (`idempotencyKey: crypto.randomUUID()`), not persisted beforehand. A
   manual retry of the same action would have produced a **new** key each
   time, defeating the server's duplicate-prevention guarantee and risking
   duplicate clock events — a direct violation of playbook Section 6, Rule 4
   ("a duplicate clock request with the same idempotency key must return the
   original event, not create another one").

## 3. Design decisions (made before writing code, per the playbook's requirement)

| Decision | Choice |
| --- | --- |
| Queue format | A minimal `QueuedClockCommand` record: shift id, event type, timestamps, the idempotency key, optional coordinates, retry count, and status. No passwords or full employee records are stored. |
| Storage | IndexedDB in the browser, as the playbook specifies. |
| Idempotency key | Generated once on the device, the moment the button is tapped, and persisted before any network attempt. Never regenerated on retry. |
| Retry policy | Bounded exponential backoff: 0s, 5s, 15s, 30s, 60s, 120s, then stop automatic retries and mark the event "needs attention". |
| Expiry window | 24 hours, as a starting default. **This is an assumption pending explicit product-owner sign-off**, per the playbook's requirement to set this policy deliberately rather than leave it implicit. |
| Ordering | Strict FIFO — an earlier unsent event is always sent before a later one. |
| Server rejection vs. network failure | A network failure is retried automatically. A server-side validation rejection (closed shift, forbidden, etc.) is treated as "needs attention" immediately, since retrying an invalid request cannot succeed. |

## 4. Files created or changed

| File | Purpose |
| --- | --- |
| `src/lib/offline-clock-queue.ts` | Pure, storage-agnostic queue logic (command shape, FIFO ordering, backoff, expiry, idempotency rules). Unit tested in isolation. |
| `src/lib/offline-clock-queue-db.ts` | Browser-only IndexedDB storage adapter wrapping the pure logic above. |
| `src/lib/offline-clock-queue.test.ts` | Unit tests, including a dedicated test proving the idempotency key is never regenerated across retries. |
| `src/components/control/wia-control-provider.tsx` | `recordClockEvent` rewritten to queue-first, then send; added `sendQueuedCommand`, `flushQueue` (triggered on the `online` event and every 20s), `retryQueuedClockEvent`; added plain-English location-failure messages (`readCurrentLocation`, `locationUnavailableMessages`); added a specific message for an expired session (HTTP 401). |
| `src/components/control/employee-clock.tsx` | Added a status banner for `pending` / `sending` / `needs_attention`, a manual "Retry now" action, disabled the primary/end-shift buttons while a sync is in flight; fixed `activeShift` selection, which previously always picked the day's chronologically first shift even if already completed, blocking a later still-open shift from ever showing as "Current shift". |
| `playwright.config.ts` | New. Playwright E2E configuration (desktop and mobile Chromium projects). |
| `e2e/fixtures.ts` | New. Shared E2E helpers: login, worksite/shift setup via the API, leftover-shift cleanup, clock-event verification. |
| `e2e/clocking-sequence.spec.ts` | New. Full clock-in → break → clock-out sequence produces exactly one event of each type. |
| `e2e/offline-clock-in.spec.ts` | New. The Stage 2 acceptance test, automated: offline clock-in, then reconnect, produces exactly one event. |
| `e2e/cross-tenant-isolation.spec.ts` | New. Automates the Stage 1 tenant-isolation acceptance test. |
| `e2e/role-restriction.spec.ts` | New. An employee cannot perform ADMIN/MANAGER-only actions. |
| `e2e/mobile-usability.spec.ts` | New. The primary clock action is visible, tappable, and does not force horizontal scrolling on a mobile viewport. |
| `e2e/README.md` | New. Required environment variables and run instructions for the E2E suite. |
| `package.json` | Added `@playwright/test` and `test:e2e` / `test:e2e:ui` / `test:e2e:report` scripts. Not added to `preprod:verify`, since E2E needs a reachable staging environment and live credentials that CI does not have by default. |
| `.gitignore` | Added Playwright's generated output directories. |

## 5. Manual testing performed (real browser, real staging environment)

| Test | Result |
| --- | --- |
| Offline clock-in, then reconnect | ✅ Pass. IndexedDB held exactly one queued command through 4 automatic retries; after reconnecting, the database showed exactly one `CLOCK_IN` row with the same idempotency key throughout. |
| Automatic retry limit reached → "needs attention" | ✅ Pass. After exhausting the backoff schedule while still offline, the UI showed a clear error and a "Retry now" action. |
| Manual retry after reconnecting | ✅ Pass. The queued command sent successfully; the database still showed exactly one event for that action. |
| Location permission denied | ✅ Pass. The UI showed: "Location permission was denied. Enable it in your browser settings, or use the worksite's QR, PIN, or NFC method." The clock event was still recorded (without location), consistent with the playbook's instruction not to block the action on location denial. |

## 6. Automated E2E test suite (Playwright)

All 12 test runs pass (6 specs × 2 viewport projects):

```
12 passed (2.5m)
```

| Spec | Desktop | Mobile |
| --- | --- | --- |
| `clocking-sequence.spec.ts` | ✅ | ✅ |
| `offline-clock-in.spec.ts` | ✅ | ✅ |
| `cross-tenant-isolation.spec.ts` | ✅ | ✅ |
| `mobile-usability.spec.ts` | ✅ | ✅ |
| `role-restriction.spec.ts` (× 2 cases) | ✅ | ✅ |

Required environment variables (`E2E_ADMIN_EMAIL/PASSWORD`,
`E2E_EMPLOYEE_EMAIL/PASSWORD`, `E2E_COMPANY_B_ADMIN_EMAIL/PASSWORD`) are
documented in `e2e/README.md` and must be set locally (e.g. in `.env` or
`.env.local`, both git-ignored) — never commit real credentials.

Run with:
```bash
npm run test:e2e
```

## 7. Known issues found during Stage 2

1. **`activeShift` selection bug (fixed).** The employee clock page always
   picked the day's chronologically earliest shift as "Current shift",
   even if it was already `COMPLETED` or `CANCELLED`, which could hide a
   later shift that was actually ready to be worked. Fixed by preferring
   any shift that is not yet completed/cancelled over a finished earlier
   one.
2. **Local network TLS interception (pre-existing, documented in Stage 1)
   resurfaced during E2E testing.** Some test runs hit multi-second-to-30-
   second delays on individual API calls, tracing back to the same
   local-network issue recorded in the Stage 1 document. This is not a new
   defect; `playwright.config.ts` was tuned (60s test timeout, one retry)
   to keep the suite usable in the meantime, but the underlying network
   issue itself still needs to be resolved with IT before production.
3. **A testing lesson, not an app defect:** the first version of the
   offline E2E test considered the "pending" banner text disappearing as
   proof of a successful sync. In fact that same text also disappears the
   moment a retry attempt *starts* sending (before it succeeds), which
   could make a failing sync look like it passed. Fixed by waiting for an
   unambiguous, server-confirmed signal (the UI switching to the "Start
   break" button) instead.
4. **Carried over from Stage 1, still open (out of Stage 2 scope):**
   - No "set new password" step exists to complete the password-reset flow.
   - API routes validate the request body before checking authorization,
     so an unauthorized request with an incomplete payload can return
     `400` instead of `403`.
   - No "invite team member" flow exists; MANAGER/EMPLOYEE test accounts
     are still created manually.

## 8. Stage 2 acceptance test

Playbook wording: *"Switching the device offline immediately after tapping
clock-in, then retrying after reconnect, results in exactly one clock
event."*

**Result: Pass.** Confirmed manually (with real device offline simulation
via browser dev tools) and automatically (Playwright, both desktop and
mobile viewports), including under repeated automatic retries with the same
idempotency key.

## 9. Follow-ups before pilot

- Confirm the 24-hour queue expiry window with the product owner (playbook
  requires this to be a deliberate decision, not a default left unconfirmed).
- Resolve the local network TLS-interception issue with IT before
  production; do not carry `sslmode=no-verify` into production.
- The two Stage 1 carry-over items above (password reset completion,
  validation-before-authorization ordering) remain open.