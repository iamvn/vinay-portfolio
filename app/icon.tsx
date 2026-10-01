import { ImageResponse } from 'next/og';
import { siteInitials } from '@/lib/initials';

// Each site's own initials.
export const dynamic = 'force-dynamic';

// Browser-tab icon (replaces the missing favicon).
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default async function Icon() {
  const initials = await siteInitials();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030609', color: '#bef264', fontSize: 17, fontWeight: 800, borderRadius: 7, letterSpacing: -1 }}>{initials}</div>
    ),
    size,
  );
}
