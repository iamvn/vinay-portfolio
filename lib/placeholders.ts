import type { PortfolioData } from './portfolio';

/**
 * Values derived from the profile that site text can reference with {placeholders}.
 * Example copy: "◉ LEVEL {level}", "{years} YEARS EXPERIENCE", "XP {xp} / {xpMax}".
 *
 * Level and XP come from profile.yearsExperience: "6+" → LEVEL 06, XP 6,000 / 10,000;
 * "6.5+" → XP 6,500. The XP bar's maximum grows in steps of 10,000 (10+ years → / 20,000).
 */
export function derivedValues(profile: PortfolioData['profile']): Record<string, string> {
  const years = Number.parseFloat(profile.yearsExperience) || 0;
  const level = Math.floor(years);
  const format = (value: number) => value.toLocaleString('en-US');
  return {
    years: profile.yearsExperience,
    level: String(level).padStart(2, '0'),
    xp: format(Math.round(years * 1000)),
    xpMax: format((Math.floor(years / 10) + 1) * 10000),
    name: profile.name,
    role: profile.role,
    location: profile.location,
  };
}

/** Replaces {key} in every string of a nested value. Unknown keys are left as they are. */
export function fillPlaceholders<T>(value: T, vars: Record<string, string>): T {
  if (typeof value === 'string') return value.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match) as T;
  if (Array.isArray(value)) return value.map((item) => fillPlaceholders(item, vars)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fillPlaceholders(item, vars)])) as T;
  }
  return value;
}

/** Portfolio ready for display: site text with placeholders filled in from the profile. */
export function resolvePortfolio(data: PortfolioData): PortfolioData {
  return { ...data, copy: fillPlaceholders(data.copy, derivedValues(data.profile)) };
}
