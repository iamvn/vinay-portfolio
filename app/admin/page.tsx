import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminApp } from '@/components/admin/admin-app';
import { publicUser } from '@/lib/auth/session';
import { currentUser } from '@/lib/auth/server';
import { ownerId } from '@/lib/auth/roles';
import { describeDatabase } from '@/lib/db-config';
import { prisma } from '@/lib/prisma';
import { currentSite } from '@/lib/sites/context';

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
  const site = await currentSite();
  // Database details and the Sites tab (the platform) only exist on the main site.
  return (
    <AdminApp
      user={{ ...publicUser(user), owner: user.id === (await ownerId()) }}
      database={site.isMain ? { ...describeDatabase(), lastDeploy: read('system.lastDeploy'), seededAt: read('system.seededAt')?.at ?? null } : undefined}
      platform={site.isMain && user.role === 'admin'}
    />
  );
}
