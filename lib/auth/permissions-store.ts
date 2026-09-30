import { prisma } from '@/lib/prisma';
import { serializePermissions, type TabId } from './permissions';

/**
 * Reads/writes a user's admin access (User.permissions and User.readOnly) with plain SQL, so it works
 * whether or not the generated Prisma client already knows these columns.
 */
type Row = { id: number; email: string; name: string; role: string; tokenVersion: number; permissions: string | null; readOnly: number | boolean | null };
export type Access = { permissions: string; readOnly: boolean };

/** Same definitions as lib/db-migrate.ts. */
const ACCESS_COLUMNS: Record<string, string> = {
  permissions: "TEXT NOT NULL DEFAULT ''",
  readOnly: 'BOOLEAN NOT NULL DEFAULT 0',
};

/**
 * A database created before these columns existed doesn't have them until `npm run db:init` (or a deploy)
 * runs. Rather than failing every request, add whatever is missing once, then retry.
 */
let columnsAdded: Promise<void> | null = null;
async function addMissingColumns() {
  const existing = new Set((await prisma.$queryRawUnsafe<{ name: string }[]>('PRAGMA table_info(User)')).map((column) => String(column.name)));
  for (const [name, definition] of Object.entries(ACCESS_COLUMNS)) {
    if (existing.has(name)) continue;
    await prisma.$executeRawUnsafe(`ALTER TABLE User ADD COLUMN ${name} ${definition}`).catch((error) => {
      if (!/duplicate column/i.test(String(error))) throw error;
    });
    console.log(`Added column User.${name}`);
  }
}
async function withColumns<T>(query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (error) {
    if (!/no such column: (permissions|readOnly)/i.test(String((error as Error)?.message ?? error))) throw error;
    columnsAdded ??= addMissingColumns().catch((addError) => { columnsAdded = null; throw addError; });
    await columnsAdded;
    return query();
  }
}

const toAccess = (row: { permissions: string | null; readOnly: number | boolean | null }): Access =>
  ({ permissions: row.permissions ?? '', readOnly: Boolean(Number(row.readOnly ?? 0)) });

export async function findSessionUser(id: number) {
  const rows = await withColumns(() => prisma.$queryRaw<Row[]>`SELECT id, email, name, role, tokenVersion, permissions, readOnly FROM User WHERE id = ${id}`);
  const row = rows[0];
  return row ? { ...row, id: Number(row.id), tokenVersion: Number(row.tokenVersion), ...toAccess(row) } : null;
}

export async function accessById(): Promise<Map<number, Access>> {
  const rows = await withColumns(() => prisma.$queryRaw<(Row & { id: number })[]>`SELECT id, permissions, readOnly FROM User`);
  return new Map(rows.map((row) => [Number(row.id), toAccess(row)]));
}

/** Updates what's given: `permissions` (tab list, or null for the role default) and/or `readOnly`. */
export async function setAccess(id: number, change: { permissions?: readonly TabId[] | null; readOnly?: boolean }) {
  if (change.permissions !== undefined) {
    const value = change.permissions === null ? '' : serializePermissions(change.permissions);
    await withColumns(() => prisma.$executeRaw`UPDATE User SET permissions = ${value} WHERE id = ${id}`);
  }
  if (change.readOnly !== undefined) {
    const value = change.readOnly ? 1 : 0;
    await withColumns(() => prisma.$executeRaw`UPDATE User SET readOnly = ${value} WHERE id = ${id}`);
  }
  return (await accessById()).get(id) ?? { permissions: '', readOnly: false };
}
