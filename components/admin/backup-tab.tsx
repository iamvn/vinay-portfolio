'use client';

import { useEffect, useState } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Loading, TextArea, type Notify } from './ui';

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
  );
}
