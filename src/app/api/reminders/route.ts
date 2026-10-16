import { NextResponse } from 'next/server';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { listAutoSends, listDeals } from '@/lib/db';
import { autoSendKey, buildReminders, reminderDigest } from '@/lib/reminders';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const deals = await listDeals(user.id);
    const reminders = buildReminders(deals, new Date(), { upiId: user.upi_id ?? undefined, payeeName: user.name });
    const sentRows = await listAutoSends(user.id);
    const sentOn = new Map(sentRows.map((row) => [autoSendKey(row.deal_id, row.kind), row.sent_on]));
    const withState = reminders.map((r) => ({
      ...r,
      auto_sent_on: sentOn.get(autoSendKey(r.deal_id, r.kind)) ?? null,
    }));
    const digest = reminderDigest(reminders);

    const { searchParams } = new URL(request.url);
    if (searchParams.get('text') === '1') {
      return new NextResponse(digest, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    return NextResponse.json({
      reminders: withState,
      digest,
      count: reminders.length,
      urgent: withState.filter((r) => r.urgency === 3).length,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error('[reminders]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
