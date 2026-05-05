export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import {
  getTeamMember,
  getAllCycles,
  getAssignmentsForReviewer,
  getCheckin,
  getSignoff,
  getMemberGoals,
} from '@/lib/db';
import type { ReviewCycle, ReviewAssignment } from '@/lib/db';
import { getISOWeek, formatWeekLabel, getNextWeek } from '@/lib/weeks';
import LogoutButton from './LogoutButton';

interface PageProps {
  searchParams: { token?: string; week?: string; year?: string };
}

function StatusBadge({ status }: { status: ReviewCycle['status'] }) {
  const map: Record<ReviewCycle['status'], { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-500' },
    self_review_open: { label: 'Self-review open', className: 'bg-blue-50 text-blue-700' },
    peer_review_open: { label: 'Peer review open', className: 'bg-amber-50 text-amber-700' },
    manager_review_open: { label: 'Manager review open', className: 'bg-purple-50 text-purple-700' },
    closed: { label: 'Closed', className: 'bg-green-50 text-green-700' },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  );
}

export default async function MyReviewsPage({ searchParams }: PageProps) {
  // ── Auth: require session cookie ──────────────────────────────────────────
  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const sessionToken = session ? verifySignedToken(session.value) : null;

  if (!sessionToken) redirect('/login');

  const member = getTeamMember(sessionToken);
  if (!member) redirect('/login');

  // ── Canonical URL: ensure ?token= matches the session user ───────────────
  const urlToken = searchParams.token?.trim();
  if (urlToken !== member.token) {
    const weekParam = searchParams.week ? `&week=${searchParams.week}` : '';
    const yearParam = searchParams.year ? `&year=${searchParams.year}` : '';
    redirect(`/my-reviews?token=${member.token}${weekParam}${yearParam}`);
  }

  const token = member.token;
  const isAdmin = member.role === 'admin';
  const firstName = member.name.split(' ')[0];
  const hasCheckin = member.checkin === 1;
  const allCycles = getAllCycles();
  const goals = getMemberGoals(token);

  // Weeks to show: selected week (from dashboard) + the following week
  const now = new Date();
  const nowIso = getISOWeek(now);
  const weekParam = searchParams.week ? parseInt(searchParams.week, 10) : null;
  const yearParam = searchParams.year ? parseInt(searchParams.year, 10) : null;
  const selectedWeek = (weekParam && yearParam) ? { week: weekParam, year: yearParam } : nowIso;
  const followingWeek = getNextWeek(selectedWeek.week, selectedWeek.year);

  const weekSlots = hasCheckin ? [selectedWeek, followingWeek] : [];

  // Build per-cycle data
  const cycleData: {
    cycle: ReviewCycle;
    assignments: ReviewAssignment[];
    isReleased: boolean;
  }[] = [];

  for (const cycle of allCycles) {
    const signoff = getSignoff(cycle.id, token);
    const isReleased = !!signoff?.released_at;
    if (cycle.status === 'closed' && !isReleased) continue;
    const assignments = getAssignmentsForReviewer(cycle.id, token);
    if (assignments.length === 0 && !isReleased) continue;
    cycleData.push({ cycle, assignments, isReleased });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Image src="/mtip-logo.png" alt="MTIP" width={56} height={22} className="object-contain" />
          <div className="flex items-center gap-2">
            {isAdmin && (
              <a
                href="/admin"
                className="rounded-lg bg-brand-blue text-white px-3 py-1.5 text-xs font-medium hover:bg-[#006BB0] transition-colors"
              >
                Admin
              </a>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Hi, {firstName}</h1>

        {/* Weekly staffing section */}
        {weekSlots.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Weekly staffing</h2>
            <div className="space-y-2">
              {weekSlots.map(({ week, year }) => {
                const label = formatWeekLabel(week, year);
                const existing = getCheckin(token, week, year);
                const href = `/checkin?token=${token}&week=${week}&year=${year}`;
                return (
                  <div key={`${year}-${week}`} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {existing ? 'Check-in submitted' : 'Not submitted yet'}
                      </p>
                    </div>
                    <a
                      href={href}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        existing
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-brand-blue text-white hover:bg-[#006BB0]'
                      }`}
                    >
                      {existing ? 'Edit' : 'Fill in'}
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Goals section */}
        {goals.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">My goals</h2>
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <ul className="space-y-2">
                {goals.map((goal) => (
                  <li key={goal.id} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                    {goal.body}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Dashboard link — only for checkin-enabled members */}
        {hasCheckin && (
          <div className="mb-6">
            <a
              href="/dashboard"
              className="block w-full text-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View team dashboard →
            </a>
          </div>
        )}

        {/* Reviews section */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Reviews</h2>

          {cycleData.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-8 text-center">
              <p className="text-sm text-gray-500">No review cycles found for your account.</p>
            </div>
          )}

          <div className="space-y-4">
            {cycleData.map(({ cycle, assignments, isReleased }) => {
              const selfAssignment = assignments.find(
                (a) => a.type === 'self' && a.reviewer_token === token && a.subject_token === token,
              );
              const peerAssignments = assignments.filter((a) => a.type === 'peer');
              const managerAssignments = assignments.filter((a) => a.type === 'manager');

              const showSelf =
                (cycle.status === 'self_review_open' || cycle.status === 'peer_review_open') &&
                selfAssignment != null;

              const visiblePeers = cycle.status === 'peer_review_open'
                ? peerAssignments
                : peerAssignments.filter((a) => a.status === 'pending');

              const visibleManagerReviews = cycle.status === 'manager_review_open'
                ? managerAssignments
                : [];

              const hasItems = showSelf || visiblePeers.length > 0 || visibleManagerReviews.length > 0 || isReleased;

              return (
                <div key={cycle.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-base font-medium text-gray-900">{cycle.name}</h2>
                    <StatusBadge status={cycle.status} />
                  </div>

                  {!hasItems && (
                    <p className="text-sm text-gray-400">No outstanding forms.</p>
                  )}

                  <ul className="space-y-2">
                    {showSelf && (
                      <li>
                        <a
                          href={`/review/self?cycle=${cycle.id}&token=${token}`}
                          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 group"
                        >
                          <span className={`w-4 h-4 rounded flex-shrink-0 ${selfAssignment?.status === 'submitted' ? 'bg-green-100 border border-green-300' : 'border border-gray-300 group-hover:border-gray-500'}`} />
                          Self-review
                          {cycle.self_due && (
                            <span className="text-gray-400 text-xs">· due {cycle.self_due}</span>
                          )}
                          <span className="text-gray-400 text-xs ml-auto">
                            {selfAssignment?.status === 'submitted' ? 'Edit →' : 'Complete →'}
                          </span>
                        </a>
                      </li>
                    )}

                    {visiblePeers.map((a) => (
                      <li key={a.id}>
                        <PeerAssignmentItem
                          cycleId={cycle.id}
                          token={token}
                          subjectToken={a.subject_token}
                          isSubmitted={a.status === 'submitted'}
                          dueDate={cycle.peer_due}
                        />
                      </li>
                    ))}

                    {visibleManagerReviews.map((a) => (
                      <li key={a.id}>
                        <ManagerAssignmentItem
                          cycleId={cycle.id}
                          token={token}
                          subjectToken={a.subject_token}
                          isSubmitted={a.status === 'submitted'}
                          dueDate={cycle.manager_due}
                        />
                      </li>
                    ))}

                    {isReleased && (
                      <li>
                        <a
                          href={`/review/manager/employee-view?cycle=${cycle.id}&token=${token}`}
                          className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 group"
                        >
                          <span className="w-4 h-4 rounded flex-shrink-0 bg-blue-100 border border-blue-300" />
                          View manager review PDF
                          <span className="text-gray-400 text-xs ml-auto">Open →</span>
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Change password */}
        <div className="mt-8 text-center">
          <a
            href={`/change-password?token=${token}`}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Change password
          </a>
        </div>
      </div>
    </div>
  );
}

async function PeerAssignmentItem({
  cycleId, token, subjectToken, isSubmitted, dueDate,
}: { cycleId: number; token: string; subjectToken: string; isSubmitted: boolean; dueDate: string | null }) {
  const subject = getTeamMember(subjectToken);
  return (
    <a
      href={`/review/peer?cycle=${cycleId}&token=${token}&subject=${subjectToken}`}
      className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 group"
    >
      <span className={`w-4 h-4 rounded flex-shrink-0 ${isSubmitted ? 'bg-green-100 border border-green-300' : 'border border-gray-300 group-hover:border-gray-500'}`} />
      Peer review — {subject?.name ?? subjectToken}
      {dueDate && <span className="text-gray-400 text-xs">· due {dueDate}</span>}
      <span className="text-gray-400 text-xs ml-auto">{isSubmitted ? 'Edit →' : 'Complete →'}</span>
    </a>
  );
}

async function ManagerAssignmentItem({
  cycleId, token, subjectToken, isSubmitted, dueDate,
}: { cycleId: number; token: string; subjectToken: string; isSubmitted: boolean; dueDate: string | null }) {
  const subject = getTeamMember(subjectToken);
  return (
    <a
      href={`/review/manager?cycle=${cycleId}&token=${token}&subject=${subjectToken}`}
      className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 group"
    >
      <span className={`w-4 h-4 rounded flex-shrink-0 ${isSubmitted ? 'bg-green-100 border border-green-300' : 'border border-gray-300 group-hover:border-gray-500'}`} />
      Manager review — {subject?.name ?? subjectToken}
      {dueDate && <span className="text-gray-400 text-xs">· due {dueDate}</span>}
      <span className="text-gray-400 text-xs ml-auto">{isSubmitted ? 'Edit →' : 'Complete →'}</span>
    </a>
  );
}
