# WIAControl threat and coverage model

The checklist this product is reviewed against, block by block. It exists so
that "everything looks fine" can be replaced by "these things were checked, and
here is what each one found".

**How to read it.** Each block states what must be **covered** (the product does
not do its job without it) and what must be **prevented** (the product is unsafe
if it can happen). Anything marked *criterion* is our engineering judgement, not
an external requirement — the distinction matters when arguing with a customer,
an auditor, or a labour inspector.

---

## Part A — The regulatory floor

This is not background reading. Spain's 2026 digital time-record rules are
functional requirements for exactly the records this product keeps, and they
decide whether several blocks are complete or not.

| Requirement | Source | Where it lands |
| --- | --- | --- |
| Daily record of start, end and breaks, per worker | Art. 34.9 ET (RD-ley 8/2019) | Blocks 5, 6 |
| Kept **four years**, including for people who have left | Art. 34.9 ET | Blocks 3, 5, 12 |
| Accessible to the worker, their representatives, and the Inspectorate | Art. 34.9 ET | Blocks 5, 10 |
| Digital only from 2026 — paper and spreadsheets no longer valid | 2026 Royal Decree | Whole product |
| Must carry **traceability and immutability**: any change leaves who, when and why | 2026 Royal Decree | Blocks 5, 6, 12 |
| Automatic timestamping that prevents silent alteration | 2026 Royal Decree | Block 5 |
| **Remote, real-time access for the Inspectorate, without prior notice** | 2026 Royal Decree | Block 10 — *not implemented* |
| Exportable in standard formats: CSV, signed PDF, XML | 2026 Royal Decree | Block 10 — CSV only |
| Must transmit at minimum: start, end, breaks, worker identity, worksite | 2026 Royal Decree | Block 10 |
| Geolocation only if **proportionate**: at the moment of the record, never continuous | AEPD guidance, updated Feb 2026 | Blocks 5, 12 |
| The worker must be informed that location is captured | AEPD guidance | Block 5 — *no notice surface* |

Two consequences worth stating plainly:

1. **The product's immutability design is not gold-plating.** Append-only clock
   events, the hash chain, corrections-as-separate-records, and the append-only
   audit log are what the 2026 rules demand. They are the compliance story.
2. **Point-in-time verification is the legally defensible choice.** The AEPD's
   position is that the purpose of a time record is when work starts and stops,
   not where somebody is at every moment. Continuous tracking would not be a
   feature; it would be a liability. This is already a stated non-goal and must
   stay one.

---

## Part B — Failure modes for this class of system

What actually goes wrong in attendance and field-service systems, independent of
any particular product.

**Attendance integrity**
- The same action recorded twice after a retry or a double tap.
- A clock-out that never arrives, leaving an open shift forever.
- The device clock being wrong, or deliberately set back.
- Offline capture that replays in the wrong order, or replays a stale action days later.
- Timezone and daylight-saving errors putting an event on the wrong day — which is the unit the law counts in.

**Coverage and recovery**
- A gap that nobody owns, discovered on the morning it fails.
- A replacement assigned who is not actually eligible.
- An incident closed as a side effect of an unrelated edit.
- Automatic reassignment making an employment decision no human authorised.

**Evidence**
- Files reachable by URL without a session.
- Evidence deleted, or expiring, before the record it supports.
- Metadata restored without its files, so the pack is incomplete precisely when it is needed.
- An upload accepted on the strength of its declared type.

**Messaging**
- Delivered twice, or silently not at all.
- A message sent to somebody who never agreed to that channel.
- A template renamed, and a placeholder going out to a real person.

**Multi-tenancy and access**
- A filter applied after the query instead of inside it.
- A nested relation that is not scoped even though its parent is.
- A role read from a token the user can edit.
- A wholesale `include` shipping a column that was added later.

**Operational**
- Logs becoming a second, unmanaged copy of worker data.
- An unauthenticated endpoint doing database work.
- A background job that reports success while doing nothing.

