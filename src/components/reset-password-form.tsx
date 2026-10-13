'use client';

import { useEffect, useState } from 'react';
import Logo from './logo';
import Link from 'next/link';
import { m } from 'motion/react';
import { useMutation } from '@tanstack/react-query';
import { fadeUp } from './ui';

export default function ResetPasswordForm() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    if (t) setToken(t);
  }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      return json;
    },
    onSuccess: () => setDone(true),
    onError: (e: Error) => setError(e.message),
  });

  if (done) {
    return (
      <div className="auth-screen">
        <m.div className="auth-card" {...fadeUp}>
          <div className="auth-brand">
            <Logo size={30} />
            <span className="brand-name">DealFlow</span>
          </div>
          <h1>Password updated</h1>
          <p className="auth-sub">You can sign in with your new password now.</p>
          <Link href="/login" className="btn primary btn-block">Go to sign in</Link>
        </m.div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <m.div className="auth-card" {...fadeUp}>
        <Link href="/" className="auth-brand">
          <Logo size={30} />
          <span className="brand-name">DealFlow</span>
        </Link>

        <h1>Choose a new password</h1>
        <p className="auth-sub">Reset links expire after 30 minutes and work once.</p>

        {!token && (
          <div className="notice">
            This link looks incomplete. Request a fresh reset link and try again.
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate();
          }}
        >
          <label className="field">
            <label>New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <div className="hint">At least 8 characters, with a letter and a number.</div>
          </label>

          {error && <div className="notice">{error}</div>}

          <button type="submit" className="btn primary btn-block" disabled={!token || mutation.isPending}>
            {mutation.isPending ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <div className="auth-switch">
          <Link href="/login" className="linklike">Back to sign in</Link>
        </div>
      </m.div>
    </div>
  );
}
