import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { UnauthorizedError, requireUser, effectivePlan } from '@/lib/auth';
import { countActiveDeals, insertDeal, listDeals, type Deal } from '@/lib/db';
import { createDealSchema } from '@/lib/schemas';
import { PLANS, type PlanKey } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

function handleError(err: unknown) {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request', issues: err.issues }, { status: 400 });
  }
    console.error('[deals]', err);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

export async function GET() {
  try {
    const user = await requireUser();
    const deals = await listDeals(user.id);
    const plan = PLANS[effectivePlan(user) as PlanKey] ?? PLANS.free;
    return NextResponse.json({
      deals,
      count: deals.length,
      plan: {
        key: plan.key,
        label: plan.label,
        max_active_deals: plan.max_active_deals === Infinity ? null : plan.max_active_deals,
        active_deals: await countActiveDeals(user.id),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const parsed = createDealSchema.parse(body);

    /* Plan gating. Enforced here, not in the UI — a client-side check alone
       would let anyone POST straight to the API. */
    const plan = PLANS[effectivePlan(user) as PlanKey] ?? PLANS.free;
    const active = await countActiveDeals(user.id);
    const willBeActive = parsed.status !== 'paid' && parsed.status !== 'cancelled' && parsed.payment_status !== 'paid';
    if (willBeActive && active >= plan.max_active_deals) {
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

    const deal = await insertDeal(user.id, {
      ...parsed,
      gst_applicable: parsed.gst_applicable ? 1 : 0,
    });
    return NextResponse.json({ deal }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
