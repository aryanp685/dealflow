import { NextResponse } from 'next/server';
import { UnauthorizedError, effectivePlan, requireUser } from '@/lib/auth';
import { listDeals } from '@/lib/db';
import { computeDealMoney, overdueDays } from '@/lib/money';
import { buildCaReport } from '@/lib/tax-report';
import { PLANS, type PlanKey } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const deals = await listDeals(user.id);
    const today = new Date();
    const { searchParams } = new URL(request.url);

    if (searchParams.get('format') === 'zoho') {
      const zohoHeader = [
        'Invoice Number', 'Invoice Date', 'Customer Name', 'Customer Email',
        'Item Description', 'Quantity', 'Rate', 'Tax Percentage', 'Total', 'Currency',
      ];
      const zohoRows = deals
        .filter((d) => d.invoice_number || d.invoice_sent_on || ['invoiced', 'overdue', 'paid'].includes(d.payment_status))
        .map((d) => {
          const m = computeDealMoney(d);
          return [
            d.invoice_number ?? '', d.invoice_sent_on ?? '', d.brand, d.brand_email ?? '',
            d.title, '1', m.gross.toFixed(2), d.gst_applicable ? '18' : '0',
            m.invoice_total.toFixed(2), d.currency,
          ];
        });
      const zohoCsv = [zohoHeader, ...zohoRows].map((r) => r.map(escapeCsv).join(',')).join('\r\n');
      const zohoStamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(`\uFEFF${zohoCsv}`, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="dealflow-invoices-zoho-${zohoStamp}.csv"`,
        },
      });
    }

    if (searchParams.get('format') === 'ca') {
      const plan = PLANS[effectivePlan(user) as PlanKey] ?? PLANS.free;
      if (plan.key !== 'pro') {
        return NextResponse.json(
          {
            error: 'CA-ready tax reports are a Pro feature. Upgrade from the Pricing tab to unlock them.',
            code: 'plan_limit',
          },
          { status: 402 }
        );
      }
      const fy = Number(searchParams.get('fy'));
      if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
        return NextResponse.json({ error: 'Pass a valid FY starting year, e.g. ?format=ca&fy=2025' }, { status: 400 });
      }
      const report = buildCaReport(deals, fy);
      const caHeader = [
        'Brand', 'Invoice no.', 'Invoice date', 'Paid on', 'Quarter', 'Currency',
        'Taxable', 'GST', 'Invoice total', 'TDS %', 'TDS amount', 'Net receivable',
      ];
      const caRows = report.rows.map((r) => [
        r.brand, r.invoice_number, r.invoice_date, r.paid_on ?? '', r.quarter, r.currency,
        r.taxable.toFixed(2), r.gst.toFixed(2), r.invoice_total.toFixed(2),
        String(r.tds_pct), r.tds.toFixed(2), r.net.toFixed(2),
      ]);
      const caCsv = [caHeader, ...caRows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
      return new NextResponse(`\uFEFF${caCsv}`, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="dealflow-ca-report-FY${fy}.csv"`,
        },
      });
    }

    const header = [
      'Brand', 'Contact', 'Email', 'Deal title', 'Platform', 'Stage', 'Payment status',
      'Agreed on', 'Deliver by', 'Delivered on',
      'Invoice no.', 'Invoice sent', 'Invoice due', 'Paid on', 'Days overdue',
      'Gross', 'Currency', 'GST 18%', 'Invoice total', 'TDS %', 'TDS amount', 'Net receivable',
      'Advance %', 'Advance due', 'Balance due', 'Notes',
    ];

    const rows = deals.map((d) => {
      const m = computeDealMoney(d);
      return [
        d.brand, d.brand_contact ?? '', d.brand_email ?? '', d.title, d.platform, d.status, d.payment_status,
        d.agreed_on ?? '', d.deliver_by ?? '', d.delivered_on ?? '',
        d.invoice_number ?? '', d.invoice_sent_on ?? '', d.invoice_due_on ?? '', d.paid_on ?? '',
        String(overdueDays(d.invoice_due_on, d.payment_status, today)),
        m.gross.toFixed(2), d.currency, m.gst_amount.toFixed(2), m.invoice_total.toFixed(2),
        String(d.tds_pct), m.tds_amount.toFixed(2), m.net_receivable.toFixed(2),
        String(d.advance_pct), m.advance_due.toFixed(2), m.balance_due.toFixed(2), d.notes ?? '',
      ];
    });

    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\r\n');
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="dealflow-${stamp}.csv"`,
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error('[export]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

function escapeCsv(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  const needsQuotes = /[",\r\n]/.test(safe);
  const escaped = safe.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}
