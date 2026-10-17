import Link from 'next/link';
import Logo from './logo';

export default function ToolShell({
  title,
  intro,
  children,
  faqs,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
  faqs: { q: string; a: string }[];
}) {
  return (
    <div className="landing tool-page">
      <header className="land-nav no-print">
        <Link href="/" className="brand">
          <Logo size={30} />
          <span className="brand-name">DealFlow</span>
        </Link>
        <nav className="land-links">
          <a href="/#tools">All free tools</a>
          <a href="/#pricing">Pricing</a>
        </nav>
        <div className="land-cta">
          <Link href="/signup" className="btn sm primary">Start free</Link>
        </div>
      </header>

      <main className="tool-main">
        <div className="tool-head">
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>

        {children}

        <section className="tool-faq">
          <h2>FAQ</h2>
          {faqs.map((f) => (
            <details className="faq-item" key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        <section className="tool-cta no-print">
          <h2>Stop chasing payments from memory</h2>
          <p>
            This calculator forgets the moment you close the tab. DealFlow remembers every deal, writes the
            follow-ups, and past 30 days generates the MSME demand notice for you — free for your first 3 deals.
          </p>
          <Link href="/signup" className="btn primary lg">Start free — 3 deals</Link>
        </section>
      </main>

      <footer className="land-footer no-print">
        <div><span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 8 }}><Logo size={20} rounded={6} /></span>DealFlow — free tools for creators who keep getting paid late.</div>
        <div className="land-footer-links">
          <Link href="/">Home</Link>
          <Link href="/tools/tds-calculator">TDS calculator</Link>
          <Link href="/tools/gst-invoice-generator">GST invoice</Link>
          <Link href="/tools/brand-deal-rate-calculator">Rate calculator</Link>
          <Link href="/tools/msme-demand-letter">Demand letter</Link>
          <Link href="/tools/collab-agreement-generator">Agreement</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
