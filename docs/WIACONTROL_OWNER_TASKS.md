# Outstanding owner tasks

What is left that cannot be closed by writing code. Each item says what it
blocks, who does it, and how to tell it is done.

Everything in the repository is applied and pushed: 18 migrations are live
against the staging database, the suite is green, and the four scheduled jobs
are declared and proven to refuse an unauthenticated caller.

---

## 1 · Set a file size limit on the evidence bucket

**Blocks:** enabling evidence attachments for anyone.
**Who:** whoever administers Supabase.

Supabase → Storage → the bucket named in `SUPABASE_EVIDENCE_BUCKET` → set a
maximum file size of **20 MB or less**.

The upload goes from the browser straight to the bucket with a signed URL. The
application refuses an oversized file **as evidence** when it confirms the
upload, but it cannot prevent the object being written in the first place —
only the bucket can. Without this limit, a client can put arbitrary volume into
storage before anything rejects it.

**Done when:** check 78 in the QA checklist passes — uploading a file larger
than the limit fails **at the bucket**, not only in the application.

---

## 2 · Confirm `CRON_SECRET` in the deployment

**Blocks:** every scheduled job. **Who:** whoever administers Vercel.

Four jobs are declared in `vercel.json` and all four authenticate with the same
bearer secret:

| Job | Schedule | What it does |
| --- | --- | --- |
| `/api/cron/detect-incidents` | every 15 min | Opens incidents for missing clocks |
| `/api/cron/process-outbox` | every 5 min | Delivers queued messages |
| `/api/cron/purge-evidence` | 03:30 daily | Deletes evidence past retention |
| `/api/cron/reduce-clock-location` | 04:00 daily | Reduces exact clock positions to distance |

Every one of them **refuses to run when `CRON_SECRET` is unset**, rather than
defaulting to open. Two of them delete or narrow real personal data, so that
refusal is deliberate: a missing secret must never mean "anyone may run this".

**Done when:** `CRON_SECRET` is set in the deployment environment and the jobs
appear in the Vercel cron log with 200 or 207 answers. A 500 means the secret is
missing; a 401 means it does not match.

---

## 3 · Decide the clock-location precision window

**Blocks:** nothing — it runs at the default. **Who:** you, with the privacy owner.

`Company.clockLocationPrecisionDays`, default **60**, allowed 7 to 365.

After that many days the exact coordinate of a clock event is deleted and only
the distance to the worksite and the radius in force survive. The statutory
record — time, person, worksite, verification outcome — is untouched and kept
for the full retention period.

The question that decides the number: **how long does a clock dispute take to
surface in your operation?** Two weeks means 30 is plenty; two months means 90.
Too short and a misconfigured worksite can no longer be recomputed; too long and
the record becomes a location history.

**Done when:** the value is set deliberately and recorded in the retention
policy below.

---

## 4 · Make two documents say what the software does

**Blocks:** a real pilot with real workers. **Who:** the privacy owner.

1. **The worker privacy notice** must state that location is captured only at
   the moment of clocking, never between clocks; that the employer sees whether
   the check passed and the distance; and that the exact position is deleted
   after the window in item 3.
2. **The retention policy / record of processing activities** must state that
   window alongside the four-year retention of the record itself.

The software being correct does not protect anybody if the signed document says
something else. The wording that is already on the clocking screen describes the
real behaviour and can be reused.

**Done when:** both documents match the behaviour and are signed off.

---

## 5 · Name the person who answers for this

**Blocks:** item 4, and any customer's privacy review. **Who:** you.

It can be an external adviser, a data protection officer, or you. It cannot be
nobody. This is the person who validates the window in item 3, owns the two
documents in item 4, and answers if a worker complains or an inspector asks.

---

## 6 · Rehearse a restore

**Blocks:** honest availability claims. **Who:** the developer, against staging.

The procedure is in [`WIACONTROL_RUNBOOKS.md`](WIACONTROL_RUNBOOKS.md) § 7.

