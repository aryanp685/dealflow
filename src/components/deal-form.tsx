'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Modal, Pill } from './ui';
import { computeDealMoney, formatMoney, shiftDaysISO, TDS_SECTIONS } from '@/lib/money';
import { DEAL_STATUSES, PAYMENT_STATUSES, PLATFORMS, type DealStatus, type PaymentStatus } from '@/lib/schemas';
import type { Deal } from '@/lib/db';

const STATUS_LABEL: Record<DealStatus, string> = {
  negotiating: 'Negotiating', agreed: 'Agreed', delivering: 'Delivering',
  delivered: 'Delivered', invoiced: 'Invoiced', paid: 'Paid', cancelled: 'Cancelled',
};
const PAY_LABEL: Record<PaymentStatus, string> = {
  not_invoiced: 'Not invoiced', advance_paid: 'Advance paid', invoiced: 'Invoiced',
  overdue: 'Overdue', paid: 'Paid', cancelled: 'Cancelled',
};

const BLANK = {
  brand: '', brand_contact: '', brand_email: '', brand_whatsapp: '',
  title: '', platform: 'instagram', status: 'negotiating' as DealStatus,
  deal_value: '', currency: 'INR', advance_pct: '',
  agreed_on: '', deliver_by: '', delivered_on: '',
  invoice_number: '', invoice_sent_on: '', invoice_due_on: '', paid_on: '',
  payment_status: 'not_invoiced' as PaymentStatus, gst_applicable: false, tds_pct: '10',
  payment_terms_days: '15', escalation_contact: '', notes: '',
};

function fromDeal(d: Deal) {
  return {
    ...BLANK,
    brand: d.brand, brand_contact: d.brand_contact ?? '', brand_email: d.brand_email ?? '',
    brand_whatsapp: d.brand_whatsapp ?? '', title: d.title, platform: d.platform, status: d.status,
    deal_value: String(d.deal_value), currency: d.currency, advance_pct: String(d.advance_pct),
    agreed_on: d.agreed_on ?? '', deliver_by: d.deliver_by ?? '', delivered_on: d.delivered_on ?? '',
    invoice_number: d.invoice_number ?? '', invoice_sent_on: d.invoice_sent_on ?? '',
    invoice_due_on: d.invoice_due_on ?? '', paid_on: d.paid_on ?? '',
    payment_status: d.payment_status, gst_applicable: d.gst_applicable === 1,
    tds_pct: String(d.tds_pct),
    payment_terms_days: String(d.payment_terms_days ?? 15), escalation_contact: d.escalation_contact ?? '',
    notes: d.notes ?? '',
  };
}

function brandHistory(deals: Deal[], brand: string) {
  const name = brand.trim().toLowerCase();
  if (!name) return null;
  const past = deals.filter((d) => d.brand.toLowerCase() === name);
  if (past.length === 0) return null;
  const paid = past
    .filter((d) => d.payment_status === 'paid' && d.invoice_sent_on && d.paid_on)
    .map((d) => ({
      days: Math.round(
        (Date.parse(`${d.paid_on}T12:00:00`) - Date.parse(`${d.invoice_sent_on}T12:00:00`)) / 86_400_000
      ),
      paidOn: Date.parse(`${d.paid_on}T12:00:00`),
    }))
    .filter((p) => p.days >= 0 && !Number.isNaN(p.paidOn));
  const wasOverdue = past.some((d) => {
    if (d.payment_status !== 'paid' || !d.invoice_due_on || !d.paid_on) return false;
    return Date.parse(`${d.paid_on}T12:00:00`) > Date.parse(`${d.invoice_due_on}T12:00:00`);
  });
  if (paid.length === 0 && !wasOverdue) return null;
  const sixMonthsAgo = Date.now() - 180 * 86_400_000;
  const recent = paid.filter((p) => p.paidOn > sixMonthsAgo);
  const avgOf = (xs: { days: number }[]) =>
    xs.length ? Math.round(xs.reduce((a, b) => a + b.days, 0) / xs.length) : null;
  return { deals: past.length, avg: avgOf(recent) ?? avgOf(paid), wasOverdue };
}

