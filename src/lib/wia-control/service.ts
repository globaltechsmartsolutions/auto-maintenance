import "server-only";

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { getPrisma } from "@/lib/prisma";
import { getZonedDateString, getZonedDayRange } from "@/lib/utils";
import { logEvent } from "@/lib/observability";
import {
  assertClockTimestamp,
  assertClockTransition,
  assertShiftWindow,
  clockCommandSchema,
  companySettingsSchema,
  computeIncidentDueAt,
  computeIncidentSeverity,
  distanceInMeters,
  computeNextCommunicationAttempt,
  correctionAcknowledgementSchema,
  correctionRequestSchema,
  correctionReviewSchema,
  coverageDecisionSchema,
  coverageRecommendationSchema,
  DEFAULT_INCIDENT_POLICY,
  employeeCreateSchema,
  employeeProfileUpdateSchema,
  escalateSeverity,
  evaluateCoverageEligibility,
  getShiftStatusAfterClock,
  hasExceededCommunicationAttempts,
  isLocationWithinWorksite,
  incidentUpdateSchema,
  lateMinutes,
  MAX_CORRECTION_DRIFT_HOURS,
  operationalServiceInputSchema,
  operationalServiceUpdateSchema,
  parseEmployeeAvailability,
  plannedShiftInputSchema,
  shiftCompletionSchema,
  plannedShiftUpdateSchema,
  rangesOverlap,
  scoreCoverageCandidate,
  WiaDomainError,
  worksiteInputSchema,
  worksiteUpdateSchema,
  type ClockEventType,
  type IncidentPolicy,
} from "@/lib/wia-control/domain";
import { deliverEmail, deliverInApp } from "@/lib/wia-control/communication-providers";
import { csvRecords, MAX_IMPORT_ROWS, previewCsvImport, type ImportKind } from "@/lib/wia-control/csv-import";
import { MAX_EXPORT_DAYS, MAX_EXPORT_ROWS } from "@/lib/wia-control/exports";
import { describeRecovery, type RecoveryFacts } from "@/lib/wia-control/recovery-queue";
import {
  activeCommunicationTemplate,
  communicationDedupeKey,
  renderCommunication,
  resolveCommunicationChannels,
  OUTBOX_LEASE_MINUTES,
  summariseCommunicationHealth,
  type CommunicationTemplateKey,
} from "@/lib/wia-control/communication-policy";

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
      // Overlap, not "starts today": a 23:00-02:00 shift is part of both days,
      // and a coordinator looking at the second one needs to see the person
      // who is on site right now.
      scheduledStart: { lt: dayEnd },
      scheduledEnd: { gt: dayStart },
      ...(actor.role === "EMPLOYEE" ? { employeeId: actor.employeeId ?? "__missing_employee__" } : {}),
    },
    orderBy: { scheduledStart: "asc" },
    include: {
      worksite: true,
      service: { include: { customer: { select: { id: true, name: true } } } },
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
    serviceId: shift.serviceId ?? undefined,
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
    service: shift.service
      ? {
        id: shift.service.id,
        title: shift.service.title,
        customerId: shift.service.customer.id,
        customerName: shift.service.customer.name,
      }
      : null,
    clockEvents: shift.clockEvents.map((event) => ({
      id: event.id,
      type: event.type,
      method: event.method,
      occurredAt: event.occurredAt.toISOString(),
      recordedAt: event.recordedAt.toISOString(),
      locationVerified: event.locationVerified,
      // What justified the decision, for the coordinator and for the worker
      // themselves - never the coordinate that produced it.
      distanceMeters: event.distanceMeters === null ? undefined : Number(event.distanceMeters),
      verifiedAgainstRadiusMeters: event.verifiedAgainstRadiusMeters ?? undefined,
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

/**
 * The worksites a caller may see, with the columns that caller actually needs.
 *
 * Selected explicitly rather than included wholesale: `qrSecretHash` is a
 * credential column, and an `include` would hand it to the browser the moment
 * QR verification is implemented. A field worker also gets neither the
 * coordinates nor the company-wide shift and incident counts — they need to
 * know where they are going, not how loaded every site in the company is.
 */
export async function listWorksites(actor: WiaActor) {
  assertCompany(actor);
  const where = {
    companyId: actor.companyId,
    isActive: true,
    ...(actor.role === "EMPLOYEE"
      ? { plannedShifts: { some: { employeeId: actor.employeeId ?? "__missing_employee__" } } }
      : {}),
  };
  const orderBy = [{ city: "asc" as const }, { name: "asc" as const }];
  const shared = {
    id: true,
    name: true,
    address: true,
    city: true,
    province: true,
    postalCode: true,
    radiusMeters: true,
    timezone: true,
    verificationMode: true,
    isActive: true,
    customer: { select: { id: true, name: true } },
  } as const;

  if (actor.role === "EMPLOYEE") {
    return getPrisma().worksite.findMany({ where, orderBy, select: shared });
  }

  return getPrisma().worksite.findMany({
    where,
    orderBy,
    select: {
      ...shared,
      latitude: true,
      longitude: true,
      _count: { select: { shifts: true, incidents: true } },
    },
  });
}

/**
 * Operational services are the commercial commitments that shifts fulfil.
 * Keeping them in the control domain lets WIAControl answer "was the client
 * service covered?", rather than only "did a person clock in?".
 */
export async function listOperationalServices(actor: WiaActor) {
  assertCompany(actor);
  return getPrisma().service.findMany({
    where: {
      companyId: actor.companyId,
      ...(actor.role === "EMPLOYEE"
        ? { plannedShifts: { some: { employeeId: actor.employeeId ?? "__missing_employee__" } } }
        : {}),
    },
    orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
    include: {
      customer: { select: { id: true, name: true } },
      plannedShifts: {
        // A field worker sees the services they are actually on, and within
        // them only their own shifts. Without this filter they would also see
        // every sibling shift of that service, which is the company register
        // by another route.
        ...(actor.role === "EMPLOYEE"
          ? { where: { employeeId: actor.employeeId ?? "__missing_employee__" } }
          : {}),
        select: {
          id: true,
          title: true,
          status: true,
          scheduledStart: true,
          scheduledEnd: true,
          worksite: { select: { id: true, name: true } },
          incidents: { select: { status: true, severity: true } },
        },
        orderBy: { scheduledStart: "asc" },
      },
    },
  });
}

export async function listOperationalCustomers(actor: WiaActor) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot view customers.");
  }
  return getPrisma().customer.findMany({
    where: { companyId: actor.companyId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
  });
}

export async function createOperationalService(actor: WiaActor, input: unknown) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot create services.");
  }
  const payload = operationalServiceInputSchema.parse(input);

  return getPrisma().$transaction((transaction) =>
    createOperationalServiceWithin(transaction, actor, payload)
  );
}

/**
 * The service creation itself, bound to a caller-provided transaction. Bulk
 * import reuses this so one rejected row rolls back the whole file instead of
 * leaving half a customer's commitments behind.
 */
async function createOperationalServiceWithin(
  transaction: WiaTransaction,
  actor: WiaActor,
  payload: ReturnType<typeof operationalServiceInputSchema.parse>
) {
  {
    const customer = await transaction.customer.findFirst({
      where: { id: payload.customerId, companyId: actor.companyId, status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    if (!customer) {
      throw new WiaDomainError("CUSTOMER_NOT_FOUND", "The customer does not belong to the company.");
    }

    const service = await transaction.service.create({
      data: {
        companyId: actor.companyId,
        customerId: customer.id,
        title: payload.title,
        description: payload.description,
        serviceType: payload.serviceType,
        recurrence: payload.recurrence,
        status: payload.scheduledStart ? "SCHEDULED" : "PENDING",
        scheduledStart: payload.scheduledStart ? new Date(payload.scheduledStart) : undefined,
        scheduledEnd: payload.scheduledEnd ? new Date(payload.scheduledEnd) : undefined,
        address: payload.address,
        city: payload.city,
        internalNotes: payload.internalNotes,
      },
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "operational_service.created",
        entity: "Service",
        entityId: service.id,
        metadata: { customerId: customer.id, recurrence: service.recurrence },
      },
    });
    return service;
  }
}

export async function updateOperationalService(actor: WiaActor, serviceId: string, input: unknown) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot update services.");
  }
  const payload = operationalServiceUpdateSchema.parse(input);

  return getPrisma().$transaction(async (transaction) => {
    const service = await transaction.service.findFirst({
      where: { id: serviceId, companyId: actor.companyId },
      select: { id: true, customerId: true, scheduledStart: true, scheduledEnd: true },
    });
    if (!service) {
      throw new WiaDomainError("SERVICE_NOT_FOUND", "The service does not belong to the company.");
    }
    if (payload.customerId && payload.customerId !== service.customerId) {
      const customer = await transaction.customer.findFirst({
        where: { id: payload.customerId, companyId: actor.companyId, status: { not: "ARCHIVED" } },
        select: { id: true },
      });
      if (!customer) {
        throw new WiaDomainError("CUSTOMER_NOT_FOUND", "The customer does not belong to the company.");
      }
      const conflictingWorksiteShifts = await transaction.plannedShift.count({
        where: {
          companyId: actor.companyId,
          serviceId: service.id,
          worksite: { customerId: { not: payload.customerId } },
        },
      });
      if (conflictingWorksiteShifts > 0) {
        throw new WiaDomainError(
          "SERVICE_CUSTOMER_CHANGE_CONFLICT",
          "This service has shifts at worksites for another customer. Create a new service instead."
        );
      }
    }
    const scheduledStart = payload.scheduledStart ? new Date(payload.scheduledStart) : service.scheduledStart;
    const scheduledEnd = payload.scheduledEnd ? new Date(payload.scheduledEnd) : service.scheduledEnd;
    if (scheduledStart && scheduledEnd && scheduledEnd <= scheduledStart) {
      throw new WiaDomainError("INVALID_SERVICE_RANGE", "The service end time must be later than its start time.");
    }
    const updated = await transaction.service.update({
      where: { id: service.id },
      data: {
        ...payload,
        scheduledStart,
        scheduledEnd,
      },
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "operational_service.updated",
        entity: "Service",
        entityId: service.id,
        metadata: payload,
      },
    });
    return updated;
  });
}

/**
 * Returns a tenant-scoped, read-only evidence timeline for one client service.
 * It deliberately derives risk from its shifts and incidents instead of changing
 * the commercial service status behind a coordinator's back.
 */
