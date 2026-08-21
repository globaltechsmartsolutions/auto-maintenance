/**
 * Company-scoped operational exports.
 *
 * Two rules hold everywhere in this module. First, an export is *reproducible*:
 * the same workspace, the same period, and the same data produce byte-identical
 * output, so a customer can diff two downloads and trust the difference.
 * Nothing that changes between runs — a generation timestamp, a random id — is
 * written into the file.
 *
 * Second, every column is *declared*. The dictionary below is the single source
 * of truth for what a column means, and the row builders are checked against it,
 * so a customer reconciling an export never has to guess what a field is.
 */

export type ExportDataset = "attendance" | "incidents" | "coverage" | "service_evidence";

export type ExportColumn = {
  /** Column header, exactly as it appears in the file. */
  header: string;
  /** What the value means, in the customer's terms. */
  description: string;
  /** Where the value comes from, for anyone reconciling against the product. */
  source: string;
};

export type ExportDefinition = {
  dataset: ExportDataset;
  title: string;
  purpose: string;
  /** How rows are ordered. Stated because it is part of reproducibility. */
  ordering: string;
  columns: ExportColumn[];
};

const iso = "ISO 8601 with offset, in UTC.";

export const exportDefinitions: Record<ExportDataset, ExportDefinition> = {
  attendance: {
    dataset: "attendance",
    title: "Attendance",
    purpose:
      "Every clock event in the period, as recorded. Corrections are a separate record and never overwrite these values.",
    ordering: "Oldest event first, then by event id.",
    columns: [
      { header: "Event id", description: "Stable identifier of this clock event.", source: "ClockEvent.id" },
      { header: "Employee", description: "The person the event belongs to.", source: "Employee user name" },
      { header: "Worksite", description: "Where the event was recorded.", source: "Worksite.name" },
      { header: "City", description: "The worksite's city.", source: "Worksite.city" },
      { header: "Shift", description: "The planned shift the event belongs to.", source: "PlannedShift.title" },
      { header: "Event", description: "CLOCK_IN, BREAK_START, BREAK_END, or CLOCK_OUT.", source: "ClockEvent.type" },
      { header: "Occurred at", description: `When the person performed the action. ${iso}`, source: "ClockEvent.occurredAt" },
      { header: "Recorded at", description: `When the server stored it; later than the above for an offline event. ${iso}`, source: "ClockEvent.recordedAt" },
      { header: "Method", description: "How it was captured: MOBILE, QR, PIN, NFC, KIOSK, or MANUAL.", source: "ClockEvent.method" },
      { header: "Location verified", description: "true when the point-in-time check placed the device at the worksite.", source: "ClockEvent.locationVerified" },
      { header: "Captured offline", description: "true when the device queued it without a connection.", source: "ClockEvent.isOffline" },
    ],
  },
  incidents: {
    dataset: "incidents",
    title: "Incidents",
    purpose:
      "Every attendance incident detected in the period, with who owned it and how it ended.",
    ordering: "Oldest detection first, then by incident id.",
    columns: [
      { header: "Incident id", description: "Stable identifier of this incident.", source: "AttendanceIncident.id" },
      { header: "Type", description: "MISSING_CLOCK_IN, LATE, INCOMPLETE_CLOCK, or OUTSIDE_LOCATION.", source: "AttendanceIncident.type" },
      { header: "Severity", description: "LOW, MEDIUM, HIGH, or CRITICAL at the time of export.", source: "AttendanceIncident.severity" },
      { header: "Status", description: "OPEN, ACKNOWLEDGED, RESOLVED, or DISMISSED.", source: "AttendanceIncident.status" },
      { header: "Worksite", description: "Where the affected shift is.", source: "Worksite.name" },
      { header: "Service", description: "The client service commitment the shift fulfils, if any.", source: "Service.title" },
      { header: "Customer", description: "The customer that service belongs to.", source: "Customer.name" },
      { header: "Shift", description: "The affected planned shift.", source: "PlannedShift.title" },
      { header: "Affected employee", description: "The person the incident is about, if known.", source: "Employee user name" },
      { header: "Owner", description: "The coordinator accountable for recovery.", source: "AttendanceIncident.owner" },
      { header: "Detected at", description: `When the incident was detected. ${iso}`, source: "AttendanceIncident.detectedAt" },
      { header: "Due at", description: `When it should have been resolved, from the company incident policy. ${iso}`, source: "AttendanceIncident.dueAt" },
      { header: "Acknowledged at", description: `When a coordinator took it on. ${iso}`, source: "AttendanceIncident.acknowledgedAt" },
      { header: "Resolved at", description: `When it was closed. ${iso}`, source: "AttendanceIncident.resolvedAt" },
      { header: "Resolution notes", description: "What the coordinator recorded on closing.", source: "AttendanceIncident.resolutionNotes" },
    ],
  },
  coverage: {
    dataset: "coverage",
    title: "Coverage decisions",
    purpose:
      "Every human decision about who covers an at-risk shift, including the reasons the recommendation gave and any override.",
    ordering: "Oldest decision first, then by decision id.",
    columns: [
      { header: "Decision id", description: "Stable identifier of this decision.", source: "CoverageDecision.id" },
      { header: "Decided at", description: `When the coordinator confirmed it. ${iso}`, source: "CoverageDecision.createdAt" },
      { header: "Type", description: "RECOMMENDATION_ACCEPTED, MANUAL_OVERRIDE, or AUTO_ASSIGNED.", source: "CoverageDecision.type" },
      { header: "Incident id", description: "The incident this decision answers.", source: "CoverageDecision.incidentId" },
      { header: "Shift", description: "The shift that was covered.", source: "PlannedShift.title" },
      { header: "Worksite", description: "Where that shift is.", source: "Worksite.name" },
      { header: "Recommended employee", description: "Who the assignment engine put first, if anyone.", source: "CoverageDecision.recommendedEmployee" },
      { header: "Selected employee", description: "Who the coordinator actually assigned.", source: "CoverageDecision.selectedEmployee" },
      { header: "Score", description: "The recommendation score of the selected person, when one existed.", source: "CoverageDecision.score" },
      { header: "Reasons", description: "The explainable reasons behind the recommendation, separated by ' | '.", source: "CoverageDecision.reasons" },
      { header: "Override reason", description: "Why the coordinator chose someone other than the recommendation.", source: "CoverageDecision.overrideReason" },
      { header: "Decided by", description: "The coordinator who made the decision.", source: "CoverageDecision.actor" },
    ],
  },
  service_evidence: {
    dataset: "service_evidence",
    title: "Service evidence",
    purpose:
      "One client service: its shifts, what was delivered, and the answered delivery templates behind it.",
    ordering: "By shift start, oldest first; delivery submissions follow in submission order.",
    columns: [
      { header: "Service", description: "The client service commitment.", source: "Service.title" },
      { header: "Customer", description: "The customer that service belongs to.", source: "Customer.name" },
      { header: "Shift", description: "One planned shift fulfilling the service.", source: "PlannedShift.title" },
      { header: "Worksite", description: "Where that shift is.", source: "Worksite.name" },
      { header: "Scheduled start", description: `When the shift was planned to start. ${iso}`, source: "PlannedShift.scheduledStart" },
      { header: "Scheduled end", description: `When it was planned to end. ${iso}`, source: "PlannedShift.scheduledEnd" },
      { header: "Assigned employee", description: "Who was assigned at the time of export.", source: "PlannedShift.employee" },
      { header: "Shift status", description: "PLANNED, ACTIVE, PAUSED, COMPLETED, UNCOVERED, COVERED, or CANCELLED.", source: "PlannedShift.status" },
      { header: "Completion outcome", description: "COMPLETED, PARTIALLY_COMPLETED, or NOT_COMPLETED, from the immutable completion record.", source: "ShiftCompletion.outcome" },
      { header: "Completion time", description: `When the completion was recorded. ${iso}`, source: "ShiftCompletion.completedAt" },
      { header: "Completion note", description: "What the worker recorded on closing the visit.", source: "ShiftCompletion.note" },
      { header: "Clock events", description: "How many attendance events belong to the shift.", source: "count(ClockEvent)" },
      { header: "Open incidents", description: "How many incidents were still open or acknowledged at export time.", source: "count(AttendanceIncident)" },
      { header: "Coverage decisions", description: "How many human coverage decisions the shift needed.", source: "count(CoverageDecision)" },
      { header: "Delivery submissions", description: "How many answered delivery templates the shift carries.", source: "count(TemplateSubmission)" },
    ],
  },
};

