import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getZonedDateString, getZonedDayRange } from "@/lib/utils";
import {
  assertClockTransition,
  clockCommandSchema,
  companySettingsSchema,
  computeIncidentDueAt,
  computeIncidentSeverity,
  correctionAcknowledgementSchema,
  correctionRequestSchema,
  correctionReviewSchema,
  coverageDecisionSchema,
  coverageRecommendationSchema,
  DEFAULT_INCIDENT_POLICY,
  escalateSeverity,
  evaluateCoverageEligibility,
  getShiftStatusAfterClock,
  isLocationWithinWorksite,
  incidentUpdateSchema,
  lateMinutes,
  parseEmployeeAvailability,
  plannedShiftInputSchema,
  plannedShiftUpdateSchema,
  rangesOverlap,
  scoreCoverageCandidate,
  WiaDomainError,
  worksiteInputSchema,
  worksiteUpdateSchema,
  type ClockEventType,
  type IncidentPolicy,
} from "@/lib/wia-control/domain";

export type WiaActor = {
  companyId: string;
  userId?: string;
  employeeId?: string;
  role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE";
};

function assertCompany(actor: WiaActor) {
  if (!actor.companyId) {
    throw new WiaDomainError("COMPANY_REQUIRED", "The operation requires an active company.");
  }
}

function employeeDisplayName(employee: { user: { firstName: string; lastName: string } } | null) {
  return employee ? `${employee.user.firstName} ${employee.user.lastName}`.trim() : undefined;
}

/**
 * Reads a company's configured timezone for display purposes. Falls back
 * to UTC if, for any reason, it can't be read — never throws, since a
 * missing timezone should degrade display, not break the page.
 */
export async function getCompanyTimezone(companyId: string): Promise<string> {
  const company = await getPrisma().company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone ?? "UTC";
}

export async function listControlDay(actor: WiaActor, date: Date | string) {
  assertCompany(actor);
  const timeZone = await getCompanyTimezone(actor.companyId);
  const localDate = typeof date === "string" ? date : getZonedDateString(date, timeZone);
  const { start: dayStart, end: dayEnd } = getZonedDayRange(localDate, timeZone);

  const shifts = await getPrisma().plannedShift.findMany({
    where: {
      companyId: actor.companyId,
      scheduledStart: { gte: dayStart, lt: dayEnd },
      ...(actor.role === "EMPLOYEE" ? { employeeId: actor.employeeId ?? "__missing_employee__" } : {}),
    },
    orderBy: { scheduledStart: "asc" },
    include: {
      worksite: true,
      employee: { include: { user: true } },
      clockEvents: { orderBy: { occurredAt: "asc" } },
      incidents: {
        orderBy: { detectedAt: "desc" },
        include: {
          recommendedEmployee: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      coverageDecisions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return shifts.map((shift) => ({
    id: shift.id,
    title: shift.title,
    status: shift.status,
    startsAt: shift.scheduledStart.toISOString(),
    endsAt: shift.scheduledEnd.toISOString(),
    requiredSkills: shift.requiredSkills,
    gracePeriodMinutes: shift.gracePeriodMinutes,
    employee: shift.employee
      ? { id: shift.employee.id, name: employeeDisplayName(shift.employee) ?? "Employee" }
      : null,
    worksite: {
      id: shift.worksite.id,
      name: shift.worksite.name,
      address: shift.worksite.address,
      city: shift.worksite.city,
      verificationMode: shift.worksite.verificationMode,
    },
    clockEvents: shift.clockEvents.map((event) => ({
      id: event.id,
      type: event.type,
      method: event.method,
      occurredAt: event.occurredAt.toISOString(),
      recordedAt: event.recordedAt.toISOString(),
      locationVerified: event.locationVerified,
    })),
    incidents: shift.incidents.map((incident) => ({
      id: incident.id,
      type: incident.type,
      status: incident.status,
      severity: incident.severity,
      dueAt: incident.dueAt?.toISOString(),
      ownerId: incident.ownerId ?? undefined,
      ownerName: incident.owner
        ? `${incident.owner.firstName} ${incident.owner.lastName}`.trim()
        : undefined,
      title: incident.title,
      detail: incident.detail,
      detectedAt: incident.detectedAt.toISOString(),
      recommendedEmployee: employeeDisplayName(incident.recommendedEmployee),
    })),
    latestCoverageDecision: shift.coverageDecisions[0]
      ? {
        type: shift.coverageDecisions[0].type,
        selectedEmployeeId: shift.coverageDecisions[0].selectedEmployeeId,
        createdAt: shift.coverageDecisions[0].createdAt.toISOString(),
      }
      : null,
  }));
}

export async function listWorksites(actor: WiaActor) {
  assertCompany(actor);
  return getPrisma().worksite.findMany({
    where: { companyId: actor.companyId, isActive: true },
    orderBy: [{ city: "asc" }, { name: "asc" }],
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { shifts: true, incidents: true } },
    },
  });
}

export type IncidentListFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  worksiteId?: string;
  employeeId?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** A specific user id, "UNASSIGNED" for no owner, or omitted for any. */
  ownerId?: string;
  status?: "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
};

/**
 * The Stage 3 incident inbox query: every field a coordinator needs to
 * filter by (date, worksite, employee, severity, owner, status), scoped to
 * the caller's company. Deliberately not bound to "today" like the
 * day-view — an incident from three days ago that is still open should
 * remain visible until someone resolves it.
 */
export async function listIncidents(actor: WiaActor, filters: IncidentListFilters = {}) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot view the incident inbox.");
  }

  return getPrisma().attendanceIncident.findMany({
    where: {
      companyId: actor.companyId,
      ...(filters.dateFrom || filters.dateTo
        ? {
          detectedAt: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lt: filters.dateTo } : {}),
          },
        }
        : {}),
      ...(filters.worksiteId ? { worksiteId: filters.worksiteId } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.ownerId === "UNASSIGNED"
        ? { ownerId: null }
        : filters.ownerId
          ? { ownerId: filters.ownerId }
          : {}),
    },
    // Enum declaration order is LOW < MEDIUM < HIGH < CRITICAL, so a
    // descending sort surfaces the most severe incidents first.
    orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
    include: {
      shift: { select: { id: true, title: true } },
      employee: { include: { user: { select: { firstName: true, lastName: true } } } },
      worksite: { select: { id: true, name: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function listEmployees(actor: WiaActor) {
  assertCompany(actor);
  return getPrisma().employee.findMany({
    where: {
      companyId: actor.companyId,
      ...(actor.role === "EMPLOYEE" ? { id: actor.employeeId ?? "__missing_employee__" } : {}),
    },
    select: {
      id: true,
      fieldStatus: true,
      availability: true,
      skills: true,
      zones: true,
      performanceScore: true,
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { user: { firstName: "asc" } },
  });
}

export async function createWorksite(actor: WiaActor, input: unknown) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot create worksites.");
  }
  const payload = worksiteInputSchema.parse(input);

  if (payload.customerId) {
    const customer = await getPrisma().customer.findFirst({
      where: { id: payload.customerId, companyId: actor.companyId },
      select: { id: true },
    });
    if (!customer) {
      throw new WiaDomainError("CUSTOMER_NOT_FOUND", "The customer does not belong to the company.");
    }
  }

  return getPrisma().worksite.create({
    data: { ...payload, companyId: actor.companyId },
  });
}

export async function updateWorksite(actor: WiaActor, worksiteId: string, input: unknown) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot modify worksites.");
  }
  const payload = worksiteUpdateSchema.parse(input);

  return getPrisma().$transaction(async (transaction) => {
    const worksite = await transaction.worksite.findFirst({
      where: { id: worksiteId, companyId: actor.companyId },
      select: { id: true, isActive: true },
    });
    if (!worksite) {
      throw new WiaDomainError("WORKSITE_NOT_FOUND", "The worksite does not belong to the company.");
    }

    if (payload.customerId) {
      const customer = await transaction.customer.findFirst({
        where: { id: payload.customerId, companyId: actor.companyId },
        select: { id: true },
      });
      if (!customer) {
        throw new WiaDomainError("CUSTOMER_NOT_FOUND", "The customer does not belong to the company.");
      }
    }

    if (payload.isActive === false && worksite.isActive) {
      const openShifts = await transaction.plannedShift.count({
        where: {
          companyId: actor.companyId,
          worksiteId,
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
      });
      if (openShifts > 0) {
        throw new WiaDomainError(
          "WORKSITE_HAS_OPEN_SHIFTS",
          "Cancel or reassign open shifts before archiving the worksite."
        );
      }
    }

    const updated = await transaction.worksite.update({
      where: { id: worksiteId },
      data: payload,
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: payload.isActive === false ? "worksite.archived" : "worksite.updated",
        entity: "Worksite",
        entityId: worksiteId,
        metadata: payload,
      },
    });
    return updated;
  });
}