export async function getOperationalServiceDetail(actor: WiaActor, serviceId: string) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot view the company service register.");
  }

  const service = await getPrisma().service.findFirst({
    where: { id: serviceId, companyId: actor.companyId },
    include: {
      customer: { select: { id: true, name: true } },
      plannedShifts: {
        where: { companyId: actor.companyId },
        orderBy: { scheduledStart: "asc" },
        include: {
          worksite: { select: { id: true, name: true, city: true } },
          employee: { include: { user: { select: { firstName: true, lastName: true } } } },
          clockEvents: {
            orderBy: { occurredAt: "asc" },
            select: {
              id: true,
              type: true,
              method: true,
              occurredAt: true,
              recordedAt: true,
              locationVerified: true,
              distanceMeters: true,
              verifiedAgainstRadiusMeters: true,
              isOffline: true,
              integrityHash: true,
            },
          },
          incidents: { orderBy: { detectedAt: "asc" } },
          coverageDecisions: { orderBy: { createdAt: "asc" } },
          communications: { orderBy: { createdAt: "asc" } },
          completion: true,
        },
      },
    },
  });
  if (!service) throw new WiaDomainError("SERVICE_NOT_FOUND", "The service does not belong to the company.");

  const atRisk = service.plannedShifts.some((shift) =>
    shift.status === "UNCOVERED" || shift.incidents.some((incident) =>
      ["OPEN", "ACKNOWLEDGED"].includes(incident.status) && ["HIGH", "CRITICAL"].includes(incident.severity)
    )
  );

  return { ...service, atRisk };
}

/** Creates exactly one immutable service-delivery outcome for a shift. */
export async function completePlannedShift(actor: WiaActor, shiftId: string, input: unknown) {
  assertCompany(actor);
  const payload = shiftCompletionSchema.parse(input);
  return getPrisma().$transaction(async (transaction) => {
    const shift = await transaction.plannedShift.findFirst({
      where: {
        id: shiftId,
        companyId: actor.companyId,
        ...(actor.role === "EMPLOYEE" ? { employeeId: actor.employeeId ?? "__missing_employee__" } : {}),
      },
      select: { id: true, employeeId: true, status: true, serviceId: true },
    });
    if (!shift) throw new WiaDomainError("SHIFT_NOT_FOUND", "The shift does not belong to the company.");
    if (shift.status === "CANCELLED") throw new WiaDomainError("SHIFT_CANCELLED", "A cancelled shift cannot be completed.");

    const existing = await transaction.shiftCompletion.findFirst({ where: { shiftId: shift.id }, select: { id: true } });
    if (existing) throw new WiaDomainError("SHIFT_ALREADY_COMPLETED", "This shift already has an immutable completion record.");

    const completion = await transaction.shiftCompletion.create({
      data: {
        companyId: actor.companyId,
        shiftId: shift.id,
        employeeId: shift.employeeId,
        actorUserId: actor.userId,
        outcome: payload.outcome,
        checklist: payload.checklist,
        note: payload.note,
      },
    });
    await transaction.plannedShift.update({
      where: { id: shift.id },
      data: { status: payload.outcome === "COMPLETED" ? "COMPLETED" : "COVERED" },
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "shift.completion_recorded",
        entity: "ShiftCompletion",
        entityId: completion.id,
        metadata: { shiftId: shift.id, serviceId: shift.serviceId, outcome: payload.outcome },
      },
    });
    return completion;
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

export type RecoveryQueueFilters = {
  /** Narrows the queue to one client service commitment. */
  serviceId?: string;
  /** A specific coordinator, "UNASSIGNED" for no owner, or omitted for any. */
  ownerId?: string;
  worksiteId?: string;
  /** Includes closed incidents, for review rather than triage. */
  includeClosed?: boolean;
};

/**
 * The coordinator's triage queue: every service currently at risk, ordered by
 * what will hurt first, each row carrying its accountable owner, its due time,
 * and the single next human action.
 *
 * It reads the same incident records as the inbox — this is a different
 * question asked of the same facts, not a second source of truth.
 */
export async function listRecoveryQueue(
  actor: WiaActor,
  filters: RecoveryQueueFilters = {},
  now = new Date()
) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot view the recovery queue.");
  }

  const incidents = await getPrisma().attendanceIncident.findMany({
    where: {
      companyId: actor.companyId,
      ...(filters.includeClosed ? {} : { status: { in: ["OPEN", "ACKNOWLEDGED"] } }),
      ...(filters.worksiteId ? { worksiteId: filters.worksiteId } : {}),
      ...(filters.ownerId === "UNASSIGNED"
        ? { ownerId: null }
        : filters.ownerId
          ? { ownerId: filters.ownerId }
          : {}),
      ...(filters.serviceId ? { shift: { serviceId: filters.serviceId } } : {}),
    },
    select: {
      id: true,
      type: true,
      status: true,
      severity: true,
      title: true,
      detectedAt: true,
      dueAt: true,
      acknowledgedAt: true,
      ownerId: true,
      owner: { select: { id: true, firstName: true, lastName: true } },
      worksite: { select: { id: true, name: true } },
      employee: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      shift: {
        select: {
          id: true,
          title: true,
          status: true,
          employeeId: true,
          scheduledStart: true,
          scheduledEnd: true,
          service: {
            select: { id: true, title: true, customer: { select: { id: true, name: true } } },
          },
        },
      },
      coverageDecisions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          createdAt: true,
          selectedEmployeeId: true,
          selectedEmployee: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  });

  // One query for the acknowledgement state of the latest coverage message per
  // shift, rather than one per row.
  const shiftIds = incidents.map((incident) => incident.shift.id);
  const communications = shiftIds.length
    ? await getPrisma().communicationOutbox.findMany({
        where: { companyId: actor.companyId, shiftId: { in: shiftIds } },
        orderBy: { createdAt: "desc" },
        select: { shiftId: true, acknowledgedAt: true, status: true, createdAt: true },
      })
    : [];
  const latestCommunication = new Map<string, (typeof communications)[number]>();
  for (const communication of communications) {
    if (communication.shiftId && !latestCommunication.has(communication.shiftId)) {
      latestCommunication.set(communication.shiftId, communication);
    }
  }

  const rows = incidents.map((incident) => {
    const communication = latestCommunication.get(incident.shift.id);
    const facts: RecoveryFacts = {
      status: incident.status,
      severity: incident.severity,
      detectedAt: incident.detectedAt,
      dueAt: incident.dueAt,
      acknowledgedAt: incident.acknowledgedAt,
      hasOwner: Boolean(incident.ownerId),
      hasCoverageDecision: incident.coverageDecisions.length > 0,
      coverageAcknowledged: Boolean(communication?.acknowledgedAt),
      shiftUncovered: !incident.shift.employeeId || incident.shift.status === "UNCOVERED",
    };
    const described = describeRecovery(facts, now);
    const decision = incident.coverageDecisions[0];

    return {
      incidentId: incident.id,
      type: incident.type,
      status: incident.status,
      severity: incident.severity,
      title: incident.title,
      detectedAt: incident.detectedAt,
      dueAt: incident.dueAt,
      owner: incident.owner
        ? { id: incident.owner.id, name: `${incident.owner.firstName} ${incident.owner.lastName}`.trim() }
        : null,
      worksite: incident.worksite,
      service: incident.shift.service
        ? {
            id: incident.shift.service.id,
            title: incident.shift.service.title,
            customer: incident.shift.service.customer.name,
          }
        : null,
      shift: {
        id: incident.shift.id,
        title: incident.shift.title,
        status: incident.shift.status,
        scheduledStart: incident.shift.scheduledStart,
        scheduledEnd: incident.shift.scheduledEnd,
      },
      assignedTo: incident.employee
        ? `${incident.employee.user.firstName} ${incident.employee.user.lastName}`.trim()
        : null,
      coverage: decision
        ? {
            decidedAt: decision.createdAt,
            employee: decision.selectedEmployee
              ? `${decision.selectedEmployee.user.firstName} ${decision.selectedEmployee.user.lastName}`.trim()
              : null,
            acknowledged: Boolean(communication?.acknowledgedAt),
          }
        : null,
      ...described,
    };
  });

  rows.sort((left, right) => right.urgency - left.urgency);

  return {
    generatedAt: now,
    counts: {
      total: rows.length,
      overdue: rows.filter((row) => row.alert === "OVERDUE").length,
      unowned: rows.filter((row) => row.alert === "UNOWNED").length,
      stale: rows.filter((row) => row.alert === "STALE").length,
    },
    rows,
  };
}

/**
 * The services a coordinator can filter the queue by. Only services that
 * currently have an at-risk shift are offered, so the filter never presents a
 * choice that would return nothing.
 */
export async function listRecoveryQueueServices(actor: WiaActor) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot view the recovery queue.");
  }
  const incidents = await getPrisma().attendanceIncident.findMany({
    where: {
      companyId: actor.companyId,
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
      shift: { serviceId: { not: null } },
    },
    select: {
      shift: { select: { service: { select: { id: true, title: true } } } },
    },
  });
  const services = new Map<string, string>();
  for (const incident of incidents) {
    const service = incident.shift.service;
    if (service) services.set(service.id, service.title);
  }
  return [...services].map(([id, title]) => ({ id, title })).sort((left, right) => left.title.localeCompare(right.title));
}

/**
 * Measures operational recovery from persisted timestamps.  It intentionally
 * excludes unresolved records from averages rather than treating them as zero.
 */
