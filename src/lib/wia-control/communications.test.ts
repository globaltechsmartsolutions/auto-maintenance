import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    employee: { findFirst: vi.fn() },
    communicationOutbox: { findFirst: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
    attendanceIncident: { findFirst: vi.fn(), update: vi.fn() },
    plannedShift: { update: vi.fn(), findMany: vi.fn() },
    coverageDecision: { create: vi.fn() },
    company: { findUnique: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
    communicationOutbox: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  };
  const providers = { deliverInApp: vi.fn(), deliverEmail: vi.fn() };
  return { prisma, transaction, providers };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));
vi.mock("@/lib/wia-control/communication-providers", () => mocks.providers);

import {
  activeCommunicationTemplate,
  communicationDedupeKey,
  OUTBOX_STUCK_MINUTES,
  renderCommunication,
  resolveCommunicationChannels,
  summariseCommunicationHealth,
} from "@/lib/wia-control/communication-policy";
import {
  confirmCoverage,
  getCommunicationHealth,
  processCommunicationOutbox,
  type WiaActor,
} from "@/lib/wia-control/service";

const manager: WiaActor = { companyId: "company-1", userId: "user-manager", role: "MANAGER" };
const worker: WiaActor = { companyId: "company-1", userId: "user-worker", role: "EMPLOYEE", employeeId: "employee-1" };
const now = new Date("2026-08-20T10:00:00Z");

const contact = { email: "ana@example.com", phone: "+34600000000", emailOptIn: true, smsOptIn: true };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.communicationOutbox.findFirst.mockResolvedValue(null);
  mocks.transaction.communicationOutbox.create.mockResolvedValue({ id: "outbox-1" });
  mocks.prisma.communicationOutbox.count.mockResolvedValue(0);
  mocks.prisma.communicationOutbox.findFirst.mockResolvedValue(null);
  mocks.prisma.communicationOutbox.findMany.mockResolvedValue([]);
  mocks.prisma.communicationOutbox.updateMany.mockResolvedValue({ count: 1 });
});

