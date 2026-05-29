import { NextResponse } from "next/server";
import { z } from "zod";
import {
  companyScope,
  requireApiRole,
  resolveCompanyId,
} from "@/lib/auth/api-auth";
import { hasDatabaseConfig, isDemoMode } from "@/lib/demo-mode";
import { services as demoServices } from "@/lib/mock-data";
import { getPrisma } from "@/lib/prisma";

const serviceSchema = z.object({
  companyId: z.string().min(1),
  customerId: z.string().min(1),
  title: z.string().min(2),
  description: z.string().optional(),
  serviceType: z.string().min(2),
  recurrence: z
    .enum(["ONE_TIME", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "CUSTOM"])
    .default("ONE_TIME"),
  status: z
    .enum(["PENDING", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .default("PENDING"),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  price: z.number().default(0),
  vatRate: z.number().default(21),
  employeeIds: z.array(z.string()).default([]),
});

export async function GET() {
  if (isDemoMode() || !hasDatabaseConfig()) {
    return NextResponse.json({ services: demoServices });
  }

  const auth = await requireApiRole([
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "EMPLOYEE",
  ]);
  if (auth.response) return auth.response;

  const prisma = getPrisma();
  const services = await prisma.service.findMany({
    where: companyScope(auth.profile),
    orderBy: { scheduledStart: "asc" },
    include: {
      customer: true,
      assignments: {
        include: {
          employee: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ services });
}

export async function POST(request: Request) {
  const payload = serviceSchema.parse(await request.json());

  if (isDemoMode() || !hasDatabaseConfig()) {
    return NextResponse.json(
      {
        service: {
          id: `demo-service-${Date.now()}`,
          ...payload,
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  }

  const auth = await requireApiRole(["SUPER_ADMIN", "ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;

  const prisma = getPrisma();
  const companyId = resolveCompanyId(auth.profile, payload.companyId);

  const service = await prisma.service.create({
    data: {
      companyId,
      customerId: payload.customerId,
      title: payload.title,
      description: payload.description,
      serviceType: payload.serviceType,
      recurrence: payload.recurrence,
      status: payload.status,
      scheduledStart: payload.scheduledStart
        ? new Date(payload.scheduledStart)
        : undefined,
      scheduledEnd: payload.scheduledEnd
        ? new Date(payload.scheduledEnd)
        : undefined,
      address: payload.address,
      city: payload.city,
      price: payload.price,
      vatRate: payload.vatRate,
      assignments: {
        create: payload.employeeIds.map((employeeId) => ({ employeeId })),
      },
    },
  });

  return NextResponse.json({ service }, { status: 201 });
}
