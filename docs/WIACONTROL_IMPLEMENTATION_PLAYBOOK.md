# WIAControl Implementation Playbook

**Audience:** The developer responsible for completing and operating WIAControl.

**Purpose:** This is the practical companion to the product roadmap. Read it
before making changes. It explains what exists today, what is still required,
and the exact order in which to make WIAControl safe for a pilot customer.

## 1. Read this first

WIAControl is an operations system for service companies. Its critical workflow
is:

1. An administrator configures a company, its people, worksites, and policies.
2. A coordinator creates and assigns shifts.
3. An employee records attendance for their own assigned shift.
4. The system records exceptions such as late arrival, missing attendance, or
   an uncovered shift.
5. A coordinator reviews the exception, selects a replacement when needed, and
   records the decision.
6. The affected employee is notified and the company can later export the
   complete evidence trail.

The goal is not to add screens quickly. The goal is that this workflow works
reliably for a real company, with clear accountability and tenant isolation.

## 2. Truthful project status

Use this table to decide where to work. “Implemented” means that source code,
data model, and an application route already exist. It does **not** mean that a
real customer workflow has been validated in staging.

| Area | Current status | What is present now | What remains before a pilot |
| --- | --- | --- | --- |
| Operations UI | Implemented for demo | Dashboards for coverage, worksites, shifts, employees, and time tracking. | Test every core action against real authenticated data and improve failure states. |
| Authentication | Partially implemented | Supabase session lookup, roles, protected server routes, and auth pages. | Provision staging Supabase; test all role and cross-company boundaries. |
| Tenant scoping | Implemented in core services | Company ID is resolved server-side and passed to domain services. | Add route-level regression tests for every mutation and malicious-ID attempt. |
| Worksites and shifts | Implemented foundation | CRUD routes, overlap checks, worksite archive protection, and audit records. | Validate real coordinator workflows, time zones, cancellation, and role permissions. |
| Clock events | Implemented foundation | Append-only events, idempotency keys, transition validation, integrity hashes, and location/alternative-method verification. | Add device behaviour, offline queue, retry UX, and end-to-end mobile tests. |
| Corrections | Implemented foundation | Separate correction requests linked to original clock events. | Test employee acknowledgement, review, disagreement, export, and permissions in staging. |
| Incidents | Implemented foundation | Incident entities and core detection/resolution routes. | Add policy configuration, severity, ownership, due times, scheduled detection, and an operational inbox. |
| Replacement recommendations | Implemented foundation | Deterministic candidate evaluation, score explanations, coverage decisions, and audit records. | Enforce all real availability/rest rules; validate decisions with coordinators. Never enable automatic assignment for the pilot. |
| Communications | Data model only | `CommunicationOutbox` exists and operations create records. | Build and run a background worker with delivery providers, retries, visibility, and acknowledgement. |
| Billing, CRM, bookings | Supporting modules | Pages, API routes, Stripe integration points, and demo data. | Keep out of the pilot critical path unless a customer explicitly needs them. |
| Monitoring and support | Not pilot-ready | Health route and CI quality workflow. | Add structured logs, alerting, metrics, backup/restore rehearsal, and support runbooks. |

**Important:** do not describe WIAControl as production-ready until the “what
remains” column for the core operations workflow has been completed and tested
with pilot users.

### Developer-branch verification status

The `imtiaz-dev-WIA-Control` implementation now contains the Stage 1 and Stage
2 code corrections, including the complete recovery-password screen,
authorization-before-schema validation, real retry scheduling, flush
concurrency protection, and expanded cross-tenant tests. Local linting,
TypeScript, unit tests, Prisma validation, and the production dependency audit
must pass before opening the pull request. The Playwright suite still requires
the private staging accounts described by `e2e/README.md`; its final pass must
be recorded in CI or by a reviewer with staging access before these stages are
called externally verified.

## 3. Repository map

