export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import {
  getTeamMember,
  getCycle,
  getAssignmentByKey,
  getResponses,
  getSubmittedPeerAssignmentsForSubject,
  getResponsesForAssignments,
  getSignoff,
  getMemberGoals,
  getCycleQuestions,
} from '@/lib/db';
import type { ReviewAssignment, ReviewResponse } from '@/lib/db';
import { RATING_LABELS } from '@/lib/reviewQuestions';
import PasswordGate from '@/app/checkin/PasswordGate';
import PrintButton from '../print/PrintButton';

interface PageProps {
  searchParams: { cycle?: string; token?: string };
}

function responsesToMap(responses: ReviewResponse[]): Record<string, string | number> {
  return Object.fromEntries(
    responses.map((r) => [r.question_key, r.answer_text ?? r.answer_number ?? '']),
  );
}

function peerLabel(cycleId: number, subjectToken: string, reviewerToken: string): string {
  return createHash('sha256')
    .update(`${cycleId}:${subjectToken}:${reviewerToken}`)
    .digest('hex');
}

export default function EmployeeReviewViewPage({ searchParams }: PageProps) {
  const token = searchParams.token?.trim();
  const cycleIdStr = searchParams.cycle?.trim();

  if (!token || !cycleIdStr) {
    return <p>Missing parameters.</p>;
  }

  const cycleId = parseInt(cycleIdStr, 10);
  if (isNaN(cycleId)) return <p>Invalid cycle.</p>;

  const subject = getTeamMember(token);
  if (!subject) return <p>Member not found.</p>;

  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const authenticatedToken = session ? verifySignedToken(session.value) : null;

  if (authenticatedToken !== token) {
    return <PasswordGate token={token} memberName={subject.name} />;
  }

  const signoff = getSignoff(cycleId, token);
  if (!signoff?.released_at) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Not yet available</h1>
          <p className="text-sm text-gray-500">Your manager review has not been released yet.</p>
        </div>
      </div>
    );
  }

  const cycle = getCycle(cycleId);
  if (!cycle) return <p>Cycle not found.</p>;

  const manager = getTeamMember(subject.manager_token);
  if (!manager) return <p>Manager not found.</p>;

  const managerAssignment = getAssignmentByKey(cycleId, subject.manager_token, token, 'manager');
  if (!managerAssignment) return <p>Assignment not found.</p>;

  const managerResponses = responsesToMap(getResponses(managerAssignment.id));
  const goals = getMemberGoals(token);
  const questions = getCycleQuestions(cycleId, 'manager');

  // Peer reviews — aggregate ratings only
  const peerAssignments: ReviewAssignment[] = getSubmittedPeerAssignmentsForSubject(cycleId, token);
  const peerResponseRows = getResponsesForAssignments(peerAssignments.map((a) => a.id));
  const byAssignment = new Map<number, ReviewResponse[]>();
  for (const row of peerResponseRows) {
    if (!byAssignment.has(row.assignment_id)) byAssignment.set(row.assignment_id, []);
    byAssignment.get(row.assignment_id)!.push(row);
  }
  const sorted = [...peerAssignments].sort((a, b) =>
    peerLabel(cycleId, token, a.reviewer_token).localeCompare(
      peerLabel(cycleId, token, b.reviewer_token),
    ),
  );
  const peerResponseMaps = sorted.map((a) =>
    responsesToMap(byAssignment.get(a.id) ?? []),
  );

  // Compute average peer ratings per question key
  const peerRatingAverages: Record<string, number | null> = {};
  for (const q of questions.filter((q) => q.question_type === 'rating')) {
    const vals = peerResponseMaps
      .map((r) => r[q.question_key])
      .filter((v) => v !== '' && v !== undefined)
      .map(Number);
    peerRatingAverages[q.question_key] = vals.length > 0
      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
      : null;
  }

  const today = new Date().toLocaleDateString('en-CH', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <html>
      <head>
        <title>{`Manager Review — ${subject.name} — ${cycle.name}`}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111; background: white; padding: 40px; max-width: 760px; margin: 0 auto; }
          h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
          h2 { font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin: 24px 0 12px; }
          .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
          .field { margin-bottom: 14px; }
          .label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
          .value { color: #111; line-height: 1.5; }
          .rating { display: inline-block; background: #f3f4f6; border-radius: 6px; padding: 2px 10px; font-weight: 600; }
          .goal { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
          .goal-title { font-weight: 600; margin-bottom: 8px; }
          .peer-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .peer-table th { text-align: left; font-weight: 600; color: #6b7280; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
          .peer-table td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 20px; }
          }
        `}</style>
      </head>
      <body>
        <PrintButton />

        <h1>Manager Review — {subject.name}</h1>
        <p className="meta">
          {cycle.name} &nbsp;·&nbsp; Manager: {manager.name} &nbsp;·&nbsp; {today}
          {signoff?.manager_signed_at && ' · Signed off'}
        </p>

        {/* Goals */}
        {goals.length > 0 && (
          <>
            <h2>Goals</h2>
            {goals.map((goal) => {
              const progressKey = `goal_progress_${goal.id}`;
              const commentKey = `goal_comment_${goal.id}`;
              const progress = managerResponses[progressKey];
              const comment = managerResponses[commentKey];
              return (
                <div key={goal.id} className="goal">
                  <div className="goal-title">{goal.body}</div>
                  <div className="field">
                    <div className="label">Manager rating</div>
                    <div className="value">
                      {progress !== '' && progress !== undefined
                        ? <span className="rating">{progress} — {RATING_LABELS[Number(progress)]}</span>
                        : <span style={{color:'#9ca3af'}}>Not rated</span>}
                    </div>
                  </div>
                  {comment && (
                    <div className="field">
                      <div className="label">Comment</div>
                      <div className="value" style={{whiteSpace:'pre-wrap'}}>{String(comment)}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Manager assessment */}
        <h2>Manager Assessment</h2>
        {questions.map((q) => {
          const val = managerResponses[q.question_key];
          return (
            <div key={q.question_key} className="field">
              <div className="label">{q.question_text}</div>
              <div className="value">
                {val !== '' && val !== undefined
                  ? q.question_type === 'rating'
                    ? <span className="rating">{val} — {RATING_LABELS[Number(val)]}</span>
                    : <span style={{whiteSpace:'pre-wrap'}}>{String(val)}</span>
                  : <span style={{color:'#9ca3af'}}>No response</span>}
              </div>
            </div>
          );
        })}

        {/* Aggregated peer ratings */}
        {peerAssignments.length > 0 && questions.some((q) => q.question_type === 'rating') && (
          <>
            <h2>Aggregated Peer Ratings ({peerAssignments.length} reviewers)</h2>
            <table className="peer-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th style={{width:'140px'}}>Avg. Rating</th>
                </tr>
              </thead>
              <tbody>
                {questions.filter((q) => q.question_type === 'rating').map((q) => {
                  const avg = peerRatingAverages[q.question_key];
                  return (
                    <tr key={q.question_key}>
                      <td>{q.question_text}</td>
                      <td>
                        {avg !== null
                          ? `${avg} / 5`
                          : <span style={{color:'#9ca3af'}}>No data</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </body>
    </html>
  );
}
