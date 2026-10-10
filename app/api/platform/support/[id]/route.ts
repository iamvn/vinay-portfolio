import { NextResponse } from 'next/server';
import { handleDbError, jsonError, parseBody } from '@/lib/api-utils';
import { TAB_IDS, TAB_LABELS, parseSiteTabs, serializeSiteTabs } from '@/lib/auth/permissions';
import { actorLabel, logActivity } from '@/lib/sites/activity';
import { FEATURE_INFO, parseFeatures, serializeFeatures } from '@/lib/sites/features';
import { requirePlatformAdmin } from '@/lib/sites/platform';
import { siteBySlug, updateSite } from '@/lib/sites/registry';
import { answerRequest, getRequest, removeRequest } from '@/lib/support/store';
import { KIND_LABELS, STATUS_LABELS, answerSchema, parseTarget } from '@/lib/support/types';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

async function owner(request: Request) {
  const { user, site, error } = await requirePlatformAdmin(request);
  if (error) return { error };
  return site.isMain ? { user, site } : { error: jsonError('Only the platform owner answers support requests.', 403) };
}

/**
 * Answer a request: change its status, reply, or (access requests) `grant: true` to turn the tab or feature
 * on for the site that asked, which also marks it done.
 */
export async function PATCH(request: Request, { params }: Context) {
  const { user, site: manager, error: denied } = await owner(request);
  if (denied) return denied;
  const { data, error } = await parseBody(request, answerSchema);
  if (error) return error;
  try {
    const id = (await params).id;
    const current = await getRequest(id);
    if (!current) return jsonError('Request not found.', 404);
    let granted = '';
    if (data.grant) {
      const target = parseTarget(current.target);
      if (current.kind !== 'access' || !target) return jsonError('Only access requests can be granted.', 400);
      const site = await siteBySlug(current.site, true);
      if (!site) return jsonError('That site no longer exists.', 404);
      if (site.isMain) return jsonError('The main site already has every tab and feature: give the person access in Users & security.', 400);
      if (target.type === 'tab') {
        const tabs = parseSiteTabs(site.tabs) ?? [...TAB_IDS];
        if (!tabs.includes(target.id)) await updateSite(site.slug, { tabs: serializeSiteTabs([...tabs, target.id]) });
        granted = TAB_LABELS[target.id];
      } else {
        const features = parseFeatures(site.features);
        if (!features.includes(target.id)) await updateSite(site.slug, { features: serializeFeatures([...features, target.id]) });
        granted = FEATURE_INFO[target.id].label;
      }
      await logActivity(manager, actorLabel(user), 'site.updated', { slug: site.slug, name: site.name, [target.type === 'tab' ? 'tabs' : 'features']: `+ ${granted}` }, { includeMain: true });
    }
    const status = data.status ?? (granted ? 'done' : undefined);
    const reply = data.reply ?? (granted && !current.reply ? `Turned on ${granted} for ${current.siteName}. Reload your admin to see it.` : undefined);
    const next = await answerRequest(id, { ...(status ? { status } : {}), ...(reply !== undefined ? { reply } : {}) });
    if (next && (status !== current.status || (reply !== undefined && reply !== current.reply))) {
      await logActivity(manager, actorLabel(user), 'support.answered', {
        subject: next.subject, kind: KIND_LABELS[next.kind], status: STATUS_LABELS[next.status], ...(granted ? { granted } : {}),
      }, { includeMain: true });
    }
    return next ? NextResponse.json(next) : jsonError('Request not found.', 404);
  } catch (err) {
    return handleDbError(err);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const { error: denied } = await owner(request);
  if (denied) return denied;
  try {
    return (await removeRequest((await params).id)) ? new Response(null, { status: 204 }) : jsonError('Request not found.', 404);
  } catch (err) {
    return handleDbError(err);
  }
}