| Location | Use it for | Do not put here |
| --- | --- | --- |
| `src/app/(dashboard)` | Internal pages and layouts. | Business rules or direct cross-tenant queries. |
| `src/app/api/control` | WIAControl HTTP endpoints. | Unvalidated database writes. |
| `src/components/control` | Employee, coordinator, worksite, shift, and settings UI. | Authorisation decisions. |
| `src/lib/wia-control/domain.ts` | Zod input schemas, rules, and pure domain logic. | React state or browser-only APIs. |
| `src/lib/wia-control/service.ts` | Transactions, tenant-scoped reads/writes, audit records. | UI formatting or demo-only logic. |
| `src/lib/auth` | Role definitions and server-side viewer resolution. | Client-supplied company selection. |
| `src/lib/assignment` | Deterministic recommendation scoring. | Opaque AI decisions. |
| `prisma/schema.prisma` | Persistent model and indexes. | Unplanned schema changes without a migration. |
| `prisma/migrations` | Versioned, deployable schema changes. | Manual edits to already-applied migrations. |
| `src/lib/mock-data.ts` and demo components | Local demonstration data only. | Production rules that differ from real mode. |

## 4. Local setup and safe modes

### Demo mode

Demo mode is for showing the product without a configured Supabase project or
database. It is enabled with `NEXT_PUBLIC_DEMO_MODE=true` and/or
`DEMO_MODE=true`. It must never be used as evidence that authentication,
permissions, or integrations work in a real environment.

### Real mode

Real mode requires `DEMO_MODE=false`, `NEXT_PUBLIC_DEMO_MODE=false`, a valid
`DATABASE_URL`, and the Supabase variables in `.env.example`. Stripe variables
are required only for billing work.

```bash
npm ci
npm run prisma:generate
npm run quality
npm run dev
```

Before a release candidate or pull request merge, run:

```bash
npm run preprod:verify
```

This runs linting, type checking, unit tests, Prisma validation, coverage,
production build, and a production dependency audit.

Never commit `.env.local`, credentials, real employee details, or real customer
data. `.env.example` documents the required variables without secrets.

## 5. Core API ownership map

The following routes are the core WIAControl contract. Check the relevant route
handler and its domain service before changing a payload or response.

| Route area | Main responsibility | Roles |
| --- | --- | --- |
| `/api/control/day` | Returns the operational day view. | Employee sees only their own shifts; coordinators see company scope. |
| `/api/control/worksites` | Lists and creates worksites. | Administrator / manager for changes. |
| `/api/control/worksites/[worksiteId]` | Updates or archives a worksite. | Administrator / manager. |
| `/api/control/shifts` | Lists and creates planned shifts. | Administrator / manager for changes. |
| `/api/control/shifts/[shiftId]` | Updates or cancels a shift. | Administrator / manager. |
| `/api/control/clock-events` | Records append-only attendance events. | Employee only for their own shift; authorised staff otherwise. |
| `/api/control/corrections` | Creates and lists correction requests. | Employee only for their own records; reviewer roles for review. |
| `/api/control/incidents` | Lists and resolves attendance incidents. | Coordinator / administrator. |
| `/api/control/coverage` | Lists coverage gaps and records the selected outcome. | Coordinator / administrator. |
| `/api/control/coverage/recommend` | Explains eligible replacement candidates. | Coordinator / administrator. |
| `/api/control/communications` | Reads queued operational communications. | Company-scoped recipient or operations role. |
| `/api/control/export/clocks` | Exports time-record evidence. | Administrator / authorised operations role. |
| `/api/control/settings` | Reads and updates company policy. | Administrator for changes. |

For every new route: call `requireApiRole`, resolve company scope from the
server-side profile, validate input with Zod, use a domain service, and return a
safe error response. Do not accept a company identifier from the browser as
authoritative.

## 6. Rules that must not be broken

1. **Clock records are evidence.** Never update or delete a `ClockEvent` to
   correct it. Create a `TimeCorrectionRequest` and preserve the original
   event.
2. **One company never sees another.** Every database query for business data
   must include company scope, unless an explicitly reviewed super-admin flow is
   required.
3. **Employees are limited to themselves.** An employee cannot create shifts,
   manage worksites, or clock for another employee.
4. **Retries are safe.** A duplicate clock request with the same idempotency key
   must return the original event, not create another one.
5. **Replacements remain human-approved.** Recommendation ranking is advisory;
   a coordinator makes the final decision and an override must be traceable.
6. **Location is point-in-time only.** Do not add continuous GPS tracking,
   biometric collection, or hidden monitoring.
7. **English is the product language.** New user-facing strings, code names,
   API errors, tests, documentation, exports, and routes must be English.

## 7. Required implementation sequence

