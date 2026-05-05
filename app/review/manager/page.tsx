import { cookies } from 'next/headers';
import { createHash } from 'crypto';  // used for deterministic peer ordering
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import {
  getTeamMember,
  getCycle,
  getAssignmentByKey,
  getResponses,
  getSubmittedPeerAssignmentsForSubject,
  getResponsesForAssignments,
  getSignoff,
  getMemberGoalsExtended,
  getCycleQuestions,
} from '@/lib/db';
import type { ReviewAssignment, ReviewResponse } from '@/lib/db';
import PasswordGate from '@/app/checkin/PasswordGate';
import ManagerReviewForm from './ManagerReviewForm';

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

function peerLabel(cycleId: number, subjectToken: string, reviewerToken: string): string {
  return createHash('sha256')
    .update(`${cycleId}:${subjectToken}:${reviewerToken}`)
    .digest('hex');
}

function responsesToMap(responses: ReviewResponse[]): Record<string, string | number> {
  return Object.fromEntries(
    responses.map((r) => [r.question_key, r.answer_text ?? r.answer_number ?? '']),
  );
}

export default async function ManagerReviewPage({ searchParams }: PageProps) {
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

  const manager = getTeamMember(token);
  if (!manager) {
    return <InfoScreen title="Link not recognised" body="This link does not match any team member." />;
  }

  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const authenticatedToken = session ? verifySignedToken(session.value) : null;

  if (authenticatedToken !== token) {
    return <PasswordGate token={token} memberName={manager.name} />;
  }

  // Access control: verify this manager is assigned to this subject
  const subject = getTeamMember(subjectToken);
  if (!subject) {
    return <InfoScreen title="Subject not found" body="This team member does not exist." />;
  }

  if (subject.manager_token !== token) {
    return (
      <InfoScreen
        title="Access denied"
        body="You are not the assigned manager for this team member."
      />
    );
  }

  const cycle = getCycle(cycleId);
  if (!cycle) {
    return <InfoScreen title="Cycle not found" body="This review cycle does not exist." />;
  }

  // Manager assignment
  const managerAssignment = getAssignmentByKey(cycleId, token, subjectToken, 'manager');
  if (!managerAssignment) {
    return <InfoScreen title="Assignment not found" body="No manager assignment found for this review." />;
  }

  // Check release/signoff status before access gate
  const signoff = getSignoff(cycleId, subjectToken);
  const isSignedOff = !!signoff?.manager_signed_at;
  const isReleased = !!signoff?.released_at;

  // Access control: allow during manager_review_open OR when this review was released
  // Block entirely if cycle is closed
  if (cycle.status === 'closed') {
    return <InfoScreen title="Cycle closed" body="This review cycle is now closed." />;
  }
  if (cycle.status !== 'manager_review_open' && !isReleased) {
    return <InfoScreen title="Not open" body="Manager reviews are not open yet." />;
  }

  // Peer submissions (show whatever is available)
  const peerAssignments: ReviewAssignment[] = getSubmittedPeerAssignmentsForSubject(cycleId, subjectToken);

  // Self-review
  const selfAssignment = getAssignmentByKey(cycleId, subjectToken, subjectToken, 'self');
  const selfResponses = selfAssignment ? getResponses(selfAssignment.id) : [];
  const selfResponseMap = responsesToMap(selfResponses);
  const selfGoals = (selfResponseMap['goals_progress'] as string) ?? '';

  const managerResponses = getResponses(managerAssignment.id);
  const managerResponseMap = responsesToMap(managerResponses) as Record<string, string | number>;

  // Peer reviews — load responses and build labeled list
  const peerResponseRows = getResponsesForAssignments(peerAssignments.map((a) => a.id));
  const peerResponsesByAssignment = new Map<number, ReviewResponse[]>();
  for (const row of peerResponseRows) {
    if (!peerResponsesByAssignment.has(row.assignment_id)) {
      peerResponsesByAssignment.set(row.assignment_id, []);
    }
    peerResponsesByAssignment.get(row.assignment_id)!.push(row);
  }

  // Sort peer assignments deterministically by hash
  const sorted = [...peerAssignments].sort((a, b) =>
    peerLabel(cycleId, subjectToken, a.reviewer_token).localeCompare(
      peerLabel(cycleId, subjectToken, b.reviewer_token),
    ),
  );
  const peerReviews = sorted.map((a) => ({
    responses: responsesToMap(peerResponsesByAssignment.get(a.id) ?? []) as Record<string, string | number>,
  }));

  const goals = getMemberGoalsExtended(subjectToken);
  const questions = getCycleQuestions(cycleId, 'manager');
  const selfQuestions = getCycleQuestions(cycleId, 'self');
  const peerQuestions = getCycleQuestions(cycleId, 'peer');

  return (
    <ManagerReviewForm
      cycleId={cycleId}
      managerToken={token}
      subjectToken={subjectToken}
      subjectName={subject.name}
      cycleName={cycle.name}
      assignmentId={managerAssignment.id}
      existingResponses={managerResponseMap}
      selfReviewResponses={selfResponseMap as Record<string, string>}
      peerReviews={peerReviews}
      selfGoals={selfGoals}
      isEditable={!isReleased && cycle.status === 'manager_review_open'}
      isSignedOff={isSignedOff}
      isReleased={isReleased}
      goals={goals}
      questions={questions}
      selfQuestions={selfQuestions}
      peerQuestions={peerQuestions}
    />
  );
}
