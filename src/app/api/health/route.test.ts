import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  evidenceCount: vi.fn(),
  communicationHealth: vi.fn(),
  isDemoMode: vi.fn(),
  hasDatabaseConfig: vi.fn(),
  hasSupabaseConfig: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    $queryRaw: mocks.queryRaw,
    evidenceAttachment: { count: mocks.evidenceCount },
  }),
}));
vi.mock("@/lib/demo-mode", () => ({
  isDemoMode: mocks.isDemoMode,
  hasDatabaseConfig: mocks.hasDatabaseConfig,
  hasSupabaseConfig: mocks.hasSupabaseConfig,
}));
vi.mock("@/lib/wia-control/service", () => ({
  getGlobalCommunicationHealth: mocks.communicationHealth,
}));

import { GET } from "@/app/api/health/route";

/**
 * The public answer must stay thin. Operational counts are business signal and
 * cost a query each, so an unauthenticated caller gets liveness only.
 */

const originalEnvironment = { ...process.env };

function call(headers: Record<string, string> = {}) {
  return GET(new Request("https://wia.example/api/health", { headers }));
}

async function body(response: Response) {
  return (await response.json()) as {
    status: string;
    attention?: string[];
    checks?: Array<{ name: string }>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "operator-secret";
  mocks.isDemoMode.mockReturnValue(false);
  mocks.hasDatabaseConfig.mockReturnValue(true);
  mocks.hasSupabaseConfig.mockReturnValue(true);
  mocks.queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  mocks.evidenceCount.mockResolvedValue(0);
  mocks.communicationHealth.mockResolvedValue({
    needsAttention: false,
    failed: 0,
    oldestPendingMinutes: null,
  });
});

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe("public liveness", () => {
  it("answers 200 with a status and nothing else, and queries nothing extra", async () => {
    const response = await call();
    const payload = await body(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ok");
    // Which dependency is broken, and why, is operational detail. An uptime
    // monitor needs the status code, not the diagnosis.
    expect(payload.checks).toBeUndefined();
    expect(payload.attention).toBeUndefined();
    expect(mocks.communicationHealth).not.toHaveBeenCalled();
    expect(mocks.evidenceCount).not.toHaveBeenCalled();
  });

  it("does not tell an anonymous caller which dependency is misconfigured", async () => {
    mocks.hasDatabaseConfig.mockReturnValue(false);

    const response = await call();
    const payload = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(payload).not.toContain("DATABASE_URL");
  });

  it("never reveals operational counts to a caller with a wrong or missing secret", async () => {
    mocks.communicationHealth.mockResolvedValue({
      needsAttention: true,
      failed: 7,
      oldestPendingMinutes: 90,
    });

    const attempts: Array<Record<string, string>> = [{}, { authorization: "Bearer wrong" }];
    for (const headers of attempts) {
      const response = await call(headers);
      const payload = JSON.stringify(await response.json());
      expect(payload).not.toContain("7 failed");
      expect(payload).not.toContain("communications");
    }
    expect(mocks.communicationHealth).not.toHaveBeenCalled();
  });

  it("answers 503 when the database does not respond, for anyone", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("connection refused"));

    const response = await call();

    expect(response.status).toBe(503);
    expect((await body(response)).status).toBe("failing");
  });

  it("answers 503 when authentication is not configured", async () => {
    mocks.hasSupabaseConfig.mockReturnValue(false);
    expect((await call()).status).toBe(503);
  });
});

describe("operator detail", () => {
  it("adds the operational checks for a caller presenting the cron secret", async () => {
    const response = await call({ authorization: "Bearer operator-secret" });

    expect(response.status).toBe(200);
    expect((await body(response)).checks?.map((check) => check.name)).toEqual([
      "database",
      "authentication",
      "communications",
      "evidence_retention",
    ]);
  });

  it("answers 207 and names what needs attention, without paging anyone", async () => {
    mocks.communicationHealth.mockResolvedValue({
      needsAttention: true,
      failed: 2,
      oldestPendingMinutes: 45,
    });
    mocks.evidenceCount.mockResolvedValue(3);

    const response = await call({ authorization: "Bearer operator-secret" });
    const payload = await body(response);

    expect(response.status).toBe(207);
    expect(payload.status).toBe("degraded");
    expect(payload.attention).toEqual(["communications", "evidence_retention"]);
  });

  it("does not try to measure through a database that is down", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("connection refused"));

    const response = await call({ authorization: "Bearer operator-secret" });

    expect(response.status).toBe(503);
    expect(mocks.communicationHealth).not.toHaveBeenCalled();
  });

  it("cannot be unlocked when no secret is configured at all", async () => {
    delete process.env.CRON_SECRET;

    await call({ authorization: "Bearer undefined" });

    expect(mocks.communicationHealth).not.toHaveBeenCalled();
  });
});
