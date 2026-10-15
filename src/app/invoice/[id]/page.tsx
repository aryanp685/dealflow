import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getDeal } from '@/lib/db';
import { computeDealMoney, formatDate, formatMoney } from '@/lib/money';
import PrintButton from './print-button';

export const metadata: Metadata = {
  title: 'Invoice',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export default async function InvoicePage({ params }: Params) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?reason=signin');
  const { id } = await params;
  const dealId = Number(id);
  if (!Number.isFinite(dealId)) notFound();
  const deal = await getDeal(user.id, dealId);
  if (!deal) notFound();

  const m = computeDealMoney(deal);
  const cur = deal.currency;
  const inr = cur === 'INR';
  const gst = inr && !!deal.gst_applicable;
  const half = Math.round((m.gst_amount / 2) * 100) / 100;
  const isDraft = !deal.invoice_number;
  const invNo = deal.invoice_number ?? `DRAFT-${deal.id}`;
  const invDate = deal.invoice_sent_on ?? new Date().toISOString().slice(0, 10);

  return (
    <main className="invoice-page">
      <div className="invoice-toolbar no-print">
        <Link className="btn sm" href="/app">← Back to deals</Link>
        <span className="invoice-toolbar-hint">Print this page or save it as a PDF to send to the brand.</span>
        <PrintButton />
      </div>

      <div className="invoice">
        <div className="inv-head">
          <div>
            <div className="inv-title">{gst ? 'TAX INVOICE' : 'BILL OF SUPPLY'}</div>
            <div className="inv-sub">{user.name} · {user.email}</div>
          </div>
          <div className="inv-meta">
            <div><span>Invoice no.</span><strong>{invNo}</strong></div>
            <div><span>Date</span><strong>{formatDate(invDate)}</strong></div>
            <div><span>Due</span><strong>{formatDate(deal.invoice_due_on)}</strong></div>
          </div>
        </div>

        {isDraft && (
          <div className="inv-draft">DRAFT — log this invoice from your deals table to stamp a final number.</div>
        )}

        <div className="inv-parties">
          <div>
            <div className="inv-label">Billed by</div>
            <div className="inv-party"><strong>{user.name}</strong><br />{user.email}</div>
          </div>
          <div>
            <div className="inv-label">Billed to</div>
            <div className="inv-party"><strong>{deal.brand}</strong>
              {deal.brand_contact ? <><br />{deal.brand_contact}</> : null}
              {deal.brand_email ? <><br />{deal.brand_email}</> : null}
            </div>
          </div>
        </div>

        <table className="inv-table">
          <thead>
            <tr><th style={{ width: 36 }}>#</th><th>Description</th><th style={{ width: 52 }}>Qty</th><th className="r" style={{ width: 130 }}>Rate</th><th className="r" style={{ width: 140 }}>Amount</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>{deal.title}<span className="inv-platform"> · {deal.platform}</span></td>
              <td>1</td>
              <td className="r">{formatMoney(m.gross, cur)}</td>
              <td className="r">{formatMoney(m.gross, cur)}</td>
            </tr>
          </tbody>
        </table>

        <div className="inv-totals">
          <div><span>Taxable value</span><span>{formatMoney(m.gross, cur)}</span></div>
          {gst && (
            <>
              <div><span>CGST @ 9%</span><span>{formatMoney(half, cur)}</span></div>
              <div><span>SGST @ 9%</span><span>{formatMoney(m.gst_amount - half, cur)}</span></div>
            </>
          )}
          <div className="inv-total"><span>Invoice total</span><span>{formatMoney(m.invoice_total, cur)}</span></div>
          {inr && m.tds_amount > 0 && (
            <div className="inv-tds"><span>Less: TDS @ {deal.tds_pct}% (deducted by brand)</span><span>− {formatMoney(m.tds_amount, cur)}</span></div>
          )}
          {inr && m.tds_amount > 0 && (
            <div className="inv-net"><span>Net receivable</span><span>{formatMoney(m.net_receivable, cur)}</span></div>
          )}
        </div>

        {deal.advance_pct > 0 && (
          <div className="inv-note">
            Advance agreed: {deal.advance_pct}% ({formatMoney(m.advance_due, cur)}) · Balance on delivery: {formatMoney(m.balance_due, cur)}
          </div>
        )}

        <div className="inv-pay">
          <div className="inv-label">Payment</div>
          {user.upi_id
            ? <div>Pay via UPI: <strong>{user.upi_id}</strong>{inr && m.tds_amount > 0 ? ` — ${formatMoney(m.net_receivable, cur)} after TDS` : ''}</div>
            : <div>Bank details shared separately.</div>}
          <div className="inv-terms">Due {formatDate(deal.invoice_due_on)}. Please quote {invNo} in payment remarks.</div>
        </div>

        <div className="inv-foot">Computer-generated invoice · Prepared with DealFlow</div>
      </div>
    </main>
  );
}
