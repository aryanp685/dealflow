import type { Metadata } from 'next';
import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import LandingMotion, { Reveal } from '@/components/landing-motion';
import TourShots from '@/components/tour-shots';
import NavAuth from '@/components/nav-auth';
import Logo from '@/components/logo';
import Image from 'next/image';
import overviewShot from '../assets/shots/overview.png';
import dealsShot from '../assets/shots/deals.png';
import followupsShot from '../assets/shots/followups.png';
import { faqs } from '@/lib/content';
import MobileNav from '@/components/mobile-nav';

export const metadata: Metadata = {
  title: 'DealFlow — get every brand deal paid',
  description:
    'DealFlow tracks every brand deal from first DM to money in your account — deadlines, invoices, GST/TDS splits, and the exact follow-up to send when a brand goes quiet. Past 30 days it writes the MSME Section 15 demand notice for you. Yearly plan is one UPI payment: ₹2,990.',
  keywords: [
    'brand deal tracker', 'creator invoice tracker', 'influencer payment tracker',
    'MSME demand notice generator', 'freelancer payment follow up', 'overdue invoice reminder India',
  ],
  openGraph: {
    title: 'DealFlow — get every brand deal paid',
    description: 'Track deals, chase overdue payments, and send MSME Section 15 demand notices. ₹2,990/year — one UPI payment, no auto-debit.',
    type: 'website',
  },
};

