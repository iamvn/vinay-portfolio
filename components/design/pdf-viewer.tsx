'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

/**
 * Interactive PDF viewer for the public site (PDF blocks and project PDFs).
 *
 *   - Loads with byte ranges: only the pages being looked at are downloaded (see app/api/files).
 *   - Page by page, two-page spread (like a printed portfolio), or scrolling.
 *   - Zoom, thumbnails, fullscreen, keyboard (← → + −) and swipe, optional download.
 *   - "cover" display: the first page as a card; clicking opens the viewer full screen.
 * Colors follow the page's design theme (--d-* variables), with fallbacks elsewhere.
 */

export type PdfMode = 'single' | 'spread' | 'scroll';
export type PdfViewerProps = {
  url: string;
  title?: string;
  mode?: PdfMode;
  /** Height of the viewer in px; 0 = from the page shape. */
  height?: number;
  thumbnails?: boolean;
  download?: boolean;
  startPage?: number;
  display?: 'embed' | 'cover';
  /** Text on the cover card's button. */
  coverLabel?: string;
};

type PdfJs = typeof import('pdfjs-dist');
let pdfjs: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  return (pdfjs ??= import('pdfjs-dist').then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    return lib;
  }));
}

/** Opens a PDF once per address (several viewers of the same file share it). */
const documents = new Map<string, Promise<PDFDocumentProxy>>();
function openDocument(url: string) {
  let task = documents.get(url);
  if (!task) {
    task = loadPdfJs().then((lib) => lib.getDocument({ url, rangeChunkSize: 256 * 1024, disableAutoFetch: true, disableStream: true }).promise);
    task.catch(() => documents.delete(url));
    documents.set(url, task);
  }
  return task;
}

const ZOOMS = [1, 1.25, 1.5, 2, 3];
const vars = {
  surface: 'var(--d-surface, #ffffff)',
  soft: 'var(--d-surface-2, #f1f5f9)',
  text: 'var(--d-text, #0f172a)',
  muted: 'var(--d-muted, #64748b)',
  line: 'var(--d-line, #e2e8f0)',
  accent: 'var(--d-accent, #4f46e5)',
};

/** One page drawn on a canvas, sharp on high-density screens. Draws only once `active`. */
function PageCanvas({ doc, page, width, active = true, label }: { doc: PDFDocumentProxy; page: number; width: number; active?: boolean; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!active || width < 10) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    (async () => {
      const proxy = await doc.getPage(page);
      if (cancelled || !canvas.current) return;
      const base = proxy.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const viewport = proxy.getViewport({ scale: (width / base.width) * dpr });
      const el = canvas.current;
      el.width = Math.floor(viewport.width);
      el.height = Math.floor(viewport.height);
      task = proxy.render({ canvas: el, viewport });
      await task.promise.then(() => { if (!cancelled) setDrawn(true); }).catch(() => { /* cancelled by a newer draw */ });
    })().catch(() => {});
    return () => { cancelled = true; task?.cancel(); };
  }, [doc, page, width, active]);
  const height = ratio ? Math.round(width * ratio) : Math.round(width * 1.294);
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ width, height, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.12), 0 8px 24px -12px rgba(0,0,0,.25)' }}>
      <canvas ref={canvas} role="img" aria-label={label} style={{ width, height, display: 'block', opacity: drawn ? 1 : 0, transition: 'opacity .2s' }} />
      {!drawn && <div className="absolute inset-0 animate-pulse" style={{ background: vars.soft }} aria-hidden="true" />}
    </div>
  );
}

