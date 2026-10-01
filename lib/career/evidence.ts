import type { ResumeData } from '@/lib/resume-builder/types';
import { TERMS, hasTerm, keywordLabel, normalize, termPattern, type JobKeyword } from '@/lib/resume-builder/keywords';

/**
 * The evidence layer: what the candidate can actually show for a skill or claim.
 *
 * Evidence comes from two places:
 *   - the master career profile (Admin → Profile, Experience, Projects, Skills), and
 *   - the resume itself (things the candidate typed there count as their own claims).
 *
 * Used to (1) map each job requirement to where the candidate proves it, and (2) flag AI or one-click
 * changes that would add a skill or a number the candidate has never mentioned anywhere ("truth guard").
 * Runs in the browser and on the server; no I/O.
 */

export type EvidenceKind = 'experience' | 'project' | 'skills' | 'summary';
export type EvidenceItem = {
  kind: EvidenceKind;
  /** Where it comes from, for people: "EPAM · Senior Software Engineer", "Project: Portfolio CMS", "Skills: Frontend". */
  source: string;
  text: string;
  /** For experience bullets: the company, so a bullet can be offered to the matching role on the resume. */
  company?: string;
  /** For projects: the project's name. */
  project?: string;
};

/** A plain shape of the profile, so this file doesn't depend on the database types. */
export type ProfileForEvidence = {
  profile: { name?: string; role?: string; summary?: string; targetRoles?: string };
  experience: { role: string; company: string; bullets: string[] }[];
  projects: { title: string; description?: string; stack?: string[]; objective?: string; approach?: string; result?: string; content?: string }[];
  skills: { group: string; items: string[] }[];
};

export function evidenceFromProfile(data: ProfileForEvidence): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  const p = data.profile;
  for (const text of [p.summary, p.role, p.targetRoles]) if (text?.trim()) items.push({ kind: 'summary', source: 'Profile', text: text.trim() });
  for (const role of data.experience) {
    const source = [role.company, role.role].filter(Boolean).join(' · ');
    for (const bullet of role.bullets) if (bullet.trim()) items.push({ kind: 'experience', source, text: bullet.trim(), company: role.company });
  }
  for (const project of data.projects) {
    const source = `Project: ${project.title}`;
    const parts = [project.description, project.objective, project.approach, project.result, project.stack?.length ? `Built with ${project.stack.join(', ')}` : '', (project.content ?? '').slice(0, 4000)];
    for (const text of parts) if (text?.trim()) items.push({ kind: 'project', source, text: text.trim(), project: project.title });
  }
  for (const group of data.skills) if (group.items.length) items.push({ kind: 'skills', source: `Skills: ${group.group}`, text: group.items.join(', ') });
  return items;
}

/** Where the resume shows something, so the map can say "Experience: Acme, bullet 2". */
export type ResumeSpot =
  | { kind: 'experience'; role: number; bullet: number; text: string; label: string }
  | { kind: 'project'; project: number; text: string; label: string }
  | { kind: 'skills'; text: string; label: string }
  | { kind: 'summary'; text: string; label: string };

export function resumeSpots(data: ResumeData): ResumeSpot[] {
  const spots: ResumeSpot[] = [];
  const b = data.basics;
  if (b.headline.trim()) spots.push({ kind: 'summary', text: b.headline, label: 'Headline' });
  if (b.summary.trim() && !data.layout.hidden.includes('summary')) spots.push({ kind: 'summary', text: b.summary, label: 'Summary' });
  data.experience.forEach((role, i) => {
    if (role.hidden || data.layout.hidden.includes('experience')) return;
    const name = role.company || role.role || `Role ${i + 1}`;
    spots.push({ kind: 'experience', role: i, bullet: -1, text: `${role.role} ${role.company}`, label: `${name} (title)` });
    role.bullets.forEach((text, j) => spots.push({ kind: 'experience', role: i, bullet: j, text, label: `${name}, bullet ${j + 1}` }));
  });
  data.projects.forEach((project, i) => {
    if (project.hidden || data.layout.hidden.includes('projects')) return;
    spots.push({ kind: 'project', project: i, text: [project.name, project.tech, ...project.bullets].join('\n'), label: `Project: ${project.name || i + 1}` });
  });
  if (!data.layout.hidden.includes('skills')) for (const group of data.skills) spots.push({ kind: 'skills', text: `${group.group}: ${group.items}`, label: `Skills: ${group.group || 'list'}` });
  return spots;
}

const contains = (text: string, term: string) => hasTerm(normalize(text), term);

// ---------- requirement → evidence ----------

/**
 * strong   – shown in an experience or project bullet on the resume (real use, in context)
 * partial  – only listed (skills, summary or headline): claimed but not demonstrated
 * profile  – not on this resume, but your profile proves it (can be added honestly)
 * missing  – nowhere: don't add it unless it's true
 */
export type Coverage = 'strong' | 'partial' | 'profile' | 'missing';
export type RequirementMatch = {
  term: string;
  label: string;
  required: boolean;
  coverage: Coverage;
  /** Where the resume shows it (best first). */
  onResume: ResumeSpot[];
  /** Profile evidence that isn't on the resume yet. */
  inProfile: EvidenceItem[];
  /** For strong items: whether one of the spots is near the top of a recent role (first 2 bullets of the first 2 roles). */
  prominent: boolean;
};

