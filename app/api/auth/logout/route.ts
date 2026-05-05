import { NextResponse } from 'next/server';
import { COOKIE_NAME, ADMIN_COOKIE_NAME, DASHBOARD_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
  res.cookies.set(ADMIN_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  res.cookies.set(DASHBOARD_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
  res.cookies.set(ADMIN_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  res.cookies.set(DASHBOARD_COOKIE_NAME, '', { maxAge: 0, path: '/' });
  return res;
}