export async function createPlannedShift(actor: WiaActor, input: unknown) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot create shifts.");
  }
  const payload = plannedShiftInputSchema.parse(input);
  const scheduledStart = new Date(payload.scheduledStart);
  const scheduledEnd = new Date(payload.scheduledEnd);

  return getPrisma().$transaction(async (transaction) => {
    const worksite = await transaction.worksite.findFirst({
      where: { id: payload.worksiteId, companyId: actor.companyId, isActive: true },
      select: { id: true },
    });
    if (!worksite) {
      throw new WiaDomainError("WORKSITE_NOT_FOUND", "The worksite does not belong to the company or is inactive.");
    }

    if (payload.employeeId) {
      const employee = await transaction.employee.findFirst({
        where: { id: payload.employeeId, companyId: actor.companyId },
        select: { id: true, fieldStatus: true },
      });
      if (!employee || ["VACATION", "SICK_LEAVE", "INACTIVE"].includes(employee.fieldStatus)) {
        throw new WiaDomainError("EMPLOYEE_UNAVAILABLE", "The selected person is unavailable.");
      }

      const possibleConflicts = await transaction.plannedShift.findMany({
        where: {
          companyId: actor.companyId,
          employeeId: payload.employeeId,
          status: { notIn: ["CANCELLED", "COMPLETED"] },
          scheduledStart: { lt: scheduledEnd },
          scheduledEnd: { gt: scheduledStart },
        },
        select: { scheduledStart: true, scheduledEnd: true },
      });
      if (
        possibleConflicts.some((shift) =>
          rangesOverlap(scheduledStart, scheduledEnd, shift.scheduledStart, shift.scheduledEnd)
        )
      ) {
        throw new WiaDomainError("SHIFT_OVERLAP", "The person already has another shift in that interval.");
      }
    }

    const shift = await transaction.plannedShift.create({
      data: {
        companyId: actor.companyId,
        worksiteId: payload.worksiteId,
        employeeId: payload.employeeId,
        serviceId: payload.serviceId,
        title: payload.title,
        scheduledStart,
        scheduledEnd,
        requiredSkills: payload.requiredSkills,
        gracePeriodMinutes: payload.gracePeriodMinutes,
        status: payload.employeeId ? "PLANNED" : "UNCOVERED",
      },
    });

    if (!payload.employeeId) {
      await transaction.attendanceIncident.create({
        data: {
          companyId: actor.companyId,
          shiftId: shift.id,
          worksiteId: payload.worksiteId,
          type: "MISSING_CLOCK_IN",
          status: "OPEN",
          title: "Uncovered shift",
          detail: "The shift was created without an assigned person.",
        },
      });
    }

    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "planned_shift.created",
        entity: "PlannedShift",
        entityId: shift.id,
        metadata: { employeeId: payload.employeeId ?? null },
      },
    });

    return shift;
  });
}