---

## Part C — The per-block checklist

### Block 1 · Foundations: tenancy, roles, audit

**Covered:** tenant resolved server-side from the session, never from the
request · every endpoint states its own roles · role read from the database ·
audit entry for every consequential write · audit is append-only.

**Prevented:** choosing another company by parameter · privilege escalation at
sign-up · an unauthenticated endpoint doing database work · a role that a user
can edit · a dashboard route reachable without a session.

### Block 2 · Customers, worksites, services

**Covered:** ownership validated on create and on change · a service and its
worksite belong to the same customer · risk derived, never silently written into
commercial status.

**Prevented:** attaching a record to another company's customer · a worksite
with live shifts disappearing · credential columns reaching the browser · a
field worker receiving the company register through a nested relation.

### Block 3 · Field team

**Covered:** login and profile created together, with rollback · skills, zones,
availability and daily limits — the exact inputs the coverage engine uses ·
history preserved on departure (**four-year retention applies to leavers**).

**Prevented:** hard deletion of a person with history · two doors out of the
field team with different rules · future shifts left assigned to a disabled
account · a coordinator's private notes reaching the worker they are about.

### Block 4 · Shift planning

**Covered:** overlap, availability and daily limits checked server-side · a
shift with no assignee raises a visible gap immediately · service relink guarded
by the same customer rule as creation.

**Prevented:** editing a shift people have already clocked into, except to
cancel · an accepted field silently discarded · coverage history rewritten by an
unrelated edit · an incident closed with no reason recorded.

### Block 5 · Attendance *(highest legal exposure)*

**Covered:** start, end and breaks per worker, with worksite identity ·
append-only with a hash chain · device-generated idempotency key reused across
retries · offline capture with ordered replay · point-in-time location check ·
late and outside-location incidents opened without invalidating the event.

**Prevented:** the same action recorded twice · clocking into somebody else's
shift · editing or deleting an event · a sequence that cannot physically happen
· continuous tracking of any kind.

**Open questions this review must answer:**
- Is the **device clock** trusted? An offline event carries `occurredAt` from the
  phone. What stops a backdated or forward-dated submission?
- Is there any **bound on how stale** an offline event may be when it arrives?
- Is the **hash chain ever verified**, or only written?
- Where is the worker **informed** that their location is captured? *(AEPD)*
- Does a **timezone or DST** boundary put an event on the wrong calendar day?

### Block 6 · Corrections

**Covered:** the original event never changes · proposal, decision and the
worker's own answer are three separate records · who changed what, when and why
— the traceability the 2026 rules require.

**Prevented:** a correction applied without review · the affected person
reviewing their own · a dispute closed silently.

### Block 7 · Incidents and recovery

**Covered:** severity and due time from company policy · one accountable owner ·
one next human action · explainable eligibility with reasons for every refusal ·
recovery-age alerting.

**Prevented:** automatic reassignment · a gap with no owner · an incident closed
without attribution · a no-candidate case answered with an ineligible person.

### Block 8 · Communications

**Covered:** versioned templates · per-recipient channel consent · bounded retry
with lease recovery · visible failure · recipient acknowledgement · outbox
health.

**Prevented:** duplicate delivery · a placeholder sent because a template moved
· a channel used without consent · a message lost with no trace.

### Block 9 · Evidence

**Covered:** private storage, tenant-prefixed keys, short-lived signed reads,
audited access · content screened against its declared type · checksum recorded
· retention deletes object and row · versioned delivery templates with answers
stored as captured.

**Prevented:** a publicly reachable file · evidence outliving or predeceasing
the record it supports · an upload trusted on its declared type · a file
attached to another visit's answer.

### Block 10 · Import and export *(known gaps)*

**Covered:** dry run before any write · one transaction per file · tenant-aware
duplicate detection · reproducible, audited, company-scoped exports · a
documented field dictionary.

