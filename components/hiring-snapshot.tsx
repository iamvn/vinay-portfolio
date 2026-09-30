import type { PortfolioData } from '@/lib/portfolio';

type Profile = PortfolioData['profile'];

const ROWS: { key: 'targetRoles' | 'workPreference' | 'availability' | 'noticePeriod'; label: string }[] = [
  { key: 'targetRoles', label: 'LOOKING FOR' },
  { key: 'workPreference', label: 'LOCATION & WORK MODE' },
  { key: 'availability', label: 'AVAILABILITY' },
  { key: 'noticePeriod', label: 'NOTICE PERIOD' },
];

/** Recruiter essentials at a glance. Hidden when not available or when nothing is filled in. */
export function HiringSnapshot({ profile }: { profile: Profile }) {
  const rows = ROWS.filter(({ key }) => profile[key]?.trim());
  if (!profile.available || rows.length === 0) return null;
  return (
    <div className="hiring-snapshot mb-3 rounded-2xl border border-lime-300/30 bg-lime-300/[.04] p-4 sm:p-5">
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.25em] text-lime-300">
        <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-lime-300 opacity-60 motion-reduce:hidden" /><span className="relative inline-flex size-2 rounded-full bg-lime-300" /></span>
        Hiring snapshot
      </p>
      <dl className={`mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2 ${rows.length > 2 ? 'lg:grid-cols-4' : ''}`}>
        {rows.map(({ key, label }) => (
          <div key={key} className="min-w-0">
            <dt className="text-[10px] font-bold tracking-wider text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm font-bold text-white">{profile[key]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
