import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import { getTeamMember, getAssignment, submitAssignment, managerSignOff, getCycle } from '@/lib/db';
import { sendReviewAvailable } from '@/lib/email';

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? 'https://staffing-tool.up.railway.app';

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const authenticatedToken = session ? verifySignedToken(session.value) : null;

  if (!authenticatedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { cycle_id?: number; subject_token?: string; assignment_id?: number };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { cycle_id, subject_token, assignment_id } = body;

  if (!cycle_id || !subject_token || !assignment_id) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Verify the authenticated user is this person's manager
  const subject = getTeamMember(subject_token);
  if (!subject) {
    return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
  }

  if (subject.manager_token !== authenticatedToken) {
    return NextResponse.json({ error: 'Forbidden — not the manager' }, { status: 403 });
  }

  // Verify assignment belongs to manager
  const assignment = getAssignment(assignment_id);
  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  if (assignment.reviewer_token !== authenticatedToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  submitAssignment(assignment_id);
  managerSignOff(cycle_id, subject_token);

  // Send email notification to subject
  const link = `${BASE_URL}/review/final?cycle=${cycle_id}&token=${subject_token}`;
  const firstName = subject.name.split(' ')[0];
  const cycle = getCycle(cycle_id);
  const cycleName = cycle?.name ?? 'your review cycle';

  await sendReviewAvailable(subject.email, firstName, cycleName, link);

  return NextResponse.json({ ok: true });
}