/** Calls back with the element's content width (and on every resize). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}
const ICONS = {
  prev: 'M15 18l-6-6 6-6', next: 'M9 18l6-6-6-6', zoomIn: 'M11 8v6M8 11h6M21 21l-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  zoomOut: 'M8 11h6M21 21l-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0', full: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
  exitFull: 'M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3',
  thumbs: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  single: 'M6 3h12v18H6z', spread: 'M2 4h9v16H2zM13 4h9v16h-9z', scroll: 'M6 2h12v8H6zM6 14h12v8H6z', close: 'M18 6L6 18M6 6l12 12',
};

function ToolButton({ label, icon, onClick, disabled, pressed }: { label: string; icon: keyof typeof ICONS; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} aria-pressed={pressed}
      className="grid size-9 shrink-0 place-items-center rounded-md transition hover:bg-black/5 disabled:opacity-35 disabled:hover:bg-transparent"
      style={pressed ? { background: `color-mix(in srgb, ${vars.accent} 14%, transparent)`, color: vars.accent } : undefined}>
      <Icon d={ICONS[icon]} />
    </button>
  );
}

/** The viewer itself (embedded, or inside the full-screen dialog). */
function Viewer({ url, title, mode: initialMode = 'single', height = 0, thumbnails: showThumbs = true, download = false, startPage = 1, inDialog = false, onClose }: PdfViewerProps & { inDialog?: boolean; onClose?: () => void }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [pages, setPages] = useState(0);
  const [ratio, setRatio] = useState(1.294);
  const [page, setPage] = useState(Math.max(1, startPage));
  const [mode, setMode] = useState<PdfMode>(initialMode);
  const [zoom, setZoom] = useState(1);
  const [thumbs, setThumbs] = useState(false);
  const [full, setFull] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [stage, stageWidth] = useWidth<HTMLDivElement>();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    openDocument(url).then(async (pdf) => {
      if (!alive) return;
      const first = await pdf.getPage(1);
      const v = first.getViewport({ scale: 1 });
      if (!alive) return;
      setRatio(v.height / v.width);
      setPages(pdf.numPages);
      setPage((p) => Math.min(p, pdf.numPages));
      setDoc(pdf);
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [url]);

  // In the dialog, keyboard control starts right away (← → to turn pages, Esc to close).
  useEffect(() => { if (inDialog) root.current?.focus(); }, [inDialog]);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // A spread needs room for two pages; on narrow screens it falls back to one page.
  const narrow = stageWidth > 0 && stageWidth < 560;
  const effective: PdfMode = mode === 'spread' && narrow ? 'single' : mode;
  const spreadOf = useCallback((p: number) => (p <= 1 ? [1] : p % 2 === 0 ? [p, p + 1].filter((x) => x <= pages) : [p - 1, p]), [pages]);
  const shown = effective === 'spread' ? spreadOf(page) : [page];
  const step = (dir: 1 | -1) => {
    if (effective === 'spread') {
      const current = spreadOf(page);
      const next = dir === 1 ? current[current.length - 1] + 1 : current[0] - 1;
      if (next >= 1 && next <= pages) setPage(dir === 1 ? next : spreadOf(next)[0]);
    } else setPage((p) => Math.min(pages, Math.max(1, p + dir)));
  };
  const atStart = shown[0] <= 1;
  const atEnd = shown[shown.length - 1] >= pages;

  // sizes
  const fixedHeight = full || inDialog ? (typeof window !== 'undefined' ? window.innerHeight - 140 : 600) : height;
  const gap = 16;
  const cols = effective === 'spread' ? 2 : 1;
  const available = Math.max(0, stageWidth - 32);
  let pageWidth = (available - (cols - 1) * 2) / cols;
  if (fixedHeight && effective !== 'scroll') pageWidth = Math.min(pageWidth, (fixedHeight - 32) / ratio);
  if (effective !== 'scroll' && !fixedHeight) pageWidth = Math.min(pageWidth, effective === 'spread' ? 640 : 900);
  pageWidth = Math.floor(pageWidth * zoom);

  // keyboard + swipe
  const onKey = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); step(1); }
    else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); step(-1); }
    else if (event.key === 'Home') setPage(1);
    else if (event.key === 'End') setPage(pages);
    else if (event.key === '+' || event.key === '=') setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)]);
    else if (event.key === '-') setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)]);
    else if (event.key === 'Escape' && inDialog) onClose?.();
  };
  const swipe = useRef<number | null>(null);

  // scroll mode: the page in view is the current page
  useEffect(() => {
    if (effective !== 'scroll' || !scroller.current) return;
    const box = scroller.current;
    const onScroll = () => {
      const items = [...box.querySelectorAll<HTMLElement>('[data-page]')];
      const mid = box.getBoundingClientRect().top + box.clientHeight / 3;
      const hit = items.find((el) => el.getBoundingClientRect().bottom > mid);
      if (hit) setPage(Number(hit.dataset.page));
    };
    box.addEventListener('scroll', onScroll, { passive: true });
    return () => box.removeEventListener('scroll', onScroll);
  }, [effective, doc]);
  const goTo = (p: number) => {
    const target = Math.min(pages, Math.max(1, p));
    if (effective === 'scroll') scroller.current?.querySelector(`[data-page="${target}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    setPage(effective === 'spread' ? spreadOf(target)[0] : target);
  };

  const toggleFull = () => {
    if (inDialog) return onClose?.();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else root.current?.requestFullscreen?.().catch(() => {});
  };

  const label = title || 'PDF document';
  const scrollHeight = fixedHeight || Math.round(Math.min(900, (available || 600) * ratio + 32));

  return (
    <div ref={root} tabIndex={0} onKeyDown={onKey} role="region" aria-label={label} aria-roledescription="PDF viewer"
      className="d-pdf group relative flex flex-col overflow-hidden rounded-[var(--d-radius,12px)] outline-none focus-visible:ring-2"
      style={{ background: vars.soft, color: vars.text, border: inDialog ? undefined : `1px solid ${vars.line}`, height: full || inDialog ? '100%' : undefined } as CSSProperties}>
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5 text-sm" style={{ background: vars.surface, borderColor: vars.line }}>
        <span className="min-w-0 flex-1 truncate px-1 font-semibold" title={label}>{label}</span>
        {/* phones: title + close on the first line, page controls centered below */}
        <span className="order-1 sm:order-3">
          {(doc || inDialog) && <ToolButton label={inDialog ? 'Close' : full ? 'Exit full screen' : 'Full screen'} icon={inDialog ? 'close' : full ? 'exitFull' : 'full'} onClick={toggleFull} />}
        </span>
        {doc && (
          <span className="order-2 flex w-full flex-wrap items-center justify-center gap-1 sm:w-auto sm:flex-nowrap">
            <ToolButton label="Previous page" icon="prev" onClick={() => (effective === 'scroll' ? goTo(page - 1) : step(-1))} disabled={atStart} />
            <span className="flex items-center gap-1 whitespace-nowrap text-xs tabular-nums" aria-live="polite">
              <input aria-label="Page number" inputMode="numeric" value={page} onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= pages) goTo(n); }}
                className="h-7 w-10 rounded border bg-transparent text-center" style={{ borderColor: vars.line }} />
              <span style={{ color: vars.muted }}>/ {pages}</span>
            </span>
            <ToolButton label="Next page" icon="next" onClick={() => (effective === 'scroll' ? goTo(page + 1) : step(1))} disabled={atEnd} />
            <span className="mx-1 h-5 w-px" style={{ background: vars.line }} aria-hidden="true" />
            <ToolButton label="Zoom out" icon="zoomOut" onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])} disabled={zoom === ZOOMS[0]} />
            <span className="hidden w-10 text-center text-xs tabular-nums sm:inline" style={{ color: vars.muted }}>{Math.round(zoom * 100)}%</span>
            <ToolButton label="Zoom in" icon="zoomIn" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])} disabled={zoom === ZOOMS[ZOOMS.length - 1]} />
            <span className="mx-1 hidden h-5 w-px sm:block" style={{ background: vars.line }} aria-hidden="true" />
            <span className="hidden sm:contents">
              <ToolButton label="One page at a time" icon="single" onClick={() => setMode('single')} pressed={mode === 'single'} />
              <ToolButton label="Two pages side by side" icon="spread" onClick={() => setMode('spread')} pressed={mode === 'spread'} disabled={narrow} />
              <ToolButton label="Scroll through all pages" icon="scroll" onClick={() => setMode('scroll')} pressed={mode === 'scroll'} />
            </span>
            {showThumbs && <ToolButton label="Page thumbnails" icon="thumbs" onClick={() => setThumbs((t) => !t)} pressed={thumbs} />}
            {download && <a href={`${url}${url.includes('?') ? '&' : '?'}download=1`} aria-label="Download PDF" title="Download PDF" className="grid size-9 place-items-center rounded-md hover:bg-black/5"><Icon d={ICONS.download} /></a>}
          </span>
        )}
      </div>

      {/* pages */}
      <div ref={stage} className="relative min-h-0 flex-1">
        {failed && (
          <div className="grid place-items-center p-10 text-center text-sm" style={{ minHeight: 240, color: vars.muted }}>
            <p>This PDF couldn’t be loaded. <a href={url} className="underline" target="_blank" rel="noreferrer">Open it directly</a>.</p>
          </div>
        )}
        {!failed && !doc && (
          <div className="grid place-items-center" style={{ height: fixedHeight || Math.round(Math.min(700, (stageWidth || 600) * 0.75)) }} aria-busy="true">
            <div className="flex flex-col items-center gap-3 text-xs" style={{ color: vars.muted }}>
              <span className="size-7 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              Loading PDF…
            </div>
          </div>
        )}
        {doc && effective !== 'scroll' && (
          <div className="overflow-auto" style={{ height: fixedHeight || undefined }}
            onPointerDown={(e) => { swipe.current = zoom === 1 && e.pointerType !== 'mouse' ? e.clientX : null; }}
            onPointerUp={(e) => { if (swipe.current !== null) { const dx = e.clientX - swipe.current; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); } swipe.current = null; }}>
            <div className="flex min-h-full items-center justify-center p-4" style={{ gap: 2, width: zoom > 1 ? 'max-content' : undefined, minWidth: '100%' }}>
              {shown.map((p) => <PageCanvas key={`${p}-${pageWidth}`} doc={doc} page={p} width={pageWidth} label={`Page ${p} of ${pages}`} />)}
            </div>
          </div>
        )}
        {doc && effective === 'scroll' && (
          <div ref={scroller} className="overflow-auto" style={{ height: scrollHeight }}>
            <div className="flex flex-col items-center p-4" style={{ gap }}>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <div key={p} data-page={p}><LazyPage doc={doc} page={p} width={pageWidth} ratio={ratio} label={`Page ${p} of ${pages}`} root={scroller} /></div>
              ))}
            </div>
          </div>
        )}
        {/* side arrows on hover (desktop) */}
        {doc && effective !== 'scroll' && zoom === 1 && (
          <>
            {!atStart && <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => step(-1)} className="absolute left-2 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full opacity-0 shadow transition group-hover:opacity-100 md:grid" style={{ background: vars.surface }}><Icon d={ICONS.prev} /></button>}
            {!atEnd && <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => step(1)} className="absolute right-2 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full opacity-0 shadow transition group-hover:opacity-100 md:grid" style={{ background: vars.surface }}><Icon d={ICONS.next} /></button>}
          </>
        )}
      </div>

      {/* thumbnails */}
      {doc && thumbs && (
        <div className="flex gap-2 overflow-x-auto border-t p-2" style={{ background: vars.surface, borderColor: vars.line }} role="listbox" aria-label="Pages">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => {
            const current = shown.includes(p);
            return (
              <button key={p} type="button" role="option" aria-selected={current} aria-label={`Go to page ${p}`} onClick={() => goTo(p)}
                className="flex shrink-0 flex-col items-center gap-1 rounded p-1 text-[10px]" style={{ outline: current ? `2px solid ${vars.accent}` : undefined, color: vars.muted }}>
                <LazyPage doc={doc} page={p} width={56} ratio={ratio} label="" />
                {p}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A page that draws itself once it scrolls near view. */
function LazyPage({ doc, page, width, ratio, label, root }: { doc: PDFDocumentProxy; page: number; width: number; ratio: number; label: string; root?: React.RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setSeen(true); observer.disconnect(); } }, { root: root?.current ?? null, rootMargin: '600px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [seen, root]);
  return (
    <div ref={ref} style={{ minHeight: seen ? undefined : Math.round(width * ratio) }}>
      {seen ? <PageCanvas doc={doc} page={page} width={width} label={label} /> : <div style={{ width, height: Math.round(width * ratio), background: vars.surface }} />}
    </div>
  );
}

/** The first page as a card, with a button that opens the full viewer in a dialog. */
function Cover(props: PdfViewerProps) {
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [box, width] = useWidth<HTMLDivElement>();
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let alive = true;
    openDocument(props.url).then((pdf) => { if (alive) setDoc(pdf); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [props.url]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    const button = opener.current;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', onKey); button?.focus(); };
  }, [open]);
  const label = props.title || 'PDF document';
  return (
    <>
      <div ref={box} className="d-pdf-cover overflow-hidden rounded-[var(--d-radius,12px)] border" style={{ background: vars.soft, borderColor: vars.line, color: vars.text }}>
        <button ref={opener} type="button" onClick={() => setOpen(true)} className="group block w-full text-left" aria-label={`${props.coverLabel || 'View'}: ${label}${doc ? ` (${doc.numPages} pages)` : ''}`}>
          <div className="flex justify-center p-5 transition group-hover:scale-[1.01]">
            {doc ? <PageCanvas doc={doc} page={1} width={Math.max(120, Math.min(width - 40, 520))} label={`Cover of ${label}`} />
              : <div className="grid w-full place-items-center text-xs" style={{ height: 280, color: vars.muted }}>{failed ? 'This PDF couldn’t be loaded.' : 'Loading…'}</div>}
          </div>
          <div className="flex items-center gap-3 border-t px-4 py-3" style={{ background: vars.surface, borderColor: vars.line }}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{label}</span>
              {doc && <span className="text-xs" style={{ color: vars.muted }}>{doc.numPages} pages · PDF</span>}
            </span>
            <span className="d-btn d-btn-primary shrink-0 text-xs">{props.coverLabel || 'View'}</span>
          </div>
        </button>
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[200] p-2 sm:p-6" style={{ background: 'rgba(8,10,14,.82)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="mx-auto h-full max-w-6xl">
            <Viewer {...props} display="embed" inDialog onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

export function PdfViewer(props: PdfViewerProps) {
  const key = useMemo(() => `${props.url}|${props.mode}`, [props.url, props.mode]);
  if (!props.url) return null;
  return props.display === 'cover' ? <Cover key={key} {...props} /> : <Viewer key={key} {...props} />;
}
