import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

/**
 * The attendance record itself, exercised end to end: the real service
 * functions, a real PostgreSQL, every migration applied and every trigger
 * live.
 *
 * This is the part of the product a labour inspector would ask about, so it is
 * the part where a mocked database is least acceptable as proof. Each test
 * names the staging checklist row it stands in for.
 */

const url = process.env.TEST_DATABASE_URL;

let db: Client;
let service: typeof import("@/lib/wia-control/service");

type Actor = { companyId: string; userId: string; role: "ADMIN" | "MANAGER" | "EMPLOYEE"; employeeId?: string };

const manager: Actor = { companyId: "co-1", userId: "us-manager", role: "MANAGER" };
const maya: Actor = { companyId: "co-1", userId: "us-maya", role: "EMPLOYEE", employeeId: "em-maya" };
const liam: Actor = { companyId: "co-1", userId: "us-liam", role: "EMPLOYEE", employeeId: "em-liam" };
const outsider: Actor = { companyId: "co-2", userId: "us-other", role: "ADMIN" };

const TABLES = [
  "ClockEvent",
  "ShiftCompletion",
  "TemplateSubmission",
  "AttendanceIncident",
  "CommunicationOutbox",
  "TimeCorrectionRequest",
  "AuditLog",
  "PlannedShift",
  "Service",
  "Employee",
  "Worksite",
  "Customer",
  "User",
  "Company",
];

const sql = (text: string, values: unknown[] = []) => db.query(text, values);

/**
 * Times are relative to the run, not fixed to a date.
 *
 * A clock event is refused if it is in the future or backdated more than a
 * day. That rule is the product working, so the fixture works around it the
 * way reality does: the shift being clocked already happened, a few hours ago.
 */
const NOW = new Date();
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const SHIFT_START = ago(240);
const SHIFT_END = ago(120);

async function seed() {
  await sql(
    `INSERT INTO "Company"(id,name,timezone,"updatedAt") VALUES ('co-1','Northstar','Europe/Madrid',now()),('co-2','Other','Europe/Madrid',now())`
  );
  await sql(
    `INSERT INTO "User"(id,"companyId",email,"firstName","lastName",role,"updatedAt") VALUES
       ('us-manager','co-1','m@fixture.test','QA','Manager','MANAGER',now()),
       ('us-maya','co-1','maya@fixture.test','Maya','Field','EMPLOYEE',now()),
       ('us-liam','co-1','liam@fixture.test','Liam','Field','EMPLOYEE',now()),
       ('us-other','co-2','o@fixture.test','Other','Admin','ADMIN',now())`
  );
  await sql(
    `INSERT INTO "Employee"(id,"companyId","userId",skills,"fieldStatus","updatedAt") VALUES
       ('em-maya','co-1','us-maya',ARRAY['cleaning','opening'],'AVAILABLE',now()),
       ('em-liam','co-1','us-liam',ARRAY['cleaning','evening'],'AVAILABLE',now())`
  );
  await sql(
    `INSERT INTO "Worksite"(id,"companyId",name,address,city,"radiusMeters","updatedAt")
     VALUES ('ws-central','co-1','Redwood Central','12 Redwood Avenue','Madrid',100,now())`
  );
}

/** The shift every attendance test clocks against. */
async function shift(id = "sh-1", employeeId: string | null = "em-maya") {
  await sql(
    `INSERT INTO "PlannedShift"(id,"companyId","worksiteId","employeeId",title,"scheduledStart","scheduledEnd",status,"gracePeriodMinutes","updatedAt")
     VALUES ($1,'co-1','ws-central',$2,'QA Morning Clean',$3,$4,'PLANNED',5,now())`,
    [id, employeeId, SHIFT_START, SHIFT_END]
  );
  return id;
}

function clock(overrides: Record<string, unknown> = {}) {
  return {
    shiftId: "sh-1",
    type: "CLOCK_IN",
    method: "QR",
    occurredAt: ago(239),
    idempotencyKey: "device-key-1",
    ...overrides,
  };
}

beforeAll(async () => {
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. See docs/WIACONTROL_RUNBOOKS.md section 10."
    );
  }
  if (/supabase|amazonaws|\.com/i.test(url)) {
    throw new Error(
      "TEST_DATABASE_URL points at a hosted database. This suite truncates every table it touches."
    );
  }
  process.env.DATABASE_URL = url;
  db = new Client({ connectionString: url });
  await db.connect();
  service = await import("@/lib/wia-control/service");
});

afterAll(async () => {
  await db?.end();
});

