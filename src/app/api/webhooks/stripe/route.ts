import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getPrisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const prisma = getPrisma();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.companyId;

      if (companyId && session.customer && session.subscription) {
        await prisma.company.update({
          where: { id: companyId },
          data: {
            stripeCustomerId: String(session.customer),
            stripeSubscriptionId: String(session.subscription),
            subscriptionStatus: "ACTIVE",
          },
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.company.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { subscriptionStatus: "CANCELED" },
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await prisma.company.updateMany({
        where: { stripeCustomerId: String(invoice.customer) },
        data: { subscriptionStatus: "PAST_DUE" },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
