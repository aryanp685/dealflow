'use client';

import { useMemo, useState } from 'react';
import { m } from 'motion/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Kpi, BarRow, EmptyState, Pill, DashboardSkeleton, staggerParent, listItem } from './ui';
import { computeDealMoney, formatMoney, formatDate } from '@/lib/money';
import { UDYAM_URL, SAMADHAAN_URL } from '@/lib/msme';
import type { Deal } from '@/lib/db';

type Metrics = {
  totals: {
    gross: number; gst: number; tds: number; net: number; collected: number;
    outstanding: number; overdue: number; pipeline: number;
    inr_outstanding: number; usd_outstanding: number; peak_month: number; usd_inr_rate: number;
  };
  counts: { total_deals: number; paid: number; conversion_rate: number; avg_deal_value: number; has_usd: boolean };
  by_status: Record<string, number>;
  ageing: Record<string, { count: number; amount: number }>;
  overdue_deals: Array<{
    id: number; brand: string; title: string; invoice_number: string | null;
    invoice_due_on: string | null; days_overdue: number; amount: number; currency: string;
  }>;
  top_brands: Array<{ brand: string; deals: number; gross: number; outstanding: number }>;
  monthly: Array<{ month: string; gross: number; collected: number }>;
};

const AGEING_LABEL: Record<string, string> = {
  current: 'Not due yet', '1-15': '1–15 days', '16-30': '16–30 days', '31-60': '31–60 days', '60+': '60+ days',
};
const AGEING_TONE: Record<string, 'green' | 'amber' | 'red'> = {
  current: 'green', '1-15': 'amber', '16-30': 'amber', '31-60': 'red', '60+': 'red',
};

