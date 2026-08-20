import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { importKindSchema } from "@/lib/wia-control/csv-import";
import {
  confirmEmployeeCsvImport,
  confirmOperationalCsvImport,
  type EmployeeLoginProvisioner,
} from "@/lib/wia-control/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const requestSchema = z.object({
  companyId: z.string().min(1).optional(),
  kind: importKindSchema,
  csv: z.string().min(1).max(1_000_000),
});

/**
 * Provisions employee logins through the same Supabase invitation the single
 * employee form uses, so a bulk import never becomes a second, weaker way to
 * create an account.
 */
function supabaseInvitationProvisioner(): EmployeeLoginProvisioner {
  const admin = createSupabaseAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  return {
    invite: async (email) => {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        ...(appUrl ? { redirectTo: `${appUrl}/reset-password` } : {}),
      });
      if (error || !data.user) {
        throw new Error(error?.message ?? "Could not create the login for this employee.");
      }
      return { supabaseUserId: data.user.id };
    },
    revoke: async (supabaseUserId) => {
      await admin.auth.admin.deleteUser(supabaseUserId);
    },
  };
}

/**
 * Writes a previewed file. Operational imports are all-or-nothing, so a
 * rejected file answers 422 with the row that stopped it and nothing written.
 */
export const POST = apiRoute(async (request: Request) => {
  const raw = await request.json();
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    requestedCompanyIdFromBody(raw)
  );
  if (context.response) return context.response;
  if (context.demo) {
    return Response.json(
      { error: "CSV confirmation requires a connected workspace.", code: "DEMO_MODE" },
      { status: 403 }
    );
  }
  const payload = requestSchema.parse(raw);

  const result =
    payload.kind === "EMPLOYEES"
      ? await confirmEmployeeCsvImport(context.actor, payload.csv, supabaseInvitationProvisioner())
      : await confirmOperationalCsvImport(context.actor, payload.kind, payload.csv);

  return Response.json({ result }, { status: result.committed ? 200 : 422 });
});
