import { NextResponse } from 'next/server';
import { listAutoFollowupUsers, listAutoSends, listDeals, logAutoSend } from '@/lib/db';
import { autoSendKey, buildReminders, selectAutoFollowups } from '@/lib/reminders';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAILY_CAP = 80;
const PER_USER_CAP = 10;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization');
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const users = await listAutoFollowupUsers();
  const today = new Date();
  const sentOn = today.toISOString().slice(0, 10);

  let sent = 0;
  let skipped = 0;
  const failures: number[] = [];

  for (const user of users) {
    if (sent >= DAILY_CAP) break;
    const deals = await listDeals(user.id);
    const byId = new Map(deals.map((d) => [d.id, d]));
    const sentRows = await listAutoSends(user.id);
    const sentKeys = new Set(sentRows.map((s) => autoSendKey(s.deal_id, s.kind)));
    const reminders = buildReminders(deals, today, { upiId: user.upi_id ?? undefined, payeeName: user.name });
    const targets = selectAutoFollowups(reminders, sentKeys);

    let userSent = 0;
    for (const r of targets) {
      if (sent >= DAILY_CAP || userSent >= PER_USER_CAP) break;
      const deal = byId.get(r.deal_id);
      const to = deal?.brand_email?.trim() ?? '';
      if (!deal || !EMAIL_RE.test(to)) {
        skipped += 1;
        continue;
      }
      if (!apiKey) {
        skipped += 1;
        continue;
      }
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'DealFlow <onboarding@resend.dev>',
          to: [to],
          reply_to: user.email,
          subject: r.headline,
          text: `${r.send_text}\n\n—\nSent by ${user.name} via DealFlow`,
        }),
      });
      if (!res.ok) {
        failures.push(r.deal_id);
        console.error('[auto-followups] resend failed for deal', r.deal_id, await res.text());
        continue;
      }
      await logAutoSend(user.id, r.deal_id, r.kind, sentOn);
      sent += 1;
      userSent += 1;
    }
  }

  return NextResponse.json({ users: users.length, sent, skipped, failures });
}
