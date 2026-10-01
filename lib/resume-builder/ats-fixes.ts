import { atsReport, hasNumber, isWeakBullet, resumeYears, startsWithVerb, type AtsReport, type KeywordResult } from './ats';
import { CATEGORY_LABELS, normalize, termPattern, type KeywordCategory } from './keywords';
import type { ResumeData } from './types';

/**
 * One-click improvements for the ATS score tab. Every fix is a plain function on the resume content,
 * so the editor can apply it (undoable), and the score gain is measured by re-running the check on a copy.
 * Nothing invents experience: automatic fixes only reword or reorganise what's there; adding skills,
 * numbers, education or contact details needs the user's own input or confirmation.
 */

type Change = (data: ResumeData) => ResumeData;
export type FixField = { key: string; label: string; placeholder?: string; value?: string };
export type Fix = {
  id: string;
  title: string;
  detail: string;
  gain: number;
  /** apply: one click (with a before/after preview) · form: a few fields to fill · edit: bullets to edit inline */
  kind: 'apply' | 'form' | 'edit';
  apply?: Change;
  preview?: { before: string; after: string }[];
  fields?: FixField[];
  build?: (values: Record<string, string>) => Change;
  items?: { role: number; bullet: number; text: string; context: string }[];
};

const clone = (data: ResumeData): ResumeData => structuredClone(data);
const scoreOf = (data: ResumeData, jobDescription: string, pages: number | null) => atsReport({ data, code: null, jobDescription, pages }).score;
export const gainOf = (data: ResumeData, change: Change, jobDescription: string, pages: number | null) =>
  scoreOf(change(clone(data)), jobDescription, pages) - scoreOf(data, jobDescription, pages);

// ---------- rewording helpers ----------

const IRREGULAR: Record<string, string> = {
  building: 'Built', leading: 'Led', writing: 'Wrote', running: 'Ran', making: 'Made', setting: 'Set', driving: 'Drove',
  bringing: 'Brought', teaching: 'Taught', getting: 'Got', keeping: 'Kept', holding: 'Held', sending: 'Sent', spending: 'Spent',
  choosing: 'Chose', giving: 'Gave', taking: 'Took', doing: 'Did', seeing: 'Saw', finding: 'Found', meeting: 'Met', winning: 'Won',
  selling: 'Sold', overseeing: 'Oversaw', understanding: 'Understood', putting: 'Put', cutting: 'Cut',
};
const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
/** "migrating" → "Migrated", "building" → "Built", "deploying" → "Deployed". */
export function pastTense(gerund: string): string | null {
  const word = gerund.toLowerCase();
  if (!word.endsWith('ing') || word.length < 5) return null;
  if (IRREGULAR[word]) return IRREGULAR[word];
  const stem = word.slice(0, -3);
  if (/[^aeiou]y$/.test(stem)) return capital(`${stem.slice(0, -1)}ied`);
  return capital(`${stem}ed`);
}

/** Rewrites a bullet that opens with filler ("Worked on migrating X" → "Migrated X"). Null when it can't safely. */
export function rewriteWeak(bullet: string): string | null {
  const text = bullet.trim();
  const rules: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    [/^(?:was )?(?:worked on|responsible for|involved in|tasked with)\s+(\w+ing)\b\s*(.*)$/i, (m) => { const verb = pastTense(m[1]); return verb ? `${verb} ${m[2]}` : null; }],
    [/^(?:was )?responsible for\s+(.+)$/i, (m) => `Owned ${m[1]}`],
    [/^worked with\s+(.+)$/i, (m) => `Used ${m[1]}`],
    [/^(?:worked on|involved in)\s+(?:the\s+)?(.+)$/i, (m) => `Contributed to ${m[1]}`],
    [/^helped (?:to )?(build|develop|design|create|implement|improve|migrate|deliver|launch|ship|optimi[sz]e|test|automate)\b\s*(.*)$/i,
      (m) => `Contributed to ${m[1].toLowerCase().replace(/e$/, '')}ing ${m[2]}`],
    [/^helped (?:with\s+)?(.+)$/i, (m) => `Supported ${m[1]}`],
  ];
  for (const [pattern, make] of rules) {
    const match = text.match(pattern);
    if (match) {
      const result = make(match);
      if (result) return result.replace(/\bvarious\s+/gi, '').replace(/\s+/g, ' ').trim();
    }
  }
  return /\bvarious\s+/i.test(text) ? text.replace(/\bvarious\s+/gi, '') : null;
}

