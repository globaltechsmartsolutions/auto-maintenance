import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    aiCommunicationDraft: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    employee: { findFirst: vi.fn() },
    communicationOutbox: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
    company: { findUnique: vi.fn() },
    aiUsageRecord: {
      aggregate: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    aiCommunicationDraft: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    attendanceIncident: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma, transaction };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import {
  AI_HOURLY_REQUEST_LIMIT,
  aiAuditAction,
  evaluateAiGate,
  monthStart,
  type AiGateFacts,
} from "@/lib/ai/governance";
import { aiEvaluationScenarios, checkAiOutput } from "@/lib/ai/evaluation";
import { runGuardedAiCall } from "@/lib/ai/usage";
import {
  approveIncidentDraft,
  cancelIncidentDraft,
  editIncidentDraft,
} from "@/lib/ai/communication-workflow";
import type { WiaActor } from "@/lib/wia-control/service";

const manager: WiaActor = { companyId: "company-1", userId: "user-manager", role: "MANAGER" };
const worker: WiaActor = { companyId: "company-1", userId: "user-worker", role: "EMPLOYEE", employeeId: "employee-1" };
const now = new Date("2026-08-20T10:00:00Z");

function gateFacts(overrides: Partial<AiGateFacts> = {}): AiGateFacts {
  return {
    feature: "operations_brief",
    environmentConfigured: true,
    globalKillSwitch: false,
    companyFeatures: ["operations_brief"],
    companyDisabledAt: null,
    monthlyTokenBudget: 100_000,
    monthlyTokensUsed: 0,
    requestsLastHour: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.company.findUnique.mockResolvedValue({
    aiFeatures: ["operations_brief", "incident_communication_draft"],
    aiMonthlyTokenBudget: 100_000,
    aiDisabledAt: null,
  });
  mocks.prisma.aiUsageRecord.aggregate.mockResolvedValue({
    _sum: { promptTokens: 100, completionTokens: 50 },
    _count: 3,
  });
  mocks.prisma.aiUsageRecord.count.mockResolvedValue(0);
  // A usage row is reserved before the provider is contacted, so concurrent
  // calls can see each other.
  mocks.prisma.aiUsageRecord.create.mockResolvedValue({ id: "usage-1" });
  mocks.prisma.aiUsageRecord.update.mockResolvedValue({ id: "usage-1" });
});

