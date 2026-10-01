import { jobKeywords, readJob, type JobKeyword } from '@/lib/resume-builder/keywords';

/**
 * Job analysis (runs in the browser and on the server): role, company, place, work mode, seniority,
 * years, and the skills asked for, split into required and nice-to-have.
 */

export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type JobAnalysis = {
  title: string;
  company: string;
  location: string;
  workMode: WorkMode | null;
  employmentType: string;
  seniority: string;
  minYears: number | null;
  maxYears: number | null;
  degree: boolean;
  required: JobKeyword[];
  preferred: JobKeyword[];
};

const SENIORITY: [RegExp, string][] = [
  [/\b(intern|internship|trainee)\b/i, 'Intern'], [/\b(junior|jr\.?|entry[- ]level|graduate)\b/i, 'Junior'],
  [/\b(principal|distinguished)\b/i, 'Principal'], [/\bstaff\b/i, 'Staff'], [/\b(lead|tech lead|team lead)\b/i, 'Lead'],
  [/\b(head of|director|vp|manager)\b/i, 'Manager'], [/\b(senior|sr\.?)\b/i, 'Senior'], [/\b(mid[- ]level|intermediate|sde ?ii|sde-2)\b/i, 'Mid-level'],
];

function seniorityOf(title: string, minYears: number | null) {
  for (const [pattern, label] of SENIORITY) if (pattern.test(title)) return label;
  if (minYears === null) return '';
  return minYears >= 8 ? 'Staff / Lead' : minYears >= 5 ? 'Senior' : minYears >= 2 ? 'Mid-level' : 'Junior';
}

function workModeOf(text: string, remoteHint?: boolean): WorkMode | null {
  if (/\bhybrid\b/i.test(text)) return 'hybrid';
  if (remoteHint || /\b(fully remote|100% remote|remote[- ]first|work from (home|anywhere)|remote\b(?! (?:control|sensing)))/i.test(text)) return /\b(on-?site|in[- ]office|work from office|wfo)\b/i.test(text) && !remoteHint ? 'hybrid' : 'remote';
  if (/\b(on-?site|in[- ]office|work from office|wfo)\b/i.test(text)) return 'onsite';
  return null;
}

const firstMatch = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) { const m = text.match(pattern); if (m?.[1]) return m[1].trim().replace(/[.,;:]+$/, ''); }
  return '';
};

export function analyzeJob(input: { text: string; title?: string; company?: string; location?: string; remote?: boolean; employmentType?: string }): JobAnalysis {
  const text = input.text;
  const info = readJob(text);
  const head = text.slice(0, 1500);
  // Page titles often look like "Senior Engineer | Acme Careers": keep the part before the first " | ".
  const title = (input.title || info.title || firstMatch(head, [/(?:job title|position|role)\s*[:\-–]\s*([^\n]{3,80})/i]) || '').split(/\s+[|·]\s+/)[0].trim().slice(0, 120);
  const company = input.company || firstMatch(text, [
    /(?:company|organi[sz]ation|employer)\s*[:\-–]\s*([^\n]{2,60})/i,
    /\babout\s+([A-Z][\w&.\- ]{1,40}?)\s*(?:\n|:)/,
    /\b([A-Z][\w&.\-]+(?: [A-Z][\w&.\-]+){0,3}) is (?:hiring|looking for|seeking)\b/,
    /\bjoin\s+([A-Z][\w&.\-]+(?: [A-Z][\w&.\-]+){0,3})(?:\s|,|!|\.)/,
  ]);
  const location = input.location || firstMatch(text, [/(?:location|based in|office)\s*[:\-–]\s*([^\n]{2,80})/i, /\b(?:in|at)\s+((?:Pune|Bangalore|Bengaluru|Mumbai|Hyderabad|Chennai|Delhi|Gurgaon|Gurugram|Noida|Kolkata|Ahmedabad)[^\n.,;]{0,30})/i]);
  const all = text.replace(/\s+/g, ' ');
  const range = all.match(/(\d{1,2})\s*(?:\+|plus)?\s*(?:-|–|to)\s*(\d{1,2})\s*\+?\s*(?:years|yrs)/i);

  // Required vs nice-to-have: keywords from "preferred/bonus" sections that aren't also required elsewhere.
  const keywords = jobKeywords(text, info);
  const preferredText = info.relevant.filter((line) => line.weight === 1).map((line) => line.text).join('\n');
  const coreText = info.relevant.filter((line) => line.weight > 1).map((line) => line.text).join('\n');
  const core = new Set(coreText ? jobKeywords(coreText).map((k) => k.term) : keywords.map((k) => k.term));
  const preferredOnly = new Set(preferredText ? jobKeywords(preferredText).map((k) => k.term).filter((term) => !core.has(term)) : []);

  return {
    title,
    company: company.slice(0, 80),
    location: location.slice(0, 120),
    workMode: workModeOf(all, input.remote),
    employmentType: input.employmentType ?? (/\b(contract|contractor|freelance)\b/i.test(all) ? 'Contract' : /\bpart[- ]time\b/i.test(all) ? 'Part-time' : ''),
    seniority: seniorityOf(title, info.minYears),
    minYears: info.minYears,
    maxYears: range ? Number(range[2]) : null,
    degree: info.degree,
    required: keywords.filter((k) => !preferredOnly.has(k.term)),
    preferred: keywords.filter((k) => preferredOnly.has(k.term)),
  };
}
