/**
 * Simple in-memory limiter for login attempts: 5 failures per email+IP locks it for 15 minutes.
 * On serverless hosting each instance has its own memory, so this slows down guessing rather
 * than making it impossible — strong passwords remain the real protection.
 */
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const attempts = new Map<string, { failures: number; lockedUntil: number }>();

export function loginLockedFor(key: string): number {
  const entry = attempts.get(key);
  if (!entry || entry.lockedUntil <= Date.now()) return 0;
  return Math.ceil((entry.lockedUntil - Date.now()) / 60000);
}

export function recordLoginFailure(key: string) {
  const entry = attempts.get(key) ?? { failures: 0, lockedUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = Date.now() + LOCK_MS;
    entry.failures = 0;
  }
  attempts.set(key, entry);
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
