import { NextResponse } from 'next/server';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { listDeals, type Deal } from '@/lib/db';
import { computeDealMoney, overdueDays, ageingBucket, round2, toINR, USD_INR } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    const deals = await listDeals(user.id);
    const today = new Date();

    let gross = 0, gst = 0, tds = 0, net = 0;
    let outstanding = 0, overdueTotal = 0, collected = 0;
    let inrOutstanding = 0, usdOutstanding = 0;
    let hasUsd = false;

    const byStatus: Record<string, number> = {};
    const byBrand = new Map<string, { brand: string; deals: number; gross: number; outstanding: number }>();
    const byMonth = new Map<string, { month: string; gross: number; collected: number }>();
    const ageing: Record<string, { count: number; amount: number }> = {
      current: { count: 0, amount: 0 },
      '1-15': { count: 0, amount: 0 },
      '16-30': { count: 0, amount: 0 },
      '31-60': { count: 0, amount: 0 },
      '60+': { count: 0, amount: 0 },
    };

    for (const deal of deals) {
      if (deal.status === 'cancelled' || deal.payment_status === 'cancelled') continue;
      if (deal.currency !== 'INR') hasUsd = true;

      const m = computeDealMoney(deal);
      const blend = (x: number) => toINR(x, deal.currency);
      gross += blend(m.gross);
      gst += blend(m.gst_amount);
      tds += blend(m.tds_amount);
      net += blend(m.net_receivable);

      byStatus[deal.status] = (byStatus[deal.status] ?? 0) + 1;

      const b = byBrand.get(deal.brand) ?? { brand: deal.brand, deals: 0, gross: 0, outstanding: 0 };
      b.deals += 1;
      b.gross = round2(b.gross + blend(m.gross));
      byBrand.set(deal.brand, b);

      const isPaid = deal.payment_status === 'paid';
      const monthOf = (s: string) => (s || deal.created_at).slice(0, 7);

      if (isPaid) {
        collected += blend(m.net_receivable);
        const month = monthOf(deal.paid_on ?? '');
        const row = byMonth.get(month) ?? { month, gross: 0, collected: 0 };
        row.collected = round2(row.collected + blend(m.net_receivable));
        byMonth.set(month, row);
        continue;
      }

      if (deal.payment_status === 'not_invoiced' && deal.status === 'negotiating') continue;

      const month = monthOf(deal.agreed_on ?? '');
      const row = byMonth.get(month) ?? { month, gross: 0, collected: 0 };
      row.gross = round2(row.gross + blend(m.gross));
      byMonth.set(month, row);

      const billed =
        deal.payment_status !== 'not_invoiced' ||
        deal.status === 'delivered' ||
        deal.status === 'invoiced';
      if (!billed) continue;

      const owed =
        deal.advance_pct > 0 && deal.payment_status === 'advance_paid' ? m.balance_due : m.net_receivable;
      const owedInr = blend(owed);
      outstanding += owedInr;
      if (deal.currency === 'INR') inrOutstanding += owed;
      else usdOutstanding += owed;

      const days = overdueDays(deal.invoice_due_on, deal.payment_status, today);
      const bucket = ageingBucket(days);
      ageing[bucket].count += 1;
      ageing[bucket].amount = round2(ageing[bucket].amount + owedInr);
      if (days > 0) overdueTotal += owedInr;

      byBrand.get(deal.brand)!.outstanding = round2(byBrand.get(deal.brand)!.outstanding + owedInr);
    }

    const overdueDeals = deals
      .filter(
        (d) =>
          d.payment_status !== 'paid' &&
          d.payment_status !== 'cancelled' &&
          overdueDays(d.invoice_due_on, d.payment_status, today) > 0
      )
      .map((d) => ({
        id: d.id,
        brand: d.brand,
        title: d.title,
        invoice_number: d.invoice_number,
        invoice_due_on: d.invoice_due_on,
        days_overdue: overdueDays(d.invoice_due_on, d.payment_status, today),
        amount: computeDealMoney(d).net_receivable,
        currency: d.currency,
      }))
      .sort((a, b) => b.days_overdue - a.days_overdue);

    const pipelineValue = deals
      .filter((d) => ['negotiating', 'agreed'].includes(d.status) && d.payment_status !== 'cancelled')
      .reduce((sum, d) => sum + toINR(computeDealMoney(d).gross, d.currency), 0);

    const paidCount = deals.filter((d) => d.payment_status === 'paid').length;
    const closedCount = deals.filter((d) => d.status !== 'negotiating' && d.status !== 'cancelled').length;
    const liveCount = deals.filter((d) => d.status !== 'cancelled' && d.payment_status !== 'cancelled').length;

    const monthly = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
    const monthlyGross = monthly.map((m) => m.gross);
    const monthlyCollected = monthly.map((m) => m.collected);

    return NextResponse.json({
      totals: {
        gross: round2(gross),
        gst: round2(gst),
        tds: round2(tds),
        net: round2(net),
        collected: round2(collected),
        outstanding: round2(outstanding),
        overdue: round2(overdueTotal),
        pipeline: round2(pipelineValue),
        inr_outstanding: round2(inrOutstanding),
        usd_outstanding: round2(usdOutstanding),
        usd_inr_rate: USD_INR,
        peak_month: Math.max(0, ...monthlyGross, ...monthlyCollected),
      },
      counts: {
        total_deals: deals.length,
        paid: paidCount,
        conversion_rate: closedCount > 0 ? Math.round((paidCount / closedCount) * 100) : 0,
        avg_deal_value: liveCount > 0 ? round2(gross / liveCount) : 0,
        has_usd: hasUsd,
      },
      by_status: byStatus,
      ageing,
      overdue_deals: overdueDeals,
      top_brands: [...byBrand.values()].sort((a, b) => b.gross - a.gross).slice(0, 8),
      monthly,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
        console.error('[metrics]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
