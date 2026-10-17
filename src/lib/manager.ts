import { createHash, randomBytes } from 'node:crypto';

export const PAIR_CODE_TTL_MS = 15 * 60 * 1000;
export const PAIR_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PAIR_CODE_RE = /^[A-Z2-9]{6}$/;

export function generatePairCode(): string {
  const bytes = randomBytes(6);
  let out = '';
  for (const b of bytes) out += PAIR_ALPHABET[b % PAIR_ALPHABET.length];
  return out;
}

export function hashPairCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function isValidPairCodeFormat(code: string): boolean {
  return PAIR_CODE_RE.test(code.trim().toUpperCase());
}

export function canLink(managerId: number, creatorId: number): boolean {
  return (
    Number.isInteger(managerId) &&
    Number.isInteger(creatorId) &&
    managerId > 0 &&
    creatorId > 0 &&
    managerId !== creatorId
  );
}
