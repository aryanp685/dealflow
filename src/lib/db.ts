import type { DbDriver } from './db-types';
import { driver as sqliteDriver, resetDbHandle as resetSqlite } from './db-sqlite';
import { driver as pgDriver, ready as pgReady } from './db-postgres';


export { computeDealMoney, overdueDays, ageingBucket, daysUntil, round2, clamp, todayISO, toINR, USD_INR, toPaise } from './money';
export type { Deal, User, UserAuthRow, PlanInfo, ResetRow, PaymentRow } from './db-types';

const guardedPg: DbDriver = new Proxy(pgDriver, {
  get(target, prop) {
    const value = (target as unknown as Record<PropertyKey, unknown>)[prop];
    if (typeof value !== 'function') return value;
    return (...args: unknown[]) =>
      pgReady().then(() => (value as (...a: unknown[]) => Promise<unknown>).apply(target, args));
  },
});

const active: DbDriver = process.env.DATABASE_URL ? guardedPg : sqliteDriver;

export async function listUsers() {
  return active.listUsers();
}
export async function listDeals(creatorId: number) {
  return active.listDeals(creatorId);
}
export async function getDeal(creatorId: number, dealId: number) {
  return active.getDeal(creatorId, dealId);
}
export async function insertDeal(creatorId: number, fields: Record<string, unknown>) {
  return active.insertDeal(creatorId, fields);
}
export async function updateDeal(creatorId: number, dealId: number, updates: Record<string, unknown>) {
  return active.updateDeal(creatorId, dealId, updates);
}
export async function deleteDeal(creatorId: number, dealId: number) {
  return active.deleteDeal(creatorId, dealId);
}
export async function countActiveDeals(creatorId: number) {
  return active.countActiveDeals(creatorId);
}
export async function distinctBrands(creatorId: number) {
  return active.distinctBrands(creatorId);
}

export async function findUserByEmail(email: string) {
  return active.findUserByEmail(email);
}
export async function findUserById(id: number) {
  return active.findUserById(id);
}
export async function createUser(input: { name: string; email: string; passwordHash: string }) {
  return active.createUser(input);
}
export async function updatePassword(userId: number, passwordHash: string) {
  return active.updatePassword(userId, passwordHash);
}
export async function bumpSessionVersion(userId: number) {
  return active.bumpSessionVersion(userId);
}
export async function countLifetimeSales() {
  return active.countLifetimeSales();
}
export async function getPlanInfo(userId: number) {
  return active.getPlanInfo(userId);
}
export async function grantPlan(userId: number, plan: string, planExpiresAt: number | null) {
  return active.grantPlan(userId, plan, planExpiresAt);
}

export async function invalidateLiveResets(userId: number, usedAt: number) {
  return active.invalidateLiveResets(userId, usedAt);
}
export async function insertReset(tokenHash: string, userId: number, expiresAt: number) {
  return active.insertReset(tokenHash, userId, expiresAt);
}
export async function getReset(tokenHash: string) {
  return active.getReset(tokenHash);
}
export async function markResetUsed(tokenHash: string, usedAt: number) {
  return active.markResetUsed(tokenHash, usedAt);
}

export async function findPayment(provider: string, paymentId: string) {
  return active.findPayment(provider, paymentId);
}
export async function insertPayment(p: {
  provider: string;
  provider_payment_id: string;
  user_id: number;
  plan: string;
  billing: string;
  amount: number;
  currency: string;
}) {
  return active.insertPayment(p);
}

export async function getLicenseByKey(key: string) {
  return active.getLicenseByKey(key);
}
export async function getLicenseByUserId(userId: number) {
  return active.getLicenseByUserId(userId);
}
export async function insertLicense(row: { license_key: string; user_id: number; buyer_email: string; product_link: string }) {
  return active.insertLicense(row);
}

export async function resetDbHandle() {
  resetSqlite();
}
