import type { Metadata } from 'next';
import AuthForm from '@/components/auth-form';

export const metadata: Metadata = {
  title: 'Create your account — DealFlow',
  description: 'Free forever for 3 active deals. Track brand deals, invoices and chase overdue payments.',
};

const PLANS = ['creator', 'pro'] as const;
const BILLINGS = ['monthly', 'quarterly', 'yearly', 'lifetime'] as const;

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const plan = typeof q.plan === 'string' && (PLANS as readonly string[]).includes(q.plan) ? q.plan : null;
  const billing =
    typeof q.billing === 'string' && (BILLINGS as readonly string[]).includes(q.billing) ? q.billing : null;
  const nextPath = plan
    ? `/app?tab=pricing&plan=${plan}${billing ? `&billing=${billing}` : ''}`
    : '/app';
  return <AuthForm initialMode="signup" nextPath={nextPath} />;
}