Work in this order. Each stage has a deliverable that can be tested before
starting the next stage.

### Stage 1 — Make real mode usable

**Deliverable:** a staging company and three test users (administrator,
coordinator, employee) can safely sign in and work only within their company.

- Provision separate staging Supabase, PostgreSQL, and Stripe test mode.
- Apply migrations using `npm run db:migrate:deploy`.
- Seed or create the test company, worksite, employee, and one shift.
- Test sign-in, password reset, disabled user, no-company user, wrong role, and
  cross-company URL/ID manipulation.
- Document the staging URLs, environment variable owners, and test account
  provisioning process outside the repository; never store passwords here.

**Acceptance test:** an employee from Company A cannot read or mutate a shift,
clock event, correction, or worksite belonging to Company B.

### Stage 2 — Make clocking reliable on a phone

**Deliverable:** an employee can complete a shift with clear feedback even if
the connection is briefly lost.

- Define the exact local queue format, expiry window, encryption/storage
  decision, and retry policy before coding.
- Generate an idempotency key on the device before queueing an event.
- On reconnect, submit in event order and render `pending`, `accepted`, or
  `needs attention` states.
- Handle unavailable location, denied permission, poor accuracy, invalid shift,
  duplicate submission, and expired session in plain English.
- Add automated browser and API tests for clock-in, break start, break end,
  clock-out, duplicate retry, and a denied event.

**Acceptance test:** switching the device offline immediately after tapping
clock-in, then retrying after reconnect, results in exactly one clock event.

### Stage 3 — Make exceptions actionable

**Deliverable:** a coordinator has one inbox where every open incident has a
severity, owner, due time, and permitted next action.

- Define company policy values and incident severity rules.
- Make detection safe to run repeatedly; it must not create duplicate incidents
  or repeat notifications.
- Add acknowledge, assign, resolve, dismiss, and escalation actions with audit
  records.
- Add filters for date, worksite, employee, severity, owner, and status.
- Schedule detection through a worker or cron only after its idempotency tests
  pass.

**Acceptance test:** running detection twice for the same late arrival results
in one open incident, with a visible owner and resolution path.

### Stage 4 — Validate assisted coverage

**Deliverable:** a coordinator can fill a gap using a deterministic, explained
candidate ranking and safely record an override.

- Treat company, active status, availability, absence, overlapping shifts,
  required skills, work zone, and working-time limits as hard constraints.
- Store a score breakdown and exclusion reason for every candidate shown.
- Require a reason for lower-ranked choices when policy says it is necessary.
- Confirm the replacement, update coverage, resolve the related incident, write
  audit data, and queue communication in one transaction.
- Collect accepted and overridden decisions, but do not introduce machine
  learning during the pilot.

**Acceptance test:** an unavailable or overlapping employee never appears as a
selectable candidate; an override produces an auditable reason.

### Stage 5 — Deliver communications reliably

**Deliverable:** reassignment and operational messages are either delivered or
visibly failed; they are never silently lost or duplicated.

- Implement a dedicated worker for `CommunicationOutbox`.
- Start with in-app and email delivery, with an idempotency key per message.
- Add bounded retry with exponential backoff, final failure state, manual
  resend, and delivery audit information.
- Add acknowledgement for a reassigned shift.
- Do not add SMS or WhatsApp until consent, provider costs, templates, and
  failure policy have business approval.

**Acceptance test:** a deliberately failing provider call becomes a visible
failed outbox item after bounded retries, without duplicate messages.

### Stage 6 — Prove pilot readiness

**Deliverable:** one pilot company can operate a full week without engineering
support for routine clocking and coverage decisions.

- Add structured logs without sensitive personal or location details.
- Track clock success rate, API error rate, unresolved incident age, coverage
  time, recommendation acceptance, overrides, and outbox failures.
- Rehearse database backup, restore, migration, and forward-fix procedure.
- Write short support playbooks for login failure, failed clocking, correction,
  wrong assignment, export request, and communication failure.
- Run a controlled four-to-six-week pilot and review outcomes weekly.

**Acceptance test:** at least 95% of pilot clock submissions complete without
manual support and no critical tenant-isolation or integrity defect is open.

## 8. Pull request checklist

Every change must answer these questions in its pull request description:

