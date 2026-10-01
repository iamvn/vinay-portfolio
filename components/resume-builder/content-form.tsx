'use client';

import { useState, type ReactNode } from 'react';
import { Button, Field, TextArea, TextInput, inputClass } from '@/components/admin/ui';
import { SECTION_IDS, SECTION_LABELS, type ResumeData, type SectionId } from '@/lib/resume-builder/types';

type Update = (change: (data: ResumeData) => ResumeData) => void;

const moveItem = <T,>(list: T[], index: number, by: -1 | 1) => {
  const next = [...list];
  const target = index + by;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/** One bullet per line. Keeps its own text so blank lines can be typed; empty lines are dropped when saved. */
function LinesInput({ value, onChange, rows = 5, placeholder }: { value: string[]; onChange: (lines: string[]) => void; rows?: number; placeholder?: string }) {
  const [text, setText] = useState(value.join('\n'));
  const [seen, setSeen] = useState(value);
  const toLines = (raw: string) => raw.split('\n').map((line) => line.replace(/^\s*[-•*]\s+/, '').trim()).filter(Boolean);
  if (seen !== value) {
    // Changed from outside (AI suggestion applied, reload…): show the new lines unless they match what's typed.
    setSeen(value);
    if (toLines(text).join('\n') !== value.join('\n')) setText(value.join('\n'));
  }
  return <TextArea value={text} rows={rows} placeholder={placeholder} onChange={(raw) => { setText(raw); onChange(toLines(raw)); }} />;
}

function Group({ title, count, children, defaultOpen = false, actions }: { title: string; count?: number; children: ReactNode; defaultOpen?: boolean; actions?: ReactNode }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-white/10 bg-slate-950/60 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 py-2 text-sm font-black uppercase tracking-wider text-cyan-300">
        <span aria-hidden="true" className="text-slate-500 transition group-open:rotate-90">▸</span>
        <span className="flex-1">{title}{count !== undefined ? <span className="ml-2 text-xs font-bold text-slate-500">{count}</span> : null}</span>
        {actions}
      </summary>
      <div className="space-y-4 border-t border-white/5 p-4">{children}</div>
    </details>
  );
}

function ItemToolbar({ index, total, onMove, onRemove, hidden, onToggleHidden }: {
  index: number; total: number; onMove: (by: -1 | 1) => void; onRemove: () => void; hidden?: boolean; onToggleHidden?: () => void;
}) {
  const small = 'min-h-9 min-w-9 px-2 py-1';
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {onToggleHidden && (
        <label className="mr-auto inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" className="size-4 accent-lime-300" checked={!hidden} onChange={onToggleHidden} /> Show on resume
        </label>
      )}
      <Button onClick={() => onMove(-1)} disabled={index === 0} label="Move up" className={small}>↑</Button>
      <Button onClick={() => onMove(1)} disabled={index === total - 1} label="Move down" className={small}>↓</Button>
      <Button tone="danger" onClick={onRemove} label="Remove" className={small}>✕</Button>
    </div>
  );
}

const itemBox = (hidden?: boolean) => `space-y-3 rounded-lg border p-3 ${hidden ? 'border-white/5 opacity-60' : 'border-white/10 bg-black/20'}`;

