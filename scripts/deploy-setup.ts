// Runs before `next build` on Vercel (see "vercel-build" in package.json). Every step is safe to repeat:
//   1. create missing tables / columns
//   2. if the database has no portfolio yet, load data/portfolio.json
//   3. if there are no admins yet and ADMIN_EMAIL + ADMIN_PASSWORD are set, create that admin
import 'dotenv/config';
import { createClient } from '@libsql/client';
import data from '../data/portfolio.json';
import { hashPassword, passwordProblem } from '../lib/auth/password';
import { databaseConfig } from '../lib/db-config';
import { migrate } from '../lib/db-migrate';
import { replacePortfolio } from '../lib/portfolio-repository';
import { prisma } from '../lib/prisma';
import { portfolioSchema } from '../lib/schemas';
import { listSites } from '../lib/sites/registry';

async function main() {
  const { url, authToken, configured, persistent, deploymentBranch } = databaseConfig();
  if (deploymentBranch && process.env.ALLOW_DEPLOYMENT_BRANCH_DB !== '1') {
    throw new Error(`This deployment was given its own database branch (${new URL(url).host.split('.')[0]}) by the Turso integration. Every deploy would start from an empty copy and your edits would be lost. Fix: in Vercel → Settings → Environment Variables set DATABASE_URL to your permanent Turso database (libsql://<name>-<org>.turso.io) and DATABASE_AUTH_TOKEN, for Production and Preview, then redeploy. DATABASE_URL takes priority over TURSO_DATABASE_URL.`);
  }
  if (process.env.VERCEL && !persistent && !deploymentBranch) {
    // A file database on Vercel is rebuilt from scratch on every deploy: all edits would be lost.
    throw new Error('DATABASE_URL points to a local file ("file:…"). On Vercel that file is recreated on every deploy, so all your edits would be lost. In Vercel → Settings → Environment Variables, delete DATABASE_URL (if you connected Turso, TURSO_DATABASE_URL is used) or set it to your libsql://… Turso URL plus DATABASE_AUTH_TOKEN, then redeploy.');
  }
  if (process.env.VERCEL && !configured) {
    throw new Error('No database configured. Add DATABASE_URL + DATABASE_AUTH_TOKEN (or connect Turso so TURSO_DATABASE_URL + TURSO_AUTH_TOKEN exist) in Vercel → Settings → Environment Variables, then redeploy.');
  }
  if (process.env.VERCEL && !(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32)) {
    throw new Error('AUTH_SECRET is missing or shorter than 32 characters. Add it in Vercel → Settings → Environment Variables, then redeploy.');
  }
  console.log(`Database: ${url.startsWith('file:') ? url : new URL(url).host}`);

  const db = createClient({ url, authToken });
  try {
    await migrate(db);
    console.log('✓ Tables ready');
  } finally {
    db.close();
  }

  // Every other site's database gets the same upgrades (they're also upgraded on first use).
  const sites = await listSites().catch(() => []);
  for (const site of sites) {
    const siteDb = createClient({ url: site.dbUrl, authToken: site.dbToken });
    try {
      await migrate(siteDb);
      console.log(`✓ Site ${site.slug}: tables ready`);
    } catch (error) {
      console.warn(`⚠ Site ${site.slug}: could not update tables (${error instanceof Error ? error.message : error}). It will retry on first use.`);
    } finally {
      siteDb.close();
    }
  }

  // Default data is only ever loaded into a database that has no profile at all (a brand-new database).
  // Existing content is never overwritten by a deploy.
  const [profiles, projects, users] = await Promise.all([prisma.profile.count(), prisma.project.count(), prisma.user.count()]);
  let result: 'seeded' | 'kept' | 'partial';
  if (profiles === 0 && projects === 0 && users === 0) {
    await replacePortfolio(portfolioSchema.parse(data));
    result = 'seeded';
    console.log('✓ New, empty database: loaded the starter content from data/portfolio.json');
  } else if (profiles === 0) {
    result = 'partial';
    console.warn('⚠ No profile found, but the database has other data, so the starter content was NOT loaded. Restore a backup in Admin → Backup.');
  } else {
    result = 'kept';
    console.log(`✓ Existing content kept (${projects} projects, ${users} users). Deploys never overwrite it.`);
  }

  // Remember what this deploy found, so Admin can show it (and prove whether data survives deploys).
  const now = new Date().toISOString();
  const host = url.startsWith('file:') ? url : new URL(url).host;
  const record = { at: now, result, projects, users, database: host, commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null, env: process.env.VERCEL_ENV ?? 'local' };
  const save = (key: string, value: unknown) =>
    prisma.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: { value: JSON.stringify(value) } });
  await save('system.lastDeploy', record);
  if (result === 'seeded') await save('system.seededAt', { at: now, database: host });

  if ((await prisma.user.count()) === 0) {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (email && password) {
      const problem = passwordProblem(password);
      if (problem) throw new Error(`ADMIN_PASSWORD: ${problem}`);
      await prisma.user.create({ data: { email, role: 'admin', passwordHash: await hashPassword(password), createdAt: new Date().toISOString() } });
      console.log(`✓ Created admin ${email}. You can now remove ADMIN_PASSWORD from the environment variables.`);
    } else {
      console.warn('⚠ No admin account yet. Set ADMIN_EMAIL and ADMIN_PASSWORD and redeploy (or run `npm run admin:create` against this database).');
    }
  } else {
    console.log('✓ Admin account exists');
  }
}

main()
  .catch((error) => { console.error(`✖ ${error instanceof Error ? error.message : error}`); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
