'use client';

import { m, AnimatePresence } from 'motion/react';
import { Pill, EmptyState, listItem, staggerParent } from './ui';
import { formatDate } from '@/lib/money';

export type Reminder = {
  deal_id: number;
  brand: string;
  kind: string;
  urgency: 1 | 2 | 3;
  headline: string;
  channel: 'whatsapp' | 'email';
  message: string;
  send_text: string;
  wa_number?: string;
  money?: string;
  date?: string;
  auto_sent_on?: string | null;
};

export default function Reminders({
  reminders,
  urgent,
  notify,
}: {
  reminders: Reminder[];
  urgent: number;
  notify: (msg: string, tone?: 'ok' | 'err') => void;
}) {
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify('Copied — paste it into WhatsApp or email');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      notify(ok ? 'Copied' : 'Copy failed — select the text manually', ok ? 'ok' : 'err');
    }
  };

  if (reminders.length === 0) {
    return (
      <EmptyState
        icon="🎉"
        title="Nothing needs your attention"
        body="Every deliverable is on track and every invoice is within terms. Enjoy the quiet."
      />
    );
  }

  return (
    <m.div variants={staggerParent} initial="initial" animate="animate">
      <m.div className={`notice ${urgent > 0 ? '' : 'ok'}`} variants={listItem}>
        {urgent > 0
          ? `🚨 ${urgent} item${urgent > 1 ? 's' : ''} need urgent action today. Copy the message and send it — chasing is the whole job.`
          : `${reminders.length} follow-up${reminders.length > 1 ? 's' : ''} ready. Send them before the day ends.`}
      </m.div>

      <AnimatePresence initial={false}>
        {reminders.map((r) => (
          <m.div className={`reminder u${r.urgency}`} key={`${r.deal_id}-${r.kind}`} variants={listItem} layout>
            <div className="reminder-head">
              <div>
                <div className="reminder-title">
                  {r.brand} <span className="dim">—</span> {r.headline}
                </div>
                <div className="reminder-meta">
                  {r.channel === 'whatsapp' ? '💬 WhatsApp' : '✉️ Email'}{r.auto_sent_on ? ` · ✈️ auto-sent ${formatDate(r.auto_sent_on)}` : ''}
                  {r.money && <span> · {r.money}</span>}
                  {r.date && <span> · {formatDate(r.date)}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                <Pill tone={r.urgency === 3 ? 'red' : r.urgency === 2 ? 'amber' : 'blue'}>
                  {r.urgency === 3 ? 'Urgent' : r.urgency === 2 ? 'Action' : 'Heads up'}
                </Pill>
                <a
                  className="btn sm green"
                  href={`https://wa.me/${r.wa_number ?? ''}?text=${encodeURIComponent(r.send_text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={r.wa_number ? `Open WhatsApp chat with ${r.brand}` : 'Opens WhatsApp — pick the contact'}
                >
                  Send on WhatsApp
                </a>
                <button className="btn sm primary" onClick={() => copy(r.send_text)}>Copy message</button>
              </div>
            </div>
            <pre className="reminder-body">{r.message}</pre>
          </m.div>
        ))}
      </AnimatePresence>
    </m.div>
  );
}
