import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { updateUpiId } from '@/lib/db';
import { UPI_ID_RE } from '@/lib/reminders';

export const dynamic = 'force-dynamic';

const schema = z
  .object({ upi_id: z.string().trim().max(100) })
  .refine((d) => d.upi_id === '' || UPI_ID_RE.test(d.upi_id), {
    message: 'That UPI ID does not look valid — use the format name@bank',
  });

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ upi_id: user.upi_id ?? null, name: user.name, email: user.email });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error('[profile]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const { upi_id } = schema.parse(body);
    const value = upi_id === '' ? null : upi_id;
    await updateUpiId(user.id, value);
    return NextResponse.json({ upi_id: value });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[profile]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
