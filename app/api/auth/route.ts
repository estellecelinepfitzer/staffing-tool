import { NextRequest, NextResponse } from 'next/server';
import { getMemberByToken } from '@/lib/db';
import { signToken, hashPassword, COOKIE_NAME } from '@/lib/auth';
import { getPasswordHash } from '@/lib/db';

// Resolve the expected password hash for a member.
// Priority: 1) hashed password stored in DB (set via self-service change)
//           2) plain-text env var PASSWORD_<TOKEN> (set in Railway)
function resolvePasswordHash(token: string): string | null {
  // Check DB first (self-service changed passwords)
  const dbHash = getPasswordHash(token);
  if (dbHash) return dbHash;

  // Fall back to env var
  const envKey = `PASSWORD_${token.toUpperCase().replace(/-/g, '_')}`;
  const envPassword = process.env[envKey];
  if (envPassword) return hashPassword(envPassword);

  return null; // No password configured — login blocked
}

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

  const expectedHash = resolvePasswordHash(token);
  if (!expectedHash || hashPassword(password) !== expectedHash) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  // Session expires when browser closes (no maxAge)
  res.cookies.set(COOKIE_NAME, signToken(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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