1. What user outcome changes, and for which role?
2. Which route, component, domain service, and database entities are affected?
3. How is tenant isolation enforced?
4. What happens if the request is retried, interrupted, or malformed?
5. Is there an audit requirement?
6. What tests prove the success path and a meaningful failure path?
7. Is a Prisma migration required, and how is it deployed or recovered?
8. Does the change require a feature flag, environment variable, monitoring, or
   documentation update?

Required checks before merge:

```bash
npm run preprod:verify
```

Create focused branches from `main`. Do not merge directly to `main`, bypass a
failed GitHub Action, or mix unrelated changes in a pull request.

## 9. Definition of a successful handover

The developer has completed the handover when they can demonstrate, in staging,
the following without demo mode:

1. Administrator creates a worksite and an assigned shift.
2. Employee signs in and clocks in, starts/ends a break, and clocks out.
3. A late or missing event becomes one visible incident.
4. Coordinator acknowledges it, reviews explained replacement candidates, and
   makes a traceable coverage decision.
5. Employee receives and acknowledges the updated assignment.
6. Administrator reviews the immutable event and correction history and exports
   a company-scoped record.
7. A second company cannot access any of those records.

Only after this demonstration passes should the team invite the first pilot
customer.

## 10. Product scope and explicit non-scope

Build the core operational system first. The pilot must support the following
outcomes end to end:

- A company can create people, worksites, and planned shifts.
- An employee can see only their own assigned work and record attendance.
- A coordinator can find, own, and resolve attendance or coverage exceptions.
- A coordinator can select an eligible replacement and explain an override.
- An administrator can inspect the resulting history and export company-scoped
  records.

The following features are deliberately **not** required before the first
pilot: automatic staffing decisions, continuous location tracking, biometric
attendance, payroll calculation, native mobile applications, SMS/WhatsApp,
advanced CRM automation, or predictive machine learning. Do not let any of
them delay the core workflow.

If a pilot customer requests an out-of-scope feature, capture the request,
impact, and acceptance test in the product roadmap. Do not silently change the
operational rules to satisfy a one-off request.

## 11. Roles, permissions, and tenant boundary

The recognised application roles are defined in `src/lib/auth/roles.ts`:

| Role | Intended responsibility | Minimum permissions in the current code |
| --- | --- | --- |
| `SUPER_ADMIN` | Platform operator. Use only for explicitly reviewed platform-wide work. | Platform, company, and billing read/write. |
| `ADMIN` | Company owner or administrator. | Company read/write and billing write. |
| `MANAGER` | Operational coordinator. | Company read/write. |
| `EMPLOYEE` | Field worker. | Company read, restricted to their employee identity. |

The permission list is not enough on its own. Every server operation must also
enforce the following data boundary:

```text
Authenticated Supabase user
        -> User profile in PostgreSQL
        -> profile.companyId and profile.role
        -> server-side WiaActor
        -> company-scoped domain service query or transaction
```

Never use this unsafe pattern:

```ts
// Unsafe: the browser controls the tenant boundary.
prisma.plannedShift.findMany({ where: { companyId: body.companyId } });
```

Use the authenticated profile to resolve company scope instead. A supplied
`companyId` may be accepted only for a reviewed `SUPER_ADMIN` operation; it is
ignored or replaced for every other role. For `EMPLOYEE`, also include the
employee ID in reads and writes, and compare it with the shift employee ID.

Security regression tests must cover all of these attempts:

1. No session calling a protected route receives `401`.
2. A valid user with a disallowed role receives `403`.
3. A Company A user cannot read a Company B object by changing an ID in a URL,
   query parameter, JSON body, export filter, or nested relation.
4. An employee cannot clock a shift assigned to another employee.
5. An employee cannot create, edit, cancel, or assign shifts or worksites.
6. An archived/inactive person or worksite cannot be selected for new work.

## 12. Core data model

`prisma/schema.prisma` is the source of truth. The developer must update it,
create a migration, and add tests together when a persistent rule changes.

### Operational entities

