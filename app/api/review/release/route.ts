import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import { getTeamMember, releaseManagerReview } from '@/lib/db';

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const authenticatedToken = session ? verifySignedToken(session.value) : null;

  if (!authenticatedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { cycle_id: number; subject_token: string };
  const { cycle_id: cycleId, subject_token: subjectToken } = body;

  if (!cycleId || !subjectToken) {
    return NextResponse.json({ error: 'cycle_id and subject_token required' }, { status: 400 });
  }

  // Verify the caller is the subject's manager
  const subject = getTeamMember(subjectToken);
  if (!subject) {
    return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
  }

  if (subject.manager_token !== authenticatedToken) {
    return NextResponse.json({ error: 'Access denied: not the subject\'s manager' }, { status: 403 });
  }

  releaseManagerReview(cycleId, subjectToken);
  return NextResponse.json({ ok: true });
}
