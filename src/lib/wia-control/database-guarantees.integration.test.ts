import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

/**
 * The guarantees that do not live in TypeScript.
 *
 * Exclusion constraints, partial unique indexes and append-only triggers are
 * the last line: they hold when two requests race, and they hold when a server
 * credential issues SQL directly. No unit test can reach them, because a mocked
 * Prisma answers whatever the test asks it to.
 *
 * These run against a real PostgreSQL with every migration applied from
 * scratch, which also proves the migrations themselves still apply.
 */

const url = process.env.TEST_DATABASE_URL;

let db: Client;

/** Ordered so a truncate cascade never has to guess. */
const TABLES = [
  "ClockEvent",
  "ShiftCompletion",
  "TemplateSubmission",
  "AttendanceIncident",
  "CommunicationOutbox",
  "AuditLog",
  "PlannedShift",
  "Employee",
  "Worksite",
  "User",
  "Company",
];

async function sql(text: string, values: unknown[] = []) {
  return db.query(text, values);
}

/** The smallest world in which a clock event can exist. */
async function seed() {
  await sql(`INSERT INTO "Company"(id,name,"updatedAt") VALUES ('co-1','Fixture Co',now())`);
  await sql(
    `INSERT INTO "User"(id,email,"firstName","lastName","updatedAt") VALUES ('us-1','fixture@example.test','Fix','Ture',now())`
  );
  await sql(
    `INSERT INTO "Employee"(id,"companyId","userId","updatedAt") VALUES ('em-1','co-1','us-1',now())`
  );
  await sql(
    `INSERT INTO "User"(id,email,"firstName","lastName","updatedAt") VALUES ('us-2','other@example.test','Oth','Er',now())`
  );
  await sql(
    `INSERT INTO "Employee"(id,"companyId","userId","updatedAt") VALUES ('em-2','co-1','us-2',now())`
  );
  await sql(
    `INSERT INTO "Worksite"(id,"companyId",name,address,city,"updatedAt") VALUES ('ws-1','co-1','Site','Addr','City',now())`
  );
}

async function shift(
  id: string,
  start: string,
  end: string,
  options: { employeeId?: string | null; status?: string } = {}
) {
  const { employeeId = "em-1", status = "PLANNED" } = options;
  return sql(
    `INSERT INTO "PlannedShift"(id,"companyId","worksiteId","employeeId",title,"scheduledStart","scheduledEnd",status,"updatedAt")
     VALUES ($1,'co-1','ws-1',$2,'Shift',$3,$4,$5::"PlannedShiftStatus",now())`,
    [id, employeeId, start, end, status]
  );
}

async function clock(
  id: string,
  options: {
    shiftId?: string;
    type?: string;
    idempotencyKey?: string;
    previousEventHash?: string | null;
    integrityHash?: string | null;
    withPosition?: boolean;
  } = {}
) {
  const {
    shiftId = "sh-1",
    type = "CLOCK_IN",
    idempotencyKey = id,
    previousEventHash = null,
    integrityHash = `hash-${id}`,
    withPosition = true,
  } = options;
  return sql(
    `INSERT INTO "ClockEvent"(id,"companyId","shiftId","employeeId","worksiteId",type,method,"occurredAt","idempotencyKey",
                              latitude,longitude,"distanceMeters","verifiedAgainstRadiusMeters","previousEventHash","integrityHash")
     VALUES ($1,'co-1',$2,'em-1','ws-1',$3::"ClockEventType",'QR','2026-01-10 08:00',$4,$5,$6,12.5,75,$7,$8)`,
    [
      id,
      shiftId,
      type,
      idempotencyKey,
      withPosition ? 40.4168 : null,
      withPosition ? -3.7038 : null,
      previousEventHash,
      integrityHash,
    ]
  );
}

beforeAll(async () => {
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. These tests need a throwaway PostgreSQL with the migrations applied — see docs/WIACONTROL_RUNBOOKS.md section 10. They truncate every table they touch, so they are never run against a database you need."
    );
  }
  db = new Client({ connectionString: url });
  await db.connect();
});

