import { getDraft, getPublished, type DesignScope } from './store';
import { DEFAULT_TEMPLATE_ID, templateById, type DesignData } from './templates';
import { projectChoices, projectView, type ProjectView } from './project-view';

/**
 * What the design editor (and the draft preview) start from for a page:
 *   homepage            its draft, else the Classic template
 *   project pages       their draft, else what's live, else the Classic project page
 *   one project         its own draft / live design, else a copy of the shared project design
 * plus, for project pages, the project shown while editing ("Preview with").
 */
export async function editorStart(scope: DesignScope, sample?: string | null) {
  const pick = async (s: DesignScope) => (await getDraft(s)) ?? (await getPublished(s));
  let start: { data: DesignData; savedAt: string | null } | null = null;
  if (scope === 'home') {
    const draft = await getDraft('home');
    start = draft ? { data: draft.data, savedAt: draft.savedAt } : null;
  } else {
    const own = await pick(scope);
    const shared = scope === 'project' ? null : await pick('project');
    start = own ? { data: own.data, savedAt: (await getDraft(scope))?.savedAt ?? null } : shared ? { data: structuredClone(shared.data), savedAt: null } : null;
  }
  const fallback = templateById(scope === 'home' ? DEFAULT_TEMPLATE_ID : 'project-classic')!.data;
  const published = await getPublished(scope);

  let project: ProjectView | null = null;
  // Every page's switcher lists the projects (to jump to one's own design).
  const choices = await projectChoices();
  if (scope !== 'home') {
    const slug = scope.startsWith('project:') ? scope.slice('project:'.length) : choices.find((c) => c.slug === sample)?.slug ?? choices.find((c) => c.published)?.slug ?? choices[0]?.slug;
    project = slug ? await projectView(slug) : null;
  }
  return { data: start?.data ?? structuredClone(fallback), savedAt: start?.savedAt ?? null, isLive: Boolean(published), project, choices };
}
