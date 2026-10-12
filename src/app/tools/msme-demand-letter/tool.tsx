'use client';

import { useMemo, useState } from 'react';
import { formatMoney, formatDate, todayISO, calendarDaysBetween } from '@/lib/money';
import { msmeInterest, SAMADHAAN_URL, UDYAM_URL } from '@/lib/msme';

export default function MsmeDemandLetterTool() {
  const [f, setF] = useState({
    your_name: '', udyam: '', your_city: '',
    debtor: '', contact: '', invoice_number: '', invoice_date: '',
    amount: '', due_on: '',
  });
  const [copied, setCopied] = useState(false);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const principal = Number(f.amount) || 0;
  const daysLate = useMemo(() => {
    if (!f.due_on) return 0;
    const due = new Date(`${f.due_on}T12:00:00`);
    if (Number.isNaN(due.getTime())) return 0;
    return Math.max(0, calendarDaysBetween(due, new Date()));
  }, [f.due_on]);

  const si = msmeInterest(principal, daysLate);

  const letter = useMemo(() => {
    const today = formatDate(todayISO());
    return [
      `Date: ${today}`,
      `From: ${f.your_name || '[Your name]'} (Udyam: ${f.udyam || '[your number]'})${f.your_city ? `, ${f.your_city}` : ''}`,
      `To: ${f.debtor || '[Company name]'}${f.contact ? `, Attn: ${f.contact}` : ''}`,
      ``,
      `Subject: DEMAND FOR PAYMENT — Invoice ${f.invoice_number || '[number]'} under the MSMED Act, 2006`,
      ``,
      `Dear Sir/Madam,`,
      ``,
      `Invoice ${f.invoice_number || '[number]'}${f.invoice_date ? ` dated ${formatDate(f.invoice_date)}` : ''} for ${formatMoney(principal)} remains unpaid${f.due_on ? ` against its due date of ${formatDate(f.due_on)}` : ''}. It is now ${daysLate} day${daysLate === 1 ? '' : 's'} overdue.`,
      ``,
      `I am a supplier registered under the Micro, Small and Medium Enterprises Development Act, 2006. Payment was due within 45 days of acceptance of ${f.invoice_date ? 'the invoice' : 'goods/services'}. Under Section 15 of the Act, the buyer is liable to pay compound interest at three times the RBI bank rate (${si.rate_pct}% per annum, compounded monthly) on the outstanding amount from the due date.`,
      ``,
      `Outstanding principal: ${formatMoney(si.principal)}`,
      `Statutory interest to date (${daysLate} days): ${formatMoney(si.interest)}`,
      `Total payable: ${formatMoney(si.total_due)}`,
      ``,
      `Kindly release ${formatMoney(si.total_due)} within 7 days of this notice. Failing that, I will file the claim on the MSME Samadhaan portal (${SAMADHAAN_URL}) and pursue the dues, with interest, through the Micro and Small Enterprises Facilitation Council.`,
      ``,
      `This notice is issued without prejudice to my other rights and remedies.`,
      ``,
      `Regards,`,
      f.your_name || '[Your name]',
    ].join('\n');
  }, [f, principal, daysLate, si]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { }
  };

  const ready = f.your_name && f.debtor && principal > 0 && f.due_on;

  return (
    <div className="card">
      <div className="tool-grid">
        <label className="field">
          <label>Your name *</label>
          <input value={f.your_name} onChange={(e) => set('your_name', e.target.value)} placeholder="Priya Sharma" />
        </label>
        <label className="field">
          <label>Udyam number</label>
          <input value={f.udyam} onChange={(e) => set('udyam', e.target.value)} placeholder="UDYAM-MH-00-1234567" />
          <div className="hint">
            Not registered?{' '}
            <a href={UDYAM_URL} target="_blank" rel="noopener noreferrer">It&apos;s free and takes 10 minutes</a> — and
            it covers pending dues too.
          </div>
        </label>
        <label className="field">
          <label>Your city</label>
          <input value={f.your_city} onChange={(e) => set('your_city', e.target.value)} placeholder="Pune" />
        </label>
        <label className="field">
          <label>Company / brand name *</label>
          <input value={f.debtor} onChange={(e) => set('debtor', e.target.value)} placeholder="Acme Marketing Pvt Ltd" />
        </label>
        <label className="field">
          <label>Contact person</label>
          <input value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Finance head / founder" />
        </label>
        <label className="field">
          <label>Invoice number</label>
          <input value={f.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} placeholder="INV-014" />
        </label>
        <label className="field">
          <label>Invoice date</label>
          <input type="date" value={f.invoice_date} onChange={(e) => set('invoice_date', e.target.value)} />
        </label>
        <label className="field">
          <label>Amount due (₹) *</label>
          <input type="number" min="0" value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="45000" />
        </label>
        <label className="field">
          <label>Payment due date *</label>
          <input type="date" value={f.due_on} onChange={(e) => set('due_on', e.target.value)} />
          <div className="hint">Interest under Section 15 runs from this date.</div>
        </label>
      </div>

      {ready && (
        <div className="tool-out">
          <div className="money-preview" style={{ marginBottom: 14 }}>
            <div className="line"><span>Days overdue</span><span>{daysLate}</span></div>
            <div className="line"><span>Section 15 rate (3× RBI bank rate)</span><span>{si.rate_pct}% p.a. compound</span></div>
            <div className="line"><span>Interest accrued</span><span>{formatMoney(si.interest)}</span></div>
            <div className="line total net"><span>Total payable</span><span>{formatMoney(si.total_due)}</span></div>
          </div>
          <div className="letter">{letter}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={copy}>{copied ? 'Copied ✓' : 'Copy letter'}</button>
            <button className="btn" onClick={() => window.print()}>Print / save as PDF</button>
          </div>
        </div>
      )}

      {!ready && (
        <p className="card-sub" style={{ marginTop: 14 }}>
          Fill your name, the company, the amount and the due date — the letter with the interest calculation appears
          here instantly.
        </p>
      )}
    </div>
  );
}
