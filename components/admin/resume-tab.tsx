'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, describeError } from './api';
import { Button, Card, ConfirmButton, Loading, type Notify } from './ui';

type ResumeMeta = { fileName: string; mimeType: string; size: number; uploadedAt: string };

const MAX_BYTES = 4 * 1024 * 1024;
const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export function ResumeTab({ notify }: { notify: Notify }) {
  const [meta, setMeta] = useState<ResumeMeta | null | undefined>(undefined); // undefined = loading, null = none
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    api<ResumeMeta>('GET', '/api/resume?meta=1')
      .then(setMeta)
      .catch((error) => (error instanceof ApiError && error.status === 404 ? setMeta(null) : notify(describeError(error), 'error')));
  }, [notify]);

  useEffect(load, [load]);

  async function upload(file: File) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'pdf' && extension !== 'docx') return notify('Only .pdf and .docx files are allowed.', 'error');
    if (file.size > MAX_BYTES) return notify('The file is larger than 4 MB.', 'error');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      setMeta(await api<ResumeMeta>('POST', '/api/resume', form));
      notify(`Uploaded ${file.name}.`);
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api('DELETE', '/api/resume');
      setMeta(null);
      notify('Resume deleted.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (meta === undefined) return <Loading />;

  return (
    <Card title="Resume">
      {meta ? (
        <div className="mb-5 rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
          <p className="font-bold text-white">{meta.fileName}</p>
          <p className="mt-1 text-xs text-slate-400">
            {meta.mimeType === 'application/pdf' ? 'PDF' : 'Word (.docx)'} · {formatSize(meta.size)} · uploaded {new Date(meta.uploadedAt).toLocaleString()}
          </p>
        </div>
      ) : (
        <p className="mb-5 text-sm text-slate-400">No resume uploaded yet. The site&apos;s &quot;Download resume&quot; button will not work until you upload one.</p>
      )}

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) upload(file); }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-lime-300/40 bg-lime-300/5 px-4 py-10 text-center text-sm text-slate-300 hover:bg-lime-300/10"
      >
        <span className="font-bold text-lime-200">{busy ? 'Uploading…' : meta ? 'Replace resume' : 'Upload resume'}</span>
        <span className="text-xs text-slate-500">Click or drop a file · .pdf or .docx · max 4 MB</span>
        <input
          ref={input}
          type="file"
          className="hidden"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={busy}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }}
        />
      </label>

      {meta && (
        <div className="mt-4 flex gap-2">
          <a href="/api/resume" className="rounded-lg border border-white/15 px-3.5 py-2 text-xs font-black uppercase tracking-wide text-slate-200 hover:border-cyan-300/60">Download</a>
          <ConfirmButton onConfirm={remove} disabled={busy}>Delete</ConfirmButton>
        </div>
      )}
      {!meta && <div className="mt-4"><Button onClick={() => input.current?.click()} disabled={busy}>Choose file</Button></div>}
    </Card>
  );
}
