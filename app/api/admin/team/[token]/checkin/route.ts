import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { setMemberCheckin } from '@/lib/db';


export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { checkin: boolean };
  setMemberCheckin(params.token, !!body.checkin);
  return NextResponse.json({ ok: true });
}
