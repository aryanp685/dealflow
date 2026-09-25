import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="error-screen">
      <div className="error-card">
        <div className="error-icon">🧭</div>
        <h1>This page doesn&apos;t exist</h1>
        <p>The link may be old, or the page may have moved.</p>
        <div className="error-actions">
          <Link href="/app" className="btn primary">Back to your deals</Link>
          <Link href="/" className="btn">Go to homepage</Link>
        </div>
      </div>
    </div>
  );
}
