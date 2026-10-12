import type { Deal } from './db';
import { computeDealMoney, daysUntil, overdueDays, formatDate, formatMoney, shiftDaysISO, todayISO, tdsSectionFor } from './money';
import { msmeInterest, SAMADHAAN_URL, UDYAM_URL } from './msme';

/**
 * Follow-up message generator.
 *
 * This is the feature creators actually pay for: knowing *what to say* and
 * *when to say it* when a brand sits on an invoice. Every template is written
 * to be copy-pasted straight into WhatsApp or email — no placeholders left
 * unfilled, no cringe "I hope this email finds you well".
 *
 * Tone ladder: polite -> firm -> formal demand notice. Past 45 days the
 * letter invokes Section 15 of the MSMED Act (3× RBI bank rate compound
 * interest) — the one lever Indian freelancers have that brands fear.
 */

export type ReminderKind =
  | 'delivery_upcoming'
  | 'delivery_overdue'
  | 'invoice_not_sent'
  | 'payment_due_soon'
  | 'payment_overdue_1'
  | 'payment_overdue_2'
  | 'payment_overdue_final'
  | 'payment_overdue_samadhaan'
  | 'advance_not_received';

export type Reminder = {
  deal_id: number;
  brand: string;
  kind: ReminderKind;
  urgency: 1 | 2 | 3;
  headline: string;
  channel: 'whatsapp' | 'email';
  message: string;
  /** The exact text to send to the brand — what the WhatsApp button opens with. */
  send_text: string;
  /** E.164-ish digits from the deal's WhatsApp field, when usable. */
  wa_number?: string;
  money?: string;
  date?: string;
};

const KIND_LABEL: Record<ReminderKind, string> = {
  delivery_upcoming: 'Deliverable due soon',
  delivery_overdue: 'Deliverable overdue',
  invoice_not_sent: 'Invoice not sent yet',
  payment_due_soon: 'Payment due soon',
  payment_overdue_1: 'Payment overdue — gentle nudge',
  payment_overdue_2: 'Payment overdue — firm follow-up',
  payment_overdue_final: 'Payment overdue — demand notice',
  payment_overdue_samadhaan: 'Payment overdue — file on MSME Samadhaan',
  advance_not_received: 'Advance not received',
};

/** Keeps digits only; a bare 10-digit Indian number gets its country code. */
function waNumber(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  // Remove all non-digit characters
  let digits = raw.replace(/\D/g, '');
  // Remove leading zeros
  digits = digits.replace(/^0+/, '');
  if (!digits) return undefined;
  // Handle Indian numbers: if 10 digits, add +91 country code
  if (digits.length === 10) digits = `91${digits}`;
  // Validate length: typical international numbers are 10-15 digits
  if (digits.length < 10 || digits.length > 15) return undefined;
  return digits;
}

