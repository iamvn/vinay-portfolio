import type { Finding } from '@/lib/design/checks';

/**
 * Publish checklist, part 2: checks on the draft as a browser actually renders it (see lib/design/checks.ts
 * for part 1). Runs on the draft preview in audit mode, where every block is wrapped in
 * <div data-bid="…" style="display:contents">, so each problem can point at its block.
 */

type RGBA = [number, number, number, number];

/** Any CSS color (including oklab / color-mix results) → RGBA, by letting a canvas parse it. */
function colorParser(doc: Document) {
  const canvas = doc.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map<string, RGBA | null>();
  return (css: string): RGBA | null => {
    if (cache.has(css)) return cache.get(css)!;
    let out: RGBA | null = null;
    if (ctx && css && css !== 'transparent') {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      out = [r, g, b, a / 255];
    } else if (css === 'transparent') out = [0, 0, 0, 0];
    cache.set(css, out);
    return out;
  };
}

const over = (top: RGBA, bottom: RGBA): RGBA => {
  const a = top[3] + bottom[3] * (1 - top[3]);
  if (a === 0) return [0, 0, 0, 0];
  const mix = (i: number) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a;
  return [mix(0), mix(1), mix(2), a];
};
const luminance = ([r, g, b]: RGBA) => {
  const ch = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
export const contrastRatio = (a: RGBA, b: RGBA) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const blockOf = (el: Element | null) => el?.closest('[data-bid]')?.getAttribute('data-bid') ?? undefined;
/** The element's own text (not its children's), for messages. */
const ownText = (el: Element) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim() || el.textContent || '';
const shortText = (text: string) => { const t = text.replace(/\s+/g, ' ').trim(); return t.length > 40 ? `${t.slice(0, 40)}…` : t; };

function visible(el: Element, win: Window) {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 2 || rect.height <= 2) return false; // collapsed, or screen-reader-only (1×1, clipped)
  for (let node: Element | null = el; node; node = node.parentElement) {
    const style = win.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    if (node.getAttribute('aria-hidden') === 'true') return false;
  }
  return true;
}

/** Elements that hold text directly (one per element), in page order. */
function textElements(doc: Document): HTMLElement[] {
  const out = new Set<HTMLElement>();
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || !node.textContent?.trim()) continue;
    if (parent.closest('script, style, noscript, svg, [data-audit-skip]')) continue;
    out.add(parent);
  }
  return [...out];
}

/** The solid color behind an element, or null when there's an image/gradient we can't judge. */
function backgroundOf(el: Element, win: Window, parse: (css: string) => RGBA | null): RGBA | null {
  const layers: RGBA[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) {
    const style = win.getComputedStyle(node);
    if (style.backgroundImage && style.backgroundImage !== 'none') return null;
    const color = parse(style.backgroundColor);
    if (color && color[3] > 0) { layers.push(color); if (color[3] >= 0.999) break; }
  }
  let result: RGBA = [255, 255, 255, 1]; // the browser's canvas
  for (let i = layers.length - 1; i >= 0; i--) result = over(layers[i], result);
  return result;
}