export async function updatePlannedShift(actor: WiaActor, shiftId: string, input: unknown) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot modify shifts.");
  }
  const payload = plannedShiftUpdateSchema.parse(input);

  return getPrisma().$transaction(async (transaction) => {
    const shift = await transaction.plannedShift.findFirst({
      where: { id: shiftId, companyId: actor.companyId },
      include: { clockEvents: { select: { id: true }, take: 1 } },
    });
    if (!shift) {
      throw new WiaDomainError("SHIFT_NOT_FOUND", "The shift does not belong to the company.");
    }
    if (shift.status === "COMPLETED") {
      throw new WiaDomainError("SHIFT_CLOSED", "A completed shift cannot be modified.");
    }
    if (shift.clockEvents.length > 0 && payload.status !== "CANCELLED") {
      throw new WiaDomainError(
        "SHIFT_ALREADY_STARTED",
        "A shift with clock events can only be cancelled administratively."
      );
    }

    const scheduledStart = payload.scheduledStart
      ? new Date(payload.scheduledStart)
      : shift.scheduledStart;
    const scheduledEnd = payload.scheduledEnd ? new Date(payload.scheduledEnd) : shift.scheduledEnd;
    if (scheduledEnd <= scheduledStart) {
      throw new WiaDomainError(
        "INVALID_SHIFT_RANGE",
        "The end time must be later than the start time."
      );
    }

    const employeeId = payload.employeeId === undefined ? shift.employeeId : payload.employeeId;
    if (employeeId) {
      const employee = await transaction.employee.findFirst({
        where: { id: employeeId, companyId: actor.companyId },
        select: { id: true, fieldStatus: true },
      });
      if (!employee || ["VACATION", "SICK_LEAVE", "INACTIVE"].includes(employee.fieldStatus)) {
        throw new WiaDomainError("EMPLOYEE_UNAVAILABLE", "The selected person is unavailable.");
      }
      const conflicts = await transaction.plannedShift.findMany({
        where: {
          id: { not: shiftId },
          companyId: actor.companyId,
          employeeId,
          status: { notIn: ["CANCELLED", "COMPLETED"] },
          scheduledStart: { lt: scheduledEnd },
          scheduledEnd: { gt: scheduledStart },
        },
        select: { scheduledStart: true, scheduledEnd: true },
      });
      if (
        conflicts.some((candidate) =>
          rangesOverlap(scheduledStart, scheduledEnd, candidate.scheduledStart, candidate.scheduledEnd)
        )
      ) {
        throw new WiaDomainError("SHIFT_OVERLAP", "The person already has another shift in that interval.");
      }
    }

    const isCancelled = payload.status === "CANCELLED";
    const wasUncovered = shift.status === "UNCOVERED";
    const nextStatus = isCancelled
      ? "CANCELLED"
      : employeeId
        ? wasUncovered
          ? "COVERED"
          : "PLANNED"
        : "UNCOVERED";

    const updated = await transaction.plannedShift.update({
      where: { id: shiftId },
      data: {
        employeeId,
        title: payload.title,
        scheduledStart,
        scheduledEnd,
        requiredSkills: payload.requiredSkills,
        gracePeriodMinutes: payload.gracePeriodMinutes,
        status: nextStatus,
      },
    });

    if (isCancelled || employeeId) {
      await transaction.attendanceIncident.updateMany({
        where: { shiftId, companyId: actor.companyId, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        data: { status: isCancelled ? "DISMISSED" : "RESOLVED", resolvedAt: new Date() },
      });
    } else {
      const existingIncident = await transaction.attendanceIncident.findFirst({
        where: { shiftId, companyId: actor.companyId, type: "MISSING_CLOCK_IN" },
        select: { id: true },
      });
      if (existingIncident) {
        await transaction.attendanceIncident.update({
          where: { id: existingIncident.id },
          data: { status: "OPEN", resolvedAt: null },
        });
      } else {
        await transaction.attendanceIncident.create({
          data: {
            companyId: actor.companyId,
            shiftId,
            worksiteId: shift.worksiteId,
            type: "MISSING_CLOCK_IN",
            status: "OPEN",
            title: "Uncovered shift",
            detail: "The shift has no assigned person.",
          },
        });
      }
    }

    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: isCancelled ? "planned_shift.cancelled" : "planned_shift.updated",
        entity: "PlannedShift",
        entityId: shiftId,
        metadata: { ...payload, employeeId },
      },
    });
    return updated;
  });
}

function clockIntegrityHash(input: {
  companyId: string;
  shiftId: string;
  employeeId: string;
  type: ClockEventType;
  occurredAt: string;
  idempotencyKey: string;
  previousEventHash?: string | null;
}) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

/**
 * Loads a company's incident-policy thresholds (Stage 3). Falls back to
 * the documented defaults if, for any reason, the row can't be read —
 * detection must never fail just because a policy lookup failed.
 */
