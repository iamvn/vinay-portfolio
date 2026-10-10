import type { TabId } from '@/lib/auth/permissions';

/**
 * Extra features the platform owner turns on per site (Sites → Security → Extra features), on top of the
 * tabs a site may use. Off by default for other sites; always on for the main site. Safe in the browser.
 */
export const SITE_FEATURES = ['aiTemplates'] as const;
export type SiteFeature = (typeof SITE_FEATURES)[number];

export const FEATURE_INFO: Record<SiteFeature, { label: string; tab: TabId; summary: string }> = {
  aiTemplates: {
    label: 'Create a template with AI',
    tab: 'design',
    summary: 'Describe a theme (a streaming app, cricket, a newspaper…) and AI turns it into a design template.',
  },
};

export const parseFeatures = (raw: string | null | undefined): SiteFeature[] =>
  String(raw ?? '').split(',').map((f) => f.trim()).filter((f): f is SiteFeature => (SITE_FEATURES as readonly string[]).includes(f));
export const serializeFeatures = (features: readonly string[]) => SITE_FEATURES.filter((f) => features.includes(f)).join(',');

/** The features a site has: every one for the main site. */
export const siteFeatures = (site: { isMain: boolean; features?: string | null }): SiteFeature[] =>
  (site.isMain ? [...SITE_FEATURES] : parseFeatures(site.features));
