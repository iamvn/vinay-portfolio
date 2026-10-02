'use client';

import { FieldLabel } from '@puckeditor/core';
import { useState, type ReactNode } from 'react';

/**
 * Plain-language help for Admin → Design settings: an ⓘ next to a setting's name opens a one-line
 * explanation (and a tiny picture where it helps). Keyed by the setting's label.
 */

type Diagram = 'justify' | 'align' | 'direction' | 'box' | 'grow' | 'wrap' | 'gap' | 'columns' | 'radius';
type Hint = { text: string; diagram?: Diagram };

const HINTS: Record<string, Hint> = {
  // the switch at the top of each block
  Settings: { text: 'Content = what the block says and shows. Design = how it looks: space around it, size, colors, border and corners.' },
  // Box layout
  Layout: { text: 'Block: things inside sit on top of each other. Flex: put things side by side (a row) or in a column. Grid: an even grid of columns, like a table without lines.', diagram: 'direction' },
  Direction: { text: 'Row puts the things inside next to each other, left to right. Column stacks them top to bottom. “Reversed” flips the order.', diagram: 'direction' },
  'Wrap onto the next line (wrap)': { text: 'When the row runs out of space: Wrap moves the rest to a new line. One line squeezes everything into a single line.', diagram: 'wrap' },
  'Spread along the row (justify)': { text: 'Where the items sit along the row: at the start, centered, at the end, or spread out with equal space between them.', diagram: 'justify' },
  'Line up across (align items)': { text: 'How items line up the other way: stretched to the same height, at the top, centered, or at the bottom.', diagram: 'align' },
  'Space between items (gap, px)': { text: 'Empty space between the things inside, in pixels. 16 is a comfortable default.', diagram: 'gap' },
  'Space between rows (px)': { text: 'Empty space between grid rows, in pixels.', diagram: 'gap' },
  'Columns on desktop': { text: 'How many columns on a computer screen. Type a number like 3, or sizes like “1fr 2fr” (second column twice as wide) or “240px 1fr” (fixed + the rest).', diagram: 'columns' },
  'Columns on tablet': { text: 'How many columns on a tablet. Usually fewer than on desktop.', diagram: 'columns' },
  'Columns on phone': { text: 'How many columns on a phone. 1 is best for most content.', diagram: 'columns' },
  'On phones': { text: 'Phones are narrow: “Stack” turns a row into a column there so nothing gets squashed.' },
  // size
  Width: { text: 'How wide it is. Empty = automatic. Examples: 100% (full width), 50% (half), 320px (fixed).' },
  'Min width': { text: 'It never gets narrower than this, e.g. 200px.' },
  'Max width': { text: 'It never gets wider than this, e.g. 720px keeps text easy to read.' },
  Height: { text: 'How tall it is. Usually leave empty (grows with its content). 60vh = 60% of the screen height.' },
  'Min height': { text: 'At least this tall, even with little content, e.g. 300px for a banner.' },
  'Max height': { text: 'Never taller than this; extra content is cut off or scrolls (see Overflow).' },
  'Limit to page width': { text: 'Keeps it the same width as the rest of your page content, centered, instead of edge to edge.' },
  'Center horizontally': { text: 'Puts a narrower box in the middle of the space it’s in.' },
  'Position (when narrower)': { text: 'If you made it narrower than the space it’s in: where it sits (left, center or right).' },
  'Content width inside': { text: 'How wide the content inside this block may get.' },
  // spacing
  'Padding (inside)': { text: 'Space INSIDE the border, between the edge and the content. Use the middle box for all four sides at once.', diagram: 'box' },
  'Padding on phones': { text: 'Different inside space on phones (usually smaller). Empty sides use the padding above.', diagram: 'box' },
  'Margin (outside)': { text: 'Space OUTSIDE the border, pushing other blocks away.', diagram: 'box' },
  // colors
  Background: { text: 'The color behind this box. Theme colors change automatically when you change the page theme; “Custom” lets you pick any color.' },
  'Background color': { text: 'The color behind this block. Empty = see-through.' },
  'Custom background color': { text: 'Used when Background is set to “Custom color…”.' },
  'Gradient to (optional)': { text: 'A second color: the background fades from the first color into this one.' },
  'Gradient angle (°)': { text: 'Direction of the fade: 90 = left to right, 180 = top to bottom, 135 = diagonal.' },
  'Background image URL': { text: 'A picture behind the content. Paste an image link (https://…) or a file from your site (/images/…).' },
  'Image overlay': { text: 'A dark or light film over the picture so text on top stays readable.' },
  'Text color': { text: 'Color of the text inside. Choose a light color on dark backgrounds.' },
  'Accent color (buttons, highlights)': { text: 'The highlight color used by buttons, links and badges inside this block.' },
  'Card color': { text: 'Color of cards and panels inside this block.' },
  'Text align': { text: 'Left, centered or right-aligned text.' },
  // border
  'Border width (px)': { text: 'Thickness of the line around it. 0 = no border, 1–2 = subtle.' },
  'Border style': { text: 'Solid line, dashes, or dots.' },
  'Border color': { text: 'Color of the line around it.' },
  'Custom border color': { text: 'Used when Border color is “Custom…”.' },
  'Corner radius': { text: 'How round the corners are: 0 = square, 12px = softly rounded, 50% = a circle (on a square box).', diagram: 'radius' },
  'Corner radius (px)': { text: 'How round the corners are: 0 = square, 12 = softly rounded, 999 = pill-shaped.', diagram: 'radius' },
  Shadow: { text: 'A soft shadow underneath, so it looks lifted off the page.' },
  'Opacity (%)': { text: 'How see-through it is: 100 = solid, 50 = half see-through.' },
  // inside a row
  'Grow to fill space (flex)': { text: 'In a row: this item stretches to take all the leftover space. Great for “text on the left fills the space, image on the right stays fixed”.', diagram: 'grow' },
  'Grow to fill space': { text: 'In a row: this box stretches to take all the leftover space.', diagram: 'grow' },
  'Can shrink (flex)': { text: 'Whether it may get narrower when the row is full. Turn off to keep its width.' },
  'Can shrink': { text: 'Whether it may get narrower when the row is full. Turn off to keep its width.' },
  'Base width (flex-basis)': { text: 'Its starting width in a row before growing or shrinking, e.g. 50% for two equal halves.' },
  'Align self': { text: 'Overrides how this one item lines up in its row (top, center, bottom…).', diagram: 'align' },
  Order: { text: 'Change the order without moving it: lower numbers come first.' },
  'Span grid columns': { text: 'In a grid: how many columns this item covers, e.g. 2 for a wide card, or the full row.', diagram: 'columns' },
  // advanced
  'HTML tag': { text: 'For search engines and screen readers: section, header, footer… It doesn’t change how it looks.' },
  'Anchor id (link to it with #id)': { text: 'Give it a name like “contact”, then a button linking to “#contact” scrolls here.' },
  'Show on': { text: 'Show it everywhere, only on computers, or only on phones.' },
  Overflow: { text: 'What happens to content bigger than the box: visible, cut off (hidden), or scrollable.' },
  'Stick to top when scrolling': { text: 'It stays at the top of the screen as people scroll (good for menus).' },
};

