import { NextRequest, NextResponse } from 'next/server';
import { getMemberByEmail, saveResetCode } from '@/lib/db';
import { sendResetCode } from '@/lib/email';
import { randomBytes } from 'crypto';

// POST /api/password/forgot — look up member by email, send reset code
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // Always return success to avoid leaking which emails are registered
  const member = getMemberByEmail(email);
  if (member) {
    const code = randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    saveResetCode(member.token, code, expiresAt);

    const baseUrl = req.nextUrl.origin;
    await sendResetCode({
      to:       member.email,
      firstName: member.name.split(' ')[0],
      code,
      resetUrl: `${baseUrl}/forgot?token=${member.token}`,
    });
  }

  return NextResponse.json({ ok: true });
}