// ---------- skills ----------

const GROUP_PATTERNS: Partial<Record<KeywordCategory, RegExp>> = {
  language: /language/i,
  frontend: /front|ui\b|web|client/i,
  backend: /back|server|api/i,
  data: /data|database|storage/i,
  cloud: /cloud|devops|infra|ops/i,
  testing: /test|qa|quality/i,
  tools: /tool|workflow|version/i,
  ai: /\bai\b|ml|machine|automation/i,
  concept: /core|concept|fundamental|practice|computer science|engineering/i,
};
const NEW_GROUP_NAME: Partial<Record<KeywordCategory, string>> = {
  language: 'Languages', frontend: 'Frontend', backend: 'Backend', data: 'Databases', cloud: 'Cloud & DevOps', testing: 'Testing',
  tools: 'Tools', ai: 'AI', concept: 'Core Skills', other: 'Other', domain: 'Domain', soft: 'Soft Skills',
};

/** Adds skills to the best matching skill group (creating "Languages", "Tools", "Core Skills"… when there's none). */
export function addSkills(keywords: Pick<KeywordResult, 'label' | 'category' | 'term'>[]): Change {
  return (data) => {
    const skills = data.skills.map((group) => ({ ...group }));
    for (const keyword of keywords) {
      const already = normalize(skills.map((g) => g.items).join(', '));
      if (termPattern(keyword.term).test(already)) continue;
      const pattern = GROUP_PATTERNS[keyword.category];
      let group = pattern ? skills.find((g) => pattern.test(g.group)) : undefined;
      // HTML/CSS read best next to the frontend framework list when there's no "Languages" group.
      if (!group && keyword.category === 'language' && /^(html|css)$/.test(keyword.term)) group = skills.find((g) => GROUP_PATTERNS.frontend!.test(g.group));
      if (!group) {
        group = { group: NEW_GROUP_NAME[keyword.category] ?? CATEGORY_LABELS[keyword.category], items: '' };
        skills.push(group);
      }
      group.items = group.items.trim() ? `${group.items.trim().replace(/[,;]\s*$/, '')}, ${keyword.label}` : keyword.label;
    }
    // Make sure the Skills section is shown, or the added skills would never reach the PDF.
    return { ...data, skills, layout: { ...data.layout, hidden: data.layout.hidden.filter((id) => id !== 'skills') } };
  };
}

