# WIAControl Staging QA Checklist

**Purpose:** Prove the fictional-company workflow before any customer pilot.
Sections 3 and 4 cover the operational core; sections 5 to 7 cover every other
surface the product exposes, so that anything left untested is left untested on
purpose. Run only in staging. Never use real employees, customers, details, or
production credentials.

## 1. Test record

- [ ] Staging URL recorded:
- [ ] Commit SHA recorded:
- [ ] Tester, date, browser/device, and timezone recorded:
- [ ] `npm ci`, `npm run typecheck`, `npm run lint`, and `npm test` passed:
- [ ] Staging migrations applied:
- [ ] QA evidence folder created:

## 2. Required fictional data

Create company `Northstar Facility Services - QA YYYY-MM-DD` and customer
`Redwood Offices Ltd.`. Use only fictitious addresses and a staging QR/PIN.

| Account | Role | Profile requirement | Created |
| --- | --- | --- | --- |
| `qa.admin@northstar.example` | Administrator | Settings and exports | - [ ] |
| `qa.manager@northstar.example` | Manager | Incidents and coverage | - [ ] |
| `qa.maya@northstar.example` | Employee | Skills: `cleaning`, `opening`; available 06:00–14:00 | - [ ] |
| `qa.liam@northstar.example` | Employee | Skills: `cleaning`, `evening`; available 14:00–22:00 | - [ ] |
| `qa.nora@northstar.example` | Employee | Skill: `cleaning`; status: `VACATION` | - [ ] |
| `qa.ethan@northstar.example` | Employee | Skills: `cleaning`, `opening`; available 06:00–14:00 | - [ ] |

- [ ] Create worksites `Redwood Central` and `Redwood Riverside`.
- [ ] Create services `Morning office cleaning` and `Evening common-area cleaning`.
- [ ] Create `QA Morning Clean`, Redwood Central, 08:00–10:00, assigned to Maya.
- [ ] Create `QA Evening Clean`, Redwood Central, 18:00–20:00, unassigned.
- [ ] Create `QA Ethan Conflict`, Redwood Riverside, 08:30–10:30, assigned to Ethan.
- [ ] Capture baseline dashboard, worksites, employees, shifts, services, and incident inbox screenshots.

## 3. Core checklist

Mark each row `PASS`, `FAIL`, or `BLOCKED`; include evidence and a defect link
for any non-pass result.

