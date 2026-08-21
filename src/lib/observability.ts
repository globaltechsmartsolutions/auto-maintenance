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

/**
 * Credentials do not arrive under a helpful field name. They arrive inside an
 * error message — a connection string, a bearer token, an API key echoed back
 * by a provider — so string values are scrubbed by shape as well as by key.
 */
const secretPatterns: Array<[RegExp, string]> = [
  // scheme://user:password@host
  [/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1[redacted]@"],
  // JSON Web Tokens
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]"],
  // key=value / token: value pairs
  [/\b(api[_-]?key|token|secret|password|authorization)\b\s*[=:]\s*\S+/gi, "$1=[redacted]"],
  // Provider-style prefixed keys
  [/\b(sk|pk|rk)_[A-Za-z0-9_]{8,}/g, "[redacted]"],
];

export function scrubSecrets(text: string) {
  return secretPatterns.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text
  );
}

/** Values longer than this are truncated: a log line is not a data store. */
const maxValueLength = 200;
const maxDepth = 4;

export const REDACTED = "[redacted]";

function isRedactedKey(key: string) {
  // Separators are stripped before matching: `x-api-key`, `api_key` and
  // `apiKey` are the same field, and a redaction list that only catches one
  // spelling is a redaction list somebody will get past by accident.
  const normalised = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return redactedKeys.some((candidate) => normalised === candidate || normalised.endsWith(candidate));
}

export function redactLogFields(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= maxDepth) return "[truncated]";

  if (typeof value === "string") {
    const scrubbed = scrubSecrets(value);
    return scrubbed.length > maxValueLength ? `${scrubbed.slice(0, maxValueLength)}…` : scrubbed;
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
