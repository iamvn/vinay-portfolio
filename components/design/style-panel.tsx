/**
 * The "Design" side of every block's settings in Admin → Design (like the style panel in Shopify/Webflow):
 * spacing, size, background & colors, border & corners, flex/grid item behaviour, visibility.
 * Each block's panel has a Content | Design switch at the top so these are one click away.
 *
 * Designs saved before this panel kept everything in one `appearance` object; `styleOf` still reads it and
 * `migrateDesign` moves it into the new groups when a design is opened, so nothing changes visually.
 * Server-safe (no hooks): used by the live homepage too.
 */
import type { CSSProperties, ReactNode } from 'react';
import { anchorId, isSafeColor, readableOn, safeSrc, RADII, WIDTHS } from '@/lib/design/theme';
import { colorField, sidesVars, spacingField, type Appearance, type Sides } from './appearance';
import { safeLength } from './builder-blocks';

// ---------- the groups ----------

export type StyleSpacing = { padding: Sides; paddingMobile: Sides; margin: Sides };
export type StyleSize = { width: string; minWidth: string; maxWidth: string; height: string; minHeight: string; position: 'default' | 'left' | 'center' | 'right'; contentWidth: 'default' | keyof typeof WIDTHS };
export type StyleColors = {
  background: string; gradientTo: string; gradientAngle: number; backgroundImage: string; overlay: 'none' | 'light' | 'dark';
  textColor: string; accentColor: string; cardColor: string; textAlign: 'default' | 'left' | 'center' | 'right';
};
export type StyleBorder = {
  borderWidth: number; borderStyle: 'solid' | 'dashed' | 'dotted'; borderTone: 'subtle' | 'accent' | 'text' | 'custom'; borderColor: string;
  radius: string; shadow: 'none' | 'sm' | 'md' | 'lg'; opacity: number;
};
export type StyleItem = { grow: boolean; shrink: boolean; basis: string; alignSelf: 'auto' | 'stretch' | 'flex-start' | 'center' | 'flex-end'; order: number; gridSpan: string };
export type StyleMore = { visibility: 'all' | 'desktop' | 'mobile'; anchor: string };
export type StyleProps = { _view?: 'content' | 'design'; spacing?: Partial<StyleSpacing>; size?: Partial<StyleSize>; colors?: Partial<StyleColors>; border?: Partial<StyleBorder>; item?: Partial<StyleItem>; more?: Partial<StyleMore>; appearance?: Appearance };

export const STYLE_DEFAULTS: { _view: 'content'; spacing: StyleSpacing; size: StyleSize; colors: StyleColors; border: StyleBorder; item: StyleItem; more: StyleMore } = {
  _view: 'content',
  spacing: { padding: {}, paddingMobile: {}, margin: {} },
  size: { width: '', minWidth: '', maxWidth: '', height: '', minHeight: '', position: 'default', contentWidth: 'default' },
  colors: { background: '', gradientTo: '', gradientAngle: 135, backgroundImage: '', overlay: 'none', textColor: '', accentColor: '', cardColor: '', textAlign: 'default' },
  border: { borderWidth: 0, borderStyle: 'solid', borderTone: 'subtle', borderColor: '', radius: '', shadow: 'none', opacity: 100 },
  item: { grow: false, shrink: true, basis: '', alignSelf: 'auto', order: 0, gridSpan: '1' },
  more: { visibility: 'all', anchor: '' },
};
export const STYLE_KEYS = ['spacing', 'size', 'colors', 'border', 'item', 'more'] as const;

const opt = <T extends string>(...pairs: [T, string][]) => pairs.map(([value, label]) => ({ value, label }));
const yesNo = (label: string) => ({ type: 'radio' as const, label, options: [{ value: true, label: 'Yes' }, { value: false, label: 'No' }] });

export const viewField = {
  type: 'radio' as const, label: 'Settings',
  options: [{ value: 'content', label: '✎ Content' }, { value: 'design', label: '🎨 Design (spacing, size, colors, border)' }],
};

