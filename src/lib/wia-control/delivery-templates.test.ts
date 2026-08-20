import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    templateSubmission: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    plannedShift: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import {
  activeTemplate,
  assertSubmittableVersion,
  describeSubmission,
  listActiveTemplates,
  validateTemplateAnswers,
} from "@/lib/wia-control/delivery-templates";
import {
  listServiceSubmissions,
  listShiftSubmissions,
  submitDeliveryTemplate,
} from "@/lib/wia-control/delivery-service";
import type { WiaActor } from "@/lib/wia-control/service";

const manager: WiaActor = { companyId: "company-1", userId: "user-manager", role: "MANAGER" };
const worker: WiaActor = {
  companyId: "company-1",
  userId: "user-worker",
  role: "EMPLOYEE",
  employeeId: "employee-1",
};

const openingAnswers = {
  siteAccessed: true,
  suppliesAvailable: true,
  blockers: "  Lift out of service  ",
};

function submission(overrides: Record<string, unknown> = {}) {
  return {
    shiftId: "shift-1",
    templateKey: "OPENING_CHECK",
    templateVersion: 1,
    clientSubmissionId: "device-submission-0001",
    answers: openingAnswers,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.templateSubmission.findFirst.mockResolvedValue(null);
  mocks.prisma.plannedShift.findFirst.mockResolvedValue({
    id: "shift-1",
    employeeId: "employee-1",
    status: "ACTIVE",
  });
  mocks.prisma.templateSubmission.create.mockResolvedValue({
    id: "submission-1",
    shiftId: "shift-1",
    templateKey: "OPENING_CHECK",
    templateVersion: 1,
    answers: openingAnswers,
    submittedAt: new Date("2026-08-20T07:00:00Z"),
  });
});

describe("delivery template catalogue", () => {
  it("publishes the four cleaning templates with a version each", () => {
    const templates = listActiveTemplates();
    expect(templates.map((template) => template.key)).toEqual([
      "OPENING_CHECK",
      "COMMON_AREAS",
      "INCIDENT_NOTE",
      "COMPLETION_CONFIRMATION",
    ]);
    expect(templates.every((template) => template.version >= 1 && template.fields.length > 0)).toBe(true);
    expect(activeTemplate("INCIDENT_NOTE").fields.map((field) => field.key)).toContain("description");
  });

  it("refuses a version the device believes in but the server has moved past", () => {
    expect(() => assertSubmittableVersion("OPENING_CHECK", 99)).toThrow(/now at version 1/);
  });
});

describe("delivery template answers", () => {
  it("normalises the answers it keeps and drops anything the template did not ask for", () => {
    const { answers } = validateTemplateAnswers("OPENING_CHECK", 1, {
      ...openingAnswers,
      keysCollected: false,
      employeeLocation: "40.4,-3.7",
    });
    expect(answers).toEqual({
      siteAccessed: true,
      keysCollected: false,
      suppliesAvailable: true,
      blockers: "Lift out of service",
    });
    expect(answers).not.toHaveProperty("employeeLocation");
  });

  it("reports every unusable answer at once, by field", () => {
    let issues: Array<{ field: string; message: string }> = [];
    try {
      validateTemplateAnswers("INCIDENT_NOTE", 1, {
        incidentType: "METEORITE",
        description: "short",
        customerInformed: "yes",
      });
    } catch (error) {
      issues = (error as { issues: Array<{ field: string; message: string }> }).issues;
    }
    expect(issues.map((issue) => issue.field).sort()).toEqual([
      "customerInformed",
      "description",
      "incidentType",
    ]);
  });

  it("holds a number answer to the template's range", () => {
    expect(
      validateTemplateAnswers("COMPLETION_CONFIRMATION", 1, {
        outcome: "COMPLETED",
        minutesOnSite: "95",
      }).answers.minutesOnSite
    ).toBe(95);

    expect(() =>
      validateTemplateAnswers("COMPLETION_CONFIRMATION", 1, {
        outcome: "COMPLETED",
        minutesOnSite: 5_000,
      })
    ).toThrow(/between 0 and 1440/);
  });

  it("refuses a template version that was never published", () => {
    expect(() => validateTemplateAnswers("OPENING_CHECK", 7, openingAnswers)).toThrow(
      /no published version 7/
    );
  });

  it("renders a submission with the labels of the version that was answered", () => {
    expect(describeSubmission("OPENING_CHECK", 1, { siteAccessed: true, suppliesAvailable: false })).toBe(
      "Opening check v1 — Access to the site was obtained: yes | Materials and supplies available: no"
    );
    expect(describeSubmission("OPENING_CHECK", 99, {})).toMatch(/no longer published/);
  });
});

