import { NextRequest, NextResponse } from 'next/server';
import { getMemberByToken } from '@/config/team';
import { signToken, COOKIE_NAME, MAX_AGE_SECONDS } from '@/lib/auth';

// POST /api/auth — validate password, set session cookie
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
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const member = getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  }

  if (password !== member.password) {
    // Small delay to slow down brute-force attempts
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, signToken(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });
  return res;
}

// DELETE /api/auth — clear session cookie (log out)
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return res;
}
