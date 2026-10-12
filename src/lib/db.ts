import type { DbDriver } from './db-types';
import { driver as sqliteDriver, resetDbHandle as resetSqlite } from './db-sqlite';
import { driver as pgDriver } from './db-postgres';

// Data layer facade. Every query is one plain SQL statement in one of two
// drivers: SQLite (local dev, zero setup) or Postgres (Supabase) once
// DATABASE_URL is set. Money and date math live in ./money.ts and are shared
// with the client, so a figure shown in the UI can never disagree with one
// computed by the API.

export { computeDealMoney, overdueDays, ageingBucket, daysUntil, round2, clamp, todayISO, toINR, USD_INR, toPaise } from './money';
export type { Deal, User, UserAuthRow, PlanInfo, ResetRow, PaymentRow } from './db-types';

// Both drivers are side-effect-free at module load, so importing both is
// safe; the inactive one is simply never called.
const active: DbDriver = process.env.DATABASE_URL ? pgDriver : sqliteDriver;

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

// Test-only: drop the SQLite handle so a new DEALFLOW_DB_PATH takes effect.
export async function resetDbHandle() {
  resetSqlite();
}
