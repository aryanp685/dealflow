import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { findUserByEmail, verifyPassword, createSessionToken, setSessionCookie } from '@/lib/auth';
import { loginSchema } from '@/lib/schemas';
import { LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { email, password } = loginSchema.parse(body);

    const ip = clientIp(request);
    const perAccount = await rateLimit(`login:${ip}:${email}`, LIMITS.login);
    if (!perAccount.ok) return tooManyRequests(perAccount.retryAfterSeconds, 'login');
    const perIp = await rateLimit(`login-ip:${ip}`, LIMITS.loginIp);
    if (!perIp.ok) return tooManyRequests(perIp.retryAfterSeconds, 'login');

    const user = await findUserByEmail(email);

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: 'Email or password is incorrect' }, { status: 401 });
    }

    await setSessionCookie(await createSessionToken(user.id, user.session_version ?? 1));
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[login]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