describe("the AI gate", () => {
  it("allows a call only when every control agrees", () => {
    expect(evaluateAiGate(gateFacts())).toEqual({ allowed: true });
  });

  it("refuses with a distinct reason for each control", () => {
    const cases: Array<[Partial<AiGateFacts>, string]> = [
      [{ globalKillSwitch: true }, "AI_KILL_SWITCH"],
      [{ environmentConfigured: false }, "AI_NOT_CONFIGURED"],
      [{ companyDisabledAt: new Date() }, "AI_DISABLED_FOR_COMPANY"],
      [{ companyFeatures: [] }, "AI_FEATURE_NOT_ENABLED"],
      [{ monthlyTokenBudget: 0 }, "AI_BUDGET_NOT_AUTHORISED"],
      [{ monthlyTokenBudget: 1_000, monthlyTokensUsed: 1_000 }, "AI_BUDGET_EXHAUSTED"],
      [{ requestsLastHour: AI_HOURLY_REQUEST_LIMIT }, "AI_RATE_LIMITED"],
    ];
    for (const [overrides, code] of cases) {
      const decision = evaluateAiGate(gateFacts(overrides));
      expect({ overrides, decision }).toEqual({ overrides, decision: expect.objectContaining({ allowed: false, code }) });
    }
  });

  it("lets the global kill switch win over a fully configured workspace", () => {
    expect(evaluateAiGate(gateFacts({ globalKillSwitch: true, environmentConfigured: false }))).toEqual(
      expect.objectContaining({ code: "AI_KILL_SWITCH" })
    );
  });

  it("names an audit action per feature and outcome", () => {
    expect(aiAuditAction("operations_brief", "refused")).toBe("ai.operations_brief.refused");
    expect(monthStart(now).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("guarded AI calls", () => {
  it("records a refusal and never contacts the provider", async () => {
    mocks.prisma.company.findUnique.mockResolvedValue({
      aiFeatures: [],
      aiMonthlyTokenBudget: 100_000,
      aiDisabledAt: null,
    });
    const call = vi.fn();
    process.env.AI_GATEWAY_API_KEY = "test-key";
    process.env.AI_FEATURES_ENABLED = "true";

    await expect(
      runGuardedAiCall({ actor: manager, feature: "operations_brief", model: "test-model", now }, call)
    ).rejects.toThrow(/has not enabled/);

    expect(call).not.toHaveBeenCalled();
    expect(mocks.prisma.aiUsageRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome: "refused" }) })
    );
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ai.operations_brief.refused" }),
      })
    );
  });

  it("records the tokens a successful call spent", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    process.env.AI_FEATURES_ENABLED = "true";

    const result = await runGuardedAiCall(
      { actor: manager, feature: "operations_brief", model: "test-model", now },
      async () => ({ result: { headline: "ok" }, tokens: { promptTokens: 120, completionTokens: 40 } })
    );

    expect(result).toEqual({ headline: "ok" });
    // Reserved first, then settled with what it actually spent.
    expect(mocks.prisma.aiUsageRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome: "started" }) })
    );
    expect(mocks.prisma.aiUsageRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "generated", promptTokens: 120, completionTokens: 40 }),
      })
    );
  });

  it("records a provider failure rather than losing it", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    process.env.AI_FEATURES_ENABLED = "true";

    await expect(
      runGuardedAiCall({ actor: manager, feature: "operations_brief", model: "test-model", now }, async () => {
        throw new Error("provider timeout");
      })
    ).rejects.toThrow(/provider timeout/);

    expect(mocks.prisma.aiUsageRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: "failed", detail: "provider timeout" }),
      })
    );
  });

  it("stops an output being used when the kill switch is pulled mid-call", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    process.env.AI_FEATURES_ENABLED = "true";

    await expect(
      runGuardedAiCall(
        { actor: manager, feature: "operations_brief", model: "test-model", now },
        async () => {
          // Pulled while the provider is working.
          process.env.AI_KILL_SWITCH = "true";
          return { result: "generated anyway", tokens: {} };
        }
      )
    ).rejects.toThrow(/stopped while this request was running/);

    expect(mocks.prisma.aiUsageRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome: "refused" }) })
    );
    delete process.env.AI_KILL_SWITCH;
  });

  it("never writes the prompt or the generated text into the audit entry", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    process.env.AI_FEATURES_ENABLED = "true";

    await runGuardedAiCall(
      { actor: manager, feature: "operations_brief", model: "test-model", now, metadata: { date: "2026-08-20" } },
      async () => ({ result: "Ana Lopez did not clock in", tokens: {} })
    );

    const audited = JSON.stringify(mocks.prisma.auditLog.create.mock.calls);
    expect(audited).not.toContain("Ana Lopez");
  });
});

