import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { getMemberGoals, addMemberGoal } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const goals = getMemberGoals(params.token);
  return NextResponse.json({ goals });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { body: string };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: 'body required' }, { status: 400 });
  }

  const id = addMemberGoal(params.token, body.body.trim());
  return NextResponse.json({ id, ok: true });
}
