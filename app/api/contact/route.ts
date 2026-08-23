import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { name?: string; email?: string; message?: string } | null;
  if (!body?.name || !body.email || !body.message) return NextResponse.json({ ok: false, error: 'Missing required fields.' }, { status: 400 });
  return NextResponse.json({ ok: true, message: 'Demo endpoint received the message. Connect this route to your email provider before production.' });
}
