import { NextRequest, NextResponse } from 'next/server';
import {
  signToken,
  COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  DASHBOARD_COOKIE_NAME,
  verifyUserPassword,
} from '@/lib/auth';
import { getTeamMemberByEmail, getUserPasswordHash } from '@/lib/db';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  const member = getTeamMemberByEmail(email);
  if (!member) {
    await delay(400);
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
  }

  // Verify password: prefer scrypt hash from passwords table, fall back to plain-text
  const hash = getUserPasswordHash(member.token);
  let valid = false;
  if (hash) {
    valid = verifyUserPassword(password, hash);
  } else if (member.password) {
    // Legacy plain-text comparison during transition
    valid = password === member.password;
  }

  if (!valid) {
    await delay(400);
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });

  // Set primary session cookie (for all users)
  res.cookies.set(COOKIE_NAME, signToken(member.token), COOKIE_OPTS);

  // For admins: also set legacy cookies so existing admin checks keep working
  if (member.role === 'admin') {
    res.cookies.set(ADMIN_COOKIE_NAME, signToken('admin'), COOKIE_OPTS);
    res.cookies.set(DASHBOARD_COOKIE_NAME, signToken('dashboard'), COOKIE_OPTS);
  }

  return res;
}
