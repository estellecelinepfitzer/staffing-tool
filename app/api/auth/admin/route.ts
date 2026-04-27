import { NextRequest, NextResponse } from 'next/server';
import { signToken, ADMIN_COOKIE_NAME } from '@/lib/auth';
import { getAdminPasswordOverride } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const password = typeof body.password === 'string' ? body.password : '';
  const override = getAdminPasswordOverride();
  const expected = override ?? process.env.ADMIN_PASSWORD;

  if (!expected || password !== expected) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, signToken('admin'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return res;
}
