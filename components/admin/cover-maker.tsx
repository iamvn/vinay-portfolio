'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui';

/**
 * "Generate cover" for projects: draws a 1200×675 cover from the project's own title, type, description and
 * tags in one of four styles, all in the browser (no AI, no upload until you pick one). The result is a small
 * WebP (JPEG where the browser can't make WebP) that goes through the normal image upload.
 */
export type CoverInput = { title: string; description: string; tags: string[]; type: string };
type Style = 'studio' | 'blueprint' | 'paper' | 'bold';
const STYLES: { id: Style; label: string }[] = [
  { id: 'studio', label: 'Studio' }, { id: 'blueprint', label: 'Blueprint' }, { id: 'paper', label: 'Paper' }, { id: 'bold', label: 'Bold' },
];
const W = 1200, H = 675;
const ACCENTS = ['#7cc4ff', '#5eead4', '#a3e635', '#fbbf24', '#f472b6', '#c084fc', '#fb923c', '#38bdf8'];
const TYPE_LABEL: Record<string, string> = { 'case-study': 'Case study', article: 'Article', pdf: 'Portfolio', link: 'Project' };
const SANS = '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
const SERIF = 'Georgia, "Times New Roman", serif';

/** A stable number from text, so the same project always gets the same colors and shapes. */
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let s = seed || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10_000) / 10_000; };
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  const used = lines.join(' ').split(/\s+/).length;
  if (used < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}