export function auditDesktop(doc: Document): Finding[] {
  const win = doc.defaultView!;
  const parse = colorParser(doc);
  const out: Finding[] = [];
  const seen = new Set<string>();
  const once = (key: string, finding: Finding) => { if (!seen.has(key)) { seen.add(key); out.push(finding); } };

  // contrast (text over a picture or video can't be judged from colors, so it's skipped)
  const media = [...doc.querySelectorAll('img, video, canvas, picture, iframe')].map((m) => ({ el: m, rect: m.getBoundingClientRect() })).filter((m) => m.rect.width > 2 && m.rect.height > 2);
  const onMedia = (el: Element) => {
    const r = el.getBoundingClientRect();
    return media.some((m) => !el.contains(m.el) && r.left < m.rect.right && r.right > m.rect.left && r.top < m.rect.bottom && r.bottom > m.rect.top);
  };
  for (const el of textElements(doc)) {
    if (!visible(el, win) || onMedia(el)) continue;
    const style = win.getComputedStyle(el);
    const fg = parse(style.color);
    const bg = backgroundOf(el, win, parse);
    if (!fg || !bg) continue;
    const opacity = Number(style.opacity) || 1;
    const text = over([fg[0], fg[1], fg[2], fg[3] * opacity], bg);
    const ratio = contrastRatio(text, bg);
    const size = Number.parseFloat(style.fontSize);
    const bold = Number.parseInt(style.fontWeight, 10) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    if (ratio < (large ? 3 : 4.5)) {
      const id = blockOf(el);
      once(`contrast:${id}`, { check: 'contrast', blockId: id, detail: `“${shortText(ownText(el))}” is ${ratio.toFixed(1)}:1.` });
    }
  }

  // headings: one H1, no skipped levels
  const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter((h) => visible(h, win) && h.textContent?.trim());
  const h1s = headings.filter((h) => h.tagName === 'H1');
  if (!h1s.length) out.push({ check: 'headings', detail: 'The page has no main title (H1). Set your top heading’s HTML level to H1.' });
  if (h1s.length > 1) for (const h of h1s.slice(1)) once(`h1:${blockOf(h)}`, { check: 'headings', blockId: blockOf(h), detail: `“${shortText(h.textContent ?? '')}” is a second H1: use H2.` });
  let last = 0;
  for (const h of headings) {
    const level = Number(h.tagName[1]);
    if (last && level > last + 1) once(`skip:${blockOf(h)}`, { check: 'headings', blockId: blockOf(h), detail: `“${shortText(h.textContent ?? '')}” jumps from H${last} to H${level}: use H${last + 1}.` });
    last = level;
  }

  // images without a description (also catches images from your data, e.g. inside ready-made sections)
  for (const img of doc.querySelectorAll('img')) {
    if (img.getAttribute('alt') === null || (img.getAttribute('alt') === '' && img.getAttribute('role') !== 'presentation' && !img.closest('a, button'))) {
      if (img.getAttribute('alt') === '' && img.closest('[aria-hidden="true"]')) continue;
      const id = blockOf(img);
      once(`alt:${id}`, { check: 'image-alt', blockId: id });
    }
  }

  // #anchor links to nowhere
  for (const a of doc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    const target = a.getAttribute('href')!.slice(1);
    if (!target || target === 'top') continue;
    if (!doc.getElementById(decodeURIComponent(target))) {
      const id = blockOf(a);
      once(`anchor:${id}:${target}`, { check: 'anchor', blockId: id, detail: `“#${target}” isn’t on the page.` });
    }
  }
  return out;
}

export function auditPhone(doc: Document): Finding[] {
  const win = doc.defaultView!;
  const out: Finding[] = [];
  const seen = new Set<string>();
  const once = (key: string, finding: Finding) => { if (!seen.has(key)) { seen.add(key); out.push(finding); } };
  const width = doc.documentElement.clientWidth;

  // wider than the screen: content that sticks out past the right edge (the page clips it, so it's cut off;
  // without the clip it would scroll sideways). Scrolling strips and boxes that clip their own content are fine.
  const containedSideways = (el: Element) => {
    for (let node = el.parentElement; node && node !== doc.body; node = node.parentElement) {
      const ox = win.getComputedStyle(node).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
      if (ox === 'hidden' || ox === 'clip') {
        const r = node.getBoundingClientRect();
        if (r.right <= width + 1 && r.width < width - 1) return true; // a box clipping its own content, not the page
      }
    }
    return false;
  };
  for (const el of doc.body.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect();
    if (rect.right <= width + 1 || rect.width < 1 || rect.height < 1 || !visible(el, win) || containedSideways(el)) continue;
    // report the outermost element that sticks out (display:contents wrappers have no box: look past them)
    let parent = el.parentElement;
    while (parent && parent !== doc.body && win.getComputedStyle(parent).display === 'contents') parent = parent.parentElement;
    if (parent && parent !== doc.body && parent.getBoundingClientRect().right > width + 1) continue;
    const id = blockOf(el);
    once(`overflow:${id ?? 'page'}`, { check: 'phone-overflow', blockId: id, detail: `${Math.round(rect.right - width)}px wider than the screen.` });
  }

  // tiny text
  for (const el of textElements(doc)) {
    if (!visible(el, win)) continue;
    const size = Number.parseFloat(win.getComputedStyle(el).fontSize);
    if (size < 11) { const id = blockOf(el); once(`tiny:${id}`, { check: 'phone-text', blockId: id, detail: `“${shortText(ownText(el))}” is ${Math.round(size * 10) / 10}px.` }); }
  }

  // tap targets (WCAG 2.5.8: at least 24×24px), ignoring links inside running text
  for (const el of doc.querySelectorAll<HTMLElement>('a[href], button, input:not([type=hidden]), select, textarea, [role=button]')) {
    if (!visible(el, win)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width >= 24 && rect.height >= 24) continue;
    if (el.tagName === 'A' && win.getComputedStyle(el).display === 'inline' && el.parentElement && (el.parentElement.textContent?.trim().length ?? 0) > (el.textContent?.trim().length ?? 0) + 10) continue;
    if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) continue; // the label is the target
    const id = blockOf(el);
    once(`tap:${id}`, { check: 'tap-size', blockId: id, detail: `“${shortText(el.textContent || el.getAttribute('aria-label') || el.tagName.toLowerCase())}” is ${Math.round(rect.width)}×${Math.round(rect.height)}px.` });
  }
  return out;
}
