import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transaction = {
    clockEvent: { findUnique: vi.fn(), create: vi.fn() },
    plannedShift: { findFirst: vi.fn(), update: vi.fn() },
    attendanceIncident: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    company: { findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  };
  return { prisma, transaction };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import { recordClockEvent, updateAttendanceIncident, type WiaActor } from "@/lib/wia-control/service";

const manager: WiaActor = { companyId: "company-1", userId: "user-manager", role: "MANAGER" };
const worker: WiaActor = {
  companyId: "company-1",
  userId: "user-worker",
  role: "EMPLOYEE",
  employeeId: "employee-1",
};

const worksite = {
  id: "worksite-1",
  latitude: 40.4168,
  longitude: -3.7038,
  radiusMeters: 100,
};

function shift(overrides: Record<string, unknown> = {}) {
  return {
    id: "shift-1",
    companyId: "company-1",
    employeeId: "employee-1",
    worksiteId: "worksite-1",
    status: "PLANNED",
    scheduledStart: new Date("2026-08-20T07:00:00Z"),
    scheduledEnd: new Date("2026-08-20T11:00:00Z"),
    gracePeriodMinutes: 5,
    worksite,
    clockEvents: [],
    ...overrides,
  };
}

function command(overrides: Record<string, unknown> = {}) {
  return {
    shiftId: "shift-1",
    type: "CLOCK_IN",
    method: "MOBILE",
    occurredAt: "2026-08-20T07:00:00.000Z",
    idempotencyKey: "device-key-1",
    latitude: 40.4168,
    longitude: -3.7038,
    accuracyMeters: 10,
    isOffline: false,
    ...overrides,
  };
}

function createdIncidents() {
  return mocks.transaction.attendanceIncident.create.mock.calls.map(
    (call) => (call[0] as { data: { type: string; severity: string } }).data
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // The server now bounds how far a device-supplied time may sit from its own
  // clock, so these fixtures need a fixed "now" to sit inside.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-20T08:00:00Z"));
  mocks.transaction.clockEvent.findUnique.mockResolvedValue(null);
  mocks.transaction.plannedShift.findFirst.mockResolvedValue(shift());
  mocks.transaction.clockEvent.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "event-1",
    ...data,
  }));
  mocks.transaction.plannedShift.update.mockResolvedValue({ id: "shift-1" });
  mocks.transaction.company.findUnique.mockResolvedValue({
    lateSeverityThresholdMinutes: 30,
    incidentDueMinutesCritical: 60,
    incidentDueMinutesHigh: 240,
    incidentDueMinutesMedium: 1_440,
    incidentDueMinutesLow: 4_320,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("recording a clock event", () => {
  it("writes the event, moves the shift on, and chains the integrity hash", async () => {
    const result = await recordClockEvent(worker, command());

    expect(result.created).toBe(true);
    const written = mocks.transaction.clockEvent.create.mock.calls[0][0] as {
      data: { locationVerified: boolean; integrityHash: string; previousEventHash?: string };
    };
    expect(written.data.locationVerified).toBe(true);
    expect(written.data.integrityHash).toHaveLength(64);
    expect(written.data.previousEventHash).toBeUndefined();
    expect(mocks.transaction.plannedShift.update).toHaveBeenCalledWith({
      where: { id: "shift-1" },
      data: { status: "ACTIVE" },
    });
    expect(createdIncidents()).toEqual([]);
  });

  it("returns the existing event for a repeated idempotency key, without writing again", async () => {
    const stored = { id: "event-1", type: "CLOCK_IN", shiftId: "shift-1", employeeId: "employee-1" };
    mocks.transaction.clockEvent.findUnique.mockResolvedValue(stored);

    const result = await recordClockEvent(worker, command());

    expect(result).toEqual({ event: stored, created: false });
    expect(mocks.transaction.clockEvent.create).not.toHaveBeenCalled();
    expect(mocks.transaction.plannedShift.update).not.toHaveBeenCalled();
  });

  it("does not hand somebody else's event to whoever replays their key", async () => {
    mocks.transaction.clockEvent.findUnique.mockResolvedValue({
      id: "event-1",
      type: "CLOCK_IN",
      shiftId: "shift-1",
      employeeId: "employee-2",
    });

    await expect(recordClockEvent(worker, command())).rejects.toThrow(
      /only clock into your own shifts/
    );
  });

  it("refuses a key already used for a different action instead of pretending it replayed", async () => {
    mocks.transaction.clockEvent.findUnique.mockResolvedValue({
      id: "event-1",
      type: "CLOCK_IN",
      shiftId: "shift-other",
      employeeId: "employee-1",
    });

    await expect(recordClockEvent(worker, command())).rejects.toThrow(/already used for a different/);
  });

  it("refuses a time in the future or older than the offline queue's own expiry", async () => {
    await expect(
      recordClockEvent(worker, command({ occurredAt: "2026-08-20T09:00:00.000Z" }))
    ).rejects.toThrow(/cannot be recorded in the future/);

    await expect(
      recordClockEvent(worker, command({ occurredAt: "2026-08-18T07:00:00.000Z" }))
    ).rejects.toThrow(/cannot be submitted as a new event/);

    expect(mocks.transaction.clockEvent.create).not.toHaveBeenCalled();
  });

  it("accepts a genuinely queued offline clock from earlier the same day", async () => {
    await expect(
      recordClockEvent(worker, command({ occurredAt: "2026-08-20T07:00:00.000Z", isOffline: true }))
    ).resolves.toEqual(expect.objectContaining({ created: true }));
  });

  it("does not let a device widen the worksite radius with its own accuracy claim", async () => {
    // 20km away, claiming 10km of imprecision. Previously the tolerance was
    // added to the radius unbounded, so this verified.
    await recordClockEvent(
      worker,
      command({ latitude: 40.6, longitude: -3.7, accuracyMeters: 10_000 })
    );

    expect(
      (mocks.transaction.clockEvent.create.mock.calls[0][0] as { data: { locationVerified: boolean } })
        .data.locationVerified
    ).toBe(false);
    expect(createdIncidents()).toEqual([expect.objectContaining({ type: "OUTSIDE_LOCATION" })]);
  });

  it("links each event to the previous one, so the chain can be checked later", async () => {
    mocks.transaction.plannedShift.findFirst.mockResolvedValue(
      shift({
        status: "ACTIVE",
        clockEvents: [{ type: "CLOCK_IN", integrityHash: "a".repeat(64) }],
      })
    );

    await recordClockEvent(worker, command({ type: "CLOCK_OUT", occurredAt: "2026-08-20T07:59:00.000Z", idempotencyKey: "device-key-2" }));

    const written = mocks.transaction.clockEvent.create.mock.calls[0][0] as {
      data: { previousEventHash: string };
    };
    expect(written.data.previousEventHash).toBe("a".repeat(64));
  });

  it("opens a late incident when the arrival is past the grace period, and keeps the event valid", async () => {
    await recordClockEvent(worker, command({ occurredAt: "2026-08-20T07:45:00.000Z" }));

    expect(mocks.transaction.clockEvent.create).toHaveBeenCalled();
    expect(createdIncidents()).toEqual([
      expect.objectContaining({ type: "LATE", status: "OPEN", severity: "HIGH" }),
    ]);
  });

  it("opens an outside-location incident when the position fails the check", async () => {
    await recordClockEvent(worker, command({ latitude: 41.5, longitude: -3.7 }));

    const written = mocks.transaction.clockEvent.create.mock.calls[0][0] as {
      data: { locationVerified: boolean };
    };
    expect(written.data.locationVerified).toBe(false);
    expect(createdIncidents()).toEqual([expect.objectContaining({ type: "OUTSIDE_LOCATION" })]);
  });

  it("accepts a worksite with no coordinates only through a method that proves presence another way", async () => {
    mocks.transaction.plannedShift.findFirst.mockResolvedValue(
      shift({ worksite: { ...worksite, latitude: null, longitude: null } })
    );

    await recordClockEvent(worker, command({ method: "QR" }));
    expect(
      (mocks.transaction.clockEvent.create.mock.calls[0][0] as { data: { locationVerified: boolean } }).data
        .locationVerified
    ).toBe(true);

    vi.clearAllMocks();
    mocks.transaction.clockEvent.findUnique.mockResolvedValue(null);
    mocks.transaction.plannedShift.findFirst.mockResolvedValue(
      shift({ worksite: { ...worksite, latitude: null, longitude: null } })
    );
    mocks.transaction.clockEvent.create.mockResolvedValue({ id: "event-2" });

    await recordClockEvent(worker, command({ method: "MOBILE", idempotencyKey: "device-key-3" }));
    expect(
      (mocks.transaction.clockEvent.create.mock.calls[0][0] as { data: { locationVerified: boolean } }).data
        .locationVerified
    ).toBe(false);
    // No coordinates means no location claim to contradict, so no incident.
    expect(createdIncidents()).toEqual([]);
  });

  it("refuses a clock into somebody else's shift, an unassigned shift, and a closed one", async () => {
    await expect(
      recordClockEvent({ ...worker, employeeId: "employee-2" }, command())
    ).rejects.toThrow(/only clock into your own shifts/);

    mocks.transaction.plannedShift.findFirst.mockResolvedValue(shift({ employeeId: null }));
    await expect(recordClockEvent(worker, command())).rejects.toThrow(/does not yet have an assigned person/);

    mocks.transaction.plannedShift.findFirst.mockResolvedValue(shift({ status: "COMPLETED" }));
    await expect(recordClockEvent(worker, command())).rejects.toThrow(/already closed/);

    mocks.transaction.plannedShift.findFirst.mockResolvedValue(null);
    await expect(recordClockEvent(worker, command())).rejects.toThrow(/does not belong to the company/);

    expect(mocks.transaction.clockEvent.create).not.toHaveBeenCalled();
  });

  it("does not let a coordinator manufacture attendance for a field worker", async () => {
    await expect(recordClockEvent(manager, command())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.transaction.clockEvent.create).not.toHaveBeenCalled();
  });

  it("refuses a sequence that cannot happen, such as clocking out twice", async () => {
    mocks.transaction.plannedShift.findFirst.mockResolvedValue(
      shift({ status: "COVERED", clockEvents: [{ type: "CLOCK_OUT", integrityHash: "b".repeat(64) }] })
    );

    await expect(
      recordClockEvent(worker, command({ type: "CLOCK_OUT", idempotencyKey: "device-key-4" }))
    ).rejects.toThrow();
    expect(mocks.transaction.clockEvent.create).not.toHaveBeenCalled();
  });
});

describe("working an incident", () => {
  beforeEach(() => {
    mocks.transaction.attendanceIncident.findFirst.mockResolvedValue({
      id: "incident-1",
      companyId: "company-1",
      status: "OPEN",
      severity: "MEDIUM",
      shiftId: "shift-1",
    });
    mocks.transaction.attendanceIncident.update.mockResolvedValue({ id: "incident-1" });
    mocks.transaction.user.findFirst.mockResolvedValue({ id: "user-manager" });
  });

  it("assigns ownership to the caller when no owner is named", async () => {
    await updateAttendanceIncident(manager, "incident-1", { action: "ASSIGN" });

    expect(mocks.transaction.attendanceIncident.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ownerId: "user-manager" } })
    );
    expect(mocks.transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "attendance_incident.assigned" }),
      })
    );
  });

  it("refuses an owner who is not a coordinator in this company", async () => {
    mocks.transaction.user.findFirst.mockResolvedValue(null);

    await expect(
      updateAttendanceIncident(manager, "incident-1", { action: "ASSIGN", ownerId: "user-outsider" })
    ).rejects.toThrow(/not a coordinator in this company/);
    expect(mocks.transaction.attendanceIncident.update).not.toHaveBeenCalled();
  });

  it("escalates one step at a time and records the reason", async () => {
    await updateAttendanceIncident(manager, "incident-1", {
      action: "ESCALATE",
      note: "The customer has called twice about this.",
    });

    expect(mocks.transaction.attendanceIncident.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { severity: "HIGH" } })
    );
  });

  it("refuses to touch an incident that is already closed, and refuses a field worker", async () => {
    mocks.transaction.attendanceIncident.findFirst.mockResolvedValue({
      id: "incident-1",
      companyId: "company-1",
      status: "RESOLVED",
      severity: "MEDIUM",
    });
    await expect(
      updateAttendanceIncident(manager, "incident-1", { action: "ASSIGN" })
    ).rejects.toThrow(/already closed/);

    await expect(
      updateAttendanceIncident(worker, "incident-1", { action: "ASSIGN" })
    ).rejects.toThrow(/cannot close operational incidents/);
  });
});
