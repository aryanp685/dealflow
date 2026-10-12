'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DealFlow render error]', error);
  }, [error]);

  return (
    <div className="error-screen">
      <div className="error-card">
        <div className="error-icon">⚠️</div>
        <h1>Something broke on our side</h1>
        <p>
          Your deals are safe — nothing was lost. Try reloading, and if it keeps happening
          the details below will help us fix it fast.
        </p>
        <div className="error-actions">
          <button className="btn primary" onClick={reset}>Try again</button>
          <button className="btn" onClick={() => window.location.reload()}>Reload page</button>
        </div>
        {error.digest && <code className="error-digest">Reference: {error.digest}</code>}
      </div>
    </div>
  );
}
