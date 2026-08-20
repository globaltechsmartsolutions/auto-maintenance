# WIAControl export field definitions

What every column in a WIAControl export means, so a customer can reconcile
an exported file without database access.

These definitions are generated from `src/lib/wia-control/exports.ts`, which is
also what builds the files, so the documentation cannot drift from the data. The
same content is served at `GET /api/control/export/dictionary`.

## Rules that hold for every export

- **Company-scoped.** An export only ever contains the caller's own workspace.
  Role: administrator or manager. A field worker cannot export.
- **Reproducible.** The same workspace, period, and data produce a
  byte-identical file. Nothing that varies between runs is written into it, and
  the ordering of each dataset is stated below.
- **Audited.** Taking an export is itself recorded in the audit log, with the
  period and the row count.
- **Format.** UTF-8 with a byte-order mark, `;` as the delimiter, every cell
  quoted, `"` escaped as `""`, and timestamps as ISO 8601 in UTC.
- **Period.** `from` is inclusive, `to` is exclusive, and `to` must be later
  than `from`.

## Attendance

`GET /api/control/export/clocks?from=&to=`

Every clock event in the period, as recorded. Corrections are a separate record and never overwrite these values.

**Ordering:** Oldest event first, then by event id.

| Column | Meaning | Source |
| --- | --- | --- |
| Event id | Stable identifier of this clock event. | `ClockEvent.id` |
| Employee | The person the event belongs to. | `Employee user name` |
| Worksite | Where the event was recorded. | `Worksite.name` |
| City | The worksite's city. | `Worksite.city` |
| Shift | The planned shift the event belongs to. | `PlannedShift.title` |
| Event | CLOCK_IN, BREAK_START, BREAK_END, or CLOCK_OUT. | `ClockEvent.type` |
| Occurred at | When the person performed the action. ISO 8601 with offset, in UTC. | `ClockEvent.occurredAt` |
| Recorded at | When the server stored it; later than the above for an offline event. ISO 8601 with offset, in UTC. | `ClockEvent.recordedAt` |
| Method | How it was captured: MOBILE, QR, PIN, NFC, KIOSK, or MANUAL. | `ClockEvent.method` |
| Location verified | true when the point-in-time check placed the device at the worksite. | `ClockEvent.locationVerified` |
| Captured offline | true when the device queued it without a connection. | `ClockEvent.isOffline` |

## Incidents

`GET /api/control/export/incidents?from=&to=`

Every attendance incident detected in the period, with who owned it and how it ended.

**Ordering:** Oldest detection first, then by incident id.

| Column | Meaning | Source |
| --- | --- | --- |
| Incident id | Stable identifier of this incident. | `AttendanceIncident.id` |
| Type | MISSING_CLOCK_IN, LATE, INCOMPLETE_CLOCK, or OUTSIDE_LOCATION. | `AttendanceIncident.type` |
| Severity | LOW, MEDIUM, HIGH, or CRITICAL at the time of export. | `AttendanceIncident.severity` |
| Status | OPEN, ACKNOWLEDGED, RESOLVED, or DISMISSED. | `AttendanceIncident.status` |
| Worksite | Where the affected shift is. | `Worksite.name` |
| Service | The client service commitment the shift fulfils, if any. | `Service.title` |
| Customer | The customer that service belongs to. | `Customer.name` |
| Shift | The affected planned shift. | `PlannedShift.title` |
| Affected employee | The person the incident is about, if known. | `Employee user name` |
| Owner | The coordinator accountable for recovery. | `AttendanceIncident.owner` |
| Detected at | When the incident was detected. ISO 8601 with offset, in UTC. | `AttendanceIncident.detectedAt` |
| Due at | When it should have been resolved, from the company incident policy. ISO 8601 with offset, in UTC. | `AttendanceIncident.dueAt` |
| Acknowledged at | When a coordinator took it on. ISO 8601 with offset, in UTC. | `AttendanceIncident.acknowledgedAt` |
| Resolved at | When it was closed. ISO 8601 with offset, in UTC. | `AttendanceIncident.resolvedAt` |
| Resolution notes | What the coordinator recorded on closing. | `AttendanceIncident.resolutionNotes` |

