import { NextRequest, NextResponse } from 'next/server';
import { getMemberByToken } from '@/config/team';
import { saveResetCode } from '@/lib/db';
import { randomBytes } from 'crypto';

// POST /api/admin/reset-code — generate a one-time reset code for a team member
// Protected by ADMIN_PASSWORD env var
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const adminPassword = typeof body.adminPassword === 'string' ? body.adminPassword : '';
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  const expectedAdmin = process.env.ADMIN_PASSWORD;
  if (!expectedAdmin || adminPassword !== expectedAdmin) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const member = getMemberByToken(token);
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Generate a readable 8-character uppercase code
  const code = randomBytes(4).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  saveResetCode(token, code, expiresAt);

  return NextResponse.json({
    code,
    member: member.name,
    expiresAt: expiresAt.toISOString(),
    resetUrl: `/forgot?token=${token}`,
  });
}
