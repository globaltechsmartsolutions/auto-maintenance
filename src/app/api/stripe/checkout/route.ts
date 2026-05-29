import { NextResponse } from "next/server";
import { z } from "zod";
import { hasStripeConfig, isDemoMode } from "@/lib/demo-mode";
import { getStripe } from "@/lib/stripe";

const checkoutSchema = z.object({
  priceId: z.string().optional(),
  priceEnv: z.string().optional(),
  companyId: z.string().optional(),
  customerEmail: z.string().email().optional(),
});

export async function POST(request: Request) {
  const payload = checkoutSchema.parse(await request.json());
  const priceId = payload.priceId ?? (payload.priceEnv ? process.env[payload.priceEnv] : undefined);
  const requestOrigin = new URL(request.url).origin;
  const appUrl = isDemoMode()
    ? requestOrigin
    : process.env.NEXT_PUBLIC_APP_URL ?? requestOrigin;

  if (isDemoMode() || !hasStripeConfig()) {
    return NextResponse.json({
      url: `${appUrl}/payments?checkout=demo`,
    });
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
    customer_email: payload.customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/payments?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/payments?checkout=cancelled`,
    metadata: {
      companyId: payload.companyId ?? "",
    },
  });

  return NextResponse.json({ url: session.url });
}
