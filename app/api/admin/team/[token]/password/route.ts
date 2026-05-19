import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { updateMemberPassword, setUserPasswordHash } from '@/lib/db';
import { hashUserPassword } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token } = params;
  const body = await request.json() as { password: string };

  if (typeof body.password !== 'string' || body.password.trim() === '') {
    return NextResponse.json({ error: 'password required' }, { status: 400 });
  }

  updateMemberPassword(token, body.password);
  setUserPasswordHash(token, hashUserPassword(body.password));
  return NextResponse.json({ ok: true });
}