export async function getCoverageRecoveryMetrics(actor: WiaActor, from: Date, to: Date) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot view company recovery metrics.");
  }
  const incidents = await getPrisma().attendanceIncident.findMany({
    where: { companyId: actor.companyId, detectedAt: { gte: from, lt: to } },
    select: { id: true, status: true, detectedAt: true, acknowledgedAt: true, coverageDecisions: { select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const averageMinutes = (values: number[]) => values.length
    ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
    : null;
  const acknowledgementMinutes = incidents
    .filter((incident) => incident.acknowledgedAt)
    .map((incident) => Math.max(0, (incident.acknowledgedAt!.getTime() - incident.detectedAt.getTime()) / 60_000));
  const recoveryMinutes = incidents
    .filter((incident) => incident.coverageDecisions[0])
    .map((incident) => Math.max(0, (incident.coverageDecisions[0]!.createdAt.getTime() - incident.detectedAt.getTime()) / 60_000));
  // An average over only the incidents that recovered says nothing on its own:
  // one recovered in a minute and ninety-nine still open reads as excellent.
  // The unresolved count and the oldest open age travel with it so the figure
  // cannot be quoted alone.
  const unresolved = incidents.filter(
    (incident) => !["RESOLVED", "DISMISSED"].includes(incident.status)
  );
  const oldestUnresolvedMinutes = unresolved.length
    ? Math.max(
        ...unresolved.map((incident) =>
          Math.round((to.getTime() - incident.detectedAt.getTime()) / 60_000)
        )
      )
    : null;

  return {
    incidentCount: incidents.length,
    acknowledgedCount: acknowledgementMinutes.length,
    recoveredCount: recoveryMinutes.length,
    unresolvedCount: unresolved.length,
    oldestUnresolvedMinutes,
    averageAcknowledgementMinutes: averageMinutes(acknowledgementMinutes),
    averageRecoveryMinutes: averageMinutes(recoveryMinutes),
  };
}

export type EmployeeListItem = {
  id: string;
  fieldStatus: string;
  availability: Prisma.JsonValue;
  skills: string[];
  zones: string[];
  maxHoursPerDay: number | null;
  maxJobsPerDay: number | null;
  position: string | null;
  user: { firstName: string; lastName: string; email: string };
  /** Coordinator-only, and absent rather than nulled for a field worker. */
  performanceScore?: number;
  internalNotes?: string | null;
  jobs?: Array<{ service: { status: string; price: Prisma.Decimal } }>;
};

/**
 * The team, as the caller is allowed to see it.
 *
 * A field worker gets their own row and only the operational half of it: the
 * coordinator's private notes, the performance score, and the revenue behind
 * their jobs are not fetched at all. Leaving that to whichever route remembers
 * to strip the fields afterwards is one refactor away from a leak.
 */
export async function listEmployees(actor: WiaActor) {
  assertCompany(actor);
  const isCoordinator = actor.role !== "EMPLOYEE";
  const where = {
    companyId: actor.companyId,
    ...(isCoordinator ? {} : { id: actor.employeeId ?? "__missing_employee__" }),
  };
  const orderBy = { user: { firstName: "asc" as const } };
  const shared = {
    id: true,
    fieldStatus: true,
    availability: true,
    skills: true,
    zones: true,
    maxHoursPerDay: true,
    maxJobsPerDay: true,
    position: true,
    user: { select: { firstName: true, lastName: true, email: true } },
  } as const;

  const rows = isCoordinator
    ? await getPrisma().employee.findMany({
        where,
        orderBy,
        select: {
          ...shared,
          performanceScore: true,
          internalNotes: true,
          jobs: { select: { service: { select: { status: true, price: true } } } },
        },
      })
    : await getPrisma().employee.findMany({ where, orderBy, select: shared });

  // One declared shape for both queries: the coordinator-only fields are simply
  // absent for a field worker, so a caller cannot read what was never fetched.
  return rows as EmployeeListItem[];
}

/**
 * Creates the Postgres side of a new employee (User + Employee, in one
 * transaction). The caller is responsible for first creating the
 * matching Supabase Auth account and rolling it back if this fails --
 * see POST /api/control/employees, which mirrors the same
 * create-then-rollback pattern already used by the sign-up flow.
 */
export async function createEmployeeProfile(
  actor: WiaActor,
  input: {
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    position?: string;
    skills?: string[];
    zones?: string[];
  }
) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot create other employees.");
  }

  return getPrisma().$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        companyId: actor.companyId,
        supabaseUserId: input.supabaseUserId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: "EMPLOYEE",
        status: "ACTIVE",
      },
    });
    const employee = await transaction.employee.create({
      data: {
        companyId: actor.companyId,
        userId: user.id,
        position: input.position,
        skills: input.skills ?? [],
        zones: input.zones ?? [],
      },
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "employee.created",
        entity: "Employee",
        entityId: employee.id,
        metadata: { email: input.email },
      },
    });
    return employee;
  });
}

/**
 * Removes an employee from the active field team. Their historical
 * records (past shifts, clock events, incidents, audit entries) are
 * kept for the record and their Employee row is never deleted -- this
 * is a deactivation, not an erasure, matching how this system never
 * silently discards history elsewhere (see the audit log and the
 * Stage 5 communications outbox). Their login is disabled and their
 * status set to INACTIVE, so they stop appearing as assignable and can
 * no longer sign in, without breaking the many historical records that
 * still reference them.
 */
export async function deleteEmployeeProfile(actor: WiaActor, employeeId: string) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot remove other employees.");
  }

  return getPrisma().$transaction(async (transaction) => {
    const employee = await transaction.employee.findFirst({
      where: { id: employeeId, companyId: actor.companyId },
      select: { id: true, userId: true, user: { select: { email: true } } },
    });
    if (!employee) {
      throw new WiaDomainError(
        "EMPLOYEE_NOT_FOUND",
        "The employee does not belong to the company."
      );
    }

    const activeShift = await transaction.plannedShift.findFirst({
      where: { employeeId, status: { in: ["ACTIVE", "PAUSED"] } },
      select: { id: true },
    });
    if (activeShift) {
      throw new WiaDomainError(
        "EMPLOYEE_HAS_ACTIVE_SHIFT",
        "This employee has an active shift in progress and cannot be removed right now."
      );
    }

    // Every shift that has not actually started is released rather than left
    // pointing at an account that can no longer clock in. Do not use its
    // scheduled time as the boundary: a PLANNED shift may already be late and
    // still has to become visible as uncovered. ACTIVE and PAUSED shifts were
    // rejected above, while completed and cancelled shifts are history.
    const unstartedShifts = await transaction.plannedShift.findMany({
      where: {
        companyId: actor.companyId,
        employeeId,
        status: { notIn: ["CANCELLED", "COMPLETED", "ACTIVE", "PAUSED"] },
      },
      select: { id: true, worksiteId: true },
    });

    if (unstartedShifts.length) {
      await transaction.plannedShift.updateMany({
        where: { id: { in: unstartedShifts.map((shift) => shift.id) } },
        data: { employeeId: null, status: "UNCOVERED" },
      });
      await transaction.attendanceIncident.createMany({
        data: unstartedShifts.map((shift) => ({
          companyId: actor.companyId,
          shiftId: shift.id,
          worksiteId: shift.worksiteId,
          type: "MISSING_CLOCK_IN" as const,
          status: "OPEN" as const,
          title: "Uncovered shift",
          detail: "The assigned person was removed from the field team.",
        })),
        // A shift that already had this incident keeps the original one.
        skipDuplicates: true,
      });
    }

    await transaction.employee.update({
      where: { id: employeeId },
      data: { fieldStatus: "INACTIVE" },
    });
    await transaction.user.update({
      where: { id: employee.userId },
      data: { status: "DISABLED" },
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "employee.deactivated",
        entity: "Employee",
        entityId: employeeId,
        metadata: { email: employee.user.email, releasedShifts: unstartedShifts.length },
      },
    });
    return { id: employeeId, releasedShifts: unstartedShifts.length };
  });
}

/**
 * Closes the Stage 4 follow-up gap: an admin/manager can now configure
 * an employee's skills, zones, availability, and working-time limits
 * from inside the app -- the exact fields the coverage-recommendation
 * hard constraints (Stage 4) depend on, which previously could only be
 * set by direct database access.
 */
export async function updateEmployeeProfile(actor: WiaActor, employeeId: string, input: unknown) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot edit employee profiles.");
  }
  const payload = employeeProfileUpdateSchema.parse(input);
  if (payload.fieldStatus === "INACTIVE") {
    // Otherwise this would be a second way out of the field team: one that
    // skips the active-shift guard, leaves future shifts assigned, and leaves
    // the login enabled.
    throw new WiaDomainError(
      "USE_DEACTIVATION",
      "Remove someone from the field team through deactivation, which releases their shifts and disables their access."
    );
  }

  return getPrisma().$transaction(async (transaction) => {
    const employee = await transaction.employee.findFirst({
      where: { id: employeeId, companyId: actor.companyId },
      select: { id: true, userId: true, user: { select: { email: true, supabaseUserId: true } } },
    });
    if (!employee) {
      throw new WiaDomainError(
        "EMPLOYEE_NOT_FOUND",
        "The employee does not belong to the company."
      );
    }

      if (payload.firstName !== undefined || payload.lastName !== undefined) {
        await transaction.user.update({
          where: { id: employee.userId },
          data: {
            ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
            ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
          },
      });
    }

    const updated = await transaction.employee.update({
      where: { id: employeeId },
      data: {
        ...(payload.skills !== undefined ? { skills: payload.skills } : {}),
        ...(payload.zones !== undefined ? { zones: payload.zones } : {}),
        ...(payload.availability !== undefined
          ? {
            availability:
              payload.availability === null
                ? Prisma.JsonNull
                : (payload.availability as Prisma.InputJsonValue),
          }
          : {}),
        ...(payload.maxHoursPerDay !== undefined ? { maxHoursPerDay: payload.maxHoursPerDay } : {}),
        ...(payload.maxJobsPerDay !== undefined ? { maxJobsPerDay: payload.maxJobsPerDay } : {}),
        ...(payload.fieldStatus !== undefined ? { fieldStatus: payload.fieldStatus } : {}),
      },
      select: {
        id: true,
        fieldStatus: true,
        availability: true,
        skills: true,
        zones: true,
        maxHoursPerDay: true,
        maxJobsPerDay: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "employee.profile_updated",
        entity: "Employee",
        entityId: employeeId,
        metadata: payload as Prisma.InputJsonValue,
      },
    });
      return {
        ...updated,
      };
  });
}

/**
 * Every column of a worksite that may leave the server. Written out rather than
 * returned wholesale because `qrSecretHash` is a credential column: an implicit
 * "return the row" hands it to the client the day QR verification is built.
 */
const worksiteReturnFields = {
  id: true,
  companyId: true,
  customerId: true,
  name: true,
  address: true,
  city: true,
  province: true,
  postalCode: true,
  latitude: true,
  longitude: true,
  radiusMeters: true,
  timezone: true,
  verificationMode: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function createWorksite(actor: WiaActor, input: unknown) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot create worksites.");
  }
  const payload = worksiteInputSchema.parse(input);

  return getPrisma().$transaction((transaction) => createWorksiteWithin(transaction, actor, payload));
}

