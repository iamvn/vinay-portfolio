import { cookies } from 'next/headers';
import { userFromToken } from './session';
import { SESSION_COOKIE } from './token';

/** The logged-in user for a Server Component (reads the session cookie), or null. */
export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return userFromToken(token).catch(() => null);
}
