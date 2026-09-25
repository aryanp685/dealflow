'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// The landing stays a static Server Component; only this nav fragment checks
// the session in the browser so a signed-in visitor gets a direct link.
export default function NavAuth() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAuthed(Boolean(d?.user)))
      .catch(() => setAuthed(false));
  }, []);

  if (authed) return <Link href="/app" className="btn primary">Open your dashboard</Link>;
  return (
    <>
      <Link href="/login" className="btn ghost">Sign in</Link>
      <Link href="/signup" className="btn primary">Start free</Link>
    </>
  );
}
