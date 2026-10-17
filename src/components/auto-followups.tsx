'use client';

import { m } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listItem } from './ui';

type Profile = { upi_id: string | null; auto_followups: number };

export default function AutoFollowups({ notify }: { notify: (msg: string, tone?: 'ok' | 'err') => void }) {
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<Profile> => {
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Could not load settings');
      return res.json();
    },
    staleTime: 60_000,
    retry: false,
  });
  const toggle = useMutation({
    mutationFn: async (on: boolean) => {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ auto_followups: on }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Could not update setting');
      return j;
    },
    onSuccess: (_, on) => {
      notify(on ? 'Auto follow-ups on — gentle nudges will email brands daily' : 'Auto follow-ups off', 'ok');
      qc.invalidateQueries();
    },
    onError: (e) => notify((e as Error).message, 'err'),
  });

  if (profile.isLoading || profile.isError) return null;
  const on = (profile.data?.auto_followups ?? 0) === 1;

  return (
    <m.div className="card" variants={listItem} style={{ marginBottom: 16 }}>
      <h3 className="card-title">✈️ Auto follow-ups {on ? '(on)' : '(off)'}</h3>
      <p className="card-sub">
        {on
          ? 'Every morning, gentle payment nudges email themselves to brands that shared an address — each reminder only once, replies landing in your inbox.'
          : 'Switch this on and gentle payment nudges email themselves every morning — only to brands with an email on file, each reminder only once.'}{' '}
        Final notices and legal threats always stay manual.
      </p>
      <button
        className={`btn ${on ? '' : 'primary'}`}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(!on)}
      >
        {toggle.isPending ? 'Saving…' : on ? 'Turn off' : 'Turn on'}
      </button>
    </m.div>
  );
}
