import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiRoute, ApiRouteError } from "@/lib/http/api-route";
import { WiaDomainError } from "@/lib/wia-control/domain";

/**
 * The error contract every route inherits. It is tested here rather than route
 * by route because a caller relies on the status and the code, not on which
 * handler happened to throw.
 */

function request(headers: Record<string, string> = {}) {
  return new Request("https://wia.example/api/control/thing", { method: "POST", headers });
}

async function run(handler: () => Promise<Response>, headers?: Record<string, string>) {
  // Typed to take a Request because that is what apiRoute wraps; the handler
  // under test does not need it.
  const route = apiRoute<[Request]>(async () => handler());
  const response = await route(request(headers));
  return { response, body: await response.json().catch(() => undefined) };
}

afterEach(() => vi.restoreAllMocks());

describe("api route error contract", () => {
  it("passes a successful response through and always stamps a request id", async () => {
    const { response } = await run(async () => Response.json({ ok: true }));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
  });

  it("echoes a caller-supplied request id so a report can be traced", async () => {
    const { response } = await run(async () => Response.json({ ok: true }), {
      "x-request-id": "trace-abc",
    });
    expect(response.headers.get("X-Request-Id")).toBe("trace-abc");
  });

  it("turns a schema failure into 400 with the offending fields", async () => {
    const { response, body } = await run(async () => {
      z.object({ title: z.string().min(5) }).parse({ title: "no" });
      return Response.json({});
    });
    expect(response.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.fields.title).toBeDefined();
  });

  it("maps each family of domain error to the status a caller can act on", async () => {
    const cases: Array<[string, number]> = [
      ["FORBIDDEN", 403],
      ["SHIFT_NOT_FOUND", 404],
      ["SHIFT_OVERLAP", 409],
      ["AI_DRAFT_CLOSED", 409],
      ["AI_RATE_LIMITED", 429],
      ["AI_NOT_CONFIGURED", 503],
      ["EVIDENCE_STORAGE_NOT_CONFIGURED", 503],
      ["AI_FEATURE_NOT_ENABLED", 403],
      ["EVIDENCE_TENANT_MISMATCH", 403],
      ["CSV_VALIDATION_FAILED", 400],
    ];
    for (const [code, status] of cases) {
      const { response, body } = await run(async () => {
        throw new WiaDomainError(code, `${code} happened.`);
      });
      expect({ code, status: response.status }).toEqual({ code, status });
      expect(body.code).toBe(code);
    }
  });

  it("answers 400 for malformed JSON rather than a server error", async () => {
    const { response, body } = await run(async () => {
      throw new SyntaxError("Unexpected token < in JSON at position 0");
    });
    expect(response.status).toBe(400);
    expect(body.code).toBe("INVALID_JSON");
  });

  it("uses the status and code an explicit route error carries", async () => {
    const { response, body } = await run(async () => {
      throw new ApiRouteError(402, "PAYMENT_REQUIRED", "The subscription is not active.");
    });
    expect(response.status).toBe(402);
    expect(body).toEqual({ error: "The subscription is not active.", code: "PAYMENT_REQUIRED" });
  });

  it("never leaks an unexpected error's message, and logs it redacted instead", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { response, body } = await run(async () => {
      throw new Error("connection string postgres://user:secret@host/db failed");
    });

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "An internal error occurred.", code: "INTERNAL_ERROR" });
    expect(JSON.stringify(body)).not.toContain("secret");

    const line = JSON.parse(logged.mock.calls[0][0] as string);
    expect(line.event).toBe("api.unhandled_error");
    expect(line.path).toBe("/api/control/thing");
    expect(line.errorType).toBe("Error");
    // The message is kept for diagnosis, but the credential inside it is not.
    expect(line.errorDetail).toContain("connection string");
    expect(line.errorDetail).not.toContain("secret");
  });
});
