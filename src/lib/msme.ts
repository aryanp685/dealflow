
import { round2 } from './money';

export const RBI_BANK_RATE_PCT = 6.5;
export const MSME_RATE_MULTIPLIER = 3;
export const MSME_PAYMENT_WINDOW_DAYS = 45;

export const SAMADHAAN_URL = 'https://samadhaan.msme.gov.in';
export const UDYAM_URL = 'https://udyamregistration.gov.in';

export interface MsmeInterest {
  principal: number;
  days_late: number;
  rate_pct: number;
  interest: number;
  total_due: number;
}

export function msmeInterest(
  principal: number,
  daysLate: number,
  bankRatePct: number = RBI_BANK_RATE_PCT
): MsmeInterest {
  const p = Math.max(0, round2(principal));
  const days = Math.max(0, Math.floor(daysLate));
  const rate = round2(bankRatePct * MSME_RATE_MULTIPLIER);

  if (p === 0 || days === 0) {
    return { principal: p, days_late: days, rate_pct: rate, interest: 0, total_due: p };
  }

  const months = days / 30;
  const factor = Math.pow(1 + rate / 100 / 12, months);
  const interest = round2(p * (factor - 1));
  return { principal: p, days_late: days, rate_pct: rate, interest, total_due: round2(p + interest) };
}
