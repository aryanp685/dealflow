import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { z } from 'zod';
import {
  createPasswordReset, findUserByEmail, generateResetToken,
} from '@/lib/auth';
import { LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({ email: z.string().trim().toLowerCase().email('enter a valid email') });

export async function POST(request: Request) {
  const limited = await rateLimit(`forgot:${clientIp(request)}`, LIMITS.forgotPassword);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds, 'forgot-password');

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { email } = schema.parse(body);
    const generic = { ok: true, message: 'If that email has an account, a reset link is on its way.' };

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey && process.env.NODE_ENV === 'production') {
      console.error('[forgot-password] RESEND_API_KEY is not configured');
      return NextResponse.json({ error: 'Password reset is unavailable right now. Please try again later.' }, { status: 503 });
    }

    const user = await findUserByEmail(email);
    if (!user) return NextResponse.json(generic);

    const token = generateResetToken();
    await createPasswordReset(user.id, token);

    const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const resetUrl = `${site}/reset-password?token=${token}`;

    if (!apiKey) return NextResponse.json({ ...generic, dev_reset_url: resetUrl });

    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'DealFlow <onboarding@resend.dev>',
        to: [user.email],
        subject: 'Reset your DealFlow password',
        text: [
          `Hi ${user.name},`,
          ``,
          `Someone asked to reset your DealFlow password. If that was you, open this link in the next 30 minutes:`,
          ``,
          resetUrl,
          ``,
          `If it wasn't you, ignore this email — your password stays as it is.`,
        ].join('\n'),
      }),
    });
    if (!sent.ok) {
      console.error('[forgot-password] resend failed for user', user.id, await sent.text());
      return NextResponse.json({ error: 'Password reset is unavailable right now. Please try again later.' }, { status: 503 });
    }

    return NextResponse.json(
      process.env.NODE_ENV === 'production' ? generic : { ...generic, dev_reset_url: resetUrl }
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[forgot-password]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
