import { getPortfolioFromDatabase } from '@/lib/portfolio-repository';
import { resolvePortfolio } from '@/lib/placeholders';
import { resumeFromPortfolio } from './from-portfolio';
import { currentSiteUrl } from '@/lib/sites/url';
import { toTypst } from './typst';
import type { ResumeDocument } from './types';

/** The Typst code a resume compiles: its edited code, or code generated from its form content. */
export const sourceFor = (resume: Pick<ResumeDocument, 'code' | 'data' | 'template' | 'name'>) =>
  resume.code ?? toTypst(resume.data, resume.template, resume.name);

/** Fresh resume content from the portfolio (Profile, Experience, Skills, Projects). */
export async function contentFromPortfolio() {
  return resumeFromPortfolio(resolvePortfolio(await getPortfolioFromDatabase()), await currentSiteUrl());
}

/** "Vinay Bharti – Frontend at Acme" → "Vinay-Bharti-Frontend-at-Acme" for file names. */
export const fileSlug = (value: string) => value.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').slice(0, 80) || 'resume';
