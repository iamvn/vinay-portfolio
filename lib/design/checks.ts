import { BUTTON_ACTIONS } from './bindings';
import { safeHref, safeSrc } from './theme';
import type { PortfolioData } from '@/lib/portfolio';

/**
 * The publish checklist (Admin → Design → Publish): problems found before a design goes live.
 *
 *   - checkDesign(): reads the design itself (missing image descriptions, buttons to nowhere, empty boxes,
 *     layouts that get squeezed on phones…). Pure, so it runs anywhere.
 *   - components/design/page-audit.ts: checks the draft as it renders in a browser (text contrast, heading
 *     order, sideways scrolling and tiny text on phones…).
 *
 * Both report Findings; the checklist groups them by check and links every block to the editor.
 */

export type Severity = 'error' | 'warning';
export type CheckId =
  | 'image-alt' | 'image-missing' | 'link-nowhere' | 'empty-box' | 'empty-text' | 'video' | 'form'
  | 'phone-squeeze' | 'phone-width'
  | 'contrast' | 'headings' | 'anchor' | 'phone-overflow' | 'phone-text' | 'tap-size';

export type Finding = { check: CheckId; blockId?: string; detail?: string };

type CheckInfo = { title: string; severity: Severity; why: string; fix: string; area: 'Accessibility' | 'Content' | 'Phones' };
export const CHECKS: Record<CheckId, CheckInfo> = {
  'link-nowhere': { area: 'Content', severity: 'error', title: 'Buttons or links that go nowhere',
    why: 'They do nothing when clicked. Buttons without a working link are hidden on the live site.',
    fix: 'Select the block and fill in “Link” (#section, /page, https://… or mailto:), or pick another “When clicked” action.' },
  'image-missing': { area: 'Content', severity: 'error', title: 'Images with no picture',
    why: 'An image block without a picture shows nothing to visitors.',
    fix: 'Add an image URL, choose “Profile photo”, or delete the block.' },
  'contrast': { area: 'Accessibility', severity: 'error', title: 'Text that’s hard to read',
    why: 'The text color is too close to its background (WCAG AA needs a contrast ratio of 4.5:1, or 3:1 for big text).',
    fix: 'In 🎨 Design → Background & colors, pick a darker or lighter text color, or change the background.' },
  'phone-overflow': { area: 'Phones', severity: 'error', title: 'Cut off on phones',
    why: 'Something is wider than a phone screen, so part of it is cut off (or the page scrolls sideways).',
    fix: 'Remove fixed widths (use 100% or Max width instead), or let rows stack on phones.' },
  'form': { area: 'Content', severity: 'error', title: 'Form problems',
    why: 'Visitors can’t fill in or send this form properly.',
    fix: 'Give every field a label, and keep at least one field in the form.' },
  'image-alt': { area: 'Accessibility', severity: 'warning', title: 'Images without a description',
    why: 'Screen readers and Google can’t tell what the picture shows.',
    fix: 'Select the image and fill in “Description (for screen readers & SEO)”, e.g. “Me speaking at a meetup”.' },
  'headings': { area: 'Accessibility', severity: 'warning', title: 'Heading order',
    why: 'Headings work like a table of contents: one main title (H1), then H2 sections, then H3 inside them, without skipping levels.',
    fix: 'Select the heading and change “HTML level (SEO)”. The look can stay the same: size is a separate setting.' },
  'anchor': { area: 'Content', severity: 'warning', title: 'Links to sections that don’t exist',
    why: 'A “#section” link only works if a block on the page has that anchor.',
    fix: 'Set the anchor on the target block (🎨 Design → Visibility & anchor), or change the link.' },
  'empty-text': { area: 'Content', severity: 'warning', title: 'Empty text blocks',
    why: 'They take up space but show nothing.',
    fix: 'Type some text, switch the content to your site text, or delete the block.' },
  'empty-box': { area: 'Content', severity: 'warning', title: 'Empty boxes',
    why: 'An empty box shows up as a blank gap.',
    fix: 'Drag blocks into it, give it a background on purpose, or delete it.' },
  'video': { area: 'Content', severity: 'warning', title: 'Video problems',
    why: 'The video won’t play, or screen readers can’t say what it is.',
    fix: 'Paste a YouTube, Vimeo or .mp4 link, and give the video a title.' },
  'phone-squeeze': { area: 'Phones', severity: 'warning', title: 'Rows that get squeezed on phones',
    why: 'Three or more things side by side on a phone end up too narrow to read.',
    fix: 'Select the box and set “On phones” to “Stack (column)”, or use 1–2 phone columns for grids.' },
  'phone-width': { area: 'Phones', severity: 'warning', title: 'Fixed widths wider than a phone',
    why: 'A width over 360px doesn’t fit on most phones.',
    fix: 'Use a percentage (like 100%) or set Max width instead of Width.' },
  'phone-text': { area: 'Phones', severity: 'warning', title: 'Tiny text on phones',
    why: 'Text under 11px is hard to read on a phone.',
    fix: 'Make the text bigger (Size or Exact size) for this block.' },
  'tap-size': { area: 'Phones', severity: 'warning', title: 'Buttons too small to tap',
    why: 'Links and buttons smaller than 24px are hard to hit with a finger.',
    fix: 'Use a bigger button size or add padding around the link.' },
};

