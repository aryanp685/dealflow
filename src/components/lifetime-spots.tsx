'use client';

import { useEffect, useState } from 'react';

export default function LifetimeSpots({ cap = 50 }: { cap?: number }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/lifetime-left')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (live && j && typeof j.left === 'number') setLeft(j.left);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (left === null) return null;
  if (left <= 0) return <strong>All lifetime spots are gone.</strong>;
  return (
    <strong>
      Only {left} of {cap} left.
    </strong>
  );
}
