import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import { getMemberGoalById, getTeamMember, updateManagerGoalProgressAndComment } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { goalId: string } },
) {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const managerToken = session ? verifySignedToken(session.value) : null;
  if (!managerToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = parseInt(params.goalId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid goal ID' }, { status: 400 });
  }

  const goal = getMemberGoalById(id);
  if (!goal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Verify the requester is the manager of the goal owner
  const goalOwner = getTeamMember(goal.member_token);
  if (!goalOwner || goalOwner.manager_token !== managerToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json() as { manager_progress?: number | null; manager_comment?: string };
  const managerProgress = body.manager_progress !== undefined ? body.manager_progress : null;
  const managerComment = typeof body.manager_comment === 'string' ? body.manager_comment : '';

  updateManagerGoalProgressAndComment(id, managerProgress, managerComment);
  return NextResponse.json({ ok: true });
}
