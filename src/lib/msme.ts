// Section 15 of the MSMED Act 2006: a buyer must pay an MSME (Udyam-registered)
// supplier within 45 days of acceptance. Past that, compound interest at three
// times the RBI bank rate is legally payable. This module does that one
// calculation so the demand letter and the free tool agree to the paisa.

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

/**
 * Compound interest at 3× the bank rate, compounded monthly over the days
 * late. Fractional months use the same exponent so day 50 and day 51 differ
 * by exactly one day of interest.
 */
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