async function createWorksiteWithin(
  transaction: WiaTransaction,
  actor: WiaActor,
  payload: ReturnType<typeof worksiteInputSchema.parse>
) {
  if (payload.customerId) {
    const customer = await transaction.customer.findFirst({
      where: { id: payload.customerId, companyId: actor.companyId, status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    if (!customer) {
      throw new WiaDomainError(
        "CUSTOMER_NOT_FOUND",
        "The customer does not belong to the company or is archived."
      );
    }
  }

  const worksite = await transaction.worksite.create({
    data: { ...payload, companyId: actor.companyId },
    select: worksiteReturnFields,
  });
  await transaction.auditLog.create({
    data: {
      companyId: actor.companyId,
      userId: actor.userId,
      action: "worksite.created",
      entity: "Worksite",
      entityId: worksite.id,
      metadata: { name: worksite.name, city: worksite.city },
    },
  });
  return worksite;
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
      select: { id: true, isActive: true, customerId: true },
    });
    if (!worksite) {
      throw new WiaDomainError("WORKSITE_NOT_FOUND", "The worksite does not belong to the company.");
    }

    if (payload.customerId) {
      const customer = await transaction.customer.findFirst({
        where: { id: payload.customerId, companyId: actor.companyId, status: { not: "ARCHIVED" } },
        select: { id: true },
      });
      if (!customer) {
        throw new WiaDomainError(
          "CUSTOMER_NOT_FOUND",
          "The customer does not belong to the company or is archived."
        );
      }
      if (payload.customerId !== worksite.customerId) {
        const conflictingServiceShifts = await transaction.plannedShift.count({
          where: {
            companyId: actor.companyId,
            worksiteId,
            service: { customerId: { not: payload.customerId } },
          },
        });
        if (conflictingServiceShifts > 0) {
          throw new WiaDomainError(
            "WORKSITE_CUSTOMER_CHANGE_CONFLICT",
            "This worksite has shifts linked to services for another customer. Archive it and create a new worksite instead."
          );
        }
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
      select: worksiteReturnFields,
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

/**
 * The one eligibility gate for putting a person on a shift.
 *
 * Coverage confirmation ran the full rule set — status, overlap, skills, zone,
 * availability, daily limits — while direct planning checked only status and
 * overlap. The same assignment was therefore allowed or refused depending on
 * which screen a coordinator used, and the weaker door was the one used most.
 * Both paths call this now.
 *
 * The overlap query is deliberately not bounded to the calendar day: a shift
 * running 23:00-02:00 belongs to two of them, and a day-bounded query would
 * miss the collision. The daily-load query stays day-bounded, because that is
 * what "per day" means.
 */
async function assertEmployeeMayTakeShift(
  transaction: WiaTransaction,
  actor: WiaActor,
  input: {
    employeeId: string;
    /** Excluded from the overlap search when editing an existing shift. */
    shiftId?: string;
    worksiteCity: string;
    requiredSkills: string[];
    scheduledStart: Date;
    scheduledEnd: Date;
  }
) {
  const employee = await transaction.employee.findFirst({
    where: { id: input.employeeId, companyId: actor.companyId },
    select: {
      id: true,
      fieldStatus: true,
      skills: true,
      zones: true,
      availability: true,
      maxHoursPerDay: true,
      maxJobsPerDay: true,
    },
  });
  if (!employee) {
    throw new WiaDomainError("EMPLOYEE_UNAVAILABLE", "The selected person is unavailable.");
  }

  const company = await transaction.company.findUnique({
    where: { id: actor.companyId },
    select: { timezone: true },
  });
  const timeZone = company?.timezone ?? "UTC";
  const { start: dayStart, end: dayEnd } = getZonedDayRange(
    getZonedDateString(input.scheduledStart, timeZone),
    timeZone
  );
  const excludeSelf = input.shiftId ? { id: { not: input.shiftId } } : {};

  const [overlapping, dayShifts] = await Promise.all([
    transaction.plannedShift.findMany({
      where: {
        companyId: actor.companyId,
        employeeId: employee.id,
        ...excludeSelf,
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        scheduledStart: { lt: input.scheduledEnd },
        scheduledEnd: { gt: input.scheduledStart },
      },
      select: { scheduledStart: true, scheduledEnd: true },
    }),
    transaction.plannedShift.findMany({
      where: {
        companyId: actor.companyId,
        employeeId: employee.id,
        ...excludeSelf,
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        scheduledStart: { lt: dayEnd },
        scheduledEnd: { gt: dayStart },
      },
      select: { scheduledStart: true, scheduledEnd: true },
    }),
  ]);

  const hasOverlap = overlapping.some((shift) =>
    rangesOverlap(input.scheduledStart, input.scheduledEnd, shift.scheduledStart, shift.scheduledEnd)
  );
  const existingDailyMinutes = dayShifts.reduce(
    (total, shift) => total + (shift.scheduledEnd.getTime() - shift.scheduledStart.getTime()) / 60_000,
    0
  );

  const eligibility = evaluateCoverageEligibility({
    fieldStatus: employee.fieldStatus,
    hasOverlap,
    requiredSkills: input.requiredSkills,
    employeeSkills: employee.skills,
    worksiteCity: input.worksiteCity,
    employeeZones: employee.zones,
    availability: parseEmployeeAvailability(employee.availability),
    shiftStart: input.scheduledStart,
    shiftEnd: input.scheduledEnd,
    existingDailyMinutes,
    existingDailyJobs: dayShifts.length,
    maxHoursPerDay: employee.maxHoursPerDay,
    maxJobsPerDay: employee.maxJobsPerDay,
    timeZone,
  });

  if (!eligibility.eligible) {
    // One code for every hard constraint, with the specific reason as the
    // message, so the caller can show a coordinator exactly what blocked it.
    throw new WiaDomainError(
      hasOverlap ? "SHIFT_OVERLAP" : "EMPLOYEE_NOT_ELIGIBLE",
      eligibility.reason
    );
  }

  return employee;
}

export async function createPlannedShift(actor: WiaActor, input: unknown) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot create shifts.");
  }
  const payload = plannedShiftInputSchema.parse(input);

  return getPrisma().$transaction((transaction) => createPlannedShiftWithin(transaction, actor, payload));
}

async function createPlannedShiftWithin(
  transaction: WiaTransaction,
  actor: WiaActor,
  payload: ReturnType<typeof plannedShiftInputSchema.parse>
) {
  const scheduledStart = new Date(payload.scheduledStart);
  const scheduledEnd = new Date(payload.scheduledEnd);

  {
    const worksite = await transaction.worksite.findFirst({
      where: { id: payload.worksiteId, companyId: actor.companyId, isActive: true },
      select: { id: true, customerId: true, city: true },
    });
    if (!worksite) {
      throw new WiaDomainError("WORKSITE_NOT_FOUND", "The worksite does not belong to the company or is inactive.");
    }
    assertShiftWindow(scheduledStart, scheduledEnd);

    if (payload.serviceId) {
      const service = await transaction.service.findFirst({
        where: { id: payload.serviceId, companyId: actor.companyId, status: { not: "CANCELLED" } },
        select: { id: true, customerId: true },
      });
      if (!service) {
        throw new WiaDomainError("SERVICE_NOT_FOUND", "The service does not belong to the company or is cancelled.");
      }
      if (worksite.customerId && worksite.customerId !== service.customerId) {
        throw new WiaDomainError(
          "SERVICE_WORKSITE_MISMATCH",
          "The selected service belongs to a different customer than this worksite."
        );
      }
    }

    if (payload.employeeId) {
      await assertEmployeeMayTakeShift(transaction, actor, {
        employeeId: payload.employeeId,
        worksiteCity: worksite.city,
        requiredSkills: payload.requiredSkills,
        scheduledStart,
        scheduledEnd,
      });
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
        metadata: { employeeId: payload.employeeId ?? null, serviceId: payload.serviceId ?? null },
      },
    });

    return shift;
  }
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
    if (shift.clockEvents.length > 0) {
      // Cancelling is the one thing still allowed, and it must be the ONLY
      // thing in the request. Otherwise a cancellation is a way to rewrite the
      // time, person or service of a shift somebody already clocked into, and
      // the attendance record would refer to something that never happened.
      const cancellationOnly =
        payload.status === "CANCELLED" && Object.keys(payload).length === 1;
      if (!cancellationOnly) {
        throw new WiaDomainError(
          "SHIFT_ALREADY_STARTED",
          "A shift with clock events can only be cancelled administratively, with no other change in the same request."
        );
      }
    }

    const scheduledStart = payload.scheduledStart
      ? new Date(payload.scheduledStart)
      : shift.scheduledStart;
    const scheduledEnd = payload.scheduledEnd ? new Date(payload.scheduledEnd) : shift.scheduledEnd;
    assertShiftWindow(scheduledStart, scheduledEnd);

    const serviceId = payload.serviceId === undefined ? shift.serviceId : payload.serviceId;
    if (serviceId && serviceId !== shift.serviceId) {
      const service = await transaction.service.findFirst({
        where: { id: serviceId, companyId: actor.companyId, status: { not: "CANCELLED" } },
        select: { id: true, customerId: true },
      });
      if (!service) {
        throw new WiaDomainError(
          "SERVICE_NOT_FOUND",
          "The service does not belong to the company or is cancelled."
        );
      }
      const worksite = await transaction.worksite.findFirst({
        where: { id: shift.worksiteId, companyId: actor.companyId },
        select: { customerId: true },
      });
      if (worksite?.customerId && worksite.customerId !== service.customerId) {
        throw new WiaDomainError(
          "SERVICE_WORKSITE_MISMATCH",
          "The selected service belongs to a different customer than this worksite."
        );
      }
    }

    const employeeId = payload.employeeId === undefined ? shift.employeeId : payload.employeeId;
    if (employeeId) {
      const shiftWorksite = await transaction.worksite.findFirst({
        where: { id: shift.worksiteId, companyId: actor.companyId },
        select: { city: true },
      });
      await assertEmployeeMayTakeShift(transaction, actor, {
        employeeId,
        shiftId,
        worksiteCity: shiftWorksite?.city ?? "",
        requiredSkills: payload.requiredSkills ?? shift.requiredSkills ?? [],
        scheduledStart,
        scheduledEnd,
      });
    }

    const isCancelled = payload.status === "CANCELLED";
    // Assigning somebody to an uncovered shift is a recovery, and COVERED is
    // the record of that. Any other edit leaves the status alone rather than
    // quietly turning a recovered shift back into an ordinary planned one.
    const nextStatus = isCancelled
      ? "CANCELLED"
      : !employeeId
        ? "UNCOVERED"
        : shift.status === "UNCOVERED"
          ? "COVERED"
          : shift.status;

    const updated = await transaction.plannedShift.update({
      where: { id: shiftId },
      data: {
        employeeId,
        serviceId,
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
        where: {
          shiftId,
          companyId: actor.companyId,
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
          // Assigning somebody closes the gap, and nothing else. A late
          // arrival or an out-of-radius clock is a separate finding that a
          // coordinator has to work and close on its own.
          ...(isCancelled ? {} : { type: "MISSING_CLOCK_IN" as const }),
        },
        data: {
          status: isCancelled ? "DISMISSED" : "RESOLVED",
          resolvedAt: new Date(),
          // Closed as a consequence of an edit, not by someone working it.
          // Saying so keeps "resolved" from meaning two different things.
          resolutionNotes: isCancelled
            ? "Closed automatically: the shift was cancelled."
            : "Closed automatically: the shift was assigned to somebody.",
        },
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
  // A clock event is the employee's own attestation of attendance. A
  // coordinator who needs to correct time must use the separate, reviewable
  // correction workflow; they must not be able to manufacture a QR/mobile/PIN
  // event in another person's name.
  if (actor.role !== "EMPLOYEE" || !actor.employeeId) {
    throw new WiaDomainError("FORBIDDEN", "Only the assigned employee can record a clock event.");
  }
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
    if (existing) {
      // A replay is the same action arriving twice, not any request carrying a
      // key somebody else used. Returning the stored event without these two
      // checks would hand a colleague's attendance record - and the location
      // on it - to whoever guessed the key.
      if (actor.role === "EMPLOYEE" && existing.employeeId !== actor.employeeId) {
        throw new WiaDomainError("FORBIDDEN", "You can only clock into your own shifts.");
      }
      if (existing.shiftId !== payload.shiftId || existing.type !== payload.type) {
        throw new WiaDomainError(
          "IDEMPOTENCY_KEY_REUSED",
          "That key was already used for a different clock action. Generate a new one."
        );
      }
      return { event: existing, created: false };
    }

    assertClockTimestamp(new Date(payload.occurredAt), new Date());

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
    if (actor.employeeId !== shift.employeeId) {
      throw new WiaDomainError("FORBIDDEN", "You can only clock into your own shifts.");
    }
    if (["CANCELLED", "COMPLETED"].includes(shift.status)) {
      throw new WiaDomainError("SHIFT_CLOSED", "The shift is already closed.");
    }

    const previousEvent = shift.clockEvents[0];
    assertClockTransition(previousEvent?.type, payload.type);

    const hasWorksiteCoordinates = shift.worksite.latitude !== null && shift.worksite.longitude !== null;
    const hasReportedPosition = payload.latitude !== undefined && payload.longitude !== undefined;
    // Written now, while both points are in hand. Once the exact position has
    // been reduced away, this is what explains the verification to a worker who
    // disputes it or to an inspector who asks.
    const distanceMeters =
      hasWorksiteCoordinates && hasReportedPosition
        ? distanceInMeters(
            { latitude: payload.latitude as number, longitude: payload.longitude as number },
            { latitude: Number(shift.worksite.latitude), longitude: Number(shift.worksite.longitude) }
          )
        : undefined;
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
        distanceMeters,
        verifiedAgainstRadiusMeters: hasWorksiteCoordinates ? shift.worksite.radiusMeters : undefined,
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

    // A correction proposes a different time for a specific event, so it has to
    // stay near that event. Without this, the correction path is a way around
    // the bounds the clock itself enforces.
    const proposedOccurredAt = new Date(payload.proposedOccurredAt);
    if (proposedOccurredAt.getTime() > Date.now()) {
      throw new WiaDomainError(
        "INVALID_CORRECTION_TIME",
        "A correction cannot propose a time in the future."
      );
    }
    const hoursFromEvent =
      Math.abs(proposedOccurredAt.getTime() - clockEvent.occurredAt.getTime()) / 3_600_000;
    if (hoursFromEvent > MAX_CORRECTION_DRIFT_HOURS) {
      throw new WiaDomainError(
        "INVALID_CORRECTION_TIME",
        `A correction must stay within ${MAX_CORRECTION_DRIFT_HOURS} hours of the event it corrects.`
      );
    }

    const correction = await transaction.timeCorrectionRequest.create({
      data: {
        companyId: actor.companyId,
        clockEventId: clockEvent.id,
        employeeId: clockEvent.employeeId,
        // A coordinator may raise one for somebody else; the record says who
        // actually raised it rather than reading as the worker's own request.
        requestedByUserId: actor.userId,
        proposedOccurredAt,
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
    // A coordinator with a field profile could otherwise approve their own
    // correction to their own attendance.
    if (actor.employeeId && actor.employeeId === correction.employeeId) {
      throw new WiaDomainError(
        "SELF_REVIEW_FORBIDDEN",
        "Somebody else has to review a correction to your own attendance."
      );
    }

    const claimed = await transaction.timeCorrectionRequest.updateMany({
      // The status the decision was made against is part of the condition, so
      // two coordinators deciding at once cannot silently overwrite each other.
      where: { id: correction.id, status: correction.status },
      data: {
        status: payload.status,
        reviewedByUserId: actor.userId,
        companyReviewedAt: new Date(),
        reviewNote: payload.note,
        // The acknowledgement is cleared because there is a new decision to
        // answer. The worker's own words are NOT cleared: erasing a dispute
        // while closing it is precisely what the record exists to prevent.
        employeeAcknowledgedAt: null,
      },
    });
    if (claimed.count === 0) {
      throw new WiaDomainError(
        "CORRECTION_CLOSED",
        "Somebody else decided this request first. Reload it before deciding again."
      );
    }
    const reviewed = await transaction.timeCorrectionRequest.findFirst({
      where: { id: correction.id },
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
      // The due time comes from the severity, so leaving it behind would let an
      // escalated incident keep the deadline of the level it just left - and
      // the queue would order and alert on the lower risk.
      const policy = await getIncidentPolicy(transaction, actor.companyId);
      const updated = await transaction.attendanceIncident.update({
        where: { id: incident.id },
        data: {
          severity: nextSeverity,
          dueAt: computeIncidentDueAt(nextSeverity, incident.detectedAt, policy),
        },
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

function assertExportRange(actor: WiaActor, from: Date, to: Date) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot export the full record.");
  }
  if (to <= from) {
    throw new WiaDomainError("INVALID_EXPORT_RANGE", "The end must be later than the start.");
  }
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days > MAX_EXPORT_DAYS) {
    throw new WiaDomainError(
      "EXPORT_RANGE_TOO_WIDE",
      `An export covers at most ${MAX_EXPORT_DAYS} days. Request a narrower period.`
    );
  }
}

/** Refuses a result set too large to build in one response. */
function assertExportSize(rows: number) {
  if (rows > MAX_EXPORT_ROWS) {
    throw new WiaDomainError(
      "EXPORT_TOO_LARGE",
      `That period contains ${rows} rows, more than the ${MAX_EXPORT_ROWS} an export can return. Request a narrower period.`
    );
  }
}

/**
 * Records that an export happened. Who took a copy of a workspace's attendance
 * or incident history is itself something a customer may need to account for.
 */
async function recordExport(actor: WiaActor, dataset: string, from: Date, to: Date, rows: number) {
  await getPrisma().auditLog.create({
    data: {
      companyId: actor.companyId,
      userId: actor.userId,
      action: `${dataset}_report.exported`,
      entity: "Company",
      entityId: actor.companyId,
      metadata: { from: from.toISOString(), to: to.toISOString(), rows },
    },
  });
}

/**
 * Every incident detected in the period. Ordered by detection then id, so two
 * exports of an unchanged period are byte-identical.
 */
export async function exportIncidents(actor: WiaActor, from: Date, to: Date) {
  assertExportRange(actor, from, to);
  const incidents = await getPrisma().attendanceIncident.findMany({
    where: { companyId: actor.companyId, detectedAt: { gte: from, lt: to } },
    orderBy: [{ detectedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      type: true,
      severity: true,
      status: true,
      detectedAt: true,
      dueAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
      resolutionNotes: true,
      worksite: { select: { name: true } },
      owner: { select: { firstName: true, lastName: true } },
      employee: { select: { user: { select: { firstName: true, lastName: true } } } },
      shift: {
        select: {
          title: true,
          service: { select: { title: true, customer: { select: { name: true } } } },
        },
      },
    },
  });
  assertExportSize(incidents.length);
  await recordExport(actor, "incident", from, to, incidents.length);
  return incidents;
}

/**
 * Every human coverage decision in the period, with the reasons the
 * recommendation gave and any override the coordinator recorded.
 */
export async function exportCoverageDecisions(actor: WiaActor, from: Date, to: Date) {
  assertExportRange(actor, from, to);
  const decisions = await getPrisma().coverageDecision.findMany({
    where: { companyId: actor.companyId, createdAt: { gte: from, lt: to } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      createdAt: true,
      type: true,
      incidentId: true,
      score: true,
      reasons: true,
      overrideReason: true,
      shift: { select: { title: true, worksite: { select: { name: true } } } },
      recommendedEmployee: { select: { user: { select: { firstName: true, lastName: true } } } },
      selectedEmployee: { select: { user: { select: { firstName: true, lastName: true } } } },
      actor: { select: { firstName: true, lastName: true } },
    },
  });
  assertExportSize(decisions.length);
  await recordExport(actor, "coverage", from, to, decisions.length);
  return decisions;
}

/**
 * Reduces an exact clock position to the distance that justified the decision.
 *
 * The statutory record is untouched: the time, the person, the worksite and the
 * verification outcome all stay for the full retention period. What expires is
 * the coordinate, because the purpose of a time record is when work started and
 * stopped, not where somebody was — and a four-year trail of exact positions is
 * a different thing from a time record.
 *
 * The distance and the radius in force were written at capture time, so nothing
 * has to be recomputed here and a decision stays explainable afterwards. The
 * reduction is deliberately one-way.
 */
export async function reduceClockLocationPrecision(now = new Date(), batchSize = 500) {
  const prisma = getPrisma();
  const companies = await prisma.company.findMany({
    select: { id: true, clockLocationPrecisionDays: true },
  });

  let reduced = 0;
  for (const company of companies) {
    const days = Math.max(1, company.clockLocationPrecisionDays);
    const before = new Date(now.getTime() - days * 24 * 60 * 60_000);

    const result = await prisma.clockEvent.updateMany({
      where: {
        companyId: company.id,
        occurredAt: { lt: before },
        locationReducedAt: null,
        latitude: { not: null },
      },
      data: {
        latitude: null,
        longitude: null,
        locationReducedAt: now,
      },
    });

    if (result.count) {
      reduced += result.count;
      await prisma.auditLog.create({
        data: {
          companyId: company.id,
          action: "clock_location.reduced",
          entity: "ClockEvent",
          entityId: company.id,
          metadata: {
            events: result.count,
            precisionDays: days,
            olderThan: before.toISOString(),
          },
        },
      });
    }

    if (reduced >= batchSize) break;
  }

  return { companies: companies.length, reduced };
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
      shift: { select: { title: true } },
    },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
  });
  assertExportSize(events.length);
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
        // Acknowledged, not resolved. A confirmed replacement who has not seen
        // the message is still a service at risk, and the recovery queue's own
        // next action for exactly this state - chase the acknowledgement - was
        // unreachable while confirmation closed the incident outright. It
        // resolves when the person acknowledges.
        status: "ACKNOWLEDGED",
        acknowledgedAt: incident.acknowledgedAt ?? new Date(),
        resolutionNotes: acceptedRecommendation
          ? "WIA recommendation confirmed."
          : payload.overrideReason,
      },
    });
    await queueCommunicationWithin(transaction, {
      companyId: actor.companyId,
      actorUserId: actor.userId,
      shiftId: incident.shiftId,
      recipientEmployeeId: selectedEmployee.id,
      template: "coverage_confirmed",
      discriminator: incident.id,
      payload: {
        shiftId: incident.shiftId,
        incidentId: incident.id,
        scheduledStart: incident.shift.scheduledStart.toISOString(),
        scheduledEnd: incident.shift.scheduledEnd.toISOString(),
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

/**
 * Queues one operational message on every channel the recipient has actually
 * agreed to, and never twice for the same event.
 *
 * Consent is resolved here rather than at send time so a skipped channel is a
 * decision that was made once, with a reason, instead of a silent failure in
 * the worker. The dedupe key is stable for the event, so a retried request or
 * a replayed job cannot produce a second message.
 */
async function queueCommunicationWithin(
  transaction: WiaTransaction,
  input: {
    companyId: string;
    actorUserId?: string;
    shiftId?: string | null;
    recipientEmployeeId: string;
    template: CommunicationTemplateKey;
    payload: Prisma.InputJsonObject;
    discriminator?: string;
  }
) {
  const template = activeCommunicationTemplate(input.template);
  const recipient = await transaction.employee.findFirst({
    where: { id: input.recipientEmployeeId, companyId: input.companyId },
    select: {
      id: true,
      contactEmailOptIn: true,
      contactSmsOptIn: true,
      user: { select: { email: true, phone: true } },
    },
  });
  if (!recipient) {
    throw new WiaDomainError("EMPLOYEE_NOT_FOUND", "The message recipient is not part of the company.");
  }

  const decision = resolveCommunicationChannels(
    input.template,
    {
      email: recipient.user.email,
      phone: recipient.user.phone,
      emailOptIn: recipient.contactEmailOptIn,
      smsOptIn: recipient.contactSmsOptIn,
    },
    { smsProviderConfigured: false }
  );

  const queued: string[] = [];
  const duplicates: string[] = [];

  for (const channel of decision.channels) {
    const dedupeKey = communicationDedupeKey({
      template: input.template,
      version: template.version,
      channel,
      shiftId: input.shiftId,
      recipientEmployeeId: recipient.id,
      discriminator: input.discriminator,
      payload: input.payload,
    });
    const existing = await transaction.communicationOutbox.findFirst({
      where: { companyId: input.companyId, dedupeKey },
      select: { id: true },
    });
    if (existing) {
      duplicates.push(existing.id);
      continue;
    }
    const created = await transaction.communicationOutbox.create({
      data: {
        companyId: input.companyId,
        shiftId: input.shiftId ?? undefined,
        recipientEmployeeId: recipient.id,
        channel,
        template: input.template,
        templateVersion: template.version,
        dedupeKey,
        payload: input.payload,
      },
      select: { id: true },
    });
    queued.push(created.id);
  }

  if (decision.skipped.length) {
    // A channel the recipient has not agreed to is a recorded decision, not a
    // delivery failure discovered later by the worker.
    await transaction.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.actorUserId,
        action: "communication.channel_skipped",
        entity: "CommunicationOutbox",
        entityId: recipient.id,
        metadata: { template: input.template, skipped: decision.skipped },
      },
    });
  }

  return { queued, duplicates, skipped: decision.skipped };
}

/**
 * Operational health of the outbox. A coordinator, and the cron run itself,
 * can see at a glance whether anything is stuck or has given up, which is the
 * difference between "delivered, visibly failed, or retried" and "lost".
 */
export async function getCommunicationHealth(actor: WiaActor, now = new Date()) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot view outbox health.");
  }
  return communicationHealthFor({ companyId: actor.companyId }, now);
}

/** The same measurement across every company, for the scheduled worker. */
export async function getGlobalCommunicationHealth(now = new Date()) {
  return communicationHealthFor({}, now);
}

async function communicationHealthFor(scope: { companyId?: string }, now: Date) {
  const prisma = getPrisma();
  const since = new Date(now.getTime() - 24 * 60 * 60_000);
  const where = scope.companyId ? { companyId: scope.companyId } : {};

  // Past this, a claimed record was abandoned by whatever worker took it.
  const leaseExpiredBefore = new Date(now.getTime() - OUTBOX_LEASE_MINUTES * 60_000);

  const [
    pending,
    retrying,
    processing,
    stuckProcessing,
    failed,
    sentLast24h,
    unacknowledgedLast24h,
    oldestPending,
  ] = await Promise.all([
      prisma.communicationOutbox.count({ where: { ...where, status: "PENDING" } }),
      prisma.communicationOutbox.count({ where: { ...where, status: "RETRYING" } }),
      prisma.communicationOutbox.count({ where: { ...where, status: "PROCESSING" } }),
      prisma.communicationOutbox.count({
        where: {
          ...where,
          status: "PROCESSING",
          processingStartedAt: { lt: leaseExpiredBefore },
        },
      }),
      prisma.communicationOutbox.count({ where: { ...where, status: "FAILED" } }),
      prisma.communicationOutbox.count({ where: { ...where, status: "SENT", sentAt: { gte: since } } }),
      prisma.communicationOutbox.count({
        where: { ...where, status: "SENT", sentAt: { gte: since }, acknowledgedAt: null },
      }),
      prisma.communicationOutbox.findFirst({
        where: { ...where, status: { in: ["PENDING", "RETRYING"] } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

  return summariseCommunicationHealth({
    pending,
    retrying,
    processing,
    stuckProcessing,
    failed,
    sentLast24h,
    unacknowledgedLast24h,
    oldestPendingAt: oldestPending?.createdAt ?? null,
    now,
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
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      },
      shift: { select: { title: true, scheduledStart: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/**
 * Stage 5: the communications outbox worker. Claims due PENDING/RETRYING
 * records with an optimistic-lock update (so two overlapping worker runs
 * can never both process the same record), attempts delivery through the
 * channel-appropriate provider, and moves each record to SENT, RETRYING
 * (with a bounded backoff), or FAILED. Never wraps the external provider
 * call in a database transaction -- that would hold a lock for the
 * duration of a network call, which is unsafe.
 */
export async function processCommunicationOutbox(now = new Date(), batchSize = 20) {
  const prisma = getPrisma();
  const leaseExpiredBefore = new Date(now.getTime() - OUTBOX_LEASE_MINUTES * 60_000);
  await prisma.communicationOutbox.updateMany({
    where: {
      status: "PROCESSING",
      processingStartedAt: { lt: leaseExpiredBefore },
    },
    data: {
      status: "RETRYING",
      processingStartedAt: null,
      nextAttemptAt: now,
      lastError: "Delivery processing lease expired and was recovered.",
    },
  });
  const due = await prisma.communicationOutbox.findMany({
    where: {
      status: { in: ["PENDING", "RETRYING"] },
      nextAttemptAt: { lte: now },
    },
    take: batchSize,
    orderBy: { nextAttemptAt: "asc" },
    include: {
      recipientEmployee: {
        select: {
          contactEmailOptIn: true,
          contactSmsOptIn: true,
          user: { select: { email: true, phone: true } },
        },
      },
    },
  });

  const results: Array<{ id: string; status: string }> = [];

  for (const record of due) {
    const claimed = await prisma.communicationOutbox.updateMany({
      where: { id: record.id, status: record.status },
      data: { status: "PROCESSING", processingStartedAt: now },
    });
    if (claimed.count === 0) continue; // another worker run already claimed this one

    let content: { subject: string; body: string };
    try {
      content = renderCommunication(
        record.template,
        record.templateVersion,
        record.payload as Record<string, unknown>
      );
    } catch (error) {
      // A message whose template version no longer exists must never go out as
      // a placeholder. Retrying cannot fix it, so it fails visibly at once.
      await prisma.communicationOutbox.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          attempts: record.attempts + 1,
          processingStartedAt: null,
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Unknown template.",
        },
      });
      results.push({ id: record.id, status: "FAILED" });
      continue;
    }

    let result: Awaited<ReturnType<typeof deliverInApp>>;
    if (record.channel === "IN_APP") {
      result = await deliverInApp();
    } else if (record.channel === "EMAIL") {
      const recipient = record.recipientEmployee;
      // Consent is re-read here, not trusted from when the message was queued.
      // Somebody who opted out yesterday must not receive a message that was
      // queued the day before, or one a coordinator resends next week.
      const allowed = recipient
        ? resolveCommunicationChannels(
            record.template as CommunicationTemplateKey,
            {
              email: recipient.user.email,
              phone: recipient.user.phone,
              emailOptIn: recipient.contactEmailOptIn,
              smsOptIn: recipient.contactSmsOptIn,
            },
            { smsProviderConfigured: false }
          ).channels
        : [];

      if (!recipient?.user.email) {
        result = { success: false, error: "Recipient has no email address on file." };
      } else if (!allowed.includes("EMAIL")) {
        // Withdrawn consent is not a delivery failure to retry. It is a
        // decision, and the message is cancelled rather than left rattling
        // around the outbox until it exhausts its attempts.
        await prisma.communicationOutbox.update({
          where: { id: record.id },
          data: {
            status: "CANCELLED",
            processingStartedAt: null,
            lastError: "The recipient has withdrawn consent for this channel.",
          },
        });
        results.push({ id: record.id, status: "CANCELLED" });
        continue;
      } else {
        result = await deliverEmail(record.id, content, recipient.user.email);
      }
    } else {
      // SMS/WhatsApp are explicitly out of scope for this stage (see the
      // playbook: consent, cost, templates, and failure policy all need
      // business approval first).
      result = { success: false, error: `${record.channel} delivery is not yet available.` };
    }

    if (result.success) {
      await prisma.communicationOutbox.update({
        where: { id: record.id },
        data: {
          status: "SENT",
          sentAt: now,
            attempts: record.attempts + 1,
            lastError: null,
            processingStartedAt: null,
            providerReference: result.providerReference,
        },
      });
      results.push({ id: record.id, status: "SENT" });
    } else {
      const attempts = record.attempts + 1;
      const exhausted = hasExceededCommunicationAttempts(attempts);
      await prisma.communicationOutbox.update({
        where: { id: record.id },
        data: {
          status: exhausted ? "FAILED" : "RETRYING",
          attempts,
            lastError: result.error.slice(0, 500),
            processingStartedAt: null,
          nextAttemptAt: exhausted
            ? record.nextAttemptAt
            : computeNextCommunicationAttempt(attempts, now),
        },
      });
      results.push({ id: record.id, status: exhausted ? "FAILED" : "RETRYING" });
    }
  }

  return { processed: results.length, results };
}

/** Stage 5: a coordinator can manually resend a message that has FAILED. */
export async function resendCommunication(actor: WiaActor, outboxId: string) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot resend communications.");
  }

  return getPrisma().$transaction(async (transaction) => {
    const record = await transaction.communicationOutbox.findFirst({
      where: { id: outboxId, companyId: actor.companyId },
    });
    if (!record) {
      throw new WiaDomainError(
        "COMMUNICATION_NOT_FOUND",
        "The message does not belong to the company."
      );
    }
    if (record.status !== "FAILED") {
      throw new WiaDomainError("COMMUNICATION_NOT_FAILED", "Only a failed message can be resent.");
    }

    const updated = await transaction.communicationOutbox.update({
      where: { id: record.id },
        data: {
          status: "PENDING",
          attempts: 0,
          lastError: null,
          processingStartedAt: null,
          nextAttemptAt: new Date(),
        },
    });
    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "communication.resent",
        entity: "CommunicationOutbox",
        entityId: record.id,
        metadata: { previousAttempts: record.attempts },
      },
    });
    return updated;
  });
}

/**
 * Stage 5, Task 4: the recipient employee acknowledges a reassignment
 * message -- distinct from delivery. A message can be SENT without ever
 * being acknowledged; this records that the employee has actually seen
 * and understood it.
 */
export async function acknowledgeCommunication(actor: WiaActor, outboxId: string) {
  assertCompany(actor);
  if (actor.role !== "EMPLOYEE" || !actor.employeeId) {
    throw new WiaDomainError("FORBIDDEN", "Only the recipient can acknowledge this message.");
  }

  return getPrisma().$transaction(async (transaction) => {
    const record = await transaction.communicationOutbox.findFirst({
      where: { id: outboxId, companyId: actor.companyId, recipientEmployeeId: actor.employeeId },
    });
    if (!record) {
      throw new WiaDomainError(
        "COMMUNICATION_NOT_FOUND",
        "The message does not belong to this employee."
      );
    }

    const acknowledgedAt = new Date();
    const updated = await transaction.communicationOutbox.update({
      where: { id: record.id },
      data: { acknowledgedAt },
    });

    // The loop closes here: coverage was confirmed by a coordinator and has now
    // been seen by the person taking the shift, which is the point at which the
    // service stops being at risk.
    if (record.shiftId && record.template === "coverage_confirmed") {
      await transaction.attendanceIncident.updateMany({
        where: {
          companyId: actor.companyId,
          shiftId: record.shiftId,
          status: "ACKNOWLEDGED",
        },
        data: {
          status: "RESOLVED",
          resolvedAt: acknowledgedAt,
        },
      });
    }

    await transaction.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "communication.acknowledged",
        entity: "CommunicationOutbox",
        entityId: record.id,
      },
    });
    return updated;
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
      clockLocationPrecisionDays: true,
      crmEnabled: true,
    },
  });
  if (!company) {
    throw new WiaDomainError("COMPANY_NOT_FOUND", "The company does not exist.");
  }
  return company;
}

