import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { currentUser } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: `Sign in | ${BRAND.name}`, robots: { index: false, follow: false } };

/** Only lets a same-site path through, so ?next= can't redirect to another website. */
const safeNext = (next: string | undefined) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin');

/** Messages for ?notice= (from "Log in as admin" links that didn't work). */
const NOTICES: Record<string, string> = {
  expired: 'That super admin sign-in link has expired (they last 60 seconds). Open it again from Sites.',
  used: 'That super admin sign-in link was already used. Open it again from Sites.',
  'no-admin': 'This site has no admin account yet.',
  error: 'Couldn’t open this site’s admin. Try again from Sites.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await currentUser()) redirect(next);
  return <LoginForm next={next} notice={NOTICES[params.notice ?? ''] ?? ''} />;
}
