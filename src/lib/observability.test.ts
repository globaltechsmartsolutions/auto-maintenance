import { describe, expect, it, vi } from "vitest";
import { logEvent, redactLogFields, REDACTED, scrubSecrets, summariseHealth } from "@/lib/observability";

describe("log redaction", () => {
  it("removes personal data by field name, at any depth", () => {
    expect(
      redactLogFields({
        shiftId: "shift-1",
        employee: { firstName: "Ana", lastName: "Lopez", email: "ana@example.com" },
        location: { latitude: 40.4168, longitude: -3.7038 },
        recipientEmail: "ana@example.com",
      })
    ).toEqual({
      shiftId: "shift-1",
      employee: { firstName: REDACTED, lastName: REDACTED, email: REDACTED },
      location: { latitude: REDACTED, longitude: REDACTED },
      recipientEmail: REDACTED,
    });
  });

  it("removes the payloads most likely to carry a person's own words", () => {
    expect(
      redactLogFields({ csv: "name,email\nAna,ana@example.com", prompt: "…", message: "…", answers: {} })
    ).toEqual({ csv: REDACTED, prompt: REDACTED, message: REDACTED, answers: REDACTED });
  });

  it("scrubs a credential that arrived inside a message, not under a field name", () => {
    expect(scrubSecrets("connect postgres://user:hunter2@db.internal/wia failed")).toBe(
      "connect postgres://[redacted]@db.internal/wia failed"
    );
    expect(scrubSecrets("Authorization: Bearer abc.def.ghi")).toContain("[redacted]");
    expect(scrubSecrets("stripe key sk_live_ABCDEFGH1234 rejected")).toBe(
      "stripe key [redacted] rejected"
    );
    expect(scrubSecrets("nothing sensitive here")).toBe("nothing sensitive here");
  });

  it("applies the credential scrub to every logged string, at depth", () => {
    expect(
      redactLogFields({ detail: { cause: "postgres://user:hunter2@db.internal/wia" } })
    ).toEqual({ detail: { cause: "postgres://[redacted]@db.internal/wia" } });
  });

  it("redacts a credential field however it is spelled", () => {
    expect(
      redactLogFields({
        "x-api-key": "live-secret",
        api_key: "live-secret",
        apiKey: "live-secret",
        Authorization: "Bearer abc",
      })
    ).toEqual({
      "x-api-key": REDACTED,
      api_key: REDACTED,
      apiKey: REDACTED,
      Authorization: REDACTED,
    });
  });

  it("keeps operational identifiers, counts, and flags", () => {
    expect(
      redactLogFields({ requestId: "r-1", durationMs: 42, rows: 3, committed: true, status: "SENT" })
    ).toEqual({ requestId: "r-1", durationMs: 42, rows: 3, committed: true, status: "SENT" });
  });

  it("truncates a long value and a deep structure rather than writing them out", () => {
    expect(redactLogFields({ detail: "x".repeat(500) })).toEqual({ detail: `${"x".repeat(200)}…` });
    expect(redactLogFields({ a: { b: { c: { d: { e: "deep" } } } } })).toEqual({
      a: { b: { c: { d: "[truncated]" } } },
    });
    expect((redactLogFields({ list: Array.from({ length: 50 }, (_, index) => index) }) as { list: number[] }).list)
      .toHaveLength(20);
  });

  it("writes one JSON line at the right console level, already redacted", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logEvent({ level: "error", event: "api.unhandled_error", requestId: "r-1", email: "ana@example.com" });
    expect(error).toHaveBeenCalledOnce();
    const line = JSON.parse(error.mock.calls[0][0] as string);
    expect(line).toEqual({
      level: "error",
      event: "api.unhandled_error",
      requestId: "r-1",
      email: REDACTED,
    });
    error.mockRestore();
  });
});

describe("health summary", () => {
  it("pages only for a failure, and asks for attention on a degradation", () => {
    expect(summariseHealth([{ name: "database", status: "ok" }])).toEqual(
      expect.objectContaining({ status: "ok", httpStatus: 200, attention: [] })
    );

    expect(
      summariseHealth([
        { name: "database", status: "ok" },
        { name: "communications", status: "degraded", detail: "2 failed" },
      ])
    ).toEqual(expect.objectContaining({ status: "degraded", httpStatus: 207, attention: ["communications"] }));

    expect(
      summariseHealth([
        { name: "database", status: "failing" },
        { name: "communications", status: "degraded" },
      ])
    ).toEqual(
      expect.objectContaining({
        status: "failing",
        httpStatus: 503,
        attention: ["database", "communications"],
      })
    );
  });
});
