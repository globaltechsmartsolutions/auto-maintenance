import { ZodError } from "zod";
import { WiaDomainError } from "@/lib/wia-control/domain";

type RouteHandler<TArguments extends unknown[]> = (
  ...arguments_: TArguments
) => Promise<Response>;

export class ApiRouteError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiRouteError";
  }
}

export function apiRoute<TArguments extends unknown[]>(
  handler: RouteHandler<TArguments>
): RouteHandler<TArguments> {
  return async (...arguments_: TArguments) => {
    const request = arguments_[0] instanceof Request ? arguments_[0] : undefined;
    const requestId = request?.headers.get("x-request-id")?.slice(0, 120) || crypto.randomUUID();
    const startedAt = Date.now();
    const respond = (response: Response) => {
      response.headers.set("X-Request-Id", requestId);
      return response;
    };
    try {
      return respond(await handler(...arguments_));
    } catch (error) {
      if (error instanceof ApiRouteError) {
        return respond(Response.json(
          { error: error.message, code: error.code },
          { status: error.status }
        ));
      }

      if (error instanceof ZodError) {
        return respond(Response.json(
          {
            error: "The submitted data is invalid.",
            code: "VALIDATION_ERROR",
            fields: error.flatten().fieldErrors,
          },
          { status: 400 }
        ));
      }

      if (error instanceof WiaDomainError) {
        // AI refusals carry their own meaning: an unconfigured or stopped
        // feature is unavailable, a rate limit is a retry-later, and a
        // workspace that has not enabled a feature is simply not allowed.
        const unavailable = ["AI_NOT_CONFIGURED", "AI_KILL_SWITCH", "EVIDENCE_STORAGE_NOT_CONFIGURED", "EVIDENCE_STORAGE_UNAVAILABLE"].includes(error.code);
        if (unavailable) {
          return respond(Response.json({ error: error.message, code: error.code }, { status: 503 }));
        }
        if (error.code === "AI_RATE_LIMITED") {
          return respond(Response.json({ error: error.message, code: error.code }, { status: 429 }));
        }
        const notAllowed = [
          "AI_FEATURE_NOT_ENABLED",
          "AI_DISABLED_FOR_COMPANY",
          "AI_BUDGET_NOT_AUTHORISED",
          "AI_BUDGET_EXHAUSTED",
          "EVIDENCE_STORAGE_PUBLIC",
          "EVIDENCE_TENANT_MISMATCH",
        ].includes(error.code);
        if (notAllowed) {
          return respond(Response.json({ error: error.message, code: error.code }, { status: 403 }));
        }
        const forbidden = error.code === "FORBIDDEN";
        const missing = error.code.endsWith("_NOT_FOUND");
        const conflict = [
          "INVALID_CLOCK_SEQUENCE",
          "SHIFT_OVERLAP",
          "SHIFT_CLOSED",
          "SHIFT_UNASSIGNED",
          "EMPLOYEE_UNAVAILABLE",
          "OVERRIDE_REASON_REQUIRED",
          "WORKSITE_HAS_OPEN_SHIFTS",
          "SHIFT_ALREADY_STARTED",
          "CORRECTION_CLOSED",
          "CORRECTION_NOT_REVIEWED",
          "INCIDENT_CLOSED",
          "NO_COVERAGE_CANDIDATE",
          "AI_DRAFT_CLOSED",
          "EVIDENCE_ALREADY_CONFIRMED",
          "EVIDENCE_LIMIT_REACHED",
          "SHIFT_ALREADY_COMPLETED",
        ].includes(error.code);
        return respond(Response.json(
          { error: error.message, code: error.code },
          { status: forbidden ? 403 : missing ? 404 : conflict ? 409 : 400 }
        ));
      }

      if (error instanceof SyntaxError) {
        return respond(Response.json(
          { error: "The request body does not contain valid JSON.", code: "INVALID_JSON" },
          { status: 400 }
        ));
      }

      console.error(JSON.stringify({
        level: "error",
        event: "api.unhandled_error",
        requestId,
        method: request?.method,
        path: request ? new URL(request.url).pathname : undefined,
        durationMs: Date.now() - startedAt,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }));
      return respond(Response.json(
        { error: "An internal error occurred.", code: "INTERNAL_ERROR" },
        { status: 500 }
      ));
    }
  };
}
