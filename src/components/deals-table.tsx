'use client';

import { useMemo, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { useMutation } from '@tanstack/react-query';
import { Pill, EmptyState, listItem, staggerParent } from './ui';
import { computeDealMoney, formatMoney, formatDate, daysUntil } from '@/lib/money';
import type { Deal } from '@/lib/db';
import type { DealStatus, PaymentStatus } from '@/lib/schemas';

const STATUS_LABEL: Record<DealStatus, string> = {
  negotiating: 'Negotiating', agreed: 'Agreed', delivering: 'Delivering',
  delivered: 'Delivered', invoiced: 'Invoiced', paid: 'Paid', cancelled: 'Cancelled',
};
const STATUS_TONE: Record<DealStatus, string> = {
  negotiating: 'grey', agreed: 'blue', delivering: 'purple',
  delivered: 'amber', invoiced: 'amber', paid: 'green', cancelled: 'grey',
};
const PAY_LABEL: Record<PaymentStatus, string> = {
  not_invoiced: 'Not invoiced', advance_paid: 'Advance paid', invoiced: 'Invoiced',
  overdue: 'Overdue', paid: 'Paid', cancelled: 'Cancelled',
};
const PAY_TONE: Record<PaymentStatus, string> = {
  not_invoiced: 'grey', advance_paid: 'blue', invoiced: 'amber',
  overdue: 'red', paid: 'green', cancelled: 'grey',
};

type Filter = 'all' | 'open' | 'overdue' | 'paid';

export default function DealsTable({
  deals,
  onNew,
  onEdit,
  onChanged,
  isLoading = false,
}: {
  deals: Deal[];
  onNew: () => void;
  onEdit: (d: Deal) => void;
  onChanged: (msg: string, tone?: 'ok' | 'err') => void;
  isLoading?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <m.div className="card table-card" variants={staggerParent} initial="initial" animate="animate">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Brand / deal</th>
                <th>Stage</th>
                <th>Payment</th>
                <th>Deadline</th>
                <th className="t-right">Value</th>
                <th className="t-right">You receive</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2].map((i) => (
                <tr key={i}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div className="skeleton" style={{ width: '60%', height: 14 }} />
                      <div className="skeleton" style={{ width: '40%', height: 12 }} />
                    </div>
                  </td>
                  <td><div className="skeleton" style={{ width: '50%', height: 20 }} /></td>
                  <td><div className="skeleton" style={{ width: '50%', height: 20 }} /></td>
                  <td><div className="skeleton" style={{ width: '40%', height: 14 }} /></td>
                  <td className="t-right"><div className="skeleton" style={{ width: '30%', height: 14, marginLeft: 'auto' }} /></td>
                  <td className="t-right"><div className="skeleton" style={{ width: '30%', height: 14, marginLeft: 'auto' }} /></td>
                  <td><div className="skeleton" style={{ width: '20px', height: 20 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </m.div>
    );
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return deals;
    if (filter === 'paid') return deals.filter((d) => d.payment_status === 'paid');
    if (filter === 'overdue') {
      return deals.filter((d) => {
        if (!d.invoice_due_on || d.payment_status === 'paid' || d.payment_status === 'cancelled') return false;
        return (daysUntil(d.invoice_due_on) ?? 1) < 0;
      });
    }
    return deals.filter((d) => d.payment_status !== 'paid' && d.status !== 'cancelled');
  }, [deals, filter]);

  const markInvoiced = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payment_status: 'invoiced' }),
      });
      if (!res.ok) throw new Error('Could not mark invoiced');
      return res.json();
    },
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: () => onChanged('Invoice logged — payment clock started'),
    onError: (e: Error) => onChanged(e.message, 'err'),
  });

  const markPaid = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/deals/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payment_status: 'paid' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Update failed');
      return res.json();
    },
    onMutate: (id) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: () => onChanged('Marked paid 🎉'),
    onError: (e: Error) => onChanged(e.message, 'err'),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Delete failed');
      return res.json();
    },
    onSuccess: () => onChanged('Deal deleted'),
    onError: (e: Error) => onChanged(e.message, 'err'),
  });

  const askDelete = (d: Deal) => {
    if (window.confirm(`Delete the ${d.brand} deal? This cannot be undone.`)) remove.mutate(d.id);
  };

  const counts = {
    all: deals.length,
    open: deals.filter((d) => d.payment_status !== 'paid' && d.status !== 'cancelled').length,
    overdue: deals.filter((d) => d.invoice_due_on && d.payment_status !== 'paid' && (daysUntil(d.invoice_due_on) ?? 1) < 0).length,
    paid: deals.filter((d) => d.payment_status === 'paid').length,
  };

  return (
    <>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {(['all', 'open', 'overdue', 'paid'] as Filter[]).map((f) => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f[0].toUpperCase() + f.slice(1)}
            <span className="tab-count">{counts[f]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={deals.length === 0 ? '📥' : '🔍'}
          title={deals.length === 0 ? 'No deals yet' : 'Nothing matches this filter'}
          body={
            deals.length === 0
              ? 'Log your first brand deal — or load a few samples to see how DealFlow works.'
              : 'Try a different filter above.'
          }
          illustration={deals.length === 0 ? '🚀' : '🔎'}
          action={
            <>
              <button className="btn primary" onClick={onNew}>+ Log a deal</button>
              {deals.length === 0 && <SampleLoader onDone={onChanged} />}
            </>
          }
        />
      ) : (
        <m.div className="card table-card" variants={staggerParent} initial="initial" animate="animate">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Brand / deal</th>
                  <th>Stage</th>
                  <th>Payment</th>
                  <th>Deadline</th>
                  <th className="t-right">Value</th>
                  <th className="t-right">You receive</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtered.map((d) => {
                    const cash = computeDealMoney(d);
                    const due = daysUntil(d.deliver_by);
                    const overdue =
                      d.invoice_due_on && d.payment_status !== 'paid' && d.payment_status !== 'cancelled' && (daysUntil(d.invoice_due_on) ?? 1) < 0;
                    return (
                      <m.tr className="deal-row" key={d.id} variants={listItem} layout exit={{ opacity: 0 }}>
                        <td>
                          <div className="t-strong">{d.brand}</div>
                          <div className="t-muted">{d.title}</div>
                          <div className="t-muted dim">{d.platform}</div>
                        </td>
                        <td><Pill tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Pill></td>
                        <td>
                          <Pill tone={PAY_TONE[d.payment_status]}>{PAY_LABEL[d.payment_status]}</Pill>
                          {overdue && (
                            <div style={{ marginTop: 5 }}>
                              <Pill tone="red">{Math.abs(daysUntil(d.invoice_due_on) ?? 0)}d overdue</Pill>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="t-muted">{formatDate(d.deliver_by)}</div>
                          {due !== null && !d.delivered_on && d.status !== 'paid' && d.status !== 'cancelled' && (
                            <div style={{ marginTop: 4 }}>
                              <Pill tone={due < 0 ? 'red' : due <= 3 ? 'amber' : 'grey'}>
                                {due < 0 ? `${Math.abs(due)}d late` : due === 0 ? 'today' : `in ${due}d`}
                              </Pill>
                            </div>
                          )}
                        </td>
                        <td className="t-right t-money">{formatMoney(d.deal_value, d.currency)}</td>
                        <td className="t-right t-money green">{formatMoney(cash.net_receivable, d.currency)}</td>
                        <td>
                          <div className="actions">
                            {d.status === 'delivered' && d.payment_status === 'not_invoiced' && (
                              <button
                                className="btn sm amber"
                                disabled={busyId === d.id}
                                onClick={() => markInvoiced.mutate(d.id)}
                                title="Raise the invoice — stamps today as the sent date"
                              >
                                {busyId === d.id ? '…' : 'Invoice'}
                              </button>
                            )}
                            {['invoiced', 'overdue', 'advance_paid'].includes(d.payment_status) && (
                              <button
                                className="btn sm green"
                                disabled={busyId === d.id}
                                onClick={() => markPaid.mutate(d.id)}
                              >
                                {busyId === d.id ? '…' : 'Paid'}
                              </button>
                            )}
                            <button className="btn sm" onClick={() => onEdit(d)}>Edit</button>
                            <button className="btn sm danger" onClick={() => askDelete(d)} aria-label={`Delete ${d.brand} deal`}>✕</button>
                          </div>
                        </td>
                      </m.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </m.div>
      )}
    </>
  );
}

function SampleLoader({ onDone }: { onDone: (msg: string, tone?: 'ok' | 'err') => void }) {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not load samples');
      return res.json();
    },
    onSuccess: (j) => onDone(`Loaded ${j.created} sample deals`),
    onError: (e: Error) => onDone(e.message, 'err'),
  });

  return (
    <button className="btn" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      {mutation.isPending ? 'Loading…' : 'Load sample deals'}
    </button>
  );
}
