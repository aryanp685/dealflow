import type { Metadata } from 'next';
import ToolShell from '@/components/tool-shell';
import TdsCalculatorTool from './tool';

export const metadata: Metadata = {
  title: 'TDS Calculator for Creators & Freelancers (194J, 194H, 194O)',
  description:
    'How much actually lands in your bank after TDS and GST? Free calculator for brand deals, freelancing and commissions — 194J at 10%, 194H at 5%, 194O at 2%, with the GST split.',
  keywords: ['TDS calculator', '194J TDS rate', 'TDS on brand deals', 'freelancer TDS India', '194H commission TDS'],
  alternates: { canonical: '/tools/tds-calculator' },
  openGraph: {
    title: 'TDS Calculator for Creators & Freelancers (194J, 194H, 194O)',
    description: 'How much actually lands in your bank after TDS and GST? Free calculator for brand deals, freelancing and commissions — 194J at 10%, 194H at 5%, 194O at 2%, with the GST split.',
    url: '/tools/tds-calculator',
    siteName: 'DealFlow',
    type: 'website',
    locale: 'en_IN',
    images: ['/og-tds.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TDS Calculator for Creators & Freelancers (194J, 194H, 194O)',
    description: 'How much actually lands in your bank after TDS and GST? Free calculator for brand deals, freelancing and commissions — 194J at 10%, 194H at 5%, 194O at 2%, with the GST split.',
    images: ['/og-tds.png'],
  },
};

const faqs = [
  {
    q: 'Which TDS section applies to brand deals?',
    a: 'Most brand collaborations are professional fees — section 194J at 10%. If you are paid through an e-commerce operator, 194O at 2% can apply. Agencies routing commission sometimes use 194H at 5%. If the payer does not have your PAN on file, they are required to deduct 20% under 206AA.',
  },
  {
    q: 'Is TDS calculated on the GST amount too?',
    a: 'No. TDS applies to the fee (gross), not to gross + GST. A ₹50,000 deal with GST invoices at ₹59,000 but TDS at 10% is still ₹5,000, not ₹5,900.',
  },
  {
    q: 'Is the TDS money lost?',
    a: 'No — it is tax already paid on your behalf. The brand issues Form 16A; you claim it as credit when you file. If your total tax liability is lower, it comes back as a refund.',
  },
  {
    q: 'Does this calculator save my numbers?',
    a: 'Nothing is stored or sent anywhere — the math runs in your browser. If you want every deal remembered, with follow-ups and ageing, that is what the DealFlow app is for.',
  },
];

export default function TdsCalculatorPage() {
  return (
    <ToolShell
      title="TDS Calculator for Creators & Freelancers"
      intro="You quoted ₹50,000. The brand deducts 10% TDS and adds 18% GST if you're registered. So what actually hits your bank? Type the number — the exact split, in rupees."
      faqs={faqs}
    >
      <TdsCalculatorTool />
    </ToolShell>
  );
}
