import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/components/logo';

export const metadata: Metadata = {
  title: 'Privacy, in plain language',
  description: 'What DealFlow stores, what it never asks for, and how to take your data and leave.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="landing">
      <header className="land-nav">
        <Link href="/" className="brand">
          <Logo size={30} />
          <span className="brand-name">DealFlow</span>
        </Link>
        <div className="land-cta">
          <Link href="/" className="btn sm">← Back home</Link>
        </div>
      </header>

      <main className="land-section" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="section-head">
          <h1 style={{ fontSize: 30 }}>Privacy, in plain language</h1>
          <p>No legalese. If a sentence here confuses you, that&apos;s our bug — email us and we&apos;ll fix it.</p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="card-title">What we never ask for</h3>
          <p className="card-sub">
            Bank account numbers, UPI PINs, card numbers, Aadhaar, PAN copies. DealFlow is not a payment processor —
            brands pay you directly and you simply mark the deal as paid. If anyone claiming to be DealFlow ever asks
            you for these, it is not us.
          </p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="card-title">What we store</h3>
          <p className="card-sub">
            Your name, email and a password hash (never the password itself). The deals you log: brand names, deal
            values, dates, contacts and notes. Your plan and payment history (the payment ID and amount — the card or
            UPI details stay with Razorpay/Stripe, we never see them).
          </p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="card-title">What we do with it</h3>
          <p className="card-sub">
            Run the product: reminders, digests, invoices, exports. Emails go out only for things you&rsquo;re waiting
            for — your daily follow-up digest and plan renewal notices. We do not sell data, we do not run ad
            trackers, and we do not share your brands or amounts with anyone. Ever.
          </p>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="card-title">Taking your data and leaving</h3>
          <p className="card-sub">
            The <strong>Export CSV</strong> button in the app downloads everything — every deal, the full GST/TDS
            split — at any time, on any plan, including Free. Want your account deleted with all its data? Email us
            and it&apos;s done within 7 days, no questions and no win-back emails.
          </p>
        </div>

        <div className="card">
          <h3 className="card-title">Where your data lives</h3>
          <p className="card-sub">
            On Supabase (Postgres) and Vercel — the same infrastructure used by serious production apps, with
            encryption in transit and at rest. Access is limited to the founder; there is no team to leak it to.
          </p>
        </div>
      </main>

      <footer className="land-footer">
        <div><span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 8 }}><Logo size={20} rounded={6} /></span>DealFlow</div>
        <div className="land-footer-links">
          <Link href="/">Home</Link>
          <Link href="/signup">Create account</Link>
        </div>
      </footer>
    </div>
  );
}
