import { SITE_URL } from './seo';

/**
 * The platform's own brand. Every site made on it is "Built on Kritipath", and that credit is fixed in code
 * (components/platform-badge.tsx): no setting, design or template can remove it.
 */
export const BRAND = {
  name: 'Kritipath',
  /** कृतिपथ: कृति (kriti, your work and achievements) + पथ (path). */
  nameHindi: 'कृतिपथ',
  meaning: 'Kriti (कृति) means your work and achievements; path (पथ) is the road ahead. Kritipath is the path your work builds.',
  tagline: 'Your work. Your story. One path forward.',
  description:
    'Kritipath is the operating system for your career, not a job board: one profile powers a portfolio site you own, ATS-ready resumes, an AI assistant that answers recruiters, an application pipeline and a prep plan.',
  founder: { name: 'Vinay Bharti', title: 'Founder & Creator' },
  /** The company page, on the main site. */
  path: '/kritipath',
  founded: 2026,
} as const;

/** The company page's full address (sites on other domains link here). */
export const brandUrl = (source = '') => `${SITE_URL}${BRAND.path}${source ? `?utm_source=${encodeURIComponent(source)}&utm_medium=referral` : ''}`;