export default function Dashboard({
  deals,
  onNew,
  onSeed,
  onChanged,
}: {
  deals: Deal[];
  onNew: () => void;
  onSeed: () => void;
  onChanged: (msg: string, tone?: 'ok' | 'err') => void;
}) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: async () => {
      const res = await fetch('/api/metrics');
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Failed to load metrics');
      return (await res.json()) as Metrics;
    },
  });

  const markPaid = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payment_status: 'paid' }),
      });
      if (!res.ok) throw new Error('Could not update the deal');
      return res.json();
    },
    onSuccess: () => onChanged('Marked paid 🎉'),
    onError: (e: Error) => onChanged(e.message, 'err'),
  });

  const maxAgeing = useMemo(
    () => (metrics ? Math.max(1, ...Object.values(metrics.ageing).map((a) => a.amount)) : 1),
    [metrics]
  );

  if (deals.length === 0) {
    return (
      <EmptyState
        icon="📥"
        title="No deals logged yet"
        body="Log your first brand deal, or load six realistic samples to see every screen working in five seconds."
        illustration="🎯"
        action={
          <>
            <button className="btn primary" onClick={onNew}>+ Log your first deal</button>
            <button className="btn" onClick={onSeed}>Load sample deals</button>
          </>
        }
      />
    );
  }

  if (isLoading || !metrics) return <DashboardSkeleton />;

  const t = metrics.totals;

  return (
    <m.div variants={staggerParent} initial="initial" animate="animate">
      <div className="kpi-grid">
        <Kpi
          label="Money stuck"
          value={t.outstanding}
          format={(n) => formatMoney(n)}
          note="Earned or billed, not yet paid"
          tone="bad"
        />
        <Kpi
          label="Overdue"
          value={t.overdue}
          format={(n) => formatMoney(n)}
          note={`${metrics.overdue_deals.length} invoice(s) past due`}
          tone={t.overdue > 0 ? 'bad' : 'default'}
        />
        <Kpi
          label="Collected"
          value={t.collected}
          format={(n) => formatMoney(n)}
          note={`${metrics.counts.paid} deal(s) paid`}
          tone="good"
        />
        <Kpi
          label="Pipeline"
          value={t.pipeline}
          format={(n) => formatMoney(n)}
          note="Negotiating + agreed"
        />
      </div>

      <m.div className="card" variants={listItem} style={{ borderColor: 'rgba(124,92,255,.35)' }}>
        <h3 className="card-title">⚖️ Give your invoices legal teeth — Udyam registration (free, 10 min)</h3>
        <p className="card-sub">
          Udyam-registered suppliers are protected by the MSMED Act: brands <strong>must pay within 45 days</strong>,
          and late payment accrues compound interest at <strong>3× the RBI bank rate</strong> — legally enforceable.
          DealFlow cites this automatically once an invoice crosses 30 days, and if a brand still stalls, the free{' '}
          <a href={SAMADHAAN_URL} target="_blank" rel="noopener noreferrer">MSME Samadhaan portal</a> takes online
          complaints that brands genuinely fear. Not registered yet?{' '}
          <a href={UDYAM_URL} target="_blank" rel="noopener noreferrer">Do it now — it is free and covers pending dues too.</a>
        </p>
      </m.div>

      <div className="row">
        <m.div className="card" style={{ flex: 2 }} variants={listItem}>
          <h3 className="card-title">Invoice ageing</h3>
          <p className="card-sub">
            How old is the money you&apos;re waiting on? Past 30 days it needs escalation, not another polite nudge.
          </p>
          <m.div variants={staggerParent} initial="initial" animate="animate">
            {Object.entries(metrics.ageing).map(([bucket, v]) => (
              <BarRow
                key={bucket}
                label={AGEING_LABEL[bucket] ?? bucket}
                value={v.amount}
                max={maxAgeing}
                tone={AGEING_TONE[bucket] ?? 'accent'}
                display={v.count ? `${formatMoney(v.amount, 'INR', { compact: true })} · ${v.count}` : '—'}
              />
            ))}
          </m.div>
        </m.div>

        <m.div className="card" style={{ flex: 1 }} variants={listItem}>
          <h3 className="card-title">This year so far</h3>
          <p className="card-sub">Net of TDS, including GST where applicable.</p>
          {metrics.counts.has_usd && (
            <p className="card-sub">USD deals blended at a fixed ₹{t.usd_inr_rate}/$ in headline totals.</p>
          )}
          <div className="stat-list">
            <Stat k="Gross deal value" v={formatMoney(t.gross)} />
            <Stat k="GST collected" v={formatMoney(t.gst)} />
            <Stat k="TDS deducted" v={`− ${formatMoney(t.tds)}`} />
            <div className="stat-divider">
              <Stat k="Net receivable" v={formatMoney(t.net)} strong />
            </div>
            <Stat k="Avg deal size" v={formatMoney(metrics.counts.avg_deal_value)} />
            <Stat k="Paid conversion" v={`${metrics.counts.conversion_rate}%`} />
          </div>
        </m.div>
      </div>

      {metrics.overdue_deals.length > 0 && (
        <m.div className="card card-alert" variants={listItem}>
          <h3 className="card-title red">
            🚨 {metrics.overdue_deals.length} overdue invoice{metrics.overdue_deals.length > 1 ? 's' : ''}
          </h3>
          <p className="card-sub">
            Chase these today. The <strong>Follow-ups</strong> tab has a ready-to-send message for each one.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Brand</th><th>Invoice</th><th>Due</th>
                  <th className="t-right">Days late</th><th className="t-right">Amount</th><th />
                </tr>
              </thead>
              <tbody>
                {metrics.overdue_deals.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="t-strong">{o.brand}</div>
                      <div className="t-muted">{o.title}</div>
                    </td>
                    <td className="t-muted">{o.invoice_number || '—'}</td>
                    <td className="t-muted">{formatDate(o.invoice_due_on)}</td>
                    <td className="t-right"><Pill tone="red">{o.days_overdue}d</Pill></td>
                    <td className="t-right t-money">{formatMoney(o.amount, o.currency)}</td>
                    <td className="t-right">
                      <button
                        className="btn sm green"
                        disabled={markPaid.isPending}
                        onClick={() => markPaid.mutate(o.id)}
                      >
                        Mark paid
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </m.div>
      )}

      {metrics.top_brands.length > 0 && (
        <m.div className="card" variants={listItem}>
          <h3 className="card-title">Top brands</h3>
          <p className="card-sub">Who gives you the most work — and who still owes you.</p>
          <m.div variants={staggerParent} initial="initial" animate="animate">
            {metrics.top_brands.map((b) => (
              <BarRow
                key={b.brand}
                label={b.brand}
                value={b.gross}
                max={Math.max(1, metrics.top_brands[0].gross)}
                display={`${formatMoney(b.gross, 'INR', { compact: true })} · ${b.deals}`}
              />
            ))}
          </m.div>
        </m.div>
      )}

      {metrics.monthly.length > 0 && (
        <MonthlyChart monthly={metrics.monthly} peak={t.peak_month} />
      )}

      <CollectPayment deals={deals} notify={onChanged} />
    </m.div>
  );
}

