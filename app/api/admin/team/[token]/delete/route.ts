import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import { deleteTeamMember } from '@/lib/db';

function isAdmin() {
  const c = cookies().get(DASHBOARD_COOKIE_NAME);
  return c ? verifySignedToken(c.value) === 'dashboard' : false;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  deleteTeamMember(params.token);
  return NextResponse.json({ ok: true });
}
