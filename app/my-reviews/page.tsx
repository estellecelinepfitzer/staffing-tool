import { cookies } from 'next/headers';
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
import PasswordGate from '@/app/checkin/PasswordGate';
import { getISOWeek, formatWeekLabel, getNextWeek } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

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

function ErrorScreen({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">{title}</h1>
        <p className="text-sm text-gray-500">{body}</p>
      </div>
    </div>
  );
}

export default async function MyReviewsPage({ searchParams }: PageProps) {
  const token = searchParams.token?.trim();
  const weekParam = searchParams.week ? parseInt(searchParams.week, 10) : null;
  const yearParam = searchParams.year ? parseInt(searchParams.year, 10) : null;

  if (!token) {
    return <ErrorScreen title="No token provided" body="Please use your personal reviews link." />;
  }

  const member = getTeamMember(token);
  if (!member) {
    return <ErrorScreen title="Link not recognised" body="This link does not match any team member." />;
  }

  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const authenticatedToken = session ? verifySignedToken(session.value) : null;

  if (authenticatedToken !== token) {
    return <PasswordGate token={token} memberName={member.name} />;
  }

  const firstName = member.name.split(' ')[0];
  const hasCheckin = member.checkin === 1;
  const allCycles = getAllCycles();
  const goals = getMemberGoals(token);

  // Weeks to show: selected week (from dashboard) + the following week
  const now = new Date();
  const nowIso = getISOWeek(now);
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
    if (cycle.status === 'closed' && !isReleased) continue; // hide closed cycles unless review released
    const assignments = getAssignmentsForReviewer(cycle.id, token);
    if (assignments.length === 0 && !isReleased) continue;
    cycleData.push({ cycle, assignments, isReleased });
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Hi, {firstName}</h1>

        {/* Weekly staffing section — only for checkin-enabled members */}
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

            // Show self review during self/peer phase (even if submitted — allow editing)
            const showSelf =
              (cycle.status === 'self_review_open' || cycle.status === 'peer_review_open') &&
              selfAssignment != null;

            // Show all peer assignments during peer phase (even submitted — allow editing)
            const visiblePeers = cycle.status === 'peer_review_open'
              ? peerAssignments
              : peerAssignments.filter((a) => a.status === 'pending');

            // Show manager assignments during manager phase
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

        {/* Change password — small link at the bottom */}
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
  cycleId,
  token,
  subjectToken,
  isSubmitted,
  dueDate,
}: {
  cycleId: number;
  token: string;
  subjectToken: string;
  isSubmitted: boolean;
  dueDate: string | null;
}) {
  const subject = getTeamMember(subjectToken);
  const subjectName = subject?.name ?? subjectToken;

  return (
    <a
      href={`/review/peer?cycle=${cycleId}&token=${token}&subject=${subjectToken}`}
      className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 group"
    >
      <span className={`w-4 h-4 rounded flex-shrink-0 ${isSubmitted ? 'bg-green-100 border border-green-300' : 'border border-gray-300 group-hover:border-gray-500'}`} />
      Peer review — {subjectName}
      {dueDate && <span className="text-gray-400 text-xs">· due {dueDate}</span>}
      <span className="text-gray-400 text-xs ml-auto">{isSubmitted ? 'Edit →' : 'Complete →'}</span>
    </a>
  );
}

async function ManagerAssignmentItem({
  cycleId,
  token,
  subjectToken,
  isSubmitted,
  dueDate,
}: {
  cycleId: number;
  token: string;
  subjectToken: string;
  isSubmitted: boolean;
  dueDate: string | null;
}) {
  const subject = getTeamMember(subjectToken);
  const subjectName = subject?.name ?? subjectToken;

  return (
    <a
      href={`/review/manager?cycle=${cycleId}&token=${token}&subject=${subjectToken}`}
      className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 group"
    >
      <span className={`w-4 h-4 rounded flex-shrink-0 ${isSubmitted ? 'bg-green-100 border border-green-300' : 'border border-gray-300 group-hover:border-gray-500'}`} />
      Manager review — {subjectName}
      {dueDate && <span className="text-gray-400 text-xs">· due {dueDate}</span>}
      <span className="text-gray-400 text-xs ml-auto">{isSubmitted ? 'Edit →' : 'Complete →'}</span>
    </a>
  );
}
