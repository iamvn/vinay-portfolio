import { z } from 'zod';

/**
 * Profile → Import: what a resume PDF or a LinkedIn data export turns into before it's applied. Nothing is saved
 * until the person picks what to keep in the preview.
 */
const s = (max: number) => z.string().trim().max(max).catch('').default('');
export const importedSchema = z.object({
  profile: z.object({
    name: s(100), role: s(120), location: s(120), summary: s(2000), yearsExperience: s(20), targetRoles: s(200),
    /** Education, certifications, languages: kept as notes for the "Ask my resume" assistant. */
    assistantNotes: s(4000),
  }).partial().default({}),
  experience: z.array(z.object({
    role: s(120), company: s(120), period: s(60), current: z.boolean().catch(false).default(false),
    bullets: z.array(z.string().trim().max(500)).max(12).catch([]).default([]),
  })).max(30).catch([]).default([]),
  skills: z.array(z.object({ group: s(60), items: z.array(z.string().trim().max(60)).max(60).catch([]).default([]) })).max(12).catch([]).default([]),
});
export type Imported = z.output<typeof importedSchema>;
export type ImportedProfileKey = keyof Imported['profile'];

/** Drops empty rows so the preview and the save only see real entries. */
export function cleanImported(data: Imported): Imported {
  const profile = Object.fromEntries(Object.entries(data.profile).filter(([, v]) => typeof v === 'string' && v.trim())) as Imported['profile'];
  return {
    profile,
    experience: data.experience.filter((e) => e.role.trim() && e.company.trim()).map((e) => ({ ...e, period: e.period.trim() || (e.current ? 'Present' : '—'), bullets: e.bullets.map((b) => b.trim()).filter(Boolean) })),
    skills: data.skills.map((g) => ({ group: g.group.trim() || 'Skills', items: [...new Set(g.items.map((i) => i.trim()).filter(Boolean))] })).filter((g) => g.items.length),
  };
}
