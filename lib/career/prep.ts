import { prisma } from '@/lib/prisma';
import { listApplications, parsePrep, saveApplication } from './applications';
import { STATUS_LABELS, type ApplicationStatus, type Prep, type PrepLink, type PrepQuestion } from './types';

/**
 * The question bank: every question you were asked (or want to practise) and every prep link, from all
 * applications plus your general prep that isn't tied to one job (Setting "career.prep").
 */
const KEY = 'career.prep';

export async function getGeneralPrep(): Promise<Prep> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  return parsePrep(row?.value);
}

export async function saveGeneralPrep(prep: Prep) {
  const value = JSON.stringify(prep);
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

/** Where an entry comes from: one application, or the general prep (appId null). */
export type BankSource = { appId: number | null; company: string; role: string; status: ApplicationStatus | null; statusLabel: string };
export type BankQuestion = PrepQuestion & BankSource;
export type BankLink = PrepLink & BankSource;

export async function questionBank() {
  const [apps, general] = await Promise.all([listApplications(), getGeneralPrep()]);
  const sources: [BankSource, Prep][] = [
    [{ appId: null, company: '', role: 'General prep', status: null, statusLabel: '' }, general],
    ...apps.map((app): [BankSource, Prep] => [{ appId: app.id, company: app.company, role: app.role, status: app.status, statusLabel: STATUS_LABELS[app.status] }, app.prep]),
  ];
  const questions: BankQuestion[] = sources.flatMap(([source, prep]) => prep.questions.map((q) => ({ ...q, ...source })));
  // Newest first (by the date you gave, else keep the order you added them).
  questions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const links: BankLink[] = sources.flatMap(([source, prep]) => prep.links.map((link) => ({ ...link, ...source })));
  return { questions, links, general };
}

/** Ticks a question as practised (or not) wherever it lives. Returns false when it no longer exists. */
export async function setPracticed(appId: number | null, questionId: string, practiced: boolean): Promise<boolean> {
  const mark = (prep: Prep) => {
    const q = prep.questions.find((item) => item.id === questionId);
    if (!q) return false;
    q.practiced = practiced;
    return true;
  };
  if (appId === null) {
    const general = await getGeneralPrep();
    if (!mark(general)) return false;
    await saveGeneralPrep(general);
    return true;
  }
  const app = (await listApplications()).find((a) => a.id === appId);
  if (!app || !mark(app.prep)) return false;
  await saveApplication(app);
  return true;
}
