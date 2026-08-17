import { hasDatabaseConfig, hasSupabaseConfig, isDemoMode } from "@/lib/demo-mode";
import { apiRoute } from "@/lib/http/api-route";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const GET = apiRoute(async () => {
  if (isDemoMode()) {
    return Response.json(
      { status: "ok", mode: "demo", database: "local" },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!hasDatabaseConfig() || !hasSupabaseConfig()) {
    return Response.json(
      {
        status: "degraded",
        mode: "production",
        database: hasDatabaseConfig() ? "configured" : "missing",
        authentication: hasSupabaseConfig() ? "configured" : "missing",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  await getPrisma().$queryRaw`SELECT 1`;

  return Response.json(
    {
      status: "ok",
      mode: "production",
      database: "reachable",
      authentication: "configured",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
