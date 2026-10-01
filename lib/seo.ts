import type { PortfolioData } from './schemas';

// Public address of the site. Used for canonical URLs, the sitemap, social previews and structured data.
// Set NEXT_PUBLIC_SITE_URL if the site moves to another domain.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vinay-bharti.vercel.app').replace(/\/+$/, '');

export const absoluteUrl = (path: string, base = SITE_URL) => (/^https?:\/\//i.test(path) ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`);

type Profile = PortfolioData['profile'];
type Skills = PortfolioData['skills'];

const allSkills = (skills: Skills) => [...new Set(skills.flatMap((group) => group.items).map((item) => item.trim()).filter(Boolean))];
const hasAi = (skills: Skills) => skills.some((group) => /\bAI\b/.test(group.group) || group.items.some((item) => /\bAI\b/.test(item)));
const joinList = (items: string[], last = 'and') => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${last} ${items.at(-1)}`);

/** Main technologies: the first few items of the first skill group, e.g. React, Next.js, TypeScript. */
export const mainTechnologies = (skills: Skills, count = 3) => (skills[0]?.items ?? []).map((item) => item.trim()).filter(Boolean).slice(0, count);

/** "Vinay Bharti | Senior Software Engineer | React, Next.js & AI" — built from the profile and skills. */
export function homeTitle(profile: Profile, skills: Skills) {
  const focus = [...mainTechnologies(skills, 2), ...(hasAi(skills) ? ['AI'] : [])];
  return [profile.name, profile.role, focus.length ? joinList(focus, '&') : ''].filter(Boolean).join(' | ');
}

export function homeDescription(profile: Profile, skills: Skills) {
  const focus = [...mainTechnologies(skills, 3), ...(hasAi(skills) ? ['AI engineering'] : [])];
  const firstName = profile.name.split(' ')[0] || profile.name;
  const lead = focus.length ? `${profile.role} specializing in ${joinList(focus)}.` : `${profile.role}.`;
  return `${lead} Explore ${firstName}'s experience, projects, frontend architecture and engineering work.`;
}

/** Keeps a description within the length search engines show (about 160 characters). */
export function clip(text: string, max = 160) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`;
}

/** Serialises JSON-LD safely for an inline <script> tag. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

function address(location: string) {
  const [locality, ...rest] = location.split(',').map((part) => part.trim()).filter(Boolean);
  if (!locality) return undefined;
  const country = rest.at(-1);
  const code = country && /^india$/i.test(country) ? 'IN' : country;
  return { '@type': 'PostalAddress', addressLocality: locality, ...(code ? { addressCountry: code } : {}) };
}

/** Person + WebSite structured data, generated only from what the portfolio actually shows. */
export function personJsonLd(data: PortfolioData, SITE = SITE_URL) {
  const { profile, skills, experience } = data;
  const links = profile.socialLinks ?? {};
  const sameAs = [links.github, links.linkedin, links.instagram].filter((link): link is string => Boolean(link));
  const current = experience.find((item) => item.current);
  const employer = current?.company.replace(/\s*\(.*\)\s*$/, '').trim();
  const person = {
    '@type': 'Person',
    '@id': `${SITE}/#person`,
    name: profile.name,
    jobTitle: profile.role,
    url: `${SITE}/`,
    description: profile.summary,
    ...(profile.profileImage ? { image: absoluteUrl(profile.profileImage, SITE) } : {}),
    ...(links.email ? { email: links.email.startsWith('mailto:') ? links.email : `mailto:${links.email}` } : {}),
    ...(address(profile.location) ? { address: address(profile.location) } : {}),
    ...(employer ? { worksFor: { '@type': 'Organization', name: employer } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    knowsAbout: allSkills(skills),
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      person,
      { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: `${profile.name} — ${profile.role}`, author: { '@id': `${SITE}/#person` }, inLanguage: 'en' },
      { '@type': 'ProfilePage', '@id': `${SITE}/#profilepage`, url: `${SITE}/`, name: homeTitle(profile, skills), mainEntity: { '@id': `${SITE}/#person` }, isPartOf: { '@id': `${SITE}/#website` } },
    ],
  };
}
