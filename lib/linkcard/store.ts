import { prisma } from '@/lib/prisma';
import { daysAgo } from '@/lib/events';
import { linkCardSchema, newLinkId, type CardProfile, type LinkCard } from './types';

/** The link card is one JSON setting in the site's own database. */
const KEY = 'linkcard';

/** What a site gets before anyone opens Admin → Link card: its portfolio, its resume (if uploaded) and the profile's socials. */
async function starter(): Promise<LinkCard> {
  const [profile, resume] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 }, select: { role: true, summary: true } }).catch(() => null),
    prisma.resume.findUnique({ where: { id: 1 }, select: { id: true } }).catch(() => null),
  ]);
  const summary = (profile?.summary ?? '').trim();
  return {
    enabled: true,
    headline: (profile?.role ?? '').trim().slice(0, 120),
    bio: summary.length > 220 ? `${summary.slice(0, 217).replace(/\s+\S*$/, '')}…` : summary,
    theme: 'midnight', shape: 'rounded', showPhoto: true, showSocials: true,
    links: [
      { id: newLinkId(), title: 'See my portfolio', url: '{site}', featured: true, enabled: true },
      ...(resume ? [{ id: newLinkId(), title: 'Download my resume', url: '{site}/api/resume', featured: false, enabled: true }] : []),
    ],
  };
}

export async function getCard(): Promise<LinkCard & { saved: boolean }> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  if (row) {
    try {
      const parsed = linkCardSchema.safeParse(JSON.parse(row.value));
      if (parsed.success) return { ...parsed.data, saved: true };
    } catch { /* damaged: fall back to the starter */ }
  }
  return { ...(await starter()), saved: false };
}

export async function saveCard(card: LinkCard) {
  const value = JSON.stringify(card);
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  return { ...card, saved: true };
}

export async function cardProfile(): Promise<CardProfile> {
  const row = await prisma.profile.findUnique({ where: { id: 1 }, select: { name: true, role: true, profileImage: true, socialLinks: true } }).catch(() => null);
  let links: Record<string, string | null> = {};
  try { links = JSON.parse(row?.socialLinks ?? '{}'); } catch { /* none */ }
  const socials: CardProfile['socials'] = [];
  for (const kind of ['linkedin', 'github', 'instagram', 'email'] as const) {
    const value = String(links[kind] ?? '').trim();
    if (!value) continue;
    if (kind === 'email') { if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) socials.push({ kind, url: `mailto:${value}` }); }
    else if (/^https:\/\//i.test(value)) socials.push({ kind, url: value });
  }
  const photo = row?.profileImage && /^(\/|https:\/\/)/.test(row.profileImage) ? row.profileImage : '';
  return { name: row?.name?.trim() || 'My links', role: row?.role?.trim() ?? '', photo, socials };
}

/** Views of /details and clicks per link over the last 30 days. */
export async function cardStats() {
  const since = daysAgo(30);
  const [views, clicks] = await Promise.all([
    prisma.event.count({ where: { type: 'linkcard_view', createdAt: { gte: since } } }).catch(() => 0),
    prisma.event.groupBy({ by: ['detail'], where: { type: 'linkcard_click', createdAt: { gte: since } }, _count: { _all: true } }).catch(() => []),
  ]);
  return { views, clicks: Object.fromEntries(clicks.map((c) => [c.detail, c._count._all])) as Record<string, number> };
}
