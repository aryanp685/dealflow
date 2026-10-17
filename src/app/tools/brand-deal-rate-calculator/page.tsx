import type { Metadata } from 'next';
import ToolShell from '@/components/tool-shell';
import RateCalculatorTool from './tool';

export const metadata: Metadata = {
  title: 'Brand Deal Rate Calculator for Indian Creators',
  description:
    'What should you charge for a reel, story or YouTube integration? Free rate calculator for Indian creators — with engagement multipliers, exclusivity and usage-rights pricing, and the full formula shown.',
  keywords: ['brand deal rate calculator', 'how much to charge for a reel', 'influencer pricing India', 'sponsored post rates', 'creator rate card'],
  alternates: { canonical: '/tools/brand-deal-rate-calculator' },
  openGraph: {
    title: 'Brand Deal Rate Calculator for Indian Creators',
    description: 'What should you charge for a reel, story or YouTube integration? Free rate calculator for Indian creators — with engagement multipliers, exclusivity and usage-rights pricing, and the full formula shown.',
    url: '/tools/brand-deal-rate-calculator',
    siteName: 'DealFlow',
    type: 'website',
    locale: 'en_IN',
    images: ['/og-rate-calc.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brand Deal Rate Calculator for Indian Creators',
    description: 'What should you charge for a reel, story or YouTube integration? Free rate calculator for Indian creators — with engagement multipliers, exclusivity and usage-rights pricing, and the full formula shown.',
    images: ['/og-rate-calc.png'],
  },
};

const faqs = [
  {
    q: 'How accurate is this rate calculator?',
    a: 'It gives you a defensible starting range based on the Indian market: a per-1000-follower base by platform, a multiplier for the deliverable, an engagement adjustment, and add-ons for exclusivity and paid usage. Niche moves the number more than follower count does — finance and tech audiences command multiples of lifestyle ones.',
  },
  {
    q: 'Should I charge extra for exclusivity and usage rights?',
    a: 'Always. Exclusivity (no competing brands for a period) typically adds 20–40%. Paid usage rights — the brand running your content as an ad — adds 25–50%, because you are selling media, not a post. Never give either away free.',
  },
  {
    q: 'What if the brand offers barter?',
    a: 'Barter is payment in a product you did not choose, at MRP you will never realise. A useful rule: accept barter only up to 20–30% of your cash rate, and remember a ₹30,000 product received as barter can still be taxable income under section 194R.',
  },
  {
    q: 'Does this store my numbers?',
    a: 'No — the calculator runs entirely in your browser. DealFlow, the app behind this page, is what tracks the deals you win: pipeline, invoices, follow-ups and the money brands still owe you.',
  },
];

export default function RateCalculatorPage() {
  return (
    <ToolShell
      title="Brand Deal Rate Calculator"
      intro="“What’s your rate?” — the question that decides whether you eat this month or not. Get a defensible range for reels, stories and integrations, with the formula shown so you can hold your ground when they negotiate."
      faqs={faqs}
    >
      <RateCalculatorTool />
    </ToolShell>
  );
}
