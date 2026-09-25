import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { findPayment, getPlanInfo, grantPlan, insertPayment } from '@/lib/db';
import { expectedPaymentPaise } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

// The only place that grants paid access. Checkout hands out a payment link
// and nothing more; without webhook-verified granting anyone could POST to
// /api/checkout and take Pro for free.
//
// Razorpay signs the raw body with HMAC-SHA256 and sends the hex digest in
// x-razorpay-signature, so this reads text rather than parsed JSON —
// re-serialising changes the bytes and breaks the digest.

const eventSchema = z.object({
  event: z.string(),
  payload: z
    .object({
      payment: z
        .object({
          entity: z.object({
            id: z.string(),
            status: z.string(),
            amount: z.number(),
            notes: z.record(z.string(), z.string()).optional(),
          }),
        })
        .optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    // Without a secret there is nothing to verify against, so accepting the
    // call would mean trusting an unauthenticated request with account access.
    console.error('[webhook] RAZORPAY_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const signature = request.headers.get('x-razorpay-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, signature, secret)) {
    console.warn('[webhook] rejected a payload with an invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
  }

  const result = eventSchema.safeParse(parsed);
  if (!result.success) {
    return NextResponse.json({ error: 'Unrecognised event shape' }, { status: 400 });
  }

  const { event, payload } = result.data;

  // Acknowledge unhandled events; a 4xx here makes Razorpay retry forever.
  if (event !== 'payment.captured') {
    return NextResponse.json({ received: true, handled: false });
  }

  const payment = payload?.payment?.entity;
  if (!payment || payment.status !== 'captured') {
    return NextResponse.json({ received: true, handled: false });
  }

  const userId = Number(payment.notes?.user ?? 0);
  const plan = payment.notes?.plan ?? 'creator';
  const paymentId = payment.id;

  if (!Number.isInteger(userId) || userId <= 0) {
    console.warn('[webhook] captured payment without a usable user note', { paymentId });
    return NextResponse.json({ received: true, handled: false });
  }

  // Razorpay retries webhooks, so a duplicate must not extend the plan twice.
  const already = await findPayment('razorpay', paymentId);
  if (already) return NextResponse.json({ received: true, handled: true, duplicate: true });

  const now = Date.now();
  const existing = await getPlanInfo(userId);
  if (!existing) {
    return NextResponse.json({ received: true, handled: false, error: 'unknown user' });
  }

  // Renewals stack from the current expiry, so paying early loses no days.
  const billing = payment.notes?.billing ?? 'monthly';

  // The captured amount must exactly equal the plan price — a tampered or
  // underpaid payment never grants access.
  const expected = expectedPaymentPaise(plan, billing);
  if (expected === null || payment.amount !== expected) {
    console.warn('[webhook] amount mismatch — not granting', { paymentId, amount: payment.amount, expected });
    return NextResponse.json({ received: true, handled: false, error: 'amount mismatch' });
  }
  const durationMs = (billing === 'yearly' ? 365 : billing === 'quarterly' ? 90 : 30) * 86_400_000;
  const base = existing.plan_expires_at && existing.plan_expires_at > now ? existing.plan_expires_at : now;

  await grantPlan(userId, plan, base + durationMs);
  await insertPayment({
    provider: 'razorpay',
    provider_payment_id: paymentId,
    user_id: userId,
    plan,
    billing,
    amount: payment.amount,
    currency: payment.notes?.currency ?? 'INR',
  });

  return NextResponse.json({ received: true, handled: true });
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(signature, 'hex');
  // Length mismatch means the header was not a hex digest at all.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