// ---------- tiny pictures ----------

const dot = 'block rounded-[2px] bg-sky-500';
function Picture({ kind }: { kind: Diagram }) {
  const frame = 'rounded border border-slate-300 bg-white p-1';
  if (kind === 'justify') {
    return (
      <div className="grid grid-cols-2 gap-1.5 text-[9px] text-slate-500">
        {([['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End'], ['space-between', 'Space between']] as const).map(([value, name]) => (
          <div key={value}><div className={`${frame} flex gap-0.5`} style={{ justifyContent: value }}><span className={`${dot} h-2.5 w-3`} /><span className={`${dot} h-2.5 w-3`} /><span className={`${dot} h-2.5 w-3`} /></div>{name}</div>
        ))}
      </div>
    );
  }
  if (kind === 'align') {
    return (
      <div className="grid grid-cols-4 gap-1.5 text-[9px] text-slate-500">
        {([['stretch', 'Stretch'], ['flex-start', 'Top'], ['center', 'Center'], ['flex-end', 'Bottom']] as const).map(([value, name]) => (
          <div key={value}><div className={`${frame} flex h-8 gap-0.5`} style={{ alignItems: value }}><span className={`${dot} w-2.5 ${value === 'stretch' ? '' : 'h-2'}`} /><span className={`${dot} w-2.5 ${value === 'stretch' ? '' : 'h-4'}`} /><span className={`${dot} w-2.5 ${value === 'stretch' ? '' : 'h-3'}`} /></div>{name}</div>
        ))}
      </div>
    );
  }
  if (kind === 'direction') {
    return (
      <div className="grid grid-cols-2 gap-1.5 text-[9px] text-slate-500">
        <div><div className={`${frame} flex gap-0.5`}><span className={`${dot} h-3 w-4`} /><span className={`${dot} h-3 w-4`} /></div>Row → side by side</div>
        <div><div className={`${frame} flex flex-col gap-0.5`}><span className={`${dot} h-2 w-full`} /><span className={`${dot} h-2 w-full`} /></div>Column ↓ stacked</div>
      </div>
    );
  }
  if (kind === 'box') {
    return (
      <div className="flex items-center gap-2 text-[9px] text-slate-500">
        <div className="rounded border border-dashed border-amber-400 bg-amber-50 p-2">
          <div className="rounded border-2 border-slate-500 bg-emerald-50 p-2"><span className={`${dot} h-3 w-10`} /></div>
        </div>
        <div className="leading-4"><span className="text-amber-600">■</span> margin (outside the border)<br /><span className="text-emerald-600">■</span> padding (inside the border)</div>
      </div>
    );
  }
  if (kind === 'grow') {
    return <div className={`${frame} flex gap-0.5 text-[8px] text-white`}><span className={`${dot} flex h-4 flex-1 items-center justify-center`}>grows</span><span className={`${dot} h-4 w-6 bg-slate-400`} /></div>;
  }
  if (kind === 'wrap') {
    return <div className={`${frame} flex w-24 flex-wrap gap-0.5`}>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={`${dot} h-2.5 w-5`} />)}</div>;
  }
  if (kind === 'gap') {
    return <div className={`${frame} flex gap-3`}><span className={`${dot} h-3 w-5`} /><span className="self-center text-[8px] text-slate-500">gap</span><span className={`${dot} h-3 w-5`} /></div>;
  }
  if (kind === 'columns') {
    return <div className={`${frame} grid grid-cols-3 gap-0.5`}>{[1, 2, 3, 4, 5, 6].map((n) => <span key={n} className={`${dot} h-2.5`} />)}</div>;
  }
  return (
    <div className="flex gap-2 text-[9px] text-slate-500">
      {[['0', 'square'], ['8px', 'soft'], ['999px', 'pill']].map(([r, name]) => <div key={r}><span className="block h-5 w-10 bg-sky-500" style={{ borderRadius: r }} />{name}</div>)}
    </div>
  );
}