## Coverage decisions

`GET /api/control/export/coverage?from=&to=`

Every human decision about who covers an at-risk shift, including the reasons the recommendation gave and any override.

**Ordering:** Oldest decision first, then by decision id.

| Column | Meaning | Source |
| --- | --- | --- |
| Decision id | Stable identifier of this decision. | `CoverageDecision.id` |
| Decided at | When the coordinator confirmed it. ISO 8601 with offset, in UTC. | `CoverageDecision.createdAt` |
| Type | RECOMMENDATION_ACCEPTED, MANUAL_OVERRIDE, or AUTO_ASSIGNED. | `CoverageDecision.type` |
| Incident id | The incident this decision answers. | `CoverageDecision.incidentId` |
| Shift | The shift that was covered. | `PlannedShift.title` |
| Worksite | Where that shift is. | `Worksite.name` |
| Recommended employee | Who the assignment engine put first, if anyone. | `CoverageDecision.recommendedEmployee` |
| Selected employee | Who the coordinator actually assigned. | `CoverageDecision.selectedEmployee` |
| Score | The recommendation score of the selected person, when one existed. | `CoverageDecision.score` |
| Reasons | The explainable reasons behind the recommendation, separated by ' | '. | `CoverageDecision.reasons` |
| Override reason | Why the coordinator chose someone other than the recommendation. | `CoverageDecision.overrideReason` |
| Decided by | The coordinator who made the decision. | `CoverageDecision.actor` |

## Service evidence

`GET /api/control/export/services/{serviceId}`

One client service: its shifts, what was delivered, and the answered delivery templates behind it.

**Ordering:** By shift start, oldest first; delivery submissions follow in submission order.

| Column | Meaning | Source |
| --- | --- | --- |
| Service | The client service commitment. | `Service.title` |
| Customer | The customer that service belongs to. | `Customer.name` |
| Shift | One planned shift fulfilling the service. | `PlannedShift.title` |
| Worksite | Where that shift is. | `Worksite.name` |
| Scheduled start | When the shift was planned to start. ISO 8601 with offset, in UTC. | `PlannedShift.scheduledStart` |
| Scheduled end | When it was planned to end. ISO 8601 with offset, in UTC. | `PlannedShift.scheduledEnd` |
| Assigned employee | Who was assigned at the time of export. | `PlannedShift.employee` |
| Shift status | PLANNED, ACTIVE, PAUSED, COMPLETED, UNCOVERED, COVERED, or CANCELLED. | `PlannedShift.status` |
| Completion outcome | COMPLETED, PARTIALLY_COMPLETED, or NOT_COMPLETED, from the immutable completion record. | `ShiftCompletion.outcome` |
| Completion time | When the completion was recorded. ISO 8601 with offset, in UTC. | `ShiftCompletion.completedAt` |
| Completion note | What the worker recorded on closing the visit. | `ShiftCompletion.note` |
| Clock events | How many attendance events belong to the shift. | `count(ClockEvent)` |
| Open incidents | How many incidents were still open or acknowledged at export time. | `count(AttendanceIncident)` |
| Coverage decisions | How many human coverage decisions the shift needed. | `count(CoverageDecision)` |
| Delivery submissions | How many answered delivery templates the shift carries. | `count(TemplateSubmission)` |
## Service evidence: the delivery block

The service evidence file carries a second block after the shift rows, listing
every answered delivery template: shift, template key, template version,
submission time, whether it was captured offline, who submitted it, the answers
rendered with the labels of the version answered, and the names of the evidence
files linked to that submission.

## Integrations

No third-party integration mapping is built. Per the roadmap, one is built only
when a pilot needs it and its authentication, field mapping, failure handling,
and support owner exist. Until then these documented, reproducible exports are
the supported interoperability path.