async function getIncidentPolicy(
  transaction: Prisma.TransactionClient,
  companyId: string
): Promise<IncidentPolicy> {
  const company = await transaction.company.findUnique({
    where: { id: companyId },
    select: {
      lateSeverityThresholdMinutes: true,
      incidentDueMinutesCritical: true,
      incidentDueMinutesHigh: true,
      incidentDueMinutesMedium: true,
      incidentDueMinutesLow: true,
    },
  });
  return company ?? DEFAULT_INCIDENT_POLICY;
}

export async function recordClockEvent(actor: WiaActor, input: unknown) {
  assertCompany(actor);
  const payload = clockCommandSchema.parse(input);

  return getPrisma().$transaction(async (transaction) => {
    const existing = await transaction.clockEvent.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId: actor.companyId,
          idempotencyKey: payload.idempotencyKey,
        },
      },
    });
    if (existing) return { event: existing, created: false };

    const shift = await transaction.plannedShift.findFirst({
      where: { id: payload.shiftId, companyId: actor.companyId },
      include: {
        worksite: true,
        clockEvents: { orderBy: { occurredAt: "desc" }, take: 1 },
      },
    });
    if (!shift) {
      throw new WiaDomainError("SHIFT_NOT_FOUND", "The shift does not belong to the company.");
    }
    if (!shift.employeeId) {
      throw new WiaDomainError("SHIFT_UNASSIGNED", "The shift does not yet have an assigned person.");
    }
    if (actor.role === "EMPLOYEE" && actor.employeeId !== shift.employeeId) {
      throw new WiaDomainError("FORBIDDEN", "You can only clock into your own shifts.");
    }
    if (["CANCELLED", "COMPLETED"].includes(shift.status)) {
      throw new WiaDomainError("SHIFT_CLOSED", "The shift is already closed.");
    }

    const previousEvent = shift.clockEvents[0];
    assertClockTransition(previousEvent?.type, payload.type);

    const hasWorksiteCoordinates = shift.worksite.latitude !== null && shift.worksite.longitude !== null;
    const locationVerified = hasWorksiteCoordinates
      ? isLocationWithinWorksite(
        {
          latitude: payload.latitude,
          longitude: payload.longitude,
          accuracyMeters: payload.accuracyMeters,
        },
        {
          latitude: Number(shift.worksite.latitude),
          longitude: Number(shift.worksite.longitude),
          radiusMeters: shift.worksite.radiusMeters,
        }
      )
      : ["QR", "PIN", "NFC", "KIOSK"].includes(payload.method);
    const integrityHash = clockIntegrityHash({
      companyId: actor.companyId,
      shiftId: shift.id,
      employeeId: shift.employeeId,
      type: payload.type,
      occurredAt: payload.occurredAt,
      idempotencyKey: payload.idempotencyKey,
      previousEventHash: previousEvent?.integrityHash,
    });

    const event = await transaction.clockEvent.create({
      data: {
        companyId: actor.companyId,
        shiftId: shift.id,
        employeeId: shift.employeeId,
        worksiteId: shift.worksiteId,
        type: payload.type,
        method: payload.method,
        occurredAt: new Date(payload.occurredAt),
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracyMeters: payload.accuracyMeters,
        locationVerified,
        isOffline: payload.isOffline,
        deviceId: payload.deviceId,
        idempotencyKey: payload.idempotencyKey,
        previousEventHash: previousEvent?.integrityHash,
        integrityHash,
      },
    });

    await transaction.plannedShift.update({
      where: { id: shift.id },
      data: { status: getShiftStatusAfterClock(payload.type) },
    });

    if (payload.type === "CLOCK_IN") {
      const minutes = lateMinutes(
        shift.scheduledStart,
        new Date(payload.occurredAt),
        shift.gracePeriodMinutes
      );
      if (minutes > 0) {
        const policy = await getIncidentPolicy(transaction, actor.companyId);
        const severity = computeIncidentSeverity("LATE", { lateMinutes: minutes, policy });
        const detectedAt = new Date(payload.occurredAt);
        await transaction.attendanceIncident.create({
          data: {
            companyId: actor.companyId,
            shiftId: shift.id,
            employeeId: shift.employeeId,
            worksiteId: shift.worksiteId,
            type: "LATE",
            status: "OPEN",
            severity,
            dueAt: computeIncidentDueAt(severity, detectedAt, policy),
            title: `Clock-in ${minutes} minutes late`,
            detail: "The clock event is valid and remains pending review.",
            detectedAt,
          },
        });
      }
    }

    if (hasWorksiteCoordinates && !locationVerified) {
      const policy = await getIncidentPolicy(transaction, actor.companyId);
      const severity = computeIncidentSeverity("OUTSIDE_LOCATION", { policy });
      const detectedAt = new Date(payload.occurredAt);
      await transaction.attendanceIncident.create({
        data: {
          companyId: actor.companyId,
          shiftId: shift.id,
          employeeId: shift.employeeId,
          worksiteId: shift.worksiteId,
          type: "OUTSIDE_LOCATION",
          status: "OPEN",
          severity,
          dueAt: computeIncidentDueAt(severity, detectedAt, policy),
          title: "Clock event outside the worksite",
          detail: "The reported position is outside the configured radius.",
          detectedAt,
        },
      });
    }

    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: `clock.${payload.type.toLowerCase()}`,
        entity: "ClockEvent",
        entityId: event.id,
        metadata: { shiftId: shift.id, locationVerified, idempotencyKey: payload.idempotencyKey },
      },
    });

    return { event, created: true };
  });
}

