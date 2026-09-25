'use client';

import { useMemo, useState } from 'react';
import { computeDealMoney, formatMoney, TDS_SECTIONS } from '@/lib/money';

export default function TdsCalculatorTool() {
  const [amount, setAmount] = useState('');
  const [tdsPct, setTdsPct] = useState('10');
  const [gst, setGst] = useState(false);
  const [advance, setAdvance] = useState('');

  const gross = Number(amount) || 0;
  const m = useMemo(
    () =>
      computeDealMoney({
        deal_value: gross,
        advance_pct: Number(advance) || 0,
        tds_pct: Number(tdsPct) || 0,
        gst_applicable: gst,
      }),
    [gross, tdsPct, gst, advance]
  );

  const section = TDS_SECTIONS.find((t) => String(t.pct) === tdsPct);

  return (
    <div className="card">
      <div className="tool-grid">
        <label className="field">
          <label>Deal value / fee quoted (₹)</label>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" autoFocus />
          <div className="hint">The number you told the brand — before any tax.</div>
        </label>
        <label className="field">
          <label>TDS the brand will deduct</label>
          <select value={tdsPct} onChange={(e) => setTdsPct(e.target.value)}>
            {TDS_SECTIONS.map((t) => (
              <option key={t.pct} value={t.pct}>
                {t.pct}%{t.section !== '—' ? ` — ${t.section}` : ''} ({t.label})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <label>Advance % (optional)</label>
          <input type="number" min="0" max="100" value={advance} onChange={(e) => setAdvance(e.target.value)} placeholder="50" />
          <div className="hint">Split the net receivable into what you ask now vs on delivery.</div>
        </label>
        <label className="field" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 13 }}>
          <label className="check" style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={gst} onChange={(e) => setGst(e.target.checked)} />
            I&apos;m GST registered (add 18%)
          </label>
        </label>
      </div>

      {gross > 0 && (
        <div className="tool-out">
          <div className="money-preview">
            <div className="line"><span>Deal value (gross)</span><span>{formatMoney(m.gross)}</span></div>
            {m.gst_amount > 0 && <div className="line"><span>+ GST @ 18%</span><span>{formatMoney(m.gst_amount)}</span></div>}
            <div className="line"><span>= Invoice total</span><span>{formatMoney(m.invoice_total)}</span></div>
            {m.tds_amount > 0 && <div className="line"><span>− TDS @ {tdsPct}%{section && section.section !== '—' ? ` (u/s ${section.section})` : ''}</span><span>{formatMoney(m.tds_amount)}</span></div>}
            <div className="line total net"><span>Actually lands in your account</span><span>{formatMoney(m.net_receivable)}</span></div>
            {m.advance_due > 0 && <div className="line"><span>Ask now ({advance}% advance)</span><span>{formatMoney(m.advance_due)}</span></div>}
            {m.advance_due > 0 && <div className="line"><span>On delivery (balance)</span><span>{formatMoney(m.balance_due)}</span></div>}
          </div>
          <p className="card-sub" style={{ marginTop: 12 }}>
            TDS is charged on the gross fee, never on gross + GST. The brand must deposit it against your PAN and
            issue Form 16A — that&apos;s your proof at filing time, and it&apos;s credit you can claim back if your
            total tax is lower.
          </p>
        </div>
      )}
    </div>
  );
}
