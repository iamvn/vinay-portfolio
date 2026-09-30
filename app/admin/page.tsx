import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminApp } from '@/components/admin/admin-app';
import { publicUser } from '@/lib/auth/session';
import { currentUser } from '@/lib/auth/server';
import { ownerId } from '@/lib/auth/roles';
import { describeDatabase } from '@/lib/db-config';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Portfolio admin',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  // proxy.ts already guards /admin; this is a second check at render time.
  const user = await currentUser();
  if (!user) redirect('/login?next=/admin');
  return <AdminApp user={{ ...publicUser(user), owner: user.id === (await ownerId()) }} database={describeDatabase()} />;
}
