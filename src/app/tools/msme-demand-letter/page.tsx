import type { Metadata } from 'next';
import ToolShell from '@/components/tool-shell';
import MsmeDemandLetterTool from './tool';

export const metadata: Metadata = {
  title: 'MSME Payment Demand Letter Generator (Section 15, free)',
  description:
    'Generate a legal demand notice for unpaid invoices under Section 15 of the MSMED Act 2006 — with compound interest at 3× the RBI bank rate calculated for you. Free, no signup.',
  keywords: ['MSME demand letter', 'section 15 MSMED act', 'unpaid invoice legal notice India', 'MSME samadhaan', '45 days payment rule'],
  alternates: { canonical: '/tools/msme-demand-letter' },
  openGraph: {
    title: 'MSME Payment Demand Letter Generator (Section 15, free)',
    description: 'Generate a legal demand notice for unpaid invoices under Section 15 of the MSMED Act 2006 — with compound interest at 3× the RBI bank rate calculated for you. Free, no signup.',
    url: '/tools/msme-demand-letter',
    siteName: 'DealFlow',
    type: 'website',
    locale: 'en_IN',
    images: ['/og-msme-letter.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MSME Payment Demand Letter Generator (Section 15, free)',
    description: 'Generate a legal demand notice for unpaid invoices under Section 15 of the MSMED Act 2006 — with compound interest at 3× the RBI bank rate calculated for you. Free, no signup.',
    images: ['/og-msme-letter.png'],
  },
};

const faqs = [
  {
    q: 'Who can use Section 15 of the MSMED Act?',
    a: 'Any supplier registered on the Udyam portal — including freelancers, creators and sole proprietors whose investment and turnover fall in the micro or small category (most individuals do). Registration is free, online, and takes about 10 minutes. It also strengthens claims on dues that were already pending when you registered.',
  },
  {
    q: 'How is the interest calculated?',
    a: 'Three times the RBI bank rate (currently 6.5%, so 19.5% per annum), compounded monthly, from the day after the due date. This generator uses the same formula courts apply: principal × ((1 + rate/12)^months − 1).',
  },
  {
    q: 'What if the company still does not pay?',
    a: 'File on the MSME Samadhaan portal (samadhaan.msme.gov.in) — free and fully online. Your claim goes to the MSME Facilitation Council, which can summon the buyer and award the principal plus interest. Most companies settle once a Samadhaan filing lands, because the Council process is binding and public.',
  },
  {
    q: 'Is this letter a substitute for a lawyer?',
    a: 'It is a statutory demand notice you can send yourself, and it works surprisingly often on its own. For very large amounts or a buyer already ignoring legal notices, involve a lawyer — the letter still forms your paper trail.',
  },
];

export default function MsmeDemandLetterPage() {
  return (
    <ToolShell
      title="MSME Payment Demand Letter Generator"
      intro="A brand sitting on your invoice for 60 days isn't a relationship problem — it's a Section 15 problem. Generate a formal demand notice with the compound interest a buyer legally owes an MSME-registered supplier, calculated to the rupee. Free, no signup."
      faqs={faqs}
    >
      <MsmeDemandLetterTool />
    </ToolShell>
  );
}
