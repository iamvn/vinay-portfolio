'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, describeError, fromLines, toLines } from './api';
import { Button, Card, ConfirmButton, Field, Loading, TextArea, TextInput, Toggle, type Notify } from './ui';

type Row = Record<string, unknown>;
type Draft = Record<string, string | boolean>;

type Option = { value: string; label: string; help?: string };

export type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'lines' | 'checkbox' | 'select' | 'image' | 'heading';
  hint?: string;
  placeholder?: string;
  options?: Option[];                       // for "select"
  mono?: boolean;                           // monospace textarea (diagrams, code)
  rows?: number;
  defaultValue?: string;
  showIf?: (draft: Draft) => boolean;       // hide fields that don't apply
};

export type ListConfig = {
  endpoint: string;                         // e.g. /api/skills
  idKey: 'id' | 'slug';                     // how an item is addressed in the URL
  reorderEndpoint?: string;                 // e.g. /api/skills/reorder
  fields: FieldDef[];
  itemTitle: (row: Row) => string;
  noun: string;                             // "skill group", "experience", "project"
  intro?: ReactNode;                        // help shown above the list
  previewHref?: (row: Row) => string;       // "Preview ↗" link on saved items
  imageEndpoint?: (row: Row) => string;     // upload/delete URL for "image" fields
};

const dataFields = (fields: FieldDef[]) => fields.filter((field) => field.type !== 'heading');

function toDraft(fields: FieldDef[], row: Row): Draft {
  return Object.fromEntries(dataFields(fields).map(({ key, type, defaultValue }) => {
    const value = row[key];
    if (type === 'checkbox') return [key, Boolean(value)];
    if (type === 'lines') return [key, toLines((value as string[] | undefined) ?? [])];
    return [key, (value as string | undefined) ?? defaultValue ?? ''];
  }));
}

function toPayload(fields: FieldDef[], draft: Draft) {
  return Object.fromEntries(dataFields(fields).map(({ key, type }) => {
    const value = draft[key];
    if (type === 'lines') return [key, fromLines(value as string)];
    if (type === 'checkbox') return [key, value];
    return [key, type === 'textarea' ? (value as string).replace(/\s+$/, '') : (value as string).trim()];
  }));
}

function ChoiceField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (value: string) => void }) {
  const selected = field.options?.find((option) => option.value === value);
  return (
    <Field group label={field.label} hint={selected?.help}>
      <div className="flex flex-wrap gap-2">
        {field.options?.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${option.value === value ? 'border-lime-300 bg-lime-300/10 text-lime-200' : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

function ImageField({ field, value, onChange, uploadUrl, notify, onUploaded }: {
  field: FieldDef; value: string; onChange: (value: string) => void;
  uploadUrl: string | null; notify: Notify; onUploaded: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const isUploaded = Boolean(uploadUrl && value.startsWith(uploadUrl));

  async function upload(file: File) {
    if (!uploadUrl) return;
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) return notify('Only .jpg, .jpeg, .png and .webp images are allowed.', 'error');
    if (file.size > 2 * 1024 * 1024) return notify('The image is larger than 2 MB.', 'error');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const saved = await api<{ url: string }>('POST', uploadUrl, form);
      onUploaded(saved.url);
      notify('Image uploaded. It is live on the site.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    if (!uploadUrl) return;
    setBusy(true);
    try {
      await api('DELETE', uploadUrl);
      onUploaded('');
      notify('Image removed.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field group label={field.label} hint={field.hint}>
      <div
        className="flex flex-col gap-4 sm:flex-row sm:items-start"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && uploadUrl) upload(file); }}
      >
        <div className="flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-900 text-xs text-slate-500 sm:w-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : 'No image'}
        </div>
        <div className="flex-1 space-y-2">
          {uploadUrl ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}</Button>
              {isUploaded && <ConfirmButton onConfirm={remove} disabled={busy}>Remove</ConfirmButton>}
            </div>
          ) : (
            <p className="text-[11px] text-yellow-200/80">Add the project first, then you can upload an image.</p>
          )}
          <TextInput value={value} onChange={onChange} placeholder="…or an image path/URL, e.g. /images/my-project.png" />
          <p className="text-[11px] text-slate-500">.jpg, .png or .webp · max 2 MB · 16:9 looks best · uploading saves immediately</p>
        </div>
        <input ref={input} type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }} />
      </div>
    </Field>
  );
}

