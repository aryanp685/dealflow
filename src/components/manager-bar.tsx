'use client';

import { m } from 'motion/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { listItem } from './ui';
import type { ManagerInfo } from './manager-team';

export async function fetchManagerInfo(): Promise<ManagerInfo> {
  const res = await fetch('/api/manager/links');
  if (!res.ok) throw new Error('Could not load team info');
  return res.json();
}

export default function ManagerBar({ notify }: { notify: (msg: string, tone?: 'ok' | 'err') => void }) {
  const ctx = useQuery({ queryKey: ['manager'], queryFn: fetchManagerInfo, staleTime: 60_000, retry: false });
  const sw = useMutation({
    mutationFn: async (creatorId: number | null) => {
      const res = await fetch('/api/manager/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creator_id: creatorId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Could not switch accounts');
    },
    onSuccess: () => window.location.reload(),
    onError: (e) => notify((e as Error).message, 'err'),
  });

  if (ctx.isLoading || ctx.isError) return null;
  const info = ctx.data;
  if (!info || (info.managing.length === 0 && !info.acting_as)) return null;

  return (
    <m.div
      className={`notice ${info.acting_as ? '' : 'ok'}`}
      variants={listItem}
      style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
    >
      <span style={{ flex: '1 1 220px' }}>
        {info.acting_as
          ? `👥 Viewing ${info.acting_as.name}'s account — every tab shows their data.`
          : `👥 Manager mode — ${info.managing.length} creator${info.managing.length === 1 ? '' : 's'} linked. Switch accounts:`}
      </span>
      <select
        value={info.acting_as?.id ?? ''}
        disabled={sw.isPending}
        onChange={(e) => sw.mutate(e.target.value === '' ? null : Number(e.target.value))}
        style={{ maxWidth: 240 }}
        aria-label="Switch account"
      >
        <option value="">{info.me.name} (you)</option>
        {info.managing.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </m.div>
  );
}
