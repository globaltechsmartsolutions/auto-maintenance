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
3. Four versioned cleaning templates — opening check, common areas, incident
   note, completion confirmation — captured on site, validated against the exact
   version answered, stored append-only, idempotent by the identifier the device
   generated so an offline resend cannot duplicate a visit, linkable to private
   evidence files, and included in the service evidence export.
4. Private evidence attachments: a short-lived signed upload link, server-side
   screening of the stored bytes before a file counts as evidence, a recorded
   SHA-256 checksum, tenant-prefixed keys, signed reads that are audited one by
   one, and a daily retention job that deletes the object as well as the row.
   The application refuses to issue an upload link for a public bucket.

**Remaining external/product decisions**

1. Put a real malware scanner in front of the evidence bucket. The shipped
   screening proves a file is the media type it claims to be and rejects
   executable, script, and archive headers; it is not antivirus.
2. Confirm the storage provider, retention schedule, access policy, and
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
5. A dedicated recovery queue orders every at-risk service by what will hurt
   first, filters by client service and by owner (including "no owner yet"),
   and states one next human action per row: assign an owner, acknowledge,
   confirm coverage, chase the replacement's acknowledgement, escalate, or
   record the resolution.
6. Recovery-age alerting flags an incident that is overdue, that has sat with
   no accountable coordinator, or that was acknowledged and then left without a
   coverage decision. An overdue promise outranks a more severe one that is
   still inside its window.

**Remaining**

Nothing in code. Confirm the alert thresholds per severity with the first pilot
and adjust the two tables in `src/lib/wia-control/recovery-queue.ts`.

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
7. Reproducible, company-scoped, audited exports for attendance, incidents,
   coverage decisions, and service evidence, with every column documented in
   `docs/WIACONTROL_EXPORT_FIELDS.md` and served at
   `/api/control/export/dictionary`.

**Remaining**

1. Add timezone and skills checks to the guided setup completion criteria.
2. Confirm the payroll columns each pilot needs against the documented fields.
3. A pilot workspace with setup progress and support contact.
4. Promise a third-party integration only when authentication, mapping, failure
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
| 7 | Communications delivery hardening | **Delivered in code:** versioned templates that refuse to render an unknown version rather than sending a placeholder, per-recipient channel consent, a unique dedupe key per event, bounded retry/backoff with lease recovery, visible failure, recipient acknowledgement, and outbox health reported to both the app and the scheduler. **Owner task:** choose and configure the real email/SMS provider and its cost owner. | 2; provider decision | A reassignment or incident communication is either delivered, visibly failed, or retried; it is never silently lost or duplicated. |
| 8 | Reporting and interoperability | **Delivered:** reproducible company-scoped CSV exports for attendance, incidents, coverage decisions, and service evidence, every column declared and documented in `docs/WIACONTROL_EXPORT_FIELDS.md` and served at `/api/control/export/dictionary`, every export audited. **Owner task:** build an integration mapping only if a pilot needs one. | 3 and 5 | A customer can reconcile exported evidence without manual database access. |
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

### Staging acceptance scenario — fictional company

Run this scenario in staging only. Do not use a real employee, customer,
telephone number, address, or production company. Record the application URL,
tester, date, browser/device, expected result, actual result, screenshots, and
the request/audit identifier for every failure.

**Company:** Northstar Facility Services (fictional)
**Customer:** Redwood Offices Ltd. (fictional)
**Worksites:** Redwood Central and Redwood Riverside
**Services:** Morning office cleaning and evening common-area cleaning
**Roles:** one administrator, one operations manager, and four field workers.

Create these fictional field workers before testing:

| Worker | Skills | Availability | Purpose in the test |
| --- | --- | --- | --- |
| Maya Torres | `cleaning`, `opening` | Every day, 06:00–14:00 | Normal morning assignment and verified clocking. |
| Liam Carter | `cleaning`, `evening` | Every day, 14:00–22:00 | Valid replacement for an evening issue. |
| Nora Blake | `cleaning` | Vacation / unavailable | Must never be offered as a replacement. |
| Ethan Reed | `cleaning`, `opening` | Every day, 06:00–14:00 | Give an overlapping shift so he must be excluded. |

Create a morning and an evening shift for the same test day. Link both to the
customer service and compatible worksite. Assign Maya to the morning shift;
leave the evening shift uncovered initially. Give Ethan a conflicting morning
shift at another worksite.

