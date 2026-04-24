export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import {
  getTeamMember,
  getCycle,
  getAssignment,
  getResponses,
  getSharesForAssignment,
  getCycleGoals,
  getCycleQuestions,
} from '@/lib/db';
import type { ReviewResponse } from '@/lib/db';
import PasswordGate from '@/app/checkin/PasswordGate';
import SharedReviewReadOnly from './SharedReviewReadOnly';

interface PageProps {
  searchParams: { assignment?: string; token?: string };
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

export default async function SharedReviewPage({ searchParams }: PageProps) {
  const token = searchParams.token?.trim();
  const assignmentIdStr = searchParams.assignment?.trim();

  if (!token || !assignmentIdStr) {
    return <InfoScreen title="Invalid link" body="Missing required parameters." />;
  }

  const assignmentId = parseInt(assignmentIdStr, 10);
  if (isNaN(assignmentId)) {
    return <InfoScreen title="Invalid link" body="Assignment ID is not valid." />;
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

  // Verify there is a share record
  const shares = getSharesForAssignment(assignmentId);
  const share = shares.find((s) => s.recipient_token === token);
  if (!share) {
    return <InfoScreen title="Access denied" body="This review has not been shared with you." />;
  }

  const assignment = getAssignment(assignmentId);
  if (!assignment || assignment.type !== 'manager') {
    return <InfoScreen title="Not found" body="Manager review not found." />;
  }

  const cycle = getCycle(assignment.cycle_id);
  if (!cycle) {
    return <InfoScreen title="Cycle not found" body="This review cycle does not exist." />;
  }

  const responses: ReviewResponse[] = getResponses(assignmentId);
  const responseMap = Object.fromEntries(
    responses.map((r) => [r.question_key, r.answer_text ?? r.answer_number ?? '']),
  ) as Record<string, string | number>;

  const subject = getTeamMember(assignment.subject_token);
  const subjectName = subject?.name ?? assignment.subject_token;

  const goals = getCycleGoals(assignment.cycle_id, assignment.subject_token);
  const questions = getCycleQuestions(assignment.cycle_id, 'manager');

  return (
    <SharedReviewReadOnly
      cycleName={cycle.name}
      subjectName={subjectName}
      sharedAt={share.shared_at}
      responses={responseMap}
      questions={questions}
      goals={goals}
    />
  );
}
