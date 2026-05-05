import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { createAssignment, removeAssignment, getAssignment } from '@/lib/db';


export async function POST(
  request: NextRequest,
  { params }: { params: { cycleId: string } },
) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cycleId = parseInt(params.cycleId, 10);
  const body = await request.json() as {
    reviewer_token: string;
    subject_token: string;
    type?: string;
  };

  if (!body.reviewer_token || !body.subject_token) {
    return NextResponse.json({ error: 'reviewer_token and subject_token required' }, { status: 400 });
  }

  const id = createAssignment({
    cycle_id: cycleId,
    reviewer_token: body.reviewer_token,
    subject_token: body.subject_token,
    type: 'peer',
  });

  const assignment = getAssignment(id);
  return NextResponse.json({ ok: true, assignment });
}

export async function DELETE(
  request: NextRequest,
  { params: _params }: { params: { cycleId: string } },
) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as { assignment_id: number };
  if (typeof body.assignment_id !== 'number') {
    return NextResponse.json({ error: 'assignment_id required' }, { status: 400 });
  }

  removeAssignment(body.assignment_id);
  return NextResponse.json({ ok: true });
}
