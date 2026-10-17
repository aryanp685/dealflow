import { NextResponse } from 'next/server';
import { countLifetimeSales } from '@/lib/db';
import { LIFETIME_CAP } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sold = await countLifetimeSales();
    return NextResponse.json({ left: Math.max(0, LIFETIME_CAP - sold), cap: LIFETIME_CAP });
  } catch (err) {
    console.error('[lifetime-left]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
