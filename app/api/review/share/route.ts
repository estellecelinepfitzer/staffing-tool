import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import {
  getAssignment,
  getSharesForAssignment,
  shareManagerReview,
  unshareManagerReview,
} from '@/lib/db';

function getAuthToken(): string | null {
  const c = cookies().get(COOKIE_NAME);
  return c ? verifySignedToken(c.value) : null;
}

/** Verify the cookie belongs to the manager reviewer on this assignment */
function verifyManagerAccess(assignmentId: number, authToken: string | null): boolean {
  if (!authToken) return false;
  const assignment = getAssignment(assignmentId);
  if (!assignment) return false;
  return assignment.type === 'manager' && assignment.reviewer_token === authToken;
}

export async function GET(request: NextRequest) {
  const authToken = getAuthToken();
  const assignmentIdStr = request.nextUrl.searchParams.get('assignment');
  if (!assignmentIdStr) return NextResponse.json({ error: 'assignment required' }, { status: 400 });

  const assignmentId = parseInt(assignmentIdStr, 10);
  if (isNaN(assignmentId)) return NextResponse.json({ error: 'Invalid assignment' }, { status: 400 });

  if (!verifyManagerAccess(assignmentId, authToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const shares = getSharesForAssignment(assignmentId);
  return NextResponse.json({ shares });
}

export async function POST(request: NextRequest) {
  const authToken = getAuthToken();
  const body = await request.json() as { assignment_id: number; recipient_token: string };

  if (!body.assignment_id || !body.recipient_token) {
    return NextResponse.json({ error: 'assignment_id and recipient_token required' }, { status: 400 });
  }

  if (!verifyManagerAccess(body.assignment_id, authToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  shareManagerReview(body.assignment_id, body.recipient_token);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const authToken = getAuthToken();
  const body = await request.json() as { assignment_id: number; recipient_token: string };

  if (!body.assignment_id || !body.recipient_token) {
    return NextResponse.json({ error: 'assignment_id and recipient_token required' }, { status: 400 });
  }

  if (!verifyManagerAccess(body.assignment_id, authToken)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  unshareManagerReview(body.assignment_id, body.recipient_token);
  return NextResponse.json({ ok: true });
}