| Entity | Purpose | Important integrity rule |
| --- | --- | --- |
| `Company` | Tenant and company-level policy. | Every operational record belongs to one company. |
| `User` | Authenticated profile and role. | A non-platform user must have a company. |
| `Employee` | Field-worker profile, skills, zones, availability, and field status. | An employee is selectable only within their company and valid status. |
| `Worksite` | Address, time zone, verification method, optional coordinates and radius. | Do not archive while it has open shifts. |
| `PlannedShift` | Planned work window, worksite, optional employee, skills, and status. | An employee cannot have overlapping active/planned shifts. |
| `ClockEvent` | Immutable attendance evidence. | Unique `(companyId, idempotencyKey)` and no in-place correction. |
| `TimeCorrectionRequest` | A proposed correction linked to an original event. | The original `ClockEvent` remains unchanged. |
| `AttendanceIncident` | A detected exception attached to a shift/worksite. | Repeated detection must not create duplicates. |
| `CoverageDecision` | Human staffing decision for an incident. | Chosen employee must be eligible and same-tenant. |
| `CommunicationOutbox` | Intent to send an operational message. | Delivery is idempotent and stateful. |
| `AuditLog` | Evidence of meaningful state changes. | Store actor, company, entity, action, time, and safe metadata. |

### Supporting entities

`Customer`, `Service`, `BookingRequest`, `Lead`, `Quote`, `Invoice`, `Payment`,
`AutomationRule`, and `Integration` support commercial workflows. Preserve
their tenant scope, but do not add work to them until the core operational
pilot succeeds.

### Required state machines

Do not invent new statuses in a component. Add a database migration, a Prisma
enum update when applicable, domain validation, display labels, tests, and
documentation together.

```text
Clock event sequence:
  no event -> CLOCK_IN -> BREAK_START -> BREAK_END -> CLOCK_OUT

Shift status:
  PLANNED or COVERED -> ACTIVE -> PAUSED -> ACTIVE -> COMPLETED
  PLANNED -> UNCOVERED when no employee is assigned
  any non-completed shift -> CANCELLED by an authorised coordinator

Incident status:
  OPEN -> ACKNOWLEDGED -> RESOLVED
  OPEN or ACKNOWLEDGED -> DISMISSED (requires a note)

Correction status:
  PENDING -> APPROVED or REJECTED
  PENDING/APPROVED -> DISPUTED when the employee does not acknowledge it

Communication status:
  PENDING -> PROCESSING -> SENT
  PENDING/PROCESSING -> RETRYING -> SENT or FAILED
```

The current domain service validates clock-event transition order and updates
the shift status. When extending the state machine, first write a failing unit
test in `src/lib/wia-control/domain.test.ts`, then implement the smallest safe
change.

## 13. API contract and input requirements

Route handlers live in `src/app/api/control`. They should remain thin:

1. Authenticate and authorise with `requireApiRole`.
2. Parse input through the schema in `src/lib/wia-control/domain.ts`.
3. Create a server-side actor through the existing API context helpers.
4. Call the transactional domain service.
5. Convert known domain errors to safe client responses through the common HTTP
   helper. Do not expose a stack trace, database query, or secret.

Use ISO 8601 timestamps with an explicit offset. For example:

```json
{
  "shiftId": "shift_123",
  "type": "CLOCK_IN",
  "method": "MOBILE",
  "occurredAt": "2026-08-17T08:00:00+02:00",
  "idempotencyKey": "device-8f4f1d0c-1",
  "deviceId": "hashed-device-reference",
  "latitude": 40.4168,
  "longitude": -3.7038,
  "accuracyMeters": 18,
  "isOffline": false
}
```

### Existing validation contracts

| Operation | Required input | Important validation |
| --- | --- | --- |
| Create worksite | name, address, city | Name 2–140 chars; radius 20–2,000m; valid latitude/longitude if provided. |
| Create shift | worksite, title, start, end | End later than start; no employee overlap; inactive/unavailable employee rejected. |
| Record clock event | shift, type, occurredAt, idempotency key | Valid event sequence; caller owns the shift if an employee; shift is open. |
| Request correction | clock event, proposed time, reason | Reason 10–1,000 chars; event must belong to caller company. |
| Review correction | status, optional note | Only `APPROVED`/`REJECTED`; use separate acknowledgement action. |
| Update incident | status, resolution note | Resolve/dismiss requires a 5–1,000 char note. |
| Confirm coverage | shift, incident, selected employee | Selected employee must pass eligibility checks; override reason is retained. |
| Update settings | time zone, retention, CRM toggle | Retention is 4–10 years; administrator only. |

