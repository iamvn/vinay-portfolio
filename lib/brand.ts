import { SITE_URL } from './seo';

/**
 * The platform's own brand. Every site made on it is "Built on Careerloom", and that credit is fixed in code
 * (components/platform-badge.tsx): no setting, design or template can remove it.
 */
export const BRAND = {
  name: 'Careerloom',
  tagline: 'Your whole career, woven into one place.',
  description:
    'Careerloom is a complete career suite: a portfolio website you design yourself, ATS-ready resumes, an AI assistant that answers recruiters, a job application tracker and a community of real interview experiences.',
  founder: { name: 'Vinay Bharti', title: 'Founder & Creator' },
  /** The company page, on the main site. */
  path: '/careerloom',
  founded: 2026,
} as const;

/** The company page's full address (sites on other domains link here). */
export const brandUrl = (source = '') => `${SITE_URL}${BRAND.path}${source ? `?utm_source=${encodeURIComponent(source)}&utm_medium=referral` : ''}`;
