import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import {
  getCycle,
  updateCycleStatus,
  getActiveTeamMembers,
  createAssignment,
  getPeerAssignmentsForSubject,
  getCycleAssignments,
  getTeamMember,
  CycleStatus,
} from '@/lib/db';
import {
  sendSelfReviewInvite,
  sendPeerReviewInvite,
  sendManagerReviewInvite,
} from '@/lib/email';

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? 'https://staffing.mtip.ch';

const EMAIL_DELAY_MS = 1500; // pause between each send to avoid rate limits

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

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

  const body = await request.json() as { status: CycleStatus };
  const { status } = body;

  const validStatuses: CycleStatus[] = [
    'draft',
    'self_review_open',
    'peer_review_open',
    'manager_review_open',
    'closed',
  ];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const activeMembers = getActiveTeamMembers();

  const emailFailures: string[] = [];

  // ── self_review_open: create self-assignments + send invites ──
  if (status === 'self_review_open') {
    for (const member of activeMembers) {
      createAssignment({
        cycle_id: cycleId,
        reviewer_token: member.token,
        subject_token: member.token,
        type: 'self',
      });
    }

    for (let i = 0; i < activeMembers.length; i++) {
      const member = activeMembers[i];
      if (i > 0) await sleep(EMAIL_DELAY_MS);
      const r = await sendSelfReviewInvite(
        member.email,
        firstName(member.name),
        cycle.name,
        cycle.self_due,
        `${BASE_URL}/review/self?cycle=${cycleId}&token=${member.token}`,
      );
      if (!r.ok) emailFailures.push(member.name);
    }
  }

  // ── peer_review_open: send peer review invites ──
  if (status === 'peer_review_open') {
    const allAssignments = getCycleAssignments(cycleId);
    const peerAssignments = allAssignments.filter(
      (a) => a.type === 'peer' && a.removed === 0,
    );

    const byReviewer: Map<string, string[]> = new Map();
    for (const a of peerAssignments) {
      const existing = byReviewer.get(a.reviewer_token) ?? [];
      existing.push(a.subject_token);
      byReviewer.set(a.reviewer_token, existing);
    }

    const reviewerEntries = Array.from(byReviewer.entries());
    for (let i = 0; i < reviewerEntries.length; i++) {
      const [reviewerToken, subjectTokens] = reviewerEntries[i];
      const reviewer = getTeamMember(reviewerToken);
      if (!reviewer) continue;
      if (i > 0) await sleep(EMAIL_DELAY_MS);
      const assignments = subjectTokens.map((st) => {
        const subject = getTeamMember(st);
        return {
          subjectName: subject?.name ?? st,
          link: `${BASE_URL}/review/peer?cycle=${cycleId}&token=${reviewerToken}&subject=${st}`,
        };
      });
      const r = await sendPeerReviewInvite(
        reviewer.email,
        firstName(reviewer.name),
        cycle.name,
        cycle.peer_due,
        assignments,
      );
      if (!r.ok) emailFailures.push(reviewer.name);
    }
  }

  // ── manager_review_open: create manager assignments + send invites ──
  if (status === 'manager_review_open') {
    const managerMap: Map<string, string[]> = new Map();
    for (const member of activeMembers) {
      const mgr = member.manager_token;
      if (!mgr || mgr === member.token) continue;
      const existing = managerMap.get(mgr) ?? [];
      existing.push(member.token);
      managerMap.set(mgr, existing);
    }

    for (const [managerToken, reportTokens] of Array.from(managerMap.entries())) {
      for (const subjectToken of reportTokens) {
        createAssignment({
          cycle_id: cycleId,
          reviewer_token: managerToken,
          subject_token: subjectToken,
          type: 'manager',
        });
      }
    }

    const managerEntries = Array.from(managerMap.entries());
    for (let i = 0; i < managerEntries.length; i++) {
      const [managerToken, reportTokens] = managerEntries[i];
      const manager = getTeamMember(managerToken);
      if (!manager) continue;
      if (i > 0) await sleep(EMAIL_DELAY_MS);
      const directReports = reportTokens.map((rt) => {
        const report = getTeamMember(rt);
        return {
          name: report?.name ?? rt,
          link: `${BASE_URL}/review/manager?cycle=${cycleId}&token=${managerToken}&subject=${rt}`,
        };
      });
      const r = await sendManagerReviewInvite(
        manager.email,
        firstName(manager.name),
        cycle.name,
        cycle.manager_due,
        directReports,
      );
      if (!r.ok) emailFailures.push(manager.name);
    }
  }

  // Update status
  updateCycleStatus(cycleId, status);

  return NextResponse.json({
    ok: true,
    emailFailures: emailFailures.length > 0 ? emailFailures : undefined,
  });
}
