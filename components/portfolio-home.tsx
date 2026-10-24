import type { PortfolioData } from '@/lib/portfolio';
import type { SectionKey } from '@/lib/sections';
import { AskAssistant } from './ask-assistant';
import { ClassicAbout, ClassicContact, ClassicExperience, ClassicFooter, ClassicHero, ClassicProjects, ClassicShell, ClassicSkills } from './classic-sections';

/** The built-in classic homepage (used when no design is published in Admin → Design). */
export function PortfolioHome({ data, assistant = false }: { data: PortfolioData; assistant?: boolean }) {
  // Sections switched off in Admin (Site text → Sections on your site) aren't shown.
  const on = (key: SectionKey) => !data.hidden?.includes(key);
  return (
    <ClassicShell
      data={data}
      after={assistant && <AskAssistant name={data.profile.name} email={data.profile.socialLinks.email} linkedin={data.profile.socialLinks.linkedin} />}
    >
      <ClassicHero data={data} />
      {on('about') && <ClassicAbout data={data} />}
      {on('skills') && <ClassicSkills data={data} />}
      {on('projects') && <ClassicProjects data={data} />}
      {on('experience') && <ClassicExperience data={data} />}
      {on('contact') && <ClassicContact data={data} />}
      <ClassicFooter data={data} />
    </ClassicShell>
  );
}
