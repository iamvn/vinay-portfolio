import type { CSSProperties } from 'react';

/**
 * Site-wide look for designs made in Admin → Design. Every block reads these CSS variables,
 * so switching the preset (or any color, font, corner or button setting) restyles the whole page at once.
 */
export type Palette = { bg: string; surface: string; surface2: string; text: string; muted: string; line: string; accent: string; accent2: string; accent3: string };

export const THEME_PRESETS: Record<string, Palette & { label: string }> = {
  // Matches the original site's colors exactly (Tailwind lime-300 / cyan-300 / purple-300 on near-black).
  classic: { label: 'Classic (original site)', bg: '#030609', surface: '#071018', surface2: '#050c12', text: '#f1f5f9', muted: '#90a1b9', line: 'rgba(255,255,255,.1)', accent: '#bbf451', accent2: '#53eafd', accent3: '#dab2ff' },
  arcade: { label: 'Arcade (dark, neon)', bg: '#030609', surface: '#071018', surface2: '#0a141d', text: '#edf4f7', muted: '#8c9aaa', line: 'rgba(148,163,184,.16)', accent: '#9dff00', accent2: '#31d7ff', accent3: '#b56cff' },
  clean: { label: 'Clean (light)', bg: '#ffffff', surface: '#f6f7f9', surface2: '#eef1f5', text: '#0f172a', muted: '#5b6576', line: '#e2e8f0', accent: '#4f46e5', accent2: '#0284c7', accent3: '#db2777' },
  paper: { label: 'Paper (warm light)', bg: '#faf7f2', surface: '#ffffff', surface2: '#f3eee6', text: '#1f1b16', muted: '#6b6258', line: '#e7e0d6', accent: '#c2410c', accent2: '#0f766e', accent3: '#7c3aed' },
  midnight: { label: 'Midnight (navy)', bg: '#0b1020', surface: '#121a33', surface2: '#18223f', text: '#e6e9f5', muted: '#9aa3c0', line: 'rgba(154,163,192,.18)', accent: '#f5b942', accent2: '#7dd3fc', accent3: '#f472b6' },
  forest: { label: 'Forest (green, calm)', bg: '#0f1a14', surface: '#16241c', surface2: '#1c2e24', text: '#e8f1ea', muted: '#9bb2a3', line: 'rgba(155,178,163,.18)', accent: '#7ee2a8', accent2: '#f2c14e', accent3: '#8ec5ff' },
  mono: { label: 'Mono (black & white)', bg: '#ffffff', surface: '#fafafa', surface2: '#f1f1f1', text: '#0a0a0a', muted: '#666666', line: '#e5e5e5', accent: '#0a0a0a', accent2: '#0a0a0a', accent3: '#0a0a0a' },
};
export type ThemePreset = keyof typeof THEME_PRESETS;

/** Palette overrides in the Page settings ('' = use the preset's color). */
export type PaletteOverrides = Partial<Record<keyof Palette, string>>;
export const PALETTE_FIELDS: { key: keyof Palette; label: string }[] = [
  { key: 'bg', label: 'Page background' },
  { key: 'surface', label: 'Cards & panels' },
  { key: 'surface2', label: 'Soft background' },
  { key: 'text', label: 'Text' },
  { key: 'muted', label: 'Secondary text' },
  { key: 'line', label: 'Borders' },
  { key: 'accent', label: 'Accent (buttons, highlights)' },
  { key: 'accent2', label: 'Second accent' },
  { key: 'accent3', label: 'Third accent' },
];

