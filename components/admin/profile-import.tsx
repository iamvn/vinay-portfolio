'use client';

import { useRef, useState } from 'react';
import { api, describeError } from './api';
import { Button, Card, Toggle, type Notify } from './ui';
import { readLinkedInExport } from '@/lib/import/linkedin';
import type { Imported, ImportedProfileKey } from '@/lib/import/types';

/**
 * Profile → "Import from a resume or LinkedIn": a resume PDF (text read in the browser, structured by the AI
 * assistant) or a LinkedIn data export .zip (read in the browser, no AI). Shows what it found, and saves only
 * what's ticked: profile fields, and experience and skills added to or replacing what's there.
 */
type Current = Partial<Record<ImportedProfileKey, string>>;
type Mode = 'add' | 'replace' | 'skip';
const FIELD_LABELS: Record<ImportedProfileKey, string> = {
  name: 'Name', role: 'Role / headline', location: 'Location', summary: 'Summary', yearsExperience: 'Years of experience',
  targetRoles: 'Target roles', assistantNotes: 'Education & certifications (Ask my resume notes)',
};

async function pdfText(file: File) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 8); i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '')).join(''));
  }
  return pages.join('\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function ProfileImport({ current, notify, onApplied }: { current: Current; notify: Notify; onApplied: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'' | 'Reading…' | 'Asking the AI…' | 'Saving…'>('');
  const [found, setFound] = useState<{ data: Imported; source: string } | null>(null);
  const [fields, setFields] = useState<Partial<Record<ImportedProfileKey, boolean>>>({});
  const [expMode, setExpMode] = useState<Mode>('add');
  const [skillMode, setSkillMode] = useState<Mode>('add');

  async function read(file: File) {
    setFound(null);
    try {
      let data: Imported, source: string;
      if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
        setBusy('Reading…');
        data = await readLinkedInExport(file);
        source = 'your LinkedIn export';
      } else if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        setBusy('Reading…');
        const text = await pdfText(file);
        setBusy('Asking the AI…');
        const res = await api<Imported & { provider: string }>('POST', '/api/profile/import', { text });
        data = res;
        source = `your resume (read by ${res.provider})`;
      } else {
        throw new Error('Upload a resume PDF or the LinkedIn data export .zip.');
      }
      const keys = Object.keys(data.profile) as ImportedProfileKey[];
      // Pre-tick fields that are empty now; of the filled ones, only role, location, years and target roles
      // (name, summary and notes stay yours unless you tick them).
      setFields(Object.fromEntries(keys.map((k) => [k, !current[k]?.trim() || (['role', 'location', 'yearsExperience', 'targetRoles'].includes(k) && current[k] !== data.profile[k])])));
      setExpMode(data.experience.length ? 'add' : 'skip');
      setSkillMode(data.skills.length ? 'add' : 'skip');
      setFound({ data, source });
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy('');
      if (input.current) input.current.value = '';
    }
  }

  async function apply() {
    if (!found) return;
    setBusy('Saving…');
    const { data } = found;
    const done: string[] = [];
    try {
      const patch: Record<string, string> = {};
      for (const key of Object.keys(data.profile) as ImportedProfileKey[]) {
        if (!fields[key]) continue;
        const value = data.profile[key] ?? '';
        // Notes are added under what's there, not replaced.
        patch[key] = key === 'assistantNotes' && current.assistantNotes?.trim() && !current.assistantNotes.includes(value) ? `${current.assistantNotes.trim()}\n${value}` : value;
      }
      if (Object.keys(patch).length) { await api('PATCH', '/api/profile', patch); done.push(`${Object.keys(patch).length} profile field${Object.keys(patch).length === 1 ? '' : 's'}`); }

      if (expMode !== 'skip' && data.experience.length) {
        const existing = await api<{ id: number; role: string; company: string }[]>('GET', '/api/experience', undefined, { fresh: true });
        if (expMode === 'replace') for (const e of existing) await api('DELETE', `/api/experience/${e.id}`);
        const have = new Set(expMode === 'replace' ? [] : existing.map((e) => `${e.role}|${e.company}`.toLowerCase()));
        let added = 0;
        for (const e of data.experience) {
          if (have.has(`${e.role}|${e.company}`.toLowerCase())) continue;
          await api('POST', '/api/experience', { role: e.role, company: e.company, period: e.period, current: e.current, bullets: e.bullets.length ? e.bullets : [e.role] });
          added++;
        }
        done.push(`${added} role${added === 1 ? '' : 's'}${expMode === 'replace' ? ' (replaced)' : ''}`);
      }

      if (skillMode !== 'skip' && data.skills.length) {
        const existing = await api<{ id: number; group: string; items: string[] }[]>('GET', '/api/skills', undefined, { fresh: true });
        if (skillMode === 'replace') for (const g of existing) await api('DELETE', `/api/skills/${g.id}`);
        let count = 0;
        for (const g of data.skills) {
          const same = skillMode === 'add' ? existing.find((x) => x.group.toLowerCase() === g.group.toLowerCase()) : undefined;
          if (same) {
            const items = [...new Set([...same.items, ...g.items])];
            count += items.length - same.items.length;
            await api('PATCH', `/api/skills/${same.id}`, { items });
          } else {
            await api('POST', '/api/skills', g);
            count += g.items.length;
          }
        }
        done.push(`${count} skill${count === 1 ? '' : 's'}`);
      }
      notify(done.length ? `Imported ${done.join(', ')}.` : 'Nothing was ticked, so nothing changed.');
      setFound(null);
      onApplied();
    } catch (error) {
      notify(`${done.length ? `Saved ${done.join(', ')}, then: ` : ''}${describeError(error)}`, 'error');
    } finally {
      setBusy('');
    }
  }

  const modePicker = (label: string, value: Mode, set: (m: Mode) => void, n: number) => (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 text-xs text-slate-400">{label}:</span>
      {(['add', 'replace', 'skip'] as const).map((m) => (
        <button key={m} type="button" aria-pressed={value === m} disabled={!n && m !== 'skip'} onClick={() => set(m)}
          className={`min-h-9 rounded-lg px-3 text-xs font-bold disabled:opacity-40 ${value === m ? 'bg-lime-300 text-black' : 'border border-white/15 text-slate-300 hover:border-white/40'}`}>
          {m === 'add' ? 'Add to mine' : m === 'replace' ? 'Replace mine' : 'Skip'}
        </button>
      ))}
    </div>
  );

  return (
    <Card title="Import from a resume or LinkedIn" defaultOpen={false}>
      <p className="mb-3 text-sm text-slate-300">
        Fill your profile, experience and skills in one go. Upload a <b>resume PDF</b> (read with your AI assistant) or your <b>LinkedIn data export</b> (.zip from LinkedIn → Settings → Data privacy → Get a copy of your data; no AI needed).
        You see everything first; nothing is saved until you choose.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button tone="primary" disabled={Boolean(busy)} onClick={() => input.current?.click()}>{busy || 'Choose a file'}</Button>
        <span className="text-xs text-slate-500">PDF or .zip</span>
        <input ref={input} type="file" accept=".pdf,application/pdf,.zip,application/zip" className="hidden" aria-label="Resume PDF or LinkedIn export"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); }} />
      </div>

      {found && (
        <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-black/30 p-3 sm:p-4">
          <p className="text-sm text-slate-300">Found in {found.source}. Tick what to use:</p>
          {Object.keys(found.data.profile).length > 0 && (
            <ul className="space-y-2">
              {(Object.keys(found.data.profile) as ImportedProfileKey[]).map((key) => (
                <li key={key} className="rounded-lg border border-white/5 p-2.5">
                  <Toggle label={FIELD_LABELS[key]} checked={Boolean(fields[key])} onChange={(v) => setFields({ ...fields, [key]: v })} />
                  <p className="mt-1 whitespace-pre-line pl-8 text-sm text-white">{found.data.profile[key]}</p>
                  {current[key]?.trim() && current[key] !== found.data.profile[key] && <p className="mt-0.5 line-clamp-2 pl-8 text-xs text-slate-500">Now: {current[key]}</p>}
                </li>
              ))}
            </ul>
          )}
          {found.data.experience.length > 0 && (
            <div className="space-y-2">
              {modePicker(`Experience (${found.data.experience.length} roles)`, expMode, setExpMode, found.data.experience.length)}
              <ul className="space-y-1 pl-1 text-sm">
                {found.data.experience.slice(0, 8).map((e, i) => <li key={i} className="text-slate-200"><b>{e.role}</b> · {e.company} <span className="text-slate-500">({e.period}, {e.bullets.length} point{e.bullets.length === 1 ? '' : 's'})</span></li>)}
                {found.data.experience.length > 8 && <li className="text-xs text-slate-500">and {found.data.experience.length - 8} more</li>}
              </ul>
            </div>
          )}
          {found.data.skills.length > 0 && (
            <div className="space-y-2">
              {modePicker(`Skills (${found.data.skills.reduce((n, g) => n + g.items.length, 0)})`, skillMode, setSkillMode, found.data.skills.length)}
              <ul className="space-y-1 pl-1 text-sm">{found.data.skills.map((g) => <li key={g.group} className="text-slate-300"><b className="text-slate-100">{g.group}:</b> {g.items.join(', ')}</li>)}</ul>
            </div>
          )}
          <p className="text-[11px] text-slate-500">&ldquo;Replace mine&rdquo; deletes your current entries of that kind first. &ldquo;Add to mine&rdquo; skips roles you already have and merges skills into groups with the same name.</p>
          <div className="flex flex-wrap gap-2">
            <Button tone="primary" disabled={Boolean(busy)} onClick={apply}>{busy === 'Saving…' ? 'Saving…' : 'Import selected'}</Button>
            <Button disabled={Boolean(busy)} onClick={() => setFound(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
