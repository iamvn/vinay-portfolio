import { prisma } from './prisma';

/** "Savi Bharti" → "SB": used for each site's browser-tab and home-screen icons. */
export async function siteInitials() {
  const profile = await prisma.profile.findUnique({ where: { id: 1 }, select: { name: true } }).catch(() => null);
  const words = (profile?.name ?? '').trim().split(/\s+/).filter(Boolean);
  return (words.length >= 2 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] ?? 'P').slice(0, 2)).toUpperCase();
}
