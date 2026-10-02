import type { Config } from '@puckeditor/core';
import type { BoxProps } from './builder-blocks';

/**
 * "Quick add" in Admin → Design: ready-made layouts built from Boxes and basic blocks. Dropping one inserts
 * an ordinary, fully editable Box tree, so people change something that already looks good instead of
 * starting from an empty page. Added to the config after every block's defaults are complete.
 */

type Item = { type: string; props: Record<string, unknown> };
type Components = Record<string, { defaultProps?: Record<string, unknown>; label?: string; resolveData?: unknown } & Record<string, unknown>>;

const isPlain = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isPlain(v) && isPlain(base[k]) ? deepMerge(base[k] as Record<string, unknown>, v) : v;
  return out;
}

let counter = 0;
const newId = (type: string) => `${type}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Gives every block in an inserted tree its own id (two copies of a starter must never share ids). */
export function withFreshIds(items: unknown): unknown {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    if (!isPlain(item) || typeof item.type !== 'string') return item;
    const props = { ...(item.props as Record<string, unknown>) };
    props.id = newId(item.type);
    for (const [k, v] of Object.entries(props)) if (Array.isArray(v) && v.some((x) => isPlain(x) && typeof x.type === 'string')) props[k] = withFreshIds(v);
    return { ...item, props };
  });
}

export const STARTER_NAMES = ['QuickBanner', 'QuickTextImage', 'QuickFeatures', 'QuickStats', 'QuickContact', 'QuickFaq', 'QuickTestimonials'] as const;

export function addStarters(config: Config) {
  const components = config.components as unknown as Components;
  const box = components.Box;
  const make = (type: string, over: Record<string, unknown> = {}): Item => ({ type, props: deepMerge(structuredClone(components[type]?.defaultProps ?? {}), over) });
  const boxOf = (over: Partial<Record<keyof BoxProps, unknown>>, content: Item[]): Item => ({ type: 'Box', props: deepMerge(structuredClone(box.defaultProps ?? {}), { ...over, content }) });
  const heading = (text: string, over: Record<string, unknown> = {}) => make('Heading', { source: 'custom', text, ...over });
  const text = (value: string, over: Record<string, unknown> = {}) => make('Text', { source: 'custom', text: value, ...over });
  const pad = (top: string, side = top) => ({ top, right: side, bottom: top, left: side });
  const card = (content: Item[], over: Partial<Record<keyof BoxProps, unknown>> = {}) => boxOf({
    layout: { display: 'flex', direction: 'column', gap: 10, align: 'stretch', justify: 'flex-start', wrap: 'nowrap' },
    spacing: { padding: pad('24') },
    look: { fill: 'surface', borderWidth: 1, borderTone: 'line', radius: 16 },
    ...over,
  }, content);

  const starter = (name: string, label: string, over: Partial<Record<keyof BoxProps, unknown>>, content: Item[]) => {
    components[name] = {
      ...box,
      label,
      defaultProps: deepMerge(structuredClone(box.defaultProps ?? {}), { ...over, content }),
      // Fresh ids for everything inside, each time it's dropped onto the page.
      resolveData: (data: { props: Record<string, unknown> }, { trigger }: { trigger: string }) => (trigger === 'insert'
        ? { ...data, props: { ...data.props, content: withFreshIds(data.props.content) } }
        : data),
    };
  };
  const section = { size: { contained: true }, spacing: { padding: pad('48', '16') } };

  starter('QuickBanner', 'Banner with button', {
    ...section,
    layout: { display: 'flex', direction: 'column', align: 'center', justify: 'center', gap: 16, wrap: 'nowrap' },
    spacing: { padding: pad('64', '24'), margin: { top: '24', bottom: '24' } },
    look: { fill: 'tint', radius: 24, textAlign: 'center' },
  }, [
    make('Badge', { source: 'custom', text: 'Open to new roles', align: 'center' }),
    heading('Let’s build something great together', { level: 'h1', size: 'xl', align: 'center' }),
    text('One short line about what you do and who you help. Edit me!', { align: 'center' }),
    make('Button', { label: 'Get in touch', href: '#contact', align: 'center' }),
  ]);

  starter('QuickTextImage', 'Two columns: text + image', {
    ...section,
    layout: { display: 'flex', direction: 'row', align: 'center', justify: 'space-between', gap: 40, wrap: 'nowrap', stackOnMobile: true },
  }, [
    boxOf({ layout: { display: 'flex', direction: 'column', gap: 14, align: 'flex-start', wrap: 'nowrap' }, item: { grow: true, basis: '0' }, spacing: { padding: {} } }, [
      make('Badge', { source: 'custom', text: 'About me', dot: false }),
      heading('A headline about you'),
      text('Two or three sentences: what you do, what you’re great at, and what you’re looking for.'),
      make('Button', { label: 'See my work', href: '#projects' }),
    ]),
    make('Image', { source: 'profilePhoto', aspect: 'square', rounded: true, maxWidth: 'full', size: { width: '320px' }, item: { shrink: false } }),
  ]);

  starter('QuickFeatures', 'Three feature cards', {
    ...section,
    layout: { display: 'flex', direction: 'column', gap: 24, align: 'stretch', wrap: 'nowrap' },
  }, [
    heading('What I do', { align: 'center' }),
    boxOf({ layout: { display: 'grid', columns: '3', columnsTablet: '2', columnsMobile: '1', gap: 20, rowGap: 20, align: 'stretch' }, spacing: { padding: {} } }, [
      card([make('Icon', { name: 'code' }), heading('Frontend', { level: 'h3', size: 'sm' }), text('Fast, accessible interfaces with React and Next.js.')]),
      card([make('Icon', { name: 'sparkle' }), heading('AI features', { level: 'h3', size: 'sm' }), text('Assistants and automation that save real time.')]),
      card([make('Icon', { name: 'briefcase' }), heading('Leadership', { level: 'h3', size: 'sm' }), text('Mentoring, reviews and shipping on schedule.')]),
    ]),
  ]);

  const stat = (value: string, label: string) => card([heading(value, { size: 'xl', align: 'center' }), text(label, { align: 'center', size: 'sm' })], { look: { fill: 'soft', radius: 16 }, spacing: { padding: pad('20') } });
  starter('QuickStats', 'Numbers row (stats)', {
    ...section,
    layout: { display: 'grid', columns: '4', columnsTablet: '2', columnsMobile: '2', gap: 16, rowGap: 16, align: 'stretch' },
  }, [stat('6+', 'Years of experience'), stat('15+', 'Products shipped'), stat('40%', 'Faster pages'), stat('3K+', 'Users helped')]);

  starter('QuickContact', 'Contact form card', {
    size: { maxWidth: '720px', center: true },
    layout: { display: 'flex', direction: 'column', gap: 16, align: 'stretch', wrap: 'nowrap' },
    spacing: { padding: pad('32'), margin: { top: '32', bottom: '32' } },
    look: { fill: 'surface', borderWidth: 1, borderTone: 'line', radius: 20, shadow: 'md' },
    advanced: { anchor: 'contact', tag: 'section' },
  }, [
    heading('Let’s talk'),
    text('Tell me about the role or project. I usually reply within a day.'),
    make('Form'),
  ]);

  starter('QuickFaq', 'FAQ section', {
    ...section,
    layout: { display: 'flex', direction: 'column', gap: 16, align: 'stretch', wrap: 'nowrap' },
  }, [heading('Questions people ask'), make('Faq')]);

  starter('QuickTestimonials', 'Testimonials', {
    ...section,
    layout: { display: 'grid', columns: '2', columnsTablet: '2', columnsMobile: '1', gap: 20, rowGap: 20, align: 'stretch' },
  }, [
    make('Quote', { quote: 'Shipped the hardest parts of our platform and made the whole team faster.', author: 'Your manager', role: 'Engineering Manager' }),
    make('Quote', { quote: 'Clear, calm and reliable: the person you want on a deadline.', author: 'A colleague', role: 'Product Manager' }),
  ]);

  // Forms dropped on their own also get fresh ids for their starter fields.
  const form = components.Form;
  if (form) {
    form.resolveData = (data: { props: Record<string, unknown> }, { trigger }: { trigger: string }) => (trigger === 'insert'
      ? { ...data, props: { ...data.props, fields: withFreshIds(data.props.fields) } }
      : data);
  }
}
