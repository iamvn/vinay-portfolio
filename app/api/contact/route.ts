import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/api-utils';

const contactSchema = z.object({
  name: z.string().trim().min(1, 'must not be empty'),
  email: z.email('must be a valid email address'),
  message: z.string().trim().min(1, 'must not be empty').max(5000),
});

/** Demo only: validates the message but does not send an email yet. */
export async function POST(request: Request) {
  const { error } = await parseBody(request, contactSchema);
  if (error) return error;
  return NextResponse.json({ ok: true, message: 'Demo endpoint received the message. Connect this route to your email provider before production.' });
}
