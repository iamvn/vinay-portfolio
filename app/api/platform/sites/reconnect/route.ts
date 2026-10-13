import { NextResponse } from 'next/server';
import { jsonError } from '@/lib/api-utils';
import { insertSite, listSites } from '@/lib/sites/registry';
import { findUnlistedSiteDatabases, siteDatabaseToken } from '@/lib/sites/provision';
import { requirePlatformAdmin } from '@/lib/sites/platform';
import { actorLabel, logActivity } from '@/lib/sites/activity';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Platform owner only: site databases in Turso that the list of sites doesn't know about (GET), and reconnecting them (POST). */
async function ownerOnly(request: Request) {
  const check = await requirePlatformAdmin(request);
  if (check.error) return check;
  if (!check.site.isMain) return { error: jsonError('Only the platform owner can do this.', 403) };
  return check;
}

export async function GET(request: Request) {
  const check = await ownerOnly(request);
  if (check.error) return check.error;
  try {
    const listed = new Set((await listSites()).map((s) => s.slug));
    return NextResponse.json(await findUnlistedSiteDatabases(listed));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Could not look for site databases.', 502);
  }
}

/** Adds every unlisted site database back to the list, with its content and users as they are. Safe to repeat. */
export async function POST(request: Request) {
  const check = await ownerOnly(request);
  if (check.error) return check.error;
  try {
    const listed = new Set((await listSites()).map((s) => s.slug));
    const { found, failed } = await findUnlistedSiteDatabases(listed);
    const reconnected: string[] = [];
    for (const site of found) {
      try {
        const dbToken = await siteDatabaseToken(site.dbName);
        await insertSite({
          slug: site.slug, name: site.name, ownerEmail: site.ownerEmail, domain: null, dbUrl: site.dbUrl, dbToken, dbName: site.dbName,
          status: 'active', createdAt: site.createdAt, createdBy: '', createdByUser: 'reconnected',
        });
        reconnected.push(site.slug);
      } catch (error) {
        failed.push({ dbName: site.dbName, reason: error instanceof Error ? error.message : 'could not add it' });
      }
    }
    if (reconnected.length) await logActivity(check.site, actorLabel(check.user), 'site.updated', { reconnected: reconnected.join(', ') }, { includeMain: true });
    return NextResponse.json({ reconnected, failed });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Could not reconnect sites.', 502);
  }
}
