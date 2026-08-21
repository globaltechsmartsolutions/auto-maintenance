import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  detectIncidents: vi.fn(),
  processOutbox: vi.fn(),
  globalHealth: vi.fn(),
  reduceClockLocation: vi.fn(),
  purgeEvidence: vi.fn(),
}));

vi.mock("@/lib/wia-control/service", () => ({
  detectIncompleteAttendanceForAllCompanies: mocks.detectIncidents,
  processCommunicationOutbox: mocks.processOutbox,
  getGlobalCommunicationHealth: mocks.globalHealth,
  reduceClockLocationPrecision: mocks.reduceClockLocation,
}));
vi.mock("@/lib/wia-control/evidence-service", () => ({
  purgeExpiredEvidence: mocks.purgeEvidence,
}));

import { GET as detectIncidents } from "@/app/api/cron/detect-incidents/route";
import { GET as processOutbox } from "@/app/api/cron/process-outbox/route";
import { GET as purgeEvidence } from "@/app/api/cron/purge-evidence/route";
import { GET as reduceClockLocation } from "@/app/api/cron/reduce-clock-location/route";

/**
 * The scheduled jobs are the only endpoints that do real work without a user
 * session. One of them deletes evidence and another irreversibly narrows
 * personal data, so "who may run this" is the whole of their access control.
 *
 * Every job is checked here rather than one representative job, because this is
 * exactly the kind of rule that gets copied into a new route with a piece
 * missing.
 */

const jobs = [
  { name: "detect-incidents", run: detectIncidents, work: mocks.detectIncidents },
  { name: "process-outbox", run: processOutbox, work: mocks.processOutbox },
  { name: "purge-evidence", run: purgeEvidence, work: mocks.purgeEvidence },
  { name: "reduce-clock-location", run: reduceClockLocation, work: mocks.reduceClockLocation },
];

const originalEnvironment = { ...process.env };

function call(run: (request: Request) => Promise<Response>, headers: Record<string, string> = {}) {
  return run(new Request("https://wia.example/api/cron/job", { headers }));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "scheduler-secret";
  mocks.detectIncidents.mockResolvedValue([]);
  mocks.processOutbox.mockResolvedValue({ processed: 0, results: [] });
  mocks.globalHealth.mockResolvedValue({
    needsAttention: false,
    failed: 0,
    oldestPendingMinutes: null,
  });
  mocks.reduceClockLocation.mockResolvedValue({ companies: 0, reduced: 0 });
  mocks.purgeEvidence.mockResolvedValue({ examined: 0, deleted: 0, failures: [] });
});

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("scheduled job authentication", () => {
  it.each(jobs)("$name refuses to run at all when no secret is configured", async ({ run, work }) => {
    delete process.env.CRON_SECRET;

    const response = await call(run);

    // Refusing is the point: a missing secret must not mean "open".
    expect(response.status).toBe(500);
    expect(work).not.toHaveBeenCalled();
  });

  it.each(jobs)("$name refuses a caller with no authorization header", async ({ run, work }) => {
    const response = await call(run);

    expect(response.status).toBe(401);
    expect(work).not.toHaveBeenCalled();
  });

  it.each(jobs)("$name refuses a wrong or malformed secret", async ({ run, work }) => {
    for (const authorization of [
      "Bearer wrong-secret",
      "scheduler-secret",
      "Bearer  scheduler-secret",
      "bearer scheduler-secret",
      "",
    ]) {
      const response = await call(run, { authorization });
      expect({ authorization, status: response.status }).toEqual({ authorization, status: 401 });
    }
    expect(work).not.toHaveBeenCalled();
  });

  it.each(jobs)("$name runs for the scheduler's own secret", async ({ run, work }) => {
    const response = await call(run, { authorization: "Bearer scheduler-secret" });

    expect(response.status).toBeLessThan(400);
    expect(work).toHaveBeenCalledOnce();
  });
});

describe("scheduled job reporting", () => {
  it("does not report a partially failed detection run as a success", async () => {
    mocks.detectIncidents.mockResolvedValue([
      { companyId: "company-1", created: 2 },
      { companyId: "company-2", created: 0, error: "connection reset" },
    ]);

    const response = await call(detectIncidents, { authorization: "Bearer scheduler-secret" });

    // 207: the scheduler must not record this run as clean.
    expect(response.status).toBe(207);
    expect((await response.json()).failures).toHaveLength(1);
  });

  it("surfaces a stuck outbox in the scheduler's own answer", async () => {
    mocks.globalHealth.mockResolvedValue({
      needsAttention: true,
      failed: 3,
      oldestPendingMinutes: 90,
    });

    const response = await call(processOutbox, { authorization: "Bearer scheduler-secret" });

    expect(response.status).toBe(207);
    expect((await response.json()).health.failed).toBe(3);
  });

  it("reports an evidence purge that could not delete everything", async () => {
    mocks.purgeEvidence.mockResolvedValue({
      examined: 5,
      deleted: 4,
      failures: [{ id: "attachment-1", error: "bucket unavailable" }],
    });

    const response = await call(purgeEvidence, { authorization: "Bearer scheduler-secret" });

    expect(response.status).toBe(207);
  });
});