| Test | Tester action | Expected result | Evidence to retain |
| --- | --- | --- | --- |
| 1. Setup and permissions | Sign in as administrator, manager, and each worker. Attempt to open another worker’s records as a worker. | Each role sees only permitted screens and records; a worker cannot access company administration or another worker’s evidence. | Screenshots and denied-route response. |
| 2. Normal verified clock | Maya clocks in, starts/ends a break, and clocks out using the configured worksite method. | Events are ordered, attributed, and visible in her shift and service evidence timeline. | Clock IDs, shift timeline, audit entry. |
| 3. Offline and retry safety | Submit one permitted clock while offline, restore connectivity, then retry the same idempotency key. | The event is recorded once only; retry is safe and the final shift state is correct. | Event count and idempotency key. |
| 4. Late or no-show detection | Create a late/missing-clock condition in staging and run the approved incident-detection job. | One actionable incident is created with severity, due time, worksite, shift, and no duplicate on a second run. | Incident IDs and detector output. |
| 5. Uncovered-service recovery | Open the uncovered evening shift and request replacement candidates. | Liam is eligible; Nora is excluded for availability and Ethan for overlap. The reason for each exclusion is visible. | Candidate list and score/exclusion reasons. |
| 6. Human override controls | Choose the recommended worker, then try a lower-ranked choice without a reason. | The valid decision is audited; an override requiring a reason cannot be silently saved. | Coverage decision and audit record. |
| 7. Incident workflow | Acknowledge, assign, escalate, resolve, and dismiss separate staging incidents with notes. | State transitions, owner, notes, and timestamps remain visible and invalid transitions are rejected. | Incident history and error response. |
| 8. Service completion and evidence | Record a completed, partial, and failed service outcome; attempt to edit/delete a completion record; export service evidence. | Each completion is immutable, partial/failed delivery needs an explanation, and the export contains only this company’s evidence. | Export file and rejected edit/delete attempt. |
| 9. CSV onboarding | Preview and confirm a file with valid worksites/services/shifts, an existing duplicate, and a deliberately invalid file. | Valid non-duplicates are created atomically; existing rows are explicitly skipped; an invalid file writes nothing and identifies row/field. Employee CSV remains routed to invitations. | Preview, confirmation results, and database/audit count. |
| 10. Communications | Trigger a staging reassignment/incident communication, observe queued, sent, retry, and failed paths using the provider test mode. | A message is never silently lost or duplicated; failed delivery is visible and can be handled by an authorised coordinator. | Outbox status, provider reference, and retry history. |
| 11. Exports and isolation | Export clocks, incidents, coverage, and service evidence; then repeat while authenticated to a second staging company. | Every export is scoped to the active company and cross-company IDs are rejected. | Files and 403/404 response evidence. |
| 12. AI safety | With AI disabled, request a brief/draft. In the approved test workspace, generate an operations brief and an incident draft. | Disabled mode exposes no provider call; enabled output is clearly a human-review draft, does not send a message, and does not contain names, addresses, GPS, or incident free text. | Audit record, reviewed output, and provider-cost record. |
| 13. Failure and recovery | Use invalid input, expired/invalid session, lost connection, and provider failure simulations. | The user receives an English actionable error; no evidence, coverage decision, or import is partially or silently corrupted. | Screenshots, server logs, and request IDs. |

**Test exit rule:** do not proceed to a customer pilot while a tenant-isolation,
attendance-integrity, duplicate-clock, incomplete-import, or unauthorised-send
defect is open. File defects with the exact test number, reproduction steps,
expected/actual result, relevant IDs, and screenshot.

### Minimum detailed test matrix — 50 cases

The 13 scenarios above are the test sessions. Execute the following individual
cases inside them; mark every case `PASS`, `FAIL`, or `BLOCKED`.

