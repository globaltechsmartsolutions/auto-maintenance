# WIAControl delivery log

One release note per completed work package, as required by delivery rule 5 of
the [product roadmap](WIACONTROL_PRODUCT_ROADMAP.md): user-visible change, data
impact, migration, rollback path, tests run, and any manual configuration.

Work packages that are not code — staging provisioning (2), the legal and
privacy sign-off inside 9 and 14, and the pilot itself (15, 16) — are tracked
here only when a code artefact supports them. They are completed by their named
owner, not by a commit.

---

## Package 1 and 3 — Baseline stabilisation and CSV import completion

**Status:** delivered · **Roadmap:** execution order 1 and 3, Stage D

### User-visible change

- `Pilot setup` now confirms a previewed CSV file. Worksites, services, and
  shifts are created in a single transaction; a row that already exists in the
  workspace is reported as skipped, and the first unusable row rolls the entire
  file back so a half-imported workspace cannot happen.
- Re-confirming a byte-identical file replays the recorded outcome instead of
  importing it twice.
- Employee files are confirmed through the existing Supabase invitation
  workflow, one recipient at a time. A profile that cannot be written revokes
  the login that was just created, and the failure is shown against its row.
- Each import kind offers a downloadable template with the exact headers the
  validator expects.

### Data impact

- No schema change.
- New audit actions: `csv_import.confirmed`, `csv_import.rejected`,
  `csv_import.employees_invited`, and `worksite.created` (worksite creation was
  previously unaudited). The confirmed and rejected entries store the per-row
  outcome, and their `entityId` is `KIND:sha256(companyId:kind:file)`, which is
  what makes the replay check possible.

### Migration

None.

### Rollback path

Revert the commit. The audit rows remain valid history; no data written by an
import is removed by the revert, which is intentional — imported worksites,
services, and shifts are ordinary records from that point on.

### Tests

`src/lib/wia-control/imports.test.ts` (10 cases): full-file commit, duplicate
skip, whole-file rollback with the rejection audited outside the transaction,
identical-file replay, refusal of an unvalidated file, refusal of a field worker
and of an employee file on the operational path, employee invitation happy path,
skip of an address that already has an account, login revocation when the
profile write fails while later rows keep processing, and a check that every
shipped template passes the validator that will receive it.

Suite: `npm run lint`, `npm run typecheck`, `npm test` — all green.

### Manual configuration

Employee imports need `SUPABASE_SERVICE_ROLE_KEY` and, for a usable invitation
link, `NEXT_PUBLIC_APP_URL`. Without them the invitation fails per row and is
reported; nothing is written.

---

## Package 4 — Private evidence storage

**Status:** delivered (code) · **Roadmap:** execution order 4, Stage B

### User-visible change

- A shift can carry up to 20 photo or PDF attachments as proof of delivery.
- The browser never receives a durable file URL. It asks for a short-lived
  signed upload link, uploads, and then asks the server to confirm; the server
  reads the stored bytes back and only then does the file count as evidence.
- A file whose content contradicts its declared type, or that carries an
  executable, script, or archive header, is deleted from storage immediately and
  kept as a visible rejected record.
- Reads are issued as 120-second signed links, one audited read at a time.
- A field worker sees only evidence for shifts assigned to them.

### Data impact

- New enum `EvidenceScanStatus` and table `EvidenceAttachment` holding metadata
  only: the file itself never enters the database. A `CHECK` constraint enforces
  that every storage key starts with `companies/<companyId>/`, so a mistaken or
  tampered key cannot address another tenant.
- New audit actions: `evidence.upload_requested`, `evidence.confirmed`,
  `evidence.rejected`, `evidence.downloaded`, `evidence.retention_deleted`.
- Retention follows the company's existing `clockRetentionYears`, so evidence
  lives exactly as long as the attendance record it supports.

### Migration

`prisma/migrations/20260821090000_evidence_attachments`. Additive: no existing
table is altered and no backfill is required.

### Rollback path

Revert the commit and drop the table and enum. Stored objects are not removed by
that rollback — delete the bucket prefix by hand if the feature is abandoned.

### Tests