/** The largest title size (between max and min) that fits in `maxLines` lines. */
function fitTitle(ctx: CanvasRenderingContext2D, title: string, font: (px: number) => string, maxWidth: number, maxLines: number, max: number, min: number) {
  for (let px = max; px >= min; px -= 4) {
    ctx.font = font(px);
    const lines = wrap(ctx, title, maxWidth, maxLines);
    if (!lines.some((l) => l.endsWith('…')) || px === min) return { px, lines };
  }
  return { px: min, lines: wrap(ctx, title, maxWidth, maxLines) };
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const firstSentence = (text: string) => (text.split(/(?<=[.!?])\s/)[0] ?? '').trim();

export function drawCover(canvas: HTMLCanvasElement, input: CoverInput, style: Style) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const title = input.title.trim() || 'Untitled project';
  const seed = hash(title);
  const rand = rng(seed);
  const accent = ACCENTS[seed % ACCENTS.length];
  const accent2 = ACCENTS[(seed >>> 3) % ACCENTS.length] === accent ? ACCENTS[(seed + 3) % ACCENTS.length] : ACCENTS[(seed >>> 3) % ACCENTS.length];
  const eyebrow = (TYPE_LABEL[input.type] ?? 'Project').toUpperCase();
  const blurb = firstSentence(input.description);
  const tags = input.tags.map((t) => t.trim()).filter(Boolean).slice(0, 4);
  const pad = 72;
  const dark = style !== 'paper';
  const ink = style === 'paper' ? '#1f1a14' : style === 'bold' ? '#0b0b0f' : '#eaf2ff';
  const muted = style === 'paper' ? '#6b5e4f' : style === 'bold' ? 'rgba(11,11,15,.72)' : '#9fb3d1';

  // Background and decoration per style.
  if (style === 'studio') {
    ctx.fillStyle = '#07101f'; ctx.fillRect(0, 0, W, H);
    for (const [x, y, r, c] of [[W * 0.8, H * 0.25, 520, accent], [W * 0.05, H * 1.05, 460, accent2]] as const) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `${c}55`); g.addColorStop(1, `${c}00`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.strokeStyle = 'rgba(160,190,255,.07)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    // Three floating "windows" on the right.
    for (let i = 0; i < 3; i++) {
      const w = 220 + rand() * 80, h = 130 + rand() * 50, x = 760 + (i % 2) * 140 + rand() * 30, y = 70 + i * 170 + rand() * 20;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
      roundRect(ctx, x, y, w, h, 16); ctx.fillStyle = '#0e1b30'; ctx.fill(); ctx.restore();
      roundRect(ctx, x, y, w, h, 16); ctx.strokeStyle = 'rgba(150,185,255,.22)'; ctx.stroke();
      ctx.fillStyle = '#152740'; roundRect(ctx, x, y, w, 28, 16); ctx.fill(); ctx.fillRect(x, y + 14, w, 14);
      ['#ff5f57', '#febc2e', '#28c840'].forEach((c, k) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 18 + k * 16, y + 14, 4.5, 0, Math.PI * 2); ctx.fill(); });
      for (let r = 0; r < 3; r++) { ctx.fillStyle = r === 1 ? `${accent}cc` : 'rgba(160,190,255,.18)'; roundRect(ctx, x + 16, y + 46 + r * 24, (w - 32) * (0.45 + rand() * 0.5), 10, 5); ctx.fill(); }
    }
  } else if (style === 'blueprint') {
    ctx.fillStyle = '#0b2545'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    for (let x = 0; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 120) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    // A small architecture sketch: boxes joined by lines.
    const nodes = Array.from({ length: 5 }, (_, i) => ({ x: 780 + (i % 2) * 190 + rand() * 40, y: 90 + i * 105 }));
    ctx.strokeStyle = `${accent}`; ctx.setLineDash([8, 7]); ctx.lineWidth = 2;
    for (let i = 1; i < nodes.length; i++) { ctx.beginPath(); ctx.moveTo(nodes[i - 1].x + 80, nodes[i - 1].y + 28); ctx.lineTo(nodes[i].x + 80, nodes[i].y + 28); ctx.stroke(); }
    ctx.setLineDash([]);
    nodes.forEach((n, i) => {
      roundRect(ctx, n.x, n.y, 160, 56, 8); ctx.fillStyle = i === 2 ? `${accent}33` : 'rgba(255,255,255,.04)'; ctx.fill();
      ctx.strokeStyle = i === 2 ? accent : 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = `600 15px ${MONO}`; ctx.fillText((tags[i] ?? ['client', 'api', 'core', 'store', 'cdn'][i]).slice(0, 14), n.x + 14, n.y + 34);
    });
  } else if (style === 'paper') {
    ctx.fillStyle = '#f5efe3'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 2200; i++) { ctx.fillStyle = `rgba(90,70,40,${rand() * 0.05})`; ctx.fillRect(rand() * W, rand() * H, 1.5, 1.5); }
    ctx.fillStyle = accent; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(W - 210, 210, 150, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#1f1a14'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W - 250, 250, 150, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#1f1a14'; ctx.fillRect(pad, H - 120, W - pad * 2, 2);
  } else {
    ctx.fillStyle = accent; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(W - 120 - i * 40, H + 40, 260 + i * 70, Math.PI, Math.PI * 1.5); ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(0,0,0,.07)'; ctx.stroke(); }
    ctx.fillStyle = '#0b0b0f'; ctx.font = `900 520px ${SANS}`; ctx.globalAlpha = 0.07; ctx.fillText(title.charAt(0).toUpperCase(), W - 420, H - 40); ctx.globalAlpha = 1;
  }

  // Text block on the left: the title gets as big as it can while the title and description still end above
  // the tag row (or the paper rule).
  const textWidth = style === 'paper' ? 640 : style === 'bold' ? W - pad * 2 - 300 : 620;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = style === 'paper' ? '#8a5a1f' : style === 'bold' ? 'rgba(11,11,15,.75)' : accent;
  ctx.font = `700 22px ${MONO}`;
  ctx.fillText(eyebrow.split('').join(' '), pad, pad + 26);
  const titleFont = (px: number) => (style === 'paper' ? `700 ${px}px ${SERIF}` : `800 ${px}px ${SANS}`);
  const blurbFont = `400 ${style === 'paper' ? 28 : 26}px ${style === 'paper' ? SERIF : SANS}`;
  ctx.font = blurbFont;
  const blurbLines = blurb ? wrap(ctx, blurb, textWidth, 2) : [];
  // The lowest the text may reach: above the tag chips (their top is H - pad - 40) or the paper's rule.
  const bottom = (style === 'paper' ? H - 120 : tags.length ? H - pad - 40 : H - pad) - 18;
  let fit = fitTitle(ctx, title, titleFont, textWidth, 3, style === 'bold' ? 104 : 92, 40);
  /** Where the last line ends, drawn exactly as below: title baselines px·1.05 apart, then the description. */
  const heightFor = (px: number, n: number) => {
    const afterTitle = pad + 26 + 30 + px + n * px * 1.05;
    return blurbLines.length ? afterTitle + 14 - px * 0.05 + (blurbLines.length - 1) * 38 + 9 : afterTitle - px * 1.05 + px * 0.25;
  };
  while (heightFor(fit.px, fit.lines.length) > bottom && fit.px > 40) fit = fitTitle(ctx, title, titleFont, textWidth, 3, fit.px - 4, 40);
  const { px, lines } = fit;
  ctx.font = titleFont(px); ctx.fillStyle = ink;
  let y = pad + 26 + 30 + px;
  for (const line of lines) { ctx.fillText(line, pad, y); y += px * 1.05; }
  if (blurbLines.length) {
    ctx.font = blurbFont; ctx.fillStyle = muted;
    y += 14 - px * 0.05;
    for (const line of blurbLines) { ctx.fillText(line, pad, y); y += 38; }
  }
  // Tags as chips along the bottom.
  if (tags.length) {
    ctx.font = `600 21px ${MONO}`;
    let x = pad; const cy = H - pad;
    for (const tag of tags) {
      const w = ctx.measureText(tag).width + 32;
      if (x + w > (style === 'studio' || style === 'blueprint' ? 700 : W - pad)) break;
      roundRect(ctx, x, cy - 40, w, 44, 22);
      ctx.fillStyle = style === 'paper' ? 'rgba(31,26,20,.06)' : style === 'bold' ? 'rgba(0,0,0,.12)' : 'rgba(124,196,255,.10)'; ctx.fill();
      ctx.strokeStyle = style === 'paper' ? 'rgba(31,26,20,.35)' : style === 'bold' ? 'rgba(0,0,0,.35)' : `${accent}66`; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = style === 'paper' || style === 'bold' ? ink : '#d6e8ff'; ctx.fillText(tag, x + 16, cy - 11);
      x += w + 12;
    }
  }
  void dark;
}