| Area | Cases to execute | Minimum count |
| --- | --- | ---: |
| Authentication and tenant isolation | 1. Administrator sign-in. 2. Manager sign-in. 3. Worker sign-in. 4. Suspended account denied. 5. Worker denied another worker's shift. 6. Worker denied admin route. 7. Cross-company record URL denied. | 7 |
| Setup and master data | 8. Create customer. 9. Create linked worksite. 10. Create unlinked worksite. 11. Reject invalid timezone/verification input. 12. Create service. 13. Reject archived customer service. 14. Reject service/worksite customer mismatch. | 7 |
| Shift planning and coverage | 15. Create assigned shift. 16. Create uncovered shift. 17. Reject invalid end-before-start range. 18. Reject employee overlap. 19. Reject unavailable employee. 20. Link compatible service. 21. Reject cancelled service. | 7 |
| Clocking and corrections | 22. Clock in. 23. Reject duplicate/invalid transition. 24. Start break. 25. End break. 26. Clock out. 27. Offline submission retry is idempotent. 28. Location/QR verification failure is visible. 29. Create correction. 30. Approve correction. 31. Reject correction without required reason. 32. Original clock remains immutable. | 11 |
| Incidents and recovery | 33. Detect late clock once. 34. Repeat detector with no duplicate incident. 35. Acknowledge incident. 36. Assign owner. 37. Escalate with note. 38. Resolve with note. 39. Dismiss with note. 40. Candidate eligibility/exclusion explanation. 41. Valid coverage decision. 42. Override reason enforcement. | 10 |
| Service evidence and exports | 43. Completed outcome. 44. Partial outcome requires note. 45. Completion cannot be edited/deleted. 46. Service CSV evidence export. 47. Attendance export scope. 48. Cross-company export rejection. | 6 |
| Onboarding and imports | 49. Valid worksite CSV preview. 50. Invalid field/row preview. 51. Existing duplicate explicitly skipped. 52. Atomic confirmation creates all accepted rows. 53. Invalid confirmation writes nothing. 54. Employee CSV routes to invitation workflow. | 6 |
| Communications | 55. Queue a staging message. 56. Sent state with provider reference. 57. Retryable failure. 58. Final failed state and authorised resend. 59. Recipient acknowledgement. | 5 |
| AI controls | 60. AI disabled response. 61. Operations brief generation. 62. Incident internal draft. 63. Customer draft. 64. No automatic send. 65. Audit record. 66. Output contains no prohibited personal/location data. | 7 |
| Failure, usability, and release | 67. Expired session. 68. API invalid JSON/input. 69. Network-loss user feedback. 70. Mobile viewport clocking. 71. Keyboard/accessibility check. 72. Error log/request ID captured. 73. Restore/recovery rehearsal recorded. | 7 |

This is **73 individual checks**, not 13. The developer should execute the
first 53 before enabling communications or AI, then run 54–73 only in a
staging environment with the required provider/privacy configuration.

### Developer runbook — execute this in order

Do not improvise company data or change production configuration. Complete one
step, capture its evidence, then continue. If a step fails, stop that section,
file the defect, fix it, and restart the section from its first step.

#### Step 0 — Prepare a disposable staging workspace

1. Confirm the URL is the staging URL, not production.
2. Run `npm ci`, `npm run typecheck`, `npm run lint`, and `npm test` from a
   clean checkout. Record the commit SHA and outputs.
3. Apply only the staging migrations. Verify that the database is empty or use
   a new company named `Northstar Facility Services - QA YYYY-MM-DD`.
4. Create the following non-real user accounts through the normal invitation
   flow. Use a controlled QA mailbox domain, not personal addresses:

| Account | Role | Required setup |
| --- | --- | --- |
| `qa.admin@northstar.example` | Administrator | Company settings and exports. |
| `qa.manager@northstar.example` | Manager | Incident and coverage actions. |
| `qa.maya@northstar.example` | Employee | Maya Torres profile, skills `cleaning`, `opening`, available 06:00–14:00. |
| `qa.liam@northstar.example` | Employee | Liam Carter profile, skills `cleaning`, `evening`, available 14:00–22:00. |
| `qa.nora@northstar.example` | Employee | Nora Blake profile, skill `cleaning`, status `VACATION`. |
| `qa.ethan@northstar.example` | Employee | Ethan Reed profile, skills `cleaning`, `opening`, available 06:00–14:00. |

5. Create customer `Redwood Offices Ltd.`, worksites `Redwood Central` and
   `Redwood Riverside`, and services `Morning office cleaning` and `Evening
   common-area cleaning`. Use only fictitious addresses and a staging QR/PIN.
6. For one chosen test date, create these shifts:

| Shift | Worksite | Time | Assignee | Purpose |
| --- | --- | --- | --- | --- |
| `QA Morning Clean` | Redwood Central | 08:00–10:00 | Maya | Normal clocking and evidence. |
| `QA Evening Clean` | Redwood Central | 18:00–20:00 | Unassigned | Recovery/replacement flow. |
| `QA Ethan Conflict` | Redwood Riverside | 08:30–10:30 | Ethan | Required overlap exclusion. |

