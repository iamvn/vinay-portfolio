import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminApp } from '@/components/admin/admin-app';
import { publicUser } from '@/lib/auth/session';
import { currentUser } from '@/lib/auth/server';
import { ownerId } from '@/lib/auth/roles';
import { describeDatabase } from '@/lib/db-config';
import { prisma } from '@/lib/prisma';
import { currentSite } from '@/lib/sites/context';
import { siteBySlug } from '@/lib/sites/registry';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Portfolio admin',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // proxy.ts already guards /admin; this is a second check at render time.
  const user = await currentUser();
  if (!user) redirect('/login?next=/admin');
  // What the last deploy found in the database (written by scripts/deploy-setup.ts).
  const rows = await prisma.setting.findMany({ where: { key: { in: ['system.lastDeploy', 'system.seededAt'] } } }).catch(() => []);
  const read = (key: string) => { try { return JSON.parse(rows.find((row) => row.key === key)?.value ?? 'null'); } catch { return null; } };
  const current = await currentSite();
  const site = current.isMain ? current : (await siteBySlug(current.slug, true)) ?? current; // fresh security settings
  const admin = user.role === 'admin';
  // Database details only exist on the main site. The Sites tab: the main site's admins, and admins of a site
  // the main admin allowed to create sites. Adding users on other sites also needs the main admin's permission.
  return (
    <AdminApp
      user={{ ...publicUser(user), owner: user.id === (await ownerId()) }}
      database={site.isMain ? { ...describeDatabase(), lastDeploy: read('system.lastDeploy'), seededAt: read('system.seededAt')?.at ?? null } : undefined}
      platform={admin && (site.isMain || site.canAddSites)}
      platformMain={admin && site.isMain}
      canAddUsers={site.canAddUsers}
    />
  );
}
