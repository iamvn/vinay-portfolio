import { prisma } from '@/lib/prisma';
import { currentSite } from '@/lib/sites/context';
import { currentSiteUrl } from '@/lib/sites/url';

/** The current site, the name to show for it (its owner's profile name) and its public address. */
export async function postingSite() {
  const [site, profile, url] = await Promise.all([
    currentSite(),
    prisma.profile.findUnique({ where: { id: 1 }, select: { name: true, role: true } }).catch(() => null),
    currentSiteUrl().catch(() => ''),
  ]);
  return { site, name: profile?.name?.trim() || site.name, role: profile?.role?.trim() || '', url };
}
