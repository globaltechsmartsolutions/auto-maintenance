import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { importKindSchema, previewCsvImport } from "@/lib/wia-control/csv-import";

const requestSchema = z.object({ companyId: z.string().min(1).optional(), kind: importKindSchema, csv: z.string().min(1).max(1_000_000) });

export const POST = apiRoute(async (request: Request) => {
  const raw = await request.json();
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], requestedCompanyIdFromBody(raw));
  if (context.response) return context.response;
  const payload = requestSchema.parse(raw);
  return Response.json({ preview: previewCsvImport(payload.kind, payload.csv) });
});
