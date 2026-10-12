import { useId } from 'react';

/** Careerloom's mark: two threads woven across each other on a rounded tile (an original glyph). */
export function BrandMark({ size = 20, className = '' }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={`cl-${id}`} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5b7cfa" />
          <stop offset=".55" stopColor="#9b6cf6" />
          <stop offset="1" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="6.5" fill={`url(#cl-${id})`} />
      <path d="M5.5 8.5c3.2 0 3.3 7 6.5 7s3.3-7 6.5-7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path d="M5.5 15.5c3.2 0 3.3-7 6.5-7s3.3 7 6.5 7" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
