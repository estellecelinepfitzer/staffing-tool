import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import { getAssignment, submitAssignment } from '@/lib/db';

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const authenticatedToken = session ? verifySignedToken(session.value) : null;

  if (!authenticatedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { assignment_id?: number };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { assignment_id } = body;

  if (!assignment_id) {
    return NextResponse.json({ error: 'Missing assignment_id' }, { status: 400 });
  }

  const assignment = getAssignment(assignment_id);
  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  if (assignment.reviewer_token !== authenticatedToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  submitAssignment(assignment_id);

  return NextResponse.json({ ok: true });
}
