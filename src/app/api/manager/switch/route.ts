import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { UnauthorizedError, createSessionToken, getManagerContext, setSessionCookie } from '@/lib/auth';
import { hasManagerLink } from '@/lib/db';

export const dynamic = 'force-dynamic';

const schema = z.object({ creator_id: z.number().int().positive().nullable() });

export async function POST(request: Request) {
  try {
    const ctx = await getManagerContext();
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const { creator_id } = schema.parse(body);
    if (creator_id !== null) {
      if (creator_id === ctx.me.id) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
      if (!(await hasManagerLink(ctx.me.id, creator_id))) {
        return NextResponse.json({ error: 'No access to that account' }, { status: 403 });
      }
    }
    await setSessionCookie(await createSessionToken(ctx.me.id, ctx.me.session_version ?? 1, creator_id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[manager/switch]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
