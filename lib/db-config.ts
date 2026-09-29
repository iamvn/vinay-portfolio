/**
 * Database connection settings.
 * Accepts our own names (DATABASE_URL / DATABASE_AUTH_TOKEN) or the ones Vercel's
 * Turso integration creates automatically (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN).
 * Without either, a local SQLite file is used.
 */
export const LOCAL_DATABASE_URL = 'file:./prisma/dev.db';

export function databaseConfig() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  return { url: url || LOCAL_DATABASE_URL, authToken: authToken || undefined, configured: Boolean(url) };
}
