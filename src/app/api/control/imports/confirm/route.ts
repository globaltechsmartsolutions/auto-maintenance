import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { importKindSchema } from "@/lib/wia-control/csv-import";
import { confirmOperationalCsvImport } from "@/lib/wia-control/service";

const requestSchema = z.object({ companyId: z.string().min(1).optional(), kind: importKindSchema, csv: z.string().min(1).max(1_000_000) });
export const POST = apiRoute(async (request: Request) => { const raw = await request.json(); const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], requestedCompanyIdFromBody(raw)); if (context.response) return context.response; if (context.demo) return Response.json({ error: "CSV confirmation requires a connected workspace." }, { status: 403 }); const payload = requestSchema.parse(raw); return Response.json({ results: await confirmOperationalCsvImport(context.actor, payload.kind, payload.csv) }); });
