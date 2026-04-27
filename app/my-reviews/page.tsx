import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import {
  getTeamMember,
  getAllCycles,
  getAssignmentsForReviewer,
  getCheckin,
} from '@/lib/db';
import type { ReviewCycle, ReviewAssignment } from '@/lib/db';
import PasswordGate from '@/app/checkin/PasswordGate';
import { getISOWeek, formatWeekLabel } from '@/lib/weeks';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { token?: string };
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
  const allCycles = getAllCycles();

  // Check-in for current week
  const now = new Date();
  const { week: currentWeek, year: currentYear } = getISOWeek(now);
  const weekLabel = formatWeekLabel(currentWeek, currentYear);
  const existingCheckin = getCheckin(token, currentWeek, currentYear);
  const checkinHref = `/checkin?token=${token}`;

  // Build per-cycle data
  const cycleData: {
    cycle: ReviewCycle;
    assignments: ReviewAssignment[];
  }[] = [];

  for (const cycle of allCycles) {
    if (cycle.status === 'closed') continue; // fix #4: hide closed cycles
    const assignments = getAssignmentsForReviewer(cycle.id, token);
    if (assignments.length === 0) continue;
    cycleData.push({ cycle, assignments });
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Hi, {firstName}</h1>

        {/* Weekly staffing section */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Weekly staffing</h2>
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{weekLabel}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {existingCheckin ? 'Check-in submitted' : 'Not submitted yet'}
              </p>
            </div>
            <a
              href={checkinHref}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                existingCheckin
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              {existingCheckin ? 'Edit' : 'Fill in'}
            </a>
          </div>
        </div>

        {/* Reviews section */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Reviews</h2>

        {cycleData.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-8 text-center">
            <p className="text-sm text-gray-500">No review cycles found for your account.</p>
          </div>
        )}

        <div className="space-y-4">
          {cycleData.map(({ cycle, assignments }) => {
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

            const hasItems = showSelf || visiblePeers.length > 0 || visibleManagerReviews.length > 0;

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
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
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
}: {
  cycleId: number;
  token: string;
  subjectToken: string;
  isSubmitted: boolean;
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
      <span className="text-gray-400 text-xs ml-auto">{isSubmitted ? 'Edit →' : 'Complete →'}</span>
    </a>
  );
}

async function ManagerAssignmentItem({
  cycleId,
  token,
  subjectToken,
  isSubmitted,
}: {
  cycleId: number;
  token: string;
  subjectToken: string;
  isSubmitted: boolean;
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
      <span className="text-gray-400 text-xs ml-auto">{isSubmitted ? 'Edit →' : 'Complete →'}</span>
    </a>
  );
}