export async function requestTimeCorrection(actor: WiaActor, input: unknown) {
  assertCompany(actor);
  const payload = correctionRequestSchema.parse(input);

  return getPrisma().$transaction(async (transaction) => {
    const clockEvent = await transaction.clockEvent.findFirst({
      where: { id: payload.clockEventId, companyId: actor.companyId },
    });
    if (!clockEvent) {
      throw new WiaDomainError("CLOCK_EVENT_NOT_FOUND", "The clock event does not belong to the company.");
    }
    if (actor.role === "EMPLOYEE" && actor.employeeId !== clockEvent.employeeId) {
      throw new WiaDomainError("FORBIDDEN", "You can only correct your own clock events.");
    }

    const correction = await transaction.timeCorrectionRequest.create({
      data: {
        companyId: actor.companyId,
        clockEventId: clockEvent.id,
        employeeId: clockEvent.employeeId,
        proposedOccurredAt: new Date(payload.proposedOccurredAt),
        reason: payload.reason,
      },
    });

    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "time_correction.requested",
        entity: "TimeCorrectionRequest",
        entityId: correction.id,
        metadata: { clockEventId: clockEvent.id },
      },
    });

    return correction;
  });
}

export async function listTimeCorrections(actor: WiaActor) {
  assertCompany(actor);
  return getPrisma().timeCorrectionRequest.findMany({
    where: {
      companyId: actor.companyId,
      ...(actor.role === "EMPLOYEE" ? { employeeId: actor.employeeId ?? "__missing_employee__" } : {}),
    },
    include: {
      employee: { include: { user: { select: { firstName: true, lastName: true } } } },
      clockEvent: true,
      reviewedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function reviewTimeCorrection(
  actor: WiaActor,
  correctionId: string,
  input: unknown
) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot approve corrections.");
  }
  const payload = correctionReviewSchema.parse(input);

  return getPrisma().$transaction(async (transaction) => {
    const correction = await transaction.timeCorrectionRequest.findFirst({
      where: { id: correctionId, companyId: actor.companyId },
    });
    if (!correction) {
      throw new WiaDomainError("CORRECTION_NOT_FOUND", "The request does not belong to the company.");
    }
    if (correction.status !== "PENDING" && correction.status !== "DISPUTED") {
      throw new WiaDomainError("CORRECTION_CLOSED", "The request already has an active decision.");
    }

    const reviewed = await transaction.timeCorrectionRequest.update({
      where: { id: correction.id },
      data: {
        status: payload.status,
        reviewedByUserId: actor.userId,
        companyReviewedAt: new Date(),
        employeeAcknowledgedAt: null,
        disagreementReason: null,
      },
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: payload.status === "APPROVED" ? "time_correction.approved" : "time_correction.rejected",
        entity: "TimeCorrectionRequest",
        entityId: correction.id,
        metadata: { clockEventId: correction.clockEventId, note: payload.note },
      },
    });
    return reviewed;
  });
}

export async function acknowledgeTimeCorrection(
  actor: WiaActor,
  correctionId: string,
  input: unknown
) {
  assertCompany(actor);
  if (actor.role !== "EMPLOYEE" || !actor.employeeId) {
    throw new WiaDomainError("FORBIDDEN", "Only the affected person can confirm or disagree.");
  }
  const payload = correctionAcknowledgementSchema.parse(input);

  return getPrisma().$transaction(async (transaction) => {
    const correction = await transaction.timeCorrectionRequest.findFirst({
      where: {
        id: correctionId,
        companyId: actor.companyId,
        employeeId: actor.employeeId,
      },
    });
    if (!correction) {
      throw new WiaDomainError("CORRECTION_NOT_FOUND", "The request does not belong to the employee.");
    }
    if (!correction.companyReviewedAt || !["APPROVED", "REJECTED"].includes(correction.status)) {
      throw new WiaDomainError(
        "CORRECTION_NOT_REVIEWED",
        "The company has not reviewed the request yet."
      );
    }

    const acknowledged = await transaction.timeCorrectionRequest.update({
      where: { id: correction.id },
      data: payload.accepted
        ? { employeeAcknowledgedAt: new Date() }
        : { status: "DISPUTED", disagreementReason: payload.disagreementReason },
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: payload.accepted ? "time_correction.acknowledged" : "time_correction.disputed",
        entity: "TimeCorrectionRequest",
        entityId: correction.id,
        metadata: payload.accepted ? undefined : { reason: payload.disagreementReason },
      },
    });
    return acknowledged;
  });
}

