import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { z } from 'zod';
import {
  createPasswordReset, findUserByEmail, generateResetToken,
} from '@/lib/auth';
import { LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({ email: z.string().trim().toLowerCase().email('enter a valid email') });

/**
 * POST /api/auth/forgot-password
 *
 * Always answers 200 with the same body whether or not the email exists —
 * anything else turns this endpoint into an account enumeration oracle.
 *
 * Until an email provider is wired up the reset link is returned in the
 * response for local testing, and hidden in production.
 */
export async function POST(request: Request) {
  const limited = await rateLimit(`forgot:${clientIp(request)}`, LIMITS.forgotPassword);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds, 'forgot-password');

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { email } = schema.parse(body);
    const user = await findUserByEmail(email);
    const generic = { ok: true, message: 'If that email has an account, a reset link is on its way.' };

    if (!user) return NextResponse.json(generic);

    const token = generateResetToken();
    await createPasswordReset(user.id, token);

    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    // TODO: send `resetUrl` via Resend/Postmark here.
    if (process.env.NODE_ENV === 'production') return NextResponse.json(generic);
    return NextResponse.json({ ...generic, dev_reset_url: resetUrl });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[forgot-password]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
