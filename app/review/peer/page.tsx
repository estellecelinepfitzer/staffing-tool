import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import { getTeamMember, getCycle, getAssignmentByKey, getResponses, getCycleQuestions } from '@/lib/db';
import type { ReviewResponse } from '@/lib/db';
import PasswordGate from '@/app/checkin/PasswordGate';
import PeerReviewForm from './PeerReviewForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { cycle?: string; token?: string; subject?: string };
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

export default async function PeerReviewPage({ searchParams }: PageProps) {
  const token = searchParams.token?.trim();
  const cycleIdStr = searchParams.cycle?.trim();
  const subjectToken = searchParams.subject?.trim();

  if (!token || !cycleIdStr || !subjectToken) {
    return <InfoScreen title="Invalid link" body="Missing required parameters." />;
  }

  const cycleId = parseInt(cycleIdStr, 10);
  if (isNaN(cycleId)) {
    return <InfoScreen title="Invalid link" body="Cycle ID is not valid." />;
  }

  const reviewer = getTeamMember(token);
  if (!reviewer) {
    return <InfoScreen title="Link not recognised" body="This link does not match any team member." />;
  }

  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const authenticatedToken = session ? verifySignedToken(session.value) : null;

  if (authenticatedToken !== token) {
    return <PasswordGate token={token} memberName={reviewer.name} />;
  }

  const cycle = getCycle(cycleId);
  if (!cycle) {
    return <InfoScreen title="Cycle not found" body="This review cycle does not exist." />;
  }

  const assignment = getAssignmentByKey(cycleId, token, subjectToken, 'peer');

  if (!assignment || assignment.removed === 1) {
    return (
      <InfoScreen
        title="Access denied"
        body="You are not assigned to review this person, or this assignment has been removed."
      />
    );
  }

  if (cycle.status !== 'peer_review_open' && cycle.status !== 'manager_review_open') {
    return <InfoScreen title="Not open" body="Peer reviews are not open yet." />;
  }

  const subject = getTeamMember(subjectToken);
  const subjectName = subject?.name ?? subjectToken;

  const responses: ReviewResponse[] = getResponses(assignment.id);
  const existingResponses = Object.fromEntries(
    responses.map((r) => [r.question_key, r.answer_text ?? r.answer_number ?? '']),
  ) as Record<string, string | number>;

  const isEditable = assignment.status !== 'submitted' || cycle.status === 'peer_review_open';
  const questions = getCycleQuestions(cycleId, 'peer');

  return (
    <PeerReviewForm
      cycleId={cycleId}
      token={token}
      subjectToken={subjectToken}
      subjectName={subjectName}
      cycleName={cycle.name}
      assignmentId={assignment.id}
      existingResponses={existingResponses}
      isEditable={isEditable}
      questions={questions}
    />
  );
}