/** Puck's field label, with an ⓘ that explains the setting in plain words. */
export function HintedFieldLabel({ children, icon, label, el, readOnly, className }: { children?: ReactNode; icon?: ReactNode; label: string; el?: 'label' | 'div'; readOnly?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const hint = HINTS[label];
  if (!hint) return <FieldLabel label={label} icon={icon} el={el} readOnly={readOnly} className={className}>{children}</FieldLabel>;
  const title = (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {/* A span, not a <button>: inside a <label>, a button would take over the label from the input. */}
      <span role="button" tabIndex={0} aria-expanded={open} aria-label={`What is “${label}”?`}
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(!open); }}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setOpen(!open); } }}
        className={`grid size-4 cursor-pointer place-items-center rounded-full text-[10px] font-bold leading-none focus-visible:outline-2 focus-visible:outline-sky-500 ${open ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-sky-100 hover:text-sky-700'}`}>i</span>
    </span>
  );
  return (
    <FieldLabel label={title as unknown as string} icon={icon} el={el} readOnly={readOnly} className={className}>
      {open && (
        <div role="note" className="mb-2 space-y-2 rounded-md border border-sky-200 bg-sky-50 p-2.5 text-[12px] font-normal leading-5 text-slate-700">
          <p>{hint.text}</p>
          {hint.diagram && <Picture kind={hint.diagram} />}
        </div>
      )}
      {children}
    </FieldLabel>
  );
}

export const hasHint = (label: string) => label in HINTS;
