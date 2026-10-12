import { z } from 'zod';

// Every request body is parsed here, so invalid input is rejected at the
// boundary with a readable message instead of reaching SQL as a 500.

export const DEAL_STATUSES = [
  'negotiating', 'agreed', 'delivering', 'delivered', 'invoiced', 'paid', 'cancelled',
] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'not_invoiced', 'advance_paid', 'invoiced', 'overdue', 'paid', 'cancelled',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PLATFORMS = [
  'instagram', 'youtube', 'twitter', 'facebook', 'linkedin', 'blog', 'event', 'other',
] as const;

export const CURRENCIES = ['INR', 'USD'] as const;

// new Date('2026-02-31') rolls over to 3 March, so round-trip the parts.
function isRealCalendarDate(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
  .refine(isRealCalendarDate, 'must be a real calendar date')
  .nullish();

// Trimmed free text; empty or absent collapses to null. The .optional() has
// to sit outside the transform — a union containing z.undefined() does not
// make the key optional at object level.
const optionalText = z
  .union([z.string(), z.null()])
  .transform((v) => (typeof v === 'string' && v.trim() ? v.trim() : null))
  .optional();

// Trim before the email check: addresses pasted from a mail client carry a
// trailing space, and rejecting one reads as a broken form.
const optionalEmail = z
  .union([z.string(), z.null()])
  .transform((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
  .pipe(
    z.union([z.literal(''), z.string().email('must be a valid email')])
  )
  .transform((v) => (v === '' ? null : v))
  .optional();

export const createDealSchema = z.object({
  brand: z.string().trim().min(1, 'brand is required').max(120),
  title: z.string().trim().min(1, 'title is required').max(200),
  brand_contact: optionalText,
  brand_email: optionalEmail,
  brand_whatsapp: optionalText,

  platform: z.enum(PLATFORMS).default('instagram'),
  status: z.enum(DEAL_STATUSES).default('negotiating'),
  payment_status: z.enum(PAYMENT_STATUSES).default('not_invoiced'),

  deal_value: z.coerce.number().min(0, 'cannot be negative').max(1e9).default(0),
  currency: z.enum(CURRENCIES).default('INR'),
  advance_pct: z.coerce.number().min(0).max(100, 'cannot exceed 100').default(0),
  tds_pct: z.coerce.number().min(0).max(100, 'cannot exceed 100').default(0),
  gst_applicable: z.coerce.boolean().default(false),

  agreed_on: isoDate,
  deliver_by: isoDate,
  delivered_on: isoDate,
  invoice_number: optionalText,
  invoice_sent_on: isoDate,
  invoice_due_on: isoDate,
  paid_on: isoDate,
  payment_terms_days: z.coerce.number().int('whole days only').min(0).max(365, 'terms beyond a year are not real').default(15),
  escalation_contact: optionalText,
  notes: optionalText,
});

/** PATCH accepts a subset; unknown keys are stripped rather than erroring. */
export const updateDealSchema = createDealSchema.partial().extend({
  brand: z.string().trim().min(1, 'brand cannot be empty').max(120).optional(),
  title: z.string().trim().min(1, 'title cannot be empty').max(200).optional(),
});

export const paymentLinkSchema = z.object({
  brand: z.string().trim().min(1, 'brand is required').max(120),
  title: z.string().trim().max(200).optional(),
  amount: z.coerce.number().positive('amount must be greater than 0').max(1e8),
  currency: z.enum(CURRENCIES).default('INR'),
  note: z.string().trim().max(300).optional(),
  log_deal: z.coerce.boolean().default(true),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('enter a valid email'),
  password: z.string().min(1, 'password is required'),
});

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'name is too short').max(80),
  email: z.string().trim().toLowerCase().email('enter a valid email'),
  password: z
    .string()
    .min(8, 'use at least 8 characters')
    .max(128)
    .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), 'include at least one letter and one number'),
});

export type DealInput = z.infer<typeof createDealSchema>;
export type DealUpdate = z.infer<typeof updateDealSchema>;
export type PaymentLinkInput = z.infer<typeof paymentLinkSchema>;

// Enforced in the deals route; a client-side check alone is decorative.
// Yearly is the default everywhere in the UI: in India a monthly recurring
// debit needs a UPI/card mandate, and mandate creation fails for a third to a
// half of all attempts. One annual UPI payment has no mandate and no renewal
// failure mode — the app emails a renewal link instead.
export const PLANS = {
  free: { key: 'free', label: 'Free', max_active_deals: 3, max_brands: Infinity, price_inr: 0, price_usd: 0, quarterly_inr: 0, quarterly_usd: 0, yearly_inr: 0, yearly_usd: 0 },
  creator: { key: 'creator', label: 'Creator', max_active_deals: Infinity, max_brands: Infinity, price_inr: 299, price_usd: 9, quarterly_inr: 699, quarterly_usd: 21, yearly_inr: 2990, yearly_usd: 90 },
  pro: { key: 'pro', label: 'Pro', max_active_deals: Infinity, max_brands: Infinity, price_inr: 799, price_usd: 19, quarterly_inr: 1999, quarterly_usd: 49, yearly_inr: 7990, yearly_usd: 190 },
} as const;

// One-time launch offer: Pro, forever. Granted with a NULL expiry, which
// effectivePlan() already reads as "never lapses". Only 50 are sold — both
// /api/checkout and the webhooks enforce the cap.
export const LIFETIME_CAP = 50;
export const LIFETIME_PRICE = { INR: 7499, USD: 149 } as const;

// Both rails charge in minor units (paise / cents). Every webhook refuses any
// captured payment whose amount is not exactly the plan price, so a ₹1 payment
// can never unlock Pro.
export function expectedMinorUnits(plan: string, billing: string, currency: 'INR' | 'USD'): number | null {
  // Webhooks cast the provider's currency string into this type — refuse
  // anything unexpected rather than pricing it as USD.
  if (currency !== 'INR' && currency !== 'USD') return null;
  if (billing === 'lifetime') {
    if (plan !== 'pro') return null;
    return LIFETIME_PRICE[currency] * 100;
  }
  const p = PLANS[plan as PlanKey];
  if (!p) return null;
  const value =
    currency === 'INR'
      ? billing === 'yearly' ? p.yearly_inr : billing === 'quarterly' ? p.quarterly_inr : p.price_inr
      : billing === 'yearly' ? p.yearly_usd : billing === 'quarterly' ? p.quarterly_usd : p.price_usd;
  return value > 0 ? value * 100 : null;
}

export function expectedPaymentPaise(plan: string, billing: string): number | null {
  return expectedMinorUnits(plan, billing, 'INR');
}

export type PlanKey = keyof typeof PLANS;
export const PLAN_KEYS = Object.keys(PLANS) as PlanKey[];
