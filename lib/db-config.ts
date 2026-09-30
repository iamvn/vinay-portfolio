/**
 * Database connection settings.
 * Accepts our own names (DATABASE_URL / DATABASE_AUTH_TOKEN) or the ones Vercel's
 * Turso integration creates automatically (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN).
 * Without either, a local SQLite file is used (development only).
 *
 * On Vercel a `file:` database would live inside the deployment itself: every deploy would start
 * from an empty file and reload the default data. So on Vercel a `file:` DATABASE_URL is ignored
 * in favour of TURSO_DATABASE_URL, and the deploy stops with a clear error if that's all there is.
 */
export const LOCAL_DATABASE_URL = 'file:./prisma/dev.db';

const isFile = (url: string) => url.startsWith('file:');

export function databaseConfig() {
  const onVercel = Boolean(process.env.VERCEL);
  const own = process.env.DATABASE_URL?.trim() || '';
  const turso = process.env.TURSO_DATABASE_URL?.trim() || '';
  const useTurso = Boolean(turso) && (!own || (onVercel && isFile(own)));
  const url = useTurso ? turso : own;
  const authToken = useTurso
    ? process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN
    : process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;
  const resolved = url || LOCAL_DATABASE_URL;
  // Vercel's Turso integration can create a database branch for every deployment ("dpl-…"). Each new
  // deployment then starts from a fresh copy of the (empty) main database, so edits vanish on every deploy.
  const deploymentBranch = onVercel && useTurso && /^libsql:\/\/dpl-/i.test(resolved);
  return {
    url: resolved,
    authToken: authToken || undefined,
    configured: Boolean(url),
    /** False when data would be wiped by the next deploy (a file database, or a per-deployment branch). */
    persistent: !(onVercel && isFile(resolved)) && !deploymentBranch,
    deploymentBranch,
    onVercel,
  };
}

/** Safe to show in the admin panel: which database is in use, without credentials. */
export function describeDatabase() {
  const { url, persistent, onVercel, deploymentBranch } = databaseConfig();
  if (isFile(url)) {
    return { kind: 'file' as const, label: url.replace(/^file:/, ''), persistent, onVercel, deploymentBranch };
  }
  let host = url;
  try { host = new URL(url).host; } catch { /* keep as is */ }
  return { kind: host.endsWith('.turso.io') ? ('turso' as const) : ('remote' as const), label: host, persistent, onVercel, deploymentBranch };
}
