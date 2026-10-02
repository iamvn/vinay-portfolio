/**
 * "Build from scratch" blocks for Admin → Design (like Shopify / Webflow):
 *   - Box: a real <div> you size, color and lay out (block, flex row/column, grid) and nest freely;
 *   - Link, Icon, Video, Quote, FAQ (accordion);
 *   - Form with fields (input, text area, dropdown / multi-select, checkboxes / radios) that sends to your admin.
 * Server-safe: every value from a design is checked before it reaches CSS or HTML.
 */
import type { CSSProperties, ElementType } from 'react';
import type { ComponentConfig, Fields, Slot } from '@puckeditor/core';
import { anchorId, isSafeColor, safeHref, safeSrc } from '@/lib/design/theme';
import { Icon } from '../icons';
import { colorField, sidesVars, spacingField, type Sides } from './appearance';
import { DesignForm } from './design-form';

// ---------- value guards ----------

/** CSS lengths a design may use: 320px, 50%, 2rem, 60vh, auto, fit-content… (a bare number means px). */
export function safeLength(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const v = String(value).trim().toLowerCase();
  if (!v) return undefined;
  if (/^\d{1,4}(\.\d{1,2})?$/.test(v)) return `${v}px`;
  if (/^(auto|none|fit-content|max-content|min-content)$/.test(v)) return v;
  if (/^\d{1,4}(\.\d{1,2})?(px|%|rem|em|vh|vw|dvh|svh)$/.test(v)) return v;
  return undefined;
}
const clamp = (value: unknown, min: number, max: number, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
/** "3" → three equal columns; "1fr 2fr" / "200px 1fr" / "repeat(3, 1fr)" kept as written (letters, digits, (),%. only). */
function gridTemplate(value: unknown, fallback: number): string {
  const v = String(value ?? '').trim();
  if (/^\d{1,2}$/.test(v)) return `repeat(${clamp(v, 1, 12, fallback)}, minmax(0, 1fr))`;
  if (v && v.length <= 80 && /^[\d\s.a-z%(),-]+$/i.test(v)) return v;
  return `repeat(${fallback}, minmax(0, 1fr))`;
}

/** Theme colors (follow the theme) or your own hex. */
const FILL_OPTIONS = [
  { label: 'None', value: 'none' }, { label: 'Page background', value: 'bg' }, { label: 'Card', value: 'surface' },
  { label: 'Soft', value: 'soft' }, { label: 'Accent', value: 'accent' }, { label: 'Accent tint', value: 'tint' },
  { label: 'Inverse (text color)', value: 'inverse' }, { label: 'Custom color…', value: 'custom' },
];
const FILLS: Record<string, string> = {
  bg: 'var(--d-bg)', surface: 'var(--d-surface)', soft: 'var(--d-surface-2)', accent: 'var(--d-accent)',
  tint: 'color-mix(in srgb, var(--d-accent) 12%, var(--d-bg))', inverse: 'var(--d-text)',
};
const TEXT_OPTIONS = [
  { label: 'Inherit', value: 'inherit' }, { label: 'Text', value: 'text' }, { label: 'Muted', value: 'muted' }, { label: 'Accent', value: 'accent' },
  { label: 'On accent', value: 'onAccent' }, { label: 'Page background (for dark boxes)', value: 'bg' }, { label: 'Custom color…', value: 'custom' },
];
const TEXTS: Record<string, string> = { text: 'var(--d-text)', muted: 'var(--d-muted)', accent: 'var(--d-accent)', onAccent: 'var(--d-accent-text)', bg: 'var(--d-bg)' };
const BORDER_TONES: Record<string, string> = { line: 'var(--d-line)', text: 'var(--d-text)', accent: 'var(--d-accent)' };
const SHADOWS: Record<string, string> = {
  sm: '0 2px 8px -2px rgba(0,0,0,.18)', md: '0 10px 30px -12px rgba(0,0,0,.28)', lg: '0 24px 60px -18px rgba(0,0,0,.45)',
};
const TAGS = ['div', 'section', 'header', 'footer', 'nav', 'article', 'aside', 'main'] as const;

const opt = <T extends string>(...pairs: [T, string][]) => pairs.map(([value, label]) => ({ value, label }));
const radio = <T extends string | boolean>(label: string, options: { value: T; label: string }[]) => ({ type: 'radio' as const, label, options });
const select = <T extends string>(label: string, options: { value: T; label: string }[]) => ({ type: 'select' as const, label, options });
const text = (label: string, placeholder?: string) => ({ type: 'text' as const, label, placeholder });
const number = (label: string, min: number, max: number) => ({ type: 'number' as const, label, min, max });

// ======================================================================
// Box
// ======================================================================

export type BoxProps = {
  content: Slot;
  layout: {
    display: 'block' | 'flex' | 'grid';
    direction: 'row' | 'row-reverse' | 'column' | 'column-reverse';
    wrap: 'nowrap' | 'wrap';
    justify: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
    align: 'stretch' | 'flex-start' | 'center' | 'flex-end' | 'baseline';
    gap: number;
    rowGap: number;
    columns: string;
    columnsTablet: string;
    columnsMobile: string;
    stackOnMobile: boolean;
  };
  size: { width: string; minWidth: string; maxWidth: string; height: string; minHeight: string; maxHeight: string; contained: boolean; center: boolean };
  spacing: { padding: Sides; paddingMobile: Sides; margin: Sides };
  look: {
    fill: string; fillColor: string; gradientTo: string; gradientAngle: number;
    image: string; imageFit: 'cover' | 'contain'; overlay: 'none' | 'light' | 'dark';
    textTone: string; textColor: string; textAlign: 'inherit' | 'left' | 'center' | 'right';
    borderWidth: number; borderStyle: 'solid' | 'dashed' | 'dotted'; borderTone: 'line' | 'text' | 'accent' | 'custom'; borderColor: string;
    radius: number; shadow: 'none' | 'sm' | 'md' | 'lg'; opacity: number;
  };
  item: { grow: boolean; shrink: boolean; basis: string; alignSelf: 'auto' | 'stretch' | 'flex-start' | 'center' | 'flex-end'; order: number };
  advanced: { tag: (typeof TAGS)[number]; anchor: string; visibility: 'all' | 'desktop' | 'mobile'; overflow: 'visible' | 'hidden' | 'auto'; sticky: boolean };
};

const BOX_DEFAULTS: Omit<BoxProps, 'content'> = {
  layout: { display: 'block', direction: 'row', wrap: 'wrap', justify: 'flex-start', align: 'stretch', gap: 16, rowGap: 16, columns: '2', columnsTablet: '2', columnsMobile: '1', stackOnMobile: true },
  size: { width: '', minWidth: '', maxWidth: '', height: '', minHeight: '', maxHeight: '', contained: false, center: false },
  spacing: { padding: { top: '16', right: '16', bottom: '16', left: '16' }, paddingMobile: {}, margin: {} },
  look: {
    fill: 'none', fillColor: '', gradientTo: '', gradientAngle: 135, image: '', imageFit: 'cover', overlay: 'none',
    textTone: 'inherit', textColor: '', textAlign: 'inherit', borderWidth: 0, borderStyle: 'solid', borderTone: 'line', borderColor: '',
    radius: 0, shadow: 'none', opacity: 100,
  },
  item: { grow: false, shrink: true, basis: '', alignSelf: 'auto', order: 0 },
  advanced: { tag: 'div', anchor: '', visibility: 'all', overflow: 'visible', sticky: false },
};

const layoutFields = {
  display: radio('Layout', opt(['block', 'Block (stacked)'], ['flex', 'Flex (row / column)'], ['grid', 'Grid'])),
  direction: select('Direction', opt(['row', 'Row → (side by side)'], ['row-reverse', 'Row reversed ←'], ['column', 'Column ↓ (stacked)'], ['column-reverse', 'Column reversed ↑'])),
  wrap: radio('Wrap onto the next line (wrap)', opt(['wrap', 'Wrap'], ['nowrap', 'One line'])),
  justify: select('Spread along the row (justify)', opt(['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End'], ['space-between', 'Space between'], ['space-around', 'Space around'], ['space-evenly', 'Space evenly'])),
  align: select('Line up across (align items)', opt(['stretch', 'Stretch'], ['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End'], ['baseline', 'Baseline'])),
  gap: number('Space between items (gap, px)', 0, 200),
  rowGap: number('Space between rows (px)', 0, 200),
  columns: text('Columns on desktop', '3, or 1fr 2fr, or 240px 1fr'),
  columnsTablet: text('Columns on tablet', '2'),
  columnsMobile: text('Columns on phone', '1'),
  stackOnMobile: radio('On phones', [{ value: true, label: 'Stack (column)' }, { value: false, label: 'Keep direction' }]),
};

const boxFields: Fields<Omit<BoxProps, 'content'> & { content: Slot }> = {
  content: { type: 'slot', label: 'Content' },
  layout: { type: 'object', label: 'Layout', objectFields: layoutFields },
  size: {
    type: 'object', label: 'Size',
    objectFields: {
      width: text('Width', 'auto, 100%, 320px, 50%'),
      minWidth: text('Min width', 'e.g. 200px'),
      maxWidth: text('Max width', 'e.g. 1120px'),
      height: text('Height', 'auto, 400px, 60vh'),
      minHeight: text('Min height', 'e.g. 300px'),
      maxHeight: text('Max height', 'e.g. 600px'),
      contained: radio('Limit to page width', [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]),
      center: radio('Center horizontally', [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]),
    },
  },
  spacing: {
    type: 'object', label: 'Spacing',
    objectFields: {
      padding: spacingField('Padding (inside)'),
      paddingMobile: spacingField('Padding on phones', 'Only on phones. Empty sides use the padding above.'),
      margin: spacingField('Margin (outside)'),
    },
  },
  look: {
    type: 'object', label: 'Background, border & text',
    objectFields: {
      fill: select('Background', FILL_OPTIONS),
      fillColor: colorField('Custom background color'),
      gradientTo: colorField('Gradient to (optional)'),
      gradientAngle: number('Gradient angle (°)', 0, 360),
      image: text('Background image URL', 'https://… or /images/…'),
      imageFit: radio('Image fit', opt(['cover', 'Cover'], ['contain', 'Contain'])),
      overlay: radio('Image overlay', opt(['none', 'None'], ['light', 'Light'], ['dark', 'Dark'])),
      textTone: select('Text color', TEXT_OPTIONS),
      textColor: colorField('Custom text color'),
      textAlign: radio('Text align', opt(['inherit', 'Inherit'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right'])),
      borderWidth: number('Border width (px)', 0, 20),
      borderStyle: radio('Border style', opt(['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'])),
      borderTone: select('Border color', opt(['line', 'Subtle (theme)'], ['text', 'Text'], ['accent', 'Accent'], ['custom', 'Custom…'])),
      borderColor: colorField('Custom border color'),
      radius: number('Corner radius (px)', 0, 200),
      shadow: radio('Shadow', opt(['none', 'None'], ['sm', 'S'], ['md', 'M'], ['lg', 'L'])),
      opacity: number('Opacity (%)', 0, 100),
    },
  },
  item: {
    type: 'object', label: 'When inside a flex row',
    objectFields: {
      grow: radio('Grow to fill space', [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]),
      shrink: radio('Can shrink', [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]),
      basis: text('Base width (flex-basis)', 'e.g. 50%, 300px'),
      alignSelf: select('Align self', opt(['auto', 'Auto'], ['stretch', 'Stretch'], ['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End'])),
      order: number('Order', -10, 10),
    },
  },
  advanced: {
    type: 'object', label: 'Advanced',
    objectFields: {
      tag: select('HTML tag', TAGS.map((t) => ({ value: t, label: `<${t}>` }))),
      anchor: text('Anchor id (link to it with #id)'),
      visibility: radio('Show on', opt(['all', 'All'], ['desktop', 'Desktop'], ['mobile', 'Phone'])),
      overflow: radio('Overflow', opt(['visible', 'Visible'], ['hidden', 'Hidden'], ['auto', 'Scroll'])),
      sticky: radio('Stick to top when scrolling', [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]),
    },
  },
};

type Sub<K extends keyof typeof BOX_DEFAULTS> = Partial<(typeof BOX_DEFAULTS)[K]>;
const merge = <K extends keyof typeof BOX_DEFAULTS>(key: K, value: Sub<K> | undefined) => ({ ...BOX_DEFAULTS[key], ...(value ?? {}) }) as (typeof BOX_DEFAULTS)[K];

/** Inline styles + classes for a Box, from its settings (every value checked). */
export function boxStyle(props: Partial<Omit<BoxProps, 'content'>>, editing: boolean) {
  const layout = merge('layout', props.layout);
  const size = merge('size', props.size);
  const spacing = merge('spacing', props.spacing);
  const look = merge('look', props.look);
  const item = merge('item', props.item);
  const advanced = merge('advanced', props.advanced);
  const style: Record<string, string | number> = {};
  const classes = ['d-box'];

  // layout
  if (layout.display === 'flex') {
    style.display = 'flex';
    style.flexDirection = layout.direction;
    style.flexWrap = layout.wrap;
    style.justifyContent = layout.justify;
    style.alignItems = layout.align;
    style.gap = `${clamp(layout.gap, 0, 200, 16)}px`;
    if (layout.stackOnMobile && layout.direction.startsWith('row')) classes.push('d-box-stack');
  } else if (layout.display === 'grid') {
    classes.push('d-box-grid');
    style['--g-lg'] = gridTemplate(layout.columns, 2);
    style['--g-md'] = gridTemplate(layout.columnsTablet || layout.columns, 2);
    style['--g-sm'] = gridTemplate(layout.columnsMobile, 1);
    style.columnGap = `${clamp(layout.gap, 0, 200, 16)}px`;
    style.rowGap = `${clamp(layout.rowGap, 0, 200, 16)}px`;
    style.alignItems = layout.align === 'baseline' ? 'baseline' : layout.align === 'flex-start' ? 'start' : layout.align === 'flex-end' ? 'end' : layout.align;
  } else {
    style.display = 'flow-root';
  }

  // size
  for (const key of ['width', 'minWidth', 'maxWidth', 'height', 'minHeight', 'maxHeight'] as const) {
    const value = safeLength(size[key]);
    if (value) style[key] = value;
  }
  if (size.contained) { style.maxWidth = 'var(--d-width)'; style.marginLeft = 'auto'; style.marginRight = 'auto'; style.width = style.width ?? '100%'; }
  if (size.center) { style.marginLeft = 'auto'; style.marginRight = 'auto'; }

  // spacing: padding via variables (phones can differ); margin directly
  const pad = sidesVars(spacing.padding, spacing.paddingMobile, {}, {});
  if (Object.keys(pad.set).length) { Object.assign(style, pad.style); classes.push('d-padded'); }
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const value = safeLength(spacing.margin?.[side]);
    if (value) style[`margin${side[0].toUpperCase()}${side.slice(1)}`] = value;
  }

  // background
  const base = look.fill === 'custom' ? (isSafeColor(look.fillColor) ? look.fillColor : undefined) : FILLS[look.fill];
  const layers: string[] = [];
  const image = safeSrc(look.image);
  if (image) {
    const shade = look.overlay === 'dark' ? 'rgba(0,0,0,.55)' : look.overlay === 'light' ? 'rgba(255,255,255,.6)' : '';
    if (shade) layers.push(`linear-gradient(${shade}, ${shade})`);
    layers.push(`url("${image}")`);
    style.backgroundSize = look.imageFit;
    style.backgroundPosition = 'center';
    style.backgroundRepeat = 'no-repeat';
  }
  if (base && isSafeColor(look.gradientTo)) layers.push(`linear-gradient(${clamp(look.gradientAngle, 0, 360, 135)}deg, ${base}, ${look.gradientTo})`);
  if (layers.length) style.backgroundImage = layers.join(', ');
  if (base) style.backgroundColor = base;

  // text
  const color = look.textTone === 'custom' ? (isSafeColor(look.textColor) ? look.textColor : undefined) : TEXTS[look.textTone];
  if (color) { style.color = color; style['--d-text'] = color; style['--d-muted'] = `color-mix(in oklab, ${color} 70%, transparent)`; }
  if (look.textAlign !== 'inherit') style.textAlign = look.textAlign;

  // border, corners, shadow, opacity
  const borderWidth = clamp(look.borderWidth, 0, 20);
  if (borderWidth > 0) {
    const tone = look.borderTone === 'custom' ? (isSafeColor(look.borderColor) ? look.borderColor : 'var(--d-line)') : BORDER_TONES[look.borderTone] ?? 'var(--d-line)';
    style.border = `${borderWidth}px ${look.borderStyle} ${tone}`;
  }
  const radius = clamp(look.radius, 0, 200);
  if (radius) style.borderRadius = `${radius}px`;
  if (SHADOWS[look.shadow]) style.boxShadow = SHADOWS[look.shadow];
  const opacity = clamp(look.opacity, 0, 100, 100);
  if (opacity < 100) style.opacity = opacity / 100;

  // as a flex item
  if (item.grow) style.flexGrow = 1;
  if (!item.shrink) style.flexShrink = 0;
  const basis = safeLength(item.basis);
  if (basis) style.flexBasis = basis;
  if (item.alignSelf !== 'auto') style.alignSelf = item.alignSelf;
  if (item.order) style.order = clamp(item.order, -10, 10);

  // advanced
  if (advanced.overflow !== 'visible') style.overflow = advanced.overflow;
  if (advanced.sticky) { style.position = 'sticky'; style.top = '0'; style.zIndex = 20; }
  if (advanced.visibility === 'desktop') classes.push(editing ? 'opacity-50' : 'max-md:hidden');
  if (advanced.visibility === 'mobile') classes.push(editing ? 'opacity-50' : 'md:hidden');
  if (editing) classes.push('d-box-editing');

  const tag: ElementType = (TAGS as readonly string[]).includes(advanced.tag) ? advanced.tag : 'div';
  return { style: style as CSSProperties, className: classes.join(' '), tag, id: anchorId(advanced.anchor), layout };
}

const show = (field: object, visible: boolean) => ({ ...field, visible });

export const Box: ComponentConfig<BoxProps> = {
  label: 'Box (div)',
  inline: true,
  fields: boxFields,
  defaultProps: { content: [], ...BOX_DEFAULTS },
  // Only show the options that apply: flex options for Flex, grid options for Grid.
  resolveFields: (data, { fields }) => {
    const display = data.props?.layout?.display ?? 'block';
    const flex = display === 'flex';
    const grid = display === 'grid';
    const layout = fields.layout as { type: 'object'; objectFields: typeof layoutFields };
    return {
      ...fields,
      layout: {
        ...layout,
        objectFields: {
          display: layoutFields.display,
          direction: show(layoutFields.direction, flex),
          wrap: show(layoutFields.wrap, flex),
          justify: show(layoutFields.justify, flex),
          align: show(layoutFields.align, flex || grid),
          gap: show(layoutFields.gap, flex || grid),
          rowGap: show(layoutFields.rowGap, grid),
          columns: show(layoutFields.columns, grid),
          columnsTablet: show(layoutFields.columnsTablet, grid),
          columnsMobile: show(layoutFields.columnsMobile, grid),
          stackOnMobile: show(layoutFields.stackOnMobile, flex),
        },
      },
    } as typeof fields;
  },
  render: ({ content: Content, puck, ...props }) => {
    const { style, className, tag, id, layout } = boxStyle(props, puck.isEditing);
    const axis = layout.display === 'flex' ? (layout.direction.startsWith('row') ? 'x' : 'y') : layout.display === 'grid' ? 'dynamic' : 'y';
    // Anchor: a marker that takes no space (a slot can't carry an id itself), so #id links scroll here.
    return (
      <>
        {id && <span id={id} aria-hidden="true" className="pointer-events-none absolute scroll-mt-20" />}
        <Content as={tag} ref={puck.dragRef} className={className} style={style} minEmptyHeight={64} collisionAxis={axis} />
      </>
    );
  },
};

// ======================================================================
// Elements
// ======================================================================

type Align = 'left' | 'center' | 'right';
const alignField = radio<Align>('Align', opt(['left', 'Left'], ['center', 'Center'], ['right', 'Right']));
const justify = (align: Align) => ({ left: 'justify-start', center: 'justify-center', right: 'justify-end' })[align] ?? 'justify-start';
const ICON_NAMES = ['arrow', 'external', 'mail', 'gmail', 'linkedin', 'github', 'instagram', 'download', 'code', 'game', 'briefcase', 'skill', 'user', 'home', 'sparkle', 'copy', 'menu', 'close'];

export type LinkProps = { label: string; href: string; newTab: boolean; style: 'accent' | 'underline' | 'plain' | 'muted'; size: 'sm' | 'md' | 'lg'; icon: 'none' | 'arrow' | 'external'; align: Align };
export const LinkBlock: ComponentConfig<LinkProps> = {
  label: 'Link',
  fields: {
    label: text('Text'), href: text('Link to', 'https://…, /projects, #contact, mailto:…'),
    newTab: radio('Open in new tab', [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]),
    style: select('Style', opt(['accent', 'Accent'], ['underline', 'Underlined'], ['plain', 'Plain'], ['muted', 'Muted'])),
    size: radio('Size', opt(['sm', 'S'], ['md', 'M'], ['lg', 'L'])),
    icon: radio('Icon', opt(['none', 'None'], ['arrow', 'Arrow'], ['external', 'External'])),
    align: alignField,
  },
  defaultProps: { label: 'Read more', href: '#', newTab: false, style: 'accent', size: 'md', icon: 'arrow', align: 'left' },
  render: ({ label, href, newTab, style, size, icon, align }) => {
    const target = safeHref(href) ?? '#';
    const cls = { accent: 'd-link', underline: 'underline underline-offset-4', plain: 'no-underline', muted: 'd-muted hover:underline' }[style] ?? 'd-link';
    return (
      <div className={`d-prim flex ${justify(align)}`}>
        <a href={target} {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={`inline-flex items-center gap-1.5 font-bold ${cls} ${{ sm: 'text-sm', md: 'text-base', lg: 'text-lg' }[size]}`}>
          {label}{icon !== 'none' && <Icon name={icon} size={size === 'lg' ? 18 : 15} />}
        </a>
      </div>
    );
  },
};

export type IconProps = { name: string; size: number; tone: 'accent' | 'accent2' | 'text' | 'muted' | 'custom'; color: string; background: 'none' | 'circle' | 'square'; align: Align };
export const IconBlock: ComponentConfig<IconProps> = {
  label: 'Icon',
  fields: {
    name: select('Icon', ICON_NAMES.map((n) => ({ value: n, label: n[0].toUpperCase() + n.slice(1) }))),
    size: number('Size (px)', 12, 160),
    tone: select('Color', opt(['accent', 'Accent'], ['accent2', 'Second accent'], ['text', 'Text'], ['muted', 'Muted'], ['custom', 'Custom…'])),
    color: colorField('Custom color'),
    background: radio('Background', opt(['none', 'None'], ['circle', 'Circle'], ['square', 'Square'])),
    align: alignField,
  },
  defaultProps: { name: 'sparkle', size: 28, tone: 'accent', color: '', background: 'none', align: 'left' },
  render: ({ name, size, tone, color, background, align }) => {
    const px = clamp(size, 12, 160, 28);
    const fg = tone === 'custom' ? (isSafeColor(color) ? color : 'var(--d-accent)') : { accent: 'var(--d-accent)', accent2: 'var(--d-accent-2)', text: 'var(--d-text)', muted: 'var(--d-muted)' }[tone];
    const box: CSSProperties = background === 'none' ? { color: fg } : {
      color: fg, width: px * 2, height: px * 2, display: 'grid', placeItems: 'center',
      background: 'color-mix(in srgb, currentColor 14%, transparent)', borderRadius: background === 'circle' ? 9999 : 'var(--d-radius)',
    };
    return <div className={`d-prim flex ${justify(align)}`}><span style={box} aria-hidden="true"><Icon name={ICON_NAMES.includes(name) ? name : 'sparkle'} size={px} /></span></div>;
  },
};

/** YouTube / Vimeo / Loom pages → their embed player; .mp4/.webm links → a video tag. */
export function videoSource(url: string): { kind: 'embed' | 'file'; src: string } | null {
  const href = safeHref(url);
  if (!href || !/^https:\/\//i.test(href)) return null;
  let u: URL;
  try { u = new URL(href); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}` };
  if (host.endsWith('youtube.com')) {
    const id = u.searchParams.get('v') ?? u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]+)/)?.[1];
    return id ? { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.match(/(\d{5,})/)?.[1];
    return id ? { kind: 'embed', src: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (host.endsWith('loom.com')) {
    const id = u.pathname.match(/\/(?:share|embed)\/([\w-]+)/)?.[1];
    return id ? { kind: 'embed', src: `https://www.loom.com/embed/${id}` } : null;
  }
  if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { kind: 'file', src: u.toString() };
  return null;
}

export type VideoProps = { url: string; title: string; aspect: 'video' | 'wide' | 'square' | 'portrait'; rounded: boolean; autoplay: boolean; controls: boolean };
export const VideoBlock: ComponentConfig<VideoProps> = {
  label: 'Video',
  fields: {
    url: text('Video link', 'YouTube, Vimeo, Loom, or an https …mp4 file'),
    title: text('Title (for screen readers)'),
    aspect: radio('Shape', opt(['video', '16:9'], ['wide', '21:9'], ['square', '1:1'], ['portrait', '9:16'])),
    rounded: radio('Rounded corners', [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]),
    autoplay: radio('Autoplay muted & loop (files only)', [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]),
    controls: radio('Controls (files only)', [{ value: true, label: 'Show' }, { value: false, label: 'Hide' }]),
  },
  defaultProps: { url: '', title: 'Video', aspect: 'video', rounded: true, autoplay: false, controls: true },
  render: ({ url, title, aspect, rounded, autoplay, controls, puck }) => {
    const source = videoSource(url);
    const ratio = { video: '16 / 9', wide: '21 / 9', square: '1 / 1', portrait: '9 / 16' }[aspect] ?? '16 / 9';
    const frame: CSSProperties = { aspectRatio: ratio, width: '100%', borderRadius: rounded ? 'var(--d-radius)' : 0, overflow: 'hidden', background: 'var(--d-surface-2)' };
    if (!source) return puck.isEditing ? <div className="d-prim"><div className="d-placeholder" style={frame}>Paste a YouTube, Vimeo or Loom link (or an https .mp4 file) in the settings.</div></div> : <></>;
    return (
      <div className="d-prim">
        {source.kind === 'embed'
          ? <iframe src={source.src} title={title || 'Video'} style={{ ...frame, border: 0 }} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          : <video src={source.src} title={title} style={{ ...frame, objectFit: 'cover' }} controls={controls} {...(autoplay ? { autoPlay: true, muted: true, loop: true, playsInline: true } : {})} />}
      </div>
    );
  },
};

export type QuoteProps = { quote: string; author: string; role: string; style: 'card' | 'line' | 'large'; align: Align };
export const QuoteBlock: ComponentConfig<QuoteProps> = {
  label: 'Quote / testimonial',
  fields: {
    quote: { type: 'textarea', label: 'Quote' }, author: text('Who said it'), role: text('Their role / company'),
    style: radio('Style', opt(['card', 'Card'], ['line', 'Side line'], ['large', 'Large'])), align: alignField,
  },
  defaultProps: { quote: 'Vinay shipped the hardest parts of our platform and made the team faster.', author: 'A colleague', role: 'Engineering manager', style: 'card', align: 'left' },
  render: ({ quote, author, role, style, align }) => (
    <figure className={`d-prim ${{ left: 'text-left', center: 'text-center', right: 'text-right' }[align]}`}>
      <div className={style === 'card' ? 'd-card p-6' : style === 'line' ? 'border-l-4 pl-5' : ''} style={style === 'line' ? { borderColor: 'var(--d-accent)' } : undefined}>
        <blockquote className={style === 'large' ? 'text-2xl font-bold leading-snug md:text-3xl' : 'text-lg leading-relaxed'}>“{quote}”</blockquote>
        {(author || role) && <figcaption className="d-muted mt-3 text-sm"><b style={{ color: 'var(--d-text)' }}>{author}</b>{role ? ` · ${role}` : ''}</figcaption>}
      </div>
    </figure>
  ),
};

export type FaqProps = { items: { question: string; answer: string }[]; openFirst: boolean; style: 'cards' | 'lines' };
export const FaqBlock: ComponentConfig<FaqProps> = {
  label: 'FAQ / accordion',
  fields: {
    items: {
      type: 'array', label: 'Questions',
      arrayFields: { question: text('Question'), answer: { type: 'textarea', label: 'Answer' } },
      defaultItemProps: { question: 'New question', answer: 'Answer' },
      getItemSummary: (item) => item.question || 'Question',
    },
    openFirst: radio('First one open', [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]),
    style: radio('Style', opt(['cards', 'Cards'], ['lines', 'Lines'])),
  },
  defaultProps: {
    items: [{ question: 'Are you open to new roles?', answer: 'Yes: senior frontend and full-stack roles, hybrid or remote.' }, { question: 'What is your notice period?', answer: '30 days.' }],
    openFirst: true, style: 'cards',
  },
  render: ({ items, openFirst, style }) => (
    <div className={`d-prim grid ${style === 'cards' ? 'gap-2' : ''}`}>
      {(items ?? []).map((item, index) => (
        <details key={index} open={openFirst && index === 0} className={`group ${style === 'cards' ? 'd-card px-5 py-4' : 'border-b py-4'}`} style={style === 'lines' ? { borderColor: 'var(--d-line)' } : undefined}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
            {item.question}<span aria-hidden="true" className="d-accent text-xl transition group-open:rotate-45">+</span>
          </summary>
          <p className="d-muted mt-3 whitespace-pre-line leading-relaxed">{item.answer}</p>
        </details>
      ))}
    </div>
  ),
};

// ---------- forms ----------

const fieldName = (label: string, fallback: string) => (label || fallback).trim().slice(0, 80);
const labelCls = 'mb-1.5 block text-sm font-bold';
const controlCls = 'd-input w-full';
const widthField = radio('Width', opt(['full', 'Full'], ['half', 'Half (side by side)']));
const widthCls = (width: string) => (width === 'half' ? 'md:col-span-1' : 'md:col-span-2');
const requiredField = radio('Required', [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]);

export type InputProps = { label: string; type: 'text' | 'email' | 'tel' | 'number' | 'url' | 'date'; placeholder: string; required: boolean; width: 'full' | 'half' };
export const InputBlock: ComponentConfig<InputProps> = {
  label: 'Input field',
  inline: true,
  fields: {
    label: text('Label'),
    type: select('Type', opt(['text', 'Text'], ['email', 'Email'], ['tel', 'Phone'], ['number', 'Number'], ['url', 'Website'], ['date', 'Date'])),
    placeholder: text('Placeholder'), required: requiredField, width: widthField,
  },
  defaultProps: { label: 'Your name', type: 'text', placeholder: '', required: true, width: 'half' },
  render: ({ label, type, placeholder, required, width, id, puck }) => (
    <label ref={puck.dragRef} className={`d-field block ${widthCls(width)}`}>
      <span className={labelCls}>{label}{required && <span className="d-accent"> *</span>}</span>
      <input className={controlCls} name={fieldName(label, id)} type={type} placeholder={placeholder} required={required} maxLength={500} />
    </label>
  ),
};

export type TextAreaProps = { label: string; placeholder: string; rows: number; required: boolean };
export const TextAreaBlock: ComponentConfig<TextAreaProps> = {
  label: 'Text area',
  inline: true,
  fields: { label: text('Label'), placeholder: text('Placeholder'), rows: number('Rows', 2, 20), required: requiredField },
  defaultProps: { label: 'Message', placeholder: 'How can I help?', rows: 5, required: true },
  render: ({ label, placeholder, rows, required, id, puck }) => (
    <label ref={puck.dragRef} className="d-field block md:col-span-2">
      <span className={labelCls}>{label}{required && <span className="d-accent"> *</span>}</span>
      <textarea className={controlCls} name={fieldName(label, id)} rows={clamp(rows, 2, 20, 5)} placeholder={placeholder} required={required} maxLength={5000} />
    </label>
  ),
};

type OptionList = { label: string }[];
const optionsField = {
  type: 'array' as const, label: 'Options',
  arrayFields: { label: text('Option') },
  defaultItemProps: { label: 'Option' },
  getItemSummary: (item: { label: string }) => item.label || 'Option',
};

export type SelectProps = { label: string; options: OptionList; multiple: boolean; placeholder: string; required: boolean; width: 'full' | 'half' };
export const SelectBlock: ComponentConfig<SelectProps> = {
  label: 'Dropdown / multi-select',
  inline: true,
  fields: {
    label: text('Label'), options: optionsField,
    multiple: radio('Pick', [{ value: false, label: 'One (dropdown)' }, { value: true, label: 'Several (multi-select)' }]),
    placeholder: text('Placeholder (dropdown)'), required: requiredField, width: widthField,
  },
  defaultProps: { label: 'Topic', options: [{ label: 'A job opportunity' }, { label: 'Freelance project' }, { label: 'Just saying hi' }], multiple: false, placeholder: 'Choose…', required: false, width: 'half' },
  render: ({ label, options, multiple, placeholder, required, width, id, puck }) => (
    <label ref={puck.dragRef} className={`d-field block ${widthCls(width)}`}>
      <span className={labelCls}>{label}{required && <span className="d-accent"> *</span>}{multiple && <span className="d-muted text-xs font-normal"> (Ctrl/⌘ to pick several)</span>}</span>
      <select className={controlCls} name={fieldName(label, id)} multiple={multiple} required={required} size={multiple ? Math.min(6, Math.max(3, (options ?? []).length)) : undefined} defaultValue={multiple ? [] : ''}>
        {!multiple && <option value="" disabled>{placeholder || 'Choose…'}</option>}
        {(options ?? []).map((o, i) => <option key={i} value={o.label}>{o.label}</option>)}
      </select>
    </label>
  ),
};

export type ChoicesProps = { label: string; options: OptionList; multiple: boolean; layout: 'stack' | 'inline'; required: boolean };
export const ChoicesBlock: ComponentConfig<ChoicesProps> = {
  label: 'Checkboxes / radio buttons',
  inline: true,
  fields: {
    label: text('Question'), options: optionsField,
    multiple: radio('Pick', [{ value: true, label: 'Several (checkboxes)' }, { value: false, label: 'One (radio buttons)' }]),
    layout: radio('Layout', opt(['stack', 'Stacked'], ['inline', 'In a row'])), required: requiredField,
  },
  defaultProps: { label: 'Work mode', options: [{ label: 'Remote' }, { label: 'Hybrid' }, { label: 'On-site' }], multiple: true, layout: 'inline', required: false },
  render: ({ label, options, multiple, layout, required, id, puck }) => (
    <fieldset ref={puck.dragRef} className="d-field md:col-span-2">
      <legend className={labelCls}>{label}{required && !multiple && <span className="d-accent"> *</span>}</legend>
      <div className={`flex gap-x-5 gap-y-2 ${layout === 'inline' ? 'flex-row flex-wrap' : 'flex-col'}`}>
        {(options ?? []).map((o, i) => (
          <label key={i} className="inline-flex items-center gap-2">
            <input type={multiple ? 'checkbox' : 'radio'} name={fieldName(label, id)} value={o.label} required={required && !multiple} className="size-4" style={{ accentColor: 'var(--d-accent)' }} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  ),
};

export const FORM_FIELD_BLOCKS = ['InputField', 'TextAreaField', 'SelectField', 'ChoicesField'];

export type FormProps = { fields: Slot; formName: string; submitLabel: string; successMessage: string; buttonAlign: Align; fullWidthButton: boolean };
export const FormBlock: ComponentConfig<FormProps> = {
  label: 'Form',
  fields: {
    fields: { type: 'slot', label: 'Fields', allow: [...FORM_FIELD_BLOCKS, 'Heading', 'Text', 'Divider', 'Spacer', 'Box'] },
    formName: text('Form name (shown with each message in Insights)'),
    submitLabel: text('Button text'),
    successMessage: text('Message after sending'),
    buttonAlign: alignField,
    fullWidthButton: radio('Full-width button', [{ value: true, label: 'Yes' }, { value: false, label: 'No' }]),
  },
  defaultProps: {
    fields: [
      { type: 'InputField', props: { label: 'Your name', type: 'text', placeholder: '', required: true, width: 'half' } },
      { type: 'InputField', props: { label: 'Email', type: 'email', placeholder: 'you@company.com', required: true, width: 'half' } },
      { type: 'TextAreaField', props: { label: 'Message', placeholder: 'How can I help?', rows: 5, required: true } },
    ] as never,
    formName: 'Contact form', submitLabel: 'Send message', successMessage: 'Thanks! Your message was sent.', buttonAlign: 'left', fullWidthButton: false,
  },
  render: ({ fields: Fields, formName, submitLabel, successMessage, buttonAlign, fullWidthButton, puck }) => (
    <div className="d-prim">
      <DesignForm formName={formName} submitLabel={submitLabel} successMessage={successMessage} align={buttonAlign} fullWidth={fullWidthButton} editing={puck.isEditing}>
        <Fields className="grid grid-cols-1 gap-4 md:grid-cols-2" minEmptyHeight={80} />
      </DesignForm>
    </div>
  ),
};