describe("delivery capture", () => {
  it("records one submission and audits the template version behind it", async () => {
    const result = await submitDeliveryTemplate(worker, submission());

    expect(result.created).toBe(true);
    expect(mocks.prisma.templateSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-1",
          templateKey: "OPENING_CHECK",
          templateVersion: 1,
          answers: expect.objectContaining({ blockers: "Lift out of service" }),
        }),
      })
    );
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "delivery_template.submitted" }),
      })
    );
  });

  it("treats a resent offline submission as the same submission", async () => {
    mocks.prisma.templateSubmission.findFirst.mockResolvedValue({
      id: "submission-1",
      shiftId: "shift-1",
      templateKey: "OPENING_CHECK",
      templateVersion: 1,
      answers: openingAnswers,
      submittedAt: new Date("2026-08-20T07:00:00Z"),
    });

    const result = await submitDeliveryTemplate(worker, submission());

    expect(result).toEqual({ submission: expect.objectContaining({ id: "submission-1" }), created: false });
    expect(mocks.prisma.templateSubmission.create).not.toHaveBeenCalled();
  });

  it("marks a submission carrying its own capture time as offline capture", async () => {
    await submitDeliveryTemplate(worker, submission({ submittedAt: "2026-08-20T06:45:00Z" }));

    expect(mocks.prisma.templateSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          capturedOffline: true,
          submittedAt: new Date("2026-08-20T06:45:00Z"),
        }),
      })
    );
  });

  it("does not accept answers for a shift the worker is not assigned to", async () => {
    mocks.prisma.plannedShift.findFirst.mockResolvedValue(null);

    await expect(submitDeliveryTemplate(worker, submission({ shiftId: "shift-other" }))).rejects.toThrow(
      /does not belong to this workspace/
    );
    expect(mocks.prisma.plannedShift.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ employeeId: "employee-1" }) })
    );
    expect(mocks.prisma.templateSubmission.create).not.toHaveBeenCalled();
  });

  it("does not accept answers for a cancelled shift", async () => {
    mocks.prisma.plannedShift.findFirst.mockResolvedValue({
      id: "shift-1",
      employeeId: "employee-1",
      status: "CANCELLED",
    });

    await expect(submitDeliveryTemplate(worker, submission())).rejects.toThrow(/cancelled shift/);
  });
});

describe("delivery capture readback", () => {
  it("summarises each submission for the coordinator", async () => {
    mocks.prisma.templateSubmission.findMany.mockResolvedValue([
      {
        id: "submission-1",
        templateKey: "OPENING_CHECK",
        templateVersion: 1,
        answers: { siteAccessed: true, suppliesAvailable: true },
        capturedOffline: false,
        submittedAt: new Date("2026-08-20T07:00:00Z"),
        employee: { user: { firstName: "Ana", lastName: "Lopez" } },
        evidence: [{ id: "attachment-1", fileName: "opening.jpg" }],
      },
    ]);

    const submissions = await listShiftSubmissions(manager, "shift-1");

    expect(submissions[0].summary).toMatch(/^Opening check v1 —/);
    expect(submissions[0].evidence).toEqual([{ id: "attachment-1", fileName: "opening.jpg" }]);
    expect(mocks.prisma.templateSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          evidence: { where: { status: "CLEAN", deletedAt: null }, select: { id: true, fileName: true } },
        }),
      })
    );
  });

  it("keeps the company-wide service view away from field workers", async () => {
    await expect(listServiceSubmissions(worker, "service-1")).rejects.toThrow(
      /cannot read the company service register/
    );
    expect(mocks.prisma.templateSubmission.findMany).not.toHaveBeenCalled();
  });
});