/**
 * How much one export may cover. An unbounded range on a busy company loads
 * every matching row into memory and builds one string from it; the answer to
 * that is a narrower period, not a bigger server.
 */
export const MAX_EXPORT_DAYS = 366;
export const MAX_EXPORT_ROWS = 100_000;

/** Delimiter chosen for the spreadsheet software most pilots actually use. */
const delimiter = ";";

export type CsvValue = string | number | boolean | Date | null | undefined;

/**
 * Characters that make a spreadsheet treat a cell as a formula rather than
 * text. Quoting is not enough: Excel and Sheets still evaluate a quoted cell
 * that opens with one of these.
 */
const formulaLeaders = ["=", "+", "-", "@", "\t", "\r"];

function csvCell(value: CsvValue) {
  if (value === null || value === undefined) return '""';
  const text = value instanceof Date ? value.toISOString() : String(value);
  // A worksite named `=HYPERLINK(...)` would otherwise run when a coordinator
  // opens the export. The leading apostrophe is the spreadsheet convention for
  // "this is text", and it is what a recipient of a CSV expects to see.
  const safe = formulaLeaders.some((leader) => text.startsWith(leader)) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

/**
 * Renders a header row plus data rows. The byte-order mark is included because
 * the target spreadsheet software needs it to read UTF-8, and it is constant,
 * so it does not affect reproducibility.
 */
export function toCsv(headers: string[], rows: CsvValue[][]) {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(delimiter));
  return `\ufeff${lines.join("\n")}`;
}

