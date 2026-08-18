import { expect, test } from "@playwright/test";
import { getShiftClockEventCount, loginAsEmployee, setupFreshShiftForEmployee } from "./fixtures";

test.describe("Offline clock-in reliability", () => {
  test("clocking in while offline, then reconnecting, produces exactly one event", async ({
    page,
    context,
    browser,
  }) => {
    const { shiftId } = await setupFreshShiftForEmployee(browser);

    await loginAsEmployee(page);
    await page.goto("/employee");

    // Wait for the page's own initial data load to finish and the button
    // to actually render before going offline — otherwise we might cut
    // the connection mid-way through the page's first fetch, which is a
    // different scenario than "already looking at my shift, then offline".
    await expect(page.getByRole("button", { name: "Clock in" })).toBeVisible({ timeout: 20_000 });

    // Playbook Stage 2 acceptance test: switching the device offline
    // immediately after tapping clock-in, then retrying after reconnect,
    // must result in exactly one clock event — never zero, never two.
    await context.setOffline(true);
    await page.getByRole("button", { name: "Clock in" }).click();
    await expect(page.getByText("Saved on this device", { exact: false })).toBeVisible({
      timeout: 10_000,
    });

    await context.setOffline(false);
    // Wait for the UI to actually reflect a server-confirmed clock-in (the
    // button changes to "Start break") rather than only waiting for the
    // "pending" banner text to disappear — that text also changes the
    // moment a retry attempt *starts* sending, not only once it succeeds.
    await expect(page.getByRole("button", { name: "Start break" })).toBeVisible({
      timeout: 40_000,
    });

    expect(await getShiftClockEventCount(page, shiftId, "CLOCK_IN")).toBe(1);
  });
});
