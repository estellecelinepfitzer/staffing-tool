import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import {
  getTeamMember,
  getAllCycles,
  getAssignmentsForReviewer,
  getSignoff,
} from '@/lib/db';
import type { ReviewCycle, ReviewAssignment } from '@/lib/db';
import PasswordGate from '@/app/checkin/PasswordGate';

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

  // Build per-cycle data
  const cycleData: {
    cycle: ReviewCycle;
    assignments: ReviewAssignment[];
    signoffManagerSigned: boolean;
  }[] = [];

  for (const cycle of allCycles) {
    const assignments = getAssignmentsForReviewer(cycle.id, token);
    if (assignments.length === 0) continue;
    const signoff = getSignoff(cycle.id, token);
    cycleData.push({
      cycle,
      assignments,
      signoffManagerSigned: !!signoff?.manager_signed_at,
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">My Reviews — {firstName}</h1>

        {cycleData.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-5 py-8 text-center">
            <p className="text-sm text-gray-500">No review cycles found for your account.</p>
          </div>
        )}

        <div className="space-y-4">
          {cycleData.map(({ cycle, assignments, signoffManagerSigned }) => {
            const selfAssignment = assignments.find(
              (a) => a.type === 'self' && a.reviewer_token === token && a.subject_token === token,
            );
            const peerAssignments = assignments.filter((a) => a.type === 'peer');

            const showSelf =
              (cycle.status === 'self_review_open' ||
                cycle.status === 'peer_review_open' ||
                cycle.status === 'manager_review_open' ||
                cycle.status === 'closed') &&
              selfAssignment &&
              selfAssignment.status !== 'submitted';

            const pendingPeers = peerAssignments.filter((a) => a.status === 'pending');

            const showFinalLink =
              cycle.status === 'closed' && signoffManagerSigned;

            const hasItems = showSelf || pendingPeers.length > 0 || showFinalLink;

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
                        <span className="w-4 h-4 rounded border border-gray-300 flex-shrink-0 group-hover:border-gray-500" />
                        Self-review
                        <span className="text-gray-400 text-xs ml-auto">Complete &rarr;</span>
                      </a>
                    </li>
                  )}

                  {pendingPeers.map((a) => (
                    <li key={a.id}>
                      <PeerAssignmentItem
                        cycleId={cycle.id}
                        token={token}
                        subjectToken={a.subject_token}
                      />
                    </li>
                  ))}

                  {showFinalLink && (
                    <li>
                      <a
                        href={`/review/final?cycle=${cycle.id}&token=${token}`}
                        className="flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900"
                      >
                        <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <svg className="w-2.5 h-2.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                        View your manager review
                        <span className="text-gray-400 text-xs ml-auto">Read &rarr;</span>
                      </a>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

async function PeerAssignmentItem({
  cycleId,
  token,
  subjectToken,
}: {
  cycleId: number;
  token: string;
  subjectToken: string;
}) {
  const subject = getTeamMember(subjectToken);
  const subjectName = subject?.name ?? subjectToken;

  return (
    <a
      href={`/review/peer?cycle=${cycleId}&token=${token}&subject=${subjectToken}`}
      className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 group"
    >
      <span className="w-4 h-4 rounded border border-gray-300 flex-shrink-0 group-hover:border-gray-500" />
      Peer review — {subjectName}
      <span className="text-gray-400 text-xs ml-auto">Complete &rarr;</span>
    </a>
  );
}
