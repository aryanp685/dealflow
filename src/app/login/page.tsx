import type { Metadata } from 'next';
import AuthForm from '@/components/auth-form';

export const metadata: Metadata = {
  title: 'Sign in — DealFlow',
  description: 'Sign in to track your brand deals, invoices and overdue payments.',
};

export default function LoginPage() {
  return <AuthForm initialMode="login" />;
}
