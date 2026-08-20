# WIAControl Commercial Pilot Roadmap

**Audience:** Product owner and implementation partner
**Product:** WIAControl — operational coverage assurance for recurring field services
**Last reviewed:** 20 August 2026

## 1. Product decision

WIAControl will not compete as a generic time-clock, HR suite, ERP, or full
field-service-management system. It will begin with recurring, distributed
field services: cleaning, facility services, and later security.

> WIAControl verifies attendance, detects coverage risk, and helps a
> coordinator recover a client service before it becomes a customer problem.

The primary buyer is an operations manager. Coordinators and field employees
are the daily users. HR and finance are supporting stakeholders.

## 2. The workflow to complete

```text
Customer → Worksite → Service commitment → Planned shift → Verified attendance
         → Incident → Human coverage decision → Employee acknowledgement
         → Service evidence → Customer/operational report
```

Every roadmap item must strengthen this workflow. Do not add broad CRM,
invoicing, inventory, asset-management, or payroll features unless a validated
pilot requires an integration with one of them.

## 3. Current verified foundation

Delivered on `main`:

- Multi-tenant roles, server-side authorisation, account-status enforcement,
  and audit logging.
- Worksites with customer relationship, verification method, timezone, and
  geofence settings.
- Employees, skills, zones, availability, daily limits, shifts, and server-side
  overlap checks.
- Mobile clocking, point-in-time location verification, append-only events,
  idempotency, corrections, and offline retry queue.
- Incident detection, severity, ownership, deterministic replacement
  recommendations, human override, and communication outbox.
- Operational services can be created for a customer and linked to shifts. The
  server rejects a cross-customer service/worksite relationship.

This is not yet a production-ready product. Staging configuration, external
delivery configuration, pilot evidence, legal/privacy review, backups, and
support operation remain required.

## 4. Delivery roadmap

### Stage A — Commercial service coverage

**Outcome:** A coordinator connects each customer commitment to the people and
shifts that fulfil it.

**Delivered**

- Service register with customer, type, recurrence, schedule, and linked shifts.
- Shift planner service selector filtered to the selected worksite customer.
- Server-side company ownership and customer/worksite validation.

- Service evidence detail: linked shifts, clock events, incidents, coverage
  decisions, communications, and completion outcomes.
- Derived risk flag for uncovered shifts or open high/critical incidents; the
  commercial service status is never silently changed.
- Coordinators retain ownership, acknowledgement, escalation, and resolution
  notes through the linked incident inbox.
- Company-scoped CSV evidence export per service.

**Acceptance criteria**

- A coordinator can create a service, link a compatible shift, and see whether
  it is covered.
- A shift cannot link to another company, a cancelled service, or a service for
  another worksite customer.
- An employee sees only their own assignment, never the company service register.

### Stage B — Evidence of service delivery

**Outcome:** WIAControl explains what happened to a customer service, not only
whether a person clocked in.

**Delivered**

1. One immutable completion record per shift: outcome, optional checklist,
   note, timestamp, actor, audit event, and a database trigger preventing edits
   or deletion.
2. Read-only service timeline and CSV evidence pack covering shifts, clocks,
   incidents, coverage, and completion.

**Remaining external/product decisions**

1. Add controlled evidence attachments through private storage. Never use public
   URLs or put sensitive files directly in the database.
2. Create cleaning templates first: opening check, common-area check, incident
   note, and completion confirmation.
3. Add private-storage evidence attachments only after selecting the storage
   provider, retention schedule, access policy, and data-processing terms.
4. Add branded PDF only after pilots validate the evidence pack fields.

**Acceptance criteria**

- A completed service has an attributable, timestamped trail.
- Evidence is tenant-scoped and follows a documented retention policy.
- Corrections never overwrite original clock or completion records.

### Stage C — Risk and recovery cockpit

**Outcome:** A coordinator finds the next action in seconds.

1. Add a `Services at risk now` view ordered by severity and scheduled start.
2. Group open incidents by service and expose owner, due time, and next action.
3. Open the existing recommendation flow from the service context, confirm a
   substitute, and queue a notification.
4. Measure acknowledgement and detection-to-coverage time.
5. Add explicit no-candidate and escalation states. Do not automatically assign
   a worker during the pilot.

**Acceptance criteria**

- Every at-risk service has a visible owner and next action.
- A substitute is validated server-side for skills, availability, overlap, and
  daily limits.
- Recommendation and manual-override reasons remain visible and auditable.

### Stage D — Pilot onboarding and interoperability

**Outcome:** A pilot starts without forcing an immediate system replacement.

1. Guided setup: timezone, customers, worksites, employees, skills, first
   service, first shift, and first clock event.
2. CSV import with preview, validation, duplicate handling, and reversible dry
   run for employees, worksites, services, and shifts.
3. Documented exports for attendance, incidents, coverage decisions, and service
   evidence. Confirm payroll columns with each pilot.
4. A pilot workspace with setup progress and support contact.
5. Promise a third-party integration only when authentication, mapping, failure
   handling, and a support owner have been implemented.

**Acceptance criteria**

- One to three worksites can run WIAControl beside the customer’s existing tool.
- Import errors identify a row, field, and safe corrective action.
- Exports are company-scoped, documented, and reproducible.

### Stage E — Production readiness

**Outcome:** The product can safely serve a paying pilot.

1. Configure separate staging Supabase, PostgreSQL, storage, Stripe test mode,
   and environment variables.
2. CI runs install, lint, type-check, unit tests, Prisma validation, production
   build, dependency audit, and protected staging end-to-end tests.
3. Add privacy-safe logs, error monitoring, and alerts for failed clocks, crons,
   outbox processing, and migrations.
