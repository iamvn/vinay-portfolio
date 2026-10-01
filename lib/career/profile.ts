import { getPortfolioFromDatabase } from '@/lib/portfolio-repository';
import { evidenceFromProfile, type EvidenceItem } from './evidence';

/** The master career profile as evidence (Admin → Profile, Experience, Projects incl. drafts, Skills). */
export async function careerEvidence(): Promise<EvidenceItem[]> {
  const portfolio = await getPortfolioFromDatabase({ includeDrafts: true });
  return evidenceFromProfile({
    profile: portfolio.profile,
    experience: portfolio.experience,
    projects: portfolio.projects,
    skills: portfolio.skills,
  });
}
