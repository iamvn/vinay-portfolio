import type { PortfolioData } from '@/lib/portfolio';
import { AskAssistant } from './ask-assistant';
import { ClassicAbout, ClassicContact, ClassicExperience, ClassicFooter, ClassicHero, ClassicProjects, ClassicShell, ClassicSkills } from './classic-sections';

/** The built-in classic homepage (used when no design is published in Admin → Design). */
export function PortfolioHome({ data, assistant = false }: { data: PortfolioData; assistant?: boolean }) {
  return (
    <ClassicShell
      data={data}
      after={assistant && <AskAssistant name={data.profile.name} email={data.profile.socialLinks.email} linkedin={data.profile.socialLinks.linkedin} />}
    >
      <ClassicHero data={data} />
      <ClassicAbout data={data} />
      <ClassicSkills data={data} />
      <ClassicProjects data={data} />
      <ClassicExperience data={data} />
      <ClassicContact data={data} />
      <ClassicFooter data={data} />
    </ClassicShell>
  );
}
