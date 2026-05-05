import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { setMemberRole, getTeamMember } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { role?: string };
  if (body.role !== 'admin' && body.role !== 'member') {
    return NextResponse.json({ error: 'role must be "admin" or "member"' }, { status: 400 });
  }

  const member = getTeamMember(params.token);
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  setMemberRole(params.token, body.role);
  return NextResponse.json({ ok: true });
}
