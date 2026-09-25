'use client';

import { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/money';

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', per1k: 150 },
  { key: 'youtube', label: 'YouTube', per1k: 400 },
  { key: 'twitter', label: 'X / Twitter', per1k: 60 },
  { key: 'linkedin', label: 'LinkedIn', per1k: 250 },
] as const;

const DELIVERABLES = [
  { key: 'reel', label: 'Reel / Short', mult: 1 },
  { key: 'static', label: 'Static post / carousel', mult: 0.5 },
  { key: 'story', label: 'Story set (3 frames)', mult: 0.3 },
  { key: 'integrated', label: 'Integrated YouTube video', mult: 1.5 },
  { key: 'dedicated', label: 'Dedicated YouTube video', mult: 3 },
] as const;

export default function RateCalculatorTool() {
  const [f, setF] = useState({
    platform: 'instagram', followers: '', engagement: '', deliverable: 'reel',
    exclusivity: false, usage: false,
  });

  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const quote = useMemo(() => {
    const platform = PLATFORMS.find((p) => p.key === f.platform) ?? PLATFORMS[0];
    const deliverable = DELIVERABLES.find((d) => d.key === f.deliverable) ?? DELIVERABLES[0];
    const followers = Math.max(0, Number(f.followers) || 0);
    const eng = Number(f.engagement) || 0;

    const base = (followers / 1000) * platform.per1k * deliverable.mult;
    const engMult = eng > 6 ? 1.5 : eng >= 3 ? 1.2 : eng >= 1 ? 1 : 0.8;
    const addOns = (f.exclusivity ? 1.3 : 1) * (f.usage ? 1.25 : 1);
    const mid = Math.max(1000, base * engMult * addOns);

    return {
      low: Math.round((mid * 0.8) / 100) * 100,
      mid: Math.round(mid / 100) * 100,
      high: Math.round((mid * 1.25) / 100) * 100,
      base, engMult, addOns, platform, deliverable,
    };
  }, [f]);

  const hasInput = (Number(f.followers) || 0) > 0;

  return (
    <div className="card">
      <div className="tool-grid">
        <label className="field"><label>Platform</label>
          <select value={f.platform} onChange={(e) => set('platform', e.target.value)}>
            {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select></label>
        <label className="field"><label>Followers / subscribers</label>
          <input type="number" min="0" value={f.followers} onChange={(e) => set('followers', e.target.value)} placeholder="85000" autoFocus /></label>
        <label className="field"><label>Avg engagement rate (%)</label>
          <input type="number" min="0" max="100" step="0.1" value={f.engagement} onChange={(e) => set('engagement', e.target.value)} placeholder="3.5" />
          <div className="hint">(likes + comments) ÷ followers × 100, averaged over your last 10 posts.</div></label>
        <label className="field"><label>Deliverable</label>
          <select value={f.deliverable} onChange={(e) => set('deliverable', e.target.value)}>
            {DELIVERABLES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select></label>
        <label className="field" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
          <label className="check" style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={f.exclusivity} onChange={(e) => set('exclusivity', e.target.checked)} />
            No competing brands for 30 days (+30%)
          </label>
          <label className="check" style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={f.usage} onChange={(e) => set('usage', e.target.checked)} />
            Paid ad usage rights, 3 months (+25%)
          </label>
        </label>
      </div>

      {hasInput && (
        <div className="tool-out">
          <div className="money-preview">
            <div className="line"><span>Reasonable floor — quote never below</span><span>{formatMoney(quote.low)}</span></div>
            <div className="line total net"><span>Sweet spot — open here</span><span>{formatMoney(quote.mid)}</span></div>
            <div className="line"><span>Anchor high — if they love the idea</span><span>{formatMoney(quote.high)}</span></div>
          </div>
          <p className="card-sub" style={{ marginTop: 12 }}>
            The formula, fully shown: {(Number(f.followers) / 1000).toLocaleString('en-IN')}k × ₹{quote.platform.per1k}/1k
            followers ({quote.platform.label}) × {quote.deliverable.mult} ({quote.deliverable.label.toLowerCase()}) ×
            engagement {quote.engMult}
            {quote.addOns > 1 && ` × extras ${quote.addOns.toFixed(3)}`}
            . Niche matters more than follower count — finance, tech and B2B audiences command 2–3× these numbers;
            meme and repost pages command less. Quote the sweet spot, never the floor.
          </p>
        </div>
      )}

      {!hasInput && (
        <p className="card-sub" style={{ marginTop: 14 }}>
          Enter your follower count — a defensible range appears instantly, with the formula shown so you can defend
          it when the brand negotiates.
        </p>
      )}
    </div>
  );
}