beforeEach(async () => {
  await sql(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
  await seed();
});

describe("checks 22 to 27 · the clocking sequence", () => {
  beforeEach(async () => {
    await shift();
  });

  it("check 22 · records a clock-in once, attributed to the worker", async () => {
    await service.recordClockEvent(maya, clock());
    const { rows } = await sql(
      `SELECT type,"employeeId","integrityHash" FROM "ClockEvent" WHERE "shiftId"='sh-1'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "CLOCK_IN", employeeId: "em-maya" });
    expect(rows[0].integrityHash).toBeTruthy();
  });

  it("checks 24 to 26 · records the full sequence as one chain", async () => {
    await service.recordClockEvent(maya, clock());
    await service.recordClockEvent(maya, clock({ type: "BREAK_START", occurredAt: ago(195), idempotencyKey: "k2" }));
    await service.recordClockEvent(maya, clock({ type: "BREAK_END", occurredAt: ago(180), idempotencyKey: "k3" }));
    await service.recordClockEvent(maya, clock({ type: "CLOCK_OUT", occurredAt: ago(122), idempotencyKey: "k4" }));

    const { rows } = await sql(
      `SELECT type,"previousEventHash","integrityHash" FROM "ClockEvent" WHERE "shiftId"='sh-1' ORDER BY "occurredAt"`
    );
    expect(rows.map((row) => row.type)).toEqual([
      "CLOCK_IN",
      "BREAK_START",
      "BREAK_END",
      "CLOCK_OUT",
    ]);
    // Each event names the one before it, and only the first has no parent.
    expect(rows[0].previousEventHash).toBeNull();
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index].previousEventHash).toBe(rows[index - 1].integrityHash);
    }
  });

  it("check 23 · refuses a transition that does not follow", async () => {
    await expect(
      service.recordClockEvent(maya, clock({ type: "BREAK_END" }))
    ).rejects.toBeDefined();
    await expect(sql(`SELECT count(*) n FROM "ClockEvent"`)).resolves.toMatchObject({
      rows: [{ n: "0" }],
    });
  });

  it("check 23b · refuses clocking in twice", async () => {
    await service.recordClockEvent(maya, clock());
    await expect(
      service.recordClockEvent(maya, clock({ idempotencyKey: "different-key" }))
    ).rejects.toBeDefined();
  });

  it("check 27 · a retry with the same key stores one event, not two", async () => {
    const first = await service.recordClockEvent(maya, clock());
    const retry = await service.recordClockEvent(maya, clock());
    expect(first.created).toBe(true);
    // The retry is answered from the stored event rather than writing a second.
    expect(retry.created).toBe(false);
    expect(retry.event.id).toBe(first.event.id);
    await expect(sql(`SELECT count(*) n FROM "ClockEvent"`)).resolves.toMatchObject({
      rows: [{ n: "1" }],
    });
  });

  it("refuses a worker clocking on somebody else's shift", async () => {
    await expect(service.recordClockEvent(liam, clock())).rejects.toBeDefined();
    await expect(sql(`SELECT count(*) n FROM "ClockEvent"`)).resolves.toMatchObject({
      rows: [{ n: "0" }],
    });
  });

  it("check 32 · the stored event cannot be edited or deleted afterwards", async () => {
    await service.recordClockEvent(maya, clock());
    await expect(
      sql(`UPDATE "ClockEvent" SET "occurredAt"=$1 WHERE "shiftId"='sh-1'`, [ago(300)])
    ).rejects.toThrow(/append-only/);
    await expect(sql(`DELETE FROM "ClockEvent" WHERE "shiftId"='sh-1'`)).rejects.toThrow(
      /append-only/
    );
  });
});

describe("checks 29 to 31 and 88 to 90 · time corrections", () => {
  let clockEventId: string;
  let storedOccurredAt: string;

  async function occurredAt() {
    const { rows } = await sql(`SELECT "occurredAt"::text AS t FROM "ClockEvent" WHERE id=$1`, [
      clockEventId,
    ]);
    return rows[0].t as string;
  }

  beforeEach(async () => {
    await shift();
    const event = await service.recordClockEvent(maya, clock());
    clockEventId = event.event.id;
    storedOccurredAt = await occurredAt();
  });

  it("check 29 · records the request and leaves the original untouched", async () => {
    await service.requestTimeCorrection(maya, {
      clockEventId,
      proposedOccurredAt: ago(245),
      reason: "The QR reader was out of order at the door.",
    });
    expect(await occurredAt()).toBe(storedOccurredAt);
    await expect(sql(`SELECT count(*) n FROM "TimeCorrectionRequest"`)).resolves.toMatchObject({
      rows: [{ n: "1" }],
    });
  });

  it("check 31 · refuses a request with no usable reason", async () => {
    await expect(
      service.requestTimeCorrection(maya, {
        clockEventId,
        proposedOccurredAt: ago(245),
        reason: "wrong",
      })
    ).rejects.toBeDefined();
    await expect(sql(`SELECT count(*) n FROM "TimeCorrectionRequest"`)).resolves.toMatchObject({
      rows: [{ n: "0" }],
    });
  });

  it("check 30 · an approval is attributed and audited", async () => {
    const correction = await service.requestTimeCorrection(maya, {
      clockEventId,
      proposedOccurredAt: ago(245),
      reason: "The QR reader was out of order at the door.",
    });
    await service.reviewTimeCorrection(manager, correction.id, {
      status: "APPROVED",
      note: "Confirmed with the site supervisor.",
    });
    const { rows } = await sql(
      `SELECT status,"reviewedByUserId","reviewNote","companyReviewedAt" FROM "TimeCorrectionRequest" WHERE id=$1`,
      [correction.id]
    );
    expect(rows[0].status).toBe("APPROVED");
    // Who decided, when, and on what grounds — the three things a review has
    // to leave behind to be traceable at all.
    expect(rows[0].reviewedByUserId).toBe("us-manager");
    expect(rows[0].companyReviewedAt).not.toBeNull();
    expect(rows[0].reviewNote).toMatch(/site supervisor/);
  });

  it("check 88 · a rejection keeps the original clock exactly as it was", async () => {
    const correction = await service.requestTimeCorrection(maya, {
      clockEventId,
      proposedOccurredAt: ago(245),
      reason: "The QR reader was out of order at the door.",
    });
    await service.reviewTimeCorrection(manager, correction.id, {
      status: "REJECTED",
      note: "The door log shows the reader working.",
    });
    expect(await occurredAt()).toBe(storedOccurredAt);
  });

  it("check 90 · a dispute keeps the worker's stated reason readable after closing", async () => {
    const correction = await service.requestTimeCorrection(maya, {
      clockEventId,
      proposedOccurredAt: ago(245),
      reason: "The QR reader was out of order at the door.",
    });
    await service.reviewTimeCorrection(manager, correction.id, {
      status: "REJECTED",
      note: "The door log shows the reader working.",
    });
    await service.acknowledgeTimeCorrection(maya, correction.id, {
      accepted: false,
      disagreementReason: "I have a photograph of the out-of-order sign.",
    });
    const { rows } = await sql(
      `SELECT status,"disagreementReason" FROM "TimeCorrectionRequest" WHERE id=$1`,
      [correction.id]
    );
    expect(rows[0].status).toBe("DISPUTED");
    expect(rows[0].disagreementReason).toMatch(/photograph/);
  });

  it("refuses a coordinator from another company reviewing it", async () => {
    const correction = await service.requestTimeCorrection(maya, {
      clockEventId,
      proposedOccurredAt: ago(245),
      reason: "The QR reader was out of order at the door.",
    });
    await expect(
      service.reviewTimeCorrection(outsider, correction.id, { status: "APPROVED" })
    ).rejects.toBeDefined();
  });
});

describe("checks 33 to 39 · incidents", () => {
  beforeEach(async () => {
    await shift();
  });

  it("check 33 · opens one incident for a shift nobody clocked into", async () => {
    // Well after the shift and its grace period.
    await service.detectIncompleteAttendance(manager, NOW);
    const { rows } = await sql(`SELECT type,status FROM "AttendanceIncident" WHERE "shiftId"='sh-1'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("OPEN");
  });

  it("check 34 · running the detector again opens no duplicate", async () => {
    await service.detectIncompleteAttendance(manager, NOW);
    await service.detectIncompleteAttendance(manager, new Date(NOW.getTime() + 60_000));
    await expect(sql(`SELECT count(*) n FROM "AttendanceIncident"`)).resolves.toMatchObject({
      rows: [{ n: "1" }],
    });
  });

  it("checks 35 to 38 · acknowledging, assigning, escalating and resolving all persist", async () => {
    await service.detectIncompleteAttendance(manager, NOW);
    const { rows: opened } = await sql(`SELECT id FROM "AttendanceIncident" LIMIT 1`);
    const incidentId = opened[0].id;

    await service.updateAttendanceIncident(manager, incidentId, { status: "ACKNOWLEDGED" });
    await service.updateAttendanceIncident(manager, incidentId, {
      action: "ASSIGN",
      ownerId: "us-manager",
    });
    await service.updateAttendanceIncident(manager, incidentId, {
      action: "ESCALATE",
      note: "No answer from the worker after two calls.",
    });
    await service.updateAttendanceIncident(manager, incidentId, {
      status: "RESOLVED",
      resolutionNotes: "Covered by Liam; worker was ill.",
    });

    const { rows } = await sql(
      `SELECT status,"acknowledgedAt","resolvedAt","ownerId","resolutionNotes" FROM "AttendanceIncident" WHERE id=$1`,
      [incidentId]
    );
    expect(rows[0].status).toBe("RESOLVED");
    expect(rows[0].acknowledgedAt).not.toBeNull();
    expect(rows[0].resolvedAt).not.toBeNull();
    expect(rows[0].ownerId).toBe("us-manager");
    expect(rows[0].resolutionNotes).toMatch(/Covered by Liam/);
  });

  it("refuses an incident belonging to another company", async () => {
    await service.detectIncompleteAttendance(manager, NOW);
    const { rows: opened } = await sql(`SELECT id FROM "AttendanceIncident" LIMIT 1`);
    await expect(
      service.updateAttendanceIncident(outsider, opened[0].id, { status: "ACKNOWLEDGED" })
    ).rejects.toBeDefined();
  });
});

describe("checks 43 to 45 · recording how the shift went", () => {
  beforeEach(async () => {
    await shift();
  });

  it("check 43 · stores the outcome against the shift", async () => {
    await service.completePlannedShift(maya, "sh-1", {
      outcome: "COMPLETED",
      note: "All areas done.",
    });
    const { rows } = await sql(`SELECT outcome FROM "ShiftCompletion" WHERE "shiftId"='sh-1'`);
    expect(rows[0].outcome).toBe("COMPLETED");
  });

  it("check 44 · refuses a partial outcome with no explanation", async () => {
    await expect(
      service.completePlannedShift(maya, "sh-1", { outcome: "PARTIALLY_COMPLETED" })
    ).rejects.toBeDefined();
    await expect(sql(`SELECT count(*) n FROM "ShiftCompletion"`)).resolves.toMatchObject({
      rows: [{ n: "0" }],
    });
  });

  it("check 45 · the stored outcome cannot be edited or deleted afterwards", async () => {
    await service.completePlannedShift(maya, "sh-1", {
      outcome: "PARTIALLY_COMPLETED",
      note: "The third floor was locked.",
    });
    await expect(
      sql(`UPDATE "ShiftCompletion" SET outcome='COMPLETED' WHERE "shiftId"='sh-1'`)
    ).rejects.toThrow(/append-only/);
    await expect(sql(`DELETE FROM "ShiftCompletion" WHERE "shiftId"='sh-1'`)).rejects.toThrow(
      /append-only/
    );
  });

  it("refuses a second completion for the same shift", async () => {
    await service.completePlannedShift(maya, "sh-1", { outcome: "COMPLETED" });
    await expect(
      service.completePlannedShift(maya, "sh-1", { outcome: "COMPLETED" })
    ).rejects.toBeDefined();
  });
});

describe("checks 47, 48 and 91 to 94 · exports", () => {
  const from = new Date(NOW.getTime() - 24 * 60 * 60_000);
  const to = new Date(NOW.getTime() + 60 * 60_000);

  beforeEach(async () => {
    await sql(
      `UPDATE "Worksite" SET latitude=40.4168, longitude=-3.7038 WHERE id='ws-central'`
    );
    await shift();
    await service.recordClockEvent(
      maya,
      clock({ latitude: 40.4168, longitude: -3.7038, accuracyMeters: 8 })
    );
  });

  it("check 47 · the attendance export returns this company's events", async () => {
    const rows = await service.exportClockEvents(manager, from, to);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "CLOCK_IN" });
  });

  it("check 48 · another company's export contains none of them", async () => {
    await expect(service.exportClockEvents(outsider, from, to)).resolves.toEqual([]);
  });

  it("refuses a field worker exporting the company register", async () => {
    await expect(service.exportClockEvents(maya, from, to)).rejects.toBeDefined();
  });

  it("check 91 · the incident export is company-scoped too", async () => {
    await service.detectIncompleteAttendance(manager, NOW);
    await expect(service.exportIncidents(manager, from, to)).resolves.toHaveLength(1);
    await expect(service.exportIncidents(outsider, from, to)).resolves.toEqual([]);
  });

  it("check 94 · a reduced clock still exports its distance and radius", async () => {
    await sql(
      `UPDATE "ClockEvent" SET latitude=NULL, longitude=NULL, "locationReducedAt"=now() WHERE "shiftId"='sh-1'`
    );
    const rows = await service.exportClockEvents(manager, from, to);
    expect(rows).toHaveLength(1);
    const { rows: stored } = await sql(
      `SELECT latitude,"verifiedAgainstRadiusMeters" FROM "ClockEvent" WHERE "shiftId"='sh-1'`
    );
    expect(stored[0].latitude).toBeNull();
    expect(stored[0].verifiedAgainstRadiusMeters).not.toBeNull();
  });
});