**Prevented:** a partial import · a silently duplicated row · an export
containing another company's data.

**Missing against the 2026 rules:**
- **Remote Inspectorate access.** `InspectionAccessGrant` exists in the schema
  with `tokenHash`, `validUntil` and `revokedAt` — and **is referenced nowhere in
  the code**. The requirement is real-time remote access without prior notice.
- **Signed PDF and XML export.** Only CSV exists.
- **Worker and representative access** to their own four-year record, as a
  first-class surface rather than the current shift view.

### Block 11 · AI

**Covered:** off at four independent levels · per-company budget and rate limit ·
two kill switches · every call recorded including refusals · output screened
before a human sees it · approval names the approver and the exact text.

**Prevented:** any send without named human approval · prompts or generated text
in the audit log · staff ranking, discipline, payroll or autonomous assignment ·
personal data reaching the model.

### Block 12 · Observability and operation

**Covered:** redaction by field name plus credential scrubbing by shape · health
that separates page-now from review-today · runbooks including restore and
rollback · retention jobs that delete object and row.

**Prevented:** worker data in logs · business signal on an unauthenticated
endpoint · a job reporting success while doing nothing · a restore that
reinstates metadata whose files are gone.

**Open question:** `clockRetentionYears` is named for clock events but currently
only drives **evidence** retention. Nothing deletes clock events, so the
four-year floor is met by inaction — but the setting does not mean what its name
says, and nothing verifies availability or integrity of the stored history.

### Block 13 · Secondary modules

**Covered:** CRM off by default · Stripe isolated · public booking accepts
untrusted input safely.

**Prevented:** a secondary module widening the tenant boundary · a public
endpoint writing operational data · payment state trusted from the client.

---

## Part D — Gaps already identified by this research

Ranked by consequence, before a single line of the second review pass:

1. **No remote Inspectorate access.** A hard 2026 requirement, with a schema
   model already designed for it and no implementation behind it. This is the
   largest coverage gap in the product.
2. **No signed PDF or XML export.** Standard formats are named in the rules.
3. **No worker-facing access to their own historical record.** Legally required
   for workers and their representatives.
4. **Device-supplied `occurredAt` is unbounded.** Needs review in Block 5; this
   is the classic attack on attendance systems and the one an inspector or a
   dispute will land on.
5. **The hash chain is written but never verified.** An integrity guarantee
   nobody checks is a claim, not a control.
6. **No location-capture notice to the worker.** AEPD expects the worker to be
   informed.

Items 1 to 3 are product scope decisions and belong on the roadmap. Items 4 to 6
are review findings and belong in the block passes.

---

## Sources

- [Ley de control horario en España 2026 — Tramitapp](https://www.tramitapp.com/blog/ley-control-horario-espana/)
- [Conservación de los registros de horas trabajadas — Kronjop](https://kronjop.com/es/newsroom/control-horario/ley/conservacion-registros/)
- [Registro horario digital obligatorio 2026 — Protime](https://www.protime.eu/es-es/noticias/registro-horario-digital-obligatorio-2026)
- [Checklist de requisitos técnicos del decreto 2026 — inmutabilidad, trazabilidad y acceso ITSS](https://mifichajelegal.com/blog/checklist-software-fichaje-requisitos-tecnicos-decreto-2026/)
- [Fichaje GPS y criterio de proporcionalidad de la AEPD](https://latiendadeltpv.es/fichaje-geolocalizacion-gps-legal-aepd-proporcionalidad/)
- [Geolocalización y control horario: privacidad y legalidad](https://www.guiacontrolhorario.es/privacidad/geolocalizacion)

These are secondary sources summarising the legislation. **Before the pilot, the
requirements in Part A must be confirmed against the published Royal Decree and
the AEPD guidance itself by the qualified legal reviewer named in roadmap
package 14.** Nothing in this document is legal advice.
