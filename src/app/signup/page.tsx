import type { Metadata } from 'next';
import AuthForm from '@/components/auth-form';

export const metadata: Metadata = {
  title: 'Create your account — DealFlow',
  description: 'Free forever for 3 active deals. Track brand deals, invoices and chase overdue payments.',
};

export default function SignupPage() {
  return <AuthForm initialMode="signup" />;
}
