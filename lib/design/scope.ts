import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/api-utils';
import { projectScope, type DesignScope } from './store';

/**
 * Which page a design request is about, from the query string:
 *   (nothing)                      the homepage
 *   ?page=project                  the shared design of every project page
 *   ?page=project&project=<slug>   one project's own design
 */
export const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

export async function scopeFromParams(params: URLSearchParams): Promise<{ scope: DesignScope; error?: never } | { scope?: never; error: Response }> {
  const page = params.get('page');
  if (!page || page === 'home') return { scope: 'home' };
  if (page !== 'project') return { error: jsonError('Unknown page.', 400) };
  const slug = params.get('project');
  if (!slug) return { scope: 'project' };
  if (!SLUG.test(slug)) return { error: jsonError('Unknown project.', 404) };
  const project = await prisma.project.findUnique({ where: { slug }, select: { slug: true } });
  if (!project) return { error: jsonError('Unknown project.', 404) };
  return { scope: projectScope(slug) };
}

export const scopeFromRequest = (request: Request) => scopeFromParams(new URL(request.url).searchParams);

/** Query string for a scope (for links between admin pages). */
export function scopeQuery(scope: DesignScope): string {
  if (scope === 'home') return '';
  if (scope === 'project') return 'page=project';
  return `page=project&project=${encodeURIComponent(scope.slice('project:'.length))}`;
}

/** Pages to refresh after publishing a scope. */
export const pathsFor = (scope: DesignScope) => (scope === 'home' ? ['/'] : scope === 'project' ? ['/projects/[slug]'] : [`/projects/${scope.slice('project:'.length)}`]);
