import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { UnauthorizedError, createSessionToken, getManagerContext, setSessionCookie } from '@/lib/auth';
import { deleteManagerLink, hasManagerLink, listManagedCreators, listManagers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await getManagerContext();
    const [managing, managers] = await Promise.all([
      listManagedCreators(ctx.me.id),
      listManagers(ctx.me.id),
    ]);
    return NextResponse.json({
      me: { id: ctx.me.id, name: ctx.me.name, email: ctx.me.email },
      acting_as: ctx.actingAs
        ? { id: ctx.actingAs.id, name: ctx.actingAs.name, email: ctx.actingAs.email }
        : null,
      managing,
      managers,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error('[manager/links]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

const deleteSchema = z.object({ creator_id: z.coerce.number().int().positive() });

export async function DELETE(request: Request) {
  try {
    const ctx = await getManagerContext();
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const { creator_id } = deleteSchema.parse(body);
    if (creator_id === ctx.me.id) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const iManageThem = await hasManagerLink(ctx.me.id, creator_id);
    const theyManageMe = iManageThem ? false : await hasManagerLink(creator_id, ctx.me.id);
    if (!iManageThem && !theyManageMe) return NextResponse.json({ error: 'No such link' }, { status: 404 });
    if (iManageThem) await deleteManagerLink(ctx.me.id, creator_id);
    else await deleteManagerLink(creator_id, ctx.me.id);
    if (ctx.actingAsId === creator_id) {
      await setSessionCookie(await createSessionToken(ctx.me.id, ctx.me.session_version ?? 1, null));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[manager/links]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
