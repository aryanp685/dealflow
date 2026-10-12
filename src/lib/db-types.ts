import type { DealStatus, PaymentStatus } from './schemas';

export type User = {
  id: number;
  name: string;
  email: string;
  plan: string;
  plan_expires_at: number | null;
  session_version: number;
  created_at: string;
};

export type UserAuthRow = User & { password_hash: string };

export type PlanInfo = { plan: string; plan_expires_at: number | null };

export type ResetRow = { user_id: number; expires_at: number; used_at: number | null };

export type PaymentRow = { id: number };

export type Deal = {
  id: number;
  creator_id: number;
  brand: string;
  brand_contact: string | null;
  brand_email: string | null;
  brand_whatsapp: string | null;
  title: string;
  platform: string;
  status: DealStatus;
  deal_value: number;
  currency: string;
  advance_pct: number;
  agreed_on: string | null;
  deliver_by: string | null;
  delivered_on: string | null;
  invoice_number: string | null;
  invoice_sent_on: string | null;
  invoice_due_on: string | null;
  paid_on: string | null;
  payment_status: PaymentStatus;
  payment_terms_days: number;
  escalation_contact: string | null;
  gst_applicable: number;
  tds_pct: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// Both drivers implement this; db.ts picks one from DATABASE_URL.
export interface DbDriver {
  listUsers(): Promise<{ id: number; name: string; email: string }[]>;
  listDeals(creatorId: number): Promise<Deal[]>;
  getDeal(creatorId: number, dealId: number): Promise<Deal | undefined>;
  insertDeal(creatorId: number, fields: Record<string, unknown>): Promise<Deal>;
  updateDeal(creatorId: number, dealId: number, updates: Record<string, unknown>): Promise<Deal | undefined>;
  deleteDeal(creatorId: number, dealId: number): Promise<boolean>;
  countActiveDeals(creatorId: number): Promise<number>;
  distinctBrands(creatorId: number): Promise<string[]>;

  findUserByEmail(email: string): Promise<UserAuthRow | undefined>;
  findUserById(id: number): Promise<User | undefined>;
  createUser(input: { name: string; email: string; passwordHash: string }): Promise<User>;
  updatePassword(userId: number, passwordHash: string): Promise<void>;
  bumpSessionVersion(userId: number): Promise<void>;
  getPlanInfo(userId: number): Promise<PlanInfo | undefined>;
  // A null expiry means "never lapses" — that is how the lifetime deal is stored.
  grantPlan(userId: number, plan: string, planExpiresAt: number | null): Promise<void>;
  countLifetimeSales(): Promise<number>;

  invalidateLiveResets(userId: number, usedAt: number): Promise<void>;
  insertReset(tokenHash: string, userId: number, expiresAt: number): Promise<void>;
  getReset(tokenHash: string): Promise<ResetRow | undefined>;
  markResetUsed(tokenHash: string, usedAt: number): Promise<void>;

  findPayment(provider: string, paymentId: string): Promise<PaymentRow | undefined>;
  // amount is ALWAYS minor units (paise / cents) on every rail, so future
  // revenue reports can sum the column without per-provider conversion.
  insertPayment(p: {
    provider: string;
    provider_payment_id: string;
    user_id: number;
    plan: string;
    billing: string;
    amount: number;
    currency: string;
  }): Promise<void>;
}

// Form input arrives as JS booleans; both stores keep the flag as 0/1.
export function normalizeValue(v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}
