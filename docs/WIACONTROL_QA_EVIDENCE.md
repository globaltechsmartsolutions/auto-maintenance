# QA evidence — automated round, 21 August 2026

What has been proved, how, and what is still unproved. Every row below is
either backed by a named test that runs on every pull request, or marked as
not covered with the reason.

**Reproduce everything here in two commands.** The first needs a throwaway
PostgreSQL (see [runbooks §10](WIACONTROL_RUNBOOKS.md)):

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55434/wia_control_test npm run test:integration
```

```bash
npm run preprod:verify
```

---

## Totals

| | Result |
| --- | --- |
| Unit tests | **425 passing**, 33 files |
| Integration tests, real PostgreSQL | **74 passing**, 3 files |
| Coverage | 86.11 % statements · 74.56 % branches · 88.59 % functions |
| Lint · type check · production build | clean |
| Checklist rows evidenced automatically | **48 of 114** |
| Rows evidenced by the developer's manual round | 13 still valid |
| Rows not yet evidenced | 53 |

---

## What "integration" means here, and why it matters

The unit suite mocks Prisma. That proves a function asks the database the right
question; it cannot prove the database answers it. The whole reason this round
exists is that the mock had been agreeing with us: the location retention job
had been impossible since the day it was written — an append-only trigger
refused every update it made — and 385 passing tests never noticed, because the
mocked `updateMany` returned a count and the test asserted the intent.

The 74 integration tests run **the real service functions against a real
PostgreSQL** with all 19 migrations applied and every trigger, exclusion
constraint and partial index live. A rule either holds there or it does not.

---

## Evidenced automatically

### Tenant isolation

| Check | What is proved | Test |
| ---: | --- | --- |
| 7 | A second company's register returns none of this company's clients | `operations` · check 8 |
| 14 | A worksite cannot be pointed at another company's client | `operations` · check 14 |
| 14b | A service cannot be pointed at another company's client | `operations` · check 14 |
| 21 | A shift cannot be linked to another company's service | `operations` · checks 20–21 |
| 48 | Another company's attendance export contains none of these events | `attendance` · checks 47–48 |
| 91 | The incident export is company-scoped too | `attendance` · check 91 |
| — | Another company cannot review a correction | `attendance` · corrections |
| — | Another company cannot update an incident | `attendance` · incidents |
| — | The four ownership guards refuse a foreign id, answering 404 not 403 | `tenant-guards` · 18 tests |

### Clients, worksites and services

| Check | What is proved | Test |
| ---: | --- | --- |
| 8 | A client is stored, listed, and audited to the person who created it | `operations` · check 8 |
| 9 | A worksite links to its client, which is what the browser used to drop | `operations` · checks 9–10 |
| 10 | A standalone worksite is recorded, client unknown | `operations` · checks 9–10 |
| 12 | A service is created and returned in the register | `operations` · check 12 |
| 20 | A shift links to a compatible service | `operations` · checks 20–21 |
| 113 | A duplicate client name is refused, whatever the casing | `operations` · check 113 |
| 113b | Another company may still use the same client name | `operations` · check 113 |
| — | A field worker cannot create a service | `operations` · check 12 |

### Shift planning

| Check | What is proved | Test |
| ---: | --- | --- |
| 15 | An assigned shift is planned and linked to worksite and worker | `operations` · checks 15–19 |
| 16 | An unassigned shift is recorded as the uncovered case | `operations` · checks 15–19 |
| 17 | An end before its start is refused, storing no partial shift | `operations` · check 17 |
| 18 | An overlapping shift for the same person is refused, and nothing is written | `operations` · check 18 |
| 18b | A shift starting exactly when the previous ends is allowed | `operations` · check 18b |
| 19 | Somebody on holiday cannot be assigned | `operations` · check 19 |
| — | The database refuses the overlap even if the application check is bypassed | `database-guarantees` · double booking |
| — | Cancelled and completed shifts do not block a replacement | `database-guarantees` · double booking |

### Attendance — the statutory record

| Check | What is proved | Test |
| ---: | --- | --- |
| 22 | A clock-in is recorded once, attributed, with an integrity hash | `attendance` · check 22 |
| 23 | A transition that does not follow is refused | `attendance` · check 23 |
| 23b | Clocking in twice is refused | `attendance` · check 23b |
| 24–26 | The full in / break / break / out sequence forms one hash chain, each event naming the one before it | `attendance` · checks 24–26 |
| 27 | A retry with the same idempotency key answers from the stored event and writes nothing | `attendance` · check 27 |
| 32 | A stored clock event cannot be edited or deleted | `attendance` · check 32 |
| — | A worker cannot clock on somebody else's shift | `attendance` · clocking |
| — | The chain cannot fork, and a shift has exactly one first event | `database-guarantees` · linear chain |

### Corrections

| Check | What is proved | Test |
| ---: | --- | --- |
| 29 | The request is recorded and the original clock is untouched | `attendance` · check 29 |
| 30 | An approval records who decided, when, and on what grounds | `attendance` · check 30 |
| 31 | A request with no usable reason is refused and nothing is stored | `attendance` · check 31 |
| 88 | A rejection leaves the original clock exactly as it was | `attendance` · check 88 |
| 90 | A dispute keeps the worker's stated reason readable after closing | `attendance` · check 90 |

### Incidents

| Check | What is proved | Test |
| ---: | --- | --- |
| 33 | One incident opens for a shift nobody clocked into | `attendance` · check 33 |
| 34 | Running the detector again opens no duplicate | `attendance` · check 34 |
| 35–38 | Acknowledging, assigning, escalating and resolving all persist with their trail | `attendance` · checks 35–38 |

### Completion

| Check | What is proved | Test |
| ---: | --- | --- |
| 43 | The outcome is stored against the shift | `attendance` · check 43 |
| 44 | A partial outcome with no explanation is refused | `attendance` · check 44 |
| 45 | A stored outcome cannot be edited or deleted | `attendance` · check 45 |
| — | A second completion for the same shift is refused | `attendance` · completion |

### Exports

| Check | What is proved | Test |
| ---: | --- | --- |
| 47 | The attendance export returns this company's events | `attendance` · check 47 |
| 94 | A reduced clock still exports its distance and radius; the coordinate is gone | `attendance` · check 94 |
| — | A field worker cannot export the company register | `attendance` · exports |

### Accounts

| Check | What is proved | Test |
| ---: | --- | --- |
| 108 | An administrator creates a manager, with no employee record | `operations` · check 108 |
| 109 | An administrator creates another administrator | `operations` · check 109 |
| 110 | A manager can neither invite anybody nor see the coordinator list, and no user is written | `operations` · check 110 |
| 6 | A suspended account is told an administrator must restore access, not shown `access_denied` | `recovery-errors` · 6 tests |
| 6b | No recovery message reveals whether an address has an account | `recovery-errors` |

### Scheduled jobs and database guarantees

| Check | What is proved | Test |
| ---: | --- | --- |
| 105 | The location reduction removes the coordinate and keeps distance, radius and time | `database-guarantees` |
| 105b | A second reduction is refused; a reduction that also edits the time or hash is refused | `database-guarantees` |
| 102–103 | Every scheduled job refuses an absent or wrong secret | `cron-auth` |
| — | All eleven constraints, indexes and triggers exist; a migration that drops one fails by name | `database-guarantees` · inventory |
| — | Audit history, completions and submissions cannot be rewritten or erased | `database-guarantees` |
| — | Idempotency keys stop a retry doubling an incident, a message or a submission | `database-guarantees` |

---

## Still valid from the developer's manual round

These were run on 21 August against staging and touch no code changed since:

**1, 2, 3, 4, 5, 6, 7** — sign-in for each role, suspended account refused,
worker blocked from another worker's shift and from admin routes, second-company
user blocked from a QA record.
**33** — the detector opening an incident by itself.

**Six of that round's passes are now stale**: **10, 15, 16, 17, 18, 19**. They
were run before the fixes and exercise paths that changed — the worksite form
and shift planning. Their *rules* are now proved by the integration tests
above; what is unproved is the screen. Check 18 in particular is the subject of
issue 7 and must be seen in a browser.

---

## Not evidenced, and why

| Rows | Why not |
| --- | --- |
| 1–5, 10, 11, 15, 16, 28, 95–97, 111, 114 | Need a browser with a signed-in session. **I cannot enter a password into a login form**, so no authenticated UI check is available to me. |
| 49–54 | CSV import through the browser's file picker |
| 55–59 | Need a communications provider configured in staging |
| 60–66 | Need the AI gateway configured and the company flag on |
| 67–72 | Session expiry, offline recovery, mobile viewport, keyboard-only |
| 73 | Needs a real backup to restore |
| 74–82 | Need the evidence bucket's file size limit set (owner task 1) |
| 83–87 | No delivery template exists to submit against |
| 104, 106–107 | Need `CRON_SECRET` set in the deployment (owner task 2) |
| 112 | Recording a client is proved at the service layer; the dialog is not |

The honest summary of that column: the rules are proved, the screens are not.
Every fix from this round is backed by a test that runs on every pull request,
but nobody has yet clicked through the six screens that changed.

---

## The fastest way to close the gap

The remaining browser checks need one signed-in session and about forty
minutes. The developer's Northstar fixture is already the checklist's section 2
almost exactly — six accounts, four workers with the right skills and statuses,
two worksites, three shifts with the right windows. Only the client and the two
services were missing, and both are now possible.

Whoever runs it should start by pulling: without the fixes, half of what the
checklist now asks for does not exist in that copy.

```bash
git pull
```

---

## Outstanding, and not a code change

**The database password in the QA document must be rotated.** The `psql`
command recorded in the manual round carries the full Supabase connection
string including the password — write access to every company, every clock
event and the audit log. It has travelled through a shared document and can no
longer be treated as secret.
