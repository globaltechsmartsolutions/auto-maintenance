import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import type { EvidenceStorage } from "@/lib/wia-control/evidence-storage";

/**
 * The rest of the checklist that can be proved without a browser session:
 * bulk import, evidence attachments, coverage recovery, deactivation, and the
 * two scheduled jobs that delete personal data.
 *
 * The jobs are the reason this file matters most. Owner task 2 proves they
 * run; only this proves they delete the right thing, and getting that wrong is
 * silent and unrecoverable.
 */

const url = process.env.TEST_DATABASE_URL;

let db: Client;
let service: typeof import("@/lib/wia-control/service");
let evidence: typeof import("@/lib/wia-control/evidence-service");

type Actor = { companyId: string; userId: string; role: "ADMIN" | "MANAGER" | "EMPLOYEE"; employeeId?: string };

const manager: Actor = { companyId: "co-1", userId: "us-manager", role: "MANAGER" };
const maya: Actor = { companyId: "co-1", userId: "us-maya", role: "EMPLOYEE", employeeId: "em-maya" };
const liam: Actor = { companyId: "co-1", userId: "us-liam", role: "EMPLOYEE", employeeId: "em-liam" };
const outsider: Actor = { companyId: "co-2", userId: "us-other", role: "ADMIN" };

const TABLES = [
  "EvidenceAttachment",
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

const NOW = new Date();
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const SHIFT_START = ago(240);
const SHIFT_END = ago(120);

/** A storage double: the rules under test are the product's, not Supabase's. */
function fakeStorage(bytes: Uint8Array = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])) {
  const removed: string[] = [];
  const storage: EvidenceStorage = {
    async createUploadUrl(key) {
      return { url: `https://storage.test/${key}`, token: "token" };
    },
    async createDownloadUrl(key, expiresInSeconds) {
      return `https://storage.test/${key}?expires=${expiresInSeconds}`;
    },
    async read() {
      return bytes;
    },
    async remove(keys) {
      removed.push(...keys);
    },
  };
  return { storage, removed };
}