| ID | Check | Expected result | Status | Evidence / defect |
| ---: | --- | --- | --- | --- |
| 1 | Administrator sign-in | Correct company dashboard and admin routes. | - [ ] | |
| 2 | Manager sign-in | Operational routes available; admin-only actions restricted. | - [ ] | |
| 3 | Worker sign-in | Employee-only records and clock actions. | - [ ] | |
| 4 | Suspended account | Access denied. | - [ ] | |
| 5 | Worker opens another worker shift | Access denied. | - [ ] | |
| 6 | Worker opens admin route | Access denied. | - [ ] | |
| 7 | Second-company user opens QA record | Cross-company access denied. | - [ ] | |
| 8 | Create customer | Customer is company-scoped. | - [ ] | |
| 9 | Create linked worksite | Customer relationship persists. | - [ ] | |
| 10 | Create unlinked worksite | Valid standalone worksite persists. | - [ ] | |
| 11 | Invalid timezone/verification | Validation error; no record created. | - [ ] | |
| 12 | Create service | Compatible customer service persists. | - [ ] | |
| 13 | Archived customer service | Rejected. | - [ ] | |
| 14 | Customer mismatch | Service/worksite mismatch rejected. | - [ ] | |
| 15 | Assigned shift | Shift is planned and linked correctly. | - [ ] | |
| 16 | Uncovered shift | Shift is visibly at risk/uncovered. | - [ ] | |
| 17 | End before start | Rejected; no partial shift. | - [ ] | |
| 18 | Employee overlap | Rejected. | - [ ] | |
| 19 | Unavailable employee | Rejected. | - [ ] | |
| 20 | Compatible service link | Accepted. | - [ ] | |
| 21 | Cancelled service link | Rejected. | - [ ] | |
| 22 | Maya clocks in | Attributed clock event appears once. | - [ ] | |
| 23 | Invalid/duplicate transition | Rejected. | - [ ] | |
| 24 | Start break | Ordered event recorded. | - [ ] | |
| 25 | End break | Ordered event recorded. | - [ ] | |
| 26 | Clock out | Shift reflects completed attendance. | - [ ] | |
| 27 | Retry same offline clock | Exactly one event after retry. | - [ ] | |
| 28 | QR/location failure | Clear error, no accepted clock. | - [ ] | |
| 29 | Create correction | Original clock remains unchanged. | - [ ] | |
| 30 | Approve correction | Review decision audited. | - [ ] | |
| 31 | Correction without reason | Rejected when reason is mandatory. | - [ ] | |
| 32 | Alter original clock | Immutable evidence cannot be edited/deleted. | - [ ] | |
| 33 | Detect late/no-show | One actionable incident is created. | - [ ] | |
| 34 | Run detector again | No duplicate incident. | - [ ] | |
| 35 | Acknowledge incident | State and timestamp persist. | - [ ] | |
| 36 | Assign incident owner | Owner persists. | - [ ] | |
| 37 | Escalate with note | Escalation trail persists. | - [ ] | |
| 38 | Resolve with note | Resolution trail persists. | - [ ] | |
| 39 | Dismiss with note | Dismissal trail persists. | - [ ] | |
| 40 | Request replacement candidates | Liam eligible; Nora vacation; Ethan overlap exclusion explained. | - [ ] | |
| 41 | Confirm valid replacement | Coverage decision audited. | - [ ] | |
| 42 | Override without reason | Rejected. | - [ ] | |
| 43 | Completed outcome | Completion evidence persists. | - [ ] | |
| 44 | Partial outcome without note | Rejected. | - [ ] | |
| 45 | Edit/delete completion | Rejected as immutable. | - [ ] | |
| 46 | Service evidence export | QA-only rows with expected evidence. | - [ ] | |
| 47 | Attendance export | Correct, reproducible company-scoped rows. | - [ ] | |
| 48 | Cross-company export | Denied. | - [ ] | |
| 49 | Valid worksite CSV preview | Valid rows reported, no write. | - [ ] | |
| 50 | Invalid CSV preview | Row and field reported, no write. | - [ ] | |
| 51 | Existing CSV duplicate | Explicitly skipped. | - [ ] | |
| 52 | Atomic CSV confirmation | All accepted rows arrive together. | - [ ] | |
| 53 | Invalid CSV confirmation | No rows written. | - [ ] | |
| 54 | Employee CSV | Routed through invitation workflow. | - [ ] | |

## 4. Configured-only checklist

Run this section only after its named integration is configured in staging.

