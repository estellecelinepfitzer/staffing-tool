import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { updateManagerToken } from '@/lib/db';


export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdminRequest()) {
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
