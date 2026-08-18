import { expect, test } from "@playwright/test";
import { createWorksite, loginAsAdmin, loginAsCompanyBAdmin } from "./fixtures";

test.describe("Cross-tenant isolation", () => {
    test("Company B cannot list or mutate Company A's worksite", async ({ page, browser }) => {
        // Create a worksite as Company A's admin.
        const adminContext = await browser.newContext();
        const adminPage = await adminContext.newPage();
        await loginAsAdmin(adminPage);
        const worksiteId = await createWorksite(adminPage, "Isolation Test Worksite");
        await adminContext.close();

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
    });
});