/** A read-only checklist for starting a controlled pilot without hidden setup work. */
export async function getPilotOnboardingProgress(actor: WiaActor) {
  assertCompany(actor);
  if (actor.role === "EMPLOYEE") {
    throw new WiaDomainError("FORBIDDEN", "An employee cannot view pilot setup progress.");
  }
  const prisma = getPrisma();
  const [customers, worksites, employees, services, shifts, clockEvents] = await Promise.all([
    prisma.customer.count({ where: { companyId: actor.companyId, status: { not: "ARCHIVED" } } }),
    prisma.worksite.count({ where: { companyId: actor.companyId, isActive: true } }),
    prisma.employee.count({ where: { companyId: actor.companyId } }),
    prisma.service.count({ where: { companyId: actor.companyId, status: { not: "CANCELLED" } } }),
    prisma.plannedShift.count({ where: { companyId: actor.companyId, status: { not: "CANCELLED" } } }),
    prisma.clockEvent.count({ where: { companyId: actor.companyId } }),
  ]);
  return { customers, worksites, employees, services, shifts, clockEvents };
}

export type CsvImportRowStatus = "IMPORTED" | "SKIPPED_DUPLICATE" | "FAILED";

export type CsvImportRowOutcome = {
  row: number;
  status: CsvImportRowStatus;
  reference?: string;
  code?: string;
  message: string;
};

