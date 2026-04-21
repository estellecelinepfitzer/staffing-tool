import { NextRequest, NextResponse } from 'next/server';
import { signToken, DASHBOARD_COOKIE_NAME } from '@/lib/auth';

// POST /api/auth/dashboard — validate dashboard password, set session cookie
// Password is set via DASHBOARD_PASSWORD env var in Railway
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!password) {
    return NextResponse.json({ error: 'Missing password' }, { status: 400 });
  }

  if (!expected || password !== expected) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  // Session cookie — expires when browser is closed
  res.cookies.set(DASHBOARD_COOKIE_NAME, signToken('dashboard'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return res;
}

// DELETE /api/auth/dashboard — log out of dashboard
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DASHBOARD_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return res;
}
