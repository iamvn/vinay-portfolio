import type { ApplicationStatus } from '@/lib/career/types';

export const STATUS_TONES: Record<ApplicationStatus, string> = {
  saved: 'border-slate-400/30 bg-slate-400/10 text-slate-200',
  applied: 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100',
  interview: 'border-purple-300/40 bg-purple-300/10 text-purple-100',
  offer: 'border-lime-300/40 bg-lime-300/10 text-lime-100',
  rejected: 'border-red-400/30 bg-red-400/10 text-red-200',
  withdrawn: 'border-slate-500/30 bg-slate-500/10 text-slate-400',
};
