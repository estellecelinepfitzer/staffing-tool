import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { updateGoal, deleteGoal } from '@/lib/db';


export async function PATCH(
  request: NextRequest,
  { params }: { params: { cycleId: string; goalId: string } },
) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const goalId = parseInt(params.goalId, 10);
  if (isNaN(goalId)) return NextResponse.json({ error: 'Invalid goalId' }, { status: 400 });

  deleteGoal(goalId);
  return NextResponse.json({ ok: true });
}
