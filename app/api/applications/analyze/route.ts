import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, parseBody } from '@/lib/api-utils';
import { requireTab } from '@/lib/auth/roles';
import { analyzeJob } from '@/lib/career/job';
import { JobFetchError, fetchJob } from '@/lib/career/job-fetch';
import { careerEvidence } from '@/lib/career/profile';
import { profileProof } from '@/lib/career/evidence';
import type { JobAnalysis } from '@/lib/career/job';

/** For each skill the job asks for: where your profile proves it (null = nowhere). */
async function proofFor(analysis: JobAnalysis) {
  const profile = await careerEvidence().catch(() => []);
  return Object.fromEntries([...analysis.required, ...analysis.preferred].map((k) => [k.term, profileProof(k.term, profile)?.source ?? null]));
}

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const schema = z.object({
  url: z.string().trim().max(1000).optional(),
  text: z.string().trim().max(30_000).optional(),
}).strict();

/**
 * Job analyzer: reads a job link (or pasted text) and returns the cleaned text plus what it asks for.
 * Nothing is saved here. Body: { url } or { text }.
 */
export async function POST(request: Request) {
  const { error: denied } = await requireTab(request, 'applications');
  if (denied) return denied;
  const { data, error } = await parseBody(request, schema);
  if (error) return error;
  try {
    if (data.url) {
      const job = await fetchJob(data.url);
      const hints = { title: job.title, company: job.company, location: job.location, remote: job.remote, employmentType: job.employmentType };
      const analysis = analyzeJob({ text: job.text, ...hints });
      return NextResponse.json({ url: job.url, text: job.text, source: job.source, hints, analysis, proof: await proofFor(analysis) });
    }
    if (!data.text || data.text.length < 50) return jsonError('Paste a job link, or the full job text (at least a few sentences).', 400);
    const analysis = analyzeJob({ text: data.text });
    return NextResponse.json({ url: '', text: data.text, source: 'pasted', hints: {}, analysis, proof: await proofFor(analysis) });
  } catch (err) {
    if (err instanceof JobFetchError) return jsonError(err.message, err.status);
    console.error(err);
    return jsonError('Could not read that job.', 500);
  }
}
