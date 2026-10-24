import { mainClient } from '@/lib/db-client';

/**
 * One-time passes for "Log in as admin" (lib/auth/token.ts → createHandoff). Each pass id is written here
 * when it's used, so a pass that leaked (browser history, a screenshot) can't be used a second time.
 * Kept in the main site's database (table AuthHandoff); old rows are pruned as new ones arrive.
 */
const CREATE = 'CREATE TABLE IF NOT EXISTS AuthHandoff (jti TEXT PRIMARY KEY, usedAt TEXT NOT NULL)';
let ready: Promise<unknown> | null = null;
const ensure = () => (ready ??= mainClient.$executeRawUnsafe(CREATE).catch((error) => { ready = null; throw error; }));

/** True the first time a pass id is seen, false every time after. */
export async function consumeHandoff(jti: string): Promise<boolean> {
  await ensure();
  const now = new Date();
  await mainClient.$executeRaw`DELETE FROM AuthHandoff WHERE usedAt < ${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}`.catch(() => 0);
  try {
    await mainClient.$executeRaw`INSERT INTO AuthHandoff (jti, usedAt) VALUES (${jti}, ${now.toISOString()})`;
    return true;
  } catch {
    return false; // already used
  }
}
