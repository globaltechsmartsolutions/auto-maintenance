import { z } from "zod";
import { apiRoute } from "@/lib/http/api-route";
import { requireWiaApiContext } from "@/lib/wia-control/api-context";
import { listIncidents } from "@/lib/wia-control/service";

const querySchema = z.object({
    companyId: z.string().min(1).optional(),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
    worksiteId: z.string().min(1).optional(),
    employeeId: z.string().min(1).optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    ownerId: z.string().min(1).optional(),
    /** Shorthand for "assigned to me" without the client needing its own id. */
    mine: z.enum(["true", "false"]).optional(),
    status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"]).optional(),
});

export const GET = apiRoute(async (request: Request) => {
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const context = await requireWiaApiContext(
        ["SUPER_ADMIN", "ADMIN", "MANAGER"],
        query.companyId
    );
    if (context.response) return context.response;
    if (context.demo) return Response.json({ incidents: [] });

    const ownerId =
        query.mine === "true" ? context.actor.userId : query.ownerId;

    const incidents = await listIncidents(context.actor, {
        dateFrom: query.dateFrom ? new Date(`${query.dateFrom}T00:00:00.000Z`) : undefined,
        dateTo: query.dateTo ? new Date(`${query.dateTo}T00:00:00.000Z`) : undefined,
        worksiteId: query.worksiteId,
        employeeId: query.employeeId,
        severity: query.severity,
        status: query.status,
        ownerId,
    });

    return Response.json({
        incidents: incidents.map((incident) => ({
            id: incident.id,
            shiftId: incident.shiftId,
            shiftTitle: incident.shift?.title,
            type: incident.type,
            status: incident.status,
            severity: incident.severity,
            dueAt: incident.dueAt?.toISOString(),
            detectedAt: incident.detectedAt.toISOString(),
            title: incident.title,
            detail: incident.detail,
            resolutionNotes: incident.resolutionNotes ?? undefined,
            employeeId: incident.employeeId ?? undefined,
            employeeName: incident.employee
                ? `${incident.employee.user.firstName} ${incident.employee.user.lastName}`.trim()
                : undefined,
            worksiteId: incident.worksiteId,
            worksiteName: incident.worksite?.name,
            ownerId: incident.ownerId ?? undefined,
            ownerName: incident.owner
                ? `${incident.owner.firstName} ${incident.owner.lastName}`.trim()
                : undefined,
        })),
    });
});