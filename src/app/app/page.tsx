import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { effectivePlan, getCurrentUser } from '@/lib/auth';
import AppShell from '@/components/app-shell';

export const metadata: Metadata = {
  title: 'Your deals',
  description: 'Track brand deals, deliverable deadlines, invoices and overdue payments.',
  robots: { index: false, follow: false },
};

// Reads the session cookie, so this can never be prerendered at build time.
export const dynamic = 'force-dynamic';

export default async function AppPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?reason=signin');

  return <AppShell userName={user.name} plan={effectivePlan(user)} />;
}
