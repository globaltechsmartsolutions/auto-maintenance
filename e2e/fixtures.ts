import { expect, type Browser, type Page } from "@playwright/test";

/**
 * Shared helpers for WIAControl's Playwright E2E suite (playbook Section 16,
 * browser end-to-end layer). These tests run against a real, non-demo
 * environment with real Supabase accounts. See e2e/README.md for the
 * required environment variables.
 */

export function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(
            `Missing required environment variable ${name}. See e2e/README.md for the full list of variables E2E tests need.`
        );
    }
    return value;
}

export async function loginAs(page: Page, email: string, password: string) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/control", { timeout: 15_000 });
}

export async function loginAsAdmin(page: Page) {
    await loginAs(page, requireEnv("E2E_ADMIN_EMAIL"), requireEnv("E2E_ADMIN_PASSWORD"));
}

export async function loginAsEmployee(page: Page) {
    await loginAs(page, requireEnv("E2E_EMPLOYEE_EMAIL"), requireEnv("E2E_EMPLOYEE_PASSWORD"));
}

export async function loginAsCompanyBAdmin(page: Page) {
    await loginAs(
        page,
        requireEnv("E2E_COMPANY_B_ADMIN_EMAIL"),
        requireEnv("E2E_COMPANY_B_ADMIN_PASSWORD")
    );
}

/** Creates a fresh worksite via the API using the given page's authenticated session. */
export async function createWorksite(page: Page, namePrefix = "E2E Worksite") {
    const response = await page.request.post("/api/control/worksites", {
        data: {
            name: `${namePrefix} ${Date.now()}`,
            address: "123 Test Street",
            city: "Dubai",
            radiusMeters: 100,
            timezone: "Asia/Dubai",
            verificationMode: "QR_LOCATION",
        },
    });
    expect(response.ok(), `Failed to create worksite: ${await response.text()}`).toBeTruthy();
    const body = (await response.json()) as { worksite: { id: string } };
    return body.worksite.id;
}

/** Finds an Employee record id, optionally by the person's full name. */
export async function findEmployeeId(page: Page, fullName?: string) {
    const response = await page.request.get("/api/control/employees");
    expect(response.ok(), `Failed to list employees: ${await response.text()}`).toBeTruthy();
    const body = (await response.json()) as {
        employees: Array<{ id: string; user: { firstName: string; lastName: string } }>;
    };
    if (body.employees.length === 0) {
        throw new Error(
            "No employees found for this company. Seed at least one Employee record before running E2E tests."
        );
    }
    if (fullName) {
        const match = body.employees.find(
            (employee) => `${employee.user.firstName} ${employee.user.lastName}`.trim() === fullName
        );
        if (!match) throw new Error(`No employee named "${fullName}" was found.`);
        return match.id;
    }
    return body.employees[0].id;
}

/**
 * Cancels any of the employee's shifts for today that are still open
 * (not already COMPLETED or CANCELLED). E2E runs reuse the same test
 * employee every time, so without this, a shift left over from a
 * previous run would overlap with a freshly created one and the app
 * would correctly reject it — proof the overlap rule works, but it
 * makes the test suite unusable on repeated runs. Cleaning up first
 * keeps each run independent.
 */
export async function cancelOpenShiftsForEmployeeToday(page: Page, employeeId: string) {
    const date = new Date().toISOString().slice(0, 10);
    const response = await page.request.get(`/api/control/day?date=${date}`);
    expect(response.ok(), `Failed to read the day view: ${await response.text()}`).toBeTruthy();
    const body = (await response.json()) as {
        shifts: Array<{ id: string; status: string; employee: { id: string } | null }>;
    };
    const openShifts = body.shifts.filter(
        (shift) =>
            shift.employee?.id === employeeId && !["COMPLETED", "CANCELLED"].includes(shift.status)
    );
    for (const shift of openShifts) {
        const cancelResponse = await page.request.patch(`/api/control/shifts/${shift.id}`, {
            data: { status: "CANCELLED" },
        });
        expect(
            cancelResponse.ok(),
            `Failed to cancel leftover shift ${shift.id}: ${await cancelResponse.text()}`
        ).toBeTruthy();
    }
}

/** Creates a shift starting now, assigned to the given employee. */
export async function createShiftStartingNow(
    page: Page,
    options: {
        worksiteId: string;
        employeeId: string;
        title?: string;
        durationMinutes?: number;
    }
) {
    const start = new Date();
    const end = new Date(start.getTime() + (options.durationMinutes ?? 120) * 60_000);
    const response = await page.request.post("/api/control/shifts", {
        data: {
            worksiteId: options.worksiteId,
            employeeId: options.employeeId,
            title: options.title ?? "E2E Test Shift",
            scheduledStart: start.toISOString(),
            scheduledEnd: end.toISOString(),
            requiredSkills: [],
            gracePeriodMinutes: 5,
        },
    });
    expect(response.ok(), `Failed to create shift: ${await response.text()}`).toBeTruthy();
    const body = (await response.json()) as { shift: { id: string } };
    return body.shift.id;
}

/**
 * Convenience setup: logs in as an admin in a throwaway browser context,
 * creates a fresh worksite and a shift starting now assigned to the test
 * employee, then closes that context. Keeps each test's data independent
 * and avoids depending on manually created records left over from other
 * testing sessions.
 */
export async function setupFreshShiftForEmployee(
    browser: Browser,
    options?: { employeeName?: string; durationMinutes?: number }
) {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAsAdmin(adminPage);
    const worksiteId = await createWorksite(adminPage);
    const employeeId = await findEmployeeId(adminPage, options?.employeeName);
    await cancelOpenShiftsForEmployeeToday(adminPage, employeeId);
    const shiftId = await createShiftStartingNow(adminPage, {
        worksiteId,
        employeeId,
        durationMinutes: options?.durationMinutes,
    });
    await adminContext.close();
    return { shiftId, worksiteId };
}

/** Counts how many clock events of a given type exist for a shift today. */
export async function getShiftClockEventCount(
    page: Page,
    shiftId: string,
    type: "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT"
) {
    const date = new Date().toISOString().slice(0, 10);
    const response = await page.request.get(`/api/control/day?date=${date}`);
    expect(response.ok(), `Failed to read the day view: ${await response.text()}`).toBeTruthy();
    const body = (await response.json()) as {
        shifts: Array<{ id: string; clockEvents: Array<{ type: string }> }>;
    };
    const shift = body.shifts.find((item) => item.id === shiftId);
    if (!shift) return 0;
    return shift.clockEvents.filter((event) => event.type === type).length;
}