import { ImageResponse } from 'next/og';
import { siteInitials } from '@/lib/initials';

// Each site's own initials.
export const dynamic = 'force-dynamic';

// Home-screen icon for iPhone / iPad.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
  const initials = await siteInitials();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030609', color: '#bef264', fontSize: 84, fontWeight: 800, letterSpacing: -4 }}>{initials}</div>
    ),
    size,
  );
}
