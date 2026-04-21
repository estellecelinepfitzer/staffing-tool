import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import { updateManagerToken } from '@/lib/db';

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
  const body = await request.json() as { manager_token: string };

  if (typeof body.manager_token !== 'string') {
    return NextResponse.json({ error: 'manager_token required' }, { status: 400 });
  }

  updateManagerToken(token, body.manager_token);
  return NextResponse.json({ ok: true });
}
