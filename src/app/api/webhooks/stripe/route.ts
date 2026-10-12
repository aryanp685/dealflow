import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { countLifetimeSales, findPayment, getPlanInfo, grantPlan, insertPayment } from '@/lib/db';
import { LIFETIME_CAP, expectedMinorUnits } from '@/lib/schemas';

export const dynamic = 'force-dynamic';


export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  const rawBody = await request.text();
  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch {
    console.warn('[stripe-webhook] rejected a payload with an invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true, handled: false });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = Number(session.metadata?.user ?? session.client_reference_id ?? 0);
  const plan = session.metadata?.plan ?? 'creator';
  const billing = session.metadata?.billing ?? 'monthly';
  const currency = (session.currency ?? 'inr').toUpperCase() as 'INR' | 'USD';

  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ received: true, handled: false, error: 'unknown user' });
  }

  const expected = expectedMinorUnits(plan, billing, currency);
  if (expected === null || session.amount_total !== expected) {
    console.warn('[stripe-webhook] amount mismatch — not granting', {
      session: session.id,
      amount: session.amount_total,
      expected,
    });
    return NextResponse.json({ received: true, handled: false, error: 'amount mismatch' });
  }

  const already = await findPayment('stripe', session.id);
  if (already) return NextResponse.json({ received: true, handled: true, duplicate: true });

  const now = Date.now();
  const existing = await getPlanInfo(userId);
  if (!existing) return NextResponse.json({ received: true, handled: false, error: 'unknown user' });

  let expiresAt: number | null;
  if (billing === 'lifetime') {
    if ((await countLifetimeSales()) >= LIFETIME_CAP) {
      console.warn('[stripe-webhook] lifetime cap reached — payment needs a manual refund', { session: session.id, userId });
      return NextResponse.json({ received: true, handled: false, error: 'lifetime sold out' });
    }
    expiresAt = null;
  } else {
    const durationMs = (billing === 'yearly' ? 365 : billing === 'quarterly' ? 90 : 30) * 86_400_000;
    const base = existing.plan_expires_at && existing.plan_expires_at > now ? existing.plan_expires_at : now;
    expiresAt = base + durationMs;
  }

  await grantPlan(userId, plan, expiresAt);
  await insertPayment({
    provider: 'stripe',
    provider_payment_id: session.id,
    user_id: userId,
    plan,
    billing,
    amount: session.amount_total ?? 0,
    currency,
  });

  return NextResponse.json({ received: true, handled: true });
}
