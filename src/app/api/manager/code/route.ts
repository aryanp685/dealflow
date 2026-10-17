import { NextResponse } from 'next/server';
import { UnauthorizedError, getManagerContext } from '@/lib/auth';
import { createManagerCode } from '@/lib/db';
import { PAIR_CODE_TTL_MS, generatePairCode, hashPairCode } from '@/lib/manager';
import { LIMITS, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const ctx = await getManagerContext();
    if (ctx.actingAsId) {
      return NextResponse.json({ error: 'Switch back to your own account first' }, { status: 400 });
    }
    const limited = await rateLimit(`manager-code:${ctx.me.id}`, LIMITS.managerRedeem);
    if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds, 'manager-code');
    const code = generatePairCode();
    await createManagerCode(hashPairCode(code), ctx.me.id, Date.now() + PAIR_CODE_TTL_MS);
    return NextResponse.json({ code, expires_in_min: PAIR_CODE_TTL_MS / 60000 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error('[manager/code]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
