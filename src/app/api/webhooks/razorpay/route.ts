import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { countLifetimeSales, findPayment, getPlanInfo, grantPlan, insertPayment } from '@/lib/db';
import { LIFETIME_CAP, expectedPaymentPaise } from '@/lib/schemas';

export const dynamic = 'force-dynamic';


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

  const already = await findPayment('razorpay', paymentId);
  if (already) return NextResponse.json({ received: true, handled: true, duplicate: true });

  const now = Date.now();
  const existing = await getPlanInfo(userId);
  if (!existing) {
    return NextResponse.json({ received: true, handled: false, error: 'unknown user' });
  }

  const billing = payment.notes?.billing ?? 'monthly';

  const expected = expectedPaymentPaise(plan, billing);
  if (expected === null || payment.amount !== expected) {
    console.warn('[webhook] amount mismatch — not granting', { paymentId, amount: payment.amount, expected });
    return NextResponse.json({ received: true, handled: false, error: 'amount mismatch' });
  }
  let expiresAt: number | null;
  if (billing === 'lifetime') {
    if ((await countLifetimeSales()) >= LIFETIME_CAP) {
      console.warn('[webhook] lifetime cap reached — payment needs a manual refund', { paymentId, userId });
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
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
