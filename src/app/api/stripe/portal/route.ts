import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole, resolveCompanyId } from "@/lib/auth/api-auth";
import { hasDatabaseConfig, hasStripeConfig, isDemoMode } from "@/lib/demo-mode";
import { getPrisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { apiRoute } from "@/lib/http/api-route";

const portalSchema = z.object({
  companyId: z.string().optional(),
});

export const POST = apiRoute(async (request: Request) => {
  const payload = portalSchema.parse(await request.json());
  const requestOrigin = new URL(request.url).origin;
  const appUrl = isDemoMode()
    ? requestOrigin
    : process.env.NEXT_PUBLIC_APP_URL ?? requestOrigin;

  if (isDemoMode()) {
    return NextResponse.json({
      url: `${appUrl}/payments?portal=demo`,
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
    select: { stripeCustomerId: true },
  });

  if (!company?.stripeCustomerId) {
    return NextResponse.json(
      { error: "The company does not yet have an associated Stripe customer." },
      { status: 409 }
    );
  }

  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: company.stripeCustomerId,
    return_url: `${appUrl}/payments`,
  });

  return NextResponse.json({ url: session.url });
});
