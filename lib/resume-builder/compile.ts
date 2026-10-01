import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';

/**
 * Compiles resume Typst code on the server (Typst runs inside the app: no external service, ~0.3 s).
 * Fonts: Typst's built-in ones (New Computer Modern, Libertinus Serif, DejaVu Sans Mono) plus Inter
 * from assets/fonts. File access is limited to an empty temporary folder.
 */
export const MAX_SOURCE_LENGTH = 200_000;

let compiler: NodeCompiler | null = null;
let workspace = '';

function getCompiler() {
  if (compiler) return compiler;
  workspace = mkdtempSync(join(tmpdir(), 'resume-'));
  const fontDir = join(process.cwd(), 'assets', 'fonts');
  let fontBlobs: Buffer[] = [];
  try {
    fontBlobs = readdirSync(fontDir).filter((file) => /\.(ttf|otf)$/i.test(file)).map((file) => readFileSync(join(fontDir, file)));
  } catch {
    console.warn('Resume builder: assets/fonts not found; only the built-in fonts are available.');
  }
  compiler = NodeCompiler.create({ workspace, fontArgs: [{ fontBlobs }] });
  return compiler;
}

export type CompileProblem = { message: string; line: number | null; severity: 'error' | 'warning' };
export type CompileResult =
  | { ok: true; pages: number; svg?: string; pdf?: Buffer; warnings: CompileProblem[] }
  | { ok: false; errors: CompileProblem[] };

type Diagnostic = { message?: string; severity?: number; range?: { start?: { line?: number } } | null };

/** Compiles `source`. Ask for `svg` (preview), `pdf` (download), or both. */
export function compileTypst(source: string, output: { svg?: boolean; pdf?: boolean }): CompileResult {
  if (source.length > MAX_SOURCE_LENGTH) return { ok: false, errors: [{ message: 'The code is too long.', line: null, severity: 'error' }] };
  const typst = getCompiler();
  const mainFilePath = join(workspace, 'main.typ');
  typst.addSource(mainFilePath, source);
  try {
    const result = typst.compile({ mainFilePath });
    const problems = (diagnostics: ReturnType<typeof result.takeDiagnostics>): CompileProblem[] => {
      if (!diagnostics) return [];
      let full: Diagnostic[] = [];
      try { full = typst.fetchDiagnostics(diagnostics) as Diagnostic[]; } catch { full = diagnostics.shortDiagnostics as Diagnostic[]; }
      return full.map((item) => ({
        message: String(item.message ?? 'Unknown problem'),
        line: typeof item.range?.start?.line === 'number' ? item.range.start.line + 1 : null,
        severity: item.severity === 1 ? 'error' : 'warning',
      }));
    };
    const document = result.result;
    if (!document || result.hasError()) {
      const errors = problems(result.takeDiagnostics()).filter((item) => item.severity === 'error');
      return { ok: false, errors: errors.length ? errors : [{ message: 'The code could not be compiled.', line: null, severity: 'error' }] };
    }
    const warnings = problems(result.takeWarnings());
    return {
      ok: true,
      pages: document.numOfPages,
      svg: output.svg ? typst.svg(document) : undefined,
      pdf: output.pdf ? typst.pdf(document) : undefined,
      warnings,
    };
  } finally {
    typst.evictCache(30);
  }
}
