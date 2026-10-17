'use client';

import { useState } from 'react';
import { m } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listItem } from './ui';
import { fetchManagerInfo } from './manager-bar';

export type ManagerInfo = {
  me: { id: number; name: string; email: string };
  acting_as: { id: number; name: string; email: string } | null;
  managing: { id: number; name: string; email: string }[];
  managers: { id: number; name: string; email: string }[];
};

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? 'Request failed');
  return j;
}

export default function ManagerTeam({ notify }: { notify: (msg: string, tone?: 'ok' | 'err') => void }) {
  const qc = useQueryClient();
  const ctx = useQuery({ queryKey: ['manager'], queryFn: fetchManagerInfo, staleTime: 60_000, retry: false });
  const [code, setCode] = useState<{ code: string; expires_in_min: number } | null>(null);
  const [redeemInput, setRedeemInput] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['manager'] });

  const genCode = useMutation({
    mutationFn: async () => postJson('/api/manager/code', {}),
    onSuccess: (j) => {
      setCode({ code: j.code, expires_in_min: j.expires_in_min });
      refresh();
    },
    onError: (e) => notify((e as Error).message, 'err'),
  });

  const redeem = useMutation({
    mutationFn: async (input: string) => postJson('/api/manager/redeem', { code: input }),
    onSuccess: (j) => {
      notify(j.creator ? `Linked — you can now view ${j.creator.name}'s account` : 'Linked', 'ok');
      setRedeemInput('');
      refresh();
    },
    onError: (e) => notify((e as Error).message, 'err'),
  });

  const unlink = useMutation({
    mutationFn: async (creatorId: number) => {
      const res = await fetch('/api/manager/links', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creator_id: creatorId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Could not remove');
      return j;
    },
    onSuccess: () => {
      notify('Access removed', 'ok');
      refresh();
    },
    onError: (e) => notify((e as Error).message, 'err'),
  });

  if (ctx.isLoading) return <div className="empty">Loading team…</div>;
  if (ctx.isError || !ctx.data) return <div className="empty">Could not load team info.</div>;
  const info = ctx.data;

  return (
    <>
      {info.acting_as && (
        <m.div className="notice" variants={listItem}>
          You are viewing {info.acting_as.name} — switch back to yourself from the bar above to manage access.
        </m.div>
      )}

      <m.div className="card" variants={listItem}>
        <h3 className="card-title">Give a manager access to your account</h3>
        <p className="card-sub">
          Your manager sees your deals, invoices and follow-ups exactly as you do, and can act on them. Generate a
          pairing code and share it — it expires in 15 minutes and works once.
        </p>
        {code ? (
          <div className="money-preview" style={{ marginBottom: 12 }}>
            <div className="line total net"><span>Pairing code</span><span style={{ fontSize: 20, letterSpacing: 4 }}>{code.code}</span></div>
            <div className="line"><span>Expires in</span><span>{code.expires_in_min} minutes · single use</span></div>
          </div>
        ) : null}
        <button
          className="btn primary"
          disabled={genCode.isPending || !!info.acting_as}
          onClick={() => genCode.mutate()}
          title={info.acting_as ? 'Switch back to yourself first' : undefined}
        >
          {genCode.isPending ? 'Generating…' : code ? 'Generate a new code' : 'Generate pairing code'}
        </button>
      </m.div>

      <m.div className="card" variants={listItem}>
        <h3 className="card-title">Manage a creator</h3>
        <p className="card-sub">Enter the 6-character pairing code the creator shared with you.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="field" style={{ flex: '1 1 200px', marginBottom: 0 }}>
            <label>Pairing code</label>
            <input
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
              placeholder="K7Q2MD"
              autoComplete="off"
              spellCheck={false}
              maxLength={6}
              style={{ textTransform: 'uppercase', letterSpacing: 2 }}
            />
          </label>
          <button
            className="btn primary"
            style={{ alignSelf: 'flex-end' }}
            disabled={redeem.isPending || redeemInput.trim().length === 0}
            onClick={() => redeem.mutate(redeemInput.trim())}
          >
            {redeem.isPending ? 'Linking…' : 'Link account'}
          </button>
        </div>
      </m.div>

      {info.managing.length > 0 && (
        <m.div className="card" variants={listItem}>
          <h3 className="card-title">Creators you manage</h3>
          <div className="stat-list">
            {info.managing.map((c) => (
              <div className="stat-line" key={c.id}>
                <span><strong>{c.name}</strong> <span className="t-muted">· {c.email}</span></span>
                <span>
                  <button className="btn sm danger" disabled={unlink.isPending} onClick={() => unlink.mutate(c.id)}>
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        </m.div>
      )}

      {info.managers.length > 0 && (
        <m.div className="card" variants={listItem}>
          <h3 className="card-title">People with access to your account</h3>
          <div className="stat-list">
            {info.managers.map((mng) => (
              <div className="stat-line" key={mng.id}>
                <span><strong>{mng.name}</strong> <span className="t-muted">· {mng.email}</span></span>
                <span>
                  <button className="btn sm danger" disabled={unlink.isPending} onClick={() => unlink.mutate(mng.id)}>
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        </m.div>
      )}
    </>
  );
}
