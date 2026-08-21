# WIAControl operations runbooks

What to do when something goes wrong, written so someone who did not build the
system can follow it. Each runbook states the symptom, what to check, what to
do, and what must never be done.

Two rules hold across all of them:

- **Never edit a clock event, a shift completion, or a delivery submission
  directly.** All three are append-only and protected by database triggers. A
  mistake is corrected by a new record — a correction request, a new submission —
  never by rewriting history.
- **Every fix leaves a trace.** If you act outside the product, write what you
  did and why in the customer's support record on the same day.

---

## 1. A worker cannot clock in

**Symptom.** The employee screen shows a queued or failed clock.

1. Ask which of the three it is: no connection, the location check refusing, or
   an error message.
2. **No connection.** The device queues the action with an identifier generated
   at the moment they tapped, retries with backoff, and stops after five
   attempts to ask the person instead of retrying forever. Nothing is lost. Have
   them reopen the app in coverage; the queue sends in order.
3. **Location refused.** Check the worksite's `radiusMeters` and coordinates in
   `/worksites`. A worksite saved with no coordinates cannot verify a location.
   Widening the radius is a deliberate policy change: record who approved it.
4. **An error.** Find the request id in the response header `X-Request-Id` and
   search the logs for that id. `api.unhandled_error` carries the route and the
   error name.
5. **If they cannot clock at all**, have the coordinator record the attendance
   through a time correction request, which keeps the original absence and the
   correction as separate records.

**Never** insert a clock event by hand. The append-only chain is the evidence.

---

## 2. Somebody was assigned to the wrong shift

1. Open the shift in `/shifts` and reassign it. The server rechecks skills,
   availability, overlap, and daily limits.
2. If the wrong person was already notified, the message is in the outbox and
   its acknowledgement state is visible. Send a correction through the recovery
   queue's own message path so it is attributable.
3. If the assignment came from a coverage decision, it stays in the record with
   its reasons and any override reason. That history is not edited; the new
   decision is added.

---

## 3. A message was not delivered

1. Check `GET /api/control/communications/health`. It reports pending,
   retrying, failed, the oldest pending age, and whether anything needs
   attention.
2. `FAILED` means bounded retries were exhausted. The reason is on the record.
   The most common one is a missing provider key.
3. Fix the cause, then resend from the communications view. Resending is
   deliberate and attributable; the outbox never silently retries a message
   that has given up.
4. **Nothing pending at all, ever?** The scheduled worker is not running. Check
   the Vercel cron for `/api/cron/process-outbox` and that `CRON_SECRET` is set:
   the route refuses to run without it.

---

## 4. A customer asks for their data

1. Use the documented exports: attendance, incidents, coverage decisions, and
   per-service evidence. Field meanings are in
   [`WIACONTROL_EXPORT_FIELDS.md`](WIACONTROL_EXPORT_FIELDS.md).
2. Exports are company-scoped, reproducible for a given period, and audited.
   Two downloads of the same unchanged period are byte-identical.
3. Evidence files are never sent as links from the bucket. A signed URL lives
   for two minutes and every issue of one is audited.

**Never** run a database query to produce a customer deliverable. If an export
is missing a column a customer needs, add it to the dictionary — the test suite
enforces that the documentation matches.

---

## 4b. An orphaned login

**Symptom.** Inviting somebody fails with "already registered", but they do not
appear in the team. Or an import row came back with code `ORPHANED_LOGIN`.

This happens when the Postgres profile write failed *and* the automatic rollback
of the Supabase login failed too. The login exists with nothing behind it.

1. Search the logs for `event: "auth.orphaned_login"`. The entry carries the
   `supabaseUserId` — that is the record to remove.
2. Delete that user in Supabase Auth (Authentication → Users).
3. Invite the person again through the normal flow.

Do **not** create the Postgres profile by hand to match the stray login. The
provisioning path exists so the two sides are created together; hand-stitching
them produces an account nobody can reason about later.

---

## 5. Somebody has lost access

1. Confirm identity out of band. Never reset access on the strength of an email
   alone.
2. Reset the password through Supabase's own recovery flow. Support does not
   handle passwords.
3. A departed worker is deactivated, not deleted: their history stays attached
   to the shifts and events that reference it.
4. If a whole workspace is locked out, check `User.status` and that the company
   still has at least one `ADMIN`.

---

## 6. Triaging incidents during an incident-heavy day

1. Work from the recovery queue at `/control`, not from the inbox. It is ordered
   by what will hurt first and every row names its owner and next action.
2. Take ownership before doing anything else — an unowned incident is nobody's.
3. `Overdue` outranks severity: a missed promise is what a customer calls about.
4. If there is no candidate, escalate rather than assigning someone who fails
   the eligibility checks. The refusal reasons are shown; they are the argument
   to give the customer.

---

## 7. Restore rehearsal

Rehearse this **before** the pilot, and again after any migration that changes a
table holding evidence.

1. Take a fresh backup of the staging database and note its timestamp.
2. Restore it into an empty database and point a staging deployment at it.
3. Verify, in this order: a company exists; its clock events are present and
   their count matches; `ShiftCompletion` and `TemplateSubmission` triggers
   still reject an update; an evidence row's `storageKey` still resolves to an
   object in the bucket.
4. Record how long the restore took. That number is the recovery time you can
   honestly promise a customer.

**The database backup does not contain evidence files.** They live in object
storage and are backed up separately. A restore that reinstates metadata whose
files are gone leaves rows pointing at nothing — check both, or the evidence
pack is incomplete precisely when it matters.

---

## 8. Rolling a migration back

1. Prefer a forward fix. Every migration in this repository is additive, so the
   usual correct response to a bad deploy is to deploy the previous application
   version and leave the schema alone.
2. If a column or table genuinely must go, write a new migration that drops it.
   Never edit an applied migration file: the checksum is what tells you the
   database and the repository agree.
3. Before dropping anything that holds evidence, export it first. Attendance,
   completions, submissions, and evidence metadata are the customer's record,
   not ours.

---

## 9. Health and alerting

`GET /api/health` answers with:

- **200 `ok`** — everything reachable and nothing waiting.
- **207 `degraded`** — serving normally, but something needs a person: messages
  that gave up, or evidence past its retention that the job could not delete.
- **503 `failing`** — the database or authentication is unreachable.

The public answer carries only the reachability checks. Operational counts are
business signal and cost a database query each, so they are returned only to a
caller presenting the cron secret:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<staging>/api/health
```

Point the uptime monitor at the plain endpoint; use the authenticated form when
investigating. Page on 503. Review 207 within the working day. The scheduled outbox worker
answers 207 on the same condition, so a stuck queue is visible in the
scheduler's log without anyone opening the app.

Logs are one JSON line per event with a dotted `event` name. Every field passes
redaction on the way out: names, addresses, coordinates, message bodies, CSV
contents, prompts, and answers are replaced with `[redacted]` by field name, so
a log platform never becomes a second, unmanaged copy of worker data.
