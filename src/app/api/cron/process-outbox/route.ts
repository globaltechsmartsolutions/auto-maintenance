import { processCommunicationOutbox } from "@/lib/wia-control/service";

/**
 * Stage 5: scheduled communications delivery.
 *
 * Same authentication pattern as /api/cron/detect-incidents (Stage 3):
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
 * when CRON_SECRET is configured; this route refuses any request that
 * doesn't match, since it can send real messages to real people.
 */
export async function GET(request: Request) {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return Response.json(
            { error: "CRON_SECRET is not configured; refusing to process the outbox." },
            { status: 500 }
        );
    }
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${expected}`) {
        return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const result = await processCommunicationOutbox(new Date());
    return Response.json(result);
}