import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import {
  getCycle,
  getTeamMember,
  getCycleAssignments,
  CycleStatus,
} from '@/lib/db';
import { sendReviewReminder } from '@/lib/email';

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? 'https://staffing.mtip.ch';


function firstName(name: string) {
  return name.split(' ')[0];
}

export async function POST(
  request: NextRequest,
  { params }: { params: { cycleId: string } },
) {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cycleId = parseInt(params.cycleId, 10);
  const cycle = getCycle(cycleId);
  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  const body = await request.json() as { token: string };
  if (!body.token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  const member = getTeamMember(body.token);
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const allAssignments = getCycleAssignments(cycleId);
  const outstanding: { label: string; link: string }[] = [];

  // Self review outstanding?
  const selfA = allAssignments.find(
    (a) =>
      a.type === 'self' &&
      a.reviewer_token === body.token &&
      a.status === 'pending' &&
      a.removed === 0,
  );
  if (selfA && cycle.status === 'self_review_open') {
    outstanding.push({
      label: 'Self-review',
      link: `${BASE_URL}/review/self?cycle=${cycleId}&token=${body.token}`,
    });
  }

  // Peer reviews outstanding
  if (cycle.status === 'peer_review_open' || cycle.status === 'manager_review_open' || cycle.status === 'closed') {
    const pendingPeers = allAssignments.filter(
      (a) =>
        a.type === 'peer' &&
        a.reviewer_token === body.token &&
        a.status === 'pending' &&
        a.removed === 0,
    );
    for (const a of pendingPeers) {
      const subject = getTeamMember(a.subject_token);
      outstanding.push({
        label: `Peer review for ${subject?.name ?? a.subject_token}`,
        link: `${BASE_URL}/review/peer?cycle=${cycleId}&token=${body.token}&subject=${a.subject_token}`,
      });
    }
  }

  // Manager review outstanding
  if (cycle.status === 'manager_review_open') {
    const pendingManager = allAssignments.filter(
      (a) =>
        a.type === 'manager' &&
        a.reviewer_token === body.token &&
        a.status === 'pending' &&
        a.removed === 0,
    );
    for (const a of pendingManager) {
      const subject = getTeamMember(a.subject_token);
      outstanding.push({
        label: `Manager review for ${subject?.name ?? a.subject_token}`,
        link: `${BASE_URL}/review/manager?cycle=${cycleId}&token=${body.token}&subject=${a.subject_token}`,
      });
    }
  }

  if (outstanding.length > 0) {
    await sendReviewReminder(member.email, firstName(member.name), outstanding);
  }

  return NextResponse.json({ ok: true, sent: outstanding.length });
}
