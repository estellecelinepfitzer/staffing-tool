import { NextRequest, NextResponse } from 'next/server';
import {
  getAllCycles,
  getCycleAssignments,
  getActiveTeamMembers,
  getCheckinMembers,
  getCheckin,
  getTeamMember,
} from '@/lib/db';
import { sendMondayDigest } from '@/lib/email';
import { getISOWeek } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://staffing.mtip.ch';
const CRON_SECRET = process.env.CRON_SECRET;

const OPEN_STATUSES = new Set(['self_review_open', 'peer_review_open', 'manager_review_open']);

export async function POST(request: NextRequest) {
  // Verify secret so only Railway's cron can call this
  const auth = request.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { week, year } = getISOWeek(new Date());

  // Which cycles are currently open?
  const openCycles = getAllCycles().filter((c) => OPEN_STATUSES.has(c.status));

  // Pre-load all assignments for open cycles
  const assignmentsByCycle = new Map(
    openCycles.map((c) => [c.id, getCycleAssignments(c.id)]),
  );

  // All active members
  const allMembers = getActiveTeamMembers();
  // Members with check-in enabled
  const checkinTokens = new Set(getCheckinMembers().map((m) => m.token));

  const results: { name: string; sent: boolean; reason?: string }[] = [];

  for (let i = 0; i < allMembers.length; i++) {
    const member = allMembers[i];
    if (i > 0) await new Promise((r) => setTimeout(r, 1500));

    // ── Check-in outstanding? ──────────────────────────────────────────────
    let checkinLink: string | null = null;
    if (checkinTokens.has(member.token)) {
      const existing = getCheckin(member.token, week, year);
      if (!existing) {
        checkinLink = `${BASE_URL}/checkin?token=${member.token}`;
      }
    }

    // ── Outstanding review forms ───────────────────────────────────────────
    const outstanding: { label: string; link: string }[] = [];

    for (const cycle of openCycles) {
      const assignments = assignmentsByCycle.get(cycle.id) ?? [];

      // Self review
      const selfA = assignments.find(
        (a) => a.type === 'self' && a.reviewer_token === member.token && a.status === 'pending' && a.removed === 0,
      );
      if (selfA) {
        outstanding.push({
          label: `Self-review — ${cycle.name}`,
          link: `${BASE_URL}/review/self?cycle=${cycle.id}&token=${member.token}`,
        });
      }

      // Peer reviews
      if (cycle.status === 'peer_review_open' || cycle.status === 'manager_review_open') {
        const pendingPeers = assignments.filter(
          (a) => a.type === 'peer' && a.reviewer_token === member.token && a.status === 'pending' && a.removed === 0,
        );
        for (const a of pendingPeers) {
          const subject = getTeamMember(a.subject_token);
          outstanding.push({
            label: `Peer review for ${subject?.name ?? a.subject_token} — ${cycle.name}`,
            link: `${BASE_URL}/review/peer?cycle=${cycle.id}&token=${member.token}&subject=${a.subject_token}`,
          });
        }
      }

      // Manager reviews
      if (cycle.status === 'manager_review_open') {
        const pendingManager = assignments.filter(
          (a) => a.type === 'manager' && a.reviewer_token === member.token && a.status === 'pending' && a.removed === 0,
        );
        for (const a of pendingManager) {
          const subject = getTeamMember(a.subject_token);
          outstanding.push({
            label: `Manager review for ${subject?.name ?? a.subject_token} — ${cycle.name}`,
            link: `${BASE_URL}/review/manager?cycle=${cycle.id}&token=${member.token}&subject=${a.subject_token}`,
          });
        }
      }
    }

    // Only email if there's something to do
    if (!checkinLink && outstanding.length === 0) {
      results.push({ name: member.name, sent: false, reason: 'nothing outstanding' });
      continue;
    }

    const r = await sendMondayDigest(
      member.email,
      member.name.split(' ')[0],
      checkinLink,
      outstanding,
    );
    results.push({ name: member.name, sent: r.ok, reason: r.error });
  }

  return NextResponse.json({ ok: true, week, year, results });
}
