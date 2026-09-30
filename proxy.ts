import { NextResponse, type NextRequest } from 'next/server';
import { userFromToken } from '@/lib/auth/session';
import { tokenFromRequest } from '@/lib/auth/token';
import { TAB_LABELS, blockedForReadOnly, canUseTab, isReadOnly, tabForRequest } from '@/lib/auth/permissions';

/**
 * The single gate in front of the admin panel and the API.
 *
 * Public (no login needed):
 *   - POST /api/auth/login, POST /api/auth/logout
 *   - POST /api/contact                       (the site's contact form)
 *   - POST /api/track                         (anonymous contact-click counts)
 *   - GET/POST /api/ask                       (the "Ask my resume" assistant)
 *   - GET  /api/resume, /api/profile-image,
 *          /api/projects/<slug>/image         (files shown on the public site)
 * Everything else under /api and /admin requires a valid session cookie or
 * an "Authorization: Bearer <token>" header (Bearer tokens: admins only).
 */
const PUBLIC_API: { method: string; pattern: RegExp }[] = [
  { method: 'POST', pattern: /^\/api\/auth\/(login|logout)$/ },
  { method: 'POST', pattern: /^\/api\/contact$/ },
  { method: 'POST', pattern: /^\/api\/track$/ },
  { method: 'POST', pattern: /^\/api\/ask$/ },
  { method: 'GET', pattern: /^\/api\/ask$/ },
  { method: 'GET', pattern: /^\/api\/resume$/ },
  { method: 'GET', pattern: /^\/api\/profile-image$/ },
  { method: 'GET', pattern: /^\/api\/projects\/[^/]+\/image$/ },
];

const isPublic = (method: string, path: string) =>
  PUBLIC_API.some((rule) => (rule.method === method || (rule.method === 'GET' && method === 'HEAD')) && rule.pattern.test(path));

/** Blocks cross-site form/fetch requests that ride on the session cookie. */
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // same-origin navigations and non-browser clients
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');
  if (isApi && isPublic(request.method, pathname)) return NextResponse.next();

  const { token, viaCookie } = tokenFromRequest(request);
  let user = null;
  try {
    user = await userFromToken(token);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Authentication is not configured.' }, { status: 500 });
  }

  if (!user) {
    if (isApi) return NextResponse.json({ error: 'Authentication required. Log in or send "Authorization: Bearer <token>".' }, { status: 401 });
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname + request.nextUrl.search);
    const response = NextResponse.redirect(login);
    if (viaCookie) response.cookies.delete('portfolio_session'); // stale/revoked session
    return response;
  }

  // API tokens (Authorization: Bearer) are for admins only; editors use the admin panel in the browser.
  if (isApi && !viaCookie && user.role !== 'admin') {
    return NextResponse.json({ error: 'API tokens are only available to admins. Use the admin panel instead.' }, { status: 403 });
  }

  // Per-user tab access (Users & security → Access): non-admins only reach the tabs an admin enabled.
  if (isApi && user.role !== 'admin') {
    const tab = tabForRequest(request.method, pathname);
    if (tab && !canUseTab(user, tab)) {
      return NextResponse.json({ error: `You don't have access to ${TAB_LABELS[tab]}. Ask an admin to enable it for you.` }, { status: 403 });
    }
    // Read-only users can look at everything they have access to, but can't change anything.
    if (isReadOnly(user) && blockedForReadOnly(request.method, pathname)) {
      return NextResponse.json({ error: 'Your account is read-only: you can view the admin panel but not make changes. Ask an admin if you need to edit.' }, { status: 403 });
    }
  }

  if (isApi && viaCookie && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !sameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-site request blocked.' }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/:path*'],
};
