'use client';

import { useEffect, useState } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Loading, TextArea, type Notify } from './ui';

type ImportResult = { added: string[]; skipped: string[]; failed: string[] };

/** Adds projects from a pasted JSON array. Existing slugs are skipped, never overwritten. */
function ImportProjects({ notify }: { notify: Notify }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function run() {
    let items: unknown;
    try {
      items = JSON.parse(text);
    } catch {
      return notify('That is not valid JSON.', 'error');
    }
    const list = Array.isArray(items) ? items : [items];
    setBusy(true);
    const existing = new Set((await api<{ slug: string }[]>('GET', '/api/projects').catch(() => [])).map((project) => project.slug));
    const outcome: ImportResult = { added: [], skipped: [], failed: [] };
    for (const item of list as { slug?: string; title?: string }[]) {
      const name = item?.title || item?.slug || '(untitled)';
      if (item?.slug && existing.has(item.slug)) { outcome.skipped.push(name); continue; }
      try {
        await api('POST', '/api/projects', item);
        outcome.added.push(name);
      } catch (error) {
        outcome.failed.push(`${name}: ${describeError(error)}`);
      }
    }
    setResult(outcome);
    setBusy(false);
    notify(`Added ${outcome.added.length}, skipped ${outcome.skipped.length}${outcome.failed.length ? `, failed ${outcome.failed.length}` : ''}.`, outcome.failed.length ? 'error' : 'success');
  }

  return (
    <Card title="Add projects from JSON" actions={<Button tone="primary" onClick={run} disabled={busy || !text.trim()}>{busy ? 'Adding…' : 'Add projects'}</Button>}>
      <p className="mb-3 text-xs leading-6 text-slate-400">
        Paste one project or a list of projects (same fields as the Projects tab). Projects whose slug already exists are skipped, so nothing is overwritten.
        Set <code>&quot;published&quot;: false</code> to add something as a hidden draft.
      </p>
      <TextArea value={text} onChange={setText} rows={8} mono placeholder={'[\n  { "slug": "my-project", "title": "…", "description": "…", "stack": ["React"] }\n]'} />
      {result && (
        <ul className="mt-3 space-y-1 text-xs">
          {result.added.map((name) => <li key={`a-${name}`} className="text-lime-200">✓ Added: {name}</li>)}
          {result.skipped.map((name) => <li key={`s-${name}`} className="text-slate-400">– Skipped (already exists): {name}</li>)}
          {result.failed.map((name) => <li key={`f-${name}`} className="text-red-300">✗ {name}</li>)}
        </ul>
      )}
    </Card>
  );
}

export function BackupTab({ notify, onReplaced }: { notify: Notify; onReplaced: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api('GET', '/api/portfolio').then((data) => setText(JSON.stringify(data, null, 2))).catch((error) => notify(describeError(error), 'error'));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  if (text === null) return <Loading />;

  function download() {
    const url = URL.createObjectURL(new Blob([text!], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `portfolio-${new Date().toISOString().slice(0, 10)}.json` });
    link.click();
    URL.revokeObjectURL(url);
  }

  async function replaceAll() {
    let body: unknown;
    try {
      body = JSON.parse(text!);
    } catch {
      return notify('The text is not valid JSON.', 'error');
    }
    setBusy(true);
    try {
      const saved = await api('PUT', '/api/portfolio', body);
      setText(JSON.stringify(saved, null, 2));
      onReplaced();
      notify('Everything was replaced with this JSON.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <ImportProjects notify={notify} />
    <Card
      title="Backup & bulk edit"
      actions={<>
        <Button onClick={load} disabled={busy}>Reload</Button>
        <Button onClick={download} disabled={busy}>Download JSON</Button>
        <ConfirmButton onConfirm={replaceAll} disabled={busy} confirmLabel="Click again: replace everything">Replace everything</ConfirmButton>
      </>}
    >
      <p className="mb-3 text-xs leading-6 text-slate-400">
        This is the whole portfolio (same format as <code>data/portfolio.json</code>). Download it as a backup, or paste a full
        portfolio here and press <b>Replace everything</b>. That overwrites profile, site text, skills, experience and projects. The resume is not affected.
      </p>
      <TextArea value={text} onChange={setText} rows={24} mono />
    </Card>
    </div>
  );
}
