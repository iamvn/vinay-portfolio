import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/server';
import { canUseTab, isReadOnly } from '@/lib/auth/permissions';
import { getResume } from '@/lib/resume-builder/store';
import { ResumeEditor } from '@/components/resume-builder/editor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Resume builder', robots: { index: false, follow: false } };

/** Full-screen resume editor: form or code on the left, live PDF preview on the right. */
export default async function ResumeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/admin/resume-builder/${id}`);
  if (!canUseTab(user, 'builder')) redirect('/admin');
  const resumeId = Number(id);
  const resume = Number.isInteger(resumeId) && resumeId > 0 ? await getResume(resumeId) : null;
  if (!resume) notFound();
  return <ResumeEditor initial={resume} readOnly={isReadOnly(user)} />;
}
