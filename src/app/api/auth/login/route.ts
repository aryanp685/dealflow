import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { findUserByEmail, verifyPassword, createSessionToken, setSessionCookie } from '@/lib/auth';
import { loginSchema } from '@/lib/schemas';
import { LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  // Keyed on IP + email so one attacker cannot lock out a whole office behind
  // a shared NAT, and cannot spray one password across every account either.
  const limited = await rateLimit(`login:${clientIp(request)}`, LIMITS.login);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds, 'login');

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { email, password } = loginSchema.parse(body);
    const user = await findUserByEmail(email);

    /* Same message for unknown email and wrong password — never leak which
       accounts exist. */
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: 'Email or password is incorrect' }, { status: 401 });
    }

    await setSessionCookie(await createSessionToken(user.id));
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[login]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
