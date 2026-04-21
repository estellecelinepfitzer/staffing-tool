import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import { updateMemberPassword } from '@/lib/db';

function isAdmin() {
  const c = cookies().get(DASHBOARD_COOKIE_NAME);
  return c ? verifySignedToken(c.value) === 'dashboard' : false;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token } = params;
  const body = await request.json() as { password: string };

  if (typeof body.password !== 'string' || body.password.trim() === '') {
    return NextResponse.json({ error: 'password required' }, { status: 400 });
  }

  updateMemberPassword(token, body.password);
  return NextResponse.json({ ok: true });
}
