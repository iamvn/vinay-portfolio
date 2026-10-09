'use client';

import { invalidateApiCache } from './api';

/**
 * Uploads a PDF the way the server expects (lib/assets.ts): start, send 3 MB parts, finish.
 * Parts are retried a couple of times, so a flaky connection doesn't lose a 30 MB upload.
 */
export type UploadedPdf = { id: string; fileName: string; size: number; uploadedAt: string; url: string };

async function call(method: string, url: string, body?: BodyInit, json = true) {
  const response = await fetch(url, { method, body, headers: json && body ? { 'Content-Type': 'application/json' } : body ? { 'Content-Type': 'application/octet-stream' } : undefined });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Upload failed (${response.status}).`);
  return data;
}

export async function uploadPdf(file: File, onProgress?: (fraction: number) => void): Promise<UploadedPdf> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw new Error('Choose a PDF file.');
  const start = await call('POST', '/api/assets', JSON.stringify({ fileName: file.name.endsWith('.pdf') ? file.name : `${file.name}.pdf`, size: file.size, mimeType: 'application/pdf' }));
  onProgress?.(0);
  for (let n = 0; n < start.parts; n++) {
    const part = file.slice(n * start.partBytes, (n + 1) * start.partBytes);
    for (let attempt = 1; ; attempt++) {
      try {
        await call('PUT', `/api/assets/${start.id}/parts/${n}`, part, false);
        break;
      } catch (error) {
        if (attempt >= 3 || /not a PDF|should be/.test(String(error))) throw error;
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
    onProgress?.((n + 1) / start.parts);
  }
  const done = await call('POST', `/api/assets/${start.id}/complete`);
  invalidateApiCache();
  return done;
}

export const formatBytes = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
