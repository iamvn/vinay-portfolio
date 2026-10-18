import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';
import { cardProfile, getCard } from '@/lib/linkcard/store';
import { THEMES } from '@/lib/linkcard/types';
import { currentSiteUrl } from '@/lib/sites/url';

// The preview shown when the link card is shared on WhatsApp, LinkedIn, X, Instagram DMs… In the card's own colors.
export const dynamic = 'force-dynamic';
export const alt = 'Link card preview';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The profile photo as a data URL: an uploaded one (Admin → Profile) or a picture shipped with the site (/images/…). */
async function photoData(photo: string) {
  if (photo.startsWith('/api/profile-image')) {
    const image = await prisma.profileImage.findUnique({ where: { id: 1 } }).catch(() => null);
    if (!image || image.size > 1_500_000 || !/^image\/(png|jpe?g)$/.test(image.mimeType)) return '';
    return `data:${image.mimeType};base64,${Buffer.from(image.data).toString('base64')}`;
  }
  const match = /^\/[\w/.-]+\.(png|jpe?g)$/i.exec(photo.split('?')[0]);
  if (!match) return '';
  const root = join(process.cwd(), 'public');
  const file = normalize(join(root, match[0]));
  if (!file.startsWith(root)) return '';
  // On the server the file may not be bundled with this function; then ask the site for it (its own static file).
  let data: Buffer | null = await readFile(file).catch(() => null);
  if (!data) {
    const site = await currentSiteUrl().catch(() => '');
    const res = site ? await fetch(`${site}${match[0]}`, { signal: AbortSignal.timeout(4000) }).catch(() => null) : null;
    data = res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }
  if (!data || data.length > 1_500_000) return '';
  return `data:image/${match[1].toLowerCase() === 'png' ? 'png' : 'jpeg'};base64,${data.toString('base64')}`;
}

export default async function Image() {
  const [card, profile] = await Promise.all([getCard().catch(() => null), cardProfile().catch(() => null)]);
  const t = THEMES[card?.theme ?? 'midnight'] ?? THEMES.midnight;
  const name = profile?.name ?? 'My links';
  const photo = card?.showPhoto !== false && profile?.photo ? await photoData(profile.photo) : '';
  const titles = (card?.links ?? []).filter((l) => l.enabled).slice(0, 3).map((l) => l.title);
  const address = `${(await currentSiteUrl().catch(() => '')).replace(/^https?:\/\//, '')}/details`;
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 64, padding: 80, background: t.bg, color: t.text, fontFamily: 'sans-serif' }}>
        {photo
          ? <img src={photo} width={300} height={300} style={{ borderRadius: 999, objectFit: 'cover', border: `8px solid ${t.border}` }} alt="" />
          : <div style={{ width: 300, height: 300, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.accent, color: t.accentText, fontSize: 120, fontWeight: 800 }}>{initials}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{name}</div>
          {card?.headline && <div style={{ marginTop: 16, fontSize: 36, color: t.muted }}>{card.headline}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 36 }}>
            {titles.map((title, i) => (
              <div key={i} style={{ display: 'flex', padding: '16px 26px', borderRadius: 18, fontSize: 28, fontWeight: 700, background: i === 0 ? t.accent : t.button, color: i === 0 ? t.accentText : t.buttonText, border: `2px solid ${i === 0 ? 'transparent' : t.border}` }}>{title}</div>
            ))}
          </div>
          <div style={{ marginTop: 32, fontSize: 24, color: t.muted }}>{address}</div>
        </div>
      </div>
    ),
    size,
  );
}
