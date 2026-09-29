import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { currentUser } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Log in', robots: { index: false, follow: false } };

/** Only lets a same-site path through, so ?next= can't redirect to another website. */
const safeNext = (next: string | undefined) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin');

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await currentUser()) redirect(next);
  return <LoginForm next={next} />;
}
