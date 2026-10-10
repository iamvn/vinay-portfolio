import type { ComponentConfig } from '@puckeditor/core';
import { assetIdFrom } from '@/lib/assets-url';
import { PdfSettingsField } from './pdf-field';
import { PdfViewer, type PdfMode } from './pdf-viewer';

/**
 * "PDF document" block for Admin → Design: an uploaded PDF shown in an interactive viewer (or as a cover
 * card that opens it). On project pages it can show the current project's PDF instead.
 */
export type PdfProps = {
  source: 'file' | 'project';
  file: string;
  title: string;
  display: 'embed' | 'cover';
  mode: PdfMode;
  height: number;
  thumbnails: boolean;
  download: boolean;
  coverLabel: string;
};

/** Only this site's uploaded documents can be shown (no outside URLs). */
export const safePdfUrl = (value: unknown) => (typeof value === 'string' && assetIdFrom(value) ? value : '');

type ProjectPdf = { pdf?: string; title?: string };
const yes = [{ value: true, label: 'Yes' }, { value: false, label: 'No' }];

export const PdfBlock: ComponentConfig<PdfProps> = {
  label: 'PDF document',
  fields: {
    source: { type: 'radio', label: 'Document', options: [{ value: 'file', label: 'A PDF I upload' }, { value: 'project', label: 'This project’s PDF' }] },
    file: {
      type: 'custom',
      label: 'PDF file',
      render: ({ value, onChange, readOnly }) => <PdfSettingsField value={typeof value === 'string' ? value : ''} onChange={onChange} readOnly={readOnly} />,
    },
    title: { type: 'text', label: 'Title (shown in the viewer, read by screen readers)' },
    display: { type: 'radio', label: 'Show as', options: [{ value: 'embed', label: 'Viewer on the page' }, { value: 'cover', label: 'Cover that opens it' }] },
    mode: { type: 'select', label: 'Pages', options: [{ value: 'single', label: 'One page at a time' }, { value: 'spread', label: 'Two pages side by side (book)' }, { value: 'scroll', label: 'Scroll through all pages' }] },
    height: { type: 'number', label: 'Viewer height (px, 0 = automatic)', min: 0, max: 1600 },
    thumbnails: { type: 'radio', label: 'Page thumbnails button', options: yes },
    download: { type: 'radio', label: 'Let visitors download it', options: yes },
    coverLabel: { type: 'text', label: 'Cover button text' },
  },
  defaultProps: { source: 'file', file: '', title: 'Portfolio', display: 'embed', mode: 'single', height: 0, thumbnails: true, download: false, coverLabel: 'View portfolio' },
  // Only the settings that matter for the current choices.
  resolveFields: (data, { fields, metadata }) => {
    // "This project's PDF" only means something when designing project pages.
    const onProjectPage = Boolean((metadata as { project?: unknown } | undefined)?.project);
    const hide = new Set<string>([
      onProjectPage ? '' : 'source',
      data.props.source === 'project' && onProjectPage ? 'file' : '',
      data.props.display === 'cover' ? 'height' : 'coverLabel',
    ]);
    return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, hide.has(key) ? { ...field, visible: false } : field])) as typeof fields;
  },
  render: ({ source, file, title, display, mode, height, thumbnails, download, coverLabel, puck }) => {
    const project = (puck.metadata as { project?: ProjectPdf } | undefined)?.project;
    const url = source === 'project' && project ? safePdfUrl(project.pdf) : safePdfUrl(file);
    if (!url) {
      if (!puck.isEditing) return <></>;
      return (
        <div className="d-prim d-placeholder" style={{ minHeight: 160 }}>
          {source === 'project' ? 'This project has no PDF yet: add one in Admin → Projects.' : 'Upload a PDF in the settings panel.'}
        </div>
      );
    }
    return (
      <div className="d-prim">
        <PdfViewer url={url} title={title || (source === 'project' ? project?.title : '') || 'PDF document'} display={display} mode={mode}
          height={Math.max(0, Math.min(1600, Number(height) || 0))} thumbnails={thumbnails} download={download} coverLabel={coverLabel} />
      </div>
    );
  },
};
