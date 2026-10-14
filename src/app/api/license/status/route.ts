import { NextResponse } from 'next/server';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { getLicenseByUserId, grantPlan } from '@/lib/db';
import { payhipConfigured, verifyLicenseKey } from '@/lib/payhip';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();
    const row = await getLicenseByUserId(user.id);
    if (!row) return NextResponse.json({ licensed: false });
    if (!payhipConfigured()) {
      return NextResponse.json({ licensed: true, verified: false, buyerEmail: row.buyer_email });
    }
    const verified = await verifyLicenseKey(row.license_key);
    if (!verified.ok && verified.reason === 'network') {
      return NextResponse.json({ licensed: true, verified: false, buyerEmail: row.buyer_email });
    }
    if (!verified.ok) {
      if (user.plan === 'pro' && user.plan_expires_at === null) {
        await grantPlan(user.id, 'free', null);
      }
      return NextResponse.json({ licensed: false, reason: verified.reason });
    }
    return NextResponse.json({ licensed: true, verified: true, buyerEmail: row.buyer_email });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error('[license-status]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
