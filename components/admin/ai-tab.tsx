'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Field, Loading, PasswordInput, TextInput, Toggle, inputClass, type Notify } from './ui';

type Kind = 'anthropic' | 'openai' | 'openai-compatible';
type Preset = { id: string; label: string; kind: Kind; baseUrl: string; model: string; docs: string };
type Provider = {
  id: number; name: string; kind: Kind; baseUrl: string; model: string;
  keyHint: string; keyStatus: 'ok' | 'missing' | 'unreadable'; enabled: boolean; order: number;
  temperature: number | null; createdAt: string;
};
type Settings = { enabled: boolean; dailyLimit: number; visitorLimit: number; maxTokens: number };
type ProvidersResponse = { providers: Provider[]; presets: Preset[]; environmentFallback: boolean };

const KIND_LABEL: Record<Kind, string> = {
  anthropic: 'Anthropic Messages API',
  openai: 'OpenAI Chat Completions',
  'openai-compatible': 'OpenAI-compatible',
};

/* ---------- Settings ---------- */

function NumberField({ label, hint, value, onChange, min, max }: { label: string; hint: string; value: number; onChange: (value: number) => void; min: number; max: number }) {
  return (
    <Field label={label} hint={hint}>
      <input type="number" inputMode="numeric" min={min} max={max} className={inputClass} value={Number.isNaN(value) ? '' : value} onChange={(e) => onChange(e.target.valueAsNumber)} />
    </Field>
  );
}

