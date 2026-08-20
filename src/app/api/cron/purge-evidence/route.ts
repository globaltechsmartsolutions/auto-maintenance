import { purgeExpiredEvidence } from "@/lib/wia-control/evidence-service";

/**
 * Scheduled evidence retention.
 *
 * Same authentication as the other cron routes: Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`. This route deletes real customer
 * evidence, so it refuses to run without that secret rather than defaulting to
 * open access.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json(
      { error: "CRON_SECRET is not configured; refusing to purge evidence." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await purgeExpiredEvidence(new Date());
  return Response.json(result, { status: result.failures.length ? 207 : 200 });
}
