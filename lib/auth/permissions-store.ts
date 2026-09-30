import { prisma } from '@/lib/prisma';
import { serializePermissions, type TabId } from './permissions';

/**
 * Reads/writes User.permissions with plain SQL, so it works whether or not the generated Prisma
 * client already knows the column (it's added by an additive migration on deploy).
 */
type Row = { id: number; email: string; name: string; role: string; tokenVersion: number; permissions: string | null };

/**
 * A database created before this feature has no permissions column until `npm run db:init` (or a deploy) runs.
 * Rather than failing every request, add the column once (same definition as lib/db-migrate.ts) and retry.
 */
let columnAdded: Promise<void> | null = null;
async function withColumn<T>(query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (error) {
    if (!/no such column: permissions/i.test(String((error as Error)?.message ?? error))) throw error;
    columnAdded ??= prisma.$executeRawUnsafe(`ALTER TABLE User ADD COLUMN permissions TEXT NOT NULL DEFAULT ''`)
      .then(() => console.log('Added column User.permissions'))
      .catch((alterError) => { if (!/duplicate column/i.test(String(alterError))) { columnAdded = null; throw alterError; } });
    await columnAdded;
    return query();
  }
}

export async function findSessionUser(id: number) {
  const rows = await withColumn(() => prisma.$queryRaw<Row[]>`SELECT id, email, name, role, tokenVersion, permissions FROM User WHERE id = ${id}`);
  const row = rows[0];
  return row ? { ...row, id: Number(row.id), tokenVersion: Number(row.tokenVersion), permissions: row.permissions ?? '' } : null;
}

export async function permissionsById(): Promise<Map<number, string>> {
  const rows = await withColumn(() => prisma.$queryRaw<{ id: number; permissions: string | null }[]>`SELECT id, permissions FROM User`);
  return new Map(rows.map((row) => [Number(row.id), row.permissions ?? '']));
}

export async function setPermissions(id: number, tabs: readonly TabId[] | null) {
  const value = tabs === null ? '' : serializePermissions(tabs);
  await withColumn(() => prisma.$executeRaw`UPDATE User SET permissions = ${value} WHERE id = ${id}`);
  return value;
}
