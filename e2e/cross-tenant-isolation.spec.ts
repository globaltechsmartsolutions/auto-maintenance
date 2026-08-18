import { expect, test } from "@playwright/test";
import {
  createShiftStartingNow,
  createWorksite,
  cancelOpenShiftsForEmployeeToday,
  findEmployeeId,
  loginAsAdmin,
  loginAsCompanyBAdmin,
  loginAsEmployee,
} from "./fixtures";

test.describe("Cross-tenant isolation", () => {
    test("Company B cannot list or mutate Company A's worksite", async ({ page, browser }) => {
        // Create a worksite as Company A's admin.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAsAdmin(adminPage);
    const worksiteId = await createWorksite(adminPage, "Isolation Test Worksite");
    const employeeId = await findEmployeeId(adminPage);
    await cancelOpenShiftsForEmployeeToday(adminPage, employeeId);
    const shiftId = await createShiftStartingNow(adminPage, { worksiteId, employeeId });
    await adminContext.close();

    const employeeContext = await browser.newContext();
    const employeePage = await employeeContext.newPage();
    await loginAsEmployee(employeePage);
    const clockResponse = await employeePage.request.post("/api/control/clock-events", {
      data: {
        shiftId,
        type: "CLOCK_IN",
        method: "MOBILE",
        occurredAt: new Date().toISOString(),
        idempotencyKey: `isolation-${Date.now()}`,
        isOffline: false,
      },
    });
    expect(clockResponse.ok()).toBeTruthy();
    const clockBody = (await clockResponse.json()) as { event: { id: string } };
    await employeeContext.close();

        // Switch to Company B's admin and try to see/touch Company A's data.
        await loginAsCompanyBAdmin(page);

        const listResponse = await page.request.get("/api/control/worksites");
        expect(listResponse.ok()).toBeTruthy();
        const listBody = (await listResponse.json()) as { worksites: Array<{ id: string }> };
        expect(listBody.worksites.map((worksite) => worksite.id)).not.toContain(worksiteId);

        // The real ID is correct — only the tenant boundary should stop this.
    const patchResponse = await page.request.patch(`/api/control/worksites/${worksiteId}`, {
      data: { name: "Hacked by Company B" },
    });
    expect(patchResponse.status()).toBe(404);

    const crossCompanyClockResponse = await page.request.post("/api/control/clock-events", {
      data: {
        shiftId,
        type: "BREAK_START",
        method: "MOBILE",
        occurredAt: new Date().toISOString(),
        idempotencyKey: `cross-company-clock-${Date.now()}`,
        isOffline: false,
      },
    });
    expect(crossCompanyClockResponse.status()).toBe(404);

    const correctionResponse = await page.request.post("/api/control/corrections", {
      data: {
        clockEventId: clockBody.event.id,
        proposedOccurredAt: new Date().toISOString(),
        reason: "Cross-company access test must not create this correction.",
      },
    });
    expect(correctionResponse.status()).toBe(404);
  });
});