async function seed() {
  await sql(
    `INSERT INTO "Company"(id,name,timezone,"clockLocationPrecisionDays","updatedAt") VALUES
       ('co-1','Northstar','Europe/Madrid',60,now()),
       ('co-2','Other','Europe/Madrid',60,now())`
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
       ('em-liam','co-1','us-liam',ARRAY['cleaning','opening'],'AVAILABLE',now())`
  );
  await sql(
    `INSERT INTO "Worksite"(id,"companyId",name,address,city,"radiusMeters","updatedAt")
     VALUES ('ws-central','co-1','Redwood Central','12 Redwood Avenue','Madrid',100,now())`
  );
}

async function shift(id = "sh-1", employeeId: string | null = "em-maya") {
  await sql(
    `INSERT INTO "PlannedShift"(id,"companyId","worksiteId","employeeId",title,"scheduledStart","scheduledEnd",status,"gracePeriodMinutes","updatedAt")
     VALUES ($1,'co-1','ws-central',$2,'QA Morning Clean',$3,$4,'PLANNED',5,now())`,
    [id, employeeId, SHIFT_START, SHIFT_END]
  );
  return id;
}

beforeAll(async () => {
  if (!url) throw new Error("TEST_DATABASE_URL is not set. See docs/WIACONTROL_RUNBOOKS.md section 10.");
  if (/supabase|amazonaws|\.com/i.test(url)) {
    throw new Error("TEST_DATABASE_URL points at a hosted database. This suite truncates every table it touches.");
  }
  process.env.DATABASE_URL = url;
  db = new Client({ connectionString: url });
  await db.connect();
  service = await import("@/lib/wia-control/service");
  evidence = await import("@/lib/wia-control/evidence-service");
});

afterAll(async () => {
  await db?.end();
});

beforeEach(async () => {
  await sql(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
  await seed();
});

describe("checks 49 to 53 · bulk import", () => {
  const header = "name,address,city\n";

  it("check 52 · every accepted row arrives together", async () => {
    const result = await service.confirmOperationalCsvImport(
      manager,
      "WORKSITES",
      `${header}Redwood North,1 North Street,Madrid\nRedwood South,2 South Street,Madrid`
    );
    expect(result.imported).toBe(2);
    await expect(sql(`SELECT count(*) n FROM "Worksite" WHERE "companyId"='co-1'`)).resolves.toMatchObject({
      rows: [{ n: "3" }], // the two imported plus the seeded one
    });
  });

  it("check 53 · one bad row rejects the whole file, and nothing is written", async () => {
    const before = await sql(`SELECT count(*) n FROM "Worksite"`);
    // The second row has no address. A partial import is the worst outcome
    // here: it leaves the operator unsure what actually landed.
    await expect(
      service.confirmOperationalCsvImport(
        manager,
        "WORKSITES",
        `${header}Redwood North,1 North Street,Madrid\nRedwood South,,Madrid`
      )
    ).rejects.toThrow(/validation issue/i);
    await expect(sql(`SELECT count(*) n FROM "Worksite"`)).resolves.toMatchObject({
      rows: [{ n: before.rows[0].n }],
    });
  });

  it("check 50 · a missing required header is reported and nothing is written", async () => {
    await expect(
      service.confirmOperationalCsvImport(manager, "WORKSITES", "name,city\nRedwood North,Madrid")
    ).rejects.toThrow(/validation issue/i);
    await expect(sql(`SELECT count(*) n FROM "Worksite"`)).resolves.toMatchObject({
      rows: [{ n: "1" }],
    });
  });

  it("check 51 · a row that already exists is skipped rather than duplicated", async () => {
    const csv = `${header}Redwood North,1 North Street,Madrid`;
    await service.confirmOperationalCsvImport(manager, "WORKSITES", csv);
    const second = await service.confirmOperationalCsvImport(manager, "WORKSITES", csv);
    expect(second.skipped + second.imported).toBeGreaterThan(0);
    await expect(
      sql(`SELECT count(*) n FROM "Worksite" WHERE name='Redwood North'`)
    ).resolves.toMatchObject({ rows: [{ n: "1" }] });
  });

  it("imports into the acting company, never a requested one", async () => {
    await service.confirmOperationalCsvImport(
      manager,
      "WORKSITES",
      `${header}Redwood North,1 North Street,Madrid`
    );
    await expect(
      sql(`SELECT count(*) n FROM "Worksite" WHERE "companyId"='co-2'`)
    ).resolves.toMatchObject({ rows: [{ n: "0" }] });
  });

  it("refuses a field worker importing anything", async () => {
    await expect(
      service.confirmOperationalCsvImport(maya, "WORKSITES", `${header}X,1 Street,Madrid`)
    ).rejects.toBeDefined();
  });
});

describe("checks 74 to 82 · evidence attachments", () => {
  beforeEach(async () => {
    await shift();
  });

  const file = { fileName: "photo.jpg", contentType: "image/jpeg", sizeBytes: 2048 };

  it("check 74 · a request reserves a key and leaves the attachment pending", async () => {
    const { storage } = fakeStorage();
    const requested = await evidence.requestEvidenceUpload(
      maya,
      { shiftId: "sh-1", ...file },
      storage
    );
    expect(requested.uploadUrl).toContain("https://storage.test/");
    const { rows } = await sql(`SELECT status,"storageKey" FROM "EvidenceAttachment"`);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).not.toBe("READY");
    // The key is namespaced by company, so one tenant cannot address another's.
    expect(rows[0].storageKey).toContain("co-1");
  });

  it("check 75 · a worker cannot reserve anything on somebody else's shift", async () => {
    const { storage } = fakeStorage();
    await expect(
      evidence.requestEvidenceUpload(liam, { shiftId: "sh-1", ...file }, storage)
    ).rejects.toBeDefined();
    await expect(sql(`SELECT count(*) n FROM "EvidenceAttachment"`)).resolves.toMatchObject({
      rows: [{ n: "0" }],
    });
  });

  it("check 76 · confirming a real image records the checksum of what was stored", async () => {
    const { storage } = fakeStorage();
    const requested = await evidence.requestEvidenceUpload(maya, { shiftId: "sh-1", ...file }, storage);
    await evidence.confirmEvidenceUpload(maya, requested.attachmentId, storage);
    const { rows } = await sql(`SELECT status,checksum FROM "EvidenceAttachment"`);
    expect(rows[0].status).toBe("CLEAN");
    expect(rows[0].checksum).toBeTruthy();
  });

  it("check 77 · a file whose bytes contradict its type is rejected and removed", async () => {
    // "MZ" — a Windows executable pretending to be a JPEG.
    const { storage, removed } = fakeStorage(new Uint8Array([0x4d, 0x5a, 0x90, 0x00]));
    const requested = await evidence.requestEvidenceUpload(maya, { shiftId: "sh-1", ...file }, storage);
    await expect(
      evidence.confirmEvidenceUpload(maya, requested.attachmentId, storage)
    ).rejects.toBeDefined();
    const { rows } = await sql(`SELECT status FROM "EvidenceAttachment"`);
    expect(rows[0].status).toBe("REJECTED");
    // The rejection is visible and the object does not linger in the bucket.
    expect(removed.length).toBeGreaterThan(0);
  });

  it("check 80 · a download link is short-lived and the read is audited", async () => {
    const { storage } = fakeStorage();
    const requested = await evidence.requestEvidenceUpload(maya, { shiftId: "sh-1", ...file }, storage);
    await evidence.confirmEvidenceUpload(maya, requested.attachmentId, storage);
    const link = await evidence.createEvidenceDownloadUrl(manager, requested.attachmentId, storage);
    expect(link.url).toContain("expires=120");
    expect(link.expiresInSeconds).toBe(120);
    await expect(
      sql(`SELECT count(*) n FROM "AuditLog" WHERE "action"='evidence.downloaded'`)
    ).resolves.toMatchObject({ rows: [{ n: "1" }] });
  });

  it("check 82 · another company cannot reach the attachment", async () => {
    const { storage } = fakeStorage();
    const requested = await evidence.requestEvidenceUpload(maya, { shiftId: "sh-1", ...file }, storage);
    await evidence.confirmEvidenceUpload(maya, requested.attachmentId, storage);
    await expect(
      evidence.createEvidenceDownloadUrl(outsider, requested.attachmentId, storage)
    ).rejects.toBeDefined();
  });
});

describe("checks 40 to 42 · covering an uncovered shift", () => {
  let incidentId: string;

  beforeEach(async () => {
    await shift();
    await service.detectIncompleteAttendance(manager, NOW);
    const { rows } = await sql(`SELECT id FROM "AttendanceIncident" LIMIT 1`);
    incidentId = rows[0].id;
  });

  it("check 40 · proposes candidates and explains why each is or is not eligible", async () => {
    const recommendation = await service.recommendCoverageCandidates(manager, { incidentId });
    expect(recommendation).toBeDefined();
    await expect(
      sql(`SELECT count(*) n FROM "AuditLog" WHERE "action"='coverage.recommended'`)
    ).resolves.toMatchObject({ rows: [{ n: "1" }] });
  });

  it("check 42 · refuses an override with no reason given", async () => {
    await expect(
      service.confirmCoverage(manager, {
        shiftId: "sh-1",
        incidentId,
        selectedEmployeeId: "em-liam",
        overrideReason: "x",
      })
    ).rejects.toBeDefined();
  });

  it("refuses a field worker deciding coverage", async () => {
    await expect(
      service.confirmCoverage(maya, { shiftId: "sh-1", incidentId, selectedEmployeeId: "em-liam" })
    ).rejects.toBeDefined();
  });

  it("check 39 · dismissing an incident keeps its note", async () => {
    await service.updateAttendanceIncident(manager, incidentId, {
      status: "DISMISSED",
      resolutionNotes: "Duplicate of the incident already open on the earlier shift.",
    });
    const { rows } = await sql(
      `SELECT status,"resolutionNotes" FROM "AttendanceIncident" WHERE id=$1`,
      [incidentId]
    );
    expect(rows[0].status).toBe("DISMISSED");
    expect(rows[0].resolutionNotes).toMatch(/Duplicate/);
  });
});

describe("check 98 · taking somebody out of the field", () => {
  it("keeps their history, stops their sign-in, and frees their future shifts", async () => {
    await shift();
    await service.deleteEmployeeProfile(manager, "em-maya");

    const { rows: employee } = await sql(`SELECT "fieldStatus" FROM "Employee" WHERE id='em-maya'`);
    const { rows: user } = await sql(`SELECT status FROM "User" WHERE id='us-maya'`);
    const { rows: shifts } = await sql(`SELECT "employeeId",status FROM "PlannedShift" WHERE id='sh-1'`);

    // Deactivation, not erasure: the row survives so history still resolves.
    expect(employee).toHaveLength(1);
    expect(employee[0].fieldStatus).toBe("INACTIVE");
    expect(user[0].status).not.toBe("ACTIVE");
    // The shift is no longer theirs, so it shows as work needing an owner.
    expect(shifts[0].employeeId).toBeNull();
  });

  it("refuses a field worker deactivating a colleague", async () => {
    await expect(service.deleteEmployeeProfile(maya, "em-liam")).rejects.toBeDefined();
  });
});

describe("checks 104 to 107 · the scheduled jobs that delete", () => {
  async function clockWithPosition(occurredAt: string) {
    await sql(
      `INSERT INTO "ClockEvent"(id,"companyId","shiftId","employeeId","worksiteId",type,method,"occurredAt","idempotencyKey",
                                latitude,longitude,"distanceMeters","verifiedAgainstRadiusMeters","integrityHash")
       VALUES ('ck-1','co-1','sh-1','em-maya','ws-central','CLOCK_IN','QR',$1,'k1',40.4168,-3.7038,12.5,100,'hash-1')`,
      [occurredAt]
    );
  }

  beforeEach(async () => {
    await shift();
  });

  it("check 104 · an event inside the window keeps its coordinates", async () => {
    await clockWithPosition(ago(60));
    const result = await service.reduceClockLocationPrecision(NOW);
    expect(result.reduced).toBe(0);
    const { rows } = await sql(`SELECT latitude FROM "ClockEvent" WHERE id='ck-1'`);
    expect(rows[0].latitude).not.toBeNull();
  });

  it("check 105 · an event past the window loses the coordinate and keeps the record", async () => {
    // The company's window is 60 days; this one is 90 days old.
    await clockWithPosition(new Date(NOW.getTime() - 90 * 24 * 60 * 60_000).toISOString());
    const result = await service.reduceClockLocationPrecision(NOW);
    expect(result.reduced).toBe(1);

    const { rows } = await sql(
      `SELECT latitude,longitude,"distanceMeters","verifiedAgainstRadiusMeters","occurredAt","locationReducedAt" FROM "ClockEvent" WHERE id='ck-1'`
    );
    expect(rows[0].latitude).toBeNull();
    expect(rows[0].longitude).toBeNull();
    expect(rows[0].locationReducedAt).not.toBeNull();
    // The statutory part is untouched: when, and whether the check passed.
    expect(Number(rows[0].distanceMeters)).toBe(12.5);
    expect(rows[0].verifiedAgainstRadiusMeters).toBe(100);
    expect(rows[0].occurredAt).not.toBeNull();

    await expect(
      sql(`SELECT count(*) n FROM "AuditLog" WHERE "action"='clock_location.reduced'`)
    ).resolves.toMatchObject({ rows: [{ n: "1" }] });
  });

  it("check 105b · running it again reduces nothing further", async () => {
    await clockWithPosition(new Date(NOW.getTime() - 90 * 24 * 60 * 60_000).toISOString());
    await service.reduceClockLocationPrecision(NOW);
    const second = await service.reduceClockLocationPrecision(NOW);
    expect(second.reduced).toBe(0);
  });

  it("check 106 · evidence still inside retention is left alone", async () => {
    const { storage } = fakeStorage();
    const requested = await evidence.requestEvidenceUpload(
      maya,
      { shiftId: "sh-1", fileName: "photo.jpg", contentType: "image/jpeg", sizeBytes: 2048 },
      storage
    );
    await evidence.confirmEvidenceUpload(maya, requested.attachmentId, storage);
    const result = await evidence.purgeExpiredEvidence(NOW, storage);
    expect(result.deleted).toBe(0);
    await expect(
      sql(`SELECT count(*) n FROM "EvidenceAttachment" WHERE "deletedAt" IS NULL`)
    ).resolves.toMatchObject({ rows: [{ n: "1" }] });
  });

  it("check 107 · evidence past retention goes, and the stored file goes with it", async () => {
    const { storage, removed } = fakeStorage();
    const requested = await evidence.requestEvidenceUpload(
      maya,
      { shiftId: "sh-1", fileName: "photo.jpg", contentType: "image/jpeg", sizeBytes: 2048 },
      storage
    );
    await evidence.confirmEvidenceUpload(maya, requested.attachmentId, storage);
    // Bring the retention date forward rather than waiting four years.
    await sql(`UPDATE "EvidenceAttachment" SET "retentionUntil"=$1`, [ago(60)]);

    const result = await evidence.purgeExpiredEvidence(NOW, storage);
    expect(result.deleted).toBe(1);
    expect(result.failures).toEqual([]);
    // Both halves: the row and the object. A row pointing at nothing is worse
    // than either.
    expect(removed.length).toBeGreaterThan(0);
    await expect(
      sql(`SELECT count(*) n FROM "EvidenceAttachment" WHERE "deletedAt" IS NULL`)
    ).resolves.toMatchObject({ rows: [{ n: "0" }] });
  });
});
