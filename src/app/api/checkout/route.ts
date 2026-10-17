import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import Stripe from 'stripe';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { PLANS, expectedMinorUnits } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

const schema = z
  .object({
    plan: z.enum(['creator', 'pro']),
    billing: z.enum(['monthly', 'quarterly', 'yearly', 'lifetime']).default('yearly'),
    currency: z.enum(['INR', 'USD']).default('INR'),
  })
  .refine((d) => d.billing !== 'lifetime' || d.plan === 'pro', {
    message: 'Lifetime is available on the Pro plan only',
  });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { plan, billing, currency } = schema.parse(body);
    const minor = expectedMinorUnits(plan, billing, currency);
    if (minor === null) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });

    if (billing === 'lifetime') {
      return NextResponse.json(
        { error: 'Lifetime is sold exclusively through our Payhip launch deal (first 50 only).' },
        { status: 410 }
      );
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const rzpId = process.env.RAZORPAY_KEY_ID;
    const rzpSecret = process.env.RAZORPAY_KEY_SECRET;

    if (stripeKey && (currency === 'USD' || !rzpId)) {
      const stripe = new Stripe(stripeKey);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: minor,
              product_data: { name: `DealFlow ${PLANS[plan].label} — ${billing}` },
            },
          },
        ],
        metadata: { user: String(user.id), plan, billing },
        client_reference_id: String(user.id),
        customer_email: user.email,
        success_url: `${site}/app?upgraded=1`,
        cancel_url: `${site}/app`,
      });
      return NextResponse.json({
        url: session.url,
        configured: true,
        rail: 'stripe',
        granted: false,
        amount: minor / 100,
        plan,
        billing,
        currency,
      });
    }

    if (currency === 'USD') {
      return NextResponse.json(
        { error: 'USD payments need Stripe — set STRIPE_SECRET_KEY (Razorpay is INR-only here).' },
        { status: 400 }
      );
    }

    let url: string | null = null;
    let apiError: string | undefined;
    if (rzpId && rzpSecret) {
      const res = await fetch('https://api.razorpay.com/v1/payment_links', {
        method: 'POST',
        headers: {
          authorization: 'Basic ' + Buffer.from(`${rzpId}:${rzpSecret}`).toString('base64'),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          amount: minor,
          currency: 'INR',
          accept_partial: false,
          reference_id: `${user.id}-${plan}-${billing}-${Date.now()}`,
          description: `DealFlow ${PLANS[plan].label} plan — ${billing}`,
          customer: { name: user.name, email: user.email },
          notes: { user: String(user.id), plan, billing, currency: 'INR' },
          callback_url: `${site}/app`,
          callback_method: 'get',
        }),
      });
      if (res.ok) {
        url = ((await res.json()) as { short_url?: string }).short_url ?? null;
      } else {
        apiError = `Razorpay API ${res.status}`;
        console.error('[checkout] payment link creation failed', res.status, await res.text());
      }
    }

    if (!url) {
      const fallback = new URL(`https://rzp.io/l/${rzpId || 'YOUR_RAZORPAY_KEY_ID'}`);
      fallback.searchParams.set('amount', String(minor));
      fallback.searchParams.set('currency', 'INR');
      fallback.searchParams.set('notes[user]', String(user.id));
      fallback.searchParams.set('notes[plan]', plan);
      fallback.searchParams.set('notes[billing]', billing);
      url = fallback.toString();
    }

    return NextResponse.json({
      url,
      configured: Boolean(rzpId && rzpSecret),
      rail: 'razorpay',
      granted: false,
      amount: minor / 100,
      plan,
      billing,
      currency,
      warning: rzpId && rzpSecret ? apiError : 'Set payment keys (Stripe or Razorpay) to generate a real link.',
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[checkout]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