export async function updateAttendanceIncident(
  actor: WiaActor,
  incidentId: string,
  input: unknown
) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot close operational incidents.");
  }
  const payload = incidentUpdateSchema.parse(input);

  return getPrisma().$transaction(async (transaction) => {
    const incident = await transaction.attendanceIncident.findFirst({
      where: { id: incidentId, companyId: actor.companyId },
    });
    if (!incident) {
      throw new WiaDomainError("INCIDENT_NOT_FOUND", "The incident does not belong to the company.");
    }
    if (["RESOLVED", "DISMISSED"].includes(incident.status)) {
      throw new WiaDomainError("INCIDENT_CLOSED", "The incident is already closed.");
    }

    if ("action" in payload && payload.action === "ASSIGN") {
      const targetOwnerId = payload.ownerId ?? actor.userId;
      if (!targetOwnerId) {
        throw new WiaDomainError(
          "OWNER_NOT_FOUND",
          "No owner could be determined for this assignment."
        );
      }
      const owner = await transaction.user.findFirst({
        where: {
          id: targetOwnerId,
          companyId: actor.companyId,
          role: { in: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
        },
      });
      if (!owner) {
        throw new WiaDomainError(
          "OWNER_NOT_FOUND",
          "The selected owner is not a coordinator in this company."
        );
      }
      const updated = await transaction.attendanceIncident.update({
        where: { id: incident.id },
        data: { ownerId: owner.id },
      });
      await transaction.auditLog.create({
        data: {
          companyId: actor.companyId,
          userId: actor.userId,
          action: "attendance_incident.assigned",
          entity: "AttendanceIncident",
          entityId: incident.id,
          metadata: { ownerId: owner.id },
        },
      });
      return updated;
    }

    if ("action" in payload && payload.action === "ESCALATE") {
      const nextSeverity = escalateSeverity(incident.severity);
      const updated = await transaction.attendanceIncident.update({
        where: { id: incident.id },
        data: { severity: nextSeverity },
      });
      await transaction.auditLog.create({
        data: {
          companyId: actor.companyId,
          userId: actor.userId,
          action: "attendance_incident.escalated",
          entity: "AttendanceIncident",
          entityId: incident.id,
          metadata: {
            note: payload.note,
            fromSeverity: incident.severity,
            toSeverity: nextSeverity,
          },
        },
      });
      return updated;
    }

    const closed = ["RESOLVED", "DISMISSED"].includes(payload.status);
    const updated = await transaction.attendanceIncident.update({
      where: { id: incident.id },
      data: {
        status: payload.status,
        acknowledgedAt: payload.status === "ACKNOWLEDGED" ? new Date() : incident.acknowledgedAt,
        resolvedAt: closed ? new Date() : null,
        resolutionNotes: payload.resolutionNotes,
      },
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: `attendance_incident.${payload.status.toLowerCase()}`,
        entity: "AttendanceIncident",
        entityId: incident.id,
        metadata: { resolutionNotes: payload.resolutionNotes },
      },
    });
    return updated;
  });
}

export async function detectIncompleteAttendance(actor: WiaActor, now = new Date()) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot run operational detection.");
  }

  return getPrisma().$transaction(async (transaction) => {
    const candidates = await transaction.plannedShift.findMany({
      where: {
        companyId: actor.companyId,
        scheduledEnd: { lt: now },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      include: {
        clockEvents: { orderBy: { occurredAt: "asc" } },
        incidents: { select: { type: true } },
      },
    });
    const created: string[] = [];
    const policy = await getIncidentPolicy(transaction, actor.companyId);

    for (const shift of candidates) {
      const eventTypes = new Set(shift.clockEvents.map((event) => event.type));
      const incidentType = eventTypes.has("CLOCK_IN")
        ? eventTypes.has("CLOCK_OUT")
          ? null
          : "INCOMPLETE_CLOCK"
        : "MISSING_CLOCK_IN";
      if (!incidentType || shift.incidents.some((incident) => incident.type === incidentType)) continue;

      const severity = computeIncidentSeverity(incidentType, { policy });
      try {
        const incident = await transaction.attendanceIncident.create({
          data: {
            companyId: actor.companyId,
            shiftId: shift.id,
            employeeId: shift.employeeId,
            worksiteId: shift.worksiteId,
            type: incidentType,
            status: "OPEN",
            severity,
            dueAt: computeIncidentDueAt(severity, now, policy),
            title: incidentType === "INCOMPLETE_CLOCK" ? "Shift missing clock-out" : "Shift missing clock-in",
            detail: "The shift has passed its end time and requires review.",
            detectedAt: now,
          },
        });
        created.push(incident.id);
      } catch (error) {
        // The database unique key is the source of truth when two cron runs
        // inspect the same shift concurrently. The other run created it first.
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) {
          throw error;
        }
      }
    }

    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "attendance_incident.detection_completed",
        entity: "Company",
        entityId: actor.companyId,
        metadata: { detectedAt: now.toISOString(), created: created.length },
      },
    });
    return { inspected: candidates.length, created: created.length, incidentIds: created };
  });
}

/**
 * Stage 3, Task 5: runs detection for every company, one at a time. This
 * is what the scheduled cron job calls — a human coordinator never needs
 * to remember to click "detect" manually. Each company's run is
 * independent and duplicate-safe (see `detectIncompleteAttendance`), so a
 * failure in one company does not stop the others.
 */
