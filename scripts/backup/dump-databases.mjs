// Nightly backup (see .github/workflows/backup-databases.yml): dumps every database in the Turso organization
// (the main site and every site-…) to a plain SQL file that `turso db create <name> --from-dump <file>` restores.
// Needs TURSO_API_TOKEN and TURSO_ORG. Each database is read with its own short-lived, read-only token.
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@libsql/client';

const API = 'https://api.turso.tech/v1';
const token = process.env.TURSO_API_TOKEN?.trim();
const org = process.env.TURSO_ORG?.trim();
const outDir = process.argv[2] || 'backup';
if (!token || !org) { console.error('TURSO_API_TOKEN and TURSO_ORG are required.'); process.exit(1); }

async function api(path, init = {}) {
  const res = await fetch(`${API}/organizations/${encodeURIComponent(org)}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Turso API ${path}: ${body?.error ?? res.statusText} (${res.status})`);
  return body;
}

const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;
function literal(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (value instanceof ArrayBuffer) return `X'${Buffer.from(value).toString('hex')}'`;
  if (ArrayBuffer.isView(value)) return `X'${Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('hex')}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function dump(db) {
  const { jwt } = await api(`/databases/${encodeURIComponent(db.Name)}/auth/tokens?authorization=read-only&expiration=1h`, { method: 'POST' });
  const client = createClient({ url: `libsql://${db.Hostname}`, authToken: jwt });
  try {
    const lines = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;'];
    const schema = await client.execute("SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' AND name NOT LIKE 'libsql_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name");
    let rows = 0;
    for (const item of schema.rows.filter((r) => r.type === 'table')) {
      lines.push(`${item.sql};`);
      const data = await client.execute(`SELECT * FROM ${quoteIdent(item.name)}`);
      const cols = data.columns.map(quoteIdent).join(', ');
      for (const row of data.rows) {
        lines.push(`INSERT INTO ${quoteIdent(item.name)} (${cols}) VALUES (${data.columns.map((c) => literal(row[c])).join(', ')});`);
        rows++;
      }
    }
    for (const item of schema.rows.filter((r) => r.type !== 'table')) lines.push(`${item.sql};`);
    lines.push('COMMIT;');
    writeFileSync(`${outDir}/${db.Name}.sql`, lines.join('\n') + '\n');
    return rows;
  } finally {
    client.close();
  }
}

mkdirSync(outDir, { recursive: true });
const { databases = [] } = await api('/databases');
let failed = 0;
for (const db of databases) {
  try {
    const rows = await dump(db);
    console.log(`✓ ${db.Name}: ${rows} rows`);
  } catch (error) {
    failed++;
    console.error(`✖ ${db.Name}: ${error instanceof Error ? error.message : error}`);
  }
}
writeFileSync(`${outDir}/README.txt`, `Turso org ${org}, backed up ${new Date().toISOString()}.\nRestore one database:  turso db create <new-name> --from-dump <file>.sql\n`);
if (!databases.length) { console.error('No databases found. Check TURSO_ORG.'); process.exit(1); }
if (failed) process.exit(1);
