import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { deleteTeamMember } from '@/lib/db';


export async function DELETE(
  _req: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  deleteTeamMember(params.token);
  return NextResponse.json({ ok: true });
}
