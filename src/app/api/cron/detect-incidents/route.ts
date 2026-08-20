import { detectIncompleteAttendanceForAllCompanies } from "@/lib/wia-control/service";

/**
 * Stage 3, Task 5: scheduled incident detection.
 *
 * Vercel Cron calls this route on the schedule configured in
 * `vercel.json` and automatically sends `Authorization: Bearer
 * <CRON_SECRET>` when the `CRON_SECRET` environment variable is set,
 * which is what the check below verifies. Without a matching secret this
 * route refuses the request — it must never be reachable by an
 * unauthenticated caller, since it runs detection across every company.
 *
 * This was deliberately not wired up until the duplicate-safety of
 * `detectIncompleteAttendance` had its own passing test (see
 * `service.test.ts`, "detectIncompleteAttendance (Stage 3 acceptance
 * test)"), per the playbook's instruction: "Schedule detection through a
 * worker or cron only after its idempotency tests pass."
 */
export async function GET(request: Request) {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return Response.json(
            { error: "CRON_SECRET is not configured; refusing to run scheduled detection." },
            { status: 500 }
        );
    }
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${expected}`) {
        return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const results = await detectIncompleteAttendanceForAllCompanies(new Date());
    const totalCreated = results.reduce((sum, result) => sum + result.created, 0);
    const failures = results.filter((result) => result.error);

    return Response.json({
        companiesProcessed: results.length,
        incidentsCreated: totalCreated,
        failures,
    });
}