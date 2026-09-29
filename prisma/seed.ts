import 'dotenv/config';
import data from '../data/portfolio.json';
import { portfolioSchema } from '../lib/schemas';
import { replacePortfolio } from '../lib/portfolio-repository';
import { prisma } from '../lib/prisma';

async function main() {
  await replacePortfolio(portfolioSchema.parse(data));
  console.log('Seeded portfolio data.');
}

main().finally(() => prisma.$disconnect());
