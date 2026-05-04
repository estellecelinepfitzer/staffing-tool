import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import { getMemberGoalById, updateMemberGoalProgressAndComment } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { goalId: string } },
) {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const memberToken = session ? verifySignedToken(session.value) : null;
  if (!memberToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = parseInt(params.goalId, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid goalId' }, { status: 400 });

  const goal = getMemberGoalById(id);
  if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (goal.member_token !== memberToken) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json() as { progress?: number; progress_comment?: string };
  const progress = typeof body.progress === 'number' ? body.progress : goal.progress;
  const comment = typeof body.progress_comment === 'string' ? body.progress_comment : goal.progress_comment;

  updateMemberGoalProgressAndComment(id, progress, comment);
  return NextResponse.json({ ok: true });
}
