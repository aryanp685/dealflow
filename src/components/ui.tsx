'use client';

import { useEffect, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import clsx from 'clsx';


export const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
};

export const staggerParent = {
  animate: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};

export const listItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18 } },
};


export function AnimatedNumber({
  value,
  format,
  duration = 900,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const from = display;
    const delta = value - from;
    if (delta === 0) return;

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(from + delta * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{format(display)}</>;
}

export function Kpi({
  label,
  value,
  format,
  note,
  tone = 'default',
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  note?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  return (
    <m.div className={clsx('kpi', tone !== 'default' && tone)} variants={listItem} layout>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        <AnimatedNumber value={value} format={format} />
      </div>
      {note && <div className="kpi-note">{note}</div>}
    </m.div>
  );
}


export function Pill({ tone = 'grey', children }: { tone?: string; children: React.ReactNode }) {
  return <span className={clsx('pill', `p-${tone}`)}>{children}</span>;
}


export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <m.div
          className="modal-bg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <m.div
            className={clsx('modal', wide && 'modal-wide')}
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="modal-head">
              <h2>{title}</h2>
              <button className="btn ghost sm icon" onClick={onClose} aria-label="Close">✕</button>
            </div>
            {children}
            {footer && <div className="modal-foot">{footer}</div>}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}


export type ToastState = { id: number; msg: string; tone: 'ok' | 'err' | 'info' } | null;

export function Toast({ toast }: { toast: ToastState }) {
  return (
    <AnimatePresence>
      {toast && (
        <m.div
          key={toast.id}
          className={clsx('toast', toast.tone === 'err' && 'err', toast.tone === 'info' && 'info')}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          role="status"
        >
          {toast.msg}
        </m.div>
      )}
    </AnimatePresence>
  );
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);

  const notify = (msg: string, tone: 'ok' | 'err' | 'info' = 'ok') => {
    setToast({ id: Date.now(), msg, tone });
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(t);
  }, [toast]);

  return { toast, notify };
}


export function Skeleton({ className }: { className?: string }) {
  return <m.div className={clsx('skeleton', className)} variants={listItem} />;
}

export function DashboardSkeleton() {
  return (
    <m.div variants={staggerParent} initial="initial" animate="animate">
      <div className="kpi-grid">
        {[0, 1, 2, 3].map((i) => (
          <div className="kpi" key={i}>
            <div className="kpi-label skeleton" style={{ width: '55%', height: 11 }} />
            <div className="skeleton" style={{ width: '70%', height: 26, marginTop: 9 }} />
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="skeleton" style={{ width: '30%', height: 14 }} />
        {[0, 1, 2, 3].map((i) => (
          <div className="skeleton" key={i} style={{ height: 9, marginTop: 16 }} />
        ))}
      </div>
    </m.div>
  );
}


export function BarRow({
  label,
  value,
  display,
  max,
  tone = 'accent',
}: {
  label: string;
  value: number;
  display: string;
  max: number;
  tone?: 'accent' | 'red' | 'amber' | 'green';
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <m.div className="bar-row" variants={listItem}>
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <m.div
          className={clsx('bar-fill', tone !== 'accent' && tone)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <div className="bar-value">{display}</div>
    </m.div>
  );
}


export function EmptyState({
  icon,
  title,
  body,
  action,
  illustration,
}: {
  icon: string;
  title: string;
  body: string;
  action?: React.ReactNode;
  illustration?: string;
}) {
  return (
    <m.div className="empty" {...fadeUp}>
      {illustration && (
        <div className="empty-illustration" style={{ marginBottom: 20, fontSize: 48, opacity: 0.8 }}>
          {illustration}
        </div>
      )}
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && <div className="empty-actions">{action}</div>}
    </m.div>
  );
}