`src/lib/wia-control/evidence.test.ts` (15 cases): filename sanitisation
including path traversal, refusal of a disallowed type and of a name that
disagrees with its type, tenant-prefixed key construction and cross-tenant key
refusal, retention arithmetic, byte-level screening of five file shapes, upload
reservation with audit, refusal to reserve for another person's shift, the
per-shift file cap, checksum recording on confirmation, deletion plus rejected
record for a hostile file, refusal to confirm another person's evidence, audited
signed download, refusal to link a rejected or deleted attachment, and a
retention run in which a storage failure keeps the row for the next attempt.

Suite: `npm run lint`, `npm run typecheck`, `npm test`, `prisma validate` — green.

### Manual configuration

- `SUPABASE_EVIDENCE_BUCKET` must name a **private** bucket. The application
  calls `getBucket` once per process and refuses to issue an upload link if the
  bucket is public.
- `/api/cron/purge-evidence` is registered in `vercel.json` at 03:30 daily and
  requires the existing `CRON_SECRET`.
- Before enabling this for a customer: a real malware scanner in front of the
  bucket, plus the storage DPA, retention schedule, and access policy signed off
  by the privacy owner. These are owner tasks, not code.

---

## Package 5 — Cleaning delivery templates

**Status:** delivered · **Roadmap:** execution order 5, Stage B

### User-visible change

- Four versioned templates are published: opening check, common areas, incident
  note, and completion confirmation.
- The employee screen shows them for the active shift. Answers are written to
  the device first, so a worker with no signal can still complete the visit and
  send it later.
- The submission identifier is generated once, when the worker starts
  answering, and reused for every retry: resending a queued visit returns the
  submission that already exists instead of creating a second one.
- A photo or PDF can be attached to a specific answer, not just to the shift.
- The service evidence export now carries a second block listing every
  submission, its template version, whether it was captured offline, who sent
  it, the answers in readable form, and the evidence attached to it.

### Data impact

- New table `TemplateSubmission`, append-only through the same trigger pattern
  as `ShiftCompletion`, unique on `(companyId, clientSubmissionId)`.
- `EvidenceAttachment.submissionId` links a file to the answer it supports.
- New audit action `delivery_template.submitted`, recording the template key and
  version behind every submission.
- Answers are stored normalised into template field order and anything the
  template did not ask for is dropped, so a submission cannot carry unrequested
  personal data.

### Migration

`prisma/migrations/20260821100000_delivery_templates`. Additive; the one change
to an existing table is a nullable `submissionId` column.

### Rollback path

Revert the commit, drop `TemplateSubmission` and its trigger function, and drop
the `submissionId` column. Evidence rows survive with their shift link intact.

### Tests

`src/lib/wia-control/delivery-templates.test.ts` (14 cases): the published
catalogue and its versions, refusal of a superseded version, answer
normalisation with unrequested keys dropped, all field-level issues reported at
once, numeric range enforcement, refusal of an unpublished version, readable
rendering against the version answered, capture with audit, idempotent resend,
offline-captured timestamps, refusal for another person's shift and for a
cancelled shift, coordinator readback, and refusal of the company-wide view to a
field worker. `evidence.test.ts` gained a case proving a photo cannot be filed
against another visit's answer.

Suite: `npm run lint`, `npm run typecheck`, `npm test`, `prisma validate` — green.

### Manual configuration

None. Templates are code: publishing a new version means adding an entry to the
registry in `src/lib/wia-control/delivery-templates.ts`; published entries are
never edited, so old submissions stay readable exactly as captured.

---

## Package 6 — Recovery cockpit completion

**Status:** delivered · **Roadmap:** execution order 6, Stage C

### User-visible change

- `/control` gains a **Recovery queue**: every at-risk service in one list,
  ordered by urgency, filterable by client service and by owner including "no
  owner yet".
- Each row names its accountable coordinator, how long it has been open, how
  long it is overdue, the confirmed cover and whether that person acknowledged
  it, and exactly one next human action.
- Rows are flagged when they are overdue, have been left with no owner, or were
  acknowledged and then stalled without a coverage decision.
- Take-ownership and acknowledge act directly from the queue through the
  existing incident endpoint; nothing is ever reassigned automatically.

### Data impact

None. The queue is a second question asked of the incident, coverage, and
communication records that already exist — not a new source of truth.

### Migration

None.

### Rollback path

Revert the commit. No data is affected.

### Tests

