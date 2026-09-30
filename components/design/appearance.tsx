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

/* ---------- field definitions ---------- */

const SPACING = ['default', '0', '8', '16', '24', '32', '48', '64', '96', '128', '160'];
const spacing = (text: string) => ({ type: 'select' as const, label: text, options: SPACING.map((value) => ({ label: value === 'default' ? 'Default' : `${value}px`, value })) });

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
    paddingTop: spacing('Space inside, top'),
    paddingBottom: spacing('Space inside, bottom'),
    marginTop: spacing('Space above'),
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
  paddingTop: 'default', paddingBottom: 'default', marginTop: 'default', width: 'default', align: 'default',
  radius: 'default', border: 'none', shadow: 'none', visibility: 'all', anchor: '',
};

/* ---------- wrapper ---------- */

const px = (value?: string) => (value && value !== 'default' && /^\d{1,3}$/.test(value) ? `${value}px` : undefined);

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
  if (px(a.paddingTop)) box.paddingTop = px(a.paddingTop);
  if (px(a.paddingBottom)) box.paddingBottom = px(a.paddingBottom);
  if (px(a.marginTop)) box.marginTop = px(a.marginTop);
  if (a.border === 'subtle') box.border = '1px solid var(--d-line)';
  if (a.border === 'accent') box.border = '1px solid color-mix(in oklab, var(--d-accent) 55%, transparent)';
  if (a.shadow === 'soft') box.boxShadow = '0 10px 30px -12px rgba(0,0,0,.25)';
  if (a.shadow === 'strong') box.boxShadow = '0 24px 60px -18px rgba(0,0,0,.45)';
  if ((box.backgroundColor || box.backgroundImage || box.border) && a.radius && a.radius !== 'default') box.borderRadius = 'var(--d-radius)';
  if (a.align && a.align !== 'default') box.textAlign = a.align;
  const id = anchorId(a.anchor);

  const hidden = a.visibility === 'desktop' ? 'max-md:hidden' : a.visibility === 'mobile' ? 'md:hidden' : '';
  const hasBox = Object.keys(box).some((key) => key !== 'textAlign' && key !== 'color') || Boolean(id);
  const hasAnything = hasBox || Object.keys(vars).length > 0 || Boolean(box.textAlign) || Boolean(hidden);
  if (!hasAnything) return <>{children}</>;

  // While editing, blocks hidden on this screen size stay visible (faded) so they can still be selected.
  const visibilityClass = editing ? (hidden ? 'opacity-50' : '') : hidden;
  return (
    <div
      id={id}
      // No box of its own (only colors / alignment / visibility): `contents` keeps sticky nav bars and grids working.
      className={`d-styled ${recolor ? 'd-recolor' : ''} ${!hasBox && !editing ? 'contents' : ''} ${visibilityClass} ${id ? 'scroll-mt-20' : ''}`}
      style={{ ...(vars as CSSProperties), ...box }}
    >
      {children}
    </div>
  );
}
