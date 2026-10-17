'use client';

import { useState } from 'react';
import { m } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listItem } from './ui';

export default function UpiSettings({ notify }: { notify: (msg: string, tone?: 'ok' | 'err') => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<{ upi_id: string | null }> => {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Could not load payout settings');
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
  const save = useMutation({
    mutationFn: async (upiId: string) => {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ upi_id: upiId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Could not save UPI ID');
      return j;
    },
    onSuccess: () => {
      notify('UPI ID saved — payment reminders now carry a pay link', 'ok');
      setDraft(null);
      qc.invalidateQueries();
    },
    onError: (e) => notify((e as Error).message, 'err'),
  });
  if (profile.isLoading || profile.isError) return null;
  const current = profile.data?.upi_id ?? null;
  const value = draft ?? current ?? '';
  return (
    <m.div className="card" variants={listItem} style={{ marginBottom: 16 }}>
      <h3 className="card-title">UPI payouts</h3>
      <p className="card-sub">
        {current
          ? `Payment reminders carry a one-tap pay link to ${current}. Change it anytime.`
          : 'Add your UPI ID and every payment reminder gets a one-tap pay link — brands pay without asking for bank details.'}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="field" style={{ flex: '1 1 220px', marginBottom: 0 }}>
          <label>Your UPI ID</label>
          <input
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="name@okhdfc"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button
          className="btn primary"
          style={{ alignSelf: 'flex-end' }}
          disabled={save.isPending || value.trim() === (current ?? '')}
          onClick={() => save.mutate(value.trim())}
        >
          {save.isPending ? 'Saving…' : current ? 'Update' : 'Save'}
        </button>
      </div>
    </m.div>
  );
}
