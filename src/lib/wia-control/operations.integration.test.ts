import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Client } from "pg";

/**
 * The operational rules, running as the application actually runs them:
 * the real service functions, against a real PostgreSQL, with every migration
 * applied and every constraint live.
 *
 * The unit suite proves these functions ask the database the right questions.
 * It cannot prove the database answers them, because there Prisma is a mock
 * that agrees with whatever the test says. Everything below is the layer where
 * a rule either holds or does not.
 *
 * Each test names the staging checklist row it stands in for, so a passing run
 * here is evidence against that row rather than a number in a report.
 */

const url = process.env.TEST_DATABASE_URL;

let db: Client;
let service: typeof import("@/lib/wia-control/service");

type Actor = { companyId: string; userId: string; role: "ADMIN" | "MANAGER" | "EMPLOYEE"; employeeId?: string };

const admin: Actor = { companyId: "co-1", userId: "us-admin", role: "ADMIN" };
const manager: Actor = { companyId: "co-1", userId: "us-manager", role: "MANAGER" };
const worker: Actor = { companyId: "co-1", userId: "us-maya", role: "EMPLOYEE", employeeId: "em-maya" };
/** A second company, so tenant isolation is a fact rather than an assumption. */
const outsider: Actor = { companyId: "co-2", userId: "us-other-admin", role: "ADMIN" };

