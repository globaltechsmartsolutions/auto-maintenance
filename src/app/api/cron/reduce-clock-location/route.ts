import { reduceClockLocationPrecision } from "@/lib/wia-control/service";

/**
 * Scheduled reduction of exact clock positions to the distance that justified
 * them, per each company's configured window.
 *
 * Same authentication as the other cron routes. This one narrows real personal
 * data irreversibly, so it refuses to run without the secret rather than
 * defaulting to open.
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json(
      { error: "CRON_SECRET is not configured; refusing to reduce clock locations." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  return Response.json(await reduceClockLocationPrecision(new Date()));
}