`src/lib/wia-control/recovery-queue.test.ts` (12 cases): owner-before-everything
ordering of the next action, escalation instead of assignment once the promise
is missed, the acknowledge → cover → chase → resolve walk, silence on a closed
incident, each of the three alerts and the case where none applies, an overdue
medium outranking a critical still inside its window, forward-only age
measurement, urgency ordering across a mixed queue with its counts, service and
coverage acknowledgement carried into a row, the service and unassigned-owner
filters reaching the query, the filter offering only services with something at
risk, and refusal of the whole queue to a field worker.

Suite: `npm run lint`, `npm run typecheck`, `npm test` — green.

### Manual configuration

None. The unowned and stale thresholds per severity are two tables in
`src/lib/wia-control/recovery-queue.ts`; confirm them with the first pilot.

---

## Package 7 — Communications delivery hardening

**Status:** delivered in code · **Roadmap:** execution order 7

### User-visible change

- Messages are versioned. A message whose template version no longer exists
  fails visibly and immediately instead of going out as a generic placeholder,
  and it is not retried, because retrying cannot fix it.
- Channel consent is resolved once, when the message is queued, with a recorded
  reason for every channel that was skipped. In-app always applies; email needs
  both an address and an opt-in; SMS and WhatsApp are refused until there is a
  provider and an explicit opt-in.
- Every message carries a dedupe key that is stable for the event, backed by a
  unique index, so requeueing the same reassignment cannot produce a second
  message.
- The provider's own reference is stored on a sent message.
- `/api/control/communications/health` reports the workspace's outbox state, and
  the scheduled worker answers 207 when something is stuck or has given up.

### Data impact

- `CommunicationOutbox` gains `templateVersion`, `dedupeKey` (unique per
  company), and `providerReference`.
- `Employee` gains `contactEmailOptIn` (default true) and `contactSmsOptIn`
  (default false). Email defaults to on because these messages are about the
  work the person already agreed to do; SMS stays off until an opt-in exists.
- New audit action `communication.channel_skipped`.
- Message rendering moved out of the provider module: a transport can no longer
  substitute the body it sends.

### Migration

`prisma/migrations/20260821110000_communication_hardening`. Additive with
defaults; existing rows become version 1 with a null dedupe key, and null keys
never collide.

### Rollback path

Revert the commit and drop the three outbox columns, the unique index, and the
two employee columns. Queued messages remain deliverable by the previous worker.

### Tests

`src/lib/wia-control/communications.test.ts` (12 cases): rendering the exact
queued version, refusal of an unknown template and unknown version, a published
version for every template, consent resolution across opt-in/no-address/no
opt-in, dedupe-key stability and its sensitivity to recipient and channel,
queueing one message per consented channel with distinct keys, refusal to queue
a duplicate, the recorded skip decision, worker failure on an unpublished
version without calling the provider, the rendered message reaching the provider
with its reference stored, health thresholds for stuck and failed queues, and
workspace scoping with refusal to a field worker.

`service.test.ts` fixtures were updated for the new recipient contact lookup and
the version now carried on every queued message.

Suite: `npm run lint`, `npm run typecheck`, `npm test`, `prisma validate` — green.

