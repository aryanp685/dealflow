'use client';

import { useMemo, useState } from 'react';
import { m } from 'motion/react';
import { listItem } from './ui';
import { formatDate, formatMoney } from '@/lib/money';
import { buildCaReport, currentFy } from '@/lib/tax-report';
import type { Deal } from '@/lib/db';

export function fyLabel(fy: number): string {
  return `FY ${fy}–${String(fy + 1).slice(2)}`;
}

export default function TaxReport({
  deals,
  planKey,
  onUpgrade,
}: {
  deals: Deal[];
  planKey: string;
  onUpgrade: () => void;
}) {
  const fyNow = currentFy();
  const [fy, setFy] = useState(fyNow);
  const report = useMemo(() => buildCaReport(deals, fy), [deals, fy]);

  if (planKey !== 'pro') {
    return (
      <m.div className="card" variants={listItem} style={{ borderColor: 'rgba(124,92,255,.35)' }}>
        <h3 className="card-title">📑 CA-ready tax reports — Pro</h3>
        <p className="card-sub">
          Every invoice you log, bucketed into financial-year quarters with taxable value, GST, TDS and net
          receivable — plus a one-click CSV your CA can open directly. Accrual basis (invoice date), USD blended
          at ₹85/$. Available on Pro and Lifetime plans.
        </p>
        <button className="btn primary" onClick={onUpgrade}>See Pro plans</button>
      </m.div>
    );
  }

  const fys = [fyNow, fyNow - 1, fyNow - 2];
  const totals = report.summary.reduce(
    (a, s) => ({ invoices: a.invoices + s.invoices, taxable: a.taxable + s.taxable, gst: a.gst + s.gst, tds: a.tds + s.tds, net: a.net + s.net }),
    { invoices: 0, taxable: 0, gst: 0, tds: 0, net: 0 }
  );

  return (
    <m.div className="card" variants={listItem}>
      <h3 className="card-title">📑 Tax report — {fyLabel(fy)}</h3>
      <p className="card-sub">
        Accrual basis (invoice date). Cancelled deals and deals not invoiced yet (
        {report.excluded}) are excluded from the quarters below.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <label className="field" style={{ maxWidth: 200, marginBottom: 0 }}>
          <label>Financial year</label>
          <select value={fy} onChange={(e) => setFy(Number(e.target.value))}>
            {fys.map((y) => <option key={y} value={y}>{fyLabel(y)}</option>)}
          </select>
        </label>
        {report.rows.length > 0 && (
          <a className="btn primary" href={`/api/export?format=ca&fy=${fy}`}>Download CSV for CA</a>
        )}
      </div>

      {report.rows.length === 0 ? (
        <p className="card-sub">No invoiced deals in this financial year yet.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Quarter</th><th>Invoices</th><th className="t-right">Taxable</th><th className="t-right">GST</th><th className="t-right">TDS</th><th className="t-right">Net</th></tr>
              </thead>
              <tbody>
                {report.summary.map((s) => (
                  <tr key={s.quarter}>
                    <td>{s.quarter}</td>
                    <td>{s.invoices}</td>
                    <td className="t-right t-money">{formatMoney(s.taxable)}</td>
                    <td className="t-right t-money">{formatMoney(s.gst)}</td>
                    <td className="t-right t-money">{formatMoney(s.tds)}</td>
                    <td className="t-right t-money green">{formatMoney(s.net)}</td>
                  </tr>
                ))}
                <tr>
                  <td><strong>Total</strong></td>
                  <td><strong>{totals.invoices}</strong></td>
                  <td className="t-right t-money"><strong>{formatMoney(totals.taxable)}</strong></td>
                  <td className="t-right t-money"><strong>{formatMoney(totals.gst)}</strong></td>
                  <td className="t-right t-money"><strong>{formatMoney(totals.tds)}</strong></td>
                  <td className="t-right t-money green"><strong>{formatMoney(totals.net)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table>
              <thead>
                <tr><th>Brand</th><th>Invoice</th><th>Date</th><th>Qtr</th><th className="t-right">Taxable</th><th className="t-right">GST</th><th className="t-right">TDS</th><th className="t-right">Net</th></tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.deal_id}>
                    <td>{r.brand}</td>
                    <td>{r.invoice_number || '—'}</td>
                    <td>{formatDate(r.invoice_date)}</td>
                    <td>{r.quarter}</td>
                    <td className="t-right t-money">{formatMoney(r.taxable, r.currency)}</td>
                    <td className="t-right t-money">{formatMoney(r.gst, r.currency)}</td>
                    <td className="t-right t-money">{formatMoney(r.tds, r.currency)}</td>
                    <td className="t-right t-money green">{formatMoney(r.net, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </m.div>
  );
}