export const styleFields = {
  spacing: {
    type: 'object' as const, label: 'Spacing',
    objectFields: {
      padding: spacingField('Padding (inside)'),
      paddingMobile: spacingField('Padding on phones', 'Only on phones. Empty sides use the padding above.'),
      margin: spacingField('Margin (outside)'),
    },
  },
  size: {
    type: 'object' as const, label: 'Size',
    objectFields: {
      width: { type: 'text' as const, label: 'Width', placeholder: 'auto, 100%, 320px, 50%' },
      minWidth: { type: 'text' as const, label: 'Min width', placeholder: 'e.g. 240px' },
      maxWidth: { type: 'text' as const, label: 'Max width', placeholder: 'e.g. 720px' },
      height: { type: 'text' as const, label: 'Height', placeholder: 'auto, 400px, 60vh' },
      minHeight: { type: 'text' as const, label: 'Min height', placeholder: 'e.g. 300px' },
      position: { type: 'radio' as const, label: 'Position (when narrower)', options: opt(['default', 'Default'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right']) },
      contentWidth: { type: 'select' as const, label: 'Content width inside', options: opt(['default', 'Default'], ['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide'], ['full', 'Full width']) },
    },
  },
  colors: {
    type: 'object' as const, label: 'Background & colors',
    objectFields: {
      background: colorField('Background color'),
      gradientTo: colorField('Gradient to (optional)'),
      gradientAngle: { type: 'number' as const, label: 'Gradient angle (°)', min: 0, max: 360 },
      backgroundImage: { type: 'text' as const, label: 'Background image URL', placeholder: 'https://… or /images/…' },
      overlay: { type: 'radio' as const, label: 'Image overlay', options: opt(['none', 'None'], ['light', 'Light'], ['dark', 'Dark']) },
      textColor: colorField('Text color'),
      accentColor: colorField('Accent color (buttons, highlights)'),
      cardColor: colorField('Card color'),
      textAlign: { type: 'radio' as const, label: 'Text align', options: opt(['default', 'Default'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right']) },
    },
  },
  border: {
    type: 'object' as const, label: 'Border, corners & shadow',
    objectFields: {
      borderWidth: { type: 'number' as const, label: 'Border width (px)', min: 0, max: 20 },
      borderStyle: { type: 'radio' as const, label: 'Border style', options: opt(['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']) },
      borderTone: { type: 'select' as const, label: 'Border color', options: opt(['subtle', 'Subtle (theme)'], ['accent', 'Accent'], ['text', 'Text'], ['custom', 'Custom…']) },
      borderColor: colorField('Custom border color'),
      radius: { type: 'text' as const, label: 'Corner radius', placeholder: 'e.g. 12px, 50%, 0' },
      shadow: { type: 'radio' as const, label: 'Shadow', options: opt(['none', 'None'], ['sm', 'S'], ['md', 'M'], ['lg', 'L']) },
      opacity: { type: 'number' as const, label: 'Opacity (%)', min: 0, max: 100 },
    },
  },
  item: {
    type: 'object' as const, label: 'Inside a row, grid or box',
    objectFields: {
      grow: yesNo('Grow to fill space (flex)'),
      shrink: yesNo('Can shrink (flex)'),
      basis: { type: 'text' as const, label: 'Base width (flex-basis)', placeholder: 'e.g. 50%, 300px' },
      alignSelf: { type: 'select' as const, label: 'Align self', options: opt(['auto', 'Auto'], ['stretch', 'Stretch'], ['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End']) },
      order: { type: 'number' as const, label: 'Order', min: -10, max: 10 },
      gridSpan: { type: 'select' as const, label: 'Span grid columns', options: opt(['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['full', 'Full row']) },
    },
  },
  more: {
    type: 'object' as const, label: 'Visibility & anchor',
    objectFields: {
      visibility: { type: 'radio' as const, label: 'Show on', options: opt(['all', 'All'], ['desktop', 'Desktop'], ['mobile', 'Phone']) },
      anchor: { type: 'text' as const, label: 'Anchor id (link to it with #id)' },
    },
  },
};

// ---------- reading old designs ----------

const RADIUS_PRESETS: Record<string, string> = { none: '0', small: RADII.small, medium: RADII.medium, large: RADII.large, xl: RADII.xl };

/** The new groups from an old `appearance` object (designs saved before the Design panel). */
export function fromAppearance(a: Appearance | undefined): Required<Pick<StyleProps, 'spacing' | 'size' | 'colors' | 'border' | 'more'>> {
  const x = a ?? {};
  return {
    spacing: {
      padding: { ...(x.paddingTop ? { top: x.paddingTop } : {}), ...(x.paddingBottom ? { bottom: x.paddingBottom } : {}), ...(x.padding ?? {}) },
      paddingMobile: x.paddingMobile ?? {},
      margin: { ...(x.marginTop ? { top: x.marginTop } : {}), ...(x.margin ?? {}) },
    },
    size: {
      maxWidth: x.maxWidth ?? '', minHeight: x.minHeight ?? '', position: x.blockAlign ?? 'default',
      contentWidth: x.width && x.width !== 'default' ? x.width : 'default',
    },
    colors: {
      background: x.background ?? '', backgroundImage: x.backgroundImage ?? '', overlay: x.overlay ?? 'none', textColor: x.textColor ?? '',
      accentColor: x.accentColor ?? '', cardColor: x.cardColor ?? '', textAlign: x.align ?? 'default',
    },
    border: {
      borderWidth: x.border === 'subtle' || x.border === 'accent' ? 1 : 0,
      borderTone: x.border === 'accent' ? 'accent' : 'subtle',
      // Before, corners only applied to boxes with a background or border; kept that way.
      radius: x.radius && x.radius !== 'default' ? RADIUS_PRESETS[x.radius] ?? '' : '',
      shadow: x.shadow === 'soft' ? 'md' : x.shadow === 'strong' ? 'lg' : 'none',
    },
    more: { visibility: x.visibility ?? 'all', anchor: x.anchor ?? '' },
  };
}

const isEmptyValue = (v: unknown) => v === '' || v === undefined || v === null || (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every(isEmptyValue));

/** Old `appearance` first, then whatever the new groups set (new settings win). */
function resolved(props: StyleProps) {
  const legacy = props.appearance ? fromAppearance(props.appearance) : null;
  const pick = <K extends (typeof STYLE_KEYS)[number]>(key: K) => {
    const base = { ...STYLE_DEFAULTS[key], ...(legacy && key in legacy ? (legacy as Record<string, object>)[key] : {}) } as (typeof STYLE_DEFAULTS)[K];
    const own = props[key] ?? {};
    for (const [k, v] of Object.entries(own)) if (!isEmptyValue(v)) (base as Record<string, unknown>)[k] = v;
    return base;
  };
  return { spacing: pick('spacing'), size: pick('size'), colors: pick('colors'), border: pick('border'), item: pick('item'), more: pick('more') };
}

/** Moves every block's old `appearance` into the new groups (run when a design is opened in the editor). */
export function migrateDesign<T>(data: T): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const record = node as Record<string, unknown>;
    if (typeof record.type === 'string' && record.props && typeof record.props === 'object') {
      const props = { ...(record.props as Record<string, unknown>) };
      if (props.appearance && typeof props.appearance === 'object') {
        const legacy = fromAppearance(props.appearance as Appearance);
        for (const key of Object.keys(legacy) as (keyof typeof legacy)[]) {
          props[key] = { ...STYLE_DEFAULTS[key], ...(legacy[key] as object), ...((props[key] as object) ?? {}) };
        }
        delete props.appearance;
      }
      for (const [k, v] of Object.entries(props)) if (Array.isArray(v)) props[k] = v.map(walk);
      return { ...record, props };
    }
    return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, walk(v)]));
  };
  return walk(data) as T;
}

// ---------- applying it ----------

const SHADOWS: Record<string, string> = { sm: '0 2px 8px -2px rgba(0,0,0,.18)', md: '0 10px 30px -12px rgba(0,0,0,.25)', lg: '0 24px 60px -18px rgba(0,0,0,.45)' };
const TONES: Record<string, string> = { subtle: 'var(--d-line)', text: 'var(--d-text)', accent: 'color-mix(in oklab, var(--d-accent) 55%, transparent)' };
const clamp = (value: unknown, min: number, max: number, fallback: number) => { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
/** A radius: "12", "12px", "50%", "1rem". */
const safeRadius = (value: unknown) => {
  const v = String(value ?? '').trim();
  if (!v) return undefined;
  if (/^\d{1,3}$/.test(v)) return `${v}px`;
  return /^\d{1,3}(\.\d)?(px|%|rem|em)$/.test(v) ? v : undefined;
};

/**
 * Wraps a block with its Design settings. With nothing set it adds no box at all (and while editing, a block
 * hidden on this screen size stays visible, faded, so it can still be selected).
 */
export function StyledBlock({ props, editing, panel = false, children }: { props: StyleProps; editing: boolean; panel?: boolean; children: ReactNode }) {
  const { spacing, size, colors, border, item, more } = resolved(props);
  const vars: Record<string, string> = {};
  const box: Record<string, string | number> = {};
  let recolor = false;

  // background & colors
  const bg = isSafeColor(colors.background) ? colors.background : undefined;
  if (bg) {
    vars['--d-bg'] = bg;
    if (panel) { vars['--d-surface'] = bg; vars['--d-surface-2'] = bg; } else box.backgroundColor = bg;
    recolor = true;
  }
  const layers: string[] = [];
  const image = safeSrc(colors.backgroundImage);
  if (image) {
    const shade = colors.overlay === 'dark' ? 'rgba(0,0,0,.55)' : colors.overlay === 'light' ? 'rgba(255,255,255,.6)' : '';
    if (shade) layers.push(`linear-gradient(${shade}, ${shade})`);
    layers.push(`url("${image}")`);
    box.backgroundSize = 'cover';
    box.backgroundPosition = 'center';
  }
  if (bg && isSafeColor(colors.gradientTo) && !panel) layers.push(`linear-gradient(${clamp(colors.gradientAngle, 0, 360, 135)}deg, ${bg}, ${colors.gradientTo})`);
  if (layers.length) box.backgroundImage = layers.join(', ');
  if (isSafeColor(colors.textColor)) {
    vars['--d-text'] = colors.textColor;
    vars['--d-muted'] = `color-mix(in oklab, ${colors.textColor} 70%, transparent)`;
    box.color = colors.textColor;
    recolor = true;
  }
  if (isSafeColor(colors.accentColor)) { vars['--d-accent'] = colors.accentColor; vars['--d-accent-text'] = readableOn(colors.accentColor); recolor = true; }
  if (isSafeColor(colors.cardColor)) {
    vars['--d-surface'] = colors.cardColor;
    vars['--d-surface-2'] = `color-mix(in oklab, ${colors.cardColor} 85%, var(--d-text))`;
    recolor = true;
  }
  if (colors.textAlign !== 'default') box.textAlign = colors.textAlign;

  // spacing
  const pad = sidesVars(spacing.padding, spacing.paddingMobile, {}, {});
  const padded = Object.keys(pad.set).length > 0;
  if (padded) Object.assign(vars, pad.set);
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const value = safeLength(spacing.margin?.[side]);
    if (value) box[`margin${side[0].toUpperCase()}${side.slice(1)}`] = value;
  }

  // size
  for (const key of ['width', 'minWidth', 'maxWidth', 'height', 'minHeight'] as const) {
    const value = safeLength(size[key]);
    if (value) box[key] = value;
  }
  if (box.maxWidth || box.width) {
    if (size.position === 'center' || size.position === 'default') { box.marginLeft ??= 'auto'; box.marginRight ??= 'auto'; }
    if (size.position === 'right') box.marginLeft ??= 'auto';
    if (size.position === 'left') box.marginRight ??= 'auto';
  }
  if (size.contentWidth !== 'default' && size.contentWidth in WIDTHS) vars['--d-width'] = WIDTHS[size.contentWidth];

  // border, corners, shadow, opacity
  const width = clamp(border.borderWidth, 0, 20, 0);
  if (width > 0) {
    const tone = border.borderTone === 'custom' ? (isSafeColor(border.borderColor) ? border.borderColor : 'var(--d-line)') : TONES[border.borderTone] ?? 'var(--d-line)';
    box.border = `${width}px ${border.borderStyle} ${tone}`;
  }
  const radius = safeRadius(border.radius);
  if (radius) { box.borderRadius = radius; vars['--d-radius'] = radius; if (box.backgroundImage || box.backgroundColor) box.overflow = 'hidden'; }
  if (SHADOWS[border.shadow]) box.boxShadow = SHADOWS[border.shadow];
  const opacity = clamp(border.opacity, 0, 100, 100);
  if (opacity < 100) box.opacity = opacity / 100;

  // as an item in a flex row / grid / box
  if (item.grow) box.flexGrow = 1;
  if (!item.shrink) box.flexShrink = 0;
  const basis = safeLength(item.basis);
  if (basis) box.flexBasis = basis;
  if (item.alignSelf !== 'auto') box.alignSelf = item.alignSelf;
  if (item.order) box.order = clamp(item.order, -10, 10, 0);
  if (item.gridSpan === 'full') box.gridColumn = '1 / -1';
  else if (['2', '3', '4'].includes(item.gridSpan)) box.gridColumn = `span ${item.gridSpan}`;

  const id = anchorId(more.anchor);
  const hidden = more.visibility === 'desktop' ? 'max-md:hidden' : more.visibility === 'mobile' ? 'md:hidden' : '';
  const hasBox = Object.keys(box).some((key) => key !== 'textAlign' && key !== 'color') || Boolean(id) || padded;
  if (!hasBox && !Object.keys(vars).length && !box.textAlign && !box.color && !hidden) return <>{children}</>;

  const visibilityClass = editing ? (hidden ? 'opacity-50' : '') : hidden;
  return (
    <div
      id={id}
      // No box of its own (only colors / alignment / visibility): `contents` keeps sticky nav bars and grids working.
      className={`d-styled ${padded ? 'd-padded' : ''} ${recolor ? 'd-recolor' : ''} ${!hasBox && !editing ? 'contents' : ''} ${visibilityClass} ${id ? 'scroll-mt-20' : ''}`}
      style={{ ...(vars as CSSProperties), ...(box as CSSProperties) }}
    >
      {children}
    </div>
  );
}
