import { NextResponse } from "next/server";
import { z } from "zod";
import { hasStripeConfig, isDemoMode } from "@/lib/demo-mode";
import { getStripe } from "@/lib/stripe";

const portalSchema = z.object({
  customerId: z.string().min(1),
});

export async function POST(request: Request) {
  const { customerId } = portalSchema.parse(await request.json());
  const requestOrigin = new URL(request.url).origin;
  const appUrl = isDemoMode()
    ? requestOrigin
    : process.env.NEXT_PUBLIC_APP_URL ?? requestOrigin;

  if (isDemoMode() || !hasStripeConfig()) {
    return NextResponse.json({
      url: `${appUrl}/payments?portal=demo&customer=${customerId}`,
    });
  }

  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/payments`,
  });

  return NextResponse.json({ url: session.url });
}
