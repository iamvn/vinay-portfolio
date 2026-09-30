/**
 * "Style" settings every block gets in Admin → Design (like a Shopify section's settings):
 * background color or image, text / accent / card colors, spacing, width, corners, border, shadow,
 * alignment and phone/desktop visibility. Server-safe (no hooks).
 */
import type { CSSProperties, ReactNode } from 'react';
import { isSafeColor, readableOn, safeSrc, anchorId, RADII, WIDTHS } from '@/lib/design/theme';

export type Appearance = {
  background?: string;
  backgroundImage?: string;
  overlay?: 'none' | 'light' | 'dark';
  textColor?: string;
  accentColor?: string;
  cardColor?: string;
  padding?: Sides;          // space inside the block (px)
  paddingMobile?: Sides;    // phones only; empty sides fall back to `padding`
  margin?: Sides;           // space around the block (px)
  maxWidth?: string;        // px; empty = full width of its container
  minHeight?: string;       // px
  blockAlign?: 'default' | 'left' | 'center' | 'right'; // where a narrower block sits
  /** Older designs (before the four-side spacing editor). */
  paddingTop?: string;
  paddingBottom?: string;
  marginTop?: string;
  width?: 'default' | keyof typeof WIDTHS;
  align?: 'default' | 'left' | 'center' | 'right';
  radius?: 'default' | keyof typeof RADII;
  border?: 'none' | 'subtle' | 'accent';
  shadow?: 'none' | 'soft' | 'strong';
  visibility?: 'all' | 'desktop' | 'mobile';
  anchor?: string;
};

export type Sides = { top?: string; right?: string; bottom?: string; left?: string };
const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/* ---------- color picker field (editor only) ---------- */

const label = 'mb-1.5 block text-[13px] font-semibold text-slate-700';

