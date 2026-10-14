export type PayhipVerifyResult =
  | { ok: true; buyerEmail: string; productLink: string; uses: number }
  | { ok: false; reason: 'not_configured' | 'invalid' | 'disabled' | 'wrong_product' | 'network' };

export function payhipConfigured(): boolean {
  return Boolean(process.env.PAYHIP_PRODUCT_SECRET && process.env.PAYHIP_PRODUCT_LINK);
}

type VerifyPayload = {
  data?: {
    enabled?: boolean;
    product_link?: string;
    license_key?: string;
    buyer_email?: string;
    uses?: number;
  };
};

export async function verifyLicenseKey(rawKey: string): Promise<PayhipVerifyResult> {
  const secret = process.env.PAYHIP_PRODUCT_SECRET;
  const expectedLink = process.env.PAYHIP_PRODUCT_LINK;
  if (!secret || !expectedLink) return { ok: false, reason: 'not_configured' };
  const key = rawKey.trim().toUpperCase();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`https://payhip.com/api/v2/license/verify?license_key=${encodeURIComponent(key)}`, {
      headers: { 'product-secret-key': secret },
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, reason: 'invalid' };
    const body = (await res.json().catch(() => null)) as VerifyPayload | null;
    const d = body?.data;
    if (!d?.license_key) return { ok: false, reason: 'invalid' };
    if (d.enabled === false) return { ok: false, reason: 'disabled' };
    if (d.product_link !== expectedLink) return { ok: false, reason: 'wrong_product' };
    return { ok: true, buyerEmail: d.buyer_email ?? '', productLink: d.product_link, uses: d.uses ?? 0 };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

export async function bumpLicenseUsage(rawKey: string): Promise<void> {
  const secret = process.env.PAYHIP_PRODUCT_SECRET;
  if (!secret) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    await fetch('https://payhip.com/api/v2/license/usage', {
      method: 'PUT',
      headers: { 'product-secret-key': secret, 'content-type': 'application/x-www-form-urlencoded' },
      body: `license_key=${encodeURIComponent(rawKey.trim().toUpperCase())}`,
      signal: ctrl.signal,
    });
  } catch {
  } finally {
    clearTimeout(timer);
  }
}