| ID | Prerequisite | Check | Expected result | Status |
| ---: | --- | --- | --- | --- |
| 55 | Communication test provider | Queue message | Outbox record created. | - [ ] |
| 56 | Communication test provider | Deliver message | Sent status and provider reference. | - [ ] |
| 57 | Communication test provider | Simulate retryable failure | Retried with visible status. | - [ ] |
| 58 | Communication test provider | Final failure and resend | Failure visible; authorised resend works. | - [ ] |
| 59 | Communication test provider | Recipient acknowledgement | Acknowledgement persists. | - [ ] |
| 60 | AI disabled | Request both AI features | Unavailable; no record or send. | - [ ] |
| 61 | Approved AI gateway and company flag | Operations brief | Human-review draft only. | - [ ] |
| 62 | Approved AI gateway and company flag | Internal incident draft | Stored draft; no automatic send. | - [ ] |
| 63 | Approved AI gateway and company flag | Customer incident draft | Stored draft; no automatic send. | - [ ] |
| 64 | Approved AI gateway and company flag | Attempt automatic send | Impossible without named human approval. | - [ ] |
| 65 | Approved AI gateway and company flag | Audit review | No prompt/generated content in audit log. | - [ ] |
| 66 | Approved AI gateway and company flag | Privacy review | No names, address, GPS, incident free text, or invented claims. | - [ ] |
| 67 | Any authenticated session | Expire session | Clear English error; no write. | - [ ] |
| 68 | API client | Invalid JSON/input | Validation error; no secret exposed. | - [ ] |
| 69 | Browser network tools | Lose/recover connection | Recoverable feedback; no duplicate data. | - [ ] |
| 70 | Mobile browser | Employee clocking | Usable viewport and controls. | - [ ] |
| 71 | Keyboard-only navigation | Main employee flow | Focus and controls usable. | - [ ] |
| 72 | Error simulation | Capture request ID | Privacy-safe log/request ID available. | - [ ] |
| 73 | Real staging backup | Restore rehearsal | Restore result documented. | - [ ] |

## 5. Extended checklist

Everything below is a surface the product exposes that sections 3 and 4 never
reach. Same rules: mark `PASS`, `FAIL`, or `BLOCKED`, with evidence.

### 5.1 Evidence attachments

Prerequisite: the evidence bucket exists and its file size limit is set
(owner task 1). The application accepts JPEG, PNG, WebP, HEIC and PDF, between
64 bytes and 20 MB, at most 20 files per shift.

| ID | Check | Expected result | Status | Evidence / defect |
| ---: | --- | --- | --- | --- |
| 74 | Maya requests an upload for her own shift | Signed link issued; attachment stays pending and is not yet visible as proof. | - [ ] | |
| 75 | Maya requests an upload for Liam's shift | Denied; no storage key reserved. | - [ ] | |
| 76 | Confirm a valid JPEG | Attachment visible on the shift; checksum of the stored bytes recorded. | - [ ] | |
| 77 | Confirm a file whose bytes contradict its declared type (an executable renamed `.jpg`) | Rejected on confirmation; the object is removed from storage; the rejection stays visible. | - [ ] | |
| 78 | Upload a file larger than the bucket limit | Refused **by the bucket**, not only by the application. This is the check that closes owner task 1. | - [ ] | |
| 79 | Attach a 21st file to one shift | Refused. | - [ ] | |
| 80 | Manager downloads evidence | Short-lived link (120 s); the read is audited. | - [ ] | |
| 81 | Reuse the download link after it expires | Refused. | - [ ] | |
| 82 | Second-company user requests the same attachment | Denied. | - [ ] | |

### 5.2 Delivery answers and templates

| ID | Check | Expected result | Status | Evidence / defect |
| ---: | --- | --- | --- | --- |
| 83 | Publish a delivery template with one required question | Template offered to the assigned worker on that service. | - [ ] | |
| 84 | Maya submits answers for her own shift | Submission recorded once and attributed to her. | - [ ] | |
| 85 | Retry the same submission with the same idempotency key | Exactly one submission after the retry. | - [ ] | |
| 86 | Submit with the required question unanswered | Rejected; nothing stored. | - [ ] | |
| 87 | Edit or delete a stored submission | Refused as append-only. | - [ ] | |

### 5.3 Correction outcomes

Check 30 approves a correction. These are the other three ways one ends.

| ID | Check | Expected result | Status | Evidence / defect |
| ---: | --- | --- | --- | --- |
| 88 | Reject a correction with a reason | Rejection, reason and reviewer recorded; the original clock event is unchanged. | - [ ] | |
| 89 | Worker accepts the outcome | Acceptance recorded against the same correction. | - [ ] | |
| 90 | Worker disputes the outcome | Dispute recorded and the stated reason still readable after the correction is closed. | - [ ] | |

### 5.4 Remaining exports

Checks 46 and 47 cover two of the four. These are the rest.

