import { jsonError } from './api-utils';

export type FileFormat = { mimeType: string; label: string; matches: (bytes: Uint8Array) => boolean };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/** Known formats, checked by their real content ("magic bytes"), not just the file name. */
export const FORMATS = {
  pdf: { mimeType: 'application/pdf', label: 'PDF', matches: (b) => startsWith(b, ascii('%PDF')) },
  docx: {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Word (.docx)',
    matches: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]),
  },
  jpg: { mimeType: 'image/jpeg', label: 'JPEG', matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  png: { mimeType: 'image/png', label: 'PNG', matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  webp: { mimeType: 'image/webp', label: 'WebP', matches: (b) => startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8) },
} satisfies Record<string, FileFormat>;

export type FormatName = keyof typeof FORMATS;

type UploadResult =
  | { file: { fileName: string; mimeType: string; size: number; data: Uint8Array<ArrayBuffer> }; error?: never }
  | { file?: never; error: Response };

/**
 * Reads a multipart upload (field "file") and validates extension, size and content.
 * `allowed` maps accepted extensions to formats, e.g. { pdf: 'pdf', jpeg: 'jpg' }.
 */
export async function readUpload(request: Request, allowed: Record<string, FormatName>, maxBytes: number): Promise<UploadResult> {
  const list = Object.keys(allowed).map((ext) => `.${ext}`).join(', ');
  const form = await request.formData().catch(() => null);
  if (!form) return { error: jsonError('Send the file as multipart/form-data in a field named "file".', 400) };
  const file = form.get('file');
  if (!(file instanceof File)) return { error: jsonError('Missing "file" field.', 400) };

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const formatName = allowed[extension];
  if (!formatName) return { error: jsonError(`Only ${list} files are allowed.`, 415) };
  if (file.size === 0) return { error: jsonError('The file is empty.', 400) };
  if (file.size > maxBytes) return { error: jsonError(`The file is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`, 413) };

  const data = new Uint8Array(await file.arrayBuffer());
  const format = FORMATS[formatName];
  if (!format.matches(data)) return { error: jsonError(`The file content is not a valid ${format.label} file.`, 415) };

  const fileName = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  return { file: { fileName, mimeType: format.mimeType, size: data.length, data } };
}
