import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import { getAssignment, upsertResponse } from '@/lib/db';

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const authenticatedToken = session ? verifySignedToken(session.value) : null;

  if (!authenticatedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    assignment_id?: number;
    question_key?: string;
    answer_text?: string;
    answer_number?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { assignment_id, question_key, answer_text, answer_number } = body;

  if (!assignment_id || !question_key) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const assignment = getAssignment(assignment_id);
  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
  }

  if (assignment.reviewer_token !== authenticatedToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  upsertResponse(
    assignment_id,
    question_key,
    answer_text ?? null,
    answer_number ?? null,
  );

  return NextResponse.json({ ok: true });
}
