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
