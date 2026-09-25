import { NextResponse } from 'next/server';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { listDeals } from '@/lib/db';
import { buildReminders, reminderDigest } from '@/lib/reminders';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reminders        -> { reminders, digest, count, urgent }
 * GET /api/reminders?text=1 -> plain-text digest (pipe into WhatsApp/email)
 */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const deals = await listDeals(user.id);
    const reminders = buildReminders(deals);
    const digest = reminderDigest(reminders);

    const { searchParams } = new URL(request.url);
    if (searchParams.get('text') === '1') {
      return new NextResponse(digest, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    return NextResponse.json({
      reminders,
      digest,
      count: reminders.length,
      urgent: reminders.filter((r) => r.urgency === 3).length,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error('[reminders]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