export async function detectIncompleteAttendanceForAllCompanies(now = new Date()) {
  const companies = await getPrisma().company.findMany({ select: { id: true } });
  const results: Array<{ companyId: string; inspected: number; created: number; error?: string }> = [];

  for (const company of companies) {
    const systemActor: WiaActor = { companyId: company.id, role: "SUPER_ADMIN" };
    try {
      const result = await detectIncompleteAttendance(systemActor, now);
      results.push({ companyId: company.id, inspected: result.inspected, created: result.created });
    } catch (error) {
      results.push({
        companyId: company.id,
        inspected: 0,
        created: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

export async function exportClockEvents(actor: WiaActor, from: Date, to: Date) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot export the full record.");
  }
  if (to <= from) {
    throw new WiaDomainError("INVALID_EXPORT_RANGE", "The end must be later than the start.");
  }

  const events = await getPrisma().clockEvent.findMany({
    where: { companyId: actor.companyId, occurredAt: { gte: from, lt: to } },
    include: {
      employee: { include: { user: { select: { firstName: true, lastName: true } } } },
      worksite: { select: { name: true, city: true } },
    },
    orderBy: { occurredAt: "asc" },
  });
  await getPrisma().auditLog.create({
    data: {
      companyId: actor.companyId,
      userId: actor.userId,
      action: "clock_report.exported",
      entity: "Company",
      entityId: actor.companyId,
      metadata: { from: from.toISOString(), to: to.toISOString(), rows: events.length },
    },
  });
  return events;
}

export async function confirmCoverage(actor: WiaActor, input: unknown) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot confirm coverage.");
  }
  const payload = coverageDecisionSchema.parse(input);

  return getPrisma().$transaction(async (transaction) => {
    const incident = await transaction.attendanceIncident.findFirst({
      where: {
        id: payload.incidentId,
        shiftId: payload.shiftId,
        companyId: actor.companyId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      include: { shift: { include: { worksite: { select: { city: true } } } } },
    });
    if (!incident) {
      throw new WiaDomainError("INCIDENT_NOT_FOUND", "The incident is no longer open.");
    }

    const selectedEmployee = await transaction.employee.findFirst({
      where: { id: payload.selectedEmployeeId, companyId: actor.companyId },
    });
    if (!selectedEmployee) {
      throw new WiaDomainError("EMPLOYEE_UNAVAILABLE", "The selected person is unavailable.");
    }

    const company = await transaction.company.findUnique({
      where: { id: actor.companyId },
      select: { timezone: true },
    });
    const timeZone = company?.timezone ?? "UTC";
    const { start: dayStart, end: dayEnd } = getZonedDayRange(
      getZonedDateString(incident.shift.scheduledStart, timeZone),
      timeZone
    );
    const dayShifts = await transaction.plannedShift.findMany({
      where: {
        companyId: actor.companyId,
        employeeId: selectedEmployee.id,
        id: { not: incident.shiftId },
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        scheduledStart: { lt: dayEnd },
        scheduledEnd: { gt: dayStart },
      },
      select: { scheduledStart: true, scheduledEnd: true },
    });
    const hasOverlap = dayShifts.some((shift) =>
      rangesOverlap(
        incident.shift.scheduledStart,
        incident.shift.scheduledEnd,
        shift.scheduledStart,
        shift.scheduledEnd
      )
    );
    const existingDailyMinutes = dayShifts.reduce(
      (total, shift) => total + (shift.scheduledEnd.getTime() - shift.scheduledStart.getTime()) / 60_000,
      0
    );

    const eligibility = evaluateCoverageEligibility({
      fieldStatus: selectedEmployee.fieldStatus,
      hasOverlap,
      requiredSkills: incident.shift.requiredSkills,
      employeeSkills: selectedEmployee.skills,
      worksiteCity: incident.shift.worksite.city,
      employeeZones: selectedEmployee.zones,
      availability: parseEmployeeAvailability(selectedEmployee.availability),
      shiftStart: incident.shift.scheduledStart,
      shiftEnd: incident.shift.scheduledEnd,
      existingDailyMinutes,
      existingDailyJobs: dayShifts.length,
      maxHoursPerDay: selectedEmployee.maxHoursPerDay,
      maxJobsPerDay: selectedEmployee.maxJobsPerDay,
      timeZone,
    });
    if (!eligibility.eligible) {
      throw new WiaDomainError(
        hasOverlap ? "SHIFT_OVERLAP" : "EMPLOYEE_UNAVAILABLE",
        eligibility.reason
      );
    }

    const acceptedRecommendation = incident.recommendedEmployeeId === selectedEmployee.id;
    if (!acceptedRecommendation && !payload.overrideReason) {
      throw new WiaDomainError(
        "OVERRIDE_REASON_REQUIRED",
        "Explain why the WIA recommendation is being overridden."
      );
    }

    const decision = await transaction.coverageDecision.create({
      data: {
        companyId: actor.companyId,
        shiftId: incident.shiftId,
        incidentId: incident.id,
        recommendedEmployeeId: incident.recommendedEmployeeId,
        selectedEmployeeId: selectedEmployee.id,
        actorUserId: actor.userId,
        type: acceptedRecommendation ? "RECOMMENDATION_ACCEPTED" : "MANUAL_OVERRIDE",
        score: null,
        reasons: [],
        overrideReason: payload.overrideReason,
      },
    });

    await transaction.plannedShift.update({
      where: { id: incident.shiftId },
      data: { employeeId: selectedEmployee.id, status: "COVERED" },
    });
    await transaction.attendanceIncident.update({
      where: { id: incident.id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolutionNotes: acceptedRecommendation
          ? "WIA recommendation confirmed."
          : payload.overrideReason,
      },
    });
    await transaction.communicationOutbox.create({
      data: {
        companyId: actor.companyId,
        shiftId: incident.shiftId,
        recipientEmployeeId: selectedEmployee.id,
        channel: "IN_APP",
        template: "coverage_confirmed",
        payload: {
          shiftId: incident.shiftId,
          incidentId: incident.id,
          scheduledStart: incident.shift.scheduledStart.toISOString(),
          scheduledEnd: incident.shift.scheduledEnd.toISOString(),
        },
      },
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "coverage.confirmed",
        entity: "CoverageDecision",
        entityId: decision.id,
        metadata: {
          shiftId: incident.shiftId,
          incidentId: incident.id,
          selectedEmployeeId: selectedEmployee.id,
        },
      },
    });

    return decision;
  });
}

export async function recommendCoverageCandidates(actor: WiaActor, input: unknown) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot generate coverage recommendations.");
  }
  const payload = coverageRecommendationSchema.parse(input);

  return getPrisma().$transaction(async (transaction) => {
    const incident = await transaction.attendanceIncident.findFirst({
      where: {
        id: payload.incidentId,
        companyId: actor.companyId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      include: { shift: { include: { worksite: true } } },
    });
    if (!incident) {
      throw new WiaDomainError("INCIDENT_NOT_FOUND", "The incident is no longer open.");
    }

    const company = await transaction.company.findUnique({
      where: { id: actor.companyId },
      select: { timezone: true },
    });
    const timeZone = company?.timezone ?? "UTC";
    const { start: dayStart, end: dayEnd } = getZonedDayRange(
      getZonedDateString(incident.shift.scheduledStart, timeZone),
      timeZone
    );
    // Every employee in the company is considered here, not just those
    // already marked AVAILABLE/ASSIGNED — fieldStatus is one of several
    // hard constraints evaluated below, and an excluded employee still
    // needs a reason shown, not a silent drop before scoring even starts.
    const employees = await transaction.employee.findMany({
      where: {
        companyId: actor.companyId,
        id: incident.employeeId ? { not: incident.employeeId } : undefined,
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        plannedShifts: {
          where: {
            status: { notIn: ["CANCELLED", "COMPLETED"] },
            scheduledStart: { lt: dayEnd },
            scheduledEnd: { gt: dayStart },
          },
          select: { scheduledStart: true, scheduledEnd: true },
        },
      },
    });

    const eligible: Array<{ employeeId: string; employeeName: string; score: number; reasons: string[] }> = [];
    const excluded: Array<{ employeeId: string; employeeName: string; reason: string }> = [];

    for (const employee of employees) {
      const employeeName = `${employee.user.firstName} ${employee.user.lastName}`.trim();
      const hasOverlap = employee.plannedShifts.some((shift) =>
        rangesOverlap(
          incident.shift.scheduledStart,
          incident.shift.scheduledEnd,
          shift.scheduledStart,
          shift.scheduledEnd
        )
      );
      const existingDailyMinutes = employee.plannedShifts.reduce(
        (total, shift) => total + (shift.scheduledEnd.getTime() - shift.scheduledStart.getTime()) / 60_000,
        0
      );

      const eligibility = evaluateCoverageEligibility({
        fieldStatus: employee.fieldStatus,
        hasOverlap,
        requiredSkills: incident.shift.requiredSkills,
        employeeSkills: employee.skills,
        worksiteCity: incident.shift.worksite.city,
        employeeZones: employee.zones,
        availability: parseEmployeeAvailability(employee.availability),
        shiftStart: incident.shift.scheduledStart,
        shiftEnd: incident.shift.scheduledEnd,
        existingDailyMinutes,
        existingDailyJobs: employee.plannedShifts.length,
        maxHoursPerDay: employee.maxHoursPerDay,
        maxJobsPerDay: employee.maxJobsPerDay,
        timeZone,
      });

      if (!eligibility.eligible) {
        excluded.push({ employeeId: employee.id, employeeName, reason: eligibility.reason });
        continue;
      }

      const result = scoreCoverageCandidate({
        requiredSkills: incident.shift.requiredSkills,
        worksiteCity: incident.shift.worksite.city,
        employeeSkills: employee.skills,
        employeeZones: employee.zones,
        dailyJobs: employee.plannedShifts.length,
      });
      eligible.push({
        employeeId: employee.id,
        employeeName,
        score: result.score,
        reasons: result.reasons,
      });
    }

    const candidates = [...eligible].sort((first, second) => second.score - first.score).slice(0, 5);

    const recommended = candidates[0] ?? null;
    if (recommended) {
      await transaction.attendanceIncident.update({
        where: { id: incident.id },
        data: { recommendedEmployeeId: recommended.employeeId, status: "ACKNOWLEDGED", acknowledgedAt: new Date() },
      });
    }
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "coverage.recommended",
        entity: "AttendanceIncident",
        entityId: incident.id,
        metadata: recommended
          ? {
            recommendedEmployeeId: recommended.employeeId,
            score: recommended.score,
            reasons: recommended.reasons,
            candidateCount: candidates.length,
            excludedCount: excluded.length,
          }
          : { recommendedEmployeeId: null, candidateCount: 0, excludedCount: excluded.length },
      },
    });
    return { incidentId: incident.id, shiftId: incident.shiftId, recommended, candidates, excluded };
  });
}

