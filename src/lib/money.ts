
export const GST_RATE = 0.18;

export const TDS_SECTIONS = [
  { pct: 0, section: '—', label: 'No TDS' },
  { pct: 2, section: '194O', label: 'E-commerce operator' },
  { pct: 5, section: '194H', label: 'Commission / brokerage' },
  { pct: 10, section: '194J', label: 'Professional fees (most brand deals)' },
  { pct: 20, section: '206AA', label: 'No PAN on file' },
] as const;

export function tdsSectionFor(pct: number): string | null {
  const p = Math.round(num(pct));
  if (p <= 0) return null;
  const known: Record<number, string> = { 2: '194O', 5: '194H', 10: '194J', 20: '206AA' };
  return known[p] ?? null;
}

export type Currency = 'INR' | 'USD';

export interface MoneyInput {
  deal_value: number;
  advance_pct: number;
  tds_pct: number;
  gst_applicable: number | boolean;
}

export interface MoneyBreakdown {
  gross: number;
  gst_amount: number;
  invoice_total: number;
  tds_amount: number;
  net_receivable: number;
  advance_due: number;
  balance_due: number;
}

export function computeDealMoney(deal: MoneyInput): MoneyBreakdown {
  const gross = round2(Math.max(0, num(deal.deal_value)));
  const advancePct = clamp(num(deal.advance_pct), 0, 100);
  const tdsPct = clamp(num(deal.tds_pct), 0, 100);
  const gstOn = deal.gst_applicable === 1 || deal.gst_applicable === true;

  const gst_amount = gstOn ? round2(gross * GST_RATE) : 0;
  const invoice_total = round2(gross + gst_amount);
  const tds_amount = round2((gross * tdsPct) / 100);
  const net_receivable = round2(invoice_total - tds_amount);

  const advance_due = round2((net_receivable * advancePct) / 100);
  const balance_due = round2(net_receivable - advance_due);

  return { gross, gst_amount, invoice_total, tds_amount, net_receivable, advance_due, balance_due };
}

export function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  return Math.round((num(n) + Number.EPSILON) * 100) / 100;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}


const CURRENCY_SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

export function formatMoney(amount: number, currency: Currency | string = 'INR', opts: { compact?: boolean } = {}): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? '';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const value = num(amount);

  if (opts.compact && Math.abs(value) >= 1000) {
    return `${symbol}${new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
  }
  const hasPaise = Math.abs(value % 1) > 0.0001;
  return `${symbol}${new Intl.NumberFormat(locale, {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-IN').format(num(n));
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = iso instanceof Date ? iso : new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function formatRelative(iso: string | null | undefined, today = new Date()): string {
  const days = daysUntil(iso, today);
  if (days === null) return '—';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}


function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function calendarDaysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / 86_400_000);
}

function parseDateOnly(iso: string): Date | null {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function overdueDays(invoiceDueOn: string | null, paymentStatus: string, today = new Date()): number {
  if (!invoiceDueOn) return 0;
  if (paymentStatus === 'paid' || paymentStatus === 'cancelled') return 0;
  const due = parseDateOnly(invoiceDueOn);
  if (!due) return 0;
  const diff = calendarDaysBetween(due, today);
  return diff > 0 ? diff : 0;
}

export type AgeingBucket = 'current' | '1-15' | '16-30' | '31-60' | '60+';

export function ageingBucket(days: number): AgeingBucket {
  if (days <= 0) return 'current';
  if (days <= 15) return '1-15';
  if (days <= 30) return '16-30';
  if (days <= 60) return '31-60';
  return '60+';
}

export function daysUntil(dateStr: string | null | undefined, today = new Date()): number | null {
  if (!dateStr) return null;
  const d = parseDateOnly(dateStr);
  if (!d) return null;
  return calendarDaysBetween(today, d);
}

export function todayISO(today = new Date()): string {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shiftDaysISO(iso: string | Date, n: number): string {
  const base = typeof iso === 'string' ? parseDateOnly(iso) ?? new Date() : new Date(iso);
  const out = new Date(base);
  out.setDate(out.getDate() + n);
  return todayISO(out);
}


export const USD_INR = 85;

export function toPaise(n: number): number {
  return Math.round(num(n) * 100);
}

export function toINR(amount: number, currency: string): number {
  return currency === 'INR' ? amount : round2(amount * USD_INR);
}
