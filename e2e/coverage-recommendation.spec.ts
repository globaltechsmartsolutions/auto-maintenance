import { expect, test } from "@playwright/test";
import {
    cancelOpenShiftsForEmployeeToday,
    createShiftStartingNow,
    createWorksite,
    findEmployeeId,
    loginAsAdmin,
} from "./fixtures";

/**
 * Stage 4 acceptance test: "an unavailable or overlapping employee never
 * appears as a selectable candidate; an override produces an auditable
 * reason." This is intentionally an API-level test (like the existing
 * cross-tenant-isolation and role-restriction specs) rather than a
 * UI-click test, because the exact wording of the exclusion reason is a
 * precise, deterministic contract worth asserting directly — the UI
 * rendering of that same data was confirmed manually in staging.
 */
test.describe("Coverage recommendation hard constraints (Stage 4)", () => {
    test("an employee with an overlapping shift is excluded with a visible reason, never recommended, and cannot be force-confirmed", async ({
        page,
    }) => {
        await loginAsAdmin(page);

        const worksiteId = await createWorksite(page, "E2E Coverage Worksite");
        const employeeId = await findEmployeeId(page);
        await cancelOpenShiftsForEmployeeToday(page, employeeId);

        // Shift A: the only employee in this staging company is fully
        // occupied by this shift for the next two hours.
        await createShiftStartingNow(page, {
            worksiteId,
            employeeId,
            title: "E2E Occupied Shift",
            durationMinutes: 120,
        });

        // Shift B: unassigned and overlapping the same window. Creating an
        // unassigned shift automatically produces an open "Uncovered shift"
        // incident (see createPlannedShift in service.ts).
        const start = new Date();
        const end = new Date(start.getTime() + 60 * 60_000); // overlaps Shift A
        const shiftBResponse = await page.request.post("/api/control/shifts", {
            data: {
                worksiteId,
                title: "E2E Uncovered Overlapping Shift",
                scheduledStart: start.toISOString(),
                scheduledEnd: end.toISOString(),
                requiredSkills: [],
                gracePeriodMinutes: 5,
            },
        });
        expect(shiftBResponse.ok(), `Failed to create shift: ${await shiftBResponse.text()}`).toBeTruthy();
        const { shift: shiftB } = (await shiftBResponse.json()) as { shift: { id: string } };

        const today = start.toISOString().slice(0, 10);
        const dayResponse = await page.request.get(`/api/control/day?date=${today}`);
        expect(dayResponse.ok(), `Failed to read the day view: ${await dayResponse.text()}`).toBeTruthy();
        const { shifts } = (await dayResponse.json()) as {
            shifts: Array<{ id: string; incidents: Array<{ id: string; status: string }> }>;
        };
        const shiftBDay = shifts.find((item) => item.id === shiftB.id);
        const incident = shiftBDay?.incidents.find((item) => ["OPEN", "ACKNOWLEDGED"].includes(item.status));
        expect(incident, "Expected an open incident for the uncovered shift").toBeTruthy();

        // 1. The recommendation endpoint must exclude the overlapping employee
        // with a specific, visible reason — never a silent drop.
        const recommendResponse = await page.request.post("/api/control/coverage/recommend", {
            data: { incidentId: incident!.id },
        });
        expect(
            recommendResponse.ok(),
            `Recommendation call failed: ${await recommendResponse.text()}`
        ).toBeTruthy();
        const recommendation = (await recommendResponse.json()) as {
            recommended: { employeeId: string } | null;
            candidates: Array<{ employeeId: string }>;
            excluded: Array<{ employeeId: string; reason: string }>;
        };

        expect(
            recommendation.candidates.some((candidate) => candidate.employeeId === employeeId),
            "The overlapping employee must never appear in the selectable candidates."
        ).toBe(false);
        const excludedEntry = recommendation.excluded.find((item) => item.employeeId === employeeId);
        expect(excludedEntry, "The overlapping employee must appear in the excluded list.").toBeTruthy();
        expect(excludedEntry!.reason.toLowerCase()).toContain("overlapping");

        // 2. Even a direct API attempt to force-confirm the ineligible
        // employee must be rejected server-side (defense in depth) — a
        // client bypassing the recommendation UI must not be able to assign
        // someone the hard constraints have already ruled out.
        const confirmResponse = await page.request.post("/api/control/coverage", {
            data: {
                shiftId: shiftB.id,
                incidentId: incident!.id,
                selectedEmployeeId: employeeId,
                recommendedEmployeeId: employeeId,
                score: 0,
                reasons: [],
                overrideReason: "Attempting to force-assign an ineligible employee.",
            },
        });
        expect(confirmResponse.ok()).toBe(false);
        const confirmBody = (await confirmResponse.json().catch(() => ({}))) as { code?: string };
        expect(confirmBody.code).toBe("SHIFT_OVERLAP");
    });
});