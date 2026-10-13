'use client';

import { useCallback, useEffect, useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import type { StaticImageData } from 'next/image';

export type Shot = {
  src: string;
  title: string;
  caption: string;
  alt: string;
};

export default function TourShots({ shots }: { shots: Shot[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (dir: number) => setOpen((i) => (i === null ? null : (i + dir + shots.length) % shots.length)),
    [shots.length]
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, step]);

  return (
    <>
      <div className="tour-grid">
        {shots.map((s, i) => (
          <figure className="tour-card" key={s.title}>
            <button
              type="button"
              className="tour-zoom"
              onClick={() => setOpen(i)}
              aria-label={`Enlarge the ${s.title} screenshot`}
            >
              <img src={s.src} alt={s.alt} />
              <span className="tour-zoom-hint">🔍 Click to enlarge</span>
            </button>
            <figcaption>
              <strong>{s.title}</strong>
              {s.caption}
            </figcaption>
          </figure>
        ))}
      </div>

      <AnimatePresence>
        {open !== null && (
          <m.div
            className="lightbox-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
          >
            <m.div
              className="lightbox"
              initial={{ scale: 0.93, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <img className="lightbox-img" src={shots[open].src} alt={shots[open].alt} />
              <div className="lightbox-bar">
                <div className="lightbox-cap">
                  <strong>{shots[open].title}</strong> {shots[open].caption}
                </div>
                <div className="lightbox-actions">
                  <button type="button" onClick={() => step(-1)} aria-label="Previous screenshot">←</button>
                  <span className="lightbox-count">{open + 1} / {shots.length}</span>
                  <button type="button" onClick={() => step(1)} aria-label="Next screenshot">→</button>
                  <button type="button" className="close" onClick={close} aria-label="Close">✕</button>
                </div>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
