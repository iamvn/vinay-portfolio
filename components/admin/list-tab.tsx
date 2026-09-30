'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, describeError, fromLines, toLines } from './api';
import { IMAGE_ACCEPT, prepareImage } from './image';
import { Button, ConfirmButton, Field, Loading, TextArea, TextInput, Toggle, buttonBase, type Notify } from './ui';

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
  itemSubtitle?: (row: Row) => string;     // second line in the folded (phone) view
  noun: string;                             // "skill group", "experience", "project"
  intro?: ReactNode;                        // help shown above the list
  previewHref?: (row: Row) => string;       // "Preview ↗" link on saved items
  imageEndpoint?: (row: Row) => string;     // upload/delete URL for "image" fields
};

const dataFields = (fields: FieldDef[]) => fields.filter((field) => field.type !== 'heading');

function toDraft(fields: FieldDef[], row: Row): Draft {
  return Object.fromEntries(dataFields(fields).map(({ key, type, defaultValue }) => {
    const value = row[key];
    if (type === 'checkbox') return [key, value === undefined ? defaultValue === 'true' : Boolean(value)];
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
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        {field.options?.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === value}
            className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-bold transition sm:min-h-0 sm:text-xs ${option.value === value ? 'border-lime-300 bg-lime-300/10 text-lime-200' : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white'}`}
          >
            {option.value === value ? '● ' : '○ '}{option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

function ImageField({ field, value, onChange, uploadUrl, notify, onUploaded, pendingFile, onPendingFile }: {
  field: FieldDef; value: string; onChange: (value: string) => void;
  uploadUrl: string | null; notify: Notify; onUploaded: (url: string) => void;
  /** New items: the image is chosen now and uploaded right after the item is created. */
  pendingFile?: File | null; onPendingFile?: (file: File | null) => void;
}) {
  const [busy, setBusy] = useState<'' | 'Preparing…' | 'Uploading…' | 'Removing…'>('');
  const input = useRef<HTMLInputElement>(null);
  const isUploaded = Boolean(uploadUrl && value.startsWith(uploadUrl));
  const pending = !uploadUrl && onPendingFile;
  // Local preview of a chosen-but-not-yet-uploaded image (freed when it changes).
  const pendingPreview = useMemo(() => (pendingFile ? URL.createObjectURL(pendingFile) : ''), [pendingFile]);
  useEffect(() => () => { if (pendingPreview) URL.revokeObjectURL(pendingPreview); }, [pendingPreview]);
  const shown = pendingPreview || value;

  function choose(file: File) {
    if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
      return notify('Please choose an image (.jpg, .png, .webp or an iPhone photo).', 'error');
    }
    if (pending) onPendingFile(file);
    else upload(file);
  }

  async function upload(original: File) {
    if (!uploadUrl) return;
    if (!original.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(original.name)) {
      return notify('Please choose an image (.jpg, .png, .webp or an iPhone photo).', 'error');
    }
    try {
      setBusy('Preparing…');
      const file = await prepareImage(original); // shrinks big phone photos before upload
      if (file.size > 2 * 1024 * 1024) return notify('The image is still larger than 2 MB. Try a smaller one.', 'error');
      setBusy('Uploading…');
      const form = new FormData();
      form.append('file', file);
      const saved = await api<{ url: string }>('POST', uploadUrl, form);
      onUploaded(saved.url);
      notify('Image uploaded. It is live on the site.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy('');
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    if (!uploadUrl) return;
    setBusy('Removing…');
    try {
      await api('DELETE', uploadUrl);
      onUploaded('');
      notify('Image removed.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <Field group label={field.label} hint={field.hint}>
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file && (uploadUrl || pending)) choose(file); }}
      >
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={(!uploadUrl && !pending) || Boolean(busy)}
          aria-label={value ? 'Replace image' : 'Upload image'}
          className="relative flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-slate-900 text-xs text-slate-500 sm:w-48 sm:border-solid"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {shown ? <img src={shown} alt="" className="h-full w-full object-cover" /> : <span>{uploadUrl || pending ? 'Tap to add a cover image' : 'No image'}</span>}
          {busy && <span className="absolute inset-0 flex items-center justify-center bg-black/70 font-bold text-lime-200">{busy}</span>}
        </button>
        <div className="flex-1 space-y-2">
          {uploadUrl ? (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button onClick={() => input.current?.click()} disabled={Boolean(busy)} className={isUploaded ? '' : 'col-span-2'}>{value ? 'Replace image' : 'Upload image'}</Button>
              {isUploaded && <ConfirmButton onConfirm={remove} disabled={Boolean(busy)} confirmLabel="Tap again">Remove</ConfirmButton>}
            </div>
          ) : pending ? (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button onClick={() => input.current?.click()} className={pendingFile ? '' : 'col-span-2'}>{pendingFile ? 'Change image' : 'Choose image'}</Button>
              {pendingFile && <Button tone="danger" onClick={() => onPendingFile(null)}>Remove</Button>}
              {pendingFile && <p className="col-span-2 text-[11px] text-lime-200/80">Uploads automatically when you press Add.</p>}
            </div>
          ) : (
            <p className="text-[11px] text-yellow-200/80">Add the project first, then you can upload an image.</p>
          )}
          <details className="text-xs text-slate-400">
            <summary className="flex min-h-11 cursor-pointer items-center sm:min-h-0">Use an image path/URL instead</summary>
            <div className="mt-2"><TextInput value={value} onChange={onChange} placeholder="/images/my-project.png" /></div>
          </details>
          <p className="text-[11px] text-slate-500">Large photos are shrunk automatically · 16:9 looks best{pending ? '' : ' · uploading saves immediately'}</p>
        </div>
        <input ref={input} type="file" className="hidden" accept={IMAGE_ACCEPT} onChange={(e) => { const file = e.target.files?.[0]; if (file) choose(file); e.target.value = ''; }} />
      </div>
    </Field>
  );
}

function FieldsForm({ fields, draft, onChange, uploadUrl, notify, onImageUploaded, pendingImage, onPendingImage }: {
  fields: FieldDef[]; draft: Draft; onChange: (draft: Draft) => void;
  uploadUrl: string | null; notify: Notify; onImageUploaded: (key: string, url: string) => void;
  pendingImage?: File | null; onPendingImage?: (file: File | null) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {fields.filter((field) => !field.showIf || field.showIf(draft)).map((field) => {
        const { key, label, type, hint } = field;
        const set = (value: string | boolean) => onChange({ ...draft, [key]: value });
        if (type === 'heading') {
          return <h4 key={key} className="border-t border-white/5 pt-4 text-[11px] font-black uppercase tracking-[.2em] text-lime-300/80 first:border-0 first:pt-0 md:col-span-3">{label}</h4>;
        }
        if (type === 'checkbox') {
          return (
            <div key={key} className="flex flex-col justify-end sm:pb-2">
              <Toggle label={label} checked={draft[key] as boolean} onChange={set} />
              {hint && <span className="mt-1 text-[11px] text-slate-500">{hint}</span>}
            </div>
          );
        }
        const wide = type !== 'text' ? 'md:col-span-3' : '';
        return (
          <div key={key} className={wide}>
            {type === 'select' && <ChoiceField field={field} value={draft[key] as string} onChange={set} />}
            {type === 'image' && <ImageField field={field} value={draft[key] as string} onChange={set} uploadUrl={uploadUrl} notify={notify} onUploaded={(url) => onImageUploaded(key, url)} pendingFile={pendingImage} onPendingFile={onPendingImage} />}
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

const iconButton = 'min-w-11 px-0 sm:min-w-0 sm:px-3.5';

function ItemCard({ config, row, index, total, onSaved, onDeleted, onMove, notify }: {
  config: ListConfig; row: Row; index: number; total: number;
  onSaved: (row: Row) => void; onDeleted: () => void; onMove: (direction: -1 | 1) => void; notify: Notify;
}) {
  const [draft, setDraft] = useState(() => toDraft(config.fields, row));
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false); // phones only: entries start folded
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
  const previewLink = preview && (
    <a href={preview} target="_blank" rel="noreferrer" className={`${buttonBase} border border-white/15 text-slate-200 hover:border-cyan-300/60`}>Preview ↗</a>
  );
  const moveButtons = config.reorderEndpoint && <>
    <Button onClick={() => onMove(-1)} disabled={busy || index === 0} label="Move up" className={iconButton}>↑</Button>
    <Button onClick={() => onMove(1)} disabled={busy || index === total - 1} label="Move down" className={iconButton}>↓</Button>
  </>;
  const subtitle = config.itemSubtitle?.(row);

  return (
    <section className={`rounded-2xl border bg-slate-950/70 ${dirty ? 'border-yellow-300/40' : 'border-white/10'}`}>
      {/* Header: on phones the whole row is a button that folds/unfolds the entry. */}
      <div className="flex items-center gap-3 p-4 sm:p-5 sm:pb-4">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left sm:pointer-events-none sm:min-h-0"
        >
          {row.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={String(row.image)} alt="" className="size-11 shrink-0 rounded-lg object-cover sm:hidden" />
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black uppercase tracking-wider text-cyan-300">
              {config.itemTitle(row)}
            </span>
            {(subtitle || dirty) && (
              <span className="block truncate text-xs text-slate-500">
                {dirty && <span className="text-yellow-300">● unsaved · </span>}{subtitle}
              </span>
            )}
          </span>
          <span aria-hidden="true" className={`text-slate-400 transition sm:hidden ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {/* Desktop actions */}
        <div className="hidden flex-wrap gap-2 sm:flex">
          {moveButtons}
          {previewLink}
          <Button onClick={() => setDraft(toDraft(config.fields, row))} disabled={busy || !dirty}>Reset</Button>
          <Button tone="primary" onClick={save} disabled={busy || !dirty}>Save</Button>
          <ConfirmButton onConfirm={remove} disabled={busy}>Delete</ConfirmButton>
        </div>
      </div>

      <div className={`px-4 sm:block sm:px-5 sm:pb-5 ${open ? 'block' : 'hidden'}`}>
        {/* Phone toolbar */}
        <div className="mb-4 flex flex-wrap gap-2 sm:hidden">
          {moveButtons}
          {previewLink}
          <ConfirmButton onConfirm={remove} disabled={busy} className="ml-auto" confirmLabel="Tap again">Delete</ConfirmButton>
        </div>
        <FieldsForm
          fields={config.fields}
          draft={draft}
          onChange={setDraft}
          uploadUrl={config.imageEndpoint ? config.imageEndpoint(row) : null}
          notify={notify}
          onImageUploaded={onImageUploaded}
        />
        {/* Phone save bar: stays at the bottom of the screen while this entry is on screen */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex items-center gap-2 rounded-b-2xl border-t border-white/10 bg-[#050a10]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <span className={`mr-auto text-xs ${dirty ? 'text-yellow-300' : 'text-slate-500'}`}>{dirty ? '● Unsaved' : 'Saved'}</span>
          <Button onClick={() => setDraft(toDraft(config.fields, row))} disabled={busy || !dirty}>Reset</Button>
          <Button tone="primary" onClick={save} disabled={busy || !dirty} className="px-6">{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </section>
  );
}

function NewItemCard({ config, onCreated, onCancel, notify }: { config: ListConfig; onCreated: (row: Row) => void; onCancel: () => void; notify: Notify }) {
  const [draft, setDraft] = useState(() => toDraft(config.fields, {}));
  const [busy, setBusy] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const imageKey = config.fields.find((field) => field.type === 'image')?.key;

  async function create() {
    setBusy(true);
    let created: Row;
    try {
      created = await api<Row>('POST', config.endpoint, toPayload(config.fields, draft));
    } catch (error) {
      notify(describeError(error), 'error');
      setBusy(false);
      return;
    }
    // The item exists now, so the chosen image can be uploaded to it.
    if (pendingImage && imageKey && config.imageEndpoint) {
      try {
        const file = await prepareImage(pendingImage);
        const form = new FormData();
        form.append('file', file);
        const saved = await api<{ url: string }>('POST', config.imageEndpoint(created), form);
        created = { ...created, [imageKey]: saved.url };
      } catch (error) {
        notify(`Added "${config.itemTitle(created)}", but the image didn't upload: ${describeError(error)} Open it and try again.`, 'error');
        onCreated(created);
        return;
      }
    }
    onCreated(created);
    notify(`Added "${config.itemTitle(created)}"${pendingImage ? ' with its image' : ''}.`);
  }

  return (
    <section className="rounded-2xl border border-lime-300/40 bg-slate-950/70 p-4 pb-0 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-lime-300">New {config.noun}</h3>
        <div className="hidden gap-2 sm:flex">
          <Button onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button tone="primary" onClick={create} disabled={busy}>{busy ? 'Adding…' : 'Add'}</Button>
        </div>
      </div>
      <FieldsForm fields={config.fields} draft={draft} onChange={setDraft} uploadUrl={null} notify={notify} onImageUploaded={() => {}} pendingImage={pendingImage} onPendingImage={setPendingImage} />
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex gap-2 rounded-b-2xl border-t border-white/10 bg-[#050a10]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <Button onClick={onCancel} disabled={busy} className="flex-1">Cancel</Button>
        <Button tone="primary" onClick={create} disabled={busy} className="flex-[2]">{busy ? 'Adding…' : `Add ${config.noun}`}</Button>
      </div>
    </section>
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
    <div className="space-y-3 sm:space-y-4">
      {config.intro}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          {rows.length} {config.noun}{rows.length === 1 ? '' : 's'}
          <span className="sm:hidden"> · tap one to edit</span>
          {config.reorderEndpoint ? <span className="hidden sm:inline"> · use ↑ ↓ to change the order on the site</span> : null}
        </p>
        {!adding && <Button tone="primary" onClick={() => setAdding(true)} className="w-full py-3 sm:w-auto sm:py-2">+ Add {config.noun}</Button>}
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
  itemSubtitle: (row) => `${(row.items as string[] | undefined)?.length ?? 0} skills`,
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
  itemSubtitle: (row) => `${row.period ?? ''}${row.current ? ' · current' : ''}`,
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
  itemSubtitle: (row) => `${row.published === false ? 'DRAFT (hidden) · ' : ''}${row.type === 'article' ? 'Article' : row.type === 'link' ? 'Direct link' : 'Case study'}${row.featured ? ' · ★ featured' : ''}`,
  previewHref: (row) => (row.type === 'link' ? String(row.externalUrl) : `/projects/${String(row.slug)}`),
  imageEndpoint: (row) => `/api/projects/${String(row.slug)}/image`,
  intro: <ProjectsGuide />,
  fields: [
    { key: 'h-card', label: 'Card on the homepage', type: 'heading' },
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'slug', label: 'Slug', type: 'text', hint: 'Page address: /projects/<slug> · lowercase-with-hyphens' },
    { key: 'published', label: 'Visible on site', type: 'checkbox', defaultValue: 'true', hint: 'Off = draft: hidden from visitors, search engines and the assistant. You can still preview it.' },
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

const PROJECT_TYPES_GUIDE = [
  { type: 'Case study', button: 'ENTER PROJECT', click: 'Your page /projects/<slug>', fields: 'Objective · Engineering focus · Architecture · Result' },
  { type: 'Article', button: 'READ ARTICLE', click: 'Your page /projects/<slug>', fields: 'Article text' },
  { type: 'Direct link', button: 'OPEN LINK ↗', click: 'Opens the Link in a new tab', fields: '— (no page)' },
];

function ProjectsGuide() {
  const cell = 'border-t border-white/5 px-3 py-2 align-top';
  const note = (
    <p className="mt-3 text-slate-400">Every type shows the title, short description, tech tags and optional cover image on the card, plus “LIVE ↗” / “GITHUB ↗” buttons when those URLs are filled in. Button labels can be changed under Site text → projects. Use <b>Preview ↗</b> to see a project after saving.</p>
  );
  return (
    <>
      {/* Phones: short list, folded by default */}
      <details className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 text-xs leading-6 text-cyan-50 sm:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 font-bold text-cyan-200">How projects appear on the site</summary>
        <div className="space-y-3 px-4 pb-4">
          {PROJECT_TYPES_GUIDE.map((item) => (
            <div key={item.type} className="rounded-lg border border-white/5 p-3 text-slate-300">
              <p className="font-bold text-white">{item.type} <span className="font-normal text-slate-500">· button “{item.button}”</span></p>
              <p>Click: {item.click}</p>
              <p>Page shows: {item.fields}</p>
            </div>
          ))}
          {note}
        </div>
      </details>
      {/* Larger screens: table, open by default */}
      <details className="hidden rounded-xl border border-cyan-300/20 bg-cyan-300/5 text-xs leading-6 text-cyan-50 sm:block" open>
        <summary className="cursor-pointer px-4 py-3 font-bold text-cyan-200">How projects appear on the site</summary>
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full min-w-[560px] text-left">
            <thead className="text-[10px] uppercase tracking-wider text-cyan-300">
              <tr><th className="px-3 py-2">Type</th><th className="px-3 py-2">Card button</th><th className="px-3 py-2">Clicking the card</th><th className="px-3 py-2">Fields used on the page</th></tr>
            </thead>
            <tbody className="text-slate-300">
              {PROJECT_TYPES_GUIDE.map((item) => (
                <tr key={item.type}><td className={cell}><b>{item.type}</b></td><td className={cell}>{item.button}</td><td className={cell}>{item.click}</td><td className={cell}>{item.fields}</td></tr>
              ))}
            </tbody>
          </table>
          {note}
        </div>
      </details>
    </>
  );
}