Client code must treat `201`/success, validation failure, unauthorised,
forbidden, conflict/idempotent retry, and temporary network failure as distinct
states. Always render a useful English message and an available next action.

## 14. Detailed implementation of the operational workflows

### A. Company setup

1. An administrator registers or is invited through Supabase.
2. A `User` profile is created and associated with the company and `ADMIN`
   role.
3. The administrator configures company time zone, clock-retention period,
   optional CRM visibility, and default verification policy.
4. The administrator creates at least one active worksite.
5. The administrator adds or invites employees, records their skills/zones, and
   assigns roles.
6. The administrator creates a first shift and verifies it appears to the
   assigned employee.

The onboarding UI is complete only when it prevents starting production work
without a time zone, a worksite, an employee, and one successfully tested
clocking method.

### B. Shift planning and coverage

1. Coordinator selects worksite, time window, title, skills, grace period, and
   optionally an employee.
2. Server validates the worksite, employee status, tenant, time interval, and
   overlapping shifts inside one transaction.
3. If unassigned, the shift is `UNCOVERED` and one related open incident is
   created. Creating the same condition again must reuse rather than duplicate
   the incident.
4. When an employee is assigned, the shift becomes `PLANNED` or `COVERED` and
   relevant open coverage incidents are resolved in the same transaction.
5. A coordinator can cancel an unstarted shift. A shift with clock evidence
   must not be casually edited; use a documented administrative correction
   path.

### C. Attendance and location verification

1. Employee loads their own assigned shift from `/api/control/day`.
2. Device creates an idempotency key before attempting the event.
3. Device requests location only at the attendance action when the worksite
   verification policy needs it. It never starts background tracking.
4. Server validates event sequence, company, employee ownership, shift status,
   and idempotency key.
5. Server calculates point-in-time location verification from coordinates and
   worksite radius, or permits configured QR/PIN/NFC/KIOSK alternatives.
6. Server writes a new `ClockEvent`, computes the integrity-chain hash, updates
   shift state, creates any late-arrival incident, and writes audit data in one
   transaction.
7. UI shows recorded time, verification result, and the next permitted action.

Location denial is not a reason to silently collect more data. Show the
configured alternative verification method or a contact-coordinator path.

### D. Offline clocking design

Implement offline support as a small, explicit subsystem, not an ad-hoc retry.

- Store only the minimum attendance command in IndexedDB: payload, generated
  ID, creation time, retry count, and UI state. Do not store passwords or full
  employee records.
- Generate a UUID idempotency key once and persist it before the first send.
- Send commands in chronological order per employee/shift. A later event that
  depends on an unsent earlier event stays pending.
- Retry on network restoration and manual retry, with bounded exponential
  backoff. Never create a new idempotency key for the same user action.
- Treat server validation rejection as `needs attention`, not as retryable.
- Set an explicit expiry policy approved by the product owner; after expiry,
  preserve a visible correction-request path rather than fabricating an event.
- Test browser reload, application close/reopen, duplicate retry, wrong order,
  expired session, denied location, and server clock disagreement.

### E. Corrections and evidence review

1. Employee selects one of their own events and submits a proposed timestamp
   plus a clear reason.
2. System stores `TimeCorrectionRequest`; it does not modify `ClockEvent`.
3. Reviewer approves or rejects with a note when appropriate.
4. Employee can acknowledge the review or disagree with a mandatory reason.
5. Export and admin timeline display original evidence, proposal, reviewer,
   acknowledgement/disagreement, and timestamps.

Before connecting payroll, obtain an explicit product and legal decision about
how an approved correction affects payable time. WIAControl should preserve the
attendance evidence independently of any payroll export.

### F. Incidents and replacement decisions

An incident must always contain: company, shift, worksite, type, status,
detection time, human-readable title/detail, and its next accountable action.

For every recommendation, evaluate hard exclusions before scoring:

1. Same company and active employee.
2. Eligible field status and declared availability.
3. No absence or overlapping shift.
4. Required skills and policy constraints.
5. Work-zone/travel and working-time/rest limits.

Only eligible employees are scored. Return a deterministic breakdown such as
skills, availability, zone fit, workload, and transparent reliability signal.
The UI must show why a person was excluded as well as why a candidate ranked
well. The final coordinator action must write `CoverageDecision`, update the
shift/incidence state, audit the actor, and enqueue communication atomically.

