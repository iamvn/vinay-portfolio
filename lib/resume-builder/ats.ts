import { visibleSections, type ResumeData } from './types';
import { hasTerm, jobKeywords, normalize, readJob, titleMatch, type JobInfo, type JobKeyword } from './keywords';

export { normalize };

/**
 * ATS check (runs in the browser, instantly): how well a resume matches a job description, and
 * whether it follows the rules applicant tracking systems and recruiters reward.
 *
 *   score = 60% keyword match + 40% format checks   (with a job description)
 *   score = format checks only                        (without one)
 */

export type CheckStatus = 'pass' | 'warn' | 'fail';
export type AtsCheck = { id: string; label: string; status: CheckStatus; detail: string; tip?: string; weight: number };
export type AtsReport = {
  score: number;
  formatScore: number;
  keywordScore: number | null;
  matched: string[];
  missing: string[];
  keywords: KeywordResult[];
  job: JobInfo | null;
  checks: AtsCheck[];
  words: number;
};

const ACTION_VERBS = new Set(`accelerated achieved added advised analysed analyzed architected automated boosted built championed coached collaborated
configured consolidated contributed converted coordinated created cut debugged decreased defined delivered deployed designed developed devised directed
drove eliminated enabled engineered enhanced established evaluated expanded facilitated grew guided halved identified implemented improved increased
initiated integrated introduced launched led maintained managed mentored migrated modernised modernized monitored optimised optimized orchestrated
organised organized overhauled owned partnered pioneered planned prototyped published rebuilt redesigned reduced refactored resolved restructured revamped
saved scaled secured shipped simplified spearheaded standardised standardized streamlined strengthened supported tested trained transformed tuned upgraded
wrote build develop design lead own drive create implement deliver maintain manage mentor migrate optimize optimise improve architect ship scale automate
collaborate partner define establish integrate launch reduce increase used`.split(/\s+/));

export const WEAK_PHRASES = ['responsible for', 'worked on', 'worked with', 'helped with', 'helped', 'involved in', 'duties included', 'tasked with', 'various'];
export const isWeakBullet = (bullet: string) => WEAK_PHRASES.some((phrase) => new RegExp(`\\b${phrase}\\b`, 'i').test(bullet));

const wordsOf = (text: string) => text.split(/\s+/).filter(Boolean);
export const hasNumber = (text: string) => /\d|%|\$|₹|€|£|\bdoubled\b|\btripled\b|\bhalved\b/i.test(text);
const firstWord = (bullet: string) => bullet.replace(/^[^A-Za-z]+/, '').split(/\s+/)[0]?.toLowerCase() ?? '';
export const startsWithVerb = (bullet: string) => { const word = firstWord(bullet); return ACTION_VERBS.has(word) || /^[a-z]{4,}ed$/.test(word); };

export type KeywordResult = JobKeyword & { found: boolean };

/** Years of experience from the roles' dates (earliest year to now). */
export function resumeYears(data: ResumeData, now = new Date().getFullYear()): number | null {
  const years = data.experience.filter((role) => !role.hidden).flatMap((role) => (role.period.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number));
  if (!years.length) return null;
  return Math.max(0, now - Math.min(...years));
}

// ---------- resume text ----------

/** Everything a resume shows, as plain text (what an ATS reads). */
export function textFromData(data: ResumeData): string {
  const parts: string[] = [];
  const b = data.basics;
  parts.push(b.name, b.headline, b.email, b.phone, b.location, ...b.links.map((l) => l.url));
  for (const id of visibleSections(data)) {
    if (id === 'summary') parts.push('Summary', b.summary);
    if (id === 'experience') { parts.push('Experience'); for (const e of data.experience.filter((x) => !x.hidden)) parts.push(e.role, e.company, e.location, e.period, ...e.bullets); }
    if (id === 'projects') { parts.push('Projects'); for (const p of data.projects.filter((x) => !x.hidden)) parts.push(p.name, p.tech, p.link, ...p.bullets); }
    if (id === 'skills') { parts.push('Skills'); for (const s of data.skills) parts.push(s.group, s.items); }
    if (id === 'education') { parts.push('Education'); for (const e of data.education) parts.push(e.school, e.degree, e.period, e.details); }
    if (id === 'extras') for (const x of data.extras) parts.push(x.title, ...x.items);
  }
  return parts.filter(Boolean).join('\n');
}

