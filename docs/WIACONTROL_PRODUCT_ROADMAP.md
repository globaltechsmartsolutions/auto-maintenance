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

3. Private evidence attachments: a short-lived signed upload link, server-side
   screening of the stored bytes before a file counts as evidence, a recorded
   SHA-256 checksum, tenant-prefixed keys, signed reads that are audited one by
   one, and a daily retention job that deletes the object as well as the row.
   The application refuses to issue an upload link for a public bucket.

**Remaining external/product decisions**

1. Put a real malware scanner in front of the evidence bucket. The shipped
   screening proves a file is the media type it claims to be and rejects
   executable, script, and archive headers; it is not antivirus.
2. Create cleaning templates first: opening check, common-area check, incident
   note, and completion confirmation.
3. Confirm the storage provider, retention schedule, access policy, and
   data-processing terms with the privacy owner before enabling attachments for
   a customer. The code is provider-agnostic behind one storage interface.
4. Add branded PDF only after pilots validate the evidence pack fields.

**Acceptance criteria**

- A completed service has an attributable, timestamped trail.
- Evidence is tenant-scoped and follows a documented retention policy.
- Corrections never overwrite original clock or completion records.

### Stage C — Risk and recovery cockpit

**Outcome:** A coordinator finds the next action in seconds.

**Delivered**

1. `Services at risk now` is separated from normal shifts and ordered by open
   incident severity and scheduled start.
2. Existing shift cards show the linked client service, customer, worksite,
   assignee, incident context, replacement flow, and audit route.
3. The no-candidate state, exclusion reasons, escalation, human confirmation,
   notification outbox, and override evidence remain explicit.
4. Recovery performance measures average acknowledgement and detection-to-
   coverage time over the last 30 days from persisted server timestamps.

**Remaining**

1. Add a service-level filter and a dedicated owner/next-action queue once a
   pilot validates the coordinator's daily triage workflow.

**Acceptance criteria**

- Every at-risk service has a visible owner and next action.
- A substitute is validated server-side for skills, availability, overlap, and
  daily limits.
- Recommendation and manual-override reasons remain visible and auditable.

### Stage D — Pilot onboarding and interoperability

**Outcome:** A pilot starts without forcing an immediate system replacement.

**Delivered**

1. A company-scoped `Pilot setup` workspace guides the first customer,
   worksite, field team, service, shift, and verified clock event.
2. CSV dry-run preview for employees, worksites, services, and shifts validates
   required fields, email addresses, date ranges, and duplicate file rows
   before any data is written.
3. Worksite, service, and shift imports require explicit confirmation, skip
   tenant-scoped duplicates instead of merging them, return per-row outcomes,
   and write the accepted rows in one transaction: the first unusable row rolls
   the whole file back and the rejection is audited outside that transaction.
4. Re-confirming an identical file is a recorded replay, not a second import.
5. Employee files are confirmed row by row through the existing Supabase
   invitation workflow, because an invitation is an external side effect that
   cannot be rolled back. A failed profile write revokes the login it just
   created and the row failure stays visible to the importer.
6. Downloadable per-kind import templates carry the exact headers the validator
   expects.

**Remaining**

1. Add timezone and skills checks to the guided setup completion criteria.
2. Documented exports for attendance, incidents, coverage decisions, and service
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

### Full execution sequence

This is the only active delivery order. Start a later package only when its
dependencies and exit criteria are met. Each package must include tenant-scope,
authorisation, audit, error handling, tests, and English product copy.

