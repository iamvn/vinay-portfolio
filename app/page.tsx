import { PortfolioHome } from '@/components/portfolio-home';
import { getPortfolioFromApi } from '@/lib/portfolio-api';

export default async function HomePage() {
  const data = await getPortfolioFromApi();
  return <PortfolioHome data={data} />;
}