4. Rehearse database restore and rollback. Write support runbooks for failed
   clocking, incorrect assignment, data export, access loss, and incident triage.
5. Obtain qualified legal/privacy review of worker information, geolocation,
   retention, terms, and data-processing agreement.

**Pilot exit criteria**

- At least 95% of valid clock submissions finish without manual support.
- No unresolved critical tenant-isolation, data-integrity, or authorisation
  defect exists.
- Coordinators resolve common no-show and late-arrival flows without engineering.
- The pilot measures a meaningful improvement in detection or recovery time.

### Next execution sequence

The following is the only active delivery order. Do not start a later package
before its dependency and completion criteria are met.

| Order | Work package | Owner | Dependency | Done when |
| --- | --- | --- | --- | --- |
| 1 | Pilot environment | Engineering + product owner | None | Separate staging database, Supabase project, real test users, deployed migrations, and a successful end-to-end smoke flow. |
| 2 | Private evidence storage | Engineering + privacy owner | Storage provider and DPA decision | Private uploads, signed download URLs, tenant scope, metadata-only database records, retention job, malware/size limits, and tests. |
| 3 | Cleaning completion templates | Product owner + operations | Pilot workflow agreement | Four versioned templates: opening, common areas, incident note, and completion; workers can complete them offline and managers can export them. |
| 4 | Recovery cockpit | Engineering | Packages 1 and 3 | One ordered `Services at risk now` queue with owner, due time, incident, recommendation, no-candidate state, acknowledgement, and resolution note. |
| 5 | Pilot onboarding | Engineering + customer success | Package 1 | Guided setup plus CSV dry-run imports for employees, worksites, services, and shifts; row-level errors and a reversible confirmation step. |
| 6 | AI brief pilot | Product owner + privacy owner + engineering | Packages 1 and 4; approved provider/DPA | Enable the existing read-only brief for one internal workspace, record cost/quality feedback, and review every draft before use. |
| 7 | AI communication drafts | Engineering | Package 6 passes | A coordinator can edit, approve, and send a generated draft through the existing outbox; prompt, source record IDs, approver, and final text are audited. |
| 8 | Production and legal launch | Release owner | Packages 1–7 as applicable | Monitoring, alerting, backup restore rehearsal, support runbooks, Spanish worker notices, processor agreement, subprocessor list, and legal/privacy sign-off. |
| 9 | Controlled commercial pilot | Product owner + customer success | Package 8 | One to three worksites run for 45–60 days beside the existing tool and meet the pilot exit criteria. |

### AI delivery guardrails

The existing **AI Operations Brief** is the first and only enabled AI use case.
It must stay disabled by default and return a human-approved draft only.

**Allowed next:** summarisation, risk explanation, customer/employee message
drafts, and read-only answers from explicitly scoped operational facts.

**Not allowed:** autonomous staff assignment, performance scoring, disciplinary
recommendations, payroll calculation, continuous tracking, biometric analysis,
or sending a message without an accountable human approval.

Before enabling any AI feature for a customer, complete all of the following:

1. Confirm the provider, processing location, DPA, subprocessor terms, and
   retention policy with the privacy owner.
2. Set a per-company feature flag, monthly budget, request rate limit, and a
   kill switch.
3. Send only minimised facts. Never send coordinates, raw attendance history
   beyond the requested period, credentials, or unnecessary employee data.
4. Store an audit record with feature, model, source-record counts, actor,
   outcome, and human approver. Do not log prompts containing personal data.
5. Test an evaluation set of normal, no-show, late-arrival, no-candidate, and
   cross-tenant scenarios. A wrong, invented, or unsafe recommendation blocks
   release until corrected.

## 5. Commercial rollout

### Pilot offer

- Target: cleaning/facility services first; select only one sector for the first
  pilots.
- Customer size: 20–250 field workers across several client worksites.
- Scope: one to three worksites for 45–60 days alongside the existing product.
- Success measures: at-risk services detected, median recovery time, recovered
  coverage, and coordinator time saved.

### Positioning

Do not sell GPS clocking or AI scheduling. Sell the measurable outcome:

> Prove attendance, detect an uncovered service early, and record how your team
> recovered it.

### Spain legal launch gate

WIAControl supports a traceable daily record but does not itself make an
employer legally compliant. Before a live Spanish pilot, complete these
non-code gates: worker and representative information notices; a data
processing agreement and subprocessor list; configured retention of at least
four years; a privacy/security review; and a documented incident/breach
process. Use point-in-time worksite verification only where proportionate; do
not introduce continuous tracking or biometric collection.

### Pricing hypothesis to validate after pilots

| Offer | Indicative price | Purpose |
| --- | --- | --- |
| Controlled pilot | €0–€99/month | Remove migration risk and measure value. |
| Coverage | €3.50–€4.50 per active field worker/month | Attendance, incidents, audit trail. |
| Operations | €5–€6 per active field worker/month | Coverage workflow, reports, automation. |
| Enterprise | Quote | Integration, onboarding, SLA, custom security. |

## 6. Definition of done

A feature is complete only with:

1. A documented user outcome and authorised roles.
2. Server-side validation and tenant scoping.
3. English loading, empty, error, and success states.
4. Tests for the core rule and a meaningful failure path.
5. Audit data when it changes attendance, coverage, or service evidence.
6. Logs or metrics sufficient to diagnose a production failure.
7. An implementation-playbook update when the workflow changes.

## 7. Explicit non-goals until pilot evidence exists

- Continuous employee tracking or biometric clocking.
- Fully automatic reassignment.
- Full billing, accounting, inventory, route optimisation, or asset management.
- Machine-learning staffing decisions without a separate safety, privacy, and
  fairness review.