export const FONTS = {
  system: { label: 'System sans', stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif' },
  arial: { label: 'Arial / Helvetica', stack: 'Arial, Helvetica, sans-serif' },
  serif: { label: 'Serif (Georgia)', stack: 'Georgia, Cambria, "Times New Roman", serif' },
  mono: { label: 'Monospace', stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
  rounded: { label: 'Rounded', stack: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif' },
  condensed: { label: 'Condensed', stack: '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif' },
} as const;
export type FontKey = keyof typeof FONTS;

export const RADII = { none: '0px', small: '6px', medium: '12px', large: '20px', xl: '28px' } as const;
export const WIDTHS = { narrow: '860px', normal: '1120px', wide: '1320px', full: '100%' } as const;
const SIZES = { small: '15px', medium: '16px', large: '17.5px' } as const;
const WEIGHTS = { normal: '500', bold: '700', black: '900' } as const;

export type RootProps = {
  theme: ThemePreset;
  colors: PaletteOverrides;
  accent?: string; // older designs: accent override (now colors.accent)
  headingFont: FontKey;
  bodyFont: FontKey;
  textSize: keyof typeof SIZES;
  headingWeight: keyof typeof WEIGHTS;
  headingCase: 'normal' | 'uppercase';
  radius: keyof typeof RADII;
  buttonShape: 'theme' | 'pill' | 'square';
  buttonStyle: 'solid' | 'outline';
  width: keyof typeof WIDTHS;
  direction: 'ltr' | 'rtl';
  effects: 'none' | 'grid' | 'scanlines';
  showAskAi: 'yes' | 'no';
};

export const DEFAULT_ROOT: RootProps = {
  theme: 'clean', colors: {}, headingFont: 'system', bodyFont: 'system', textSize: 'medium', headingWeight: 'black',
  headingCase: 'normal', radius: 'medium', buttonShape: 'theme', buttonStyle: 'solid', width: 'normal', direction: 'ltr',
  effects: 'none', showAskAi: 'yes',
};

export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
/** Colors a design may use: hex, or rgb()/rgba() with plain numbers (nothing that could break out of CSS). */
export function isSafeColor(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const color = value.trim();
  return isHexColor(color) || /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)$/i.test(color);
}

/** Black or white text, whichever reads better on the given color. */
export function readableOn(color: string) {
  if (!isHexColor(color)) return '#0b0f14';
  let h = color.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0b0f14' : '#ffffff';
}

const pick = <T extends object>(map: T, key: unknown, fallback: keyof T): keyof T => (typeof key === 'string' && key in map ? (key as keyof T) : fallback);

/** The palette in use: the preset, with any custom colors from the Page settings on top. */
export function resolvePalette(props: Partial<RootProps>): Palette {
  const preset = THEME_PRESETS[pick(THEME_PRESETS, props.theme, 'clean') as string];
  const overrides: PaletteOverrides = { ...(isHexColor(props.accent) ? { accent: props.accent } : {}), ...(props.colors ?? {}) };
  const palette = { ...preset } as Palette & { label?: string };
  delete palette.label;
  for (const { key } of PALETTE_FIELDS) if (isSafeColor(overrides[key])) palette[key] = overrides[key]!.trim();
  return palette;
}

/** True when the classic blocks should follow the palette (anything other than the untouched Classic preset). */
export const recolorsClassic = (props: Partial<RootProps>) =>
  props.theme !== 'classic' || isHexColor(props.accent) || Object.values(props.colors ?? {}).some((value) => isSafeColor(value));

/** CSS variables for the design root. Unknown values fall back to safe defaults. */
export function themeVars(props: Partial<RootProps>): CSSProperties {
  const p = resolvePalette(props);
  const radius = RADII[pick(RADII, props.radius, 'medium')];
  const buttonRadius = props.buttonShape === 'pill' ? '999px' : props.buttonShape === 'square' ? '0px' : radius;
  return {
    '--d-bg': p.bg, '--d-surface': p.surface, '--d-surface-2': p.surface2, '--d-text': p.text, '--d-muted': p.muted,
    '--d-line': p.line, '--d-accent': p.accent, '--d-accent-text': readableOn(p.accent), '--d-accent-2': p.accent2, '--d-accent-3': p.accent3,
    '--d-radius': radius,
    '--d-button-radius': buttonRadius,
    '--d-width': WIDTHS[pick(WIDTHS, props.width, 'normal')],
    '--d-heading-font': FONTS[pick(FONTS, props.headingFont, 'system')].stack,
    '--d-body-font': FONTS[pick(FONTS, props.bodyFont, 'system')].stack,
    '--d-heading-weight': WEIGHTS[pick(WEIGHTS, props.headingWeight, 'black')],
    '--d-heading-case': props.headingCase === 'uppercase' ? 'uppercase' : 'none',
    fontSize: SIZES[pick(SIZES, props.textSize, 'medium')],
  } as CSSProperties;
}

/** Links a design may point to: web pages, email, phone, and same-site paths or #anchors. */
export function safeHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const href = value.trim();
  if (!href) return undefined;
  if (/^(https?:|mailto:|tel:)/i.test(href) || href.startsWith('#') || (href.startsWith('/') && !href.startsWith('//'))) return href;
  return undefined;
}

/** Images a design may show: https URLs and files served by this site. */
export function safeSrc(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const src = value.trim();
  if ((/^https?:\/\//i.test(src) || (src.startsWith('/') && !src.startsWith('//'))) && !/["'()\\\s<>]/.test(src)) return src;
  return undefined;
}

/** A section anchor id from free text ("About me" → "about-me"). */
export const anchorId = (value: unknown) =>
  (typeof value === 'string' ? value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') : '') || undefined;