/** Rough plain text from edited Typst code: drops settings, helper definitions and markup symbols. */
export function textFromCode(code: string): string {
  return code
    .split('\n')
    .filter((line) => !/^\s*(\/\/|#set |#show |#let |#import )/.test(line))
    .join('\n')
    .replace(/"((?:[^"\\]|\\.)*)"/g, ' $1 ')
    .replace(/#[a-z][\w.-]*\(/gi, ' ')
    .replace(/\\(.)/g, '$1')
    .replace(/[*_`[\]#()]/g, ' ')
    .replace(/\b(title|subtitle|date|location|weight|size|fill):/g, ' ');
}

// ---------- the report ----------

export function atsReport(input: { data: ResumeData; code: string | null; jobDescription: string; pages: number | null }): AtsReport {
  const { data, code, pages } = input;
  const text = code ? textFromCode(code) : textFromData(data);
  const words = wordsOf(text).length;
  const sections = visibleSections(data);
  const roles = sections.includes('experience') ? data.experience.filter((role) => !role.hidden && (role.role.trim() || role.company.trim())) : [];
  const allBullets = [
    ...roles.flatMap((role) => role.bullets),
    ...(sections.includes('projects') ? data.projects.filter((p) => !p.hidden).flatMap((p) => p.bullets) : []),
  ].map((bullet) => bullet.trim()).filter(Boolean);
  const checks: AtsCheck[] = [];
  const add = (check: AtsCheck) => checks.push(check);
  const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
  const jobText = input.jobDescription.trim();
  const job = jobText ? readJob(jobText) : null;

  // Contact details
  const b = data.basics;
  const contactMissing = [!b.email.trim() && 'email', !b.phone.trim() && 'phone', !b.location.trim() && 'location'].filter(Boolean) as string[];
  const hasLinkedIn = b.links.some((link) => /linkedin\.com/i.test(link.url));
  add({
    id: 'contact', label: 'Contact details', weight: 10,
    status: !b.email.trim() ? 'fail' : contactMissing.length || !hasLinkedIn ? 'warn' : 'pass',
    detail: contactMissing.length ? `Missing: ${contactMissing.join(', ')}${hasLinkedIn ? '' : ', LinkedIn'}` : hasLinkedIn ? 'Email, phone, location and LinkedIn are all there.' : 'No LinkedIn link.',
    tip: 'Recruiters expect email, phone, city and a LinkedIn URL in the header (as plain text, not icons).',
  });

  // Summary
  const summaryWords = sections.includes('summary') ? wordsOf(b.summary).length : 0;
  add({
    id: 'summary', label: 'Summary', weight: 6,
    status: summaryWords === 0 ? 'warn' : summaryWords < 20 || summaryWords > 90 ? 'warn' : 'pass',
    detail: summaryWords === 0 ? 'No summary.' : `${summaryWords} words.`,
    tip: 'A 2–4 line summary (25–80 words) with your title, years of experience and 3–5 core skills from the job post.',
  });

  // Section headings
  const missingSections = (['experience', 'skills'] as const).filter((id) => !sections.includes(id)
    || (id === 'experience' && roles.length === 0) || (id === 'skills' && !data.skills.some((s) => s.items.trim())));
  add({
    id: 'sections', label: 'Standard sections', weight: 10,
    status: missingSections.length ? 'fail' : 'pass',
    detail: missingSections.length ? `Missing: ${missingSections.join(', ')}.` : 'Uses standard headings (Summary, Experience, Skills…) that every ATS recognises.',
    tip: 'Keep the usual section names; creative headings can make an ATS miss whole sections.',
  });

  // Dates
  const undated = roles.filter((role) => !role.period.trim());
  add({
    id: 'dates', label: 'Dates on every role', weight: 6,
    status: roles.length === 0 ? 'warn' : undated.length ? 'fail' : 'pass',
    detail: undated.length ? `No dates on: ${undated.map((role) => role.role || role.company).join(', ')}.` : 'Every role has dates.',
    tip: 'Use "Mon YYYY – Mon YYYY" or "Present"; ATS calculate your experience from these.',
  });

  // Bullets per role
  const thin = roles.filter((role, index) => role.bullets.filter((x) => x.trim()).length < (index === 0 ? 3 : 2));
  const heavy = roles.filter((role) => role.bullets.filter((x) => x.trim()).length > 8);
  add({
    id: 'bullets', label: 'Bullets per role', weight: 6,
    status: thin.length ? 'warn' : heavy.length ? 'warn' : 'pass',
    detail: thin.length ? `Few bullets: ${thin.map((r) => r.role || r.company).join(', ')}.` : heavy.length ? `Long lists (8+): ${heavy.map((r) => r.role || r.company).join(', ')}.` : 'A healthy 3–8 bullets per role.',
    tip: '3–6 bullets for recent roles, 2–3 for older ones. Recruiters skim; keep the strongest first.',
  });

  // Quantified impact
  const quantified = allBullets.filter(hasNumber).length;
  const quantPct = pct(quantified, allBullets.length);
  add({
    id: 'numbers', label: 'Quantified results', weight: 12,
    status: quantPct >= 35 ? 'pass' : quantPct >= 15 ? 'warn' : 'fail',
    detail: `${quantified} of ${allBullets.length} bullets (${quantPct}%) include a number.`,
    tip: 'Aim for at least a third of bullets with a metric: %, time saved, users, revenue, team size, load time.',
  });

  // Action verbs
  const strong = allBullets.filter(startsWithVerb).length;
  const verbPct = pct(strong, allBullets.length);
  add({
    id: 'verbs', label: 'Starts with action verbs', weight: 8,
    status: verbPct >= 70 ? 'pass' : verbPct >= 45 ? 'warn' : 'fail',
    detail: `${strong} of ${allBullets.length} bullets (${verbPct}%) start with a strong verb.`,
    tip: 'Start bullets with verbs like Built, Led, Reduced, Migrated, Designed — not "Responsible for".',
  });

  // Weak phrases
  const weak = allBullets.filter(isWeakBullet);
  add({
    id: 'weak', label: 'Weak phrases', weight: 5,
    status: weak.length === 0 ? 'pass' : weak.length <= 3 ? 'warn' : 'fail',
    detail: weak.length ? `${weak.length} bullet${weak.length === 1 ? '' : 's'} use "worked on", "responsible for"…` : 'No filler phrases.',
    tip: 'Replace "worked on / responsible for / helped" with what you did and the result.',
  });

  // Bullet length
  const long = allBullets.filter((bullet) => wordsOf(bullet).length > 35).length;
  add({
    id: 'length', label: 'Bullet length', weight: 5,
    status: long === 0 ? 'pass' : long <= 2 ? 'warn' : 'fail',
    detail: long ? `${long} bullet${long === 1 ? ' is' : 's are'} over 35 words.` : 'Bullets are concise.',
    tip: 'One to two lines each (12–30 words).',
  });

  // First person
  const firstPerson = allBullets.filter((bullet) => /\b(i|me|my)\b/i.test(bullet)).length;
  add({
    id: 'pronouns', label: 'No first person', weight: 3,
    status: firstPerson ? 'warn' : 'pass',
    detail: firstPerson ? `${firstPerson} bullet${firstPerson === 1 ? '' : 's'} use "I/my".` : 'No "I/my" in bullets.',
    tip: 'Write "Built…" rather than "I built…".',
  });

  // Skills breadth
  const skillCount = data.skills.flatMap((group) => group.items.split(/[,;|]/)).map((s) => s.trim()).filter(Boolean).length;
  add({
    id: 'skills', label: 'Skills listed', weight: 6,
    status: skillCount >= 8 ? 'pass' : skillCount >= 4 ? 'warn' : 'fail',
    detail: `${skillCount} skills listed.`,
    tip: 'List 10–25 concrete skills (languages, frameworks, tools) in a Skills section; ATS match them literally.',
  });

  // Education (a hard filter when the job asks for a degree)
  const hasEducation = sections.includes('education') && data.education.some((e) => e.school.trim() || e.degree.trim());
  add({
    id: 'education', label: 'Education', weight: job?.degree ? 8 : 4,
    status: hasEducation ? 'pass' : job?.degree ? 'fail' : 'warn',
    detail: hasEducation ? 'Education section present.' : job?.degree ? 'The job asks for a degree, but no education is listed.' : 'No education listed.',
    tip: 'Many ATS filters check for a degree; add it even if short (school, degree, years).',
  });

  // Job-specific checks
  if (job?.title) {
    const match = titleMatch(job.title, b.headline);
    add({
      id: 'title', label: 'Job title match', weight: 8,
      status: match.ratio >= 0.75 ? 'pass' : match.ratio >= 0.5 ? 'warn' : 'fail',
      detail: match.ratio >= 0.75 ? `Your headline matches “${job.title}”.` : `The job is “${job.title}”; your headline says “${b.headline || '—'}”.`,
      tip: 'Recruiters search by title. Use the job\'s exact title as your headline (if it fits your experience).',
    });
  }
  if (job?.minYears) {
    const mentioned = /\b\d{1,2}\s*\+?\s*(years|yrs)\b/i.test(b.summary);
    const have = resumeYears(data);
    add({
      id: 'years', label: 'Years of experience', weight: 5,
      status: mentioned ? 'pass' : 'warn',
      detail: mentioned ? 'Your summary states your years of experience.' : `The job asks for ${job.minYears}+ years${have ? `; your roles span ${have} years` : ''}, but the summary doesn't say it.`,
      tip: 'Say it in the first line of the summary, e.g. "Frontend engineer with 7+ years…". Recruiters and ATS filters look for it.',
    });
  }

  // Length
  add({
    id: 'pages', label: 'Length', weight: 8,
    status: pages === null ? (words > 1000 ? 'warn' : 'pass') : pages <= 2 && words <= 1000 ? 'pass' : pages <= 2 ? 'warn' : 'fail',
    detail: `${pages === null ? '' : `${pages} page${pages === 1 ? '' : 's'}, `}${words} words.`,
    tip: 'One page under ~8 years of experience, at most two after that. Trim older roles to 2 bullets.',
  });

  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.reduce((sum, check) => sum + check.weight * (check.status === 'pass' ? 1 : check.status === 'warn' ? 0.5 : 0), 0);
  const formatScore = Math.round((earned / total) * 100);

  // Keywords, weighted by how much the job stresses them (required lines count more).
  const haystack = normalize(text);
  const keywords: KeywordResult[] = job ? jobKeywords(jobText, job).map((keyword) => ({ ...keyword, found: hasTerm(haystack, keyword.term) })) : [];
  const totalWeight = keywords.reduce((sum, keyword) => sum + keyword.weight, 0);
  const keywordScore = job && totalWeight ? Math.round((keywords.filter((k) => k.found).reduce((sum, k) => sum + k.weight, 0) / totalWeight) * 100) : null;
  const score = keywordScore === null ? formatScore : Math.round(keywordScore * 0.6 + formatScore * 0.4);

  return {
    score, formatScore, keywordScore, keywords, job,
    matched: keywords.filter((k) => k.found).map((k) => k.label),
    missing: keywords.filter((k) => !k.found).map((k) => k.label),
    checks, words,
  };
}
