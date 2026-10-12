import { useId } from 'react';

/**
 * Kritipath's mark (an original glyph): a winding path rising across a warm saffron-to-violet tile toward a small
 * four-point star, the work (कृति) that lights the way along the path (पथ).
 */
export function BrandMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`kp-${id}`} x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff8a3d" />
          <stop offset=".5" stopColor="#e8457c" />
          <stop offset="1" stopColor="#6d5cf6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6.5" fill={`url(#kp-${id})`} />
      <path d="M5.5 18.5c4.5 0 2-5.5 6.5-5.5s2.5-4 5-5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.6 3.6l.62 1.58 1.58.62-1.58.62-.62 1.58-.62-1.58-1.58-.62 1.58-.62z" fill="#fff" />
    </svg>
  );
}

/** The brand name as written in the logo: कृतिपथ in Devanagari (read as "Kritipath"). */
export function BrandName({ className = '' }: { className?: string }) {
  return <span lang="hi" className={`brand-hi ${className}`} title="Kritipath">कृतिपथ</span>;
}