7. Take a baseline screenshot of the company dashboard, worksite list, shift
   planner, employee list, and empty/open incident inbox. These are the
   baseline evidence files.

#### Step 1 — Run the core flow exactly once

1. Sign in as `qa.admin`. Create and link the customer, worksites, services,
   and three shifts above. Verify the morning and evening services appear in
   the service dashboard.
2. Sign in as `qa.maya`. Open only the employee area. Clock in at 08:00, start
   a break, end it, and clock out at 10:00. Save the exact shift ID and clock
   event IDs.
3. Retry the same clock request using its idempotency key. Confirm there is
   still exactly one event of that type.
4. Sign in as `qa.manager`. Confirm the morning service shows completed
   attendance evidence, while the evening service is at risk/uncovered.
5. Request evening replacement candidates. Confirm Liam is eligible, Nora is
   excluded for vacation, and Ethan is excluded for overlapping work. Capture
   the reason shown for every exclusion.
6. Select Liam and record the coverage decision. Then try a lower-ranked
   selection without a reason; this must be refused. Retry with a reason and
   confirm the override is audited.
7. Create one controlled late/no-show condition, run the staging detector, and
   verify it produces one incident only. Run it again and verify no duplicate
   is created.
8. Acknowledge, assign, escalate, and resolve that incident with meaningful
   QA notes. Confirm every status, actor, and timestamp appears in the inbox.
9. Record a completed service outcome. Separately record a partial outcome
   without a note and verify the form rejects it; retry with a note. Attempt to
   alter the first completion directly through the supported API/UI and verify
   that immutable evidence cannot be changed.
10. Export service evidence and attendance. Inspect the files: all rows must
    belong to Northstar QA and include the expected shift/clock/completion data.

#### Step 2 — Run controlled negative tests

Execute the following without changing test assumptions:

1. As Maya, attempt to open the manager incident route and Ethan's shift URL.
2. As a user from a second staging company, try every Northstar QA export and
   one known Northstar ID in a route.
3. Create an overlapping shift for Maya, an end-before-start shift, and a
   shift for Nora. Each must be rejected without a partial record.
4. Send an invalid CSV, then a valid CSV containing one existing row, then a
   valid all-new CSV. Confirm invalid files write nothing, duplicates are
   explicitly skipped, and all accepted records arrive together.
5. Disconnect during one allowed clock submission, reconnect, and retry. The
   user must see a recoverable result and no duplicate evidence.
6. Use invalid request data and an expired session. Confirm an English error,
   no secret in the response, and a request ID for diagnosis.

#### Step 3 — Test communications and AI only when configured

1. Confirm the communication provider is in test mode and recipient addresses
   are QA-only. Trigger one send, one retryable failure, one final failure, and
   one authorised resend. Record outbox status and provider reference.
2. With AI flags disabled, request both AI features and confirm the UI says it
   is unavailable with no message or record changed.
3. In the privacy-approved QA workspace only, enable the feature flag and use
   the approved gateway key. Generate one operations brief, one internal
   incident draft, and one customer draft.
4. Review every output manually. Reject it if it invents facts, contains a
   name, address, GPS/location detail, incident free text, a staff assignment,
   legal promise, or automatic-send claim. Confirm generated text is never
   sent without a named human action.
5. Disable the flag again after testing and record the provider cost, model,
   audit IDs, reviewer, and outcome.

#### Step 4 — Report results in this exact format

For every test case, add one row to the QA report:

| Field | Required value |
| --- | --- |
| Test ID | The numbered matrix case, for example `27`. |
| Status | `PASS`, `FAIL`, or `BLOCKED`. |
| Tester and timestamp | Name, browser/device, timezone, and time. |
| Setup | Company, user role, and record IDs used. |
| Expected result | Copy the roadmap expectation. |
| Actual result | Exact observed behaviour; do not summarise a failure. |
| Evidence | Screenshot/video, request ID, audit ID, export name, and relevant log link. |
| Defect | Issue link or `None`. |

The developer sends the product owner one short summary at the end: total
passed/failed/blocked; every open critical/high defect; provider/AI status;
and a clear recommendation of `DO NOT PILOT`, `FIX AND RETEST`, or `READY FOR
CONTROLLED PILOT`.

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
