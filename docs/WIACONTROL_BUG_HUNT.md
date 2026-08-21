# Where the bugs have been, and where to look next

A brief for the next testing round. Not a checklist — the checklist says what
must work. This says **where things have actually broken**, so the next round
starts from evidence rather than from imagination.

---

## The two faults found by running real code against a real database

Both had the same shape, and neither was visible to 425 unit tests.

**The location retention job could never have run.** An append-only trigger on
`ClockEvent` refused every `UPDATE`. The job added months later issued exactly
such an update, to drop an expired coordinate. It would have raised on the
first row it touched.

**Evidence uploads were refused by the database.** The attachment row was
inserted with an empty storage key and updated a moment later with the real
one. A check constraint requires the key to begin with `companies/<id>/`, and
an empty string fails it. The whole attachments feature was dead.

**Why neither was seen.** In the unit suite Prisma is a mock, so it agrees with
whatever the test says. `updateMany` returned a count; `create` returned an id.
Both tests asserted the *intent* of the call, which was correct, and neither
could reach the rule that refused it.

**The family:** a rule that lives in the database, contradicting code written
at a different time, where no test runs both together.

---

## That vein, specifically, is now exhausted

Worth recording so nobody re-digs it. The database has exactly **two check
constraints**, and both are accounted for:

| Constraint | State |
| --- | --- |
| `EvidenceAttachment_storageKey_tenant_prefix` | Was violated. Fixed. |
| `AiCommunicationDraft_approval_is_attributed` | Satisfied — the approval sets status, approver and timestamp in one write. |

The eight append-only triggers, the exclusion constraint and the partial unique
indexes are all now exercised by the integration suite. **A third bug of this
exact shape is unlikely.** The next one will be somewhere else.

---

## Where to look next

Ordered by how much damage the fault would do, not by how likely it is.

### 1 · Two things happening at once

Every guarantee proved so far was proved with one caller. The dangerous cases
have two.

- **Two coordinators confirm coverage on the same incident.** The double-booking
  constraint stops the same person being booked twice, but does anything stop
  one incident producing two coverage decisions, or two different replacements
  being told they have the shift?
- **A worker clocks the same event from two devices.** The idempotency key
  stops an identical retry. Two *different* keys arriving together is a
  different question, and the chain has a unique root index — which of the two
  loses, and does the loser get a usable error?
- **The outbox processed twice.** There is a processing lease; race two workers
  and see whether a message can be sent twice.

Test shape: two transactions opened against the real database, both reaching
the write, then committed in turn.

### 2 · Time, at the edges

Everything here is zoned to `Europe/Madrid`, and the day-range helpers decide
what "per day" means.

- **The October clock change.** `getZonedDayRange` on the day Spain moves off
  summer time: that day has 25 hours. Does the daily-hours limit compute
  correctly? Does a shift crossing 03:00 that morning behave?
- **A shift crossing midnight.** The overlap query is deliberately not
  day-bounded; the daily-load query deliberately is. Check they disagree in the
  way that was intended.
- **A device offline over a weekend.** A clock is refused if backdated more than
  24 hours. What happens to the offline queue of a worker whose phone had no
  signal from Friday to Monday? Losing a statutory record to a validation rule
  is worse than accepting a late one with a flag.
- **Retention across a leap year.** `evidenceRetentionUntil` adds years with
  `setUTCFullYear`. Check 29 February.

### 3 · The unexecuted half of the operational core

`service.ts` is 3,600 lines at **70 % branch coverage** — roughly 550 lines
never run by anything. Almost all of it is the `else` of some rule. That is
where remaining faults are most densely packed, and the integration harness now
exists to reach it.

### 4 · The seven patterns from the earlier review

Twenty-eight real findings sorted into these. Any new area should be read
against them:

1. Answering before checking ownership (idempotency leaks)
2. Two doors with different rules for the same act
3. A rule enforced in the wrong layer
4. Read-then-write with nothing underneath it
5. Trusting what the device says
6. Failing in silence
7. Deleting instead of preserving

---

## Techniques that have earned their place

- **Real database, real service functions.** Found both faults above. Everything
  new should be reachable this way before anybody clicks.
- **Mutation testing** on `domain-core.ts`, `recovery-queue.ts` and the
  assignment engine. Used by hand on the tenant guards: three deliberate
  breakages, all three caught. It measures whether tests *would notice*, which
  no coverage number does.
- **Property-based testing** for the time windows and retention arithmetic.
  These are exactly the rules where the failing input is one nobody thinks of.

## Techniques that have not

- **Coverage percentage as a goal.** 385 tests and 84 % coverage sat on top of a
  feature that could not run. The number moved; the risk did not.

---

## Absence and replacement: the scenarios worth building

The operational story the product exists for, written as things that go wrong.

1. A worker does not clock in. The incident opens. **Nobody looks at it for two
   hours.** Does the severity escalate, and is anybody told?
2. The recommended replacement is offered the shift and **also does not turn
   up**. Second incident on the same shift — or does the unique index on
   (company, shift, type) swallow it?
3. The coordinator overrides the recommendation and picks somebody the engine
   excluded. The override reason is mandatory — is the excluded reason still
   readable afterwards, so the decision can be explained later?
4. The replacement is confirmed **while the original worker clocks in late**.
   Two people now believe the shift is theirs.
5. The shift is covered, then the customer cancels the service. What happens to
   the coverage decision, the message already sent, and the incident?
6. A worker disputes the correction that followed all this. The dispute reason
   has to survive the incident closing — that one is already proved; the rest
   of the chain around it is not.
