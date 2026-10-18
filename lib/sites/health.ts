import { createClient } from '@libsql/client';
import { mainClient } from '@/lib/db-client';
import { listSites, type Site } from './registry';

/**
 * Is everything answering? The main database, then every site's own database (a "SELECT 1" each, with a
 * time limit). Used by /api/health (counts only, for the uptime check) and the owner's Database tab (per site).
 */
const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`no answer in ${ms / 1000}s`)), ms))]);

async function ping(site: Site) {
  const started = Date.now();
  const db = createClient({ url: site.dbUrl, authToken: site.dbToken });
  try {
    await withTimeout(db.execute('SELECT 1'), 6000);
    return { slug: site.slug, name: site.name, ok: true, ms: Date.now() - started };
  } catch (error) {
    return { slug: site.slug, name: site.name, ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message.slice(0, 160) : 'failed' };
  } finally {
    db.close();
  }
}

export type HealthReport = Awaited<ReturnType<typeof checkHealth>>;

export async function checkHealth() {
  const started = Date.now();
  let main: { ok: boolean; ms: number; error?: string };
  try {
    await withTimeout(mainClient.$queryRawUnsafe('SELECT 1'), 6000);
    main = { ok: true, ms: Date.now() - started };
  } catch (error) {
    main = { ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message.slice(0, 160) : 'failed' };
  }
  const sites = main.ok ? await Promise.all((await listSites()).filter((s) => s.status === 'active').map(ping)) : [];
  return { ok: main.ok && sites.every((s) => s.ok), main, sites, checkedAt: new Date().toISOString() };
}

// The public check runs at most every 30 seconds per server, whoever calls it.
let cached: { at: number; report: HealthReport } | null = null;
export async function cachedHealth() {
  if (cached && Date.now() - cached.at < 30_000) return cached.report;
  const report = await checkHealth();
  cached = { at: Date.now(), report };
  return report;
}

/** The latest runs of this repository's backup and health-check workflows (GitHub's public API), cached 10 minutes. */
type Run = { status: string; conclusion: string | null; at: string; url: string } | null;
let runsCache: { at: number; value: { backup: Run; health: Run; repo: string } } | null = null;
export async function workflowRuns() {
  const owner = process.env.VERCEL_GIT_REPO_OWNER?.trim(), repo = process.env.VERCEL_GIT_REPO_SLUG?.trim();
  if (!owner || !repo) return null;
  if (runsCache && Date.now() - runsCache.at < 10 * 60_000) return runsCache.value;
  const latest = async (file: string): Promise<Run> => {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${file}/runs?per_page=1`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'kritipath-health', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
      cache: 'no-store',
    }).catch(() => null);
    if (!res?.ok) return null;
    const run = (await res.json().catch(() => null))?.workflow_runs?.[0];
    return run ? { status: String(run.status), conclusion: run.conclusion ?? null, at: String(run.run_started_at ?? run.created_at), url: String(run.html_url) } : null;
  };
  const [backup, health] = await Promise.all([latest('backup-databases.yml'), latest('health-check.yml')]);
  const value = { backup, health, repo: `${owner}/${repo}` };
  runsCache = { at: Date.now(), value };
  return value;
}
