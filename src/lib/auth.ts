import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies, headers } from 'next/headers';
import * as db from './db';


export const SESSION_COOKIE = 'dealflow_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type User = {
  id: number;
  name: string;
  email: string;
  upi_id: string | null;
  plan: string;
  plan_expires_at: number | null;
  session_version: number;
  created_at: string;
};

export function effectivePlan(user: { plan: string; plan_expires_at: number | null }): string {
  if (user.plan === 'free') return 'free';
  if (!user.plan_expires_at) return user.plan;
  return user.plan_expires_at > Date.now() ? user.plan : 'free';
}

function secretKey(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ??
    'dealflow-development-secret-do-not-use-in-production-0000000000';
  return new TextEncoder().encode(secret.padEnd(32, '0'));
}

export function assertSecret() {
  if (!process.env.AUTH_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be set in production. Generate one with: openssl rand -base64 32');
  }
}


export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}


export function findUserByEmail(email: string) {
  return db.findUserByEmail(email);
}

export function findUserById(id: number) {
  return db.findUserById(id);
}

export function createUser(input: { name: string; email: string; passwordHash: string }) {
  return db.createUser(input);
}


export async function createSessionToken(userId: number, sessionVersion = 1): Promise<string> {
  return new SignJWT({ sub: String(userId), v: sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<{ id: number; version: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const id = Number(payload.sub);
    const version = Number(payload.v ?? 0);
    return Number.isInteger(id) && id > 0 ? { id, version } : null;
  } catch {
    return null;
  }
}


function isEmbeddedPreviewHost(host: string | null): boolean {
  return host !== null && host.endsWith('.e2b.app');
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  const hdrs = await headers();
  const embedded = isEmbeddedPreviewHost(hdrs.get('host'));
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: embedded ? 'none' : 'lax',
    secure: embedded || process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const sess = await readSessionToken(token);
  if (!sess) return null;
  const user = await db.findUserById(sess.id);
  if (!user) return null;
  if ((user.session_version ?? 1) !== sess.version) return null;
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Sign in to continue');
    this.name = 'UnauthorizedError';
  }
}


export const RESET_TTL_MS = 30 * 60 * 1000;

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createPasswordReset(userId: number, rawToken: string, ttlMs = RESET_TTL_MS) {
  await db.invalidateLiveResets(userId, Date.now());
  await db.insertReset(hashResetToken(rawToken), userId, Date.now() + ttlMs);
}

export async function consumePasswordReset(rawToken: string): Promise<number | null> {
  const row = await db.getReset(hashResetToken(rawToken));

  if (!row) return null;
  if (row.used_at !== null) return null;
  if (row.expires_at <= Date.now()) return null;

  await db.markResetUsed(hashResetToken(rawToken), Date.now());
  return row.user_id;
}

export function updatePassword(userId: number, passwordHash: string) {
  return db.updatePassword(userId, passwordHash);
}

export function bumpSessionVersion(userId: number) {
  return db.bumpSessionVersion(userId);
}
