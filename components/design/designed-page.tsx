import type { ComponentType } from 'react';
import { Render, type Config } from '@puckeditor/core';
import type { PortfolioData } from '@/lib/portfolio';
import type { DesignData } from '@/lib/design/templates';
import type { ProjectView } from '@/lib/design/project-view';
import { designConfig, type DesignMetadata } from './config';

/**
 * The editor config for the publish checklist's audit: every block wrapped in a `display: contents` div
 * that carries its id, so a problem found on the rendered page points back to its block. Same layout.
 */
let auditConfig: Config | null = null;
function withBlockIds(): Config {
  if (auditConfig) return auditConfig;
  const components = Object.fromEntries(Object.entries(designConfig.components as unknown as Record<string, { render: ComponentType<Record<string, unknown>> }>).map(([name, component]) => {
    const Inner = component.render;
    const Tagged = (props: Record<string, unknown>) => (
      <div data-bid={typeof props.id === 'string' ? props.id : undefined} data-btype={name} style={{ display: 'contents' }}><Inner {...props} /></div>
    );
    return [name, { ...component, render: Tagged }];
  }));
  auditConfig = { ...designConfig, components } as unknown as Config;
  return auditConfig;
}

/** A design from Admin → Design, rendered on the server with the live portfolio content (and, on project pages, the project). */
export function DesignedPage({ data, portfolio, assistant, audit = false, project }: { data: DesignData; portfolio: PortfolioData; assistant: boolean; audit?: boolean; project?: ProjectView }) {
  const metadata: DesignMetadata = { portfolio, assistant, ...(project ? { project } : {}) };
  return <Render config={audit ? withBlockIds() : designConfig} data={data} metadata={metadata} />;
}
