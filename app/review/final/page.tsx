import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import {
  getTeamMember,
  getCycle,
  getCycleAssignments,
  getResponses,
  getSignoff,
  employeeAcknowledge,
} from '@/lib/db';
import type { ReviewResponse } from '@/lib/db';
import PasswordGate from '@/app/checkin/PasswordGate';
import FinalReviewView from './FinalReviewView';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { cycle?: string; token?: string };
}

function InfoScreen({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">{title}</h1>
        <p className="text-sm text-gray-500">{body}</p>
      </div>
    </div>
  );
}

export default async function FinalReviewPage({ searchParams }: PageProps) {
  const token = searchParams.token?.trim();
  const cycleIdStr = searchParams.cycle?.trim();

  if (!token || !cycleIdStr) {
    return <InfoScreen title="Invalid link" body="Missing required parameters." />;
  }

  const cycleId = parseInt(cycleIdStr, 10);
  if (isNaN(cycleId)) {
    return <InfoScreen title="Invalid link" body="Cycle ID is not valid." />;
  }

  const member = getTeamMember(token);
  if (!member) {
    return <InfoScreen title="Link not recognised" body="This link does not match any team member." />;
  }

  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const authenticatedToken = session ? verifySignedToken(session.value) : null;

  if (authenticatedToken !== token) {
    return <PasswordGate token={token} memberName={member.name} />;
  }

  const cycle = getCycle(cycleId);
  if (!cycle) {
    return <InfoScreen title="Cycle not found" body="This review cycle does not exist." />;
  }

  const signoff = getSignoff(cycleId, token);

  if (cycle.status !== 'closed' && !signoff?.manager_signed_at) {
    return <InfoScreen title="Not available" body="Your manager review is not ready yet." />;
  }

  // Find manager assignment where subject_token = token and type = manager
  const allAssignments = getCycleAssignments(cycleId);
  const managerAssignment = allAssignments.find(
    (a) => a.subject_token === token && a.type === 'manager',
  );

  if (!managerAssignment) {
    return <InfoScreen title="Not found" body="No manager review found for your account in this cycle." />;
  }

  const responses: ReviewResponse[] = getResponses(managerAssignment.id);
  const responseMap = Object.fromEntries(
    responses.map((r) => [r.question_key, r.answer_text ?? r.answer_number ?? '']),
  ) as Record<string, string | number>;

  const acknowledgedAt = signoff?.employee_acknowledged_at ?? null;

  return (
    <FinalReviewView
      cycleId={cycleId}
      subjectToken={token}
      cycleName={cycle.name}
      subjectName={member.name}
      responses={responseMap}
      acknowledgedAt={acknowledgedAt}
    />
  );
}
