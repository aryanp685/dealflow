import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { UnauthorizedError, getManagerContext } from '@/lib/auth';
import { createManagerLink, findUserById, redeemManagerCode } from '@/lib/db';
import { canLink, hashPairCode, isValidPairCodeFormat } from '@/lib/manager';
import { LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({ code: z.string().trim().min(1, 'Enter the pairing code') });

export async function POST(request: Request) {
  try {
    const ctx = await getManagerContext();
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const { code } = schema.parse(body);
    const limited = await rateLimit(`manager-redeem:${ctx.me.id}:${clientIp(request)}`, LIMITS.managerRedeem);
    if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds, 'manager-redeem');
    if (!isValidPairCodeFormat(code)) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }
    const row = await redeemManagerCode(hashPairCode(code), Date.now());
    if (!row) return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    if (!canLink(ctx.me.id, row.creator_id)) {
      return NextResponse.json({ error: 'You cannot link your own account' }, { status: 400 });
    }
    await createManagerLink(ctx.me.id, row.creator_id);
    const creator = await findUserById(row.creator_id);
    return NextResponse.json({
      ok: true,
      creator: creator ? { id: creator.id, name: creator.name } : null,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[manager/redeem]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
