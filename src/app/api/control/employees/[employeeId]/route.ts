import { z } from "zod";
import { ApiRouteError, apiRoute } from "@/lib/http/api-route";
import { employeeProfileUpdateSchema } from "@/lib/wia-control/domain";
import { requireWiaApiContext, requestedCompanyIdFromBody } from "@/lib/wia-control/api-context";
import { deleteEmployeeProfile, updateEmployeeProfile } from "@/lib/wia-control/service";

const requestSchema = employeeProfileUpdateSchema.and(
    z.object({ companyId: z.string().min(1).optional() })
);

export const PATCH = apiRoute(async (
    request: Request,
    context: { params: Promise<{ employeeId: string }> }
) => {
    const { employeeId } = await context.params;
    const rawPayload = await request.json();
    const apiContext = await requireWiaApiContext(
        ["SUPER_ADMIN", "ADMIN", "MANAGER"],
        requestedCompanyIdFromBody(rawPayload)
    );
    if (apiContext.response) return apiContext.response;
    if (typeof rawPayload === "object" && rawPayload !== null && "email" in rawPayload) {
        throw new ApiRouteError(
            400,
            "SIGN_IN_EMAIL_CHANGE_UNSUPPORTED",
            "Sign-in email changes require a separate verified identity workflow."
        );
    }
    const payload = requestSchema.parse(rawPayload);
    if (apiContext.demo) {
        return Response.json({ employee: { id: employeeId, ...payload } });
    }

    const employee = await updateEmployeeProfile(apiContext.actor, employeeId, payload);
    return Response.json({ employee });
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
