import { useId } from 'react';

/**
 * DealFlow logo — an ascending pipeline (deal → delivery → paid) with the
 * money trendline over it. Inline SVG so it stays sharp at every size and
 * costs zero network requests.
 */
export default function Logo({ size = 34, rounded = 11 }: { size?: number; rounded?: number }) {
  const gid = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="40" x2="40" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6c4dff" />
          <stop offset="1" stopColor="#46b1ff" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx={rounded} fill={`url(#${gid})`} />
      <rect x="8.5" y="24.5" width="5.6" height="7" rx="2.6" fill="#fff" opacity="0.65" />
      <rect x="17.2" y="20" width="5.6" height="11.5" rx="2.6" fill="#fff" opacity="0.85" />
      <rect x="25.9" y="14.5" width="5.6" height="17" rx="2.6" fill="#fff" />
      <path
        d="M9 16.5 L17.5 11.5 L23.5 14 L31.5 7.5"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26.6 7.2 H31.8 V12.4"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
