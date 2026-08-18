import { expect, test } from "@playwright/test";
import { loginAsEmployee } from "./fixtures";

test.describe("Role restrictions", () => {
    test("an employee cannot create a worksite", async ({ page }) => {
        await loginAsEmployee(page);
        const response = await page.request.post("/api/control/worksites", {
            data: { name: "Unauthorized Worksite", address: "Fake St", city: "Test" },
        });
        expect(response.status()).toBe(403);
    });

    test("an employee cannot update company settings", async ({ page }) => {
        await loginAsEmployee(page);
        // A complete, valid payload — so the 403 reflects the role check, not
        // a validation failure that happens to also return a 4xx status.
        const response = await page.request.patch("/api/control/settings", {
            data: { timezone: "Asia/Dubai", clockRetentionYears: 4, crmEnabled: false },
        });
        expect(response.status()).toBe(403);
    });
});
