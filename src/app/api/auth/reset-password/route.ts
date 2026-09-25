import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { z } from 'zod';
import { consumePasswordReset, hashPassword, updatePassword } from '@/lib/auth';
import { LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  token: z.string().trim().min(20, 'reset link is invalid or has expired'),
  password: z
    .string()
    .min(8, 'use at least 8 characters')
    .max(128)
    .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'include at least one letter and one number'),
});

export async function POST(request: Request) {
  const limited = await rateLimit(`reset:${clientIp(request)}`, LIMITS.resetPassword);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds, 'reset-password');

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { token, password } = schema.parse(body);

    // Single message for expired, already-used and forged tokens — leaking
    // which case applied would let an attacker probe token validity.
    const userId = await consumePasswordReset(token);
    if (!userId) {
      return NextResponse.json({ error: 'That reset link is invalid or has expired. Request a new one.' }, { status: 400 });
    }

    await updatePassword(userId, await hashPassword(password));
    return NextResponse.json({ ok: true, message: 'Password updated. You can sign in now.' });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[reset-password]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
