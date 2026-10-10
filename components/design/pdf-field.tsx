'use client';

import { FieldLabel } from '@puckeditor/core';
import { useEffect, useRef, useState } from 'react';
import { formatBytes, uploadPdf, type UploadedPdf } from '@/components/admin/upload-pdf';

/**
 * Settings-panel field for picking a PDF (Admin → Design PDF block, Admin → Projects): upload a new one,
 * or reuse one uploaded before. The value is the document's address (/api/files/<id>/<name>).
 */
export function PdfField({ value, onChange, readOnly = false, label = 'PDF file', dark = false }: { value: string; onChange: (url: string) => void; readOnly?: boolean; label?: string; dark?: boolean }) {
  const [files, setFiles] = useState<UploadedPdf[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const load = () => fetch('/api/assets').then((r) => (r.ok ? r.json() : null)).then((data) => setFiles(data?.assets ?? [])).catch(() => setFiles([]));
  useEffect(() => { load(); }, []);

  const current = files?.find((f) => f.url === value) ?? null;
  async function pick(file: File | undefined) {
    if (!file) return;
    setError('');
    setProgress(0);
    try {
      const uploaded = await uploadPdf(file, setProgress);
      setFiles((list) => [uploaded, ...(list ?? []).filter((f) => f.id !== uploaded.id)]);
      onChange(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <div className={`rounded-md border p-2.5 ${dark ? 'border-white/10 bg-black/20 text-slate-200' : 'border-slate-200 bg-slate-50'}`}>
        {value ? (
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded bg-red-600 text-[10px] font-bold text-white">PDF</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{current?.fileName ?? decodeURIComponent(value.split('/').pop() ?? 'Document')}</span>
              <span className="text-xs text-slate-500">{current ? formatBytes(current.size) : files === null ? '…' : 'Not found: upload it again'}</span>
            </span>
            {!readOnly && <button type="button" onClick={() => onChange('')} className="text-xs font-semibold text-slate-500 hover:text-red-600">Remove</button>}
          </div>
        ) : <span className="text-xs text-slate-500">No PDF chosen yet.</span>}
      </div>

      {!readOnly && (
        <>
          <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label={`Upload ${label}`} onChange={(e) => pick(e.target.files?.[0])} />
          <button type="button" disabled={progress !== null} onClick={() => input.current?.click()}
            className={`flex h-9 w-full items-center justify-center rounded-md border px-3 text-xs font-semibold disabled:opacity-60 ${dark ? 'border-white/15 bg-transparent text-slate-200 hover:border-lime-300/60' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}>
            {progress !== null ? `Uploading… ${Math.round(progress * 100)}%` : value ? 'Upload a different PDF' : 'Upload PDF (up to 40 MB)'}
          </button>
          {progress !== null && (
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
              <div className="h-full bg-sky-600 transition-all" style={{ width: `${Math.max(4, progress * 100)}%` }} />
            </div>
          )}
          {!!files?.length && (
            <select aria-label="Use an uploaded PDF" value={current ? current.url : ''} onChange={(e) => e.target.value && onChange(e.target.value)}
              className={`h-9 w-full rounded-md border px-2 text-xs ${dark ? 'border-white/15 bg-slate-950 text-slate-200' : 'border-slate-300 bg-white'}`}>
              <option value="">Or use one you uploaded before…</option>
              {files.map((f) => <option key={f.id} value={f.url}>{f.fileName} · {formatBytes(f.size)}</option>)}
            </select>
          )}
          {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}

/** The field with its label, for the editor's settings panel. */
export function PdfSettingsField(props: { value: string; onChange: (url: string) => void; readOnly?: boolean }) {
  return (
    <FieldLabel label="PDF file" el="div" readOnly={props.readOnly}>
      <PdfField {...props} />
    </FieldLabel>
  );
}