// ---------- reading a design ----------

type Item = { type: string; props: Record<string, unknown> };
const isItem = (value: unknown): value is Item =>
  Boolean(value && typeof value === 'object' && typeof (value as Item).type === 'string' && (value as Item).props && typeof (value as Item).props === 'object');

/** Every block in the design (depth first, in page order), with its parent. */
export function walkDesign(data: unknown, visit: (item: Item, parent: Item | null) => void) {
  const walk = (list: unknown, parent: Item | null) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!isItem(item)) continue;
      visit(item, parent);
      for (const value of Object.values(item.props)) if (Array.isArray(value) && value.some(isItem)) walk(value, item);
    }
  };
  walk((data as { content?: unknown })?.content, null);
}

const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const get = (item: Item, path: string) => path.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), item.props);
const children = (item: Item, slot = 'content') => (Array.isArray(item.props[slot]) ? (item.props[slot] as unknown[]).filter(isItem) : []);
const CONTAINERS: Record<string, string> = { Box: 'content', Section: 'content', Card: 'content', Flex: 'items', Grid: 'items' };
const PHONE = 360;

/** px value of a length, or null when it isn't a plain pixel length. */
function px(value: unknown): number | null {
  const v = str(value);
  const m = /^(\d+(?:\.\d+)?)(px)?$/.exec(v);
  return m ? Number(m[1]) : null;
}

