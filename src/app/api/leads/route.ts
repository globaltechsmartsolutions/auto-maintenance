import { NextResponse } from "next/server";
import { z } from "zod";
import {
  companyScope,
  requireApiRole,
  resolveCompanyId,
} from "@/lib/auth/api-auth";
import { hasDatabaseConfig, isDemoMode } from "@/lib/demo-mode";
import { leadPipeline } from "@/lib/mock-data";
import { getPrisma } from "@/lib/prisma";
import { assertUserInCompany } from "@/lib/wia-control/tenant-guards";
import { apiRoute } from "@/lib/http/api-route";

const leadSchema = z.object({
  companyId: z.string().min(1),
  assignedToId: z.string().optional(),
  name: z.string().min(2),
  companyName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  status: z
    .enum(["NEW", "QUALIFIED", "QUOTED", "WON", "LOST"])
    .default("NEW"),
  estimatedValue: z.number().default(0),
  probability: z.number().int().min(0).max(100).default(10),
  nextFollowUp: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
});

export const GET = apiRoute(async () => {
  if (isDemoMode()) {
    return NextResponse.json({ leads: leadPipeline });
  }

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ error: "The database is not configured." }, { status: 503 });
  }

  const auth = await requireApiRole(["SUPER_ADMIN", "ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;

  const prisma = getPrisma();
  const leads = await prisma.lead.findMany({
    where: companyScope(auth.profile),
    orderBy: { updatedAt: "desc" },
    include: {
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json({ leads });
});

export const POST = apiRoute(async (request: Request) => {
  const payload = leadSchema.parse(await request.json());

  if (isDemoMode()) {
    return NextResponse.json(
      {
        lead: {
          id: `demo-lead-${Date.now()}`,
          ...payload,
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  }

  if (!hasDatabaseConfig()) {
    return NextResponse.json({ error: "The database is not configured." }, { status: 503 });
  }

  const auth = await requireApiRole(["SUPER_ADMIN", "ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;

  const prisma = getPrisma();
  const companyId = resolveCompanyId(auth.profile, payload.companyId);

  await assertUserInCompany(companyId, payload.assignedToId);

  const lead = await prisma.lead.create({
    data: {
      ...payload,
      companyId,
      nextFollowUp: payload.nextFollowUp
        ? new Date(payload.nextFollowUp)
        : undefined,
    },
  });

  return NextResponse.json({ lead }, { status: 201 });
});
