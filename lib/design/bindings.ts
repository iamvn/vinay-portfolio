import type { PortfolioData } from '@/lib/portfolio';

/**
 * Data bindings for Admin → Design: basic blocks (Heading, Text, Image, Button, Tags) can show a
 * piece of live portfolio content instead of fixed text. The content stays managed in the other
 * admin tabs; the design only decides where and how it appears.
 */
type P = PortfolioData;

export const TEXT_SOURCES: { value: string; label: string; get?: (p: P) => string }[] = [
  { value: 'custom', label: 'My own text (type it below)' },
  { value: 'name', label: 'Profile · Name', get: (p) => p.profile.name },
  { value: 'role', label: 'Profile · Role', get: (p) => p.profile.role },
  { value: 'summary', label: 'Profile · Summary', get: (p) => p.profile.summary },
  { value: 'location', label: 'Profile · Location', get: (p) => p.profile.location },
  { value: 'greeting', label: 'Site text · Greeting (“Hello, I’m”)', get: (p) => p.copy.hero.greeting },
  { value: 'availability', label: 'Site text · Availability line', get: (p) => (p.profile.available ? p.copy.hero.availability : '') },
  { value: 'years', label: 'Stat · Years of experience', get: (p) => p.profile.yearsExperience },
  { value: 'products', label: 'Stat · Products shipped', get: (p) => p.profile.productsShipped },
  { value: 'performance', label: 'Stat · Performance', get: (p) => p.profile.performanceMetric },
  { value: 'lighthouse', label: 'Stat · Lighthouse', get: (p) => p.profile.lighthouse },
  { value: 'users', label: 'Stat · Users impacted', get: (p) => p.profile.usersImpacted },
  { value: 'targetRoles', label: 'Hiring · Looking for', get: (p) => p.profile.targetRoles },
  { value: 'workPreference', label: 'Hiring · Location & work mode', get: (p) => p.profile.workPreference },
  { value: 'availabilityNote', label: 'Hiring · Availability', get: (p) => p.profile.availability },
  { value: 'noticePeriod', label: 'Hiring · Notice period', get: (p) => p.profile.noticePeriod },
  { value: 'skillsTitle', label: 'Site text · Skills title', get: (p) => p.copy.skills.title },
  { value: 'projectsTitle', label: 'Site text · Projects title', get: (p) => p.copy.projects.title },
  { value: 'experienceTitle', label: 'Site text · Experience title', get: (p) => p.copy.experience.title },
  { value: 'contactTitle', label: 'Site text · Contact title', get: (p) => p.copy.contact.title },
  { value: 'contactDescription', label: 'Site text · Contact description', get: (p) => p.copy.contact.description },
  { value: 'footer', label: 'Site text · Footer', get: (p) => p.copy.footer },
];

/** The text a block shows: live data for a bound source, otherwise its own text. */
export function boundText(source: string | undefined, custom: string, portfolio: P) {
  const binding = TEXT_SOURCES.find((item) => item.value === source);
  return binding?.get ? binding.get(portfolio) : custom;
}

export const IMAGE_SOURCES = [
  { value: 'custom', label: 'Image URL (below)' },
  { value: 'profilePhoto', label: 'Profile photo' },
];

const mailto = (email?: string | null) => (email ? (email.startsWith('mailto:') ? email : `mailto:${email}`) : undefined);

/** What a Button does. "custom" uses the link typed in its settings. */
export const BUTTON_ACTIONS: { value: string; label: string; defaultLabel: string; icon: string; href?: (p: P) => string | undefined; external?: boolean }[] = [
  { value: 'custom', label: 'Open a link (below)', defaultLabel: 'Button', icon: '' },
  { value: 'email', label: 'Email me', defaultLabel: 'Email me', icon: 'mail', href: (p) => mailto(p.profile.socialLinks.email) },
  { value: 'linkedin', label: 'LinkedIn profile', defaultLabel: 'LinkedIn', icon: 'linkedin', href: (p) => p.profile.socialLinks.linkedin ?? undefined, external: true },
  { value: 'github', label: 'GitHub profile', defaultLabel: 'GitHub', icon: 'github', href: (p) => p.profile.socialLinks.github ?? undefined, external: true },
  { value: 'instagram', label: 'Instagram profile', defaultLabel: 'Instagram', icon: 'instagram', href: (p) => p.profile.socialLinks.instagram ?? undefined, external: true },
  { value: 'resume', label: 'Download resume', defaultLabel: 'Download resume', icon: 'download', href: () => '/api/resume' },
  { value: 'projects', label: 'Jump to projects', defaultLabel: 'View my work', icon: '', href: () => '#projects' },
  { value: 'contact', label: 'Jump to contact', defaultLabel: 'Get in touch', icon: '', href: () => '#contact' },
];

export const TAG_SOURCES = [
  { value: 'technologies', label: 'Hero technologies (site text)' },
  { value: 'skills', label: 'All skills' },
  { value: 'custom', label: 'My own list (below)' },
];

export function boundTags(source: string | undefined, custom: { text: string }[] | undefined, portfolio: P) {
  if (source === 'technologies') return portfolio.copy.hero.technologies;
  if (source === 'skills') return [...new Set(portfolio.skills.flatMap((group) => group.items))];
  return (custom ?? []).map((item) => item.text).filter(Boolean);
}