/** Canvas → a small image file (WebP, or JPEG where the browser can't encode WebP). */
async function toFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (blob && blob.type === 'image/webp') return new File([blob], `${name}.webp`, { type: 'image/webp' });
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!jpeg) throw new Error('Your browser could not create the image.');
  return new File([jpeg], `${name}.jpg`, { type: 'image/jpeg' });
}

export function CoverMaker({ input, onUse, onClose }: { input: CoverInput; onUse: (file: File) => Promise<void> | void; onClose: () => void }) {
  const [style, setStyle] = useState<Style>('studio');
  const [busy, setBusy] = useState(false);
  const big = useRef<HTMLCanvasElement>(null);
  const thumbs = useRef<Partial<Record<Style, HTMLCanvasElement | null>>>({});
  const key = useMemo(() => JSON.stringify(input), [input]);

  useEffect(() => {
    for (const s of STYLES) { const c = thumbs.current[s.id]; if (c) drawCover(c, input, s.id); }
  }, [key, input]);
  useEffect(() => { if (big.current) drawCover(big.current, input, style); }, [key, input, style]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const use = async () => {
    if (!big.current) return;
    setBusy(true);
    try {
      const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'project';
      await onUse(await toFile(big.current, `${slug}-cover`));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Generate a cover"
        className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-white/15 bg-[#080d14] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">Generate a cover</h3>
            <p className="mt-1 text-xs text-slate-400">Made from the title, type, short description and tags. Change those and open this again for a new one.</p>
          </div>
          <Button onClick={onClose} label="Close">✕</Button>
        </div>
        <canvas ref={big} className="aspect-video w-full rounded-xl border border-white/10" aria-label={`${style} cover preview`} />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Style">
          {STYLES.map((s) => (
            <button key={s.id} type="button" aria-pressed={style === s.id} onClick={() => setStyle(s.id)}
              className={`overflow-hidden rounded-lg border-2 text-left ${style === s.id ? 'border-lime-300' : 'border-transparent hover:border-white/30'}`}>
              <canvas ref={(el) => { thumbs.current[s.id] = el; }} className="aspect-video w-full" aria-hidden="true" />
              <span className="block bg-black/40 px-2 py-1 text-[11px] font-bold text-slate-200">{s.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button tone="primary" onClick={use} disabled={busy}>{busy ? 'Saving…' : 'Use this cover'}</Button>
        </div>
      </div>
    </div>
  );
}
