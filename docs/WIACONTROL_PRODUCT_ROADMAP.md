# WIAControl Product Roadmap

**Audience:** Product owner and implementation partner
**Status:** Proposed implementation roadmap
**Product:** WIAControl — intelligent time tracking and operational coverage for service businesses

## 1. Product direction

WIAControl is a multi-tenant operational platform for field-service companies.
It helps a company plan work, record time reliably, identify exceptions, and
resolve staffing gaps with an explainable recommendation. The product is not a
surveillance tool: location is checked only at a clock event when enabled by a
company policy; it does not continuously track employees.

The product should become the daily operational system of record for three
people:

- **Employee:** sees today’s work, clocks in and out, requests corrections, and
  understands the status of their own records.
- **Coordinator:** plans shifts, reacts to absence or timing incidents, and
  confirms a replacement with an auditable reason.
- **Administrator:** manages company settings, employees, worksites, retention,
  exports, subscriptions, and optional commercial modules.

## 2. What already exists

The repository already contains a strong MVP foundation:

- Next.js 15 and TypeScript application with responsive dashboard and employee
  experiences.
- PostgreSQL/Prisma schema for companies, roles, worksites, planned shifts,
  append-only clock events, incidents, corrections, coverage decisions, audit
  records, communication outbox, customers, billing, and subscriptions.
- Supabase-based authentication, role checks, and protected routes.
- Domain validation for clock-event sequence, shift overlap, coverage, and
  permissions.
- Real API routes plus a local demo adapter for product demonstrations.
- Stripe Checkout, Billing Portal, webhooks, health checks, migrations, seeds,
  unit tests, and lint/type-check scripts.

The next phase is not to redesign the foundation. It is to make the operational
workflow production-ready, measurable, and easy to adopt.

## 3. Product principles and guardrails

1. **Evidence first.** A clock event is appended; it is never silently edited.
   Corrections are separate requests linked to the original event.
2. **Every alert leads to a decision.** Incidents must be acknowledged,
   resolved, dismissed, or escalated. The outcome is recorded.
3. **Recommendations are explainable.** WIAControl can rank candidates, but a
   coordinator can override it and must provide a reason where appropriate.
4. **Privacy by design.** Do not introduce biometric data or continuous GPS
   tracking without a separate product, legal, and security decision.
5. **Tenant isolation is non-negotiable.** Every real read and mutation is
   scoped to the active company and authorised role.
6. **Demo and production share business rules.** The demo may use local data,
   but it must not invent a different workflow.
7. **English-first user experience.** The app will be completed in English;
   strings should then move to a central translation layer before a second
   language is introduced.

## 4. Delivery sequence

### Phase 0 — Product baseline and release discipline

**Goal:** establish a reliable starting point before adding integrations or
advanced intelligence.

**Work items**

- Freeze a short list of pilot-company workflows: normal shift, late arrival,
  missing clock-in, absence, replacement, correction, and export.
- Define a staging environment with separate Supabase, PostgreSQL, Stripe test
  mode, and environment variables.
- Add CI checks for install, lint, typecheck, tests, Prisma validation, build,
  and dependency audit.
- Document release, rollback, migration, seed, and support procedures.
- Capture baseline product metrics: activation, successful clock events,
  unresolved incidents, and time-to-coverage.

**Acceptance criteria**

- A new developer can start the application from documentation.
- A pull request cannot be merged with failing quality checks.
- Staging uses no production secrets or customer data.

### Phase 1 — Complete the English product surface

**Goal:** deliver one coherent English product rather than a partly translated
demo.

**Work items**

- Inventory all customer-visible strings in pages, components, status labels,
  notifications, validation messages, empty states, exports, and demo data.
- Extract UI copy into a typed `en` translation catalogue. Avoid translating
  status values used in business logic; map those values to display labels.
- Replace remaining Spanish display text, including employee clocking,
  coordinator coverage, CRM, customer portal, modal dialogs, and CSV headers.
- Set document language and all date/number/currency formatting to the intended
  English locale (`en-GB` is appropriate while retaining EUR).
- Add a smoke test that rejects Spanish user-facing strings on core routes.

**Acceptance criteria**

- All supported routes render English content, controls, errors, and empty
  states.
- Domain constants and database enum values remain stable.
- A future `es` locale can be added without duplicating page components.

### Phase 2 — Production time-tracking hardening

**Goal:** make clocking trustworthy under real mobile conditions.

**Work items**

- Validate server time, client-declared time, time zone, device metadata, and
  idempotency key for each submitted event.
- Define practical offline behaviour: queue an event locally, display its
  pending state, retry safely, and never create a duplicate on reconnect.
- Add user-facing feedback for permission denial, unavailable location, weak
  network, expired shift, and repeated submission.
- Review append-only database triggers, hash-chain verification, and export
  integrity with representative data.
- Add audit views for an administrator: event timeline, correction timeline,
  actor, method, verification result, and export generation.

**Acceptance criteria**

- Repeated requests with the same idempotency key produce one event.
- Employees cannot clock for a different employee or company.
- A correction never changes the original event.
- A coordinator can understand why an event is flagged without database access.

### Phase 3 — Intelligent incident detection

**Goal:** turn raw events into useful operational attention, not notification
noise.

**Work items**

- Define incident policies per company: grace period, late threshold, missing
  clock-in threshold, incomplete shift threshold, and location policy.
- Make incident detection idempotent and safe to run from an API route, cron,
  or queue worker.
- Introduce severity, owner, due time, and resolution categories.
- Build an incident inbox for coordinators with filters by worksite, date,
  severity, status, and employee.
- Add digest notifications; do not notify repeatedly for the same unresolved
  situation.

