import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, parseBody } from '@/lib/api-utils';
import { requirePlatformOwner } from '@/lib/sites/platform';
import { CLEANUP_DAYS, CLEANUP_KINDS, cleanup, type CleanupKind } from '@/lib/sites/database';
import { actorLabel, logActivity } from '@/lib/sites/activity';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  kind: z.enum(Object.keys(CLEANUP_KINDS) as [CleanupKind, ...CleanupKind[]]),
  days: z.number().int().refine((d) => (CLEANUP_DAYS as readonly number[]).includes(d), 'Pick 30, 90, 180 or 365 days'),
  scope: z.string().regex(/^(all|main|[a-z0-9-]{1,64})$/),
  dryRun: z.boolean(),
  confirm: z.string().optional(),
}).strict();

/** Platform owner only: preview (dryRun) or delete old logs. Deleting needs confirm: "DELETE". */
export async function POST(request: Request) {
  const { user, site, error } = await requirePlatformOwner(request);
  if (error) return error;
  const { data, error: invalid } = await parseBody(request, schema);
  if (invalid) return invalid;
  if (!data.dryRun && data.confirm?.trim().toUpperCase() !== 'DELETE') return jsonError('Type DELETE to confirm.', 400);
  try {
    const result = await cleanup(data.kind, data.days, data.scope, data.dryRun);
    if (!data.dryRun) {
      await logActivity(site, actorLabel(user), 'data.cleaned', {
        what: CLEANUP_KINDS[data.kind].label, olderThan: `${result.days} days`, deleted: String(result.total),
        sites: data.scope === 'all' ? 'all sites' : data.scope,
      }, { includeMain: true });
    }
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Cleanup failed.', 502);
  }
}
