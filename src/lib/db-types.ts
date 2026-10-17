import type { DealStatus, PaymentStatus } from './schemas';

export type User = {
  id: number;
  name: string;
  email: string;
  upi_id: string | null;
  auto_followups: number;
  plan: string;
  plan_expires_at: number | null;
  session_version: number;
  created_at: string;
};

export type UserAuthRow = User & { password_hash: string };

export type PlanInfo = { plan: string; plan_expires_at: number | null };

export type ResetRow = { user_id: number; expires_at: number; used_at: number | null };

export type PaymentRow = { id: number };

export type LicenseRow = {
  license_key: string;
  user_id: number;
  buyer_email: string;
  product_link: string;
  redeemed_at: string;
};

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

export interface DbDriver {
  listUsers(): Promise<{ id: number; name: string; email: string; upi_id: string | null }[]>;
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
  grantPlan(userId: number, plan: string, planExpiresAt: number | null): Promise<void>;
  updateUpiId(userId: number, upiId: string | null): Promise<void>;
  updateAutoFollowups(userId: number, on: boolean): Promise<void>;
  listAutoFollowupUsers(): Promise<{ id: number; name: string; email: string; upi_id: string | null }[]>;
  hasAutoSend(creatorId: number, dealId: number, kind: string): Promise<boolean>;
  logAutoSend(creatorId: number, dealId: number, kind: string, sentOn: string): Promise<void>;
  listAutoSends(creatorId: number): Promise<{ deal_id: number; kind: string; sent_on: string }[]>;
  createManagerCode(codeHash: string, creatorId: number, expiresAt: number): Promise<void>;
  redeemManagerCode(codeHash: string, now: number): Promise<{ creator_id: number } | undefined>;
  createManagerLink(managerId: number, creatorId: number): Promise<void>;
  deleteManagerLink(managerId: number, creatorId: number): Promise<void>;
  hasManagerLink(managerId: number, creatorId: number): Promise<boolean>;
  listManagedCreators(managerId: number): Promise<{ id: number; name: string; email: string }[]>;
  listManagers(creatorId: number): Promise<{ id: number; name: string; email: string }[]>;
  countLifetimeSales(): Promise<number>;

  invalidateLiveResets(userId: number, usedAt: number): Promise<void>;
  insertReset(tokenHash: string, userId: number, expiresAt: number): Promise<void>;
  getReset(tokenHash: string): Promise<ResetRow | undefined>;
  markResetUsed(tokenHash: string, usedAt: number): Promise<void>;

  findPayment(provider: string, paymentId: string): Promise<PaymentRow | undefined>;
  insertPayment(p: {
    provider: string;
    provider_payment_id: string;
    user_id: number;
    plan: string;
    billing: string;
    amount: number;
    currency: string;
  }): Promise<void>;

  getLicenseByKey(key: string): Promise<LicenseRow | undefined>;
  getLicenseByUserId(userId: number): Promise<LicenseRow | undefined>;
  insertLicense(row: { license_key: string; user_id: number; buyer_email: string; product_link: string }): Promise<void>;
  countLicenses(): Promise<number>;
}

export function normalizeValue(v: unknown): unknown {
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}
