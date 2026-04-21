import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMemberByToken } from '@/lib/db';
import { verifySignedToken, hashPassword, COOKIE_NAME } from '@/lib/auth';
import { getPasswordHash, setPasswordHash } from '@/lib/db';

function resolvePasswordHash(token: string): string | null {
  const dbHash = getPasswordHash(token);
  if (dbHash) return dbHash;
  const envKey = `PASSWORD_${token.toUpperCase().replace(/-/g, '_')}`;
  const envPassword = process.env[envKey];
  return envPassword ? hashPassword(envPassword) : null;
}

// POST /api/password — change password (must be logged in)
export async function POST(req: NextRequest) {
  // Verify session cookie
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const sessionToken = session ? verifySignedToken(session.value) : null;
  if (!sessionToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const member = getMemberByToken(sessionToken);
  if (!member) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const expectedHash = resolvePasswordHash(sessionToken);
  if (!expectedHash || hashPassword(currentPassword) !== expectedHash) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  setPasswordHash(sessionToken, hashPassword(newPassword));
  return NextResponse.json({ ok: true });
}