export type CsvImportResult = {
  kind: ImportKind;
  checksum: string;
  committed: boolean;
  replayed: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  failed: number;
  rows: CsvImportRowOutcome[];
};

/**
 * Aborts the import transaction while carrying every row outcome out with it.
 * A partial import is never acceptable here: the file is the unit of work, so
 * one unusable row rolls the whole file back and the coordinator still sees
 * exactly which row stopped it.
 */
class CsvImportRollback extends Error {
  constructor(public readonly rows: CsvImportRowOutcome[]) {
    super("CSV_IMPORT_ROLLBACK");
    this.name = "CsvImportRollback";
  }
}

function assertImportAuthorised(actor: WiaActor) {
  assertCompany(actor);
  if (!actor.userId || !["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(actor.role)) {
    throw new WiaDomainError("FORBIDDEN", "Only an administrator or manager can import company data.");
  }
}

/**
 * Re-runs the dry-run validation the coordinator already saw. Confirmation
 * never trusts the preview response from the browser: the file itself is
 * revalidated server-side before a single row is written.
 */
function validatedImportRows(kind: ImportKind, csv: string) {
  const preview = previewCsvImport(kind, csv);
  if (preview.invalidRows || preview.issues.length) {
    throw new WiaDomainError(
      "CSV_VALIDATION_FAILED",
      "Correct every CSV validation issue before confirming the import."
    );
  }
  const rows = csvRecords(csv);
  if (!rows.length) {
    throw new WiaDomainError("CSV_EMPTY", "The file does not contain any data row.");
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    // Every row is a lookup and a write inside one transaction, and that
    // transaction holds a database connection for as long as it runs. A file
    // this size is split, not streamed.
    throw new WiaDomainError(
      "CSV_TOO_LARGE",
      `A single import is limited to ${MAX_IMPORT_ROWS} rows. Split the file and import it in parts.`
    );
  }
  return rows;
}

function importChecksum(companyId: string, kind: ImportKind, csv: string) {
  const digest = createHash("sha256").update([companyId, kind, csv].join(":")).digest("hex");
  return kind + ":" + digest;
}

function summariseImport(
  kind: ImportKind,
  checksum: string,
  rows: CsvImportRowOutcome[],
  options: { committed: boolean; replayed?: boolean }
): CsvImportResult {
  return {
    kind,
    checksum,
    committed: options.committed,
    replayed: options.replayed ?? false,
    totalRows: rows.length,
    imported: rows.filter((row) => row.status === "IMPORTED").length,
    skipped: rows.filter((row) => row.status === "SKIPPED_DUPLICATE").length,
    failed: rows.filter((row) => row.status === "FAILED").length,
    rows,
  };
}

function splitList(value: string | undefined) {
  return (value ?? "")
    .split(/[;|]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Finds the row's tenant-scoped twin. Matching is deliberately narrow and
 * name-based because that is the only identity a CSV carries; anything it
 * matches is reported as skipped rather than merged, so an import can be
 * re-run after a correction without duplicating what already exists.
 */
async function findImportDuplicate(
  transaction: WiaTransaction,
  actor: WiaActor,
  kind: ImportKind,
  row: Record<string, string>
) {
  if (kind === "WORKSITES") {
    return transaction.worksite.findFirst({
      where: {
        companyId: actor.companyId,
        name: { equals: row.name, mode: "insensitive" },
        city: { equals: row.city, mode: "insensitive" },
      },
      select: { id: true },
    });
  }
  if (kind === "SERVICES") {
    return transaction.service.findFirst({
      where: {
        companyId: actor.companyId,
        title: { equals: row.title, mode: "insensitive" },
        status: { not: "CANCELLED" },
        customer: { name: { equals: row.customer, mode: "insensitive" } },
      },
      select: { id: true },
    });
  }
  return transaction.plannedShift.findFirst({
    where: {
      companyId: actor.companyId,
      title: { equals: row.title, mode: "insensitive" },
      scheduledStart: new Date(row.scheduledStart),
      status: { not: "CANCELLED" },
      worksite: { name: { equals: row.worksite, mode: "insensitive" } },
    },
    select: { id: true },
  });
}

/**
 * Creates one row through the same validated path the interactive forms use,
 * so an imported worksite, service, or shift is subject to identical schema,
 * ownership, and overlap rules.
 */
async function createImportRowWithin(
  transaction: WiaTransaction,
  actor: WiaActor,
  kind: ImportKind,
  row: Record<string, string>
) {
  if (kind === "WORKSITES") {
    return createWorksiteWithin(
      transaction,
      actor,
      worksiteInputSchema.parse({
        name: row.name,
        address: row.address,
        city: row.city,
        ...(row.province ? { province: row.province } : {}),
        ...(row.postalCode ? { postalCode: row.postalCode } : {}),
        ...(row.timezone ? { timezone: row.timezone } : {}),
      })
    );
  }

  if (kind === "SERVICES") {
    const customer = await transaction.customer.findFirst({
      where: {
        companyId: actor.companyId,
        name: { equals: row.customer, mode: "insensitive" },
        status: { not: "ARCHIVED" },
      },
      select: { id: true },
    });
    if (!customer) {
      throw new WiaDomainError(
        "CUSTOMER_NOT_FOUND",
        'Customer "' + row.customer + '" does not exist in this workspace. Create it before importing.'
      );
    }
    return createOperationalServiceWithin(
      transaction,
      actor,
      operationalServiceInputSchema.parse({
        customerId: customer.id,
        title: row.title,
        serviceType: row.serviceType,
        ...(row.recurrence ? { recurrence: row.recurrence } : {}),
      })
    );
  }

  const worksite = await transaction.worksite.findFirst({
    where: {
      companyId: actor.companyId,
      name: { equals: row.worksite, mode: "insensitive" },
      isActive: true,
    },
    select: { id: true },
  });
  if (!worksite) {
    throw new WiaDomainError(
      "WORKSITE_NOT_FOUND",
      'Worksite "' + row.worksite + '" does not exist or is archived. Import the worksites first.'
    );
  }
  return createPlannedShiftWithin(
    transaction,
    actor,
    plannedShiftInputSchema.parse({
      worksiteId: worksite.id,
      title: row.title,
      scheduledStart: new Date(row.scheduledStart).toISOString(),
      scheduledEnd: new Date(row.scheduledEnd).toISOString(),
    })
  );
}

function importFailureOutcome(rowNumber: number, error: unknown): CsvImportRowOutcome {
  if (error instanceof WiaDomainError) {
    return { row: rowNumber, status: "FAILED", code: error.code, message: error.message };
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = issue?.path.join(".") || "row";
    return {
      row: rowNumber,
      status: "FAILED",
      code: "VALIDATION_ERROR",
      message: field + ": " + (issue?.message ?? "The value is not valid."),
    };
  }
  return {
    row: rowNumber,
    status: "FAILED",
    code: "IMPORT_FAILED",
    message: "The row could not be imported.",
  };
}

/**
 * Confirms a previewed worksite, service, or shift file. Every accepted row is
 * written inside one transaction; a duplicate is skipped, and the first
 * unusable row rolls back the entire file. Re-confirming the identical file is
 * a no-op replay rather than a second import.
 */
export async function confirmOperationalCsvImport(
  actor: WiaActor,
  kind: ImportKind,
  csv: string
): Promise<CsvImportResult> {
  assertImportAuthorised(actor);
  if (kind === "EMPLOYEES") {
    throw new WiaDomainError(
      "EMPLOYEE_IMPORT_REQUIRES_INVITATIONS",
      "Employee files are imported through the invitation workflow."
    );
  }

  const rows = validatedImportRows(kind, csv);
  const checksum = importChecksum(actor.companyId, kind, csv);
  const prisma = getPrisma();

  const previous = await prisma.auditLog.findFirst({
    where: { companyId: actor.companyId, action: "csv_import.confirmed", entityId: checksum },
    select: { metadata: true },
  });
  if (previous) {
    const recorded = (previous.metadata as { rows?: unknown } | null)?.rows;
    const replayedRows = Array.isArray(recorded)
      ? (recorded as CsvImportRowOutcome[])
      : rows.map((_, index) => ({
          row: index + 2,
          status: "SKIPPED_DUPLICATE" as const,
          message: "This exact file was already imported.",
        }));
    return summariseImport(kind, checksum, replayedRows, { committed: true, replayed: true });
  }

  let rolledBack: CsvImportRowOutcome[] | undefined;
  let committed: CsvImportRowOutcome[] | undefined;

  try {
    committed = await prisma.$transaction(async (transaction) => {
      const outcomes: CsvImportRowOutcome[] = [];
      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        try {
          const duplicate = await findImportDuplicate(transaction, actor, kind, row);
          if (duplicate) {
            outcomes.push({
              row: rowNumber,
              status: "SKIPPED_DUPLICATE",
              reference: duplicate.id,
              message: "A matching record already exists in this workspace.",
            });
            continue;
          }
          const created = await createImportRowWithin(transaction, actor, kind, row);
          outcomes.push({
            row: rowNumber,
            status: "IMPORTED",
            reference: created.id,
            message: "Imported.",
          });
        } catch (error) {
          outcomes.push(importFailureOutcome(rowNumber, error));
          throw new CsvImportRollback(outcomes);
        }
      }

      await transaction.auditLog.create({
        data: {
          companyId: actor.companyId,
          userId: actor.userId,
          action: "csv_import.confirmed",
          entity: "CsvImport",
          entityId: checksum,
          metadata: {
            kind,
            totalRows: outcomes.length,
            imported: outcomes.filter((outcome) => outcome.status === "IMPORTED").length,
            skipped: outcomes.filter((outcome) => outcome.status === "SKIPPED_DUPLICATE").length,
            rows: outcomes,
          },
        },
      });
      return outcomes;
    });
  } catch (error) {
    if (!(error instanceof CsvImportRollback)) throw error;
    rolledBack = error.rows;
  }

  if (rolledBack) {
    // Written outside the rolled-back transaction so the rejection itself is
    // never lost together with the data it refused to write.
    await prisma.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.userId,
        action: "csv_import.rejected",
        entity: "CsvImport",
        entityId: checksum,
        metadata: {
          kind,
          totalRows: rows.length,
          failedRow: rolledBack.find((outcome) => outcome.status === "FAILED")?.row ?? null,
          rows: rolledBack,
        },
      },
    });
    return summariseImport(kind, checksum, rolledBack, { committed: false });
  }

  return summariseImport(kind, checksum, committed ?? [], { committed: true });
}

