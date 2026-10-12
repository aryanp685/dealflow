import { NextResponse } from 'next/server';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { insertDeal, listDeals } from '@/lib/db';
import { shiftDaysISO, todayISO } from '@/lib/money';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await requireUser();

    if ((await listDeals(user.id)).length > 0) {
      return NextResponse.json(
        { error: 'Sample data is already loaded — this button works once per account.' },
        { status: 409 }
      );
    }

    const today = todayISO();
    const d = (offset: number) => shiftDaysISO(today, offset);

    const demo = [
      {
        brand: 'boAt Lifestyle', brand_contact: 'Priya Sharma', brand_email: 'priya@boat-lifestyle.com',
        title: '2 Reels + 1 Story', platform: 'instagram', status: 'invoiced', deal_value: 45000,
        currency: 'INR', advance_pct: 50, tds_pct: 10, gst_applicable: 1,
        agreed_on: d(-38), deliver_by: d(-20), delivered_on: d(-21),
        invoice_number: 'INV-004', invoice_sent_on: d(-20), invoice_due_on: d(-12),
        payment_status: 'overdue', notes: 'Usage rights 6 months. No exclusivity.',
      },
      {
        brand: 'Zomato', brand_contact: 'Arjun Mehta', brand_email: 'arjun.mehta@zomato.com',
        title: 'YouTube integration (60s)', platform: 'youtube', status: 'invoiced', deal_value: 80000,
        currency: 'INR', advance_pct: 50, tds_pct: 10, gst_applicable: 1,
        agreed_on: d(-25), deliver_by: d(-6), delivered_on: d(-6),
        invoice_number: 'INV-005', invoice_sent_on: d(-6), invoice_due_on: d(4),
        payment_status: 'invoiced', notes: 'Approved script v3. Must mention promo code.',
      },
      {
        brand: 'Notion India', brand_contact: 'Sara Khan', brand_email: '',
        title: '3 tweets + template collab', platform: 'twitter', status: 'delivering', deal_value: 18000,
        currency: 'INR', advance_pct: 50, tds_pct: 10, gst_applicable: 0,
        agreed_on: d(-9), deliver_by: d(2), payment_status: 'advance_paid',
        notes: 'Template link goes live with the thread.',
      },
      {
        brand: 'Gymshark', brand_contact: 'Tom Riley', brand_email: 'tom.riley@gymshark.com',
        title: 'IG Reel — festive collection', platform: 'instagram', status: 'negotiating', deal_value: 900,
        currency: 'USD', advance_pct: 0, tds_pct: 0, gst_applicable: 0,
        payment_status: 'not_invoiced', notes: 'Asked for 3 revisions included. Waiting on brief.',
      },
      {
        brand: 'CRED', brand_contact: 'Neha Iyer', brand_email: 'neha@cred.club',
        title: 'Reel + Story bundle', platform: 'instagram', status: 'paid', deal_value: 60000,
        currency: 'INR', advance_pct: 50, tds_pct: 10, gst_applicable: 1,
        agreed_on: d(-70), deliver_by: d(-52), delivered_on: d(-53),
        invoice_number: 'INV-003', invoice_sent_on: d(-52), invoice_due_on: d(-38), paid_on: d(-40),
        payment_status: 'paid', notes: 'Repeat client — 3rd deal.',
      },
      {
        brand: 'Mamaearth', brand_contact: 'Rohit Verma', brand_email: '',
        title: 'Flat lay + 1 Reel', platform: 'instagram', status: 'delivered', deal_value: 22000,
        currency: 'INR', advance_pct: 0, tds_pct: 10, gst_applicable: 0,
        agreed_on: d(-16), deliver_by: d(-3), delivered_on: d(-3),
        payment_status: 'not_invoiced', notes: 'Delivered but invoice not raised yet.',
      },
    ];

    for (const deal of demo) await insertDeal(user.id, deal);

    return NextResponse.json({ created: demo.length }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error('[seed]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
