import type { PortfolioData } from '@/lib/portfolio';
import { SECTION_IDS, resumeDataSchema, type ResumeData } from './types';

const clean = (value: string | null | undefined) => (value ?? '').trim();
const MAX_PROJECTS_SHOWN = 3;

/** Fills a new resume from the portfolio (Profile, Experience, Skills and Projects tabs). */
export function resumeFromPortfolio(portfolio: PortfolioData, siteUrl = ''): ResumeData {
  const { profile, experience, skills, projects } = portfolio;
  const social = profile.socialLinks ?? {};
  const links = [
    social.linkedin ? { label: 'LinkedIn', url: clean(social.linkedin) } : null,
    social.github ? { label: 'GitHub', url: clean(social.github) } : null,
    siteUrl ? { label: 'Portfolio', url: siteUrl } : null,
  ].filter((link): link is { label: string; url: string } => Boolean(link));

  const published = projects.filter((project) => project.published !== false);
  // Featured projects first, then the rest; only the first few are shown (the others can be ticked on).
  const ordered = [...published.filter((p) => p.featured), ...published.filter((p) => !p.featured)];

  return resumeDataSchema.parse({
    basics: {
      name: clean(profile.name),
      headline: clean(profile.targetRoles) || clean(profile.role),
      email: clean(social.email).replace(/^mailto:/i, ''),
      phone: '',
      location: clean(profile.location),
      links,
      summary: clean(profile.summary),
    },
    experience: experience.map((item) => ({
      role: item.role, company: item.company, location: '', period: item.period,
      bullets: item.bullets.map(clean).filter(Boolean),
    })),
    projects: ordered.map((project, index) => ({
      name: project.title,
      tech: project.stack.join(', '),
      link: clean(project.liveUrl) || clean(project.repoUrl) || clean(project.externalUrl),
      bullets: [project.description, project.result].map(clean).filter(Boolean),
      hidden: index >= MAX_PROJECTS_SHOWN,
    })),
    skills: skills.map((group) => ({ group: group.group, items: group.items.join(', ') })),
    education: [],
    extras: [],
    layout: { order: [...SECTION_IDS], hidden: [], paper: 'a4' }, // empty sections are skipped automatically
  });
}