export default function DealForm({
  open,
  deal,
  onClose,
  onDone,
}: {
  open: boolean;
  deal: Deal | null;
  onClose: () => void;
  onDone: (msg: string, tone?: 'ok' | 'err') => void;
}) {
  const [f, setF] = useState(() => (deal ? fromDeal(deal) : BLANK));
  const [touched, setTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setF(deal ? fromDeal(deal) : BLANK);
      setTouched(false);
      setFieldErrors({});
    }
  }, [open, deal]);
  const dealsQuery = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const res = await fetch('/api/deals');
      if (!res.ok) throw new Error('Failed to load deals');
      return res.json() as Promise<{ deals: Deal[] }>;
    },
    enabled: open,
  });
  const history = useMemo(
    () => brandHistory(dealsQuery.data?.deals ?? [], f.brand),
    [dealsQuery.data, f.brand]
  );

  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const money = useMemo(
    () =>
      computeDealMoney({
        deal_value: Number(f.deal_value) || 0,
        advance_pct: Number(f.advance_pct) || 0,
        tds_pct: Number(f.tds_pct) || 0,
        gst_applicable: f.gst_applicable,
      }),
    [f.deal_value, f.advance_pct, f.tds_pct, f.gst_applicable]
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...f,
        deal_value: Number(f.deal_value) || 0,
        advance_pct: Number(f.advance_pct) || 0,
        tds_pct: Number(f.tds_pct) || 0,
        agreed_on: f.agreed_on || null, deliver_by: f.deliver_by || null, delivered_on: f.delivered_on || null,
        invoice_sent_on: f.invoice_sent_on || null, invoice_due_on: f.invoice_due_on || null, paid_on: f.paid_on || null,
        brand_contact: f.brand_contact || null, brand_email: f.brand_email || null,
        brand_whatsapp: f.brand_whatsapp || null, invoice_number: f.invoice_number || null,
        payment_terms_days: Number(f.payment_terms_days) || 15,
        escalation_contact: f.escalation_contact || null, notes: f.notes || null,
      };
      const res = deal
        ? await fetch(`/api/deals/${deal.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/deals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      return json;
    },
    onSuccess: () => onDone(deal ? 'Deal updated' : 'Deal logged ✅'),
    onError: (e: Error) => onDone(e.message, 'err'),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const errors: Record<string, string> = {};
    if (!f.brand.trim()) errors.brand = 'Brand is required';
    if (!f.title.trim()) errors.title = 'Deal title is required';
    if (f.brand_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.brand_email)) {
      errors.brand_email = 'Please enter a valid email address';
    }
    if (f.deal_value && Number(f.deal_value) < 0) errors.deal_value = 'Deal value cannot be negative';
    if (f.advance_pct && (Number(f.advance_pct) < 0 || Number(f.advance_pct) > 100)) {
      errors.advance_pct = 'Advance percentage must be between 0 and 100';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      onDone('Please fix the errors above', 'err');
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={deal ? `Edit — ${deal.brand}` : 'Log a brand deal'}
      footer={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="deal-form" className="btn primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : deal ? 'Save changes' : 'Log deal'}
          </button>
        </>
      }
    >
      <form id="deal-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="form-section">The deal</div>

          <label className="field">
            <label>Brand *</label>
            <input
              value={f.brand}
              onChange={(e) => set('brand', e.target.value)}
              placeholder="boAt Lifestyle"
              autoFocus
              aria-invalid={touched && !!fieldErrors.brand}
              style={touched && fieldErrors.brand ? { borderColor: 'var(--red)' } : undefined}
            />
            {touched && fieldErrors.brand && <div className="hint err">{fieldErrors.brand}</div>}
            {history && (
              <div className={`hint ${history.wasOverdue || (history.avg ?? 0) > 45 ? 'err' : ''}`}>
                {history.wasOverdue ? '⚠️ ' : ''}
                {history.deals} past deal{history.deals === 1 ? '' : 's'} with this brand
                {history.avg !== null && ` — paid in ~${history.avg} days on average`}
                {history.wasOverdue && ' (went overdue before)'}
                {(history.wasOverdue || (history.avg ?? 0) > 45) && ' — ask for 50% advance'}
              </div>
            )}
          </label>
          <label className="field">
            <label>Deal title *</label>
            <input
              value={f.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="2 Reels + 1 Story"
              aria-invalid={touched && !!fieldErrors.title}
              style={touched && fieldErrors.title ? { borderColor: 'var(--red)' } : undefined}
            />
            {touched && fieldErrors.title && <div className="hint err">{fieldErrors.title}</div>}
          </label>
          <label className="field">
            <label>Platform</label>
            <select value={f.platform} onChange={(e) => set('platform', e.target.value)}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
            </select>
          </label>
          <label className="field">
            <label>Stage</label>
            <select value={f.status} onChange={(e) => set('status', e.target.value)}>
              {DEAL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>

          <div className="form-section">Money</div>

          <label className="field">
            <label>Deal value (before tax)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={f.deal_value}
              onChange={(e) => set('deal_value', e.target.value)}
              placeholder="25000"
              aria-invalid={touched && !!fieldErrors.deal_value}
              style={touched && fieldErrors.deal_value ? { borderColor: 'var(--red)' } : undefined}
            />
            {touched && fieldErrors.deal_value && <div className="hint err">{fieldErrors.deal_value}</div>}
          </label>
          <label className="field">
            <label>Currency</label>
            <select value={f.currency} onChange={(e) => set('currency', e.target.value)}>
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
            </select>
          </label>
          <label className="field">
            <label>Advance %</label>
            <input
              type="number"
              min="0"
              max="100"
              value={f.advance_pct}
              onChange={(e) => set('advance_pct', e.target.value)}
              placeholder="50"
              aria-invalid={touched && !!fieldErrors.advance_pct}
              style={touched && fieldErrors.advance_pct ? { borderColor: 'var(--red)' } : undefined}
            />
            {touched && fieldErrors.advance_pct && <div className="hint err">{fieldErrors.advance_pct}</div>}
            <div className="hint">Ask for 50% upfront on every new brand.</div>
          </label>
          <label className="field">
            <label>TDS %</label>
            <select value={f.tds_pct} onChange={(e) => set('tds_pct', e.target.value)}>
              {TDS_SECTIONS.map((t) => (
                <option key={t.pct} value={t.pct}>
                  {t.pct}% {t.section !== '—' ? `— ${t.section}` : ''} ({t.label})
                </option>
              ))}
            </select>
          </label>

          <label className="check" style={{ gridColumn: '1 / -1' }}>
            <input type="checkbox" checked={f.gst_applicable} onChange={(e) => set('gst_applicable', e.target.checked)} />
            I&apos;m GST registered (adds 18% to the invoice)
          </label>

          <div style={{ gridColumn: '1 / -1' }}>
            <div className="money-preview">
              <div className="line"><span>Deal value</span><span>{formatMoney(money.gross, f.currency)}</span></div>
              {money.gst_amount > 0 && (
                <div className="line"><span>+ GST @ 18%</span><span>{formatMoney(money.gst_amount, f.currency)}</span></div>
              )}
              <div className="line"><span>= Invoice total</span><span>{formatMoney(money.invoice_total, f.currency)}</span></div>
              {money.tds_amount > 0 && (
                <div className="line"><span>− TDS @ {f.tds_pct || 0}%</span><span>{formatMoney(money.tds_amount, f.currency)}</span></div>
              )}
              <div className="line total net">
                <span>You actually receive</span>
                <span>{formatMoney(money.net_receivable, f.currency)}</span>
              </div>
              {money.advance_due > 0 && (
                <div className="line">
                  <span>Ask now ({f.advance_pct || 0}% advance)</span>
                  <span>{formatMoney(money.advance_due, f.currency)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="form-section">Dates</div>

          <label className="field"><label>Agreed on</label>
            <input type="date" value={f.agreed_on} onChange={(e) => set('agreed_on', e.target.value)} /></label>
          <label className="field"><label>Deliver by</label>
            <input type="date" value={f.deliver_by} onChange={(e) => set('deliver_by', e.target.value)} /></label>
          <label className="field"><label>Delivered on</label>
            <input type="date" value={f.delivered_on} onChange={(e) => set('delivered_on', e.target.value)} /></label>
          <label className="field"><label>Payment terms (days)</label>
            <input type="number" min="0" max="365" value={f.payment_terms_days} onChange={(e) => set('payment_terms_days', e.target.value)} />
            <div className="hint">Stated on the invoice and quoted in every follow-up. 15 is standard; slow payers get 7.</div></label>
          <label className="field"><label>Invoice due on</label>
            <input type="date" value={f.invoice_due_on} onChange={(e) => set('invoice_due_on', e.target.value)} />
            <div className="hint">Fills itself from the sent date + your terms.</div></label>

          <div className="form-section">Invoice &amp; payment</div>

          <label className="field"><label>Invoice number</label>
            <input value={f.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} placeholder="INV-007" /></label>
          <label className="field"><label>Invoice sent on</label>
            <input type="date" value={f.invoice_sent_on} onChange={(e) => {
              const sent = e.target.value;
              setF((p) => ({
                ...p,
                invoice_sent_on: sent,
                invoice_due_on: sent && !p.invoice_due_on
                  ? shiftDaysISO(sent, Number(p.payment_terms_days) || 15)
                  : p.invoice_due_on,
              }));
            }} /></label>
          <label className="field"><label>Payment status</label>
            <select value={f.payment_status} onChange={(e) => set('payment_status', e.target.value)}>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAY_LABEL[s]}</option>)}
            </select></label>
          <label className="field"><label>Paid on</label>
            <input type="date" value={f.paid_on} onChange={(e) => set('paid_on', e.target.value)} /></label>

          <div className="form-section">Brand contact</div>

          <label className="field"><label>Contact person</label>
            <input value={f.brand_contact} onChange={(e) => set('brand_contact', e.target.value)} placeholder="Priya (Marketing)" /></label>
          <label className="field">
            <label>Email</label>
            <input
              type="email"
              value={f.brand_email}
              onChange={(e) => set('brand_email', e.target.value)}
              placeholder="priya@brand.com"
              aria-invalid={touched && !!fieldErrors.brand_email}
              style={touched && fieldErrors.brand_email ? { borderColor: 'var(--red)' } : undefined}
            />
            {touched && fieldErrors.brand_email && <div className="hint err">{fieldErrors.brand_email}</div>}
          </label>
          <label className="field"><label>WhatsApp</label>
            <input value={f.brand_whatsapp} onChange={(e) => set('brand_whatsapp', e.target.value)} placeholder="+91 98xxxxxxxx" /></label>
          <label className="field"><label>Escalation contact</label>
            <input value={f.escalation_contact} onChange={(e) => set('escalation_contact', e.target.value)} placeholder="Finance head / founder name" />
            <div className="hint">The person who can actually release payment — gets cc'd on the demand notice.</div></label>
          <label className="field"><label>Notes</label>
            <input value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Usage rights 6 months, no exclusivity" /></label>
        </div>

        {mutation.isError && (
          <div className="notice" style={{ marginTop: 16 }}>
            {(mutation.error as Error).message}
          </div>
        )}

        {!deal && (
          <div className="form-tip">
            <Pill tone="purple">Tip</Pill>
            <span>Set <strong>Deliver by</strong> and <strong>Invoice due on</strong> — that&apos;s what powers the follow-up reminders.</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