describe("message templates", () => {
  it("renders the exact version that was queued", () => {
    const rendered = renderCommunication("coverage_confirmed", 1, {
      scheduledStart: "2026-08-20T09:00:00Z",
      scheduledEnd: "2026-08-20T13:00:00Z",
    });
    expect(rendered.subject).toBe("You have been assigned to a shift");
    expect(rendered.body).toContain("2026-08-20T09:00:00Z");
    expect(rendered.version).toBe(1);
  });

  it("refuses an unknown template or version instead of sending a placeholder", () => {
    expect(() => renderCommunication("coverage_confirmed", 99, {})).toThrow(/no published version 99/);
    expect(() => renderCommunication("marketing_blast", 1, {})).toThrow(/no published version/);
  });

  it("publishes a version for every template it will queue", () => {
    for (const key of ["coverage_confirmed", "incident_opened", "shift_cancelled"] as const) {
      expect(activeCommunicationTemplate(key).version).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("channel consent", () => {
  it("always keeps the in-app record and adds email only with an address and an opt-in", () => {
    expect(resolveCommunicationChannels("coverage_confirmed", contact).channels).toEqual([
      "IN_APP",
      "EMAIL",
    ]);

    const noOptIn = resolveCommunicationChannels("coverage_confirmed", { ...contact, emailOptIn: false });
    expect(noOptIn.channels).toEqual(["IN_APP"]);
    expect(noOptIn.skipped[0]).toEqual({ channel: "EMAIL", reason: "The recipient has not opted in to email." });

    const noAddress = resolveCommunicationChannels("coverage_confirmed", { ...contact, email: null });
    expect(noAddress.channels).toEqual(["IN_APP"]);
    expect(noAddress.skipped[0].reason).toMatch(/no email address/);
  });

  it("gives every event a stable identity that changes with the recipient", () => {
    const base = { template: "coverage_confirmed", version: 1, channel: "EMAIL" as const, shiftId: "shift-1" };
    const first = communicationDedupeKey({ ...base, recipientEmployeeId: "employee-1" });
    expect(communicationDedupeKey({ ...base, recipientEmployeeId: "employee-1" })).toBe(first);
    expect(communicationDedupeKey({ ...base, recipientEmployeeId: "employee-2" })).not.toBe(first);
    expect(communicationDedupeKey({ ...base, recipientEmployeeId: "employee-1", channel: "IN_APP" })).not.toBe(
      first
    );
  });
});

describe("queueing a coverage message", () => {
  const incident = {
    id: "incident-1",
    companyId: "company-1",
    shiftId: "shift-1",
    status: "OPEN",
    severity: "HIGH",
    recommendedEmployeeId: "employee-1",
    shift: {
      id: "shift-1",
      companyId: "company-1",
      status: "UNCOVERED",
      employeeId: null,
      scheduledStart: new Date("2026-08-20T09:00:00Z"),
      scheduledEnd: new Date("2026-08-20T13:00:00Z"),
      requiredSkills: [],
      worksite: { id: "worksite-1", city: "Madrid" },
    },
  };

  function selectedEmployee() {
    return {
      id: "employee-1",
      companyId: "company-1",
      fieldStatus: "AVAILABLE",
      skills: [],
      zones: [],
      availability: null,
      maxHoursPerDay: null,
      maxJobsPerDay: null,
      user: { firstName: "Ana", lastName: "Lopez", email: "ana@example.com", phone: null },
      contactEmailOptIn: true,
      contactSmsOptIn: false,
    };
  }

  beforeEach(() => {
    mocks.transaction.attendanceIncident.findFirst.mockResolvedValue(incident);
    mocks.transaction.employee.findFirst.mockResolvedValue(selectedEmployee());
    mocks.transaction.plannedShift.findMany.mockResolvedValue([]);
    mocks.transaction.plannedShift.update.mockResolvedValue({ id: "shift-1" });
    mocks.transaction.attendanceIncident.update.mockResolvedValue({ id: "incident-1" });
    mocks.transaction.coverageDecision.create.mockResolvedValue({ id: "decision-1" });
    mocks.transaction.company.findUnique.mockResolvedValue({ lateSeverityThresholdMinutes: 30 });
  });

  it("queues one message per consented channel, with its template version", async () => {
    await confirmCoverage(manager, {
      shiftId: "shift-1",
      incidentId: "incident-1",
      selectedEmployeeId: "employee-1",
    });

    const queued = mocks.transaction.communicationOutbox.create.mock.calls.map(
      (call) => (call[0] as { data: { channel: string; template: string; templateVersion: number; dedupeKey: string } }).data
    );
    expect(queued.map((item) => item.channel)).toEqual(["IN_APP", "EMAIL"]);
    expect(queued.every((item) => item.template === "coverage_confirmed" && item.templateVersion === 1)).toBe(
      true
    );
    expect(new Set(queued.map((item) => item.dedupeKey)).size).toBe(2);
  });

  it("does not queue a second copy of a message that already exists", async () => {
    mocks.transaction.communicationOutbox.findFirst.mockResolvedValue({ id: "outbox-existing" });

    await confirmCoverage(manager, {
      shiftId: "shift-1",
      incidentId: "incident-1",
      selectedEmployeeId: "employee-1",
    });

    expect(mocks.transaction.communicationOutbox.create).not.toHaveBeenCalled();
  });

  it("records the channels the recipient has not agreed to", async () => {
    mocks.transaction.employee.findFirst.mockResolvedValue({
      ...selectedEmployee(),
      contactEmailOptIn: false,
    });

    await confirmCoverage(manager, {
      shiftId: "shift-1",
      incidentId: "incident-1",
      selectedEmployeeId: "employee-1",
    });

    const skipped = mocks.transaction.auditLog.create.mock.calls
      .map((call) => (call[0] as { data: { action: string } }).data)
      .find((data) => data.action === "communication.channel_skipped");
    expect(skipped).toBeDefined();
    expect(mocks.transaction.communicationOutbox.create).toHaveBeenCalledTimes(1);
  });
});

describe("outbox worker", () => {
  it("fails a message whose template version no longer exists, without retrying it", async () => {
    mocks.prisma.communicationOutbox.findMany.mockResolvedValue([
      {
        id: "outbox-1",
        status: "PENDING",
        channel: "EMAIL",
        template: "coverage_confirmed",
        templateVersion: 99,
        payload: {},
        attempts: 0,
        nextAttemptAt: now,
        recipientEmployee: { user: { email: "ana@example.com" } },
      },
    ]);

    const result = await processCommunicationOutbox(now);

    expect(result.results).toEqual([{ id: "outbox-1", status: "FAILED" }]);
    expect(mocks.providers.deliverEmail).not.toHaveBeenCalled();
    expect(mocks.prisma.communicationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );
  });

  it("passes the rendered message to the provider and keeps its reference", async () => {
    mocks.prisma.communicationOutbox.findMany.mockResolvedValue([
      {
        id: "outbox-1",
        status: "PENDING",
        channel: "EMAIL",
        template: "coverage_confirmed",
        templateVersion: 1,
        payload: { scheduledStart: "2026-08-20T09:00:00Z" },
        attempts: 0,
        nextAttemptAt: now,
        recipientEmployee: { user: { email: "ana@example.com" } },
      },
    ]);
    mocks.providers.deliverEmail.mockResolvedValue({ success: true, providerReference: "resend-123" });

    await processCommunicationOutbox(now);

    expect(mocks.providers.deliverEmail).toHaveBeenCalledWith(
      "outbox-1",
      expect.objectContaining({ subject: "You have been assigned to a shift" }),
      "ana@example.com"
    );
    expect(mocks.prisma.communicationOutbox.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SENT", providerReference: "resend-123" }),
      })
    );
  });
});

describe("outbox health", () => {
  it("asks for attention when a message has given up or a queue is stuck", () => {
    expect(
      summariseCommunicationHealth({
        pending: 1,
        retrying: 0,
        processing: 0,
        failed: 0,
        sentLast24h: 4,
        unacknowledgedLast24h: 1,
        oldestPendingAt: new Date(now.getTime() - 5 * 60_000),
        now,
      })
    ).toEqual(expect.objectContaining({ oldestPendingMinutes: 5, needsAttention: false }));

    expect(
      summariseCommunicationHealth({
        pending: 1,
        retrying: 0,
        processing: 0,
        failed: 0,
        sentLast24h: 0,
        unacknowledgedLast24h: 0,
        oldestPendingAt: new Date(now.getTime() - OUTBOX_STUCK_MINUTES * 60_000),
        now,
      }).needsAttention
    ).toBe(true);

    expect(
      summariseCommunicationHealth({
        pending: 0,
        retrying: 0,
        processing: 0,
        failed: 2,
        sentLast24h: 0,
        unacknowledgedLast24h: 0,
        oldestPendingAt: null,
        now,
      })
    ).toEqual(expect.objectContaining({ oldestPendingMinutes: null, needsAttention: true }));
  });

  it("measures only the caller's own workspace and refuses a field worker", async () => {
    mocks.prisma.communicationOutbox.count.mockResolvedValue(3);

    await getCommunicationHealth(manager, now);
    for (const call of mocks.prisma.communicationOutbox.count.mock.calls) {
      expect((call[0] as { where: { companyId?: string } }).where.companyId).toBe("company-1");
    }

    await expect(getCommunicationHealth(worker, now)).rejects.toThrow(/cannot view outbox health/);
  });
});