export function exportFileName(dataset: ExportDataset, from: Date, to: Date) {
  return `wiacontrol-${dataset.replace(/_/g, "-")}-${from.toISOString().slice(0, 10)}-to-${to
    .toISOString()
    .slice(0, 10)}.csv`;
}

/**
 * Builds a file from a declared dataset. The row builder returns a record keyed
 * by header, and any header the definition does not declare — or any declared
 * header the builder forgot — is a programming error rather than a silently
 * odd-looking file.
 */
export function buildExport<TRecord>(
  dataset: Exclude<ExportDataset, "service_evidence">,
  records: TRecord[],
  toRow: (record: TRecord) => Record<string, CsvValue>
) {
  const definition = exportDefinitions[dataset];
  const headers = definition.columns.map((column) => column.header);
  const rows = records.map((record) => {
    const row = toRow(record);
    const unknown = Object.keys(row).filter((key) => !headers.includes(key));
    if (unknown.length) {
      throw new Error(`Export ${dataset} produced undeclared columns: ${unknown.join(", ")}.`);
    }
    return headers.map((header) => row[header] ?? null);
  });
  return { headers, csv: toCsv(headers, rows), rowCount: rows.length };
}

/** The field dictionary, for the documentation page and the API. */
export function exportFieldDictionary() {
  return Object.values(exportDefinitions).map((definition) => ({
    dataset: definition.dataset,
    title: definition.title,
    purpose: definition.purpose,
    ordering: definition.ordering,
    columns: definition.columns,
  }));
}