/** Checks on the design data. `portfolio` decides whether data-driven buttons (LinkedIn, email…) have a link. */
export function checkDesign(data: unknown, portfolio?: PortfolioData): Finding[] {
  const out: Finding[] = [];
  const add = (check: CheckId, item: Item, detail?: string) => out.push({ check, blockId: str(item.props.id) || undefined, detail });

  walkDesign(data, (item) => {
    const { type, props } = item;
    switch (type) {
      case 'Image': {
        const profile = props.source === 'profilePhoto';
        const src = profile ? portfolio?.profile.profileImage : props.src;
        if (!safeSrc(src)) add('image-missing', item, profile ? 'No profile photo uploaded yet (Admin → Profile).' : undefined);
        else if (!profile && !str(props.alt)) add('image-alt', item);
        break;
      }
      case 'Button': {
        const action = BUTTON_ACTIONS.find((a) => a.value === props.action) ?? BUTTON_ACTIONS[0];
        if (action.value === 'custom') {
          const href = safeHref(props.href);
          if (!href || href === '#') add('link-nowhere', item, str(props.href) ? `“${str(props.href)}” isn’t a link visitors can open.` : 'No link set.');
        } else if (portfolio && !action.href?.(portfolio)) {
          add('link-nowhere', item, `“${action.label}” needs that link in your profile first.`);
        }
        break;
      }
      case 'Link': {
        const href = safeHref(props.href);
        if (!href || href === '#') add('link-nowhere', item, str(props.href) ? `“${str(props.href)}” isn’t a link visitors can open.` : 'No link set.');
        break;
      }
      case 'Heading':
      case 'Text':
        if ((props.source === 'custom' || !props.source) && !str(props.text)) add('empty-text', item);
        break;
      case 'Video':
        if (!str(props.url)) add('video', item, 'No video link.');
        else if (!str(props.title)) add('video', item, 'No title for screen readers.');
        break;
      case 'Form': {
        const fields = children(item, 'fields');
        if (!fields.length) add('form', item, 'The form has no fields.');
        for (const field of fields) if (!str(field.props.label)) add('form', field, 'A field has no label.');
        break;
      }
    }

    // empty containers (a background, image or fixed height means the gap is probably on purpose)
    const slot = CONTAINERS[type] ?? (type.startsWith('Quick') ? 'content' : null);
    if (slot && !children(item, slot).length) {
      const decorated = type === 'Box' || type.startsWith('Quick')
        ? (str(get(item, 'look.fill')) && get(item, 'look.fill') !== 'none') || str(get(item, 'look.image')) || str(get(item, 'size.height')) || str(get(item, 'size.minHeight'))
        : type === 'Section' ? Boolean(props.background && props.background !== 'none') : false;
      if (!decorated) add('empty-box', item);
    }

    // phones: rows of 3+ that don't stack, phone grids with 3+ columns
    if (type === 'Box' || type.startsWith('Quick')) {
      const display = get(item, 'layout.display');
      const direction = str(get(item, 'layout.direction'));
      const count = children(item).length;
      if (display === 'flex' && direction.startsWith('row') && get(item, 'layout.stackOnMobile') === false && get(item, 'layout.wrap') !== 'wrap' && count >= 3)
        add('phone-squeeze', item, `${count} items side by side.`);
      const phoneCols = Number.parseInt(str(get(item, 'layout.columnsMobile')), 10);
      if (display === 'grid' && phoneCols >= 3) add('phone-squeeze', item, `${phoneCols} columns on phones.`);
    }
    if (type === 'Flex' && props.direction === 'row' && props.stackOnMobile === false && props.wrap !== true && children(item, 'items').length >= 3)
      add('phone-squeeze', item, `${children(item, 'items').length} items side by side.`);

    // phones: fixed pixel widths wider than a phone (Box size, or any block's Design → Size)
    for (const path of ['size.width', 'size.minWidth']) {
      const value = px(get(item, path));
      if (value !== null && value > PHONE) add('phone-width', item, `${path.endsWith('minWidth') ? 'Min width' : 'Width'} is ${value}px.`);
    }
  });
  return out;
}

// ---------- grouping for the checklist ----------

export type CheckGroup = CheckInfo & { check: CheckId; items: { blockId?: string; detail?: string }[] };

/** Findings grouped by check (errors first), one entry per block. */
export function groupFindings(findings: Finding[]): CheckGroup[] {
  const groups = new Map<CheckId, CheckGroup>();
  for (const finding of findings) {
    const info = CHECKS[finding.check];
    let group = groups.get(finding.check);
    if (!group) { group = { ...info, check: finding.check, items: [] }; groups.set(finding.check, group); }
    const existing = finding.blockId ? group.items.find((i) => i.blockId === finding.blockId) : undefined;
    if (existing) { if (finding.detail && !existing.detail?.includes(finding.detail)) existing.detail = existing.detail ? `${existing.detail} ${finding.detail}` : finding.detail; }
    else group.items.push({ blockId: finding.blockId, detail: finding.detail });
  }
  const order = Object.keys(CHECKS);
  return [...groups.values()].sort((a, b) => (a.severity === b.severity ? order.indexOf(a.check) - order.indexOf(b.check) : a.severity === 'error' ? -1 : 1));
}
