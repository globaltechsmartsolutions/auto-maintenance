import { expect, test } from "@playwright/test";
import {
    cancelOpenShiftsForEmployeeToday,
    createWorksite,
    findEmployeeId,
    loginAsAdmin,
    loginAsEmployee,
    requireEnv,
} from "./fixtures";

/**
 * Stage 5 end-to-end: confirming a coverage decision creates a
 * communication, the scheduled worker delivers it, and the recipient can
 * see and acknowledge it -- proving the real HTTP + database integration
 * that unit/service tests (mocked Prisma) cannot. The bounded-retry /
 * FAILED acceptance test itself is proven deterministically at the
 * service-test level (mocked provider, mocked time), matching the same
 * approach already used for Stage 3's duplicate-detection acceptance
 * test -- real wall-clock backoff delays (up to 240 minutes) are not
 * practical to wait out in an E2E run.
 */
test.describe("Communications outbox worker (Stage 5)", () => {
    test("a confirmed coverage decision is delivered by the worker and can be acknowledged by the recipient", async ({
        page,
    }) => {
        await loginAsAdmin(page);

        const worksiteId = await createWorksite(page, "E2E Communications Worksite");
        const employeeId = await findEmployeeId(page);
        await cancelOpenShiftsForEmployeeToday(page, employeeId);

        // An unassigned shift automatically produces an open incident.
        const start = new Date();
        const end = new Date(start.getTime() + 60 * 60_000);
        const shiftResponse = await page.request.post("/api/control/shifts", {
            data: {
                worksiteId,
                title: "E2E Communications Shift",
                scheduledStart: start.toISOString(),
                scheduledEnd: end.toISOString(),
                requiredSkills: [],
                gracePeriodMinutes: 5,
            },
        });
        expect(shiftResponse.ok(), `Failed to create shift: ${await shiftResponse.text()}`).toBeTruthy();
        const { shift } = (await shiftResponse.json()) as { shift: { id: string } };

        const today = start.toISOString().slice(0, 10);
        const dayResponse = await page.request.get(`/api/control/day?date=${today}`);
        expect(dayResponse.ok()).toBeTruthy();
        const { shifts } = (await dayResponse.json()) as {
            shifts: Array<{ id: string; incidents: Array<{ id: string; status: string }> }>;
        };
        const shiftDay = shifts.find((item) => item.id === shift.id);
        const incident = shiftDay?.incidents.find((item) => ["OPEN", "ACKNOWLEDGED"].includes(item.status));
        expect(incident, "Expected an open incident for the uncovered shift").toBeTruthy();

        const recommendResponse = await page.request.post("/api/control/coverage/recommend", {
            data: { incidentId: incident!.id },
        });
        expect(recommendResponse.ok()).toBeTruthy();
        const { recommended } = (await recommendResponse.json()) as {
            recommended: { employeeId: string } | null;
        };
        expect(recommended, "Expected an eligible candidate for this shift").toBeTruthy();

        // Confirming the recommendation creates an IN_APP CommunicationOutbox
        // record as a side effect (see confirmCoverage in service.ts).
        const confirmResponse = await page.request.post("/api/control/coverage", {
            data: {
                shiftId: shift.id,
                incidentId: incident!.id,
                selectedEmployeeId: recommended!.employeeId,
            },
        });
        expect(confirmResponse.ok(), `Failed to confirm coverage: ${await confirmResponse.text()}`).toBeTruthy();

        const communicationsBeforeResponse = await page.request.get(
            `/api/control/communications?_=${Date.now()}`
        );
        expect(communicationsBeforeResponse.ok()).toBeTruthy();
        const { communications: communicationsBefore } = (await communicationsBeforeResponse.json()) as {
            communications: Array<{ id: string; shiftId?: string; status: string }>;
        };
        const created = communicationsBefore.find((item) => item.shiftId === shift.id);
        expect(created, "Expected a communication to be created for this shift").toBeTruthy();
        expect(created!.status).toBe("PENDING");

        // Trigger the worker directly, the same way Vercel Cron does in
        // production -- refuses without the correct secret.
        const workerResponse = await page.request.get("/api/cron/process-outbox", {
            headers: { Authorization: `Bearer ${requireEnv("CRON_SECRET")}` },
        });
        expect(workerResponse.ok(), `Worker call failed: ${await workerResponse.text()}`).toBeTruthy();

        const communicationsAfterResponse = await page.request.get(
            `/api/control/communications?_=${Date.now()}`
        );
        const { communications: communicationsAfter } = (await communicationsAfterResponse.json()) as {
            communications: Array<{
                id: string;
                shiftId?: string;
                status: string;
                sentAt?: string;
                acknowledgedAt?: string;
            }>;
        };
        const delivered = communicationsAfter.find((item) => item.id === created!.id);
        expect(delivered?.status).toBe("SENT");
        expect(delivered?.sentAt).toBeTruthy();
        expect(delivered?.acknowledgedAt).toBeFalsy();

        // 2. The recipient employee -- and only the recipient -- can
        // acknowledge it.
        const employeePage = await page.context().browser()!.newContext().then((context) => context.newPage());
        await loginAsEmployee(employeePage);
        const acknowledgeResponse = await employeePage.request.patch(
            `/api/control/communications/${created!.id}`,
            { data: { action: "ACKNOWLEDGE" } }
        );
        expect(
            acknowledgeResponse.ok(),
            `Acknowledge call failed: ${await acknowledgeResponse.text()}`
        ).toBeTruthy();

        const finalResponse = await page.request.get(`/api/control/communications?_=${Date.now()}`);
        const { communications: finalCommunications } = (await finalResponse.json()) as {
            communications: Array<{ id: string; acknowledgedAt?: string }>;
        };
        const acknowledged = finalCommunications.find((item) => item.id === created!.id);
        expect(acknowledged?.acknowledgedAt).toBeTruthy();

        await employeePage.close();
    });
});