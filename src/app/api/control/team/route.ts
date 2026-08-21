import { apiRoute } from "@/lib/http/api-route";
import { teammateInviteSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { createTeammateProfile, listTeammates } from "@/lib/wia-control/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/observability";

export const GET = apiRoute(async (request: Request) => {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
  const context = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN"], companyId);
  if (context.response) return context.response;
  if (context.demo) return Response.json({ mode: "demo", teammates: [] });

  return Response.json({ mode: "database", teammates: await listTeammates(context.actor) });
});

/**
 * Invites an administrator or a manager: a Supabase login and a company
 * profile, created together.
 *
 * The rollback below mirrors the employee invitation exactly. If the profile
 * write fails after the login exists, the login is removed, so retrying with
 * the same address does not hit "user already exists" with nothing behind it.
 */
export const POST = apiRoute(async (request: Request) => {
  const body = await request.json();
  const context = await requireWiaApiContext(
    ["SUPER_ADMIN", "ADMIN"],
    requestedCompanyIdFromBody(body)
  );
  if (context.response) return context.response;
  const payload = teammateInviteSchema.parse(body);
  if (context.demo) {
    return Response.json({ teammate: { id: "demo-teammate", ...payload }, invitationSent: true });
  }

  const admin = createSupabaseAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(payload.email, {
    ...(appUrl ? { redirectTo: `${appUrl}/reset-password` } : {}),
  });
  if (error || !data.user) {
    return Response.json(
      { error: error?.message ?? "Could not create the login for this teammate." },
      { status: 400 }
    );
  }

  try {
    const teammate = await createTeammateProfile(context.actor, {
      supabaseUserId: data.user.id,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
    });
    return Response.json({ teammate, invitationSent: true }, { status: 201 });
  } catch (provisioningError) {
    let orphanedLogin = false;
    try {
      await admin.auth.admin.deleteUser(data.user.id);
    } catch (cleanupError) {
      orphanedLogin = true;
      logEvent({
        level: "error",
        event: "auth.orphaned_login",
        supabaseUserId: data.user.id,
        reason: "The teammate profile write failed and the login rollback failed too.",
        errorDetail: cleanupError instanceof Error ? cleanupError.message : "Unknown cleanup error.",
      });
    }
    const message =
      provisioningError instanceof Error
        ? provisioningError.message
        : "Could not create this teammate's profile.";
    return Response.json(
      {
        error: orphanedLogin
          ? `${message} A login was created and could not be removed; support must delete it before this address can be invited again.`
          : message,
        code: orphanedLogin ? "ORPHANED_LOGIN" : "TEAMMATE_PROVISIONING_FAILED",
        orphanedLogin,
      },
      { status: 400 }
    );
  }
});
