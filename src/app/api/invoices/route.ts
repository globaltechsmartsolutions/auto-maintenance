import { NextResponse } from "next/server";
import { z } from "zod";
import {
  companyScope,
  requireApiRole,
  resolveCompanyId,
} from "@/lib/auth/api-auth";
import { hasDatabaseConfig, isDemoMode } from "@/lib/demo-mode";
import { invoices as demoInvoices } from "@/lib/mock-data";
import { getPrisma } from "@/lib/prisma";

const invoiceItemSchema = z.object({
  serviceId: z.string().optional(),
  description: z.string().min(2),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().nonnegative(),
  vatRate: z.number().default(21),
});

const invoiceSchema = z.object({
  companyId: z.string().min(1),
  customerId: z.string().min(1),
  number: z.string().min(1),
  dueDate: z.string().datetime().optional(),
  items: z.array(invoiceItemSchema).min(1),
});

export async function GET() {
  if (isDemoMode() || !hasDatabaseConfig()) {
    return NextResponse.json({ invoices: demoInvoices });
  }

  const auth = await requireApiRole(["SUPER_ADMIN", "ADMIN", "MANAGER"]);
  if (auth.response) return auth.response;

  const prisma = getPrisma();
  const invoices = await prisma.invoice.findMany({
    where: companyScope(auth.profile),
    orderBy: { issueDate: "desc" },
    include: {
      customer: true,
      items: true,
      payments: true,
    },
  });

  return NextResponse.json({ invoices });
}

export async function POST(request: Request) {
  const payload = invoiceSchema.parse(await request.json());

  const subtotal = payload.items.reduce(
    (total, item) => total + item.quantity * item.unitPrice,
    0
  );
  const vatAmount = payload.items.reduce(
    (total, item) => total + item.quantity * item.unitPrice * (item.vatRate / 100),
    0
  );

  if (isDemoMode() || !hasDatabaseConfig()) {
    return NextResponse.json(
      {
        invoice: {
          id: `demo-invoice-${Date.now()}`,
          ...payload,
          subtotal,
          vatAmount,
          total: subtotal + vatAmount,
          status: "DRAFT",
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

  const invoice = await prisma.invoice.create({
    data: {
      companyId,
      customerId: payload.customerId,
      number: payload.number,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
      subtotal,
      vatAmount,
      total: subtotal + vatAmount,
      items: {
        create: payload.items,
      },
    },
    include: {
      items: true,
    },
  });

  return NextResponse.json({ invoice }, { status: 201 });
}