| ID | Check | Expected result | Status | Evidence / defect |
| ---: | --- | --- | --- | --- |
| 91 | Incident export | Company-scoped rows matching the incident inbox for the same range. | - [ ] | |
| 92 | Coverage-decision export | One row per decision, showing recommended against selected employee and any override reason. | - [ ] | |
| 93 | Export field dictionary | Every column produced by the exports is described. | - [ ] | |
| 94 | Export a range containing reduced clock locations | Distance and radius present; exact coordinates absent; the record still reads as complete. | - [ ] | |

### 5.5 Surfaces with no other check

| ID | Check | Expected result | Status | Evidence / defect |
| ---: | --- | --- | --- | --- |
| 95 | Guided onboarding for a new company | Steps reflect real state; completing a step never skips its validation. | - [ ] | |
| 96 | Coverage queue | Shifts at risk ordered by urgency, each with its reason stated. | - [ ] | |
| 97 | Coverage metrics | Figures agree with the incidents and decisions behind them. | - [ ] | |
| 98 | Deactivate an employee | Future shifts flagged as uncovered; past attendance untouched; sign-in refused. | - [ ] | |
| 99 | `/api/health` | Reports degraded when a dependency is down, rather than `ok`. | - [ ] | |
| 100 | Communications channel health | A stuck outbox is visible here before anybody reports it. | - [ ] | |
| 101 | Automated reminders | Fire once per shift, not once per run. | - [ ] | |

## 6. Scheduled jobs that delete or narrow data

Two of the four jobs remove personal data permanently. Owner task 2 proves they
*run*; this section proves they remove **the right thing**. A wrong retention
window here deletes a statutory record early, and no backup restores what the
job was supposed to keep.

Run 104 to 107 against records created for this purpose, on a database copy or
on QA data you are willing to lose. Do not run them for the first time against
a database holding anything you need.

| ID | Check | Expected result | Status | Evidence / defect |
| ---: | --- | --- | --- | --- |
| 102 | Call each of the four jobs with no `CRON_SECRET` set | 500, and nothing executed. | - [ ] | |
| 103 | Call each of the four jobs with a wrong secret | 401, and nothing executed. | - [ ] | |
| 104 | `reduce-clock-location` against an event inside the company's window | Coordinates untouched. | - [ ] | |
| 105 | `reduce-clock-location` against an event past the window | Latitude and longitude removed; distance, radius and verification outcome intact; `clock_location.reduced` audited with a count. | - [ ] | |
| 106 | `purge-evidence` against an attachment still inside retention | Untouched. | - [ ] | |
| 107 | `purge-evidence` against an attachment past retention | Both the row and the stored file are gone; a file that could not be deleted is reported as 207, never as 200. | - [ ] | |

## 7. Deliberately out of scope

Record a decision here rather than leaving these unmentioned. Anything left
unticked is out of scope **by choice**, and that choice is on the record.

- [ ] **Billing and subscriptions** — `stripe/checkout`, `stripe/portal`,
      `webhooks/stripe`, `invoices`, `leads`. Not exercised by this QA. Tick
      this box only if the pilot is invoiced outside the product; otherwise
      billing needs its own checks before a paying customer touches it.
- [ ] **Remote Inspectorate access, signed PDF and XML export, worker
      four-year history** — not built. See owner task 8.

## 8. Final decision

- [ ] Total PASS / FAIL / BLOCKED recorded, across all 107 checks.
- [ ] Every critical/high defect linked.
- [ ] Provider and AI configuration status recorded.
- [ ] Section 7 decided: every out-of-scope item is unticked on purpose, not by omission.
- [ ] Recommendation selected: `DO NOT PILOT` / `FIX AND RETEST` / `READY FOR CONTROLLED PILOT`.

Do not approve a customer pilot while a tenant-isolation, attendance-integrity,
duplicate-clock, incomplete-import, unauthorised-send, or wrong-deletion defect
remains open.
