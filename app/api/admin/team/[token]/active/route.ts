import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { setMemberActive } from '@/lib/db';


export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token } = params;
  const body = await request.json() as { active: boolean };

  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'active (boolean) required' }, { status: 400 });
  }

  setMemberActive(token, body.active);
  return NextResponse.json({ ok: true });
}