export const colorField = (text: string) => ({
  type: 'custom' as const,
  label: text,
  render: ({ value, onChange, readOnly, id }: { value?: string; onChange: (value: string) => void; readOnly?: boolean; id?: string; name?: string }) => {
    const current = typeof value === 'string' ? value : '';
    const valid = isSafeColor(current);
    return (
      <div className="d-color-field">
        <span className={label}>{text}</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={`${text}: pick a color`}
            disabled={readOnly}
            value={valid && current.startsWith('#') && current.length === 7 ? current : valid && current.length === 4 ? `#${current.slice(1).split('').map((c) => c + c).join('')}` : '#888888'}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-11 shrink-0 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
          />
          <input
            id={id}
            type="text"
            placeholder="Default"
            disabled={readOnly}
            value={current}
            onChange={(e) => onChange(e.target.value.trim())}
            spellCheck={false}
            className={`h-9 min-w-0 flex-1 rounded border px-2 font-mono text-[13px] text-slate-800 ${current && !valid ? 'border-red-400' : 'border-slate-300'}`}
          />
          {current && <button type="button" disabled={readOnly} onClick={() => onChange('')} className="h-9 shrink-0 rounded border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" title="Back to the theme color">Reset</button>}
        </div>
        {current && !valid && <span className="mt-1 block text-[11px] text-red-600">Use a hex color like #1e293b</span>}
      </div>
    );
  },
});

/* ---------- four-side spacing field (editor only) ---------- */

const clampPx = (value: string) => {
  const digits = value.replace(/[^\d]/g, '').slice(0, 3);
  return digits === '' ? '' : String(Math.min(400, Number(digits)));
};

/** Box-model editor: top / right / bottom / left in px, plus "all sides" at once. Empty = default. */
export const spacingField = (text: string, hint?: string) => ({
  type: 'custom' as const,
  label: text,
  render: ({ value, onChange, readOnly }: { value?: Sides; onChange: (value: Sides) => void; readOnly?: boolean }) => {
    const current: Sides = value && typeof value === 'object' ? value : {};
    const set = (side: keyof Sides, raw: string) => onChange({ ...current, [side]: clampPx(raw) });
    const same = SIDES.every((side) => (current[side] ?? '') === (current.top ?? ''));
    const input = (side: keyof Sides) => (
      <input
        aria-label={`${text}: ${side} (px)`}
        inputMode="numeric"
        placeholder="–"
        disabled={readOnly}
        value={current[side] ?? ''}
        onChange={(e) => set(side, e.target.value)}
        className="h-8 w-12 rounded border border-slate-300 bg-white text-center font-mono text-[12px] text-slate-800"
      />
    );
    return (
      <div className="d-spacing-field">
        <span className={label}>{text}</span>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 p-2">
          <span />
          <div className="flex justify-center">{input('top')}</div>
          <span />
          <div>{input('left')}</div>
          <div className="flex items-center justify-center">
            <input
              aria-label={`${text}: all sides (px)`}
              inputMode="numeric"
              placeholder="all"
              disabled={readOnly}
              value={same ? current.top ?? '' : ''}
              onChange={(e) => { const v = clampPx(e.target.value); onChange({ top: v, right: v, bottom: v, left: v }); }}
              className="h-8 w-14 rounded border border-slate-400 bg-white text-center font-mono text-[12px] font-semibold text-slate-900"
            />
          </div>
          <div className="flex justify-end">{input('right')}</div>
          <span />
          <div className="flex justify-center">{input('bottom')}</div>
          <span />
        </div>
        <span className="mt-1 block text-[11px] text-slate-500">{hint ?? 'Pixels. Empty = default.'}</span>
      </div>
    );
  },
});

/* ---------- field definitions ---------- */


export const appearanceField = {
  type: 'object' as const,
  label: 'Style',
  objectFields: {
    background: colorField('Background color'),
    backgroundImage: { type: 'text' as const, label: 'Background image URL (optional)' },
    overlay: { type: 'radio' as const, label: 'Image overlay', options: [{ label: 'None', value: 'none' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }] },
    textColor: colorField('Text color'),
    accentColor: colorField('Accent color'),
    cardColor: colorField('Card color'),
    padding: spacingField('Padding (space inside)'),
    paddingMobile: spacingField('Padding on phones', 'Only on phones. Empty sides use the padding above.'),
    margin: spacingField('Margin (space outside)'),
    maxWidth: { type: 'text' as const, label: 'Max width (px, empty = full)' },
    blockAlign: { type: 'radio' as const, label: 'Position (when narrower)', options: [{ label: 'Default', value: 'default' }, { label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] },
    minHeight: { type: 'text' as const, label: 'Min height (px)' },
    width: { type: 'select' as const, label: 'Content width', options: [{ label: 'Default', value: 'default' }, { label: 'Narrow', value: 'narrow' }, { label: 'Normal', value: 'normal' }, { label: 'Wide', value: 'wide' }, { label: 'Full width', value: 'full' }] },
    align: { type: 'select' as const, label: 'Text align', options: [{ label: 'Default', value: 'default' }, { label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }] },
    radius: { type: 'select' as const, label: 'Corners', options: [{ label: 'Default', value: 'default' }, { label: 'Square', value: 'none' }, { label: 'Small', value: 'small' }, { label: 'Medium', value: 'medium' }, { label: 'Large', value: 'large' }, { label: 'Extra large', value: 'xl' }] },
    border: { type: 'radio' as const, label: 'Border', options: [{ label: 'None', value: 'none' }, { label: 'Subtle', value: 'subtle' }, { label: 'Accent', value: 'accent' }] },
    shadow: { type: 'radio' as const, label: 'Shadow', options: [{ label: 'None', value: 'none' }, { label: 'Soft', value: 'soft' }, { label: 'Strong', value: 'strong' }] },
    visibility: { type: 'radio' as const, label: 'Show on', options: [{ label: 'All', value: 'all' }, { label: 'Desktop', value: 'desktop' }, { label: 'Phone', value: 'mobile' }] },
    anchor: { type: 'text' as const, label: 'Anchor id (link to it with #id)' },
  },
};

export const DEFAULT_APPEARANCE: Appearance = {
  background: '', backgroundImage: '', overlay: 'none', textColor: '', accentColor: '', cardColor: '',
  padding: {}, paddingMobile: {}, margin: {}, maxWidth: '', minHeight: '', blockAlign: 'default', width: 'default', align: 'default',
  radius: 'default', border: 'none', shadow: 'none', visibility: 'all', anchor: '',
};

/* ---------- wrapper ---------- */

const px = (value?: string) => (typeof value === 'string' && value !== 'default' && /^\d{1,4}$/.test(value.trim()) ? `${Math.min(2000, Number(value))}px` : undefined);

/**
 * CSS variables for a `.d-padded` element from padding settings, with defaults for sides left empty.
 * `set` lists only what the user typed, so callers can tell "customised" from "all defaults".
 */
export function sidesVars(padding: Sides | undefined, mobile: Sides | undefined, defaults: Sides, mobileDefaults: Sides) {
  const style: Record<string, string> = {};
  const set: Record<string, string> = {};
  for (const side of SIDES) {
    const desktop = px(padding?.[side]);
    const phone = px(mobile?.[side]);
    if (desktop) set[`--p-${side}`] = desktop;
    if (phone) set[`--pm-${side}`] = phone;
    style[`--p-${side}`] = desktop ?? `${defaults[side] ?? 0}px`;
    style[`--pm-${side}`] = phone ?? desktop ?? `${mobileDefaults[side] ?? 0}px`;
  }
  return { style: style as CSSProperties, set };
}

/** Applies a block's Style settings around it. With nothing set it adds no box at all. */
export function Styled({ appearance, editing, panel = false, children }: { appearance?: Appearance; editing: boolean; panel?: boolean; children: ReactNode }) {
  // `panel`: Classic sections draw their own panels, so their background color recolors those panels
  // instead of painting a box around them.
  const a = appearance ?? {};
  const vars: Record<string, string> = {};
  const box: CSSProperties = {};
  let recolor = false;

  if (isSafeColor(a.background)) {
    vars['--d-bg'] = a.background!;
    if (panel) { vars['--d-surface'] = a.background!; vars['--d-surface-2'] = a.background!; } else box.backgroundColor = a.background;
    recolor = true;
  }
  const image = safeSrc(a.backgroundImage);
  if (image) {
    const shade = a.overlay === 'dark' ? 'rgba(0,0,0,.55)' : a.overlay === 'light' ? 'rgba(255,255,255,.6)' : '';
    box.backgroundImage = `${shade ? `linear-gradient(${shade}, ${shade}), ` : ''}url("${image}")`;
    box.backgroundSize = 'cover';
    box.backgroundPosition = 'center';
  }
  if (isSafeColor(a.textColor)) {
    vars['--d-text'] = a.textColor!;
    vars['--d-muted'] = `color-mix(in oklab, ${a.textColor} 70%, transparent)`;
    box.color = a.textColor;
    recolor = true;
  }
  if (isSafeColor(a.accentColor)) {
    vars['--d-accent'] = a.accentColor!;
    vars['--d-accent-text'] = readableOn(a.accentColor!);
    recolor = true;
  }
  if (isSafeColor(a.cardColor)) {
    vars['--d-surface'] = a.cardColor!;
    vars['--d-surface-2'] = `color-mix(in oklab, ${a.cardColor} 85%, var(--d-text))`;
    recolor = true;
  }
  if (a.width && a.width !== 'default' && a.width in WIDTHS) vars['--d-width'] = WIDTHS[a.width];
  if (a.radius && a.radius !== 'default' && a.radius in RADII) vars['--d-radius'] = RADII[a.radius];
  // Four-side spacing (older designs stored only top/bottom padding and top margin).
  const padding: Sides = { top: a.paddingTop, bottom: a.paddingBottom, ...(a.padding ?? {}) };
  const margin: Sides = { top: a.marginTop, ...(a.margin ?? {}) };
  let padded = false;
  for (const side of SIDES) {
    const value = px(padding[side]);
    if (value) { vars[`--p-${side}`] = value; padded = true; }
    const mobile = px(a.paddingMobile?.[side]);
    if (mobile) { vars[`--pm-${side}`] = mobile; padded = true; }
    const outer = px(margin[side]);
    if (outer) box[`margin${side[0].toUpperCase()}${side.slice(1)}` as 'marginTop'] = outer;
  }
  const maxWidth = px(a.maxWidth);
  if (maxWidth) {
    box.maxWidth = maxWidth;
    if (a.blockAlign === 'center' || !a.blockAlign || a.blockAlign === 'default') { box.marginLeft ??= 'auto'; box.marginRight ??= 'auto'; }
    if (a.blockAlign === 'right') { box.marginLeft ??= 'auto'; }
    if (a.blockAlign === 'left') { box.marginRight ??= 'auto'; }
  }
  if (px(a.minHeight)) box.minHeight = px(a.minHeight);
  if (a.border === 'subtle') box.border = '1px solid var(--d-line)';
  if (a.border === 'accent') box.border = '1px solid color-mix(in oklab, var(--d-accent) 55%, transparent)';
  if (a.shadow === 'soft') box.boxShadow = '0 10px 30px -12px rgba(0,0,0,.25)';
  if (a.shadow === 'strong') box.boxShadow = '0 24px 60px -18px rgba(0,0,0,.45)';
  if ((box.backgroundColor || box.backgroundImage || box.border) && a.radius && a.radius !== 'default') box.borderRadius = 'var(--d-radius)';
  if (a.align && a.align !== 'default') box.textAlign = a.align;
  const id = anchorId(a.anchor);

  const hidden = a.visibility === 'desktop' ? 'max-md:hidden' : a.visibility === 'mobile' ? 'md:hidden' : '';
  const hasBox = Object.keys(box).some((key) => key !== 'textAlign' && key !== 'color') || Boolean(id) || padded;
  const hasAnything = hasBox || Object.keys(vars).length > 0 || Boolean(box.textAlign) || Boolean(hidden);
  if (!hasAnything) return <>{children}</>;

  // While editing, blocks hidden on this screen size stay visible (faded) so they can still be selected.
  const visibilityClass = editing ? (hidden ? 'opacity-50' : '') : hidden;
  return (
    <div
      id={id}
      // No box of its own (only colors / alignment / visibility): `contents` keeps sticky nav bars and grids working.
      className={`d-styled ${padded ? 'd-padded' : ''} ${recolor ? 'd-recolor' : ''} ${!hasBox && !editing ? 'contents' : ''} ${visibilityClass} ${id ? 'scroll-mt-20' : ''}`}
      style={{ ...(vars as CSSProperties), ...box }}
    >
      {children}
    </div>
  );
}