export function ContentForm({ data, update, onReload }: { data: ResumeData; update: Update; onReload: () => void }) {
  const b = data.basics;
  const setBasics = (key: keyof ResumeData['basics'], value: string) => update((d) => ({ ...d, basics: { ...d.basics, [key]: value } }));
  const order = [...data.layout.order, ...SECTION_IDS.filter((id) => !data.layout.order.includes(id))];

  return (
    <div className="space-y-3">
      <Group title="Header & contact" defaultOpen>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name"><TextInput value={b.name} onChange={(v) => setBasics('name', v)} /></Field>
          <Field label="Headline" hint="Target job title, e.g. Senior Frontend Engineer"><TextInput value={b.headline} onChange={(v) => setBasics('headline', v)} /></Field>
          <Field label="Email"><TextInput value={b.email} onChange={(v) => setBasics('email', v)} /></Field>
          <Field label="Phone"><TextInput value={b.phone} onChange={(v) => setBasics('phone', v)} placeholder="+91 …" /></Field>
          <Field label="Location"><TextInput value={b.location} onChange={(v) => setBasics('location', v)} placeholder="City, Country" /></Field>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Links</p>
          {b.links.map((link, index) => (
            <div key={index} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[8rem_1fr_auto]">
              <input aria-label="Link label" className={`${inputClass} max-sm:col-span-2`} value={link.label} placeholder="LinkedIn" onChange={(e) => update((d) => ({ ...d, basics: { ...d.basics, links: d.basics.links.map((l, i) => (i === index ? { ...l, label: e.target.value } : l)) } }))} />
              <input aria-label="Link URL" className={inputClass} value={link.url} placeholder="https://linkedin.com/in/…" onChange={(e) => update((d) => ({ ...d, basics: { ...d.basics, links: d.basics.links.map((l, i) => (i === index ? { ...l, url: e.target.value } : l)) } }))} />
              <Button tone="danger" label="Remove link" className="min-h-11 px-3" onClick={() => update((d) => ({ ...d, basics: { ...d.basics, links: d.basics.links.filter((_, i) => i !== index) } }))}>✕</Button>
            </div>
          ))}
          {b.links.length < 6 && <Button onClick={() => update((d) => ({ ...d, basics: { ...d.basics, links: [...d.basics.links, { label: '', url: '' }] } }))}>+ Add link</Button>}
        </div>
      </Group>

      <Group title="Summary">
        <Field label="Summary" hint="2–4 lines: title, years of experience, core skills, what you're known for.">
          <TextArea value={b.summary} rows={4} onChange={(v) => setBasics('summary', v)} />
        </Field>
      </Group>

      <Group title="Experience" count={data.experience.length}>
        {data.experience.map((item, index) => {
          const set = (patch: Partial<typeof item>) => update((d) => ({ ...d, experience: d.experience.map((e, i) => (i === index ? { ...e, ...patch } : e)) }));
          return (
            <div key={index} className={itemBox(item.hidden)}>
              <ItemToolbar index={index} total={data.experience.length} hidden={item.hidden} onToggleHidden={() => set({ hidden: !item.hidden })}
                onMove={(by) => update((d) => ({ ...d, experience: moveItem(d.experience, index, by) }))}
                onRemove={() => update((d) => ({ ...d, experience: d.experience.filter((_, i) => i !== index) }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Job title"><TextInput value={item.role} onChange={(v) => set({ role: v })} /></Field>
                <Field label="Company"><TextInput value={item.company} onChange={(v) => set({ company: v })} /></Field>
                <Field label="Dates"><TextInput value={item.period} onChange={(v) => set({ period: v })} placeholder="Jan 2022 – Present" /></Field>
                <Field label="Location (optional)"><TextInput value={item.location} onChange={(v) => set({ location: v })} /></Field>
              </div>
              <Field label="Bullets · one per line" hint="Start with a verb, add a number: “Cut load time 40% by …”">
                <LinesInput value={item.bullets} rows={Math.min(10, Math.max(4, item.bullets.length + 1))} onChange={(bullets) => set({ bullets })} />
              </Field>
            </div>
          );
        })}
        <Button onClick={() => update((d) => ({ ...d, experience: [{ role: '', company: '', location: '', period: '', bullets: [], hidden: false }, ...d.experience] }))}>+ Add role (at top)</Button>
      </Group>

      <Group title="Projects" count={data.projects.length}>
        {data.projects.map((item, index) => {
          const set = (patch: Partial<typeof item>) => update((d) => ({ ...d, projects: d.projects.map((p, i) => (i === index ? { ...p, ...patch } : p)) }));
          return (
            <div key={index} className={itemBox(item.hidden)}>
              <ItemToolbar index={index} total={data.projects.length} hidden={item.hidden} onToggleHidden={() => set({ hidden: !item.hidden })}
                onMove={(by) => update((d) => ({ ...d, projects: moveItem(d.projects, index, by) }))}
                onRemove={() => update((d) => ({ ...d, projects: d.projects.filter((_, i) => i !== index) }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Project name"><TextInput value={item.name} onChange={(v) => set({ name: v })} /></Field>
                <Field label="Link (optional)"><TextInput value={item.link} onChange={(v) => set({ link: v })} placeholder="https://…" /></Field>
              </div>
              <Field label="Tech used"><TextInput value={item.tech} onChange={(v) => set({ tech: v })} placeholder="Next.js, TypeScript, OpenAI" /></Field>
              <Field label="Bullets · one per line">
                <LinesInput value={item.bullets} rows={3} onChange={(bullets) => set({ bullets })} />
              </Field>
            </div>
          );
        })}
        <Button onClick={() => update((d) => ({ ...d, projects: [...d.projects, { name: '', tech: '', link: '', bullets: [], hidden: false }] }))}>+ Add project</Button>
      </Group>

      <Group title="Skills" count={data.skills.length}>
        {data.skills.map((group, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-start">
            <input aria-label="Skill group" className={inputClass} value={group.group} placeholder="Frontend" onChange={(e) => update((d) => ({ ...d, skills: d.skills.map((g, i) => (i === index ? { ...g, group: e.target.value } : g)) }))} />
            <input aria-label="Skills" className={inputClass} value={group.items} placeholder="React, Next.js, TypeScript" onChange={(e) => update((d) => ({ ...d, skills: d.skills.map((g, i) => (i === index ? { ...g, items: e.target.value } : g)) }))} />
            <ItemToolbar index={index} total={data.skills.length}
              onMove={(by) => update((d) => ({ ...d, skills: moveItem(d.skills, index, by) }))}
              onRemove={() => update((d) => ({ ...d, skills: d.skills.filter((_, i) => i !== index) }))} />
          </div>
        ))}
        <Button onClick={() => update((d) => ({ ...d, skills: [...d.skills, { group: '', items: '' }] }))}>+ Add skill group</Button>
      </Group>

      <Group title="Education" count={data.education.length}>
        {data.education.map((item, index) => {
          const set = (patch: Partial<typeof item>) => update((d) => ({ ...d, education: d.education.map((e, i) => (i === index ? { ...e, ...patch } : e)) }));
          return (
            <div key={index} className={itemBox()}>
              <ItemToolbar index={index} total={data.education.length}
                onMove={(by) => update((d) => ({ ...d, education: moveItem(d.education, index, by) }))}
                onRemove={() => update((d) => ({ ...d, education: d.education.filter((_, i) => i !== index) }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="School / university"><TextInput value={item.school} onChange={(v) => set({ school: v })} /></Field>
                <Field label="Degree"><TextInput value={item.degree} onChange={(v) => set({ degree: v })} placeholder="B.Tech, Computer Science" /></Field>
                <Field label="Dates"><TextInput value={item.period} onChange={(v) => set({ period: v })} placeholder="2012 – 2016" /></Field>
                <Field label="Location (optional)"><TextInput value={item.location} onChange={(v) => set({ location: v })} /></Field>
              </div>
              <Field label="Details (optional)"><TextInput value={item.details} onChange={(v) => set({ details: v })} placeholder="CGPA 8.4/10 · Relevant coursework …" /></Field>
            </div>
          );
        })}
        <Button onClick={() => update((d) => ({ ...d, education: [...d.education, { school: '', degree: '', location: '', period: '', details: '' }] }))}>+ Add education</Button>
      </Group>

      <Group title="Certifications & more" count={data.extras.length}>
        <p className="text-xs text-slate-500">Extra sections such as Certifications, Awards, Publications or Languages.</p>
        {data.extras.map((extra, index) => (
          <div key={index} className={itemBox()}>
            <ItemToolbar index={index} total={data.extras.length}
              onMove={(by) => update((d) => ({ ...d, extras: moveItem(d.extras, index, by) }))}
              onRemove={() => update((d) => ({ ...d, extras: d.extras.filter((_, i) => i !== index) }))} />
            <Field label="Section title"><TextInput value={extra.title} onChange={(v) => update((d) => ({ ...d, extras: d.extras.map((x, i) => (i === index ? { ...x, title: v } : x)) }))} /></Field>
            <Field label="Items · one per line"><LinesInput value={extra.items} rows={3} onChange={(items) => update((d) => ({ ...d, extras: d.extras.map((x, i) => (i === index ? { ...x, items } : x)) }))} /></Field>
          </div>
        ))}
        {data.extras.length < 6 && <Button onClick={() => update((d) => ({ ...d, extras: [...d.extras, { title: 'Certifications', items: [] }] }))}>+ Add section</Button>}
      </Group>

      <Group title="Section order & page">
        <ul className="space-y-1.5">
          {order.map((id: SectionId, index) => (
            <li key={id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5">
              <label className="flex min-h-9 flex-1 cursor-pointer items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" className="size-4 accent-lime-300" checked={!data.layout.hidden.includes(id)}
                  onChange={(e) => update((d) => ({ ...d, layout: { ...d.layout, hidden: e.target.checked ? d.layout.hidden.filter((h) => h !== id) : [...d.layout.hidden, id] } }))} />
                {SECTION_LABELS[id]}
              </label>
              <Button label="Move up" className="min-h-9 min-w-9 px-2 py-1" disabled={index === 0} onClick={() => update((d) => ({ ...d, layout: { ...d.layout, order: moveItem(order, index, -1) } }))}>↑</Button>
              <Button label="Move down" className="min-h-9 min-w-9 px-2 py-1" disabled={index === order.length - 1} onClick={() => update((d) => ({ ...d, layout: { ...d.layout, order: moveItem(order, index, 1) } }))}>↓</Button>
            </li>
          ))}
        </ul>
        <Field label="Paper size">
          <select className={inputClass} value={data.layout.paper} onChange={(e) => update((d) => ({ ...d, layout: { ...d.layout, paper: e.target.value as 'a4' | 'us-letter' } }))}>
            <option value="a4">A4 (India, Europe, most of the world)</option>
            <option value="us-letter">US Letter (USA, Canada)</option>
          </select>
        </Field>
        <div className="border-t border-white/5 pt-3">
          <Button onClick={onReload}>↻ Reload content from portfolio</Button>
          <p className="mt-1.5 text-[11px] text-slate-500">Replaces this resume&apos;s content with the current Profile, Experience, Skills and Projects tabs (education and extra sections are kept).</p>
        </div>
      </Group>
    </div>
  );
}
