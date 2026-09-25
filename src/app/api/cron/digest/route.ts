import { NextResponse } from 'next/server';
import { listUsers, listDeals, getPlanInfo } from '@/lib/db';
import { buildReminders, reminderDigest } from '@/lib/reminders';
import type { PlanInfo } from '@/lib/db-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily digest, fired by Vercel Cron (vercel.json, 08:30 IST). Vercel sends
// `Authorization: Bearer <CRON_SECRET>` with cron invocations; the same header
// works for a manual trigger. Without RESEND_API_KEY the route reports what
// it would have sent instead of emailing.
const DAILY_CAP = 80; // Resend free tier is 100/day — stay under it

// Renewals are a link, never an auto-debit mandate — UPI mandates fail for a
// third to a half of Indian users at creation, and failed debits read as a
// broken product. Paid users get nudged in the last week of their plan.
function renewalNotice(plan: PlanInfo | undefined, site: string): string | null {
  if (!plan || plan.plan === 'free' || plan.plan_expires_at === null) return null;
  const daysLeft = Math.ceil((plan.plan_expires_at - Date.now()) / 86_400_000);
  if (daysLeft > 7) return null;
  const state = daysLeft <= 0 ? 'has expired' : `ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
  return `Your ${plan.plan} plan ${state}. Renew from the Pricing tab — one UPI or card payment, no auto-debit, nothing is charged without you clicking: ${site}/app`;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization');
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const users = await listUsers();
  const today = new Date();
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  let sent = 0;
  let skippedNoReminders = 0;
  const failures: number[] = [];

  for (const user of users) {
    if (sent >= DAILY_CAP) break;
    const deals = await listDeals(user.id);
    const reminders = buildReminders(deals, today);
    const renewal = renewalNotice(await getPlanInfo(user.id), site);
    if (reminders.length === 0 && !renewal) {
      skippedNoReminders += 1;
      continue;
    }

    // onboarding@resend.dev is Resend's test sender (only reaches your own
    // inbox). Set RESEND_FROM to an address on a verified domain for real use.
    const body = {
      from: process.env.RESEND_FROM || 'DealFlow <onboarding@resend.dev>',
      to: [user.email],
      subject: reminders.length
        ? `DealFlow — ${reminders.length} item${reminders.length === 1 ? '' : 's'} need your attention today`
        : 'DealFlow — your plan is ending',
      text: renewal
        ? `${reminderDigest(reminders)}\n\n---\n${renewal}`
        : reminderDigest(reminders),
    };

    if (!apiKey) {
      skippedNoReminders += 1;
      continue;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) sent += 1;
    else {
      failures.push(user.id);
      console.error('[digest] resend failed for user', user.id, await res.text());
    }
  }

  return NextResponse.json({ users: users.length, sent, skippedNoReminders, failures });
}
