import type { JobAnalysis } from '@/lib/career/job';

/** Seniority, years, work mode… as small chips. */
export function JobFacts({ analysis }: { analysis: JobAnalysis }) {
  const facts = [
    analysis.seniority && ['Level', analysis.seniority],
    analysis.minYears !== null && ['Experience', `${analysis.minYears}${analysis.maxYears ? `–${analysis.maxYears}` : '+'} years`],
    analysis.workMode && ['Work mode', analysis.workMode[0].toUpperCase() + analysis.workMode.slice(1)],
    analysis.employmentType && ['Type', analysis.employmentType.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())],
    analysis.degree && ['Degree', 'Asked for'],
  ].filter(Boolean) as [string, string][];
  if (!facts.length) return null;
  return (
    <dl className="flex flex-wrap gap-2">
      {facts.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
          <dd className="text-sm font-bold text-slate-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Required and nice-to-have skills, marked by whether your profile proves them. */
export function SkillChips({ analysis, proof }: { analysis: JobAnalysis; proof: Record<string, string | null> }) {
  const groups = [['Required', analysis.required], ['Nice to have', analysis.preferred]] as const;
  const proven = analysis.required.filter((k) => proof[k.term]).length;
  return (
    <div className="space-y-3">
      {analysis.required.length > 0 && (
        <p className="text-xs text-slate-300">Your profile proves <b className="text-lime-200">{proven} of {analysis.required.length}</b> required skills.</p>
      )}
      {groups.map(([label, list]) => list.length > 0 && (
        <div key={label}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
          <ul className="flex flex-wrap gap-1.5">
            {list.map((k) => (
              <li key={k.term} title={proof[k.term] ? `Backed by ${proof[k.term]}` : 'Not in your profile'}
                className={`rounded-md border px-2 py-1 text-xs ${proof[k.term] ? 'border-lime-300/30 bg-lime-300/10 text-lime-100' : 'border-red-400/30 bg-red-400/[.07] text-red-100'}`}>
                {proof[k.term] ? '✓' : '✕'} {k.label}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
