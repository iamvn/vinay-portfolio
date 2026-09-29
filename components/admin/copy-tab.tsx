'use client';

import { useEffect, useState } from 'react';
import { api, describeError, fromLines, toLines } from './api';
import { Card, Field, Loading, SaveBar, TextArea, TextInput, type Notify } from './ui';

type Json = string | string[] | { [key: string]: Json };

const LABELS: Record<string, string> = {
  header: 'Top bar (4 lines)',
  statsLabels: 'Stats labels (5 lines, in order: years, products, performance, lighthouse, users)',
  terminalLines: 'Terminal lines',
  technologies: 'Hero technology tags',
};

const pretty = (key: string) => LABELS[key] ?? key.replace(/([A-Z])/g, ' $1');

/** Renders any nested site-copy object as a form: strings → inputs, lists → one-per-line textareas. */
function CopyEditor({ value, onChange, name }: { value: Json; onChange: (value: Json) => void; name: string }) {
  if (typeof value === 'string') {
    return (
      <Field label={pretty(name)}>
        {value.length > 60 ? <TextArea value={value} onChange={onChange} rows={2} /> : <TextInput value={value} onChange={onChange} />}
      </Field>
    );
  }
  if (Array.isArray(value)) {
    return (
      <Field label={pretty(name)} hint="One per line">
        <TextArea value={toLines(value)} onChange={(text) => onChange(text.split('\n'))} rows={Math.max(3, value.length)} />
      </Field>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Object.entries(value).map(([key, child]) => (
        <CopyEditor key={key} name={key} value={child} onChange={(next) => onChange({ ...value, [key]: next })} />
      ))}
    </div>
  );
}

/** Lists are edited with raw line breaks; clean them (trim, drop blank lines) before saving. */
function clean(value: Json): Json {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return fromLines(value.join('\n'));
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clean(child)]));
}

export function CopyTab({ notify }: { notify: Notify }) {
  const [saved, setSaved] = useState<Record<string, Json> | null>(null);
  const [copy, setCopy] = useState<Record<string, Json> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Record<string, Json>>('GET', '/api/copy')
      .then((data) => { setSaved(data); setCopy(data); })
      .catch((error) => notify(describeError(error), 'error'));
  }, [notify]);

  if (!copy || !saved) return <Loading />;
  const dirty = JSON.stringify(copy) !== JSON.stringify(saved);

  async function save() {
    setSaving(true);
    try {
      const updated = await api<Record<string, Json>>('PATCH', '/api/copy', clean(copy!));
      setSaved(updated);
      setCopy(updated);
      notify('Site text saved.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  const sections = Object.entries(copy);
  return (
    <div className="space-y-4 sm:space-y-5">
      <p className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-3 text-xs leading-6 text-cyan-100">
        Placeholders are filled in from your profile: <code>{'{years}'}</code> <code>{'{level}'}</code> <code>{'{xp}'}</code> <code>{'{xpMax}'}</code>{' '}
        <code>{'{name}'}</code> <code>{'{role}'}</code> <code>{'{location}'}</code>
      </p>
      {sections.map(([key, value]) => (
        <Card key={key} title={pretty(key)}>
          <CopyEditor name={key} value={value} onChange={(next) => setCopy({ ...copy, [key]: next })} />
        </Card>
      ))}
      <SaveBar dirty={dirty} busy={saving} onSave={save} onReset={() => setCopy(saved)} saveLabel="Save site text" />
    </div>
  );
}