function FieldsForm({ fields, draft, onChange, uploadUrl, notify, onImageUploaded }: {
  fields: FieldDef[]; draft: Draft; onChange: (draft: Draft) => void;
  uploadUrl: string | null; notify: Notify; onImageUploaded: (key: string, url: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {fields.filter((field) => !field.showIf || field.showIf(draft)).map((field) => {
        const { key, label, type, hint } = field;
        const set = (value: string | boolean) => onChange({ ...draft, [key]: value });
        if (type === 'heading') {
          return <h4 key={key} className="border-t border-white/5 pt-4 text-[11px] font-black uppercase tracking-[.2em] text-lime-300/80 first:border-0 first:pt-0 md:col-span-3">{label}</h4>;
        }
        if (type === 'checkbox') return <div key={key} className="flex items-end pb-2"><Toggle label={label} checked={draft[key] as boolean} onChange={set} /></div>;
        const wide = type !== 'text' ? 'md:col-span-3' : '';
        return (
          <div key={key} className={wide}>
            {type === 'select' && <ChoiceField field={field} value={draft[key] as string} onChange={set} />}
            {type === 'image' && <ImageField field={field} value={draft[key] as string} onChange={set} uploadUrl={uploadUrl} notify={notify} onUploaded={(url) => onImageUploaded(key, url)} />}
            {(type === 'text' || type === 'textarea' || type === 'lines') && (
              <Field label={label} hint={hint ?? (type === 'lines' ? 'One per line' : undefined)}>
                {type === 'text'
                  ? <TextInput value={draft[key] as string} onChange={set} placeholder={field.placeholder} />
                  : <TextArea
                      value={draft[key] as string}
                      onChange={set}
                      mono={field.mono}
                      placeholder={field.placeholder}
                      rows={field.rows ?? (type === 'lines' ? Math.min(12, Math.max(3, (draft[key] as string).split('\n').length + 1)) : 3)}
                    />}
              </Field>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ItemCard({ config, row, index, total, onSaved, onDeleted, onMove, notify }: {
  config: ListConfig; row: Row; index: number; total: number;
  onSaved: (row: Row) => void; onDeleted: () => void; onMove: (direction: -1 | 1) => void; notify: Notify;
}) {
  const [draft, setDraft] = useState(() => toDraft(config.fields, row));
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(config.fields, row));
  const url = `${config.endpoint}/${encodeURIComponent(String(row[config.idKey]))}`;

  async function save() {
    setBusy(true);
    try {
      const saved = await api<Row>('PATCH', url, toPayload(config.fields, draft));
      onSaved(saved);
      setDraft(toDraft(config.fields, saved));
      notify(`Saved "${config.itemTitle(saved)}".`);
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api('DELETE', url);
      onDeleted();
      notify(`Deleted "${config.itemTitle(row)}".`);
    } catch (error) {
      notify(describeError(error), 'error');
      setBusy(false);
    }
  }

  // An upload is already saved on the server, so update both the saved row and the draft.
  const onImageUploaded = (key: string, value: string) => {
    onSaved({ ...row, [key]: value });
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const preview = config.previewHref?.(row);
  return (
    <Card
      title={<>{config.itemTitle(row)}{dirty && <span className="ml-2 text-[10px] text-yellow-300">● unsaved</span>}</>}
      actions={<>
        {config.reorderEndpoint && <>
          <Button onClick={() => onMove(-1)} disabled={busy || index === 0}>↑</Button>
          <Button onClick={() => onMove(1)} disabled={busy || index === total - 1}>↓</Button>
        </>}
        {preview && <a href={preview} target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 px-3.5 py-2 text-xs font-black uppercase tracking-wide text-slate-200 hover:border-cyan-300/60">Preview ↗</a>}
        <Button onClick={() => setDraft(toDraft(config.fields, row))} disabled={busy || !dirty}>Reset</Button>
        <Button tone="primary" onClick={save} disabled={busy || !dirty}>Save</Button>
        <ConfirmButton onConfirm={remove} disabled={busy}>Delete</ConfirmButton>
      </>}
    >
      <FieldsForm
        fields={config.fields}
        draft={draft}
        onChange={setDraft}
        uploadUrl={config.imageEndpoint ? config.imageEndpoint(row) : null}
        notify={notify}
        onImageUploaded={onImageUploaded}
      />
    </Card>
  );
}

function NewItemCard({ config, onCreated, onCancel, notify }: { config: ListConfig; onCreated: (row: Row) => void; onCancel: () => void; notify: Notify }) {
  const [draft, setDraft] = useState(() => toDraft(config.fields, {}));
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const created = await api<Row>('POST', config.endpoint, toPayload(config.fields, draft));
      onCreated(created);
      notify(`Added "${config.itemTitle(created)}".`);
    } catch (error) {
      notify(describeError(error), 'error');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl ring-1 ring-lime-300/40">
      <Card
        title={`New ${config.noun}`}
        actions={<>
          <Button onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button tone="primary" onClick={create} disabled={busy}>{busy ? 'Adding…' : 'Add'}</Button>
        </>}
      >
        <FieldsForm fields={config.fields} draft={draft} onChange={setDraft} uploadUrl={null} notify={notify} onImageUploaded={() => {}} />
      </Card>
    </div>
  );
}

export function ListTab({ config, notify }: { config: ListConfig; notify: Notify }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [version, setVersion] = useState(0); // remounts cards after a reorder

  useEffect(() => {
    api<Row[]>('GET', config.endpoint).then(setRows).catch((error) => notify(describeError(error), 'error'));
  }, [config.endpoint, notify]);

  if (!rows) return <Loading />;

  async function move(index: number, direction: -1 | 1) {
    if (!rows || !config.reorderEndpoint) return;
    const ids = rows.map((row) => row.id as number);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    try {
      setRows(await api<Row[]>('PUT', config.reorderEndpoint, { ids }));
      setVersion((v) => v + 1);
      notify('Order saved.');
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  return (
    <div className="space-y-4">
      {config.intro}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{rows.length} {config.noun}{rows.length === 1 ? '' : 's'}{config.reorderEndpoint ? ' · use ↑ ↓ to change the order on the site' : ''}</p>
        {!adding && <Button tone="primary" onClick={() => setAdding(true)}>+ Add {config.noun}</Button>}
      </div>
      {adding && (
        <NewItemCard
          config={config}
          notify={notify}
          onCancel={() => setAdding(false)}
          onCreated={(row) => { setRows((current) => [...(current ?? []), row]); setAdding(false); }}
        />
      )}
      {rows.map((row, index) => (
        <ItemCard
          key={`${String(row.id)}-${version}`}
          config={config}
          row={row}
          index={index}
          total={rows.length}
          notify={notify}
          onMove={(direction) => move(index, direction)}
          onSaved={(saved) => setRows((current) => (current ?? []).map((item) => (item.id === row.id ? saved : item)))}
          onDeleted={() => setRows((current) => (current ?? []).filter((item) => item.id !== row.id))}
        />
      ))}
    </div>
  );
}

// ---------- The three lists ----------
export const SKILLS: ListConfig = {
  endpoint: '/api/skills',
  idKey: 'id',
  reorderEndpoint: '/api/skills/reorder',
  noun: 'skill group',
  itemTitle: (row) => String(row.group || 'Skill group'),
  fields: [
    { key: 'group', label: 'Group name', type: 'text' },
    { key: 'items', label: 'Skills', type: 'lines' },
  ],
};

export const EXPERIENCE: ListConfig = {
  endpoint: '/api/experience',
  idKey: 'id',
  reorderEndpoint: '/api/experience/reorder',
  noun: 'experience',
  itemTitle: (row) => (row.role ? `${row.role} · ${row.company}` : 'Experience'),
  fields: [
    { key: 'role', label: 'Role', type: 'text' },
    { key: 'company', label: 'Company', type: 'text' },
    { key: 'period', label: 'Period', type: 'text', hint: 'e.g. Jun 2025 — Present' },
    { key: 'current', label: 'Current job', type: 'checkbox' },
    { key: 'bullets', label: 'Highlights', type: 'lines' },
  ],
};

const isType = (type: string) => (draft: Draft) => draft.type === type;

export const PROJECTS: ListConfig = {
  endpoint: '/api/projects',
  idKey: 'slug',
  noun: 'project',
  itemTitle: (row) => String(row.title || 'Project'),
  previewHref: (row) => (row.type === 'link' ? String(row.externalUrl) : `/projects/${String(row.slug)}`),
  imageEndpoint: (row) => `/api/projects/${String(row.slug)}/image`,
  intro: <ProjectsGuide />,
  fields: [
    { key: 'h-card', label: 'Card on the homepage', type: 'heading' },
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'slug', label: 'Slug', type: 'text', hint: 'Page address: /projects/<slug> · lowercase-with-hyphens' },
    { key: 'featured', label: 'Show "★ Featured" badge', type: 'checkbox' },
    { key: 'description', label: 'Short description', type: 'textarea', hint: 'One or two sentences, shown on the card and at the top of the page.' },
    { key: 'stack', label: 'Tech stack tags', type: 'lines' },
    { key: 'image', label: 'Cover image (optional)', type: 'image', hint: 'Shown on the card and as the page banner. Without one, the card shows the title initials.' },

    { key: 'h-type', label: 'What happens when someone clicks it', type: 'heading' },
    {
      key: 'type', label: 'Project type', type: 'select', defaultValue: 'case-study',
      options: [
        { value: 'case-study', label: 'Case study page', help: 'Opens /projects/<slug> with the sections below (Objective, Engineering focus, Architecture, Result). Empty sections are hidden.' },
        { value: 'article', label: 'Article page', help: 'Opens /projects/<slug> as a written article. Good for work you can’t link to, like an internal implementation.' },
        { value: 'link', label: 'Direct link', help: 'The card goes straight to the link below (blog post, live site, repo…). No page on your site.' },
      ],
    },
    { key: 'externalUrl', label: 'Link', type: 'text', placeholder: 'https://…', hint: 'Required for “Direct link”. Where the card goes.', showIf: isType('link') },

    { key: 'h-links', label: 'Extra buttons (optional)', type: 'heading' },
    { key: 'liveUrl', label: 'Live site URL', type: 'text', placeholder: 'https://…', hint: 'Adds a “LIVE ↗” button. Empty = hidden.' },
    { key: 'repoUrl', label: 'GitHub URL', type: 'text', placeholder: 'https://github.com/…', hint: 'Adds a “GITHUB ↗” button. Empty = hidden.' },

    { key: 'h-case', label: 'Case study sections (each is hidden when empty)', type: 'heading', showIf: isType('case-study') },
    { key: 'objective', label: 'Objective', type: 'textarea', showIf: isType('case-study'), placeholder: 'What problem were you solving, and for whom?' },
    { key: 'approach', label: 'Engineering focus', type: 'textarea', showIf: isType('case-study'), placeholder: 'Key technical decisions: rendering, state, APIs, caching…' },
    { key: 'architecture', label: 'Architecture', type: 'textarea', mono: true, rows: 7, showIf: isType('case-study'), hint: 'Shown in a monospace box, so simple text diagrams line up.', placeholder: 'User\n  ↓\nNext.js UI\n  ↓\nAPI' },
    { key: 'result', label: 'Result', type: 'textarea', showIf: isType('case-study'), placeholder: 'Measured outcomes: performance, adoption, reliability…' },

    { key: 'h-article', label: 'Article', type: 'heading', showIf: isType('article') },
    {
      key: 'content', label: 'Article text', type: 'textarea', rows: 16, showIf: isType('article'),
      hint: 'Blank line = new paragraph · start a line with "## " for a heading · "- " for a bullet point.',
      placeholder: '## The problem\nWhat was broken or missing…\n\n## What I built\n- First key point\n- Second key point',
    },
  ],
};

function ProjectsGuide() {
  const cell = 'border-t border-white/5 px-3 py-2 align-top';
  return (
    <details className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 text-xs leading-6 text-cyan-50" open>
      <summary className="cursor-pointer px-4 py-3 font-bold text-cyan-200">How projects appear on the site</summary>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-[560px] text-left">
          <thead className="text-[10px] uppercase tracking-wider text-cyan-300">
            <tr><th className="px-3 py-2">Type</th><th className="px-3 py-2">Card button</th><th className="px-3 py-2">Clicking the card</th><th className="px-3 py-2">Fields used on the page</th></tr>
          </thead>
          <tbody className="text-slate-300">
            <tr><td className={cell}><b>Case study</b></td><td className={cell}>ENTER PROJECT</td><td className={cell}>Your page /projects/&lt;slug&gt;</td><td className={cell}>Objective · Engineering focus · Architecture · Result</td></tr>
            <tr><td className={cell}><b>Article</b></td><td className={cell}>READ ARTICLE</td><td className={cell}>Your page /projects/&lt;slug&gt;</td><td className={cell}>Article text</td></tr>
            <tr><td className={cell}><b>Direct link</b></td><td className={cell}>OPEN LINK ↗</td><td className={cell}>Opens the Link in a new tab</td><td className={cell}>— (no page)</td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-slate-400">Every type shows the title, short description, tech tags and optional cover image on the card, plus “LIVE ↗” / “GITHUB ↗” buttons when those URLs are filled in. Button labels can be changed under Site text → projects. Use <b>Preview ↗</b> to see a project after saving.</p>
      </div>
    </details>
  );
}
