import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME, hashUserPassword, verifyUserPassword } from '@/lib/auth';
import { getMemberByToken, updateMemberPassword, getUserPasswordHash, setUserPasswordHash } from '@/lib/db';

// POST /api/password — self-service password change (requires active session)
export async function POST(req: NextRequest) {
  const session = cookies().get(COOKIE_NAME);
  const token = session ? verifySignedToken(session.value) : null;

  if (!token) {
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
    return NextResponse.json({ error: 'currentPassword and newPassword required' }, { status: 400 });
  }

  const member = getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const hash = getUserPasswordHash(token);
  let valid = false;
  if (hash) {
    valid = verifyUserPassword(currentPassword, hash);
  } else {
    valid = currentPassword === member.password;
  }

  if (!valid) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const newHash = hashUserPassword(newPassword);
  updateMemberPassword(token, newPassword);
  setUserPasswordHash(token, newHash);
  return NextResponse.json({ ok: true });
}
