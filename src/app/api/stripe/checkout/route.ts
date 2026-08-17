import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole, resolveCompanyId } from "@/lib/auth/api-auth";
import { hasDatabaseConfig, hasStripeConfig, isDemoMode } from "@/lib/demo-mode";
import { getPrisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { apiRoute } from "@/lib/http/api-route";

const checkoutSchema = z.object({
  plan: z.enum(["STARTER", "GROWTH", "SCALE"]),
  companyId: z.string().optional(),
});

const priceEnvironment: Record<z.infer<typeof checkoutSchema>["plan"], string> = {
  STARTER: "STRIPE_PRICE_STARTER",
  GROWTH: "STRIPE_PRICE_GROWTH",
  SCALE: "STRIPE_PRICE_SCALE",
};

export const POST = apiRoute(async (request: Request) => {
  const payload = checkoutSchema.parse(await request.json());
  const priceId = process.env[priceEnvironment[payload.plan]];
  const requestOrigin = new URL(request.url).origin;
  const appUrl = isDemoMode()
    ? requestOrigin
    : process.env.NEXT_PUBLIC_APP_URL ?? requestOrigin;

  if (isDemoMode()) {
    return NextResponse.json({
      url: `${appUrl}/payments?checkout=demo`,
    });
  }

  if (!hasStripeConfig() || !hasDatabaseConfig()) {
    return NextResponse.json(
      { error: "Stripe or the database is not configured." },
      { status: 503 }
    );
  }

  const auth = await requireApiRole(["SUPER_ADMIN", "ADMIN"]);
  if (auth.response) return auth.response;

  const requestedCompanyId = payload.companyId ?? auth.profile?.companyId;
  if (!requestedCompanyId) {
    return NextResponse.json({ error: "No company was specified." }, { status: 400 });
  }

  const companyId = resolveCompanyId(auth.profile, requestedCompanyId);
  const company = await getPrisma().company.findUnique({
    where: { id: companyId },
    select: {
      billingEmail: true,
      email: true,
      stripeCustomerId: true,
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Company no encontrada." }, { status: 404 });
  }

  const stripe = getStripe();

  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price id is not configured." },
      { status: 400 }
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ...(company.stripeCustomerId
      ? { customer: company.stripeCustomerId }
      : { customer_email: company.billingEmail ?? company.email ?? undefined }),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/payments?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/payments?checkout=cancelled`,
    metadata: {
      companyId,
      plan: payload.plan,
    },
  });

  return NextResponse.json({ url: session.url });
});
