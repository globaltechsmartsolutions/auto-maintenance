import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    clockEvent: { findMany: vi.fn() },
    attendanceIncident: { findMany: vi.fn() },
    coverageDecision: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return { prisma };
});

vi.mock("@/lib/prisma", () => ({ getPrisma: () => mocks.prisma }));

import {
  buildExport,
  exportDefinitions,
  exportFieldDictionary,
  exportFileName,
  toCsv,
} from "@/lib/wia-control/exports";
import {
  exportClockEvents,
  exportCoverageDecisions,
  exportIncidents,
  type WiaActor,
} from "@/lib/wia-control/service";

const manager: WiaActor = { companyId: "company-1", userId: "user-manager", role: "MANAGER" };
const worker: WiaActor = { companyId: "company-1", userId: "user-worker", role: "EMPLOYEE", employeeId: "employee-1" };
const from = new Date("2026-08-01T00:00:00Z");
const to = new Date("2026-09-01T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.clockEvent.findMany.mockResolvedValue([]);
  mocks.prisma.attendanceIncident.findMany.mockResolvedValue([]);
  mocks.prisma.coverageDecision.findMany.mockResolvedValue([]);
});

describe("CSV rendering", () => {
  it("quotes every cell, escapes quotes, and renders dates as UTC ISO", () => {
    const csv = toCsv(
      ["Name", "When", "Flag", "Missing"],
      [['He said "yes"', new Date("2026-08-20T09:00:00Z"), false, null]]
    );
    expect(csv).toBe(
      '﻿"Name";"When";"Flag";"Missing"\n"He said ""yes""";"2026-08-20T09:00:00.000Z";"false";""'
    );
  });

  it("marks a cell that a spreadsheet would otherwise run as a formula", () => {
    const csv = toCsv(
      ["Worksite", "Notes"],
      [['=HYPERLINK("https://attacker.example","open")', "+1 555 0100"]]
    );
    // Quoting alone does not stop Excel or Sheets evaluating these.
    expect(csv).toContain("\"'=HYPERLINK");
    expect(csv).toContain("\"'+1 555 0100\"");
  });

  it("leaves ordinary text untouched", () => {
    expect(toCsv(["Name"], [["Redwood Central"]])).toContain('"Redwood Central"');
  });

  it("produces byte-identical output for identical input", () => {
    const rows = [["a", 1, true]];
    expect(toCsv(["x", "y", "z"], rows)).toBe(toCsv(["x", "y", "z"], rows));
  });

  it("names a file by dataset and period, never by the moment of download", () => {
    expect(exportFileName("attendance", from, to)).toBe(
      "wiacontrol-attendance-2026-08-01-to-2026-09-01.csv"
    );
  });
});

describe("declared columns", () => {
  it("documents a purpose, an ordering, and a described source for every column", () => {
    for (const definition of exportFieldDictionary()) {
      expect(definition.purpose.length).toBeGreaterThan(20);
      expect(definition.ordering.length).toBeGreaterThan(10);
      expect(definition.columns.length).toBeGreaterThan(0);
      for (const column of definition.columns) {
        expect(column.description.length).toBeGreaterThan(10);
        expect(column.source.length).toBeGreaterThan(2);
      }
    }
  });

  it("has no duplicate header within a dataset", () => {
    for (const definition of Object.values(exportDefinitions)) {
      const headers = definition.columns.map((column) => column.header);
      expect(new Set(headers).size).toBe(headers.length);
    }
  });

  it("refuses to write a column the dictionary does not declare", () => {
    expect(() =>
      buildExport("incidents", [{}], () => ({ "Incident id": "incident-1", "Secret field": "x" }))
    ).toThrow(/undeclared columns: Secret field/);
  });

  it("writes an empty cell for a declared column the row omits, keeping every file the same shape", () => {
    const { headers, csv } = buildExport("coverage", [{}], () => ({ "Decision id": "decision-1" }));
    expect(csv.split("\n")[1].split(";")).toHaveLength(headers.length);
    expect(csv).toContain('"decision-1"');
  });
});

describe("published documentation", () => {
  it("documents every declared column, so a new column cannot ship undocumented", async () => {
    const { readFile } = await import("node:fs/promises");
    const documentation = await readFile("docs/WIACONTROL_EXPORT_FIELDS.md", "utf8");
    for (const definition of Object.values(exportDefinitions)) {
      for (const column of definition.columns) {
        expect(documentation).toContain(`| ${column.header} |`);
      }
    }
  });
});

describe("export queries", () => {
  it("scopes attendance to the company and orders it reproducibly", async () => {
    await exportClockEvents(manager, from, to);

    expect(mocks.prisma.clockEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company-1", occurredAt: { gte: from, lt: to } },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      })
    );
  });

  it("scopes incidents and coverage decisions the same way and audits the export", async () => {
    await exportIncidents(manager, from, to);
    await exportCoverageDecisions(manager, from, to);

    expect(mocks.prisma.attendanceIncident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company-1", detectedAt: { gte: from, lt: to } },
        orderBy: [{ detectedAt: "asc" }, { id: "asc" }],
      })
    );
    expect(mocks.prisma.coverageDecision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company-1", createdAt: { gte: from, lt: to } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
    );
    expect(
      mocks.prisma.auditLog.create.mock.calls.map((call) => (call[0] as { data: { action: string } }).data.action)
    ).toEqual(["incident_report.exported", "coverage_report.exported"]);
  });

  it("refuses a period too wide to answer in one file", async () => {
    await expect(
      exportIncidents(manager, new Date("2020-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"))
    ).rejects.toThrow(/at most 366 days/);
    expect(mocks.prisma.attendanceIncident.findMany).not.toHaveBeenCalled();
  });

  it("refuses a result set too large to build, naming the size", async () => {
    mocks.prisma.attendanceIncident.findMany.mockResolvedValue(
      Array.from({ length: 100_001 }, (_, index) => ({ id: `incident-${index}` }))
    );

    await expect(exportIncidents(manager, from, to)).rejects.toThrow(/more than the 100000/);
    expect(mocks.prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("refuses a field worker and an inverted period", async () => {
    await expect(exportIncidents(worker, from, to)).rejects.toThrow(/cannot export the full record/);
    await expect(exportCoverageDecisions(manager, to, from)).rejects.toThrow(
      /end must be later than the start/
    );
    expect(mocks.prisma.attendanceIncident.findMany).not.toHaveBeenCalled();
  });
});
