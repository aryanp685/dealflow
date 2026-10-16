import type { Deal } from './db';
import { computeDealMoney, toINR } from './money';

export type CaQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

/** FY starting year for an invoice date: Apr 2025–Mar 2026 ⇒ 2025. */
export function fyOf(iso: string): number | null {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const m = d.getMonth() + 1;
  return m >= 4 ? d.getFullYear() : d.getFullYear() - 1;
}

/** FY quarter for an invoice date: Q1 = Apr–Jun … Q4 = Jan–Mar. */
export function quarterOf(iso: string): CaQuarter | null {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const m = d.getMonth() + 1;
  if (m >= 4 && m <= 6) return 'Q1';
  if (m >= 7 && m <= 9) return 'Q2';
  if (m >= 10) return 'Q3';
  return 'Q4';
}

export function currentFy(today = new Date()): number {
  const m = today.getMonth() + 1;
  return m >= 4 ? today.getFullYear() : today.getFullYear() - 1;
}

export type CaRow = {
  deal_id: number;
  brand: string;
  invoice_number: string;
  invoice_date: string;
  paid_on: string | null;
  quarter: CaQuarter;
  currency: string;
  taxable: number;
  gst: number;
  invoice_total: number;
  tds_pct: number;
  tds: number;
  net: number;
  taxable_inr: number;
  gst_inr: number;
  tds_inr: number;
  net_inr: number;
};

export type CaSummary = {
  quarter: CaQuarter;
  invoices: number;
  taxable: number;
  gst: number;
  tds: number;
  net: number;
};

/**
 * Accrual-basis CA report: deals bucketed by invoice-sent date into FY
 * quarters. Cancelled deals and deals with no invoice date are excluded
 * (counted, not silently dropped). Summary totals are blended to INR.
 */
export function buildCaReport(
  deals: Deal[],
  fy: number
): { rows: CaRow[]; summary: CaSummary[]; excluded: number } {
  const rows: CaRow[] = [];
  let excluded = 0;
  for (const d of deals) {
    if (d.payment_status === 'cancelled' || d.status === 'cancelled') {
      excluded += 1;
      continue;
    }
    if (!d.invoice_sent_on) {
      excluded += 1;
      continue;
    }
    if (fyOf(d.invoice_sent_on) !== fy) continue;
    const q = quarterOf(d.invoice_sent_on);
    if (!q) {
      excluded += 1;
      continue;
    }
    const m = computeDealMoney(d);
    rows.push({
      deal_id: d.id,
      brand: d.brand,
      invoice_number: d.invoice_number ?? '',
      invoice_date: d.invoice_sent_on,
      paid_on: d.paid_on,
      quarter: q,
      currency: d.currency,
      taxable: m.gross,
      gst: m.gst_amount,
      invoice_total: m.invoice_total,
      tds_pct: d.tds_pct,
      tds: m.tds_amount,
      net: m.net_receivable,
      taxable_inr: toINR(m.gross, d.currency),
      gst_inr: toINR(m.gst_amount, d.currency),
      tds_inr: toINR(m.tds_amount, d.currency),
      net_inr: toINR(m.net_receivable, d.currency),
    });
  }
  rows.sort((a, b) => a.invoice_date.localeCompare(b.invoice_date));

  const summary: CaSummary[] = (['Q1', 'Q2', 'Q3', 'Q4'] as CaQuarter[]).map((quarter) => {
    const qr = rows.filter((r) => r.quarter === quarter);
    const sum = (pick: (r: CaRow) => number) => qr.reduce((a, r) => a + pick(r), 0);
    return {
      quarter,
      invoices: qr.length,
      taxable: sum((r) => r.taxable_inr),
      gst: sum((r) => r.gst_inr),
      tds: sum((r) => r.tds_inr),
      net: sum((r) => r.net_inr),
    };
  });

  return { rows, summary, excluded };
}
