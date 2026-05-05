export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import { verifySignedToken, COOKIE_NAME } from '@/lib/auth';
import {
  getTeamMember,
  getCycle,
  getSubmittedPeerAssignmentsForSubject,
  getResponsesForAssignments,
  getCycleQuestions,
} from '@/lib/db';
import type { ReviewAssignment, ReviewResponse } from '@/lib/db';
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

function peerLabel(cycleId: number, subjectToken: string, reviewerToken: string): string {
  return createHash('sha256')
    .update(`${cycleId}:${subjectToken}:${reviewerToken}`)
    .digest('hex');
}

export default function PeerReviewPrintPage({ searchParams }: PageProps) {
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
  const peerResponseMaps = sorted.map((a) => responsesToMap(byAssignment.get(a.id) ?? []));

  const today = new Date().toLocaleDateString('en-CH', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <html>
      <head>
        <title>{`Peer Feedback — ${subject.name} — ${cycle.name}`}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #111; background: white; padding: 40px; max-width: 760px; margin: 0 auto; }
          h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
          h2 { font-size: 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin: 24px 0 12px; }
          .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
          .peer-q { margin-bottom: 18px; }
          .peer-q-label { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
          .peer-answer { display: flex; gap: 8px; margin-bottom: 6px; font-size: 13px; color: #111; line-height: 1.6; }
          .peer-bullet { color: #d1d5db; flex-shrink: 0; }
          .empty { color: #9ca3af; font-style: italic; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 20px; }
          }
        `}</style>
      </head>
      <body>
        <PrintButton />

        <h1>Peer Feedback — {subject.name}</h1>
        <p className="meta">
          {cycle.name} &nbsp;·&nbsp; {peerAssignments.length} reviewer{peerAssignments.length !== 1 ? 's' : ''} &nbsp;·&nbsp; {today}
          &nbsp;·&nbsp; Anonymous
        </p>

        {peerAssignments.length === 0 ? (
          <p className="empty">No peer reviews submitted yet.</p>
        ) : (
          <>
            <h2>Feedback by Question</h2>
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