const joinWords = (words: string[]) => (words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`);

/** Adds a sentence to the summary naming soft skills or domain interest (only ones the user ticked). */
export function mentionInSummary(keywords: Pick<KeywordResult, 'label' | 'category'>[]): Change {
  return (data) => {
    const soft = keywords.filter((k) => k.category === 'soft').map((k) => k.label.toLowerCase());
    const other = keywords.filter((k) => k.category !== 'soft').map((k) => k.label);
    const sentences = [
      soft.length ? `Known for strong ${joinWords(soft)}.` : '',
      other.length ? `Hands-on with ${joinWords(other)}.` : '',
    ].filter(Boolean).join(' ');
    const summary = data.basics.summary.trim();
    return {
      ...data,
      basics: { ...data.basics, summary: summary ? `${summary.replace(/([^.!?])$/, '$1.')} ${sentences}` : sentences },
      layout: { ...data.layout, hidden: data.layout.hidden.filter((id) => id !== 'summary') },
    };
  };
}

// ---------- the fix list ----------

const bulletScore = (bullet: string, keywords: KeywordResult[]) => {
  const text = normalize(bullet);
  return keywords.filter((k) => termPattern(k.term).test(text)).length * 2 + (hasNumber(bullet) ? 2 : 0) + (startsWithVerb(bullet) ? 1 : 0) - (isWeakBullet(bullet) ? 2 : 0);
};

function topSkills(data: ResumeData, keywords: KeywordResult[], count: number) {
  const listed = data.skills.flatMap((g) => g.items.split(/[,;|/]/)).map((s) => s.trim()).filter(Boolean);
  const wanted = keywords.filter((k) => k.found && k.category !== 'soft' && k.category !== 'domain').map((k) => k.label);
  return [...new Set([...wanted, ...listed])].slice(0, count);
}

export function buildFixes(input: { data: ResumeData; jobDescription: string; pages: number | null; report: AtsReport }): Fix[] {
  const { data, jobDescription, pages, report } = input;
  const fixes: Fix[] = [];
  const check = (id: string) => report.checks.find((c) => c.id === id);
  const failing = (id: string) => { const c = check(id); return c && c.status !== 'pass'; };
  const job = report.job;
  const b = data.basics;
  const gain = (change: Change) => gainOf(data, change, jobDescription, pages);
  const visibleRoles = data.experience.map((role, index) => ({ role, index })).filter(({ role }) => !role.hidden);
  const years = resumeYears(data);

  // Job title as the headline
  if (job?.title && failing('title')) {
    const change: Change = (d) => ({ ...d, basics: { ...d.basics, headline: job.title! } });
    fixes.push({ id: 'title', title: 'Use the job title as your headline', detail: 'Recruiters search for the exact title. Only do this if it describes you.', gain: gain(change), kind: 'apply', apply: change, preview: [{ before: b.headline || '—', after: job.title }] });
  }

  // Summary: write one when missing/short; otherwise add the years of experience
  const summaryWords = b.summary.trim().split(/\s+/).filter(Boolean).length;
  const yearsText = years ? `${years}+ years` : job?.minYears ? `${job.minYears}+ years` : '';
  if (summaryWords < 20) {
    const title = (job?.title && check('title')?.status === 'pass' ? job.title : b.headline) || visibleRoles[0]?.role.role || 'Software engineer';
    const skills = topSkills(data, report.keywords, 5);
    const keep = b.summary.trim();
    const sentence1 = `${title}${yearsText ? ` with ${yearsText} of experience` : ''}${skills.length ? ` building products with ${joinWords(skills)}` : ''}.`;
    const next = [sentence1, keep ? keep.replace(/([^.!?])$/, '$1.') : ''].filter(Boolean).join(' ');
    const change: Change = (d) => ({ ...d, basics: { ...d.basics, summary: next }, layout: { ...d.layout, hidden: d.layout.hidden.filter((id) => id !== 'summary') } });
    fixes.push({ id: 'summary', title: summaryWords ? 'Expand your summary' : 'Write a summary', detail: 'Adds an opening line with your title, years of experience and the skills this job wants (from your resume). You can edit it afterwards.', gain: gain(change), kind: 'apply', apply: change, preview: [{ before: b.summary || '—', after: next }] });
  } else if (failing('years') && yearsText) {
    const lead = `${b.headline || visibleRoles[0]?.role.role || 'Engineer'} with ${yearsText} of experience.`;
    const change: Change = (d) => ({ ...d, basics: { ...d.basics, summary: `${lead} ${d.basics.summary.trim()}` } });
    fixes.push({ id: 'years', title: `Say "${yearsText}" in your summary`, detail: `The job asks for ${job?.minYears}+ years. Your roles span ${years ?? '?'} years.`, gain: gain(change), kind: 'apply', apply: change, preview: [{ before: b.summary, after: `${lead} ${b.summary.trim()}` }] });
  }

  // Weak phrases → reworded
  const rewrites = visibleRoles.flatMap(({ role, index }) => role.bullets.map((bullet, j) => ({ index, j, bullet, next: isWeakBullet(bullet) ? rewriteWeak(bullet) : null })))
    .filter((item): item is { index: number; j: number; bullet: string; next: string } => Boolean(item.next && item.next !== item.bullet));
  if (rewrites.length) {
    const change: Change = (d) => ({ ...d, experience: d.experience.map((role, i) => ({ ...role, bullets: role.bullets.map((bullet, j) => rewrites.find((r) => r.index === i && r.j === j)?.next ?? bullet) })) });
    fixes.push({ id: 'weak', title: `Reword ${rewrites.length} weak bullet${rewrites.length === 1 ? '' : 's'}`, detail: '"Worked on / responsible for / helped" become action verbs. Same facts, stronger wording.', gain: gain(change), kind: 'apply', apply: change, preview: rewrites.map((r) => ({ before: r.bullet, after: r.next })) });
  }

  // Too many bullets on one role → keep the strongest 6
  for (const { role, index } of visibleRoles) {
    if (role.bullets.length <= 8) continue;
    const ranked = role.bullets.map((bullet, j) => ({ bullet, j, score: bulletScore(bullet, report.keywords) })).sort((x, y) => y.score - x.score || x.j - y.j);
    const keep = new Set(ranked.slice(0, 6).map((r) => r.j));
    const removed = role.bullets.filter((_, j) => !keep.has(j));
    const change: Change = (d) => ({ ...d, experience: d.experience.map((r, i) => (i === index ? { ...r, bullets: r.bullets.filter((_, j) => keep.has(j)) } : r)) });
    fixes.push({ id: `trim-${index}`, title: `Keep the 6 strongest bullets for ${role.role || role.company}`, detail: `It has ${role.bullets.length}. Recruiters skim; these ${removed.length} matter least for this job (fewest keywords and numbers). Undo brings them back.`, gain: gain(change), kind: 'apply', apply: change, preview: removed.map((bullet) => ({ before: bullet, after: '(removed)' })) });
  }

  // Education
  if (failing('education')) {
    const build = (v: Record<string, string>): Change => (d) => ({
      ...d,
      education: [...d.education, { school: v.school?.trim() ?? '', degree: v.degree?.trim() ?? '', period: v.period?.trim() ?? '', location: v.location?.trim() ?? '', details: '' }],
      layout: { ...d.layout, hidden: d.layout.hidden.filter((s) => s !== 'education') },
    });
    fixes.push({
      id: 'education', title: 'Add your education', detail: job?.degree ? 'This job asks for a degree; many ATS reject resumes without one.' : 'Many ATS filters look for a degree.',
      gain: gain(build({ school: 'University', degree: 'Degree' })), kind: 'form', build,
      fields: [
        { key: 'degree', label: 'Degree', placeholder: 'B.Tech in Computer Science' },
        { key: 'school', label: 'College / university', placeholder: 'Savitribai Phule Pune University' },
        { key: 'period', label: 'Years', placeholder: '2012 – 2016' },
      ],
    });
  }

  // Contact details
  const hasLinkedIn = b.links.some((link) => /linkedin\.com/i.test(link.url));
  if (!b.phone.trim() || !b.location.trim() || !hasLinkedIn) {
    const fields: FixField[] = [
      ...(!b.phone.trim() ? [{ key: 'phone', label: 'Phone', placeholder: '+91 98765 43210' }] : []),
      ...(!b.location.trim() ? [{ key: 'location', label: 'City', placeholder: 'Pune, India' }] : []),
      ...(!hasLinkedIn ? [{ key: 'linkedin', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/…' }] : []),
    ];
    const build = (v: Record<string, string>): Change => (d) => ({
      ...d,
      basics: {
        ...d.basics,
        phone: v.phone?.trim() || d.basics.phone,
        location: v.location?.trim() || d.basics.location,
        links: v.linkedin?.trim() ? [{ label: 'LinkedIn', url: v.linkedin.trim() }, ...d.basics.links] : d.basics.links,
      },
    });
    fixes.push({ id: 'contact', title: `Add your ${fields.map((f) => f.label.toLowerCase()).join(', ')}`, detail: 'Recruiters expect phone, city and LinkedIn in the header.', gain: gain(build({ phone: '+00', location: 'City', linkedin: 'linkedin.com/in/x' })), kind: 'form', fields, build });
  }

  // Numbers: bullets to quantify (the user adds the real figures)
  if (failing('numbers')) {
    const items = visibleRoles.slice(0, 2).flatMap(({ role, index }) => role.bullets.map((text, bullet) => ({ role: index, bullet, text, context: role.role || role.company })))
      .filter((item) => !hasNumber(item.text))
      .sort((x, y) => bulletScore(y.text, report.keywords) - bulletScore(x.text, report.keywords))
      .slice(0, 5);
    if (items.length) {
      fixes.push({ id: 'numbers', title: 'Add numbers to your strongest bullets', detail: 'Only you know the real figures: how many users, how much faster, how many engineers, how much saved. Edit a bullet and press Save.', gain: Math.max(1, Math.round((check('numbers')?.weight ?? 12) * 0.4 * 0.5)), kind: 'edit', items });
    }
  }

  return fixes.sort((x, y) => y.gain - x.gain);
}

/** Applies every one-click fix, re-checking after each so fixes never step on each other. */
export function applyAllFixes(data: ResumeData, jobDescription: string, pages: number | null): { data: ResumeData; applied: string[] } {
  let current = data;
  const applied: string[] = [];
  for (let round = 0; round < 12; round++) {
    const report = atsReport({ data: current, code: null, jobDescription, pages });
    const next = buildFixes({ data: current, jobDescription, pages, report }).find((fix) => fix.kind === 'apply' && fix.apply && !applied.includes(fix.id));
    if (!next) break;
    current = next.apply!(current);
    applied.push(next.id);
  }
  return { data: current, applied };
}
