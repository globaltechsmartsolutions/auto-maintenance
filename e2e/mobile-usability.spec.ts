import { expect, test } from "@playwright/test";
import { loginAsEmployee, setupFreshShiftForEmployee } from "./fixtures";

test.describe("Mobile usability", () => {
    test("the primary clock action is visible and tappable on a mobile viewport", async ({
        page,
        browser,
    }) => {
        await setupFreshShiftForEmployee(browser);

        await loginAsEmployee(page);
        await page.goto("/employee");

        const clockButton = page.getByRole("button", { name: "Clock in" });
        await expect(clockButton).toBeVisible({ timeout: 15_000 });

        // A tap target should be reasonably sized on a phone screen.
        const box = await clockButton.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);

        // The page should not force horizontal scrolling on a narrow screen.
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
});
