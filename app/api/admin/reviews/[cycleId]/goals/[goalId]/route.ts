import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, DASHBOARD_COOKIE_NAME } from '@/lib/auth';
import { updateGoal, deleteGoal } from '@/lib/db';

function isAdmin() {
  const c = cookies().get(DASHBOARD_COOKIE_NAME);
  return c ? verifySignedToken(c.value) === 'dashboard' : false;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { cycleId: string; goalId: string } },
) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const goalId = parseInt(params.goalId, 10);
  if (isNaN(goalId)) return NextResponse.json({ error: 'Invalid goalId' }, { status: 400 });

  const body = await request.json() as { body: string };
  if (typeof body.body !== 'string') {
    return NextResponse.json({ error: 'body required' }, { status: 400 });
  }

  updateGoal(goalId, body.body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { cycleId: string; goalId: string } },
) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const goalId = parseInt(params.goalId, 10);
  if (isNaN(goalId)) return NextResponse.json({ error: 'Invalid goalId' }, { status: 400 });

  deleteGoal(goalId);
  return NextResponse.json({ ok: true });
}