/** `requiredTerms`: which keywords are required (from the job analysis); otherwise judged by how the job stresses them. */
export function mapRequirements(keywords: JobKeyword[], data: ResumeData, profile: EvidenceItem[], requiredTerms?: Set<string>): RequirementMatch[] {
  const spots = resumeSpots(data);
  const visibleRoles = data.experience.map((role, i) => ({ role, i })).filter(({ role }) => !role.hidden).slice(0, 2).map(({ i }) => i);
  return keywords.map((keyword) => {
    const onResume = spots.filter((spot) => contains(spot.text, keyword.term));
    const demonstrated = onResume.filter((spot) => (spot.kind === 'experience' && spot.bullet >= 0) || spot.kind === 'project');
    const resumeText = normalize(spots.map((s) => s.text).join('\n'));
    // Profile evidence that isn't already on the resume word for word.
    const inProfile = profile.filter((item) => contains(item.text, keyword.term) && !resumeText.includes(normalize(item.text).trim().slice(0, 80)));
    const coverage: Coverage = demonstrated.length ? 'strong' : onResume.length ? 'partial' : inProfile.length ? 'profile' : 'missing';
    const prominent = demonstrated.some((spot) => spot.kind === 'experience' && visibleRoles.includes(spot.role) && spot.bullet <= 1);
    const order = (spot: ResumeSpot) => (spot.kind === 'experience' && spot.bullet >= 0 ? 0 : spot.kind === 'project' ? 1 : 2);
    const kindOrder: Record<EvidenceKind, number> = { experience: 0, project: 1, summary: 2, skills: 3 };
    return {
      term: keyword.term,
      label: keyword.label,
      required: requiredTerms ? requiredTerms.has(keyword.term) : keyword.weight >= 4, // said in a "must/required/strong" line, or repeated
      coverage,
      onResume: [...onResume].sort((a, b) => order(a) - order(b)),
      inProfile: [...inProfile].sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]),
      prominent,
    };
  });
}

export function coverageSummary(matches: RequirementMatch[]) {
  const count = (c: Coverage, onlyRequired = false) => matches.filter((m) => m.coverage === c && (!onlyRequired || m.required)).length;
  const required = matches.filter((m) => m.required);
  return {
    strong: count('strong'), partial: count('partial'), profile: count('profile'), missing: count('missing'),
    required: required.length,
    requiredCovered: required.filter((m) => m.coverage === 'strong' || m.coverage === 'partial').length,
  };
}

// ---------- truth guard ----------

/** Numbers that matter in claims: 40%, 2.3s, 50k, $2M, 10x, 1,200… (not years like 2021, not "1" or "2"). */
function claimNumbers(text: string): string[] {
  const found = text.match(/(?:[$₹€£]\s?)?\d[\d,.]*\s?(?:%|x\b|k\b|m\b|mn\b|cr\b|lakh|lpa|ms\b|s\b|sec|seconds|minutes|hours|days|weeks|users|million|billion|crore)?/gi) ?? [];
  return found
    .map((value) => value.trim().replace(/[.,]$/, ''))
    .filter((value) => !/^(19|20)\d{2}$/.test(value))      // years
    .filter((value) => /[%xkmsKM$₹€£]|\d{2,}|\.\d|[a-z]{2,}/i.test(value)); // single plain digits are rarely claims
}

const digitsOf = (value: string) => value.replace(/[^\d.]/g, '').replace(/^\.+|\.+$/g, '');

export type ClaimIssue = { kind: 'skill' | 'number'; value: string };

/**
 * What a piece of new text claims that the evidence never mentions: known skills/technologies and numbers.
 * Rewording, reordering and the job's wording for real experience are fine; new facts are not.
 */
export function unsupportedClaims(text: string, evidenceText: string): ClaimIssue[] {
  const issues: ClaimIssue[] = [];
  const have = normalize(evidenceText);
  const said = normalize(text);
  for (const term of TERMS) {
    if (term.category === 'soft' || term.category === 'concept') continue; // wording, not facts
    if (termPattern(term.term).test(said) && !termPattern(term.term).test(have) && !issues.some((i) => i.value === term.label)) {
      issues.push({ kind: 'skill', value: term.label });
    }
  }
  const known = new Set(claimNumbers(evidenceText).map(digitsOf));
  for (const value of claimNumbers(text)) {
    const digits = digitsOf(value);
    if (digits && !known.has(digits) && !issues.some((i) => i.value === value)) issues.push({ kind: 'number', value });
  }
  return issues;
}

/** All the text the candidate has given us (profile + this resume), for the truth guard. */
export function evidenceText(profile: EvidenceItem[], data?: ResumeData) {
  const parts = profile.map((item) => item.text);
  if (data) parts.push(...resumeSpots(data).map((spot) => spot.text), ...data.education.map((e) => `${e.degree} ${e.school} ${e.details}`), ...data.extras.flatMap((x) => x.items));
  return parts.join('\n');
}

export const describeIssues = (issues: ClaimIssue[]) => {
  const skills = issues.filter((i) => i.kind === 'skill').map((i) => i.value);
  const numbers = issues.filter((i) => i.kind === 'number').map((i) => i.value);
  return [skills.length ? `skill${skills.length > 1 ? 's' : ''} ${skills.join(', ')}` : '', numbers.length ? `number${numbers.length > 1 ? 's' : ''} ${numbers.join(', ')}` : '']
    .filter(Boolean).join(' and ');
};

/** Where in the profile a keyword is proven (for "Backed by …" next to a missing keyword). */
export const profileProof = (term: string, profile: EvidenceItem[]) => profile.find((item) => item.kind !== 'summary' && contains(item.text, term)) ?? profile.find((item) => contains(item.text, term)) ?? null;

export { keywordLabel };