export default function LandingPage() {
  return (
    <div className="landing">
      <LandingMotion>
        <header className="land-nav">
          <Link href="/" className="brand">
            <Logo size={30} />
            <span className="brand-name">DealFlow</span>
          </Link>
          <nav className="land-links">
            <a href="#problem">The problem</a>
            <a href="#features">Features</a>
            <a href="#tools">Free tools</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="land-cta">
            <NavAuth />
          </div>
          <MobileNav />
        </header>
        <section className="hero">
          <Reveal y={14}>
            <div className="hero-badge">
              Built for Indian creators · MSME demand notices · one UPI payment, no auto-debit
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h1>
              How much of your money is<br />
              <span className="grad">stuck with brands right now?</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="hero-sub">
              If the answer is &ldquo;I don&apos;t know&rdquo; — that&apos;s exactly the problem. DealFlow tracks every brand deal
              from the first DM to the money landing in your account: deadlines, invoices, TDS splits, and the exact
              message to send when a brand goes quiet. Past 30 days it stops nudging and writes the demand notice.
            </p>
            <div className="hero-cta">
              <Link href="/signup" className="btn primary lg">Start free — see your stuck money</Link>
              <Link href="/demo" className="btn lg">View live demo</Link>
              <a href="#features" className="btn lg">See how it works</a>
            </div>
            <div className="hero-proof">
              <span>No credit card</span>
              <span className="dot-sep" />
              <span>Bank details never asked</span>
              <span className="dot-sep" />
              <span>Export your data anytime</span>
            </div>
          </Reveal>
        </section>

        <section id="problem" className="land-section">
          <div className="section-head">
            <h2>The money you&apos;re not collecting</h2>
            <p>
              Creators lose more to forgotten follow-ups than to bad rates. The pattern is always the same.
            </p>
          </div>

          <div className="pain-grid">
            <Reveal><div className="pain-card">
              <div className="pain-num">{formatMoney(48600)}</div>
              <div className="pain-label">sitting in one overdue invoice</div>
              <div className="pain-body">
                Delivered 3 weeks ago. Invoice sent. Nobody replied. You felt awkward chasing, so you didn&apos;t.
              </div>
            </div></Reveal>
            <Reveal delay={0.08}><div className="pain-card">
              <div className="pain-num">71 days</div>
              <div className="pain-label">average brand payment cycle</div>
              <div className="pain-body">
                Agencies pay creators slowly while their own clients pay them slower. Politeness doesn&apos;t fix a
                credit cycle — escalation does.
              </div>
            </div></Reveal>
            <Reveal delay={0.16}><div className="pain-card">
              <div className="pain-num">₹0</div>
              <div className="pain-label">from tools built for brands</div>
              <div className="pain-body">
                Upfluence, CreatorIQ and Traackr start around $400–800/month and are built for brands managing creator
                rosters. Nothing was built for <em>you</em> managing your own deals.
              </div>
            </div></Reveal>
          </div>
        </section>

        <section id="features" className="land-section">
          <div className="section-head">
            <h2>The whole deal lifecycle — not just the invoice</h2>
            <p>
              Invoicing is free (Zoho does it well). What no free tool does: the pipeline, the chase, and the legal
              teeth. Freelancers, photographers and wedding vendors — same tool, swap &ldquo;brand&rdquo; for
              &ldquo;client&rdquo;.
            </p>
          </div>

          <div className="feature-grid">
            {[
              ['🧭', 'First DM to money in account', "Every deal moves through one pipeline: negotiating → agreed → delivering → invoiced → paid. At a glance you know what's stuck where, what's due this week, and exactly how much money is sitting outside your bank."],
              ['🚨', 'Overdue money escalates itself', "Day 7: a polite nudge. Day 21: a firm email citing your MSME rights. Day 30+: a formal demand notice with the compound interest a brand legally owes under Section 15 of the MSMED Act — calculated to the rupee, ready to send. No other tool does this. Anywhere."],
              ['🕵️', 'Know the brand before you say yes', "Log a deal and DealFlow tells you what this brand did last time: paid in 71 days on average, went overdue once. That's your cue to ask for a 50% advance — before the work starts, not after."],
              ['💸', 'You receive ₹48,600, not ₹45,000', "Live GST and TDS split as you type. Handles 194J at 10%, 194H at 5%, 194O at 2%, and the 20% they charge when your PAN isn't on file. No more quoting a number and then being surprised at payout."],
              ['💬', 'One-tap WhatsApp follow-ups', "Every reminder opens WhatsApp with the message already written — from your number, which is exactly why it gets answered. Invoice number, amount, due date: filled in, nothing to edit."],
              ['🧾', 'Invoices: included, not the point', "GST invoice data, TDS split, and a CSV your CA will accept. Already on Zoho or Tally? Keep it — one click exports a Zoho-ready invoice file. DealFlow tracks what happens before the invoice and after it goes unpaid."],
            ].map(([icon, title, body], i) => (
              <Reveal key={title} delay={i * 0.06}>
                <Feature icon={icon} title={title} body={body} />
              </Reveal>
            ))}
          </div>
        </section>

        <section className="land-section">
          <div className="section-head">
            <h2>How it works</h2>
            <p>Three steps, and the second one is the one that pays for itself.</p>
          </div>
          <div className="steps">
            {[
              ['01', 'Log the deal', 'Brand, deliverable, amount, payment terms, TDS. Twenty seconds — and if this brand paid late before, you hear it now.'],
              ['02', 'Get told what to chase', 'Every morning DealFlow lists what needs action — late deliverables, unsent invoices, overdue payments — with the message already written.'],
              ['03', 'Get paid', 'One tap opens WhatsApp. Past 30 days, send the Section 15 demand notice. Still nothing? File free on MSME Samadhaan — the app walks you through it.'],
            ].map(([n, title, body], i) => (
              <Reveal key={n} delay={i * 0.08}>
                <div className="step">
                  <div className="step-num">{n}</div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="land-section" id="tour">
          <div className="section-head">
            <h2>The whole business of brand deals, on one screen</h2>
            <p>Real product, real numbers — this is what you get the moment you sign in.</p>
          </div>
          <Reveal>
            <TourShots
              shots={[
                {
                  src: overviewShot.src,
                  title: 'Overview',
                  caption: 'Every stuck rupee, every overdue invoice, every collected total — at a glance.',
                  alt: 'DealFlow overview: money stuck, overdue, collected and pipeline totals with invoice ageing',
                },
                {
                  src: dealsShot.src,
                  title: 'Deals',
                  caption: 'Brand, stage, payment status, deadline and what you actually receive — after GST and TDS.',
                  alt: 'DealFlow deals table with stage, payment status, deadline, value and net receivable per brand deal',
                },
                {
                  src: followupsShot.src,
                  title: 'Follow-ups',
                  caption: 'The follow-up message is already written — copy it, send it, get paid.',
                  alt: 'DealFlow follow-ups tab with a ready-to-send invoice reminder for a brand',
                },
              ]}
            />
          </Reveal>
        </section>

        <section className="land-section" id="tools">
          <div className="section-head">
            <h2>Free tools — no signup, no card</h2>
            <p>The things creators Google at 2am. Free forever; the app is what remembers everything for you.</p>
          </div>
          <div className="tools-grid">
            <Reveal delay={0}><ToolLink href="/tools/msme-demand-letter" icon="⚖️" title="MSME Demand Letter Generator" body="Section 15 notice with compound interest worked out. Print or copy in 30 seconds." /></Reveal>
            <Reveal delay={0.06}><ToolLink href="/tools/tds-calculator" icon="🧮" title="TDS Calculator for Creators" body="194J, 194H, 194O — what actually lands in your account after GST and TDS." /></Reveal>
            <Reveal delay={0.12}><ToolLink href="/tools/gst-invoice-generator" icon="🧾" title="GST Invoice Generator" body="A clean, print-ready GST invoice. No account needed." /></Reveal>
            <Reveal delay={0.18}><ToolLink href="/tools/brand-deal-rate-calculator" icon="📈" title="Brand Deal Rate Calculator" body="Followers and views in, a defensible quote out — with the formula shown." /></Reveal>
          </div>
        </section>

        <section id="pricing" className="land-section">
          <div className="section-head">
            <h2>One payment. No mandate. No auto-debit.</h2>
            <p>
              Monthly subscriptions in India live and die by UPI mandates — and mandate setup fails for half of all
              users. So every plan is simply one payment — {formatMoney(2990)} for 12 months, {formatMoney(699)} for 3,
              or {formatMoney(299)} monthly. Renewal is a link we email you, never a silent debit.
            </p>
          </div>

          <div className="pricing-grid">
            <Reveal delay={0}><PriceCard
              name="Free" amount="₹0" per=" forever"
              note="Try it properly"
              features={['3 active deals', 'Deadline + invoice tracking', 'Follow-up messages', 'CSV export']}
              cta="Start free" href="/signup"
            /></Reveal>
            <Reveal delay={0.08}><PriceCard
              name="Creator" amount={formatMoney(2990)} per="/year" savePct={17}
              note="≈ ₹249/mo — best value" popular
              alts={[`${formatMoney(699)} / 3 months — save 22%`, `${formatMoney(299)} / month`]}
              features={[
                'Unlimited deals',
                'Full follow-up ladder up to the MSME demand notice',
                'One-tap WhatsApp sending',
                'Invoice ageing + GST/TDS split',
                'UPI payment links',
                'Zoho-ready invoice export',
              ]}
              cta="Pay once for the year" href="/signup"
            /></Reveal>
            <Reveal delay={0.16}><PriceCard
              name="Pro" amount={formatMoney(7990)} per="/year" savePct={17}
              note="≈ ₹666/mo — best value"
              alts={[`${formatMoney(1999)} / 3 months — save 17%`, `${formatMoney(799)} / month`]}
              features={['Everything in Creator', 'Priority support — replies within 24 hours', 'Early access to new features + roadmap votes', 'Team workspaces & CA reports (coming soon — Pro members first)']}
              cta="Pay once for the year" href="/signup"
            /></Reveal>
          </div>
          <p className="pricing-ppp">
            Outside India? The same plans at $90/year, $21/quarter or $9/month — purchasing power parity, not a conversion rate.
          </p>

          <Reveal><div className="lifetime">
            <div>
              <div className="lifetime-title">Lifetime deal — first 50 customers</div>
              <p>
                <strong>{formatMoney(7499)} / $149 one-time.</strong> Everything in Pro, forever. When 50 are gone,
                they&apos;re gone.
              </p>
            </div>
            <Link href="/signup" className="btn primary lg">Claim lifetime access</Link>
          </div></Reveal>
        </section>

        <section className="land-section" id="trust">
          <div className="section-head">
            <h2>Why you can trust this with your money data</h2>
          </div>
          <div className="feature-grid">
            <Reveal delay={0}><Feature
              icon="🔒"
              title="We never ask for bank details"
              body="DealFlow is not a payment processor. No bank account, no UPI PIN, no card number — ever. Brands pay you directly; we only record that it happened."
            /></Reveal>
            <Reveal delay={0.06}><Feature
              icon="📤"
              title="Your data, your exit"
              body="One click exports everything — every deal, every rupee, the full GST/TDS split — as CSV or a Zoho-ready file. Cancel and walk away with your data whenever you want."
            /></Reveal>
            <Reveal delay={0.12}><Feature
              icon="🧑‍💻"
              title="Built in public, by a real person"
              body="DealFlow is built by a solo developer in India who got tired of watching creator friends lose money to silence. Real identity, real support inbox, and a privacy page written in plain language — not legalese."
            /></Reveal>
          </div>
        </section>

        <section className="land-section">
          <div className="section-head">
            <h2>Questions creators actually ask</h2>
          </div>
          <Reveal><div className="faq">
              {faqs.map((f) => (
                <Faq key={f.q} q={f.q} a={f.a} />
              ))}
            </div></Reveal>
        </section>

        <section className="final-cta">
          <h2>One overdue invoice pays for three years of DealFlow.</h2>
          <p>Start free. Log the deal that&apos;s sitting unpaid right now and see what it says.</p>
          <Link href="/signup" className="btn primary lg">Start free — no card needed</Link>
        </section>
      </LandingMotion>

      <footer className="land-footer">
        <div>
          <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 8 }}><Logo size={20} rounded={6} /></span>DealFlow — built for creators who keep getting paid late.
        </div>
        <div className="land-footer-links">
          <Link href="/tools/msme-demand-letter">Free tools</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/signup">Create account</Link>
          <a href="#pricing">Pricing</a>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function ToolLink({ href, icon, title, body }: { href: string; icon: string; title: string; body: string }) {
  return (
    <Link href={href} className="tool-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      <span className="tool-go">Open free →</span>
    </Link>
  );
}

function PriceCard({
  name, amount, per, note, features, cta, href, popular, alts, savePct,
}: {
  name: string; amount: string; per: string; note: string;
  features: string[]; cta: string; href: string; popular?: boolean;
  alts?: string[]; savePct?: number;
}) {
  return (
    <div className={`card pricing-card ${popular ? 'popular' : ''}`}>
      <div className="pricing-head">
        <h3 className="card-title">{name}</h3>
        {popular && <span className="pill p-purple">Most popular</span>}
      </div>
      <div className="card-sub">{note}</div>
      <div className="pricing-amount">
        {amount}<span className="per">{per}</span>
        {savePct ? <span className="pill p-green save-pill">Save {savePct}%</span> : null}
      </div>
      <div className="t-muted dim" style={{ marginBottom: alts ? 8 : 16 }}>one payment · no auto-debit</div>
      {alts && (
        <div className="price-alts">
          {alts.map((a) => <div key={a}>{a}</div>)}
        </div>
      )}
      <ul className="pricing-features">
        {features.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <Link href={href} className={`btn ${popular ? 'primary' : ''} btn-block`}>{cta}</Link>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="faq-item">
      <summary>{q}</summary>
      <p>{a}</p>
    </details>
  );
}
