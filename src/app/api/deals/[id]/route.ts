import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { deleteDeal, getDeal, updateDeal } from '@/lib/db';
import { updateDealSchema } from '@/lib/schemas';
import { todayISO } from '@/lib/money';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const PATCHABLE = new Set([
  'brand', 'brand_contact', 'brand_email', 'brand_whatsapp', 'title', 'platform',
  'status', 'deal_value', 'currency', 'advance_pct', 'agreed_on', 'deliver_by',
  'delivered_on', 'invoice_number', 'invoice_sent_on', 'invoice_due_on', 'paid_on',
  'payment_status', 'payment_terms_days', 'escalation_contact',
  'gst_applicable', 'tds_pct', 'notes',
]);

function handleError(err: unknown) {
  if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
  if (err instanceof ZodError) {
    return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request', issues: err.issues }, { status: 400 });
  }
    console.error('[deals/:id]', err);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const deal = await getDeal(user.id, Number(id));
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json({ deal });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const dealId = Number(id);

    const existing = await getDeal(user.id, dealId);
    if (!existing) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const parsed = updateDealSchema.parse(body);

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!PATCHABLE.has(key) || value === undefined) continue;
      updates[key] = key === 'gst_applicable' ? (value ? 1 : 0) : value;
    }

    const today = todayISO();
    if (updates.status === 'delivered' && !('delivered_on' in updates) && !existing.delivered_on) {
      updates.delivered_on = today;
    }
    if ((updates.status === 'paid' || updates.payment_status === 'paid') && !('paid_on' in updates) && !existing.paid_on) {
      updates.paid_on = today;
    }
    if (updates.status === 'paid' && !('payment_status' in updates)) {
      updates.payment_status = 'paid';
    }
    if (updates.payment_status === 'invoiced' && !('invoice_sent_on' in updates) && !existing.invoice_sent_on) {
      updates.invoice_sent_on = today;
    }
    if (updates.payment_status === 'paid' && !('invoice_sent_on' in updates) && !existing.invoice_sent_on) {
      updates.invoice_sent_on = today;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ deal: existing, unchanged: true });
    }

    const deal = await updateDeal(user.id, dealId, updates);
    return NextResponse.json({ deal });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const ok = await deleteDeal(user.id, Number(id));
    if (!ok) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    return NextResponse.json({ deleted: Number(id) });
  } catch (err) {
    return handleError(err);
  }
}
