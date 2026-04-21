import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import { employeeAcknowledge } from '@/lib/db';

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const authenticatedToken = session ? verifySignedToken(session.value) : null;

  if (!authenticatedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { cycle_id?: number; subject_token?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { cycle_id, subject_token } = body;

  if (!cycle_id || !subject_token) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Authenticated token must match the subject (employees acknowledge their own review)
  if (authenticatedToken !== subject_token) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  employeeAcknowledge(cycle_id, subject_token);

  return NextResponse.json({ ok: true });
}