const TABLES = [
  "ClockEvent",
  "ShiftCompletion",
  "TemplateSubmission",
  "AttendanceIncident",
  "CommunicationOutbox",
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
 * The staging checklist's fictional company, reproduced: two companies, an
 * administrator and a manager, four field workers with the skills and statuses
 * section 2 specifies, and two worksites.
 */
async function seed() {
  for (const [id, name] of [
    ["co-1", "Northstar Facility Services"],
    ["co-2", "Second Test Company"],
  ]) {
    await sql(
      `INSERT INTO "Company"(id,name,timezone,"updatedAt") VALUES ($1,$2,'Europe/Madrid',now())`,
      [id, name]
    );
  }
  const people: Array<[string, string, string, string, string]> = [
    ["us-admin", "qa.admin", "QA", "Admin", "ADMIN"],
    ["us-manager", "qa.manager", "QA", "Manager", "MANAGER"],
    ["us-maya", "qa.maya", "Maya", "Field", "EMPLOYEE"],
    ["us-liam", "qa.liam", "Liam", "Field", "EMPLOYEE"],
    ["us-nora", "qa.nora", "Nora", "Field", "EMPLOYEE"],
    ["us-ethan", "qa.ethan", "Ethan", "Field", "EMPLOYEE"],
  ];
  for (const [id, local, first, last, role] of people) {
    await sql(
      `INSERT INTO "User"(id,"companyId",email,"firstName","lastName",role,"updatedAt")
       VALUES ($1,'co-1',$2,$3,$4,$5::"UserRole",now())`,
      [id, `${local}@fixture.test`, first, last, role]
    );
  }
  await sql(
    `INSERT INTO "User"(id,"companyId",email,"firstName","lastName",role,"updatedAt")
     VALUES ('us-other-admin','co-2','other@fixture.test','Other','Admin','ADMIN',now())`
  );

  const workers: Array<[string, string, string[], string]> = [
    ["em-maya", "us-maya", ["cleaning", "opening"], "AVAILABLE"],
    ["em-liam", "us-liam", ["cleaning", "evening"], "AVAILABLE"],
    ["em-nora", "us-nora", ["cleaning"], "VACATION"],
    ["em-ethan", "us-ethan", ["cleaning", "opening"], "AVAILABLE"],
  ];
  for (const [id, userId, skills, status] of workers) {
    await sql(
      `INSERT INTO "Employee"(id,"companyId","userId",skills,"fieldStatus","updatedAt")
       VALUES ($1,'co-1',$2,$3,$4::"EmployeeFieldStatus",now())`,
      [id, userId, skills, status]
    );
  }

  await sql(
    `INSERT INTO "Worksite"(id,"companyId",name,address,city,"updatedAt")
     VALUES ('ws-central','co-1','Redwood Central','12 Redwood Avenue','Madrid',now()),
            ('ws-riverside','co-1','Redwood Riverside','40 River Lane','Madrid',now())`
  );
}

/** A window on a fixed date, so a test never depends on when it runs. */
function window(startHour: number, endHour: number) {
  const day = "2026-09-14";
  const pad = (hour: number) => String(hour).padStart(2, "0");
  return {
    scheduledStart: `${day}T${pad(startHour)}:00:00+02:00`,
    scheduledEnd: `${day}T${pad(endHour)}:00:00+02:00`,
  };
}

beforeAll(async () => {
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. These tests need a throwaway PostgreSQL with the migrations applied — see docs/WIACONTROL_RUNBOOKS.md section 10."
    );
  }
  if (/supabase|amazonaws|\.com/i.test(url)) {
    throw new Error(
      "TEST_DATABASE_URL points at a hosted database. This suite truncates every table it touches and must only ever run against a local throwaway."
    );
  }
  // getPrisma reads this lazily on first use, so it has to be set before the
  // service module runs anything — not merely before it is imported.
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

describe("check 8 · recording a client", () => {
  it("stores a client that the register then returns", async () => {
    const customer = await service.createOperationalCustomer(manager, {
      name: "Redwood Offices Ltd.",
      city: "Madrid",
    });
    expect(customer.id).toBeTruthy();
    await expect(service.listOperationalCustomers(manager)).resolves.toEqual([
      expect.objectContaining({ name: "Redwood Offices Ltd." }),
    ]);
  });

  it("keeps it out of another company's register", async () => {
    await service.createOperationalCustomer(manager, { name: "Redwood Offices Ltd." });
    await expect(service.listOperationalCustomers(outsider)).resolves.toEqual([]);
  });

  it("writes an audit entry naming who did it", async () => {
    await service.createOperationalCustomer(manager, { name: "Redwood Offices Ltd." });
    const { rows } = await sql(
      `SELECT "action","userId","companyId" FROM "AuditLog" WHERE "action"='customer.created'`
    );
    expect(rows).toEqual([
      expect.objectContaining({ userId: "us-manager", companyId: "co-1" }),
    ]);
  });
});

describe("check 113 · a client recorded twice", () => {
  it("refuses the duplicate rather than merging it, whatever the casing", async () => {
    await service.createOperationalCustomer(manager, { name: "Redwood Offices Ltd." });
    await expect(
      service.createOperationalCustomer(manager, { name: "REDWOOD OFFICES LTD." })
    ).rejects.toMatchObject({ code: "CUSTOMER_ALREADY_EXISTS" });
    await expect(service.listOperationalCustomers(manager)).resolves.toHaveLength(1);
  });

  it("still allows another company to use the same client name", async () => {
    await service.createOperationalCustomer(manager, { name: "Redwood Offices Ltd." });
    await expect(
      service.createOperationalCustomer(outsider, { name: "Redwood Offices Ltd." })
    ).resolves.toBeDefined();
  });
});

describe("checks 9 and 10 · a worksite with and without a client", () => {
  it("links the worksite to the client, which is what the browser used to drop", async () => {
    const customer = await service.createOperationalCustomer(manager, { name: "Redwood Offices Ltd." });
    const worksite = await service.createWorksite(manager, {
      customerId: customer.id,
      name: "Redwood North",
      address: "9 North Street",
      city: "Madrid",
    });
    const { rows } = await sql(`SELECT "customerId" FROM "Worksite" WHERE id=$1`, [worksite.id]);
    expect(rows[0].customerId).toBe(customer.id);
  });

  it("records a standalone worksite, because the client may not be known yet", async () => {
    const worksite = await service.createWorksite(manager, {
      name: "Redwood South",
      address: "3 South Street",
      city: "Madrid",
    });
    const { rows } = await sql(`SELECT "customerId" FROM "Worksite" WHERE id=$1`, [worksite.id]);
    expect(rows[0].customerId).toBeNull();
  });
});

describe("check 14 · a reference to another company's client", () => {
  it("refuses a worksite pointed at a client from another company", async () => {
    const theirs = await service.createOperationalCustomer(outsider, { name: "Somebody Else Ltd." });
    await expect(
      service.createWorksite(manager, {
        customerId: theirs.id,
        name: "Borrowed",
        address: "1 Elsewhere",
        city: "Madrid",
      })
    ).rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND" });
  });

  it("refuses a service pointed at a client from another company", async () => {
    const theirs = await service.createOperationalCustomer(outsider, { name: "Somebody Else Ltd." });
    await expect(
      service.createOperationalService(manager, {
        customerId: theirs.id,
        title: "Borrowed service",
        serviceType: "Cleaning",
      })
    ).rejects.toBeDefined();
  });
});

describe("check 12 · creating a client service", () => {
  it("creates the service and returns it in the company's register", async () => {
    const customer = await service.createOperationalCustomer(manager, { name: "Redwood Offices Ltd." });
    await service.createOperationalService(manager, {
      customerId: customer.id,
      title: "Morning office cleaning",
      serviceType: "Cleaning",
      recurrence: "DAILY",
    });
    await expect(service.listOperationalServices(manager)).resolves.toEqual([
      expect.objectContaining({ title: "Morning office cleaning" }),
    ]);
  });

  it("refuses a field worker, who has no reason to alter a commitment", async () => {
    const customer = await service.createOperationalCustomer(manager, { name: "Redwood Offices Ltd." });
    await expect(
      service.createOperationalService(worker, {
        customerId: customer.id,
        title: "Morning office cleaning",
        serviceType: "Cleaning",
      })
    ).rejects.toThrow(/cannot create services/);
  });
});

describe("checks 15 to 19 · planning a shift", () => {
  it("plans an assigned shift and links it to worksite and worker", async () => {
    const shift = await service.createPlannedShift(manager, {
      worksiteId: "ws-central",
      employeeId: "em-maya",
      title: "QA Morning Clean",
      ...window(8, 10),
    });
    const { rows } = await sql(
      `SELECT "employeeId","worksiteId",status FROM "PlannedShift" WHERE id=$1`,
      [shift.id]
    );
    expect(rows[0]).toMatchObject({ employeeId: "em-maya", worksiteId: "ws-central" });
  });

  it("plans an unassigned shift, which is the uncovered case a coordinator must see", async () => {
    const shift = await service.createPlannedShift(manager, {
      worksiteId: "ws-central",
      title: "QA Evening Clean",
      ...window(18, 20),
    });
    const { rows } = await sql(`SELECT "employeeId" FROM "PlannedShift" WHERE id=$1`, [shift.id]);
    expect(rows[0].employeeId).toBeNull();
  });

  it("check 17 · refuses an end before its start, storing no partial shift", async () => {
    await expect(
      service.createPlannedShift(manager, {
        worksiteId: "ws-central",
        employeeId: "em-maya",
        title: "Backwards",
        scheduledStart: "2026-09-14T10:00:00+02:00",
        scheduledEnd: "2026-09-14T08:00:00+02:00",
      })
    ).rejects.toBeDefined();
    await expect(sql(`SELECT count(*) n FROM "PlannedShift"`)).resolves.toMatchObject({
      rows: [{ n: "0" }],
    });
  });

  it("check 18 · refuses a second shift overlapping the first for the same person", async () => {
    await service.createPlannedShift(manager, {
      worksiteId: "ws-central",
      employeeId: "em-maya",
      title: "QA Morning Clean",
      ...window(8, 10),
    });
    await expect(
      service.createPlannedShift(manager, {
        worksiteId: "ws-riverside",
        employeeId: "em-maya",
        title: "QA Overlap",
        ...window(9, 11),
      })
    ).rejects.toMatchObject({ code: "SHIFT_OVERLAP" });
    await expect(sql(`SELECT count(*) n FROM "PlannedShift"`)).resolves.toMatchObject({
      rows: [{ n: "1" }],
    });
  });

  it("check 18b · allows a shift starting exactly when the previous one ends", async () => {
    await service.createPlannedShift(manager, {
      worksiteId: "ws-central",
      employeeId: "em-maya",
      title: "First",
      ...window(8, 10),
    });
    await expect(
      service.createPlannedShift(manager, {
        worksiteId: "ws-central",
        employeeId: "em-maya",
        title: "Second",
        ...window(10, 12),
      })
    ).resolves.toBeDefined();
  });

  it("check 19 · refuses somebody who is on holiday", async () => {
    await expect(
      service.createPlannedShift(manager, {
        worksiteId: "ws-central",
        employeeId: "em-nora",
        title: "QA Holiday",
        ...window(8, 10),
      })
    ).rejects.toBeDefined();
  });

  it("refuses a worker from another company outright", async () => {
    await expect(
      service.createPlannedShift(outsider, {
        worksiteId: "ws-central",
        employeeId: "em-maya",
        title: "Borrowed worker",
        ...window(8, 10),
      })
    ).rejects.toBeDefined();
  });
});

describe("checks 20 and 21 · linking a shift to a service", () => {
  async function serviceFor(title: string) {
    const customer = await service.createOperationalCustomer(manager, { name: `Client for ${title}` });
    return service.createOperationalService(manager, {
      customerId: customer.id,
      title,
      serviceType: "Cleaning",
    });
  }

  it("links a shift to a compatible service", async () => {
    const created = await serviceFor("Morning office cleaning");
    const shift = await service.createPlannedShift(manager, {
      worksiteId: "ws-central",
      employeeId: "em-maya",
      serviceId: created.id,
      title: "QA Morning Clean",
      ...window(8, 10),
    });
    const { rows } = await sql(`SELECT "serviceId" FROM "PlannedShift" WHERE id=$1`, [shift.id]);
    expect(rows[0].serviceId).toBe(created.id);
  });

  it("refuses a shift linked to another company's service", async () => {
    const theirCustomer = await service.createOperationalCustomer(outsider, { name: "Their Client" });
    const theirService = await service.createOperationalService(outsider, {
      customerId: theirCustomer.id,
      title: "Their service",
      serviceType: "Cleaning",
    });
    await expect(
      service.createPlannedShift(manager, {
        worksiteId: "ws-central",
        employeeId: "em-maya",
        serviceId: theirService.id,
        title: "Borrowed service",
        ...window(8, 10),
      })
    ).rejects.toBeDefined();
  });
});

describe("checks 108 to 110 · inviting a coordinator", () => {
  const invite = {
    supabaseUserId: "supabase-new",
    email: "qa.newmanager@fixture.test",
    firstName: "New",
    lastName: "Manager",
    role: "MANAGER" as const,
  };

  it("check 108 · an administrator creates a manager, with no employee record", async () => {
    const teammate = await service.createTeammateProfile(admin, invite);
    expect(teammate.role).toBe("MANAGER");
    await expect(sql(`SELECT count(*) n FROM "Employee" WHERE "userId"=$1`, [teammate.id])).resolves.toMatchObject({
      rows: [{ n: "0" }],
    });
  });

  it("check 109 · an administrator creates another administrator", async () => {
    const teammate = await service.createTeammateProfile(admin, { ...invite, role: "ADMIN" });
    expect(teammate.role).toBe("ADMIN");
  });

  it("check 110 · a manager cannot invite anybody, and cannot see the list", async () => {
    await expect(service.createTeammateProfile(manager, invite)).rejects.toThrow(/Only an administrator/);
    await expect(service.listTeammates(manager)).rejects.toThrow(/Only an administrator/);
    await expect(sql(`SELECT count(*) n FROM "User" WHERE email=$1`, [invite.email])).resolves.toMatchObject({
      rows: [{ n: "0" }],
    });
  });

  it("lists coordinators without the field team, scoped to the company", async () => {
    await service.createTeammateProfile(admin, invite);
    const teammates = await service.listTeammates(admin);
    expect(teammates.map((person) => person.email).sort()).toEqual([
      "qa.admin@fixture.test",
      "qa.manager@fixture.test",
      "qa.newmanager@fixture.test",
    ]);
    await expect(service.listTeammates(outsider)).resolves.toHaveLength(1);
  });
});