describe("AI output safety checks", () => {
  it("catches a leaked term, an invented reference, a claimed action, and a legal claim", () => {
    expect(
      checkAiOutput("Ana Lopez did not arrive.", { forbiddenTerms: ["Ana Lopez"] }).map((issue) => issue.code)
    ).toEqual(["LEAKED_TERM"]);

    expect(
      checkAiOutput("Check shift-999 as well.", { allowedIds: ["shift-100"] }).map((issue) => issue.code)
    ).toEqual(["INVENTED_REFERENCE"]);

    expect(checkAiOutput("I have assigned a replacement.").map((issue) => issue.code)).toEqual([
      "CLAIMED_ACTION",
    ]);
    expect(checkAiOutput("This record is legally compliant.").map((issue) => issue.code)).toEqual([
      "CLAIMED_COMPLIANCE",
    ]);
    // The same claims worded differently, which a fixed phrase list missed.
    expect(checkAiOutput("We sent a message to the team.").map((issue) => issue.code)).toEqual([
      "CLAIMED_ACTION",
    ]);
    expect(checkAiOutput("All legal requirements are met.").map((issue) => issue.code)).toEqual([
      "CLAIMED_COMPLIANCE",
    ]);
    expect(checkAiOutput("Disciplinary action is recommended.").map((issue) => issue.code)).toEqual([
      "EMPLOYMENT_DECISION",
    ]);
  });

  it("catches an invented UUID as readily as an invented readable id", () => {
    expect(
      checkAiOutput("See 3f6b6f1e-1c2d-4a5b-9c8d-0e1f2a3b4c5d for detail.", {
        allowedIds: ["shift-100"],
      }).map((issue) => issue.code)
    ).toEqual(["INVENTED_REFERENCE"]);
  });

  it("accepts a factual draft that stays inside the supplied facts", () => {
    expect(
      checkAiOutput("shift-100 is uncovered. A coordinator needs to confirm a replacement.", {
        allowedIds: ["shift-100"],
        forbiddenTerms: ["Ana Lopez"],
      })
    ).toEqual([]);
  });

  it("covers the five situations the roadmap requires before enabling AI", () => {
    expect(aiEvaluationScenarios.map((scenario) => scenario.key)).toEqual([
      "normal_day",
      "no_show",
      "late_arrival",
      "no_candidate",
      "cross_tenant",
    ]);
    for (const scenario of aiEvaluationScenarios) {
      expect(scenario.requiredBehaviour.length).toBeGreaterThan(20);
      expect(scenario.expectation.allowedIds?.length).toBeGreaterThan(0);
    }
  });

  it("fails an output that violates its scenario, and passes one that does not", () => {
    const noShow = aiEvaluationScenarios.find((scenario) => scenario.key === "no_show")!;
    expect(
      checkAiOutput("Ana Lopez missed shift-200; I have assigned a replacement.", noShow.expectation)
        .map((issue) => issue.code)
        .sort()
    ).toEqual(["CLAIMED_ACTION", "LEAKED_TERM"]);
    expect(
      checkAiOutput("shift-200 is uncovered and needs a coordinator to confirm cover.", noShow.expectation)
    ).toEqual([]);
  });
});

