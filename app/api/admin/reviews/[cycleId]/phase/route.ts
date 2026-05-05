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

    await Promise.all(
      activeMembers.map((member) =>
        sendSelfReviewInvite(
          member.email,
          firstName(member.name),
          cycle.name,
          cycle.self_due,
          `${BASE_URL}/review/self?cycle=${cycleId}&token=${member.token}`,
        ),
      ),
    );
  }

  // ── peer_review_open: send peer review invites ──
  if (status === 'peer_review_open') {
    // Group peer assignments by reviewer
    const allAssignments = getCycleAssignments(cycleId);
    const peerAssignments = allAssignments.filter(
      (a) => a.type === 'peer' && a.removed === 0,
    );

    // Build map: reviewer_token -> [subject_token, ...]
    const byReviewer: Map<string, string[]> = new Map();
    for (const a of peerAssignments) {
      const existing = byReviewer.get(a.reviewer_token) ?? [];
      existing.push(a.subject_token);
      byReviewer.set(a.reviewer_token, existing);
    }

    await Promise.all(
      Array.from(byReviewer.entries()).map(async ([reviewerToken, subjectTokens]) => {
        const reviewer = getTeamMember(reviewerToken);
        if (!reviewer) return;

        const assignments = subjectTokens.map((st) => {
          const subject = getTeamMember(st);
          return {
            subjectName: subject?.name ?? st,
            link: `${BASE_URL}/review/peer?cycle=${cycleId}&token=${reviewerToken}&subject=${st}`,
          };
        });

        await sendPeerReviewInvite(
          reviewer.email,
          firstName(reviewer.name),
          cycle.name,
          cycle.peer_due,
          assignments,
        );
      }),
    );
  }

  // ── manager_review_open: create manager assignments + send invites ──
  if (status === 'manager_review_open') {
    // Build manager -> direct reports map
    const managerMap: Map<string, string[]> = new Map();
    for (const member of activeMembers) {
      const mgr = member.manager_token;
      if (!mgr || mgr === member.token) continue; // skip self-managed
      const existing = managerMap.get(mgr) ?? [];
      existing.push(member.token);
      managerMap.set(mgr, existing);
    }

    // Create manager assignments
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

    // Send emails
    await Promise.all(
      Array.from(managerMap.entries()).map(async ([managerToken, reportTokens]) => {
        const manager = getTeamMember(managerToken);
        if (!manager) return;

        const directReports = reportTokens.map((rt) => {
          const report = getTeamMember(rt);
          return {
            name: report?.name ?? rt,
            link: `${BASE_URL}/review/manager?cycle=${cycleId}&token=${managerToken}&subject=${rt}`,
          };
        });

        await sendManagerReviewInvite(
          manager.email,
          firstName(manager.name),
          cycle.name,
          cycle.manager_due,
          directReports,
        );
      }),
    );
  }

  // Update status
  updateCycleStatus(cycleId, status);

  return NextResponse.json({ ok: true });
}
