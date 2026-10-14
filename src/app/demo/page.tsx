import type { Metadata } from 'next';
import Link from 'next/link';
import { computeDealMoney, formatMoney, toINR } from '@/lib/money';
import { buildReminders } from '@/lib/reminders';
import type { Deal } from '@/lib/db-types';
import { getDemoDeals } from '@/lib/demo';
import Logo from '@/components/logo';

export const metadata: Metadata = {
  title: 'Live demo — DealFlow',
  description: 'Explore DealFlow with six sample brand deals. No signup needed.',
};

export const dynamic = 'force-dynamic';

export default function DemoPage() {
  const deals: Deal[] = getDemoDeals().map((d, i) => ({
    id: i + 1,
    creator_id: 0,
    brand: d.brand,
    brand_contact: d.brand_contact,
    brand_email: d.brand_email,
    brand_whatsapp: null,
    title: d.title,
    platform: d.platform,
    status: d.status as Deal['status'],
    deal_value: d.deal_value,
    currency: d.currency,
    advance_pct: d.advance_pct,
    agreed_on: d.agreed_on ?? null,
    deliver_by: d.deliver_by ?? null,
    delivered_on: d.delivered_on ?? null,
    invoice_number: d.invoice_number ?? null,
    invoice_sent_on: d.invoice_sent_on ?? null,
    invoice_due_on: d.invoice_due_on ?? null,
    paid_on: d.paid_on ?? null,
    payment_status: d.payment_status as Deal['payment_status'],
    payment_terms_days: 15,
    escalation_contact: null,
    gst_applicable: d.gst_applicable,
    tds_pct: d.tds_pct,
    notes: d.notes,
    created_at: '',
    updated_at: '',
  }));
  const rows = deals.map((deal) => ({ deal, cash: computeDealMoney(deal) }));
  const inr = (deal: Deal, amount: number) => toINR(amount, deal.currency);
  const stuck = rows
    .filter(({ deal }) => deal.payment_status !== 'paid' && deal.payment_status !== 'cancelled')
    .reduce((s, r) => s + inr(r.deal, r.cash.net_receivable), 0);
  const overdue = rows
    .filter(({ deal }) => deal.payment_status === 'overdue')
    .reduce((s, r) => s + inr(r.deal, r.cash.net_receivable), 0);
  const collected = rows
    .filter(({ deal }) => deal.payment_status === 'paid')
    .reduce((s, r) => s + inr(r.deal, r.cash.net_receivable), 0);
  const reminders = buildReminders(deals).slice(0, 3);

  return (
    <div className="shell">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>
        <Link href="/signup" className="btn primary">Start free — track your own deals</Link>
      </div>

      <div className="notice">
        <strong>Live demo with sample data.</strong> Six realistic deals — one overdue, one due soon,
        one paid, one in USD. Nothing here is real; sign up free and your own data stays private.
      </div>

      <div className="kpi-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-sub">Money stuck</div>
          <div style={{ fontSize: 28, fontWeight: 750 }}>{formatMoney(stuck)}</div>
          <div className="t-muted dim">Earned or billed, not yet paid</div>
        </div>
        <div className="card">
          <div className="card-sub">Overdue</div>
          <div style={{ fontSize: 28, fontWeight: 750 }}>{formatMoney(overdue)}</div>
          <div className="t-muted dim">Past the invoice due date</div>
        </div>
        <div className="card">
          <div className="card-sub">Collected</div>
          <div style={{ fontSize: 28, fontWeight: 750 }}>{formatMoney(collected)}</div>
          <div className="t-muted dim">Safely in the bank</div>
        </div>
      </div>

      <div className="card table-card" style={{ marginTop: 16 }}>
        <h3 className="card-title">Sample deals</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Brand / deal</th>
                <th>Stage</th>
                <th>Payment</th>
                <th>Deadline</th>
                <th className="t-right">Value</th>
                <th className="t-right">You receive</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ deal, cash }) => (
                <tr key={deal.id}>
                  <td>
                    <strong>{deal.brand}</strong>
                    <div className="t-muted dim">{deal.title}</div>
                  </td>
                  <td>{deal.status}</td>
                  <td>{deal.payment_status.replace(/_/g, ' ')}</td>
                  <td>{deal.deliver_by ?? '—'}</td>
                  <td className="t-right">{formatMoney(cash.gross, deal.currency)}</td>
                  <td className="t-right">{formatMoney(cash.net_receivable, deal.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="card-title">Follow-ups DealFlow would send</h3>
        <p className="card-sub">Every reminder opens WhatsApp with the message already written.</p>
        {reminders.map((r) => (
          <div key={`${r.deal_id}-${r.kind}`} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div>
              <strong>{r.brand}</strong> <span className="t-muted dim">· {r.headline}</span>
            </div>
            {r.money && <div className="t-muted dim">{r.money}</div>}
            <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
              {r.message.length > 320 ? `${r.message.slice(0, 320)}…` : r.message}
            </p>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, textAlign: 'center' }}>
        <h3 className="card-title">See your own stuck money</h3>
        <p className="card-sub">Free for 3 deals. Two minutes to your first follow-up.</p>
        <Link href="/signup" className="btn primary lg">Start free</Link>
      </div>
    </div>
  );
}
