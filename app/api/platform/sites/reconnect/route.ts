import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, parseBody } from '@/lib/api-utils';
import { insertSite, listSites, updateSite } from '@/lib/sites/registry';
import { findUnlistedSiteDatabases, siteDatabaseToken } from '@/lib/sites/provision';
import { requirePlatformAdmin } from '@/lib/sites/platform';
import { actorLabel, logActivity } from '@/lib/sites/activity';
import { listProjectDomains, vercelApiConfigured } from '@/lib/sites/vercel';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Platform owner only. After the main database is replaced, its list of sites is empty although every site's
 * own database (site-…) and its address on the Vercel project still exist. GET shows what can be reconnected
 * (unlisted site databases, and listed sites without an address) with a suggested address for each; POST
 * reconnects them with the addresses chosen. Content, users and passwords live in each site's own database,
 * so they come back exactly as they were.
 */
async function ownerOnly(request: Request) {
  const check = await requirePlatformAdmin(request);
  if (check.error) return check;
  if (!check.site.isMain) return { error: jsonError('Only the platform owner can do this.', 403) };
  return check;
}

const label = (domain: string) => domain.split('.')[0];
/** The project domain that most likely belongs to a site: <slug>.vercel.app, or <slug> plus digits ("mayur-mate56"). */
function suggest(slug: string, free: string[]) {
  return free.find((d) => label(d) === slug) ?? free.find((d) => label(d).startsWith(slug) && /^\d+$/.test(label(d).slice(slug.length))) ?? '';
}

async function state() {
  const sites = await listSites();
  const listed = new Set(sites.map((s) => s.slug));
  const { found, failed } = await findUnlistedSiteDatabases(listed);
  const used = new Set(sites.map((s) => s.domain).filter(Boolean) as string[]);
  const domains = vercelApiConfigured() ? (await listProjectDomains().catch(() => [])).filter((d) => !used.has(d)) : [];
  // The main site's own address is never offered.
  const mainHost = new URL(SITE_URL).host.toLowerCase();
  const free = domains.filter((d) => d !== mainHost).sort();
  const withoutAddress = sites.filter((s) => !s.domain).map((s) => ({ slug: s.slug, name: s.name, ownerEmail: s.ownerEmail }));
  return {
    found: found.map((f) => ({ slug: f.slug, dbName: f.dbName, name: f.name, ownerEmail: f.ownerEmail, suggestedDomain: suggest(f.slug, free) })),
    withoutAddress: withoutAddress.map((s) => ({ ...s, suggestedDomain: suggest(s.slug, free) })),
    domains: free,
    canListDomains: vercelApiConfigured(),
    failed,
    raw: found,
  };
}

export async function GET(request: Request) {
  const check = await ownerOnly(request);
  if (check.error) return check.error;
  try {
    const { raw: _raw, ...rest } = await state();
    void _raw;
    return NextResponse.json(rest);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Could not look for site databases.', 502);
  }
}

const bodySchema = z.object({
  /** Chosen address per site slug ('' = none). Sites not mentioned get no address. */
  domains: z.record(z.string(), z.union([z.string().trim().toLowerCase().regex(/^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/), z.literal('')])).default({}),
}).strict();

export async function POST(request: Request) {
  const check = await ownerOnly(request);
  if (check.error) return check.error;
  const { data, error } = await parseBody(request, bodySchema);
  if (error) return error;
  const chosen = Object.values(data.domains).filter(Boolean);
  if (new Set(chosen).size !== chosen.length) return jsonError('Each address can belong to only one site.', 400);
  try {
    const now = await state();
    const allowed = new Set(now.domains);
    const pick = (slug: string) => {
      const d = data.domains[slug];
      return d && allowed.has(d) ? d : null;
    };
    const reconnected: string[] = [];
    const addressed: string[] = [];
    const failed = [...now.failed];
    for (const site of now.raw) {
      try {
        const dbToken = await siteDatabaseToken(site.dbName);
        await insertSite({
          slug: site.slug, name: site.name, ownerEmail: site.ownerEmail, domain: pick(site.slug), dbUrl: site.dbUrl, dbToken, dbName: site.dbName,
          status: 'active', createdAt: site.createdAt, createdBy: '', createdByUser: 'reconnected',
        });
        reconnected.push(site.slug);
      } catch (err) {
        failed.push({ dbName: site.dbName, reason: err instanceof Error ? err.message : 'could not add it' });
      }
    }
    for (const site of now.withoutAddress) {
      const domain = pick(site.slug);
      if (!domain) continue;
      try {
        await updateSite(site.slug, { domain });
        addressed.push(`${site.slug} → ${domain}`);
      } catch (err) {
        failed.push({ dbName: `site-${site.slug}`, reason: err instanceof Error ? err.message : 'could not set its address' });
      }
    }
    if (reconnected.length || addressed.length) {
      await logActivity(check.site, actorLabel(check.user), 'site.updated', {
        ...(reconnected.length ? { reconnected: reconnected.join(', ') } : {}), ...(addressed.length ? { addresses: addressed.join(', ') } : {}),
      }, { includeMain: true });
    }
    return NextResponse.json({ reconnected, addressed, failed });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Could not reconnect sites.', 502);
  }
}
