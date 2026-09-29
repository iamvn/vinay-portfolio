// Creates the tables (prisma/init.sql) on the database in DATABASE_URL and adds any
// columns that newer versions of the app need. Safe to run repeatedly: it never deletes data.
// Works for a local file and for a Turso database, so no sqlite3 CLI is needed.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

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

async function main() {
  await db.executeMultiple(readFileSync(new URL('./init.sql', import.meta.url), 'utf8'));
  for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
    const existing = new Set((await db.execute(`PRAGMA table_info(${table})`)).rows.map((row) => String(row.name)));
    for (const [name, definition] of Object.entries(columns)) {
      if (existing.has(name)) continue;
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      console.log(`Added column ${table}.${name}`);
    }
  }
  console.log('Tables ready.');
}

main().finally(() => db.close());