afterAll(async () => {
  await db?.end();
});

beforeEach(async () => {
  await sql(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
  await seed();
});

describe("the migrations themselves", () => {
  it("leave every guarantee in place, so a migration that drops one fails here", async () => {
    const { rows } = await sql(`
      SELECT conname AS name FROM pg_constraint WHERE conname = 'PlannedShift_no_employee_double_booking'
      UNION ALL SELECT indexname FROM pg_indexes WHERE indexname IN ('ClockEvent_shift_chain_is_linear','ClockEvent_shift_chain_has_one_root')
      UNION ALL SELECT tgname FROM pg_trigger WHERE tgname IN
        ('ClockEvent_prevent_update','ClockEvent_prevent_delete','AuditLog_prevent_update','AuditLog_prevent_delete',
         'ShiftCompletion_prevent_update','ShiftCompletion_prevent_delete','TemplateSubmission_prevent_update','TemplateSubmission_prevent_delete')
      ORDER BY 1
    `);
    expect(rows.map((r) => r.name)).toEqual([
      "AuditLog_prevent_delete",
      "AuditLog_prevent_update",
      "ClockEvent_prevent_delete",
      "ClockEvent_prevent_update",
      "ClockEvent_shift_chain_has_one_root",
      "ClockEvent_shift_chain_is_linear",
      "PlannedShift_no_employee_double_booking",
      "ShiftCompletion_prevent_delete",
      "ShiftCompletion_prevent_update",
      "TemplateSubmission_prevent_delete",
      "TemplateSubmission_prevent_update",
    ]);
  });
});

describe("one person cannot be in two places at once", () => {
  it("refuses a second live shift that overlaps the first", async () => {
    await shift("sh-1", "2026-01-10 08:00", "2026-01-10 12:00");
    await expect(shift("sh-2", "2026-01-10 11:00", "2026-01-10 14:00")).rejects.toThrow(
      /PlannedShift_no_employee_double_booking/
    );
  });

  it("allows a shift that starts exactly when the previous one ends", async () => {
    await shift("sh-1", "2026-01-10 08:00", "2026-01-10 12:00");
    await expect(shift("sh-2", "2026-01-10 12:00", "2026-01-10 16:00")).resolves.toBeDefined();
  });

  it("lets two different people work the same hours", async () => {
    await shift("sh-1", "2026-01-10 08:00", "2026-01-10 12:00");
    await expect(
      shift("sh-2", "2026-01-10 08:00", "2026-01-10 12:00", { employeeId: "em-2" })
    ).resolves.toBeDefined();
  });

  it("does not let a cancelled shift block the replacement that covers it", async () => {
    await shift("sh-1", "2026-01-10 08:00", "2026-01-10 12:00", { status: "CANCELLED" });
    await expect(shift("sh-2", "2026-01-10 08:00", "2026-01-10 12:00")).resolves.toBeDefined();
  });

  it("does not let a finished shift block the next one", async () => {
    await shift("sh-1", "2026-01-10 08:00", "2026-01-10 12:00", { status: "COMPLETED" });
    await expect(shift("sh-2", "2026-01-10 08:00", "2026-01-10 12:00")).resolves.toBeDefined();
  });

  it("ignores unassigned shifts, which compete for nobody's time", async () => {
    await shift("sh-1", "2026-01-10 08:00", "2026-01-10 12:00", { employeeId: null });
    await expect(
      shift("sh-2", "2026-01-10 08:00", "2026-01-10 12:00", { employeeId: null })
    ).resolves.toBeDefined();
  });
});

describe("a shift's clock events form one line, not a tree", () => {
  beforeEach(async () => {
    await shift("sh-1", "2026-01-10 08:00", "2026-01-10 12:00");
  });

  it("refuses a second event claiming the same parent", async () => {
    await clock("ck-1");
    await clock("ck-2", { type: "BREAK_START", previousEventHash: "hash-ck-1" });
    await expect(
      clock("ck-3", { type: "BREAK_END", previousEventHash: "hash-ck-1" })
    ).rejects.toThrow(/ClockEvent_shift_chain_is_linear/);
  });

  it("refuses a second first-event on the same shift", async () => {
    await clock("ck-1");
    await expect(clock("ck-2", { type: "BREAK_START" })).rejects.toThrow(
      /ClockEvent_shift_chain_has_one_root/
    );
  });

  it("accepts a chain that stays linear", async () => {
    await clock("ck-1");
    await clock("ck-2", { type: "BREAK_START", previousEventHash: "hash-ck-1" });
    await expect(
      clock("ck-3", { type: "BREAK_END", previousEventHash: "hash-ck-2" })
    ).resolves.toBeDefined();
  });

  it("refuses a repeated idempotency key within the company, so a retry cannot double-count", async () => {
    await clock("ck-1", { idempotencyKey: "device-key-1" });
    await expect(
      clock("ck-2", {
        type: "BREAK_START",
        idempotencyKey: "device-key-1",
        previousEventHash: "hash-ck-1",
      })
    ).rejects.toThrow(/ClockEvent_companyId_idempotencyKey_key/);
  });
});

describe("a clock event cannot be rewritten", () => {
  beforeEach(async () => {
    await shift("sh-1", "2026-01-10 08:00", "2026-01-10 12:00");
    await clock("ck-1");
  });

  it("refuses a change to the time it happened", async () => {
    await expect(
      sql(`UPDATE "ClockEvent" SET "occurredAt"='2026-01-10 07:00' WHERE id='ck-1'`)
    ).rejects.toThrow(/append-only/);
  });

  it("refuses deletion", async () => {
    await expect(sql(`DELETE FROM "ClockEvent" WHERE id='ck-1'`)).rejects.toThrow(/append-only/);
  });

  /**
   * The one exception, and the reason the trigger had to be narrowed rather
   * than kept absolute: the privacy commitment is that an exact position stops
   * existing once the company's window has passed.
   */
  it("permits the location reduction the retention job performs", async () => {
    await sql(
      `UPDATE "ClockEvent" SET latitude=NULL, longitude=NULL, "locationReducedAt"=now() WHERE id='ck-1'`
    );
    const { rows } = await sql(
      `SELECT latitude, longitude, "distanceMeters", "verifiedAgainstRadiusMeters", "occurredAt", "locationReducedAt" FROM "ClockEvent" WHERE id='ck-1'`
    );
    expect(rows[0].latitude).toBeNull();
    expect(rows[0].longitude).toBeNull();
    expect(rows[0].locationReducedAt).not.toBeNull();
    // What justified the decision survives, so the record still explains itself.
    expect(Number(rows[0].distanceMeters)).toBe(12.5);
    expect(rows[0].verifiedAgainstRadiusMeters).toBe(75);
  });

  it("refuses a second reduction, so a reduced row is closed for good", async () => {
    await sql(
      `UPDATE "ClockEvent" SET latitude=NULL, longitude=NULL, "locationReducedAt"=now() WHERE id='ck-1'`
    );
    await expect(
      sql(`UPDATE "ClockEvent" SET "locationReducedAt"=now() WHERE id='ck-1'`)
    ).rejects.toThrow(/append-only/);
  });

  it("refuses a reduction that also changes the time", async () => {
    await expect(
      sql(
        `UPDATE "ClockEvent" SET latitude=NULL, longitude=NULL, "locationReducedAt"=now(), "occurredAt"='2026-01-10 07:00' WHERE id='ck-1'`
      )
    ).rejects.toThrow(/append-only/);
  });

  it("refuses a reduction that also rewrites the integrity hash", async () => {
    await expect(
      sql(
        `UPDATE "ClockEvent" SET latitude=NULL, longitude=NULL, "locationReducedAt"=now(), "integrityHash"='forged' WHERE id='ck-1'`
      )
    ).rejects.toThrow(/append-only/);
  });

  it("refuses marking a row reduced while the position is still there", async () => {
    await expect(
      sql(`UPDATE "ClockEvent" SET "locationReducedAt"=now() WHERE id='ck-1'`)
    ).rejects.toThrow(/append-only/);
  });
});

describe("the other append-only records", () => {
  beforeEach(async () => {
    await shift("sh-1", "2026-01-10 08:00", "2026-01-10 12:00");
  });

  it("keeps audit history from being rewritten or erased", async () => {
    await sql(
      `INSERT INTO "AuditLog"(id,"companyId",action,entity,"entityId") VALUES ('au-1','co-1','clock.clock_in','ClockEvent','ck-1')`
    );
    await expect(sql(`UPDATE "AuditLog" SET action='something.else' WHERE id='au-1'`)).rejects.toThrow(
      /append-only/
    );
    await expect(sql(`DELETE FROM "AuditLog" WHERE id='au-1'`)).rejects.toThrow(/append-only/);
  });

  it("keeps a recorded outcome from being changed after the fact", async () => {
    await sql(
      `INSERT INTO "ShiftCompletion"(id,"companyId","shiftId",outcome) VALUES ('sc-1','co-1','sh-1','PARTIALLY_COMPLETED')`
    );
    await expect(
      sql(`UPDATE "ShiftCompletion" SET outcome='COMPLETED' WHERE id='sc-1'`)
    ).rejects.toThrow(/append-only/);
    await expect(sql(`DELETE FROM "ShiftCompletion" WHERE id='sc-1'`)).rejects.toThrow(
      /append-only/
    );
  });

  it("keeps a submitted answer set from being edited into a different one", async () => {
    await sql(
      `INSERT INTO "TemplateSubmission"(id,"companyId","shiftId","templateKey","templateVersion",answers,"clientSubmissionId")
       VALUES ('ts-1','co-1','sh-1','closing',1,'{"done":false}'::jsonb,'client-1')`
    );
    await expect(
      sql(`UPDATE "TemplateSubmission" SET answers='{"done":true}'::jsonb WHERE id='ts-1'`)
    ).rejects.toThrow(/append-only/);
    await expect(sql(`DELETE FROM "TemplateSubmission" WHERE id='ts-1'`)).rejects.toThrow(
      /append-only/
    );
  });

  it("refuses a repeated client submission id, so a retry cannot store the answers twice", async () => {
    const insert = (id: string) =>
      sql(
        `INSERT INTO "TemplateSubmission"(id,"companyId","shiftId","templateKey","templateVersion",answers,"clientSubmissionId")
         VALUES ($1,'co-1','sh-1','closing',1,'{}'::jsonb,'client-1')`,
        [id]
      );
    await insert("ts-1");
    await expect(insert("ts-2")).rejects.toThrow(
      /TemplateSubmission_companyId_clientSubmissionId_key/
    );
  });
});

describe("work that must not be duplicated", () => {
  beforeEach(async () => {
    await shift("sh-1", "2026-01-10 08:00", "2026-01-10 12:00");
  });

  it("opens one incident per shift and type, however often the detector runs", async () => {
    const insert = (id: string) =>
      sql(
        `INSERT INTO "AttendanceIncident"(id,"companyId","shiftId","worksiteId",type,title,"updatedAt")
         VALUES ($1,'co-1','sh-1','ws-1','MISSING_CLOCK_IN','No clock-in',now())`,
        [id]
      );
    await insert("in-1");
    await expect(insert("in-2")).rejects.toThrow(
      /AttendanceIncident_companyId_shiftId_type_key/
    );
  });

  it("sends one message per deduplication key, however often the outbox is processed", async () => {
    const insert = (id: string) =>
      sql(
        `INSERT INTO "CommunicationOutbox"(id,"companyId",template,payload,"dedupeKey","updatedAt")
         VALUES ($1,'co-1','incident_opened','{}'::jsonb,'dedupe-1',now())`,
        [id]
      );
    await insert("cm-1");
    await expect(insert("cm-2")).rejects.toThrow(/CommunicationOutbox_companyId_dedupeKey_key/);
  });
});
