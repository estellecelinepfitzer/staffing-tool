import { NextRequest, NextResponse } from 'next/server';
import { signToken, COOKIE_NAME } from '@/lib/auth';
import { getMemberByToken } from '@/lib/db';

// POST /api/auth — validate member password, set session cookie
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!token || !password) {
    return NextResponse.json({ error: 'token and password required' }, { status: 400 });
  }

  const member = getMemberByToken(token);
  if (!member) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  if (password !== member.password) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, signToken(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return res;
}
