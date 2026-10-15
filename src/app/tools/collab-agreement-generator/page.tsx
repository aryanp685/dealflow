import type { Metadata } from 'next';
import ToolShell from '@/components/tool-shell';
import CollabAgreementTool from './tool';

export const metadata: Metadata = {
  title: 'Brand Collaboration Agreement Generator for Creators (free)',
  description:
    'Generate a short-form brand collab agreement in 60 seconds — fee, advance, revisions, usage rights and exclusivity, written in plain English. Free, no signup.',
  keywords: ['brand collaboration agreement', 'influencer agreement template India', 'creator contract generator', 'collab agreement format', 'usage rights exclusivity clause'],
  alternates: { canonical: '/tools/collab-agreement-generator' },
};

const faqs = [
  {
    q: 'Is a WhatsApp or email "Agreed" legally valid?',
    a: 'Yes. Under the Information Technology Act, 2000, contracts formed electronically — including an email or WhatsApp reply saying "Agreed" to written terms — are enforceable. What matters is that the terms were written down and both sides accepted them. That is exactly what this generator produces: clear written terms you can send before any work begins.',
  },
  {
    q: 'Which usage rights should I never give away free?',
    a: 'Paid usage — ads, whitelisting and boosting. A brand running your face as their ad creative is worth far more than an organic post, and it should always carry a time limit plus a separate fee. Organic reposting with credit is the only right most creators give away free.',
  },
  {
    q: 'What advance percentage is standard?',
    a: '50% before work begins is the creator-market standard in India, with the balance due within 7–15 days of going live. If a brand refuses any advance on a first collaboration, treat it as a red flag, not a norm.',
  },
  {
    q: 'Is this a substitute for a lawyer?',
    a: 'For standard deliverable-based collabs it covers every clause creators actually fight about — fee, revisions, usage, exclusivity, cancellation. For large retainers, long exclusivity windows or heavy whitelisting deals, get a lawyer to review it. Even then, starting from this draft saves you most of the fee.',
  },
];

export default function CollabAgreementPage() {
  return (
    <ToolShell
      title="Brand Collaboration Agreement Generator"
      intro="Most creator-brand fights are not about money — they are about things nobody wrote down. Usage windows, revision rounds, exclusivity. Answer a few questions and get a short-form agreement in plain English that covers all of them. Free, no signup."
      faqs={faqs}
    >
      <CollabAgreementTool />
    </ToolShell>
  );
}
