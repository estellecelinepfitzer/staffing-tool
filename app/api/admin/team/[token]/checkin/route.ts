import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import { setMemberCheckin } from '@/lib/db';

function isAdmin() {
  const c = cookies().get(DASHBOARD_COOKIE_NAME);
  return c ? verifySignedToken(c.value) === 'dashboard' : false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { checkin: boolean };
  setMemberCheckin(params.token, !!body.checkin);
  return NextResponse.json({ ok: true });
}
