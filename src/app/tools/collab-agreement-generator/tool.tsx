'use client';

import { useMemo, useState } from 'react';
import { computeDealMoney, formatDate, formatMoney, todayISO } from '@/lib/money';

const PLATFORMS = ['Instagram', 'YouTube', 'Instagram + YouTube', 'Other'];

export default function CollabAgreementTool() {
  const [f, setF] = useState({
    your_name: '', your_city: '',
    brand: '', contact: '',
    deliverables: '', platform: 'Instagram', live_on: '',
    fee: '', advance_pct: '50', due_days: '15', gst_extra: false,
    revisions: '2', paid_usage: '30', exclusivity: '0',
  });
  const [copied, setCopied] = useState(false);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const fee = Math.max(0, Number(f.fee) || 0);
  const advancePct = Math.min(100, Math.max(0, Number(f.advance_pct) || 0));
  const dueDays = Math.max(0, Math.round(Number(f.due_days) || 0));

  const m = useMemo(
    () =>
      computeDealMoney({
        deal_value: fee,
        advance_pct: advancePct,
        tds_pct: 0,
        gst_applicable: f.gst_extra ? 1 : 0,
      }),
    [fee, advancePct, f.gst_extra]
  );

  const dueDate = useMemo(() => {
    if (!f.live_on) return '';
    const d = new Date(`${f.live_on}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + dueDays);
    return formatDate(d);
  }, [f.live_on, dueDays]);

  const agreement = useMemo(() => {
    const today = formatDate(todayISO());
    const creator = `${f.your_name || '[Your name]'}${f.your_city ? `, ${f.your_city}` : ''}`;
    const brand = `${f.brand || '[Brand name]'}${f.contact ? ` (Attn: ${f.contact})` : ''}`;
    const liveBit = f.live_on ? `, going live on ${formatDate(f.live_on)}` : '';
    const payWhen =
      dueDays === 0
        ? 'on the day the content goes live'
        : `within ${dueDays} days of going live${dueDate ? ` (by ${dueDate})` : ''}`;
    const advanceBit =
      advancePct > 0
        ? `${advancePct}% advance (${formatMoney(m.advance_due)}) before work begins; balance ${formatMoney(m.balance_due)} ${payWhen}.`
        : `No advance — full fee ${payWhen}.`;
    return [
      `BRAND COLLABORATION AGREEMENT (SHORT FORM)`,
      ``,
      `Date: ${today}`,
      `Between: ${creator} ("Creator")`,
      `And: ${brand} ("Brand")`,
      ``,
      `1. Work. The Creator will create and publish the following: ${f.deliverables || '[e.g. 2 Reels + 3 Stories]'} on ${f.platform}${liveBit}.`,
      ``,
      `2. Fee & payment. Total fee ${formatMoney(m.invoice_total)}${f.gst_extra ? ' (includes 18% GST)' : ' (GST extra at 18% if the Creator is GST-registered)'}. ${advanceBit} The Brand will deduct TDS under section 194J as applicable and share Form 16A.`,
      ``,
      `3. Revisions. The fee includes ${f.revisions} round${f.revisions === '1' ? '' : 's'} of reasonable revisions. Work beyond that is billed separately by mutual agreement.`,
      ``,
      f.paid_usage === '0'
        ? `4. Usage rights. The Brand may repost the content on its own organic channels with credit to the Creator. No paid usage (ads, whitelisting, boosting) without a separate written fee. The Creator may keep the content on their own channels and in their portfolio.`
        : `4. Usage rights. The Brand may repost the content on its own organic channels with credit to the Creator. Paid usage (ads, whitelisting, boosting) is allowed for ${f.paid_usage} days from going live; any use beyond that needs a fresh fee. The Creator may keep the content on their own channels and in their portfolio.`,
      ``,
      f.exclusivity === '0'
        ? `5. Exclusivity. No exclusivity — the Creator may work with competing brands.`
        : `5. Exclusivity. The Creator will not promote directly competing brands for ${f.exclusivity} days from going live.`,
      ``,
      `6. Cancellation. If the Brand cancels after work begins,${advancePct > 0 ? ' the advance is non-refundable and' : ''} 50% of the fee is due for work done and dates blocked. If the Creator cancels, any advance is refunded in full within 7 days.`,
      ``,
      `7. Acceptance. This agreement is accepted when both parties reply "Agreed" (email or WhatsApp counts) or sign below. Disputes will first be discussed in good faith${f.your_city ? `; courts at ${f.your_city} have jurisdiction` : ''}.`,
      ``,
      `Agreed:`,
      `Creator: ${f.your_name || '[Your name]'} ............ Date ............`,
      `Brand: ${f.brand || '[Brand name]'}${f.contact ? ` (${f.contact})` : ''} ............ Date ............`,
    ].join('\n');
  }, [f, dueDays, dueDate, advancePct, m]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(agreement);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  const ready = Boolean(f.your_name.trim() && f.brand.trim() && f.deliverables.trim() && fee > 0);

  return (
    <div className="card">
      <div className="tool-grid">
        <label className="field">
          <label>Your name *</label>
          <input value={f.your_name} onChange={(e) => set('your_name', e.target.value)} placeholder="Priya Sharma" />
        </label>
        <label className="field">
          <label>Your city</label>
          <input value={f.your_city} onChange={(e) => set('your_city', e.target.value)} placeholder="Pune" />
          <div className="hint">Used for the jurisdiction line in clause 7.</div>
        </label>
        <label className="field">
          <label>Brand name *</label>
          <input value={f.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Acme Marketing Pvt Ltd" />
        </label>
        <label className="field">
          <label>Brand contact person</label>
          <input value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Priya, partnerships" />
        </label>
        <label className="field">
          <label>Deliverables *</label>
          <input value={f.deliverables} onChange={(e) => set('deliverables', e.target.value)} placeholder="2 Reels + 3 Stories" />
        </label>
        <label className="field">
          <label>Platform</label>
          <select value={f.platform} onChange={(e) => set('platform', e.target.value)}>
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="field">
          <label>Going-live / delivery date</label>
          <input type="date" value={f.live_on} onChange={(e) => set('live_on', e.target.value)} />
          <div className="hint">Payment clock and usage windows run from this date.</div>
        </label>
        <label className="field">
          <label>Total fee (₹) *</label>
          <input type="number" min="0" value={f.fee} onChange={(e) => set('fee', e.target.value)} placeholder="50000" />
        </label>
        <label className="field">
          <label>Advance %</label>
          <input type="number" min="0" max="100" value={f.advance_pct} onChange={(e) => set('advance_pct', e.target.value)} placeholder="50" />
          <div className="hint">50% before work begins is the creator-market standard.</div>
        </label>
        <label className="field">
          <label>Balance due within (days)</label>
          <input type="number" min="0" value={f.due_days} onChange={(e) => set('due_days', e.target.value)} placeholder="15" />
        </label>
        <label className="field">
          <label>Revisions included</label>
          <select value={f.revisions} onChange={(e) => set('revisions', e.target.value)}>
            <option value="1">1 round</option>
            <option value="2">2 rounds</option>
            <option value="3">3 rounds</option>
          </select>
        </label>
        <label className="field">
          <label>Paid usage / whitelisting</label>
          <select value={f.paid_usage} onChange={(e) => set('paid_usage', e.target.value)}>
            <option value="0">Not allowed</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
          <div className="hint">Never give this free — it is the most expensive right you own.</div>
        </label>
        <label className="field">
          <label>Category exclusivity</label>
          <select value={f.exclusivity} onChange={(e) => set('exclusivity', e.target.value)}>
            <option value="0">None</option>
            <option value="15">15 days</option>
            <option value="30">30 days</option>
            <option value="60">60 days</option>
          </select>
        </label>
        <label className="field" style={{ justifyContent: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={f.gst_extra}
              onChange={(e) => setF((p) => ({ ...p, gst_extra: e.target.checked }))}
              style={{ width: 'auto' }}
            />
            Fee includes 18% GST
          </label>
          <div className="hint">Tick only if you are GST-registered and charging GST on top.</div>
        </label>
      </div>

      {ready && (
        <div className="tool-out">
          <div className="money-preview" style={{ marginBottom: 14 }}>
            <div className="line"><span>Total fee{f.gst_extra ? ' (incl. GST)' : ''}</span><span>{formatMoney(m.invoice_total)}</span></div>
            {advancePct > 0 && <div className="line"><span>Advance ({advancePct}%)</span><span>{formatMoney(m.advance_due)}</span></div>}
            <div className="line"><span>Balance</span><span>{formatMoney(m.balance_due)}</span></div>
            {dueDate && <div className="line total net"><span>Balance due by</span><span>{dueDate}</span></div>}
          </div>
          <div className="letter">{agreement}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={copy}>{copied ? 'Copied ✓' : 'Copy agreement'}</button>
            <button className="btn" onClick={() => window.print()}>Print / save as PDF</button>
          </div>
        </div>
      )}

      {!ready && (
        <p className="card-sub" style={{ marginTop: 14 }}>
          Fill your name, the brand, the deliverables and the fee — the agreement appears here instantly.
        </p>
      )}
    </div>
  );
}
