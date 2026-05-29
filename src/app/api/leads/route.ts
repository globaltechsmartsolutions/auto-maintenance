import { NextResponse } from "next/server";
import { z } from "zod";
import { hasDatabaseConfig, isDemoMode } from "@/lib/demo-mode";
import { leadPipeline } from "@/lib/mock-data";
import { getPrisma } from "@/lib/prisma";

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

export async function GET() {
  if (isDemoMode() || !hasDatabaseConfig()) {
    return NextResponse.json({ leads: leadPipeline });
  }

  const prisma = getPrisma();
  const leads = await prisma.lead.findMany({
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
}

export async function POST(request: Request) {
  const payload = leadSchema.parse(await request.json());

  if (isDemoMode() || !hasDatabaseConfig()) {
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

  const prisma = getPrisma();

  const lead = await prisma.lead.create({
    data: {
      ...payload,
      nextFollowUp: payload.nextFollowUp
        ? new Date(payload.nextFollowUp)
        : undefined,
    },
  });

  return NextResponse.json({ lead }, { status: 201 });
}