export function buildReminders(deals: Deal[], today = new Date()): Reminder[] {
  const out: Reminder[] = [];

  // Per-brand payment history, so a chase can quote what this brand actually
  // did before — the number that decides how hard to push.
  const history = new Map<string, { paid: number[]; late: number }>();
  for (const d of deals) {
    const key = d.brand.trim().toLowerCase();
    const h = history.get(key) ?? { paid: [], late: 0 };
    if (d.payment_status === 'paid' && d.invoice_sent_on && d.paid_on) {
      const sent = Date.parse(`${d.invoice_sent_on}T12:00:00`);
      const paid = Date.parse(`${d.paid_on}T12:00:00`);
      if (!Number.isNaN(sent) && !Number.isNaN(paid) && paid >= sent) h.paid.push(Math.round((paid - sent) / 86_400_000));
      if (d.invoice_due_on && !Number.isNaN(paid) && paid > Date.parse(`${d.invoice_due_on}T12:00:00`)) h.late += 1;
    }
    history.set(key, h);
  }

  for (const deal of deals) {
    if (deal.status === 'cancelled' || deal.payment_status === 'cancelled') continue;

    const m = computeDealMoney(deal);
    const value = formatMoney(m.net_receivable, deal.currency);
    // What the brand owes is the invoice total; TDS is theirs to deduct and
    // deposit, so chasing the net figure quotes a number no invoice shows.
    const invoiceValue = formatMoney(m.invoice_total, deal.currency);
    const tdsNote = deal.tds_pct > 0
      ? ` They deduct ${deal.tds_pct}% TDS and deposit it against your PAN — ${value} is what reaches your account.`
      : '';
    const termsLine = `Payment terms: ${deal.payment_terms_days ?? 15} days from invoice date.`;
    const h = history.get(deal.brand.trim().toLowerCase());
    const avgPay = h && h.paid.length > 0 ? Math.round(h.paid.reduce((a, b) => a + b, 0) / h.paid.length) : null;
    const historyNote = avgPay !== null
      ? ` History: this brand has settled ${h!.paid.length} invoice${h!.paid.length === 1 ? '' : 's'} in ~${avgPay} days on average${h!.late > 0 ? ` and paid late ${h!.late} time${h!.late === 1 ? '' : 's'}` : ''}.`
      : '';
    const contact = deal.brand_contact || deal.brand;
    const wa = waNumber(deal.brand_whatsapp);
    const tdsSection = tdsSectionFor(deal.tds_pct);

    /* ---- 1. Deliverable deadline ---- */
    if (
      deal.deliver_by &&
      !deal.delivered_on &&
      ['agreed', 'delivering', 'negotiating'].includes(deal.status)
    ) {
      const d = daysUntil(deal.deliver_by, today);
      if (d !== null && d < 0) {
        const send = `Hi ${contact}, quick update on ${deal.title} — I'm wrapping the final edit and will send it across by ${formatDate(shiftDaysISO(todayISO(today), 2))}. Apologies for the slip. Let me know if you need a rough cut in the meantime.`;
        out.push({
          deal_id: deal.id,
          brand: deal.brand,
          kind: 'delivery_overdue',
          urgency: 3,
          headline: `${KIND_LABEL.delivery_overdue} — ${Math.abs(d)}d late`,
          channel: 'whatsapp',
          date: deal.deliver_by,
          money: value,
          wa_number: wa,
          send_text: send,
          message: [
            `⚠️ Your deliverable for ${deal.brand} ("${deal.title}") was due ${formatDate(deal.deliver_by)} — ${Math.abs(d)} days ago.`,
            ``,
            `Either ship it today or message ${contact} and reset the date in writing. Silent delays are how deals get cancelled.`,
            ``,
            `Copy-paste to ${contact}:`,
            `"${send}"`,
          ].join('\n'),
        });
      } else if (d !== null && d <= 3) {
        const send = `Hi ${contact}, just delivered ${deal.title} 🎉 Let me know if anything needs a tweak. I'll raise the invoice today so we can close this out.`;
        out.push({
          deal_id: deal.id,
          brand: deal.brand,
          kind: 'delivery_upcoming',
          urgency: 1,
          headline: d === 0 ? 'Deliverable due TODAY' : `Deliverable due in ${d} day${d === 1 ? '' : 's'}`,
          channel: 'whatsapp',
          date: deal.deliver_by,
          money: value,
          wa_number: wa,
          send_text: send,
          message: [
            `📦 "${deal.title}" for ${deal.brand} is due ${formatDate(deal.deliver_by)}.`,
            ``,
            `Send the brand a heads-up once you ship — it makes the invoice conversation 10x easier.`,
            ``,
            `Copy-paste to ${contact}:`,
            `"${send}"`,
          ].join('\n'),
        });
      }
    }

    /* ---- 2. Delivered but invoice never sent ---- */
    if (
      (deal.status === 'delivered' || (deal.delivered_on && deal.payment_status === 'not_invoiced')) &&
      deal.payment_status === 'not_invoiced'
    ) {
      const sinceDelivery = deal.delivered_on ? Math.abs(daysUntil(deal.delivered_on, today) ?? 0) : null;
      const send = [
        `Hi ${contact},`,
        ``,
        `Thanks again for the collaboration on ${deal.title} — really happy with how it turned out.`,
        ``,
        `Please find the invoice attached for ${invoiceValue}${deal.gst_applicable ? ' (incl. 18% GST)' : ''}.`,
        `${termsLine}`
          + (deal.tds_pct > 0 ? `\nKindly deduct TDS at ${deal.tds_pct}%${tdsSection ? ` u/s ${tdsSection}` : ''} and share Form 16A at your convenience.` : '')
          + ``,
        `Bank details are on the invoice. Let me know if you need anything else from my side.`,
        ``,
        `Best,`,
        `You`,
      ].join('\n');
      out.push({
        deal_id: deal.id,
        brand: deal.brand,
        kind: 'invoice_not_sent',
        urgency: 2,
        headline: sinceDelivery ? `Invoice not sent — delivered ${sinceDelivery}d ago` : 'Invoice not sent yet',
        channel: 'email',
        money: invoiceValue,
        wa_number: wa,
        send_text: send,
        message: [
          `🧾 You delivered "${deal.title}" for ${deal.brand} but haven't logged an invoice. Every day without an invoice is a day the payment clock hasn't started.`,
          ``,
          `Raise invoice for ${invoiceValue} and log it here.${tdsNote}`,
          ``,
          `Copy-paste email to ${deal.brand_email || contact}:`,
          `Subject: Invoice — ${deal.title}`,
          ``,
          `"${send}"`,
        ].join('\n'),
      });
    }

    /* ---- 3. Advance agreed but not received ---- */
    if (
      deal.advance_pct > 0 &&
      deal.payment_status === 'not_invoiced' &&
      ['agreed', 'delivering'].includes(deal.status) &&
      deal.agreed_on
    ) {
      const sinceAgreed = Math.abs(daysUntil(deal.agreed_on, today) ?? 0);
      if (sinceAgreed >= 3) {
        const send = `Hi ${contact}, gentle reminder on the ${deal.advance_pct}% advance (${formatMoney(m.advance_due, deal.currency)}) for ${deal.title} we agreed on ${formatDate(deal.agreed_on)}. Could you share the payment reference once processed? I'll pick production back up the same day it lands.`;
        out.push({
          deal_id: deal.id,
          brand: deal.brand,
          kind: 'advance_not_received',
          urgency: 2,
          headline: `Advance (${deal.advance_pct}%) not received — ${sinceAgreed}d since agreement`,
          channel: 'whatsapp',
          money: formatMoney(m.advance_due, deal.currency),
          date: deal.agreed_on,
          wa_number: wa,
          send_text: send,
          message: [
            `💸 ${deal.brand} agreed to a ${deal.advance_pct}% advance (${formatMoney(m.advance_due, deal.currency)}) ${sinceAgreed} days ago and it hasn't landed. Don't start or continue work until it does.`,
            ``,
            `Copy-paste to ${contact}:`,
            `"${send}"`,
          ].join('\n'),
        });
      }
    }

    /* ---- 4. Invoice sent — chase the payment ---- */
    if (['invoiced', 'overdue'].includes(deal.payment_status) && deal.invoice_due_on) {
      const days = overdueDays(deal.invoice_due_on, deal.payment_status, today);
      const dueIn = daysUntil(deal.invoice_due_on, today);

      if (days === 0 && dueIn !== null && dueIn <= 3) {
        const send = `Hi ${contact}, just a heads-up that invoice ${deal.invoice_number || ''} (${invoiceValue}) is due ${formatDate(deal.invoice_due_on)} — as per our ${deal.payment_terms_days ?? 15}-day payment terms. Let me know if you need the invoice re-sent or any other details from my side.`;
        out.push({
          deal_id: deal.id,
          brand: deal.brand,
          kind: 'payment_due_soon',
          urgency: 1,
          headline: dueIn === 0 ? `Payment due TODAY — ${invoiceValue}` : `Payment due in ${dueIn}d — ${invoiceValue}`,
          channel: 'whatsapp',
          money: invoiceValue,
          date: deal.invoice_due_on,
          wa_number: wa,
          send_text: send,
          message: [
            `⏰ Invoice ${deal.invoice_number || `for ${deal.title}`} from ${deal.brand} is due ${formatDate(deal.invoice_due_on)} — ${invoiceValue}.${tdsNote}`,
            ``,
            `A reminder *before* the due date gets paid faster than one after it.${historyNote}`,
            ``,
            `Copy-paste to ${contact}:`,
            `"${send}"`,
          ].join('\n'),
        });
      } else if (days >= 1 && days <= 15) {
        const send = `Hi ${contact}, hope you're doing well. Invoice ${deal.invoice_number || ''} for ${invoiceValue} was due ${formatDate(deal.invoice_due_on)} — could you check on the status with your accounts team? Happy to re-share the invoice or any details if that helps.`;
        out.push({
          deal_id: deal.id,
          brand: deal.brand,
          kind: 'payment_overdue_1',
          urgency: 1,
          headline: `Payment overdue ${days}d — ${invoiceValue}`,
          channel: 'whatsapp',
          money: invoiceValue,
          date: deal.invoice_due_on,
          wa_number: wa,
          send_text: send,
          message: [
            `🕐 ${deal.brand} is ${days} day${days === 1 ? '' : 's'} late on ${invoiceValue}. Friendly nudge — assume good intent, it's usually just stuck in someone's approval queue.${tdsNote}${historyNote}`,
            ``,
            `Copy-paste to ${contact}:`,
            `"${send}"`,
          ].join('\n'),
        });
      } else if (days >= 16 && days <= 30) {
        const send = [
          `Hi ${contact},`,
          ``,
          `Following up on invoice ${deal.invoice_number || ''} for ${invoiceValue}, due ${formatDate(deal.invoice_due_on)} per our ${deal.payment_terms_days ?? 15}-day payment terms — now ${days} days past due.`,
          ``,
          `Could you confirm the scheduled payment date? If something is blocking it on your end, let me know and I'll help sort it out.`,
          ``,
          `Thanks,`,
          `You`,
        ].join('\n');
        out.push({
          deal_id: deal.id,
          brand: deal.brand,
          kind: 'payment_overdue_2',
          urgency: 2,
          headline: `Payment overdue ${days}d — ${invoiceValue}`,
          channel: 'email',
          money: invoiceValue,
          date: deal.invoice_due_on,
          wa_number: wa,
          send_text: send,
          message: [
            `🔶 ${days} days overdue on ${invoiceValue}. Time to get specific: name the invoice, name the amount, name a date.${deal.escalation_contact ? ` Send it to ${deal.brand_email || contact} and cc ${deal.escalation_contact} — the person who can release payment.` : ''}${tdsNote}${historyNote}`,
            ``,
            `If you're Udyam-registered (free, 10 min: ${UDYAM_URL}), add this line — it moves invoices: "As an MSME-registered supplier, Section 15 of the MSMED Act entitles me to payment within 45 days, with compound interest at 3× the RBI bank rate thereafter."`,
            ``,
            `Copy-paste email to ${deal.brand_email || contact}:`,
            `Subject: Overdue invoice ${deal.invoice_number || ''} — ${invoiceValue}`,
            ``,
            `"${send}"`,
          ].join('\n'),
        });
      } else if (days > 30 && days <= 45) {
        const esc = deal.escalation_contact ? ` (cc ${deal.escalation_contact})` : '';
        const si = msmeInterest(m.invoice_total, days);
        const send = [
          `To: ${contact}${esc}`,
          ``,
          `DEMAND FOR PAYMENT — Invoice ${deal.invoice_number || deal.title}`,
          ``,
          `Invoice ${deal.invoice_number || ''} dated ${formatDate(deal.invoice_sent_on)} for "${deal.title}" remains unpaid against ${deal.brand}. Payment terms were ${deal.payment_terms_days ?? 15} days from invoice date; it is now ${days} days overdue. Outstanding amount: ${formatMoney(m.invoice_total, deal.currency)}.`,
          ``,
          `As a supplier registered under the MSMED Act 2006 (Udyam), I am entitled to payment within 45 days of acceptance. Under Section 15, compound interest at three times the RBI bank rate (${si.rate_pct}% p.a.) is payable on the outstanding amount from the due date. Interest accrued to date: ${formatMoney(si.interest, deal.currency)}. Total payable: ${formatMoney(si.total_due, deal.currency)}.`,
          ``,
          `Please release ${formatMoney(m.invoice_total, deal.currency)} within 7 days of this notice. Failing that, I will file the invoice on the MSME Samadhaan portal (${SAMADHAAN_URL}) and pursue the balance together with statutory interest.`,
          ``,
          `Regards,`,
          `You`,
        ].join('\n');
        out.push({
          deal_id: deal.id,
          brand: deal.brand,
          kind: 'payment_overdue_final',
          urgency: 3,
          headline: `DEMAND NOTICE — ${days}d overdue, ${invoiceValue} stuck`,
          channel: 'email',
          money: formatMoney(si.total_due, deal.currency),
          date: deal.invoice_due_on,
          wa_number: wa,
          send_text: send,
          message: [
            `🚨 FINAL REMINDER stage — ${days} days overdue and ${invoiceValue} still unpaid. This is no longer a nudge, it's a demand notice with the Section 15 interest worked out: ${formatMoney(si.interest, deal.currency)} accrued, ${formatMoney(si.total_due, deal.currency)} total.${historyNote}`,
            ``,
            `Send the letter below by email to ${deal.brand_email || contact}${esc}. The Section 15 claim holds if you're Udyam-registered — if you aren't yet, register free in 10 min (${UDYAM_URL}); it covers pending dues too. Still nothing after 7 days? File on MSME Samadhaan (${SAMADHAAN_URL}) — free, online, and brands settle once it's filed.`,
            ``,
            `The letter (replace "You" with your name):`,
            `"${send}"`,
          ].join('\n'),
        });
      } else if (days > 45) {
        const esc = deal.escalation_contact ? ` (cc ${deal.escalation_contact})` : '';
        const si = msmeInterest(m.invoice_total, days);
        const send = [
          `To: ${contact}${esc}`,
          ``,
          `FINAL NOTICE BEFORE STATUTORY FILING — Invoice ${deal.invoice_number || deal.title}`,
          ``,
          `Invoice ${deal.invoice_number || ''} dated ${formatDate(deal.invoice_sent_on)} for "${deal.title}" remains unpaid against ${deal.brand}. It is now ${days} days overdue — past the 45-day maximum the MSMED Act 2006 allows a buyer to hold an MSME supplier's payment. Outstanding amount: ${formatMoney(m.invoice_total, deal.currency)}.`,
          ``,
          `Under Section 15, compound interest at three times the RBI bank rate (${si.rate_pct}% p.a.) has been accruing since the due date. Interest to date: ${formatMoney(si.interest, deal.currency)}. Total payable: ${formatMoney(si.total_due, deal.currency)}.`,
          ``,
          `Please release ${formatMoney(m.invoice_total, deal.currency)} within 3 days of this notice. Failing that, I will file on the MSME Samadhaan portal (${SAMADHAAN_URL}). The Facilitation Council can direct payment of the full amount with interest, and the filing becomes part of your company's public record.`,
          ``,
          `Regards,`,
          `You`,
        ].join('\n');
        out.push({
          deal_id: deal.id,
          brand: deal.brand,
          kind: 'payment_overdue_samadhaan',
          urgency: 3,
          headline: `FILE NOW — ${days}d overdue, ${invoiceValue} + ${formatMoney(si.interest, deal.currency)} interest`,
          channel: 'email',
          money: formatMoney(si.total_due, deal.currency),
          date: deal.invoice_due_on,
          wa_number: wa,
          send_text: send,
          message: [
            `⚖️ SAMADHAAN STAGE — ${days} days overdue, past the 45-day legal limit. The law is now fully on your side: principal ${formatMoney(m.invoice_total, deal.currency)} + Section 15 interest ${formatMoney(si.interest, deal.currency)} = ${formatMoney(si.total_due, deal.currency)}.${historyNote}`,
            ``,
            `Send the final notice below first. If payment doesn't land in 3 days, file free on ${SAMADHAAN_URL}: (1) register with your Udyam number, (2) choose "File Issue Against Buyer", (3) upload the invoice + this notice + any follow-up trail, (4) claim principal plus ${formatMoney(si.interest, deal.currency)} interest. The Council summons the buyer — most companies settle the moment the notice arrives.`,
            ``,
            `The notice (replace "You" with your name):`,
            `"${send}"`,
          ].join('\n'),
        });
      }
    }
  }

  return out.sort((a, b) => b.urgency - a.urgency || a.brand.localeCompare(b.brand));
}

export function reminderLabel(kind: ReminderKind): string {
  return KIND_LABEL[kind];
}

/** Plain-text export of every reminder — used by the "Reminders" API. */
export function reminderDigest(reminders: Reminder[]): string {
  if (reminders.length === 0) return 'Nothing needs your attention today. 🎉';
  const groups = new Map<number, Reminder[]>();
  for (const r of reminders) {
    const list = groups.get(r.urgency) ?? [];
    list.push(r);
    groups.set(r.urgency, list);
  }
  const headers: Record<number, string> = {
    3: '🚨 URGENT',
    2: '🔶 NEEDS ACTION',
    1: '🕐 HEADS UP',
  };
  const lines: string[] = [`DealFlow — you have ${reminders.length} item(s) needing attention.`, ''];
  for (const urgency of [3, 2, 1]) {
    const list = groups.get(urgency);
    if (!list) continue;
    lines.push(headers[urgency]);
    for (const r of list) lines.push(`  • ${r.brand} — ${r.headline}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
