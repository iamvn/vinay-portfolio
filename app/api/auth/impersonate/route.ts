import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { consumeHandoff } from '@/lib/auth/handoff';
import { IMPERSONATION_SECONDS, createToken, readHandoff, sessionCookie } from '@/lib/auth/token';
import { logActivity } from '@/lib/sites/activity';
import { currentSite } from '@/lib/sites/context';
import { urlHere } from '@/lib/request-url';

export const dynamic = 'force-dynamic';

// A short code, not text, so the login page only ever shows its own messages.
const fail = (request: Request, notice: 'expired' | 'used' | 'no-admin' | 'error') =>
  NextResponse.redirect(urlHere(request, `/login?notice=${notice}`), 302);

/**
 * The second half of "Log in as admin": opened on the other site's own address with the one-time pass from
 * /api/platform/sites/<slug>/impersonate. Signs this browser in as the site's first admin (its owner) for
 * 2 hours and opens the admin panel. Their password, sessions and last sign-in are left alone.
 */
export async function GET(request: Request) {
  const pass = await readHandoff(new URL(request.url).searchParams.get('pass'));
  const site = await currentSite();
  if (!pass || pass.site !== site.slug || site.isMain) return fail(request, 'expired');
  if (!(await consumeHandoff(pass.jti))) return fail(request, 'used');
  try {
    const admin = await prisma.user.findFirst({ where: { role: 'admin' }, orderBy: { id: 'asc' }, select: { id: true, email: true, tokenVersion: true } });
    if (!admin) return fail(request, 'no-admin');
    const { token } = await createToken(admin.id, admin.tokenVersion, site.slug, pass.by);
    await logActivity(site, pass.by, 'user.impersonated', { step: 'signed-in', email: admin.email }, { includeMain: true });
    const response = NextResponse.redirect(urlHere(request, '/admin'), 302);
    response.cookies.set(sessionCookie(token, IMPERSONATION_SECONDS));
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  } catch (error) {
    console.error(error);
    return fail(request, 'error');
  }
}
