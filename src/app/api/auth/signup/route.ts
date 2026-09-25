import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createUser, findUserByEmail, hashPassword, createSessionToken, setSessionCookie } from '@/lib/auth';
import { signupSchema } from '@/lib/schemas';
import { LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const limited = await rateLimit(`signup:${clientIp(request)}`, LIMITS.signup);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds, 'signup');

  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { name, email, password } = signupSchema.parse(body);

    if (await findUserByEmail(email)) {
      return NextResponse.json({ error: 'An account with that email already exists. Sign in instead.' }, { status: 409 });
    }

    const user = await createUser({ name, email, passwordHash: await hashPassword(password) });
    await setSessionCookie(await createSessionToken(user.id));

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, plan: user.plan } }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[signup]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