describe("AI draft approval", () => {
  const openDraft = {
    id: "draft-1",
    status: "DRAFT",
    audience: "INTERNAL_COORDINATION",
    incident: { id: "incident-1", shiftId: "shift-1", employeeId: "employee-1" },
  };

  beforeEach(() => {
    mocks.transaction.aiCommunicationDraft.findFirst.mockResolvedValue(openDraft);
    mocks.transaction.employee.findFirst.mockResolvedValue({ id: "employee-1" });
    mocks.transaction.communicationOutbox.create.mockResolvedValue({ id: "outbox-1" });
    // The draft is claimed with a conditional update before anything is
    // queued, so one draft cannot produce two messages.
    mocks.transaction.aiCommunicationDraft.updateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.aiCommunicationDraft.update.mockResolvedValue({
      id: "draft-1",
      status: "APPROVED",
      outboxId: "outbox-1",
      approvedAt: now,
    });
    mocks.prisma.aiCommunicationDraft.findFirst.mockResolvedValue({ id: "draft-1", status: "DRAFT" });
    mocks.prisma.aiCommunicationDraft.update.mockResolvedValue({
      id: "draft-1",
      status: "CANCELLED",
    });
  });

  it("queues the approved text and names the approver in the audit trail", async () => {
    await approveIncidentDraft(manager, "draft-1", {
      subject: "Cover needed at the main office",
      message: "The opening shift is uncovered. Please confirm whether you can take it this morning.",
    });

    const queued = mocks.transaction.communicationOutbox.create.mock.calls[0][0] as {
      data: { template: string; payload: { subject: string; body: string } };
    };
    expect(queued.data.template).toBe("coordinator_message");
    expect(queued.data.payload.subject).toBe("Cover needed at the main office");

    const audit = mocks.transaction.auditLog.create.mock.calls[0][0] as {
      data: { action: string; metadata: { approverUserId: string; finalMessage: string } };
    };
    expect(audit.data.action).toBe("ai.incident_communication_draft.approved");
    expect(audit.data.metadata.approverUserId).toBe("user-manager");
    expect(audit.data.metadata.finalMessage).toContain("uncovered");
  });

  it("queues exactly the text the approver restated, not what the record held", async () => {
    await approveIncidentDraft(manager, "draft-1", {
      subject: "Rewritten subject",
      message: "A coordinator rewrote this message entirely before approving it for delivery.",
    });

    const claim = mocks.transaction.aiCommunicationDraft.updateMany.mock.calls[0][0] as {
      where: { status: string };
      data: { finalMessage: string; approvedByUserId: string };
    };
    expect(claim.where.status).toBe("DRAFT");
    expect(claim.data.finalMessage).toContain("rewrote this message");
    expect(claim.data.approvedByUserId).toBe("user-manager");
  });

  it("refuses to approve text that claims an action or a legal conclusion", async () => {
    await expect(
      approveIncidentDraft(manager, "draft-1", {
        subject: "Handled",
        message: "I have assigned a replacement and this record is legally compliant now, all good.",
      })
    ).rejects.toThrow(/claims an action/);
    expect(mocks.transaction.communicationOutbox.create).not.toHaveBeenCalled();
  });

  it("refuses to approve, edit, or cancel a draft that is already closed", async () => {
    mocks.transaction.aiCommunicationDraft.findFirst.mockResolvedValue({ ...openDraft, status: "APPROVED" });
    mocks.transaction.aiCommunicationDraft.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.aiCommunicationDraft.findFirst.mockResolvedValue({ id: "draft-1", status: "CANCELLED" });

    await expect(
      approveIncidentDraft(manager, "draft-1", {
        subject: "Second approval",
        message: "Trying to approve a draft that has already been approved once before now.",
      })
    ).rejects.toThrow(/already been approved or cancelled/);
    await expect(
      editIncidentDraft(manager, "draft-1", {
        subject: "Edited subject",
        message: "Trying to edit a draft that is no longer open for editing at all.",
      })
    ).rejects.toThrow(/still open can be edited/);
    await expect(cancelIncidentDraft(manager, "draft-1")).rejects.toThrow(/already been approved or cancelled/);
  });

  it("cannot be approved twice at once, so one draft never becomes two messages", async () => {
    // The claim lost the race: somebody else approved it first.
    mocks.transaction.aiCommunicationDraft.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      approveIncidentDraft(manager, "draft-1", {
        subject: "Cover needed",
        message: "Two coordinators approving the same draft at the same moment.",
      })
    ).rejects.toThrow(/while you were working on it/);
    expect(mocks.transaction.communicationOutbox.create).not.toHaveBeenCalled();
  });

  it("is not available to a field worker", async () => {
    await expect(
      approveIncidentDraft(worker, "draft-1", {
        subject: "Anything",
        message: "A field worker must never be able to approve an AI message for delivery.",
      })
    ).rejects.toThrow(/Only a coordinator/);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires a recipient when the incident has no affected person", async () => {
    mocks.transaction.aiCommunicationDraft.findFirst.mockResolvedValue({
      ...openDraft,
      incident: { id: "incident-1", shiftId: "shift-1", employeeId: null },
    });

    await expect(
      approveIncidentDraft(manager, "draft-1", {
        subject: "Cover needed",
        message: "The opening shift is uncovered and somebody needs to take it this morning.",
      })
    ).rejects.toThrow(/Choose who receives this message/);
  });
});