## 15. Communications worker specification

`CommunicationOutbox` is a durable intent to notify somebody; it is not proof
that a message has been delivered. Implement a separate worker before claiming
that reassignment communications work.

The worker must:

1. Claim only due `PENDING`/retryable records using a transaction-safe locking
   strategy.
2. Move a claimed record to `PROCESSING` before contacting a provider.
3. Use a stable provider idempotency key based on the outbox record ID.
4. Render a versioned template with safe, minimal payload data.
5. On success, set `SENT`, `sentAt`, provider reference, and audit metadata.
6. On retryable failure, increase attempts, calculate `nextAttemptAt`, store a
   safe error summary, and return it to the retryable state.
7. After the configured maximum attempts, set `FAILED` and expose manual
   resend to an authorised coordinator.
8. Never log message content, raw location, passwords, access tokens, or full
   provider payloads.

Start with in-app plus email. Add SMS or WhatsApp only after consent language,
cost ceiling, template approval, opt-out behaviour, and failure ownership have
been agreed in writing.

## 16. Testing strategy and minimum test matrix

Use three layers of tests. A feature is not complete if it has only a visual
demo.

| Layer | Location/tool | What it proves |
| --- | --- | --- |
| Unit | Vitest in `src/lib/**/**.test.ts` | State transitions, schema validation, eligibility, hashing, and pure rules. |
| API/integration | Vitest with a test database or isolated service adapter | Roles, company scope, transactions, idempotency, persistence, and error mapping. |
| Browser end-to-end | Playwright or equivalent to be added | A real user can complete the critical flow on desktop and mobile viewport. |

Minimum test cases before pilot:

- Valid clock-in/break-start/break-end/clock-out sequence.
- Invalid first event and invalid duplicate sequence.
- Same idempotency key submitted twice creates one event.
- Employee A cannot clock Employee B's shift.
- Company A cannot retrieve or mutate Company B data by any route input.
- Overlapping shift assignment is rejected.
- Uncovered shift results in exactly one actionable incident.
- Repeated detection creates no duplicate incident or notification.
- Ineligible coverage candidate is never returned; a valid override is audited.
- Correction leaves the original clock event unchanged.
- Failed communication follows retry then final-failure behaviour.
- Export is limited to the authenticated company and contains the required
  evidence fields.
- Mobile viewport presents usable clock actions and accessible error feedback.

Run these commands on every pull request:

```bash
npm run lint
npm run typecheck
npm run test
npm run prisma:generate
npm run preprod:verify
```

`npm run preprod:verify` is the release gate. GitHub Actions runs it for pull
requests and pushes to `main`; do not weaken or bypass it.

## 17. Database, migrations, backups, and recovery

For every schema change:

1. Change `prisma/schema.prisma` and explain the user/operational reason.
2. Create a named migration with `npm run db:migrate` in a disposable local
   database. Do not use `db push` as a production deployment mechanism.
3. Review the generated SQL for locks, table rewrites, index creation, foreign
   keys, defaults, data backfill, and rollback/forward-fix implications.
4. Apply the migration to an empty database and a representative seeded copy.
5. Add the migration to the pull request and update tests plus this guide if
   behaviour changes.
6. Deploy with `npm run db:migrate:deploy` exactly once per environment.

The production procedure must include automated backups, a documented restore
owner, a restore rehearsal, and an agreed recovery objective. For an
append-only attendance system, prefer forward-fix migrations and application
corrections over destructive rollback of operational data.

## 18. Environments and deployment checklist

Maintain three isolated environments:

| Environment | Purpose | Data rule |
| --- | --- | --- |
| Local | Development and demo. | Synthetic/demo data only. |
| Staging | Integration, release rehearsal, and test accounts. | No production credentials or customer data. |
| Production | Pilot and live customers. | Real data, controlled access, monitored backups. |

Before enabling real users in an environment, configure and verify:

- `DATABASE_URL` for the correct PostgreSQL/Supabase project.
- `NEXT_PUBLIC_APP_URL` for the deployed HTTPS origin.
- `NEXT_PUBLIC_DEMO_MODE=false` and `DEMO_MODE=false`.
- Supabase URL, anonymous key, service role key, redirect URLs, and email
  templates.
