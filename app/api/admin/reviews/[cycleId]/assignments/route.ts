import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { createAssignment, removeAssignment, getAssignment, getCycle, getTeamMember } from '@/lib/db';
import { sendPeerReviewInvite } from '@/lib/email';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://staffing.mtip.ch';

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

  // If the cycle is already in peer or manager review phase, email the new reviewer immediately
  const cycle = getCycle(cycleId);
  if (cycle && (cycle.status === 'peer_review_open' || cycle.status === 'manager_review_open')) {
    const reviewer = getTeamMember(body.reviewer_token);
    const subject = getTeamMember(body.subject_token);
    if (reviewer && subject) {
      await sendPeerReviewInvite(
        reviewer.email,
        reviewer.name.split(' ')[0],
        cycle.name,
        cycle.peer_due,
        [{ subjectName: subject.name, link: `${BASE_URL}/review/peer?cycle=${cycleId}&token=${body.reviewer_token}&subject=${body.subject_token}` }],
      );
    }
  }

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
