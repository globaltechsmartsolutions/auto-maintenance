import { expect, test } from "@playwright/test";
import { getShiftClockEventCount, loginAsEmployee, setupFreshShiftForEmployee } from "./fixtures";

test.describe("Clock-in/out sequence", () => {
    test("employee can complete clock-in, break, and clock-out", async ({ page, browser }) => {
        const { shiftId } = await setupFreshShiftForEmployee(browser);

        await loginAsEmployee(page);
        await page.goto("/employee");

        await page.getByRole("button", { name: "Clock in" }).click();
        await expect(page.getByRole("button", { name: "Start break" })).toBeVisible({ timeout: 15_000 });

        await page.getByRole("button", { name: "Start break" }).click();
        await expect(page.getByRole("button", { name: "Resume shift" })).toBeVisible({ timeout: 15_000 });

        await page.getByRole("button", { name: "Resume shift" }).click();
        await expect(page.getByRole("button", { name: "Start break" })).toBeVisible({ timeout: 15_000 });

        await page.getByRole("button", { name: "End shift" }).click();
        await expect(page.getByText("Shift completed")).toBeVisible({ timeout: 15_000 });

        // Playbook minimum test case: a full valid sequence produces exactly
        // one event of each type — no duplicates, nothing skipped.
        expect(await getShiftClockEventCount(page, shiftId, "CLOCK_IN")).toBe(1);
        expect(await getShiftClockEventCount(page, shiftId, "BREAK_START")).toBe(1);
        expect(await getShiftClockEventCount(page, shiftId, "BREAK_END")).toBe(1);
        expect(await getShiftClockEventCount(page, shiftId, "CLOCK_OUT")).toBe(1);
    });
});
