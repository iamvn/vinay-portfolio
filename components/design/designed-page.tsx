import { Render } from '@puckeditor/core';
import type { PortfolioData } from '@/lib/portfolio';
import type { DesignData } from '@/lib/design/templates';
import { designConfig, type DesignMetadata } from './config';

/** A design from Admin → Design, rendered on the server with the live portfolio content. */
export function DesignedPage({ data, portfolio, assistant }: { data: DesignData; portfolio: PortfolioData; assistant: boolean }) {
  const metadata: DesignMetadata = { portfolio, assistant };
  return <Render config={designConfig} data={data} metadata={metadata} />;
}