| Order | Work package | Scope | Dependency | Exit criteria |
| --- | --- | --- | --- | --- |
| 1 | Stabilise the current baseline | Review every existing stage, remove dead/demo-only paths from real mode, keep imports and real-mode paths separately tested, and keep the working tree clean. | None | `main` is reproducible; lint, type-check, tests, Prisma validation, and production build pass. |
| 2 | Pilot environment | Create separate staging database, Supabase project, storage bucket, test users, secrets, deployed migrations, and a protected end-to-end smoke flow. | 1 | A real non-demo company can create a worksite, employee, shift, and verified clock event in staging. |
| 3 | Import and onboarding completion | Add sample files, employee bulk invitations through the existing invitation path, and a visible recovery procedure for invitation failures. CSV confirmation, tenant-aware duplicates, row outcomes, and atomic worksite/service/shift creation are delivered. | 2 | A pilot admin can safely import worksites, services, and shifts; employee failures are visible and no partial import is silent. |
| 4 | Evidence storage | Implement private photo/file uploads, malware and size checks, signed downloads, tenant-scoped metadata, retention/deletion jobs, and access audit records. | 2; storage/DPA decision | No evidence is public, cross-tenant, or stored only as an unprotected URL. |
| 5 | Cleaning delivery templates | Define four versioned templates: opening, common areas, incident note, and completion. Support offline capture, versioned answers, evidence links, and export. | 4; product workflow approval | A field worker can complete a service consistently and the manager can prove the template version and submitted answers. |
| 6 | Recovery cockpit completion | Add service filter, clear owner, due time, next action, no-candidate escalation, acknowledgement, resolution path, and recovery-age alerts to the at-risk queue. | 2 and 5 | Every at-risk service has a visible accountable coordinator and next human action. |
| 7 | Communications delivery hardening | Configure the actual email/SMS provider, template versioning, consent/channel policy, retry/backoff, failed-message handling, recipient acknowledgement, and operational monitoring. | 2; provider decision | A reassignment or incident communication is either delivered, visibly failed, or retried; it is never silently lost or duplicated. |
| 8 | Reporting and interoperability | Finalise reproducible company-scoped CSV exports for attendance, incidents, coverage, and service evidence; document field definitions and build only one validated integration mapping if a pilot needs it. | 3 and 5 | A customer can reconcile exported evidence without manual database access. |
| 9 | AI governance setup | Select provider and processing location; complete DPA/subprocessor/privacy review; add per-company feature flag, rate limit, budget, kill switch, audit convention, and evaluation dataset. | 2; privacy owner approval | AI remains disabled for all customers until these controls and test cases are approved. |
| 10 | AI operations brief pilot | Enable the existing read-only brief for one internal workspace; measure cost, quality, false statements, coordinator usefulness, and refusal behaviour. | 6 and 9 | The team has a reviewed evaluation record and no unsafe or invented output is accepted as an operational action. |
| 11 | AI communication workflow | Extend the delivered read-only incident drafts with coordinator editing, explicit approval, controlled outbox delivery, approver/final-text audit, and cancellation. | 7, 9, and 10 | No AI-written message reaches a recipient without named human approval and a traceable final version. |
| 12 | AI insight backlog | Add risk explanation first; only after pilot data exists, evaluate coverage-risk prediction and attendance anomaly detection. Never use outputs for staff ranking, discipline, payroll, or autonomous assignment. | 10; sufficient, reviewed pilot data | Each use case has a measurable benefit, evaluation set, privacy review, and human-response path. |
| 13 | Production reliability and security | CI/CD gates, dependency/security review, privacy-safe logs, error monitoring, alerting, backup/restore rehearsal, migration rollback/forward-fix plan, performance and mobile accessibility checks, and support runbooks. | 2–12 as applicable | A restore is rehearsed successfully; alerts have owners; no critical authorisation, integrity, or tenant-isolation issue is open. |
| 14 | Spanish legal and commercial readiness | Complete worker notices, geolocation policy, retention schedule, processor agreement, subprocessor list, terms, support policy, pricing/contract decision, and qualified Spanish legal/privacy sign-off. | 4, 7, 9, and 13 | The product is not marketed as automatically compliant; approved legal materials and accountable owners exist. |
| 15 | Controlled commercial pilot | Run one to three worksites for 45–60 days alongside the customer’s current system. Review weekly: clock success, incident age, recovery time, evidence completeness, support volume, AI quality, and customer value. | 3–14 | At least 95% of valid clocks succeed without manual support, no critical defect is open, and the pilot demonstrates measurable recovery or coordinator-time improvement. |
| 16 | Launch decision and scale | Decide go/no-go from pilot metrics; fix exit blockers; publish onboarding/support ownership; then onboard the next cohort gradually. | 15 | A documented launch decision, support capacity, commercial offer, and post-launch monitoring are in place. |

### Delivery rules for the implementation partner

1. Work one package at a time and open a pull request or commit only when its
   automated checks pass.
2. Do not merge temporary code, placeholder credentials, public storage URLs,
   or a partial import path into a production release.
3. Every new server write must be tenant-scoped, authorised server-side,
   audited, idempotent where retries are possible, and covered by a focused
   test.
4. Use pilot evidence to decide integrations and AI expansion. Do not build
   predictions from synthetic assumptions or promise a feature before its
   operational owner exists.
5. Record a short release note after each package: user-visible change, data
   impact, migration, rollback path, tests run, and any manual configuration.

### AI delivery guardrails

The **AI Operations Brief** and **AI Incident Communication Draft** are delivered,
but disabled by default. Both return human-approved drafts only. The incident draft
is not connected to a sending action.

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
