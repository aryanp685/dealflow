import { NextResponse } from 'next/server';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { insertDeal, listDeals } from '@/lib/db';
import { getDemoDeals } from '@/lib/demo';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await requireUser();

    if ((await listDeals(user.id)).length > 0) {
      return NextResponse.json(
        { error: 'Sample data is already loaded — this button works once per account.' },
        { status: 409 }
      );
    }

    const demo = getDemoDeals();

    for (const deal of demo) await insertDeal(user.id, deal);

    return NextResponse.json({ created: demo.length }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error('[seed]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
