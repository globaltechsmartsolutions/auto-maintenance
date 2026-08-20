import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    clockEvent: { findFirst: vi.fn() },
    timeCorrectionRequest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
    timeCorrectionRequest: { findMany: vi.fn() },
    attendanceIncident: { findMany: vi.fn() },
  };
  return { prisma, transaction };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import {
  acknowledgeTimeCorrection,
  listIncidents,
  listTimeCorrections,
  requestTimeCorrection,
  reviewTimeCorrection,
  type WiaActor,
} from "@/lib/wia-control/service";

const manager: WiaActor = { companyId: "company-1", userId: "user-manager", role: "MANAGER" };
const worker: WiaActor = {
  companyId: "company-1",
  userId: "user-worker",
  role: "EMPLOYEE",
  employeeId: "employee-1",
};

/**
 * A correction never rewrites a clock event. It is a separate, reviewable
 * record with its own decision and the affected person's own answer to that
 * decision, which is what keeps the original attendance trail trustworthy.
 */

const clockEvent = { id: "event-1", companyId: "company-1", employeeId: "employee-1" };

function auditActions() {
  return mocks.transaction.auditLog.create.mock.calls.map(
    (call) => (call[0] as { data: { action: string } }).data.action
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.clockEvent.findFirst.mockResolvedValue(clockEvent);
  mocks.transaction.timeCorrectionRequest.create.mockResolvedValue({ id: "correction-1" });
  mocks.transaction.timeCorrectionRequest.update.mockResolvedValue({ id: "correction-1" });
  mocks.prisma.timeCorrectionRequest.findMany.mockResolvedValue([]);
  mocks.prisma.attendanceIncident.findMany.mockResolvedValue([]);
});

describe("requesting a correction", () => {
  it("records the request against the event without touching the event itself", async () => {
    await requestTimeCorrection(worker, {
      clockEventId: "event-1",
      proposedOccurredAt: "2026-08-20T07:00:00.000Z",
      reason: "The phone had no signal when I arrived.",
    });

    expect(mocks.transaction.timeCorrectionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clockEventId: "event-1", employeeId: "employee-1" }),
      })
    );
    expect(auditActions()).toEqual(["time_correction.requested"]);
  });

  it("refuses a correction against somebody else's event, or one from another company", async () => {
    await expect(
      requestTimeCorrection(
        { ...worker, employeeId: "employee-2" },
        {
          clockEventId: "event-1",
          proposedOccurredAt: "2026-08-20T07:00:00.000Z",
          reason: "Not my event, but let me try anyway.",
        }
      )
    ).rejects.toThrow(/only correct your own clock events/);

    mocks.transaction.clockEvent.findFirst.mockResolvedValue(null);
    await expect(
      requestTimeCorrection(manager, {
        clockEventId: "event-other-company",
        proposedOccurredAt: "2026-08-20T07:00:00.000Z",
        reason: "An event that belongs to another workspace entirely.",
      })
    ).rejects.toThrow(/does not belong to the company/);

    expect(mocks.transaction.timeCorrectionRequest.create).not.toHaveBeenCalled();
  });
});

describe("reviewing a correction", () => {
  beforeEach(() => {
    mocks.transaction.timeCorrectionRequest.findFirst.mockResolvedValue({
      id: "correction-1",
      companyId: "company-1",
      clockEventId: "event-1",
      employeeId: "employee-1",
      status: "PENDING",
    });
  });

  it("records the decision, the reviewer, and clears any previous acknowledgement", async () => {
    await reviewTimeCorrection(manager, "correction-1", {
      status: "APPROVED",
      note: "Checked against the worksite log.",
    });

    expect(mocks.transaction.timeCorrectionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
          reviewedByUserId: "user-manager",
          employeeAcknowledgedAt: null,
        }),
      })
    );
    expect(auditActions()).toEqual(["time_correction.approved"]);
  });

  it("reopens the review path for a disputed request but refuses a settled one", async () => {
    mocks.transaction.timeCorrectionRequest.findFirst.mockResolvedValue({
      id: "correction-1",
      companyId: "company-1",
      status: "DISPUTED",
    });
    await expect(
      reviewTimeCorrection(manager, "correction-1", { status: "REJECTED" })
    ).resolves.toBeDefined();

    mocks.transaction.timeCorrectionRequest.findFirst.mockResolvedValue({
      id: "correction-1",
      companyId: "company-1",
      status: "APPROVED",
    });
    await expect(
      reviewTimeCorrection(manager, "correction-1", { status: "REJECTED" })
    ).rejects.toThrow(/already has an active decision/);
  });

  it("is never done by the affected person", async () => {
    await expect(
      reviewTimeCorrection(worker, "correction-1", { status: "APPROVED" })
    ).rejects.toThrow(/cannot approve corrections/);
  });
});

describe("acknowledging a decision", () => {
  beforeEach(() => {
    mocks.transaction.timeCorrectionRequest.findFirst.mockResolvedValue({
      id: "correction-1",
      companyId: "company-1",
      employeeId: "employee-1",
      status: "APPROVED",
      companyReviewedAt: new Date("2026-08-20T12:00:00Z"),
    });
  });

  it("lets the affected person accept the decision", async () => {
    await acknowledgeTimeCorrection(worker, "correction-1", { accepted: true });

    expect(mocks.transaction.timeCorrectionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { employeeAcknowledgedAt: expect.any(Date) } })
    );
    expect(auditActions()).toEqual(["time_correction.acknowledged"]);
  });

  it("records a disagreement as a dispute with its reason, rather than closing it silently", async () => {
    await acknowledgeTimeCorrection(worker, "correction-1", {
      accepted: false,
      disagreementReason: "I arrived at 07:00, not 07:20 as recorded here.",
    });

    expect(mocks.transaction.timeCorrectionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DISPUTED" }),
      })
    );
    expect(auditActions()).toEqual(["time_correction.disputed"]);
  });

  it("cannot be done before the company has reviewed, or by anyone else", async () => {
    mocks.transaction.timeCorrectionRequest.findFirst.mockResolvedValue({
      id: "correction-1",
      companyId: "company-1",
      employeeId: "employee-1",
      status: "PENDING",
      companyReviewedAt: null,
    });
    await expect(
      acknowledgeTimeCorrection(worker, "correction-1", { accepted: true })
    ).rejects.toThrow(/has not reviewed the request/);

    await expect(
      acknowledgeTimeCorrection(manager, "correction-1", { accepted: true })
    ).rejects.toThrow(/Only the affected person/);
  });
});

describe("reading the record", () => {
  it("scopes corrections to the caller's own company", async () => {
    await listTimeCorrections(manager);
    expect(mocks.prisma.timeCorrectionRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: "company-1" }) })
    );
  });

  it("applies every incident filter and puts the most severe first", async () => {
    await listIncidents(manager, {
      dateFrom: new Date("2026-08-01T00:00:00Z"),
      dateTo: new Date("2026-09-01T00:00:00Z"),
      worksiteId: "worksite-1",
      employeeId: "employee-1",
      severity: "HIGH",
      status: "OPEN",
      ownerId: "UNASSIGNED",
    });

    expect(mocks.prisma.attendanceIncident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company-1",
          worksiteId: "worksite-1",
          employeeId: "employee-1",
          severity: "HIGH",
          status: "OPEN",
          ownerId: null,
        }),
        orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
      })
    );
  });

  it("keeps the incident inbox away from field workers", async () => {
    await expect(listIncidents(worker)).rejects.toThrow(/cannot view the incident inbox/);
  });
});
