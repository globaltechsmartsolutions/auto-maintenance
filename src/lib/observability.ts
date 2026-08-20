/**
 * Privacy-safe structured logging.
 *
 * Operational logs from this product routinely pass near worker data: names,
 * addresses, coordinates, message bodies, uploaded file names, CSV contents.
 * None of that belongs in a log line, and a rule that depends on every caller
 * remembering will eventually be broken. So redaction happens here, on the way
 * out, driven by the field name rather than by the caller's care.
 */

/** Field names whose value is never written, at any nesting depth. */
const redactedKeys = [
  "email",
  "phone",
  "firstname",
  "lastname",
  "name",
  "fullname",
  "address",
  "latitude",
  "longitude",
  "coordinates",
  "password",
  "token",
  "apikey",
  "authorization",
  "secret",
  "csv",
  "prompt",
  "message",
  "body",
  "note",
  "answers",
  "payload",
  "filename",
];

/** Values longer than this are truncated: a log line is not a data store. */
const maxValueLength = 200;
const maxDepth = 4;

export const REDACTED = "[redacted]";

function isRedactedKey(key: string) {
  const normalised = key.toLowerCase();
  return redactedKeys.some((candidate) => normalised === candidate || normalised.endsWith(candidate));
}

export function redactLogFields(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= maxDepth) return "[truncated]";

  if (typeof value === "string") {
    return value.length > maxValueLength ? `${value.slice(0, maxValueLength)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => redactLogFields(entry, depth + 1));

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isRedactedKey(key) ? REDACTED : redactLogFields(entry, depth + 1);
    }
    return result;
  }

  return "[unloggable]";
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEvent = {
  level: LogLevel;
  /** Dotted event name, e.g. "api.request" or "cron.outbox.completed". */
  event: string;
  [field: string]: unknown;
};

/**
 * Writes one JSON line. Structured rather than formatted, so a log platform can
 * filter on `event` without parsing prose, and every field passes redaction
 * first — including the ones a future caller adds without reading this comment.
 */
export function logEvent({ level, event, ...fields }: LogEvent) {
  const line = JSON.stringify({
    level,
    event,
    ...(redactLogFields(fields) as Record<string, unknown>),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export type HealthCheck = { name: string; status: "ok" | "degraded" | "failing"; detail?: string };

/**
 * Aggregates individual checks into one answer. `failing` means the product
 * cannot serve its core promise; `degraded` means it can, but something needs a
 * person. The distinction matters because only the first should page anyone.
 */
export function summariseHealth(checks: HealthCheck[]) {
  const failing = checks.filter((check) => check.status === "failing");
  const degraded = checks.filter((check) => check.status === "degraded");
  const status = failing.length ? "failing" : degraded.length ? "degraded" : "ok";
  return {
    status,
    httpStatus: failing.length ? 503 : degraded.length ? 207 : 200,
    checks,
    attention: [...failing, ...degraded].map((check) => check.name),
  };
}
