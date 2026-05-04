import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/adminAuth';
import { updateMemberGoal, deleteMemberGoal, updateMemberGoalProgress, updateMemberGoalCompanyLink, updateMemberGoalDescription, updateMemberGoalScale } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { token: string; goalId: string } },
) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = parseInt(params.goalId, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid goalId' }, { status: 400 });

  const body = await request.json() as { body?: string; progress?: number; company_goal_id?: number | null; description?: string; scale?: string };

  if (body.body !== undefined) {
    if (!body.body.trim()) return NextResponse.json({ error: 'body required' }, { status: 400 });
    updateMemberGoal(id, body.body.trim());
  }
  if (body.progress !== undefined) updateMemberGoalProgress(id, body.progress);
  if ('company_goal_id' in body) updateMemberGoalCompanyLink(id, body.company_goal_id ?? null);
  if (body.description !== undefined) updateMemberGoalDescription(id, body.description);
  if (body.scale !== undefined) updateMemberGoalScale(id, body.scale as 'rating_5' | 'percent_100');

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { token: string; goalId: string } },
) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = parseInt(params.goalId, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid goalId' }, { status: 400 });

  deleteMemberGoal(id);
  return NextResponse.json({ ok: true });
}
