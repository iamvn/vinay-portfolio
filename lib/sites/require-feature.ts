import { jsonError } from '@/lib/api-utils';
import { currentSite } from './context';
import { FEATURE_INFO, siteFeatures, type SiteFeature } from './features';
import { siteBySlug } from './registry';

/** The current site, read fresh: a feature the platform owner just turned on or off applies at once. */
export async function freshSite() {
  const site = await currentSite();
  return site.isMain ? site : (await siteBySlug(site.slug, true)) ?? site;
}

export const hasFeature = async (feature: SiteFeature) => siteFeatures(await freshSite()).includes(feature);

/** A 403 response when the current site doesn't have this feature (the platform owner turns it on), else null. */
export async function featureOff(feature: SiteFeature): Promise<Response | null> {
  if (await hasFeature(feature)) return null;
  return jsonError(`“${FEATURE_INFO[feature].label}” isn’t turned on for this site. Ask the platform owner from the Support tab.`, 403);
}
