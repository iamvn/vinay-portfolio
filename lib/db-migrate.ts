import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from '@libsql/client';

/** Columns added after the first release, per table: name → definition. */
const ADDED_COLUMNS: Record<string, Record<string, string>> = {
  User: {
    permissions: "TEXT NOT NULL DEFAULT ''",
  },
  Profile: {
    targetRoles: "TEXT NOT NULL DEFAULT ''",
    workPreference: "TEXT NOT NULL DEFAULT ''",
    availability: "TEXT NOT NULL DEFAULT ''",
    noticePeriod: "TEXT NOT NULL DEFAULT ''",
    assistantNotes: "TEXT NOT NULL DEFAULT ''",
  },
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
    published: 'BOOLEAN NOT NULL DEFAULT 1',
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
  await renameDefaultLabels(db);
}

/**
 * Site text defaults that were renamed. Only an untouched old default is updated,
 * so anything you typed yourself in Admin → Site text is kept.
 */
const RENAMED_LABELS: { path: [string, string]; from: string; to: string }[] = [
  { path: ['projects', 'enter'], from: 'ENTER PROJECT', to: 'VIEW CASE STUDY' },
];

async function renameDefaultLabels(db: Client) {
  const row = (await db.execute('SELECT content FROM SiteCopy WHERE id = 1')).rows[0];
  if (!row) return;
  let copy: Record<string, Record<string, unknown>>;
  try { copy = JSON.parse(String(row.content)); } catch { return; }
  let changed = false;
  for (const { path: [section, key], from, to } of RENAMED_LABELS) {
    if (copy[section]?.[key] === from) { copy[section][key] = to; changed = true; console.log(`Renamed site text ${section}.${key}: "${from}" → "${to}"`); }
  }
  if (changed) await db.execute({ sql: 'UPDATE SiteCopy SET content = ? WHERE id = 1', args: [JSON.stringify(copy)] });
}
