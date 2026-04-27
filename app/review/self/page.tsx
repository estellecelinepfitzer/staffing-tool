import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import { getTeamMember, getCycle, getAssignmentByKey, getResponses, getMemberGoals, getCycleQuestions } from '@/lib/db';
import type { ReviewResponse } from '@/lib/db';
import PasswordGate from '@/app/checkin/PasswordGate';
import SelfReviewForm from './SelfReviewForm';

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

export default async function SelfReviewPage({ searchParams }: PageProps) {
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

  if (cycle.status === 'closed') {
    return <InfoScreen title="Cycle closed" body="This review cycle is now closed." />;
  }

  const assignment = getAssignmentByKey(cycleId, token, token, 'self');
  if (!assignment) {
    return <InfoScreen title="Not available" body="This form is not available yet." />;
  }

  const responses: ReviewResponse[] = getResponses(assignment.id);
  const existingResponses = Object.fromEntries(
    responses.map((r) => [r.question_key, r.answer_text ?? r.answer_number ?? '']),
  ) as Record<string, string>;

  const isEditable =
    assignment.status !== 'submitted' ||
    cycle.status === 'self_review_open' ||
    cycle.status === 'peer_review_open';

  const goals = getMemberGoals(token);
  const questions = getCycleQuestions(cycleId, 'self');

  return (
    <SelfReviewForm
      cycleId={cycleId}
      token={token}
      cycleName={cycle.name}
      assignmentId={assignment.id}
      existingResponses={existingResponses}
      isEditable={isEditable}
      goals={goals}
      questions={questions}
    />
  );
}
