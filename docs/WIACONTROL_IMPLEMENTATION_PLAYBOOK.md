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
