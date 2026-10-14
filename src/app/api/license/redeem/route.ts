import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { UnauthorizedError, requireUser } from '@/lib/auth';
import { getLicenseByKey, getLicenseByUserId, grantPlan, insertLicense } from '@/lib/db';
import { bumpLicenseUsage, payhipConfigured, verifyLicenseKey } from '@/lib/payhip';
import { LIMITS, clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const schema = z.object({ key: z.string().trim().min(8).max(64) });

function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: unknown }).code;
  return code === 'SQLITE_CONSTRAINT_UNIQUE' || code === '23505';
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const limited = await rateLimit(`license:${user.id}:${clientIp(request)}`, LIMITS.licenseRedeem);
    if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds, 'license redeem');
    if (!payhipConfigured()) {
      return NextResponse.json({ error: 'Payhip sales are not connected yet' }, { status: 503 });
    }
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const { key } = schema.parse(body);
    const normalized = key.trim().toUpperCase();
    if (await getLicenseByUserId(user.id)) {
      return NextResponse.json({ error: 'This account already has a license key attached' }, { status: 409 });
    }
    if (await getLicenseByKey(normalized)) {
      return NextResponse.json({ error: 'This key is already used on another account' }, { status: 409 });
    }
    const verified = await verifyLicenseKey(normalized);
    if (!verified.ok) {
      if (verified.reason === 'disabled') {
        return NextResponse.json(
          { error: 'This key was disabled — if you were refunded, that is why. Reply to your Payhip receipt for help.' },
          { status: 403 }
        );
      }
      if (verified.reason === 'wrong_product') {
        return NextResponse.json({ error: 'This key is for a different product' }, { status: 400 });
      }
      if (verified.reason === 'network') {
        return NextResponse.json({ error: 'Could not reach Payhip — try again in a bit' }, { status: 502 });
      }
      return NextResponse.json(
        { error: 'That key does not look valid — copy it exactly as shown on your Payhip receipt' },
        { status: 400 }
      );
    }
    try {
      await insertLicense({
        license_key: normalized,
        user_id: user.id,
        buyer_email: verified.buyerEmail,
        product_link: verified.productLink,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return NextResponse.json({ error: 'This key was just redeemed — try signing in again' }, { status: 409 });
      }
      throw err;
    }
    await grantPlan(user.id, 'pro', null);
    await bumpLicenseUsage(normalized);
    return NextResponse.json({ ok: true, plan: 'pro' });
  } catch (err) {
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    console.error('[license-redeem]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
