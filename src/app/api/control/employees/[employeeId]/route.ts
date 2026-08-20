import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { employeeProfileUpdateSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { deleteEmployeeProfile, updateEmployeeProfile } from "@/lib/wia-control/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const requestSchema = employeeProfileUpdateSchema.and(
    z.object({ companyId: z.string().min(1).optional() })
);

export const PATCH = apiRoute(async (
    request: Request,
    context: { params: Promise<{ employeeId: string }> }
) => {
    const { employeeId } = await context.params;
    const { companyId, ...payload } = requestSchema.parse(await request.json());
    const apiContext = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], companyId);
    if (apiContext.response) return apiContext.response;
    if (apiContext.demo) {
        return Response.json({ employee: { id: employeeId, ...payload } });
    }

    const employee = await updateEmployeeProfile(apiContext.actor, employeeId, payload);

    // The Postgres email is authoritative for display, but the employee
    // signs in through Supabase Auth -- if it changed, keep that login
    // email in sync too. Best-effort: the profile change itself is already
    // committed, so a sync failure here is reported, not rolled back.
    let authEmailSyncWarning: string | undefined;
    if (employee.emailChanged && employee.supabaseUserId) {
        try {
            const admin = createSupabaseAdminClient();
            const { error } = await admin.auth.admin.updateUserById(employee.supabaseUserId, {
                email: employee.user.email,
            });
            if (error) authEmailSyncWarning = error.message;
        } catch (error) {
            authEmailSyncWarning =
                error instanceof Error ? error.message : "Could not update the login email.";
        }
    }

    return Response.json({ employee, authEmailSyncWarning });
});

export const DELETE = apiRoute(async (
    request: Request,
    context: { params: Promise<{ employeeId: string }> }
) => {
    const { employeeId } = await context.params;
    const companyId = new URL(request.url).searchParams.get("companyId") ?? undefined;
    const apiContext = await requireWiaApiContext(["SUPER_ADMIN", "ADMIN", "MANAGER"], companyId);
    if (apiContext.response) return apiContext.response;
    if (apiContext.demo) return Response.json({ employee: { id: employeeId } });

    const employee = await deleteEmployeeProfile(apiContext.actor, employeeId);
    return Response.json({ employee });
});

