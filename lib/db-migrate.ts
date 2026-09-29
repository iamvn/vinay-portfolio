import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from '@libsql/client';

/** Columns added after the first release, per table: name → definition. */
const ADDED_COLUMNS: Record<string, Record<string, string>> = {
  Project: {
    type: "TEXT NOT NULL DEFAULT 'case-study'",
    image: "TEXT NOT NULL DEFAULT ''",
    liveUrl: "TEXT NOT NULL DEFAULT ''",
    repoUrl: "TEXT NOT NULL DEFAULT ''",
    externalUrl: "TEXT NOT NULL DEFAULT ''",
    objective: "TEXT NOT NULL DEFAULT ''",
    approach: "TEXT NOT NULL DEFAULT ''",
    architecture: "TEXT NOT NULL DEFAULT ''",
    result: "TEXT NOT NULL DEFAULT ''",
    content: "TEXT NOT NULL DEFAULT ''",
  },
};

/**
 * Creates missing tables (prisma/init.sql) and adds columns newer versions need.
 * Safe to run on every deploy: it never deletes or changes existing data.
 */
export async function migrate(db: Client) {
  await db.executeMultiple(readFileSync(join(process.cwd(), 'prisma', 'init.sql'), 'utf8'));
  for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
    const existing = new Set((await db.execute(`PRAGMA table_info(${table})`)).rows.map((row) => String(row.name)));
    for (const [name, definition] of Object.entries(columns)) {
      if (existing.has(name)) continue;
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      console.log(`Added column ${table}.${name}`);
    }
  }
}
