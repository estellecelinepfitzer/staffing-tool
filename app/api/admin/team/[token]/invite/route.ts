import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import { getTeamMember } from '@/lib/db';
import { sendInvitation } from '@/lib/email';

function isAdmin() {
  const c = cookies().get(DASHBOARD_COOKIE_NAME);
  return c ? verifySignedToken(c.value) === 'dashboard' : false;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const member = getTeamMember(params.token);
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://staffing.mtip.ch';
  const profileLink = `${base}/my-reviews?token=${params.token}`;

  await sendInvitation(member.email, member.name.split(' ')[0], profileLink);

  return NextResponse.json({ ok: true });
}
