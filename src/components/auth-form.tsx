'use client';

import { useState } from 'react';
import Link from 'next/link';
import { m } from 'motion/react';
import { useMutation } from '@tanstack/react-query';
import { fadeUp } from './ui';
import Logo from './logo';

type Mode = 'login' | 'signup';

export default function AuthForm({ initialMode = 'login', nextPath = '/app' }: { initialMode?: Mode; nextPath?: string }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'signup' ? form : { email: form.email, password: form.password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      return json;
    },
    onSuccess: () => {
      window.location.assign(nextPath);
    },
    onError: (e: Error) => setError(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setResetMsg(null);
    setResetLink(null);
  };

  const forgotPassword = async () => {
    if (!form.email) {
      setError('Enter your email first, then click "Forgot password".');
      return;
    }
    setError(null);
    setResetMsg(null);
    setSendingReset(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Could not send the reset link');
      setResetMsg(json.message);
      if (json.dev_reset_url) setResetLink(json.dev_reset_url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div className="auth-screen">
      <m.div className="auth-card" {...fadeUp}>
        <Link href="/" className="auth-brand">
          <Logo size={32} />
          <span className="brand-name">DealFlow</span>
        </Link>

        <h1>{mode === 'login' ? 'Welcome back' : 'Start tracking your deals'}</h1>
        <p className="auth-sub">
          {mode === 'login'
            ? 'Sign in to see what you\'re owed.'
            : 'Free forever for 3 active deals. No card needed.'}
        </p>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <label className="field">
              <label>Your name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ananya Sharma"
                autoComplete="name"
                required
                minLength={2}
              />
            </label>
          )}

          <label className="field">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="field">
            <label>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'signup' ? 8 : 1}
            />
            {mode === 'signup' && (
              <div className="hint">At least 8 characters, with a letter and a number.</div>
            )}
          </label>

          {mode === 'login' && (
            <div className="field-row">
              <button
                type="button"
                className="linklike small"
                onClick={forgotPassword}
                disabled={sendingReset}
              >
                {sendingReset ? 'Sending…' : 'Forgot password?'}
              </button>
            </div>
          )}

          {error && <div className="notice">{error}</div>}
          {resetMsg && (
            <div className="notice ok">
              {resetMsg}
              {resetLink && (
                <>
                  <br />
                  <a href={resetLink} style={{ wordBreak: 'break-all' }}>Open the reset link (dev only)</a>
                </>
              )}
            </div>
          )}

          <button type="submit" className="btn primary btn-block" disabled={mutation.isPending}>
            {mutation.isPending ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create free account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button className="linklike" onClick={() => switchMode('signup')}>Create an account</button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button className="linklike" onClick={() => switchMode('login')}>Sign in</button>
            </>
          )}
        </div>
      </m.div>
    </div>
  );
}
