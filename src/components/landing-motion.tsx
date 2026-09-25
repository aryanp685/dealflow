'use client';

import { m, useReducedMotion } from 'motion/react';

// Client boundary for the landing page, so the Server Component above the
// fold stays indexable. Honours the OS reduce-motion setting.
export default function LandingMotion({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return <div className="land-body">{reduce ? children : <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>{children}</m.div>}</div>;
}

/** Scroll-triggered reveal. Animates once, only when actually in view. */
export function Reveal({
  children,
  delay = 0,
  y = 26,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <m.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </m.div>
  );
}
