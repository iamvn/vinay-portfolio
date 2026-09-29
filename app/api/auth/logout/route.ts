import { SESSION_COOKIE } from '@/lib/auth/token';

/** Clears the session cookie. (Bearer tokens expire on their own, or on a password change.) */
export async function POST() {
  const response = new Response(null, { status: 204 });
  response.headers.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return response;
}
