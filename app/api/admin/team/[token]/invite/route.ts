import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { getTeamMember } from '@/lib/db';
import { sendInvitation } from '@/lib/email';


export async function POST(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdminRequest()) {
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