**Acceptance criteria**

- Detection can run more than once without duplicate incidents.
- Every open incident has a clear owner and next action.
- False-positive rate and resolution time are measurable.

### Phase 4 — Explainable coverage recommendation

**Goal:** recommend the best available replacement while keeping the human in
control.

**Candidate scoring v1**

Use deterministic, inspectable rules before any machine-learning work:

| Signal | Example use |
| --- | --- |
| Availability | Candidate is free for the full shift window. |
| Overlap risk | Reject conflicting shifts and mandatory rest conflicts. |
| Worksite fit | Prefer a matching zone or reasonable travel distance. |
| Skills | Prefer required or relevant skills for the service. |
| Workload | Avoid candidates already near daily job/hour limits. |
| Reliability | Use only transparent, reviewed signals; never opaque penalties. |

**Work items**

- Store the score breakdown and rejection reasons with each recommendation.
- Present the top candidates and the reason each is suitable or excluded.
- Require an override reason when the coordinator selects a lower-ranked
  candidate.
- Confirm the selected replacement, resolve the incident, queue communication,
  and write audit data in one transaction.
- Create a feedback dataset from accepted and overridden recommendations.

**Acceptance criteria**

- No candidate is recommended if they overlap, lack required availability, or
  belong to another company.
- A coordinator can override any recommendation.
- The system records the final choice and the reason without exposing sensitive
  employee data unnecessarily.

### Phase 5 — Communications and employee adoption

**Goal:** make operational decisions reach the correct person reliably.

**Work items**

- Implement the existing communication outbox with a worker and retry policy.
- Start with in-app and email; add SMS or WhatsApp only after consent, provider
  selection, cost controls, and delivery-failure handling are defined.
- Build employee acknowledgement for a reassigned shift.
- Add notification preferences and company-level message templates.
- Surface delivery status and a manual resend action to coordinators.

**Acceptance criteria**

- A coverage decision is not reported as communicated until the outbox confirms
  delivery or a visible failure state.
- Retries are bounded and observable.
- Employees can see the assignment that affects them.

### Phase 6 — Pilot, observability, and support

**Goal:** validate WIAControl with a real operating team before broad release.

**Pilot scope**

- One to three service companies, a limited number of worksites, and defined
  administrator/coordinator champions.
- Use production-like but controlled schedules for four to six weeks.
- Hold weekly reviews of incidents, corrections, recommendation overrides, and
  employee feedback.

**Work items**

- Add structured application logs with company-safe identifiers.
- Track API latency, error rate, queue failures, failed clock submissions,
  recommendation acceptance, and incident resolution time.
- Create a support playbook for failed clocking, mistaken assignment, account
  access, export request, and data correction.
- Run backup/restore and migration rehearsal before pilot expansion.

**Exit criteria**

- At least 95% of submitted clock events complete successfully without manual
  support.
- No unresolved critical tenant-isolation or data-integrity issue exists.
- Pilot coordinators can resolve the common incident types without engineering
  intervention.

### Phase 7 — Commercial readiness

**Goal:** safely sell and onboard WIAControl.

**Work items**

- Define plans, feature limits, trials, cancellation, failed-payment behaviour,
  and upgrade/downgrade handling.
- Complete onboarding: company, time zone, worksites, employees, policies,
  first shift, and first successful clock event.
- Add role-appropriate help content and in-product onboarding checklists.
- Separate optional CRM features from core operational entitlement.
- Prepare a data-processing, privacy, retention, and access-control review with
  qualified legal/privacy professionals for target markets.

**Acceptance criteria**

- A company can self-onboard to its first working shift.
- Subscription changes cannot expose data across tenants or leave ambiguous
  access states.

### Phase 8 — Intelligence v2 (only after pilot evidence)

**Goal:** improve recommendations using evidence while preserving explainability.

**Possible work items**

- Calibrate deterministic weights from accepted/overridden recommendations.
- Forecast likely coverage risks from schedule density and declared absence.
- Suggest staffing changes before a shift becomes uncovered.
- Evaluate models offline against historical decisions before any production use.
- Keep rule-based fallback, score explanation, human override, and monitoring
  for bias or degradation.

**Do not start this phase until** Phase 6 has reliable data and clear evidence
that deterministic recommendations are insufficient.

## 5. Suggested ownership

| Area | Primary owner | Review partner |
| --- | --- | --- |
| Product workflow and pilot feedback | Product owner | Coordinator champions |
| Domain/API/database integrity | Backend developer | Security reviewer |
| Employee and coordinator UX | Frontend developer | Pilot users |
| Authentication and tenant isolation | Backend developer | Security reviewer |
| CI, staging, monitoring, releases | Developer/DevOps | Product owner |
| Privacy, employment, and retention policy | Product owner | Qualified legal/privacy adviser |

## 6. Definition of done for every feature

A feature is complete only when it has:

1. A documented user outcome and role permissions.
2. Server-side validation and tenant scoping.
3. Loading, empty, error, and success states in English.
4. Tests covering core rules and a realistic failure path.
5. Audit data where the action changes time, coverage, or an employee record.
6. Monitoring or logs sufficient to diagnose a production failure.
7. Updated developer and operational documentation.

## 7. Immediate next sprint

1. Complete the English catalogue and remove remaining mixed-language UI.
2. Write end-to-end tests for employee clock-in, correction request, incident,
   recommendation, override, and coverage confirmation.
3. Define offline clock-event behaviour and implement idempotent retry.
4. Add incident severity, ownership, and coordinator inbox filters.
5. Prepare staging and run the first controlled pilot workflow with test users.

This order builds confidence in the core time-tracking experience before adding
new sales features or more complex AI.
