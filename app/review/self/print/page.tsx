export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import {
  getTeamMember,
  getCycle,
  getAssignmentByKey,
  getResponses,
  getCycleQuestions,
  getMemberGoalsExtended,
} from '@/lib/db';
import type { ReviewResponse } from '@/lib/db';
import { RATING_LABELS } from '@/lib/reviewQuestions';
import PrintButton from '@/app/review/manager/print/PrintButton';

interface PageProps {
  searchParams: { cycle?: string; token?: string; subject?: string };
}

function responsesToMap(responses: ReviewResponse[]): Record<string, string | number> {
  return Object.fromEntries(
    responses.map((r) => [r.question_key, r.answer_text ?? r.answer_number ?? '']),
  );
}

export default function SelfReviewPrintPage({ searchParams }: PageProps) {
  const token = searchParams.token?.trim();
  const cycleIdStr = searchParams.cycle?.trim();
  const subjectToken = searchParams.subject?.trim();

  if (!token || !cycleIdStr || !subjectToken) return <p>Missing parameters.</p>;

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

  const selfAssignment = getAssignmentByKey(cycleId, subjectToken, subjectToken, 'self');
  if (!selfAssignment) return <p>Self-review not found.</p>;

  const responses = responsesToMap(getResponses(selfAssignment.id));
  const questions = getCycleQuestions(cycleId, 'self');
  const goals = getMemberGoalsExtended(subjectToken);

  const today = new Date().toLocaleDateString('en-CH', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <html>
      <head>
        <title>{`Self-Review — ${subject.name} — ${cycle.name}`}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111; background: white; padding: 40px; max-width: 760px; margin: 0 auto; }
          h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
          h2 { font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin: 24px 0 12px; }
          .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
          .field { margin-bottom: 16px; }
          .label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
          .value { color: #111; line-height: 1.5; }
          .rating { display: inline-block; background: #f3f4f6; border-radius: 6px; padding: 2px 10px; font-weight: 600; }
          .goal { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
          .goal-title { font-weight: 600; margin-bottom: 8px; font-size: 13px; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 20px; }
          }
        `}</style>
      </head>
      <body>
        <PrintButton />

        <h1>Self-Review — {subject.name}</h1>
        <p className="meta">{cycle.name} &nbsp;·&nbsp; {today}</p>

        {goals.length > 0 && (
          <>
            <h2>Goals</h2>
            {goals.map((goal) => (
              <div key={goal.id} className="goal">
                <div className="goal-title">{goal.body}</div>
                <div className="field">
                  <div className="label">Progress</div>
                  <div className="value">
                    {goal.scale === 'percent_100'
                      ? `${Math.round(goal.progress)}%`
                      : goal.progress > 0
                        ? <span className="rating">{goal.progress} — {RATING_LABELS[goal.progress] ?? ''}</span>
                        : <span style={{ color: '#9ca3af' }}>Not rated</span>}
                  </div>
                </div>
                {goal.progress_comment && (
                  <div className="field">
                    <div className="label">Comment</div>
                    <div className="value" style={{ whiteSpace: 'pre-wrap' }}>{goal.progress_comment}</div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        <h2>Self-Assessment</h2>
        {questions.map((q) => {
          const val = responses[q.question_key];
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
      </body>
    </html>
  );
}
