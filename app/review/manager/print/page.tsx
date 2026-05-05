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
  getMemberGoalsExtended,
  getCycleQuestions,
} from '@/lib/db';
import type { ReviewAssignment, ReviewResponse } from '@/lib/db';
import { RATING_LABELS } from '@/lib/reviewQuestions';
import PrintButton from './PrintButton';

interface PageProps {
  searchParams: { cycle?: string; token?: string; subject?: string };
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

export default function ManagerReviewPrintPage({ searchParams }: PageProps) {
  const token = searchParams.token?.trim();
  const cycleIdStr = searchParams.cycle?.trim();
  const subjectToken = searchParams.subject?.trim();

  if (!token || !cycleIdStr || !subjectToken) {
    return <p>Missing parameters.</p>;
  }

  const cycleId = parseInt(cycleIdStr, 10);
  if (isNaN(cycleId)) return <p>Invalid cycle.</p>;

  const manager = getTeamMember(token);
  if (!manager) return <p>Manager not found.</p>;

  const cookieStore = cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const authenticatedToken = session ? verifySignedToken(session.value) : null;
  if (authenticatedToken !== token) return <p>Not authenticated.</p>;

  const subject = getTeamMember(subjectToken);
  if (!subject || subject.manager_token !== token) return <p>Access denied.</p>;

  const cycle = getCycle(cycleId);
  if (!cycle) return <p>Cycle not found.</p>;

  const managerAssignment = getAssignmentByKey(cycleId, token, subjectToken, 'manager');
  if (!managerAssignment) return <p>Assignment not found.</p>;

  const managerResponses = responsesToMap(getResponses(managerAssignment.id));
  const goals = getMemberGoalsExtended(subjectToken);
  const questions = getCycleQuestions(cycleId, 'manager');
  const signoff = getSignoff(cycleId, subjectToken);

  // Peer reviews — per-question anonymous
  const peerAssignments: ReviewAssignment[] = getSubmittedPeerAssignmentsForSubject(cycleId, subjectToken);
  const peerQuestions = getCycleQuestions(cycleId, 'peer');
  const peerResponseRows = getResponsesForAssignments(peerAssignments.map((a) => a.id));
  const byAssignment = new Map<number, ReviewResponse[]>();
  for (const row of peerResponseRows) {
    if (!byAssignment.has(row.assignment_id)) byAssignment.set(row.assignment_id, []);
    byAssignment.get(row.assignment_id)!.push(row);
  }
  const sorted = [...peerAssignments].sort((a, b) =>
    peerLabel(cycleId, subjectToken, a.reviewer_token).localeCompare(
      peerLabel(cycleId, subjectToken, b.reviewer_token),
    ),
  );
  const peerResponseMaps = sorted.map((a) =>
    responsesToMap(byAssignment.get(a.id) ?? []),
  );

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
          h3 { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 6px; }
          .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
          .field { margin-bottom: 14px; }
          .label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
          .value { color: #111; line-height: 1.5; }
          .rating { display: inline-block; background: #f3f4f6; border-radius: 6px; padding: 2px 10px; font-weight: 600; }
          .goal { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 10px; }
          .goal-title { font-weight: 600; margin-bottom: 10px; font-size: 13px; }
          .goal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px; }
          .peer-q { margin-bottom: 14px; }
          .peer-q-label { font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 6px; }
          .peer-answer { display: flex; gap: 8px; margin-bottom: 4px; font-size: 12px; color: #374151; line-height: 1.5; }
          .peer-bullet { color: #d1d5db; flex-shrink: 0; }
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
              const managerProgress = goal.manager_progress;
              const displayProgress = managerProgress !== null && managerProgress !== undefined
                ? managerProgress
                : goal.progress;
              const hasOverride = managerProgress !== null && managerProgress !== undefined;

              return (
                <div key={goal.id} className="goal">
                  <div className="goal-title">{goal.body}</div>
                  {goal.description && (
                    <div className="field">
                      <div className="value" style={{ color: '#6b7280', fontSize: '12px' }}>{goal.description}</div>
                    </div>
                  )}
                  <div className="goal-grid">
                    <div className="field">
                      <div className="label">Employee progress</div>
                      <div className="value">
                        {goal.scale === 'percent_100'
                          ? `${goal.progress}%`
                          : goal.progress > 0
                            ? `${goal.progress} / 5 — ${RATING_LABELS[goal.progress] ?? ''}`
                            : <span style={{ color: '#9ca3af' }}>Not rated</span>}
                      </div>
                    </div>
                    <div className="field">
                      <div className="label">Manager progress{hasOverride ? ' (override)' : ''}</div>
                      <div className="value">
                        {goal.scale === 'percent_100'
                          ? `${Math.round(displayProgress)}%${hasOverride ? '' : ' (employee)'}`
                          : displayProgress > 0
                            ? `${displayProgress} / 5 — ${RATING_LABELS[displayProgress] ?? ''}${hasOverride ? '' : ' (employee)'}`
                            : <span style={{ color: '#9ca3af' }}>Not set</span>}
                      </div>
                    </div>
                  </div>
                  {goal.progress_comment && (
                    <div className="field">
                      <div className="label">Employee comment</div>
                      <div className="value" style={{ whiteSpace: 'pre-wrap' }}>{goal.progress_comment}</div>
                    </div>
                  )}
                  {goal.manager_comment && (
                    <div className="field">
                      <div className="label">Manager comment</div>
                      <div className="value" style={{ whiteSpace: 'pre-wrap' }}>{goal.manager_comment}</div>
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
                    : <span style={{ whiteSpace: 'pre-wrap' }}>{String(val)}</span>
                  : <span style={{ color: '#9ca3af' }}>No response</span>}
              </div>
            </div>
          );
        })}

        {/* Peer feedback — per-question anonymous */}
        {peerAssignments.length > 0 && peerQuestions.length > 0 && (
          <>
            <h2>Peer Feedback ({peerAssignments.length} reviewer{peerAssignments.length !== 1 ? 's' : ''})</h2>
            {peerQuestions.map((q) => {
              const answers = peerResponseMaps
                .map((r) => r[q.question_key])
                .filter((v) => v !== '' && v !== undefined && v !== null);
              if (answers.length === 0) return null;
              return (
                <div key={q.question_key} className="peer-q">
                  <div className="peer-q-label">{q.question_text}</div>
                  {answers.map((answer, i) => (
                    <div key={i} className="peer-answer">
                      <span className="peer-bullet">–</span>
                      <span style={{ whiteSpace: 'pre-wrap' }}>
                        {q.question_type === 'rating'
                          ? `${answer} — ${RATING_LABELS[Number(answer)] ?? ''}`
                          : String(answer)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}
      </body>
    </html>
  );
}
