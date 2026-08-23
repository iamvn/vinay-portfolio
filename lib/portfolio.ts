import data from '@/data/portfolio.json';

export type PortfolioData = typeof data;

export async function getPortfolio(): Promise<PortfolioData> {
  return data;
}

export async function getProject(slug: string) {
  const project = data.projects.find((item) => item.slug === slug);
  return project ?? null;
}
