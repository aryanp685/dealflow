export const faqs = [
  {
    q: 'Does this replace Zoho Invoice or Tally?',
    a: "No, and it doesn't try to. Zoho is great at turning a finished deal into an invoice — for free. DealFlow handles everything Zoho never sees: which stage each deal is in, which deliverable is due, which brand pays in 71 days, which invoice is 40 days overdue and the exact message to send about it. When it's time to invoice, export a Zoho-ready CSV and let your existing setup do the rest.",
  },
  {
    q: 'How is this different from a spreadsheet?',
    a: "A spreadsheet remembers. DealFlow acts: it flags the deliverable due tomorrow, writes the day-7 nudge, the day-21 firm email, and past 30 days a formal demand notice that calculates the compound interest a brand legally owes an MSME-registered supplier under Section 15. It also knows this brand went overdue last time — before you accept the deal.",
  },
  {
    q: 'Do you store my bank details?',
    a: 'Never. DealFlow is not a payment processor and never asks for bank details, UPI PINs or card numbers. Payments from brands come to you directly. What we store is deal metadata: brand names, amounts, dates and contacts — exportable as CSV any time.',
  },
  {
    q: 'Do I need a GST number to use this?',
    a: "No. Tick the GST box only if you're registered — if you're not, the invoice is quoted without the 18% and the TDS still comes off correctly.",
  },
  {
    q: 'Which TDS rate do I pick?',
    a: "Most brand deals are 194J at 10% (professional fees). Agencies sometimes use 194H at 5% (commission). If the brand doesn't have your PAN they're required to deduct 20%. The dropdown has all four with plain-English labels.",
  },
  {
    q: 'Does it send the follow-ups automatically?',
    a: "It writes them and opens WhatsApp with the message ready — you press send. That's deliberate: a message from your number gets answered, an automated one gets ignored. One tap, not one hour.",
  },
  {
    q: 'Is there a contract or auto-debit?',
    a: 'No. The yearly plan is a single UPI or card payment for 12 months — no mandate, no auto-debit (those fail for half of all Indian users anyway). When your plan is ending you get a renewal link by email; nothing is ever charged without you clicking.',
  },
];

export const offers = [
  { name: 'Free', price: '0', priceCurrency: 'INR' },
  { name: 'Creator', price: '299', priceCurrency: 'INR' },
  { name: 'Creator — yearly', price: '2990', priceCurrency: 'INR' },
  { name: 'Pro', price: '799', priceCurrency: 'INR' },
  { name: 'Pro — yearly', price: '7990', priceCurrency: 'INR' },
  { name: 'Pro — lifetime', price: '7499', priceCurrency: 'INR' },
];