export async function listCommunicationOutbox(actor: WiaActor) {
  assertCompany(actor);
  return getPrisma().communicationOutbox.findMany({
    where: {
      companyId: actor.companyId,
      ...(actor.role === "EMPLOYEE"
        ? { recipientEmployeeId: actor.employeeId ?? "__missing_employee__" }
        : {}),
    },
    include: {
      recipientEmployee: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      shift: { select: { title: true, scheduledStart: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getCompanySettings(actor: WiaActor) {
  assertCompany(actor);
  const company = await getPrisma().company.findUnique({
    where: { id: actor.companyId },
    select: {
      id: true,
      name: true,
      timezone: true,
      clockRetentionYears: true,
      crmEnabled: true,
    },
  });
  if (!company) {
    throw new WiaDomainError("COMPANY_NOT_FOUND", "The company does not exist.");
  }
  return company;
}

export async function updateCompanySettings(actor: WiaActor, input: unknown) {
  assertCompany(actor);
  if (!actor.userId || !["SUPER_ADMIN", "ADMIN"].includes(actor.role)) {
    throw new WiaDomainError("FORBIDDEN", "Only administrators can change these policies.");
  }
  const payload = companySettingsSchema.parse(input);

  return getPrisma().$transaction(async (transaction) => {
    const updated = await transaction.company.update({
      where: { id: actor.companyId },
      data: payload,
      select: {
        id: true,
        name: true,
        timezone: true,
        clockRetentionYears: true,
        crmEnabled: true,
        lateSeverityThresholdMinutes: true,
        incidentDueMinutesCritical: true,
        incidentDueMinutesHigh: true,
        incidentDueMinutesMedium: true,
        incidentDueMinutesLow: true,
      },
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "company.clock_settings.updated",
        entity: "Company",
        entityId: actor.companyId,
        metadata: payload,
      },
    });
    return updated;
  });
}

export type WiaTransaction = Prisma.TransactionClient;
