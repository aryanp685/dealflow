'use client';

import { useMemo, useState } from 'react';
import { formatMoney, formatDate, todayISO } from '@/lib/money';

const GST_RATES = [0, 5, 12, 18, 28];

export default function GstInvoiceTool() {
  const [f, setF] = useState({
    your_name: '', your_gstin: '', your_city: '',
    client: '', client_gstin: '',
    invoice_number: '', date: todayISO(), description: '', amount: '', gst_rate: '18',
  });
  const [copied, setCopied] = useState(false);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const taxable = Math.max(0, Number(f.amount) || 0);
  const rate = Number(f.gst_rate) || 0;
  const gst = Math.round(taxable * rate) / 100;
  const half = Math.round((gst / 2) * 100) / 100;
  const total = Math.round((taxable + gst) * 100) / 100;

  const invoiceText = useMemo(
    () =>
      [
        `TAX INVOICE`,
        `${f.your_name || '[Your business name]'}${f.your_gstin ? ` · GSTIN: ${f.your_gstin}` : ''}${f.your_city ? ` · ${f.your_city}` : ''}`,
        ``,
        `Invoice: ${f.invoice_number || '[INV-001]'}    Date: ${f.date ? formatDate(f.date) : ''}`,
        `Billed to: ${f.client || '[Client name]'}${f.client_gstin ? ` · GSTIN: ${f.client_gstin}` : ''}`,
        ``,
        `${f.description || '[Service description]'}`,
        ``,
        `Taxable value        ${formatMoney(taxable)}`,
        rate > 0 ? `CGST @ ${rate / 2}%${' '.repeat(Math.max(0, 10 - String(rate / 2).length))} ${formatMoney(half)}` : '',
        rate > 0 ? `SGST @ ${rate / 2}%${' '.repeat(Math.max(0, 10 - String(rate / 2).length))} ${formatMoney(half)}` : '',
        `----------------------------------------`,
        `Total payable        ${formatMoney(total)}`,
        ``,
        `Payment terms: 15 days. Bank details as shared separately.`,
      ].filter(Boolean).join('\n'),
    [f, taxable, gst, half, total, rate]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invoiceText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — text is on screen */ }
  };

  return (
    <div className="card">
      <div className="tool-grid">
        <label className="field"><label>Your business name</label>
          <input value={f.your_name} onChange={(e) => set('your_name', e.target.value)} placeholder="Priya Sharma (Sole Proprietor)" /></label>
        <label className="field"><label>Your GSTIN</label>
          <input value={f.your_gstin} onChange={(e) => set('your_gstin', e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" />
          <div className="hint">Not registered? Leave blank — an unregistered invoice is still a valid bill of supply.</div></label>
        <label className="field"><label>Your city</label>
          <input value={f.your_city} onChange={(e) => set('your_city', e.target.value)} placeholder="Pune" /></label>
        <label className="field"><label>Client / brand name</label>
          <input value={f.client} onChange={(e) => set('client', e.target.value)} placeholder="Acme Marketing Pvt Ltd" /></label>
        <label className="field"><label>Client GSTIN (if B2B)</label>
          <input value={f.client_gstin} onChange={(e) => set('client_gstin', e.target.value.toUpperCase())} placeholder="optional" /></label>
        <label className="field"><label>Invoice number</label>
          <input value={f.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} placeholder="INV-001" /></label>
        <label className="field"><label>Invoice date</label>
          <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
        <label className="field"><label>Description</label>
          <input value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="2 Reels + 1 Story — brand campaign" /></label>
        <label className="field"><label>Taxable amount (₹)</label>
          <input type="number" min="0" value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="50000" /></label>
        <label className="field"><label>GST rate</label>
          <select value={f.gst_rate} onChange={(e) => set('gst_rate', e.target.value)}>
            {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
          </select>
          <div className="hint">Creator services usually fall at 18%.</div></label>
      </div>

      {taxable > 0 && (
        <div className="tool-out">
          <div className="money-preview" style={{ marginBottom: 14 }}>
            <div className="line"><span>Taxable value</span><span>{formatMoney(taxable)}</span></div>
            {rate > 0 && <div className="line"><span>CGST @ {rate / 2}%</span><span>{formatMoney(half)}</span></div>}
            {rate > 0 && <div className="line"><span>SGST @ {rate / 2}%</span><span>{formatMoney(half)}</span></div>}
            <div className="line total net"><span>Total payable</span><span>{formatMoney(total)}</span></div>
          </div>
          <div className="letter">{invoiceText}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={copy}>{copied ? 'Copied ✓' : 'Copy invoice'}</button>
            <button className="btn" onClick={() => window.print()}>Print / save as PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}