/**
 * Provisions the login for one imported employee. Injected rather than
 * imported so the bulk invitation path stays testable without the Supabase
 * Admin API, and so the caller keeps ownership of the credential boundary.
 */
export type EmployeeLoginProvisioner = {
  invite: (email: string) => Promise<{ supabaseUserId: string }>;
  revoke: (supabaseUserId: string) => Promise<void>;
};

/**
 * Confirms an employee file through the existing invitation workflow. Unlike
 * the operational imports this is not all-or-nothing: an invitation is an
 * external side effect that cannot be rolled back, so each row succeeds,
 * skips, or fails on its own and every failure is reported. Re-running the
 * corrected file is safe because an already-registered address is skipped.
 */
export async function confirmEmployeeCsvImport(
  actor: WiaActor,
  csv: string,
  provisioner: EmployeeLoginProvisioner
): Promise<CsvImportResult> {
  assertImportAuthorised(actor);
  const rows = validatedImportRows("EMPLOYEES", csv);
  const checksum = importChecksum(actor.companyId, "EMPLOYEES", csv);
  const prisma = getPrisma();
  const outcomes: CsvImportRowOutcome[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const email = row.email.toLowerCase();
    try {
      const existing = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true, companyId: true },
      });
      if (existing) {
        const sameCompany = existing.companyId === actor.companyId;
        outcomes.push({
          row: rowNumber,
          status: "SKIPPED_DUPLICATE",
          ...(sameCompany ? { reference: existing.id } : {}),
          message: sameCompany
            ? "This person is already part of the workspace."
            : "This email address is already registered.",
        });
        continue;
      }

      const profile = employeeCreateSchema.parse({
        firstName: row.firstName,
        lastName: row.lastName,
        email,
        ...(row.position ? { position: row.position } : {}),
        ...(splitList(row.skills).length ? { skills: splitList(row.skills) } : {}),
        ...(splitList(row.zones).length ? { zones: splitList(row.zones) } : {}),
      });

      const login = await provisioner.invite(profile.email);
      try {
        const employee = await createEmployeeProfile(actor, {
          supabaseUserId: login.supabaseUserId,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          position: profile.position,
          skills: profile.skills,
          zones: profile.zones,
        });
        outcomes.push({
          row: rowNumber,
          status: "IMPORTED",
          reference: employee.id,
          message: "Invited.",
        });
      } catch (profileError) {
        try {
          await provisioner.revoke(login.supabaseUserId);
        } catch (cleanupError) {
          // The rollback failed, so this row leaves a login with no profile.
          // The row outcome has to say so: otherwise the obvious next move -
          // fix the file and re-run it - fails on "already registered" with no
          // explanation anywhere.
          logEvent({
            level: "error",
            event: "auth.orphaned_login",
            supabaseUserId: login.supabaseUserId,
            reason: "A bulk invitation profile write failed and its rollback failed too.",
            errorDetail: cleanupError instanceof Error ? cleanupError.message : "Unknown cleanup error.",
          });
          outcomes.push({
            row: rowNumber,
            status: "FAILED",
            code: "ORPHANED_LOGIN",
            message:
              "The profile could not be written and the login could not be removed. Support must delete that login before this address can be invited again.",
          });
          continue;
        }
        throw profileError;
      }
    } catch (error) {
      outcomes.push(importFailureOutcome(rowNumber, error));
    }
  }

  await prisma.auditLog.create({
    data: {
      companyId: actor.companyId,
      userId: actor.userId,
      action: "csv_import.employees_invited",
      entity: "CsvImport",
      entityId: checksum,
      metadata: {
        kind: "EMPLOYEES",
        totalRows: outcomes.length,
        imported: outcomes.filter((outcome) => outcome.status === "IMPORTED").length,
        skipped: outcomes.filter((outcome) => outcome.status === "SKIPPED_DUPLICATE").length,
        failed: outcomes.filter((outcome) => outcome.status === "FAILED").length,
        rows: outcomes,
      },
    },
  });

  return summariseImport("EMPLOYEES", checksum, outcomes, { committed: true });
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
