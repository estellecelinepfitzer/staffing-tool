import { NextRequest, NextResponse } from 'next/server';
import { getMemberByToken } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { consumeResetCode, setPasswordHash } from '@/lib/db';

// POST /api/password/reset — reset password using a one-time code
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!token || !code || !newPassword) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const member = getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
  }

  const valid = consumeResetCode(token, code);
  if (!valid) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Invalid or expired reset code' }, { status: 401 });
  }

  setPasswordHash(token, hashPassword(newPassword));
  return NextResponse.json({ ok: true });
}