function Stat({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`stat-line ${strong ? 'strong' : ''}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function MonthlyChart({ monthly, peak }: { monthly: Array<{ month: string; gross: number; collected: number }>; peak: number }) {
  return (
    <m.div className="card" variants={listItem}>
      <h3 className="card-title">Monthly trend</h3>
      <p className="card-sub">Gross agreed vs. actually collected. A widening gap means your chasing isn&apos;t working.</p>
      <div className="chart">
        {monthly.map((row) => {
          const label = new Date(`${row.month}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'short' });
          return (
            <div className="chart-col" key={row.month}>
              <div className="chart-bars">
                <m.div
                  className="chart-bar gross"
                  title={`Gross ${formatMoney(row.gross)}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${peak > 0 ? (row.gross / peak) * 100 : 0}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                />
                <m.div
                  className="chart-bar collected"
                  title={`Collected ${formatMoney(row.collected)}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${peak > 0 ? (row.collected / peak) * 100 : 0}%` }}
                  transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <div className="chart-label">{label}</div>
            </div>
          );
        })}
      </div>
      <div className="chart-legend">
        <span><i className="dot gross" /> Gross agreed</span>
        <span><i className="dot collected" /> Collected</span>
      </div>
    </m.div>
  );
}

function CollectPayment({
  deals,
  notify,
}: {
  deals: Deal[];
  notify: (msg: string, tone?: 'ok' | 'err') => void;
}) {
  const unpaid = deals.filter(
    (d) => d.payment_status !== 'paid' && d.payment_status !== 'cancelled' && d.deal_value > 0
  );
  const [picked, setPicked] = useState('');
  const [link, setLink] = useState<{ url: string; configured: boolean } | null>(null);

  const selected = unpaid.find((d) => String(d.id) === picked);

  const generate = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Pick a deal first');
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brand: selected.brand,
          title: selected.title,
          amount: computeDealMoney(selected).invoice_total,
          currency: selected.currency,
          note: `${selected.title} — ${selected.invoice_number || 'brand deal'}`,
          log_deal: false,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not generate the link');
      return res.json();
    },
    onSuccess: (j) => setLink({ url: j.payment_link, configured: j.configured }),
    onError: (e: Error) => notify(e.message, 'err'),
  });

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      notify('Payment link copied — send it on WhatsApp');
    } catch {
      notify('Copy failed — select the link manually', 'err');
    }
  };

  return (
    <m.div className="card" variants={listItem}>
      <h3 className="card-title">💸 Collect a payment</h3>
      <p className="card-sub">
        Generate a Razorpay Payment Link and send it on WhatsApp. Links collect the full invoice amount — the brand
        deducts TDS and deposits it against your PAN separately. UPI payments under ₹2,000 carry zero MDR.
      </p>
      <div className="row">
        <label className="field" style={{ marginBottom: 0 }}>
          <label>Unpaid deal</label>
          <select value={picked} onChange={(e) => { setPicked(e.target.value); setLink(null); }}>
            <option value="">— select —</option>
            {unpaid.map((d) => (
              <option key={d.id} value={d.id}>
                {d.brand} · {d.title} · {formatMoney(d.deal_value, d.currency)}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            className="btn primary"
            onClick={() => generate.mutate()}
            disabled={!selected || generate.isPending}
          >
            {generate.isPending ? 'Generating…' : 'Generate payment link'}
          </button>
        </div>
      </div>

      {link && (
        <div className={`notice ${link.configured ? 'ok' : ''}`} style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <code style={{ flex: 1, minWidth: 220, wordBreak: 'break-all' }}>{link.url}</code>
            <button className="btn sm" onClick={copy}>Copy</button>
          </div>
          {!link.configured && (
            <div style={{ marginTop: 9 }}>
              ⚠️ Placeholder link — add <code>RAZORPAY_KEY_ID</code> to <code>.env.local</code> and restart to generate
              real ones.
            </div>
          )}
        </div>
      )}
    </m.div>
  );
}
