import { TAB_IDS, TAB_LABELS, allowedTabs, parseSiteTabs, type TabId } from '@/lib/auth/permissions';
import type { SessionUser } from '@/lib/auth/session';
import { FEATURE_INFO, SITE_FEATURES, siteFeatures, type SiteFeature } from '@/lib/sites/features';
import type { Site } from '@/lib/sites/registry';

/**
 * What this person can't use, and who can change that:
 *   'site'  the platform owner turned it off for the whole site (ask from the Support tab);
 *   'user'  the site has it, but this person's own access doesn't include it (their site admin decides);
 *   'tab'   a feature whose tab this person can't open.
 */
export type Missing = {
  tabs: { id: TabId; label: string; reason: 'site' | 'user' }[];
  features: { id: SiteFeature; label: string; summary: string; tab: TabId; reason: 'site' | 'tab' }[];
  /** Whether requests go to someone else (not on the main site's owner account). */
  canRequest: boolean;
};

export function missingFor(user: SessionUser, site: Site, isOwner: boolean): Missing {
  const siteTabs = parseSiteTabs(site.tabs) ?? [...TAB_IDS];
  const mine = allowedTabs({ ...user, siteTabs: site.tabs }); // the fresh site row, not the cached one
  const on = siteFeatures(site);
  return {
    tabs: TAB_IDS.filter((t) => !mine.includes(t)).map((t) => ({ id: t, label: TAB_LABELS[t], reason: siteTabs.includes(t) ? 'user' : 'site' })),
    features: SITE_FEATURES.filter((f) => !on.includes(f) || !mine.includes(FEATURE_INFO[f].tab)).map((f) => ({
      id: f, ...FEATURE_INFO[f], reason: on.includes(f) ? 'tab' : 'site',
    })),
    canRequest: !isOwner,
  };
}
