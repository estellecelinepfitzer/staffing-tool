'use client';

import { RATING_LABELS } from '@/lib/reviewQuestions';
import type { CycleQuestion, CycleGoal } from '@/lib/db';

interface Props {
  cycleName: string;
  subjectName: string;
  sharedAt: string;
  responses: Record<string, string | number>;
  questions: CycleQuestion[];
  goals: CycleGoal[];
}

function RatingDisplay({ value }: { value: string | number }) {
  if (value === '' || value === undefined) return <span className="text-gray-400 text-sm">No response</span>;
  const n = Number(value);
  return <span className="text-sm text-gray-800">{RATING_LABELS[n] ?? String(value)}</span>;
}

export default function SharedReviewReadOnly({
  cycleName,
  subjectName,
  sharedAt,
  responses,
  questions,
  goals,
}: Props) {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{cycleName}</p>
          <h1 className="text-xl font-semibold text-gray-900">Manager review — {subjectName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Shared with you on{' '}
            {new Date(sharedAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1">
            Shared with you
          </div>
        </div>

        <div className="space-y-4">
          {/* Goals with progress and comments */}
          {goals.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs font-medium text-gray-500 mb-4">Goals</p>
              <div className="space-y-5">
                {goals.map((goal) => {
                  const progressKey = `goal_progress_${goal.id}`;
                  const commentKey = `goal_comment_${goal.id}`;
                  return (
                    <div key={goal.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <p className="text-sm text-gray-800 font-medium mb-2">{goal.body}</p>
                      <div className="mb-2">
                        <p className="text-xs font-medium text-gray-400 mb-1">Progress</p>
                        <RatingDisplay value={responses[progressKey] ?? ''} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-1">Comment</p>
                        <div className="text-sm text-gray-800 whitespace-pre-wrap">
                          {responses[commentKey] !== '' && responses[commentKey] !== undefined
                            ? String(responses[commentKey])
                            : <span className="text-gray-400">No comment</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manager review questions */}
          {questions.map((q) => (
            <div key={q.question_key} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs font-medium text-gray-500 mb-2">{q.question_text}</p>
              {q.question_type === 'rating' ? (
                <RatingDisplay value={responses[q.question_key] ?? ''} />
              ) : (
                <div className="text-sm text-gray-800 whitespace-pre-wrap">
                  {responses[q.question_key] !== '' && responses[q.question_key] !== undefined
                    ? String(responses[q.question_key])
                    : <span className="text-gray-400">No response</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