- Stripe test/live keys and webhook secret only where billing is enabled.
- Separate secrets for every environment; rotate immediately if a secret is
  exposed.
- Health endpoint, structured logs, error alert, database backup, and an owner
  for each external integration.

Deployment order:

1. Confirm a green pull request and reviewed migration.
2. Back up the target database and confirm restore instructions.
3. Apply the migration.
4. Deploy the application.
5. Run the staging smoke flow: login, day view, clock event, incident,
   correction, coverage decision, and export.
6. Watch errors, latency, outbox failures, and failed attendance submissions.
7. Announce completion only after the smoke flow succeeds.

## 19. Observability and support runbooks

Add structured events, not unstructured console messages. Every event should
include a request/correlation ID, safe company identifier, action, result,
latency, and error code. Never log raw passwords, full access tokens, precise
location, message content, or unfiltered personal data.

Track at least:

- successful/failed clock attempts and reason codes;
- duplicate/idempotent clock retries;
- incident count, age, owner, and resolution time;
- coverage gap age, recommendation acceptance, and override reason;
- outbox attempts, delivery status, and final failures;
- API error rate, p95 latency, authentication failures, and database errors;
- migration version, backup success, and restore-rehearsal date.

Write a short runbook and nominate an owner for each event below:

| Situation | First response |
| --- | --- |
| Employee cannot clock | Check session, assigned shift, device time, verification method, and event history; do not create evidence manually without a correction trail. |
| Duplicate attendance report | Search by company/idempotency key; return existing event rather than adding one. |
| Wrong replacement | Record coordinator correction, preserve original decision, notify affected people, and review eligibility rule. |
| Message not delivered | Inspect outbox status/attempts, retry only through the worker/manual resend action, then contact provider support if needed. |
| Suspected cross-tenant access | Stop affected action, preserve logs, revoke access if needed, notify the security owner, and investigate before continuing. |
| Failed migration | Stop deployment, assess data state, restore only through the approved runbook, and use a reviewed forward fix where possible. |

## 20. Delivery plan, sequencing, and decision log

Use small pull requests. The following is the recommended order and definition
of completion for a single developer:

| Order | Work package | Finish only when |
| --- | --- | --- |
| 1 | Staging identity and tenant tests | Three roles work in staging; Company A/B isolation tests pass. |
| 2 | Mobile clocking and offline queue | Complete event sequence, replay safety, and mobile E2E tests pass. |
| 3 | Incident inbox and scheduled detection | One incident per condition, ownership, filters, and audit trail work. |
| 4 | Coverage decision hardening | Hard exclusions, explanations, override evidence, and transaction tests pass. |
| 5 | Outbox worker | Delivery/retry/failure/manual resend are observable and tested. |
| 6 | Monitoring, backups, and support | Alerts, restore rehearsal, and runbooks have named owners. |
| 7 | Controlled pilot | Pilot metrics meet the success criteria for four to six weeks. |
| 8 | Supporting commerce modules | Only after core operations is stable or explicitly contracted. |

The developer may make ordinary technical decisions that preserve this guide.
Stop and ask the product owner before changing any of these product decisions:

- retention period, permitted verification method, or location policy;
- automatic assignment, AI ranking inputs, or employee-performance penalties;
- biometric collection, continuous tracking, or new communication channel;
- payroll calculation or legal employment-policy behaviour;
- pricing, subscription entitlement, data deletion, or customer-facing terms.

## 21. Final commercial-launch gate

WIAControl is ready to sell only when a release owner can answer **yes** to all
of the following:

- Is real Supabase authentication enabled and tested for all roles?
- Does every protected route enforce company and employee scope server-side?
- Can a real employee complete attendance reliably, including safe retry?
- Are original clock events immutable and corrections fully traceable?
- Can a coordinator resolve an incident and document a coverage decision?
- Are eligibility, recommendation explanations, overrides, and communication
  outcomes auditable?
- Are monitoring, backups, restore rehearsal, migrations, support runbooks,
  privacy/retention policy, and named owners in place?
- Has a pilot met the agreed success rate without a critical integrity or tenant
  isolation defect?
- Do CI, production audit, and the full smoke flow pass for the release?

If any answer is “no”, WIAControl is still in pilot preparation. Keep the
remaining work visible and do not compensate with manual, undocumented data
changes.