function SettingsCard({ notify, hasProvider }: { notify: Notify; hasProvider: boolean }) {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Settings>('GET', '/api/ai/settings')
      .then((data) => { setSaved(data); setForm(data); })
      .catch((error) => notify(describeError(error), 'error'));
  }, [notify]);

  if (!form || !saved) return <Card title="Assistant settings"><Loading /></Card>;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm({ ...form, [key]: value });

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      const next = await api<Settings>('PATCH', '/api/ai/settings', form);
      setSaved(next); setForm(next);
      notify('Assistant settings saved. The site picks them up within a minute.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  const live = saved.enabled && hasProvider;
  return (
    <Card
      title="Assistant settings"
      actions={<span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${live ? 'bg-lime-300/15 text-lime-200' : 'bg-white/5 text-slate-400'}`}>{live ? '● Live on site' : '○ Hidden on site'}</span>}
    >
      <Toggle checked={form.enabled} onChange={(value) => set('enabled', value)} label="Show “Ask AI” on the site" />
      {!hasProvider && <p className="mt-1 text-xs text-yellow-300/90">Add at least one provider below with a working key, or the button stays hidden.</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <NumberField label="Questions per day" hint="All visitors together. Keeps the bill predictable." value={form.dailyLimit} onChange={(v) => set('dailyLimit', v)} min={1} max={10000} />
        <NumberField label="Per visitor / 10 min" hint="Stops one person from spamming it." value={form.visitorLimit} onChange={(v) => set('visitorLimit', v)} min={1} max={100} />
        <NumberField label="Max answer length" hint="In tokens (≈ ¾ word each). Raise for reasoning models." value={form.maxTokens} onChange={(v) => set('maxTokens', v)} min={100} max={4000} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={() => setForm(saved)} disabled={busy || !dirty}>Reset</Button>
        <Button tone="primary" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save settings'}</Button>
      </div>
    </Card>
  );
}

/* ---------- Provider form (add + edit) ---------- */

type Draft = { name: string; kind: Kind; baseUrl: string; model: string; apiKey: string; temperature: string; enabled: boolean };

function ProviderForm({ presets, initial, onSubmit, onCancel, submitLabel }: {
  presets: Preset[];
  initial?: Provider;
  onSubmit: (draft: Draft) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [presetId, setPresetId] = useState(initial ? '' : presets[0]?.id ?? 'custom');
  const preset = presets.find((p) => p.id === presetId);
  const [draft, setDraft] = useState<Draft>(() => initial
    ? { name: initial.name, kind: initial.kind, baseUrl: initial.baseUrl, model: initial.model, apiKey: '', temperature: initial.temperature === null ? '' : String(initial.temperature), enabled: initial.enabled }
    : { name: presets[0]?.label ?? '', kind: presets[0]?.kind ?? 'openai-compatible', baseUrl: presets[0]?.baseUrl ?? '', model: presets[0]?.model ?? '', apiKey: '', temperature: '', enabled: true });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  function pickPreset(id: string) {
    setPresetId(id);
    const next = presets.find((p) => p.id === id);
    if (next) setDraft((d) => ({ ...d, name: next.id === 'custom' ? '' : next.label, kind: next.kind, baseUrl: next.baseUrl, model: next.model }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try { await onSubmit(draft); } finally { setBusy(false); }
  }

  const docs = preset?.docs;
  const needsKey = !initial;
  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-cyan-300/20 bg-black/30 p-4">
      {!initial && (
        <Field label="Service" hint="Fills in the address and a suggested model. You can change anything afterwards.">
          <select className={inputClass} value={presetId} onChange={(e) => pickPreset(e.target.value)}>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" hint="Only shown here."><TextInput value={draft.name} onChange={(v) => set('name', v)} placeholder="e.g. OpenAI backup" /></Field>
        <Field label="API format">
          <select className={inputClass} value={draft.kind} onChange={(e) => set('kind', e.target.value as Kind)}>
            {(Object.keys(KIND_LABEL) as Kind[]).map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}
          </select>
        </Field>
        <Field label="Base URL" hint={draft.kind === 'anthropic' ? 'Leave empty for https://api.anthropic.com' : 'Ends before /chat/completions, e.g. https://api.openai.com/v1'}>
          <input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={inputClass} value={draft.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Model" hint={docs ? 'Copy the exact model id from the provider’s model list (link below).' : 'The exact model id.'}>
          <input autoCapitalize="none" autoCorrect="off" spellCheck={false} className={inputClass} value={draft.model} onChange={(e) => set('model', e.target.value)} placeholder="model id" />
        </Field>
        <Field label={initial ? 'API key (leave empty to keep the saved one)' : 'API key'} hint={initial ? `Saved key: ${initial.keyHint || 'none'}. Stored encrypted; never shown again.` : 'Stored encrypted; never shown again after saving.'}>
          <PasswordInput value={draft.apiKey} onChange={(v) => set('apiKey', v)} autoComplete="off" placeholder={initial ? '••••••••' : 'sk-…'} />
        </Field>
        <Field label="Temperature (optional)" hint="0 = focused, 1 = creative. Empty uses the model’s default (some models only accept the default).">
          <input type="number" inputMode="decimal" step="0.1" min={0} max={2} className={inputClass} value={draft.temperature} onChange={(e) => set('temperature', e.target.value)} placeholder="default" />
        </Field>
      </div>
      <Toggle checked={draft.enabled} onChange={(v) => set('enabled', v)} label="Enabled" />
      {docs && <p className="text-xs"><a href={docs} target="_blank" rel="noreferrer" className="text-cyan-300 underline-offset-2 hover:underline">Model list for {preset?.label} ↗</a></p>}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button tone="primary" type="submit" disabled={busy || !draft.name.trim() || !draft.model.trim() || (needsKey && !draft.apiKey.trim())}>{busy ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  );
}

function draftToBody(draft: Draft, includeEmptyKey: boolean) {
  const temperature = draft.temperature.trim() === '' ? null : Number(draft.temperature);
  const body: Record<string, unknown> = {
    name: draft.name.trim(), kind: draft.kind, baseUrl: draft.baseUrl.trim(), model: draft.model.trim(),
    enabled: draft.enabled, temperature,
  };
  if (draft.apiKey.trim() || includeEmptyKey) body.apiKey = draft.apiKey.trim();
  return body;
}

const hostOf = (url: string) => { try { return url ? new URL(url).host : 'api.anthropic.com'; } catch { return url; } };

/* ---------- One provider row ---------- */

function ProviderRow({ provider, index, total, presets, onChanged, onMove, notify }: {
  provider: Provider; index: number; total: number; presets: Preset[];
  onChanged: () => void; onMove: (from: number, to: number) => void; notify: Notify;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);

  async function runTest() {
    setBusy(true); setTest(null);
    try {
      const result = await api<{ ok: boolean; answer?: string; ms?: number; error?: string }>('POST', `/api/ai/providers/${provider.id}/test`);
      setTest(result.ok ? { ok: true, text: `Works (${((result.ms ?? 0) / 1000).toFixed(1)}s): “${result.answer}”` } : { ok: false, text: result.error ?? 'Test failed.' });
    } catch (error) {
      setTest({ ok: false, text: describeError(error) });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(enabled: boolean) {
    setBusy(true);
    try {
      await api('PATCH', `/api/ai/providers/${provider.id}`, { enabled });
      notify(`${provider.name} ${enabled ? 'enabled' : 'disabled'}.`);
      onChanged();
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api('DELETE', `/api/ai/providers/${provider.id}`);
      notify(`Removed ${provider.name}. Its key was deleted.`);
      onChanged();
    } catch (error) {
      notify(describeError(error), 'error');
      setBusy(false);
    }
  }

  async function save(draft: Draft) {
    try {
      await api('PATCH', `/api/ai/providers/${provider.id}`, draftToBody(draft, false));
      notify(`${draft.name} saved.`);
      setEditing(false);
      setTest(null);
      onChanged();
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  const keyBadge = provider.keyStatus === 'ok'
    ? <span className="text-slate-400">Key {provider.keyHint}</span>
    : <span className="text-red-300">{provider.keyStatus === 'missing' ? 'No key' : 'Key unreadable: enter it again'}</span>;

  return (
    <li className="py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex items-center gap-3 sm:pt-0.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5 font-mono text-xs font-black text-lime-300" title="Fallback order">{index + 1}</span>
          <div className="min-w-0 sm:hidden">
            <p className="truncate text-sm font-bold text-white">{provider.name}{!provider.enabled && <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-400">Off</span>}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="hidden truncate text-sm font-bold text-white sm:block">
            {provider.name}
            {!provider.enabled && <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-400">Off</span>}
          </p>
          <p className="break-all font-mono text-xs text-cyan-200">{provider.model}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{KIND_LABEL[provider.kind]} · {hostOf(provider.baseUrl)} · {keyBadge}{provider.temperature !== null && ` · temp ${provider.temperature}`}</p>
          {test && <p className={`mt-2 rounded-lg border px-3 py-2 text-xs ${test.ok ? 'border-lime-300/30 bg-lime-300/5 text-lime-100' : 'border-red-400/30 bg-red-500/5 text-red-200'}`}>{test.text}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button onClick={runTest} disabled={busy}>{busy && !editing ? '…' : 'Test'}</Button>
          <Button onClick={() => setEditing((e) => !e)} disabled={busy}>{editing ? 'Close' : 'Edit'}</Button>
          <Button onClick={() => toggle(!provider.enabled)} disabled={busy}>{provider.enabled ? 'Disable' : 'Enable'}</Button>
          <Button onClick={() => onMove(index, index - 1)} disabled={busy || index === 0} label="Try earlier">↑</Button>
          <Button onClick={() => onMove(index, index + 1)} disabled={busy || index === total - 1} label="Try later">↓</Button>
          <ConfirmButton onConfirm={remove} disabled={busy} confirmLabel="Tap to delete">Delete</ConfirmButton>
        </div>
      </div>
      {editing && (
        <div className="mt-3">
          <ProviderForm presets={presets} initial={provider} submitLabel="Save changes" onSubmit={save} onCancel={() => setEditing(false)} />
        </div>
      )}
    </li>
  );
}

/* ---------- Tab ---------- */

export function AiTab({ notify }: { notify: Notify }) {
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api<ProvidersResponse>('GET', '/api/ai/providers')
      .then(setData)
      .catch((error) => notify(describeError(error), 'error'));
  }, [notify]);
  useEffect(load, [load]);

  if (!data) return <Loading />;
  const providers = data.providers;
  const usable = providers.some((p) => p.enabled && p.keyStatus === 'ok') || data.environmentFallback;

  async function add(draft: Draft) {
    try {
      const created = await api<Provider>('POST', '/api/ai/providers', draftToBody(draft, true));
      notify(`Added ${created.name}. Press Test to check the key and model.`);
      setAdding(false);
      load();
    } catch (error) {
      notify(describeError(error), 'error');
    }
  }

  async function move(from: number, to: number) {
    if (to < 0 || to >= providers.length) return;
    const ids = providers.map((p) => p.id);
    [ids[from], ids[to]] = [ids[to], ids[from]];
    setData({ ...data!, providers: ids.map((id) => providers.find((p) => p.id === id)!) });
    try {
      const updated = await api<Provider[]>('PUT', '/api/ai/providers/reorder', { ids });
      setData((current) => current && { ...current, providers: updated });
    } catch (error) {
      notify(describeError(error), 'error');
      load();
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <SettingsCard notify={notify} hasProvider={usable} />

      <Card
        title="AI providers"
        actions={!adding && <Button tone="primary" onClick={() => setAdding(true)}>+ Add provider</Button>}
      >
        <p className="mb-3 text-sm text-slate-400">
          “Ask AI” tries these from top to bottom: if one fails (bad key, out of credit, down), the next one answers.
          Add as many as you like: Anthropic, OpenAI, Gemini, Groq, OpenRouter, Mistral, DeepSeek or any OpenAI-compatible service.
        </p>

        {data.environmentFallback && (
          <p className="mb-3 rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs text-cyan-100">
            Currently using <code>ANTHROPIC_API_KEY</code> from the Vercel environment. Once you add a provider here, this list is used instead.
          </p>
        )}

        {adding && <div className="mb-4"><ProviderForm presets={data.presets} submitLabel="Add provider" onSubmit={add} onCancel={() => setAdding(false)} /></div>}

        {providers.length === 0 ? (
          !adding && <p className="py-6 text-center text-sm text-slate-500">No providers yet. Add one to turn on “Ask AI”.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {providers.map((provider, index) => (
              <ProviderRow key={provider.id} provider={provider} index={index} total={providers.length} presets={data.presets} onChanged={load} onMove={move} notify={notify} />
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-slate-500">
          Keys are encrypted with your <code>AUTH_SECRET</code> before they are stored. If you change <code>AUTH_SECRET</code>, enter the keys again.
        </p>
      </Card>
    </div>
  );
}