The part most likely to be missed, repeated here: **the database backup does not
contain the evidence files.** They live in object storage and are backed up
separately. A restore that reinstates metadata whose files are gone leaves rows
pointing at nothing — check both, or the evidence pack is incomplete exactly
when it matters.

**Done when:** a restore has been performed and its duration recorded. That
number is the recovery time you can honestly promise a customer.

---

## 7 · Run the staging QA

**Blocks:** the pilot decision. **Who:** the developer.

The 114 checks in [`WIACONTROL_STAGING_QA_CHECKLIST.md`](WIACONTROL_STAGING_QA_CHECKLIST.md).
Checks 74 to 107 were added after an audit of the product's own surface: the
evidence attachments, the delivery answers, the three correction outcomes that
are not approval, two of the four exports, and the scheduled jobs that delete.

Section 1's automated gate is already covered: `npm run preprod:verify` passes —
lint, type-check, 385 tests, Prisma validation, coverage thresholds, production
build, and dependency audit with no vulnerabilities.

Sections 3 and 4 need what no test suite provides: a deployed staging
environment, the six fictional accounts, a real browser and a real phone, and a
backup to restore.

---

## 8 · Decide on the three coverage gaps

**Blocks:** claiming conformance with the 2026 digital time-record rules.
**Who:** you, informed by a qualified reading of the decree.

| Gap | State |
| --- | --- |
| **Remote Inspectorate access**, real time, without prior notice | Not built. `InspectionAccessGrant` is modelled in the schema — token hash, expiry, revocation, company-scoped — and referenced by no code. |
| **Signed PDF and XML export** | Only CSV, reproducible and fully documented. |
| **Worker access to their own four-year history** | A worker sees their shift and recent clocks, not a historical view. |

The first is the largest, and it needs an answer before it can be built: **how
does the decree say that access is provided?** A time-limited revocable link is
one shape; connecting to a central Administration system is a completely
different piece of work. That question is for whoever reads the published text,
not for an engineer to assume.

---

---

## 9 · Prove the two deleting jobs before they run against real data

**Blocks:** turning the scheduler on over anything you need to keep.
**Who:** the developer, against staging.

Item 2 proves the four jobs *run*. Two of them — `purge-evidence` and
`reduce-clock-location` — permanently remove personal data, and nothing has yet
proved they remove **the right thing**. Their authentication and their failure
reporting are covered by automated tests; the retention arithmetic that decides
*which* rows they touch has never been exercised against a database.

The failure mode is quiet and unrecoverable: a window computed wrongly deletes a
statutory record early, the job answers 200, and the loss surfaces months later
when somebody asks for the record. The backup does not help — it restores the
row the job was supposed to have kept only if the backup predates the mistake,
and nobody knows to look.

Checks **104 to 107** in the QA checklist cover it: one record inside the window
and one past it, for each job. Create those records for the purpose; do not run
either job for the first time against data you need.

**Done when:** all four checks pass, and the two jobs have each reported at
least one deliberate deletion whose scope was verified by hand.

---

## 10 · Decide whether billing is in scope for the pilot

**Blocks:** nothing technically. **Who:** you.

`stripe/checkout`, `stripe/portal`, `webhooks/stripe`, `invoices` and `leads`
exist in the product and are covered by no check, no test, and — until now — no
task. It is the only part of the system that moves money.

That is defensible if the pilot customer is invoiced outside the product, which
is the usual shape of a first pilot. It is not defensible by accident. Section 7
of the QA checklist now carries the box; tick it if billing stays out, or say so
and the checks get written.

**Done when:** section 7 of the checklist records the decision either way.

## What is already done, for contrast

- 18 migrations applied to staging and verified: the double-booking constraint,
  the linear clock chain, append-only triggers on four tables, and the approval
  attribution constraint all confirmed present in the database.
- 385 tests, coverage thresholds enforced in CI, zero dependency vulnerabilities.
- Client-facing decision document, threat and coverage model, runbooks, export
  field dictionary, AI governance document, and a delivery note per work package.