### Manual configuration

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` for email. Without them, email fails
honestly per attempt and becomes visibly FAILED after bounded retries — it is
never reported as sent. SMS requires a provider decision, a cost owner, and a
consent record before `resolveCommunicationChannels` is allowed to return it.

---

## Package 8 — Reporting and interoperability

**Status:** delivered · **Roadmap:** execution order 8, Stage D

### User-visible change

- Two new exports: incidents (`/api/control/export/incidents`) and coverage
  decisions (`/api/control/export/coverage`), both company-scoped and taking an
  explicit period.
- The attendance export now also carries the event id, the shift, the server
  recording time, and whether the event was captured offline.
- Every export is reproducible: fixed column set, stated ordering with the row
  id as a tiebreak, and nothing that varies between runs written into the file.
  Two downloads of an unchanged period are byte-identical, so a customer can
  diff them.
- `docs/WIACONTROL_EXPORT_FIELDS.md` documents every column — meaning and
  source — and the same content is served at `/api/control/export/dictionary`.

### Data impact

None. New audit actions `incident_report.exported` and
`coverage_report.exported` join the existing `clock_report.exported`, so who
took a copy of a workspace's history is itself accountable.

### Migration

None.

### Rollback path

Revert the commit. No data is affected.

### Tests

`src/lib/wia-control/exports.test.ts` (11 cases): cell quoting, quote escaping,
UTC date rendering and empty cells; byte-identical output for identical input;
period-based file naming; every dataset having a purpose, an ordering and a
described source per column; no duplicate header; refusal to write an undeclared
column; a declared-but-omitted column still filling its cell so every file has
the same shape; the published documentation containing every declared column, so
a new column cannot ship undocumented; company scoping and reproducible ordering
on all three queries; the export audit entries; and refusal of a field worker and
of an inverted period.

Suite: `npm run lint`, `npm run typecheck`, `npm test` — 180 passing.

### Manual configuration

None. If a pilot needs a payroll-specific column set, confirm it against the
documented fields before adding a column — adding one requires updating the
dictionary, or the suite fails.

---

## Packages 9–12 — AI governance, usage measurement, approval workflow, risk explanation

**Status:** delivered in code; provider, DPA, and privacy sign-off remain owner
tasks · **Roadmap:** execution order 9, 10, 11, 12

### User-visible change

- AI is off at four independent levels: the environment flag, the company's own
  feature list, two kill switches, and an authorised monthly token budget. A
  per-feature hourly rate limit sits on top. Each refusal has its own code and
  its own HTTP status, so "why did nothing happen" is always answerable.
- Every AI call — including a refused one — is recorded with its feature, model,
  outcome, and token counts. `GET /api/control/ai/usage` reports the month's
  spend against budget and the count of each outcome per feature.
- Generated output is refused before a human sees it if it leaks a withheld
  term, cites an identifier it was not given, claims an action was taken, claims
  legal compliance, or proposes an employment or payroll consequence.
- An AI incident draft is now a real workflow: stored rather than sent, freely
  editable, cancellable, and deliverable only by an approval that restates the
  accepted text. The approved text is queued under a `coordinator_message`
  template and recorded with its approver.
- Every at-risk row in the recovery queue explains itself in plain sentences
  derived from recorded facts — the roadmap's "risk explanation first",
  deliberately without a model.

### Data impact

- `Company` gains `aiFeatures` (empty by default), `aiMonthlyTokenBudget`
  (0 by default) and `aiDisabledAt`. The defaults are the "no AI runs here"
  state.
- New tables `AiUsageRecord` and `AiCommunicationDraft`, plus enum
  `AiDraftStatus`. A CHECK constraint enforces that an approved draft names its
  approver and the moment of approval.
- New audit convention `ai.<feature>.<outcome>`. Prompts and generated text are
  never audited; the one exception is the final text of an approved message.
- New communication template `coordinator_message` v1, which adds no wording of
  its own because a person already agreed to the exact text.

### Migration

`prisma/migrations/20260821120000_ai_governance`. Additive with safe defaults.

**Environment change:** `AI_OPERATIONS_BRIEF_ENABLED` is replaced by
`AI_FEATURES_ENABLED`, and `AI_KILL_SWITCH` is new. An environment that still
sets only the old variable now behaves as "AI not configured", which is the safe
direction for a rename to fail in.

### Rollback path

Revert the commit, drop the two tables, the enum, and the three company columns.
Any approved message already in the outbox is unaffected: it carries human text
under an ordinary template.

### Tests

`src/lib/ai/governance.test.ts` (19 cases): the gate allowing only when every
control agrees and refusing with a distinct code for each of the seven controls;
the global kill switch taking precedence; the audit naming convention and month
boundary; a refusal recorded without contacting the provider; token recording on
success; a provider failure recorded rather than lost; the audit entry never
containing generated text; each of the five output-safety checks including an
invented UUID; a clean draft passing; the five required evaluation scenarios
being present and well-formed; a scenario-violating output failing and a
compliant one passing; approval queueing the approver's own text with the
approver named in the audit; approval using the restated text rather than the
stored one; refusal to approve text that claims an action or a legal conclusion;
refusal to approve, edit, or cancel a closed draft; refusal of the whole workflow
to a field worker; and the demand for a recipient when the incident has none.

Suite: `npm run lint`, `npm run typecheck`, `npm test` — 199 passing.

### Manual configuration

`AI_GATEWAY_API_KEY` and `AI_FEATURES_ENABLED=true` make the environment
capable. Nothing runs for a customer until that company's `aiFeatures` and
`aiMonthlyTokenBudget` are set. Before that: provider and processing location,
DPA, subprocessor terms, privacy sign-off, an evaluation run against the shipped
scenario set, a named cost owner, and a named person who may pull the kill
switch. Those are listed in `docs/WIACONTROL_AI_GOVERNANCE.md` and are not done
by shipping code.
