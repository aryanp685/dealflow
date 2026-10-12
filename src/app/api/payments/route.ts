import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { UnauthorizedError, requireUser, effectivePlan } from '@/lib/auth';
import { countActiveDeals, insertDeal } from '@/lib/db';
import { paymentLinkSchema, PLANS, type PlanKey } from '@/lib/schemas';
import { computeDealMoney, round2, shiftDaysISO, todayISO } from '@/lib/money';

export const dynamic = 'force-dynamic';

// Builds a Razorpay Payment Link and optionally logs the matching deal.
// Payment Links are created in the merchant dashboard and take a pre-filled
// amount via query params, so no server secret is needed here.
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const input = paymentLinkSchema.parse(body);

    const merchantId = process.env.RAZORPAY_KEY_ID || 'YOUR_RAZORPAY_KEY_ID';
    const configured = merchantId !== 'YOUR_RAZORPAY_KEY_ID';
    const note = input.note ?? `Brand deal payment — ${input.brand}`;

    const link = new URL(`https://rzp.io/l/${merchantId}`);
    link.searchParams.set('amount', String(Math.round(input.amount * 100)));
    link.searchParams.set('currency', input.currency);
    link.searchParams.set('notes[brand]', input.brand);
    link.searchParams.set('notes[deal]', input.title ?? note);
    link.searchParams.set('notes[creator]', String(user.id));

    let deal = null;
    if (input.log_deal) {
      // Same gate as POST /api/deals — without it the free plan's 3-deal
      // limit is bypassed by generating payment links instead of deals.
      const plan = PLANS[effectivePlan(user) as PlanKey] ?? PLANS.free;
      const active = await countActiveDeals(user.id);
      if (active >= plan.max_active_deals) {
        return NextResponse.json(
          {
            error: `The ${plan.label} plan covers ${plan.max_active_deals} active deals. Upgrade to keep tracking more.`,
            code: 'plan_limit',
            limit: plan.max_active_deals,
            active,
          },
          { status: 402 }
        );
      }
      // A payment link IS an invoice: stamp the dates so reminders and ageing
      // treat it like one instead of an undated, unchasable row.
      const today = todayISO();
      deal = await insertDeal(user.id, {
        brand: input.brand,
        title: input.title ?? 'Brand deal',
        deal_value: input.amount,
        currency: input.currency,
        status: 'invoiced',
        payment_status: 'invoiced',
        notes: note,
        gst_applicable: 0,
        tds_pct: 0,
        advance_pct: 0,
        agreed_on: today,
        invoice_sent_on: today,
        invoice_due_on: shiftDaysISO(today, 15),
      });
    }

    return NextResponse.json({
      payment_link: link.toString(),
      configured,
      amount: input.amount,
      currency: input.currency,
      money: deal ? computeDealMoney(deal) : { net_receivable: round2(input.amount) },
      deal,
      warning: configured
        ? undefined
        : 'Set RAZORPAY_KEY_ID in .env.local — the link above is a placeholder.',
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[payments]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
